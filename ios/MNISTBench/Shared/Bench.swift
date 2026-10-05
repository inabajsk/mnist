// Bench.swift : Mac (コマンドライン) と iPhone (アプリ) で共通の計測コード
//
//  1. C++ + Accelerate (cpucnn.cpp, DGX の cudacnn.cu の CPU 経路を移植)
//     MLP 784-1000-1000-10 と CNN (conv5x5 20 - pool - conv5x5 50 - pool - fc500 - fc10) の
//     学習 (バッチ 200, 6,000 枚 × 2 エポック) と推論 (テスト 10,000 枚)
//     比較用に, 行列積を素朴なループ (1 スレッド, SIMD なし) にしたものも測る
//  2. GPU: Metal Performance Shaders Graph (GPUNet.swift) で同じ MLP と CNN を学習・推論
//  4. Core ML の新しい形式 (ML Program, FP16, 100 枚まとめて / 1 枚ずつ) も同じ 4 通りで
//  3. Core ML (ios/models/MNIST{MLP,CNN}.mlmodel, EusLisp で学習した重み) の推論.
//     computeUnits を cpuOnly / cpuAndGPU / cpuAndNeuralEngine / all で切り替える
//
//  データは phone/site と同じファイル (gzip + Base64)
import CoreML
import Foundation

struct BenchResult: Codable {
  var method: String
  var kind: String
  var task: String
  var n: Int
  var sec: Double
  var acc: Double?
  var loss: Double?
  var note: String?
}

struct BenchReport: Codable {
  var info: [String: String]
  var results: [BenchResult]
}

final class Bench {
  let res: URL                       // データとモデルのあるフォルダ
  var log: (String) -> Void = { print($0) }
  var progress: (Double) -> Void = { _ in }
  var onResult: (BenchResult) -> Void = { _ in }
  var quick = false                  // 短め (確認用)
  private(set) var results: [BenchResult] = []

  var testX = [Float](), testY = [UInt8](), trainX = [Float](), trainY = [UInt8]()
  var mlpW = [[Float]](), cnnW = [[Float]]()

  init(resources: URL) { res = resources }

  // ---------- データ ----------
  static func gunzipB64(_ url: URL) throws -> Data {
    let txt = try String(contentsOf: url, encoding: .ascii).trimmingCharacters(in: .whitespacesAndNewlines)
    guard let gz = Data(base64Encoded: txt) else { throw NSError(domain: "bench", code: 1, userInfo: [NSLocalizedDescriptionKey: "Base64 \(url.lastPathComponent)"]) }
    // gzip のヘッダ (10 バイト + 付加情報) と末尾 8 バイトを外して raw deflate として展開
    let b = [UInt8](gz)
    var p = 10
    let flg = b[3]
    if flg & 4 != 0 { p += 2 + Int(b[p]) + Int(b[p + 1]) << 8 }
    if flg & 8 != 0 { while b[p] != 0 { p += 1 }; p += 1 }
    if flg & 16 != 0 { while b[p] != 0 { p += 1 }; p += 1 }
    if flg & 2 != 0 { p += 2 }
    let raw = gz.subdata(in: p..<(gz.count - 8)) as NSData
    return try raw.decompressed(using: .zlib) as Data
  }

  func load() throws {
    let te = [UInt8](try Bench.gunzipB64(res.appendingPathComponent("mnist_test.gz.txt")))
    let tr = [UInt8](try Bench.gunzipB64(res.appendingPathComponent("mnist_train6k.gz.txt")))
    testX = te[0..<7_840_000].map { Float($0) / 255 }; testY = Array(te[7_840_000..<7_850_000])
    trainX = tr[0..<4_704_000].map { Float($0) / 255 }; trainY = Array(tr[4_704_000..<4_710_000])
    func split(_ d: Data, _ sizes: [Int]) -> [[Float]] {
      let f = d.withUnsafeBytes { Array($0.bindMemory(to: Float.self)) }
      var o = 0
      return sizes.map { n in defer { o += n }; return Array(f[o..<o + n]) }
    }
    mlpW = split(try Bench.gunzipB64(res.appendingPathComponent("mlp_w.gz.txt")), [784_000, 1000, 1_000_000, 1000, 10_000, 10])
    cnnW = split(try Bench.gunzipB64(res.appendingPathComponent("cnn_w.gz.txt")), [500, 20, 25_000, 50, 400_000, 500, 5000, 10])
  }

  // 学習の初期値: 計測ページ (phone/site) と同じ U(-0.08, 0.08), b = 0 (シード付き乱数)
  static func randInit(_ sizes: [Int], seed: UInt32) -> [[Float]] {
    var s = seed
    return sizes.enumerated().map { i, n in
      var v = [Float](repeating: 0, count: n)
      if i % 2 == 0 { for k in 0..<n { s = s &* 1_664_525 &+ 1_013_904_223; v[k] = Float(Double(s) / 4_294_967_296 * 0.16 - 0.08) } }
      return v
    }
  }

  static let mlpSpec: [Int] = [28, 28, 1, 5, 1, 1000, 0, 4, 0, 0, 1, 1000, 0, 4, 0, 0, 1, 10, 0]
  static let cnnSpec: [Int] = [28, 28, 1, 9, 2, 5, 20, 4, 0, 0, 3, 0, 0, 2, 5, 50, 4, 0, 0, 3, 0, 0, 1, 500, 0, 4, 0, 0, 1, 10, 0]
  static let mlpSizes = [784_000, 1000, 1_000_000, 1000, 10_000, 10]
  static let cnnSizes = [500, 20, 25_000, 50, 400_000, 500, 5000, 10]

  // CNN の重みを cpucnn の層に入れる (重みのある層に順に)
  func setParams(_ P: [[Float]]) {
    var k = 0
    for l in 0..<ccnn_nlayers() where ccnn_wsize(l) > 0 {
      _ = P[k].withUnsafeBufferPointer { w in P[k + 1].withUnsafeBufferPointer { b in ccnn_set_param(l, w.baseAddress, b.baseAddress) } }
      k += 2
    }
  }
  func createNet(_ spec: [Int], maxb: Int, prec: Int, threads: Int) {
    let s = spec.map { CLong($0) }
    _ = s.withUnsafeBufferPointer { ccnn_create($0.baseAddress, maxb, prec, threads) }
  }

  func add(_ r: BenchResult) {
    results.append(r)
    onResult(r)
    var line = String(format: "%@  %@  %d 枚  %.4f 秒", r.method, r.task, r.n, r.sec)
    if let a = r.acc { line += String(format: "  正解 %.2f%%", a * 100) }
    if let l = r.loss { line += String(format: "  損失 %.3f", l) }
    if let n = r.note { line += "  \(n)" }
    log(line)
  }

  // ---------- 1. C++ + Accelerate ----------
  func benchEngine() {
    let B = 200
    let cases: [(String, [Int], [Int], Int, Int, Int)] = quick
      ? [("mlp", Bench.mlpSpec, Bench.mlpSizes, 32, 0, 1), ("cnn", Bench.cnnSpec, Bench.cnnSizes, 32, 0, 1)]
      : [("mlp", Bench.mlpSpec, Bench.mlpSizes, 32, 0, 2), ("mlp", Bench.mlpSpec, Bench.mlpSizes, 64, 0, 2), ("mlp", Bench.mlpSpec, Bench.mlpSizes, 32, 1, 1),
         ("cnn", Bench.cnnSpec, Bench.cnnSizes, 32, 0, 2), ("cnn", Bench.cnnSpec, Bench.cnnSizes, 64, 0, 2), ("cnn", Bench.cnnSpec, Bench.cnnSizes, 32, 1, 1),
         ("mlp", Bench.mlpSpec, Bench.mlpSizes, 32, 2, 1), ("cnn", Bench.cnnSpec, Bench.cnnSizes, 32, 2, 1)]
    for (i, (kind, spec, sizes, prec, thr, ep)) in cases.enumerated() {
      let method = thr == 2 ? "C++ 素朴なループ FP\(prec)（1 スレッド, SIMD なし）" : "C++ + Accelerate FP\(prec)" + (thr == 1 ? "（1 スレッド）" : "")
      let ntrain = thr == 2 ? 1000 : 6000  // 素朴なループは遅いので 1,000 枚
      log("\(method): \(kind.uppercased()) 学習")
      createNet(spec, maxb: B, prec: prec, threads: thr)
      setParams(Bench.randInit(sizes, seed: 7))
      _ = trainX.withUnsafeBufferPointer { x in trainY.withUnsafeBufferPointer { y in ccnn_upload(0, x.baseAddress, y.baseAddress, ntrain) } }
      for e in 0..<ep {
        let t0 = ccnn_now()
        let loss = ccnn_train_epoch(B, 0.001)
        let sec = ccnn_now() - t0
        add(BenchResult(method: method, kind: kind, task: "\(kind.uppercased()) 学習", n: ntrain, sec: sec, loss: loss, note: "エポック \(e + 1)"))
      }
      progress(Double(i + 1) / Double(cases.count) * 0.45)
    }
    // 推論: EusLisp で学習した重みでテスト 10,000 枚 (バッチ 200) と 1 枚ずつ
    for kind in ["mlp", "cnn"] {
      for prec in quick ? [32] : [32, 64] {
        let method = "C++ + Accelerate FP\(prec)"
        createNet(kind == "mlp" ? Bench.mlpSpec : Bench.cnnSpec, maxb: B, prec: prec, threads: 0)
        setParams(kind == "mlp" ? mlpW : cnnW)
        _ = testX.withUnsafeBufferPointer { x in testY.withUnsafeBufferPointer { y in ccnn_upload(1, x.baseAddress, y.baseAddress, 10000) } }
        _ = ccnn_eval(1, B, nil) // 準備運転
        var t0 = ccnn_now()
        let ok = ccnn_eval(1, B, nil)
        add(BenchResult(method: method, kind: kind, task: "\(kind.uppercased()) 推論", n: 10000, sec: ccnn_now() - t0, acc: Double(ok) / 10000))
        if prec == 32 {
          let n1 = 1000
          _ = testX.withUnsafeBufferPointer { x in testY.withUnsafeBufferPointer { y in ccnn_upload(1, x.baseAddress, y.baseAddress, n1) } }
          t0 = ccnn_now()
          let ok1 = ccnn_eval(1, 1, nil)
          add(BenchResult(method: method, kind: kind, task: "\(kind.uppercased()) 推論 1 枚ずつ", n: n1, sec: ccnn_now() - t0, acc: Double(ok1) / Double(n1)))
        }
      }
    }
    // 素朴なループ (1 スレッド, SIMD なし) の推論: 1,000 枚
    for kind in ["mlp", "cnn"] where !quick {
      createNet(kind == "mlp" ? Bench.mlpSpec : Bench.cnnSpec, maxb: B, prec: 32, threads: 2)
      setParams(kind == "mlp" ? mlpW : cnnW)
      _ = testX.withUnsafeBufferPointer { x in testY.withUnsafeBufferPointer { y in ccnn_upload(1, x.baseAddress, y.baseAddress, 1000) } }
      let t0 = ccnn_now()
      let ok = ccnn_eval(1, B, nil)
      add(BenchResult(method: "C++ 素朴なループ FP32（1 スレッド, SIMD なし）", kind: kind, task: "\(kind.uppercased()) 推論", n: 1000, sec: ccnn_now() - t0, acc: Double(ok) / 1000))
    }
    ccnn_free()
    progress(0.5)
  }

  // ---------- 2. GPU (MPSGraph) ----------
  func benchGPU() {
    let B = 200
    let method = "GPU（Metal MPSGraph）FP32"
    for kind in ["mlp", "cnn"] {
      log("\(method): \(kind.uppercased()) 学習")
      guard let g = GPUNet(cnn: kind == "cnn", batch: B, params: Bench.randInit(kind == "mlp" ? Bench.mlpSizes : Bench.cnnSizes, seed: 7)) else { log("GPU が使えません"); return }
      let data = g.batches(trainX, trainY, count: 6000)
      _ = g.trainEpoch(Array(data[0..<1]))  // 準備運転 (グラフのコンパイル). 1 バッチ分の更新が入る
      for e in 0..<(quick ? 1 : 2) {
        let t0 = ccnn_now()
        let loss = g.trainEpoch(data)
        add(BenchResult(method: method, kind: kind, task: "\(kind.uppercased()) 学習", n: 6000, sec: ccnn_now() - t0, loss: loss, note: "エポック \(e + 1)"))
      }
      // 推論: EusLisp で学習した重み
      let gi = GPUNet(cnn: kind == "cnn", batch: B, params: kind == "mlp" ? mlpW : cnnW)!
      let td = gi.batches(testX, testY, count: 10000)
      _ = gi.evaluate(Array(td[0..<1]))
      var t0 = ccnn_now()
      let ok = gi.evaluate(td)
      add(BenchResult(method: method, kind: kind, task: "\(kind.uppercased()) 推論", n: 10000, sec: ccnn_now() - t0, acc: Double(ok) / 10000))
      let g1 = GPUNet(cnn: kind == "cnn", batch: 1, params: kind == "mlp" ? mlpW : cnnW)!
      let n1 = quick ? 100 : 500
      let d1 = g1.batches(testX, testY, count: n1)
      _ = g1.evaluate(Array(d1[0..<5]))
      t0 = ccnn_now()
      let ok1 = g1.evaluate(d1)
      add(BenchResult(method: method, kind: kind, task: "\(kind.uppercased()) 推論 1 枚ずつ", n: n1, sec: ccnn_now() - t0, acc: Double(ok1) / Double(n1)))
    }
    progress(0.6)
  }

  // ---------- 3. Core ML ----------
  func benchCoreML() {
    var units: [(String, MLComputeUnits)] = [("CPU", .cpuOnly), ("CPU+GPU", .cpuAndGPU)]
    if #available(macOS 13.0, iOS 16.0, *) { units.append(("CPU+Neural Engine", .cpuAndNeuralEngine)) }
    units.append(("すべて", .all))
    let n = quick ? 2000 : 10000
    let n1 = quick ? 500 : 2000
    // 入力 (1×1×28×28) は先に作っておく
    var inputs = [MLFeatureProvider]()
    for i in 0..<n {
      let a = try! MLMultiArray(shape: [1, 1, 28, 28], dataType: .float32)
      let p = a.dataPointer.bindMemory(to: Float.self, capacity: 784)
      testX.withUnsafeBufferPointer { src in p.update(from: src.baseAddress! + i * 784, count: 784) }
      inputs.append(try! MLDictionaryFeatureProvider(dictionary: ["image": MLFeatureValue(multiArray: a)]))
    }
    func argmax(_ f: MLFeatureProvider) -> Int {
      let a = f.featureValue(for: "prob")!.multiArrayValue!
      var b = 0
      for j in 1..<10 where a[j].floatValue > a[b].floatValue { b = j }
      return b
    }
    var step = 0
    for name in ["MNISTMLP", "MNISTCNN"] {
      let kind = name == "MNISTMLP" ? "mlp" : "cnn"
      for (uname, u) in units {
        let method = "Core ML \(uname)"
        log("\(method): \(kind.uppercased())")
        let cfg = MLModelConfiguration()
        cfg.computeUnits = u
        let t0 = ccnn_now()
        guard let m = try? MLModel(contentsOf: res.appendingPathComponent("\(name).mlmodelc"), configuration: cfg) else {
          log("\(method): 読み込めません"); continue
        }
        add(BenchResult(method: method, kind: kind, task: "\(kind.uppercased()) 読み込み", n: 1, sec: ccnn_now() - t0,
                        note: Bench.computePlan(res.appendingPathComponent("\(name).mlmodelc"), cfg)))
        for i in 0..<20 { _ = try? m.prediction(from: inputs[i]) } // 準備運転
        // まとめて (batch API)
        var t = ccnn_now()
        let out = try! m.predictions(from: MLArrayBatchProvider(array: inputs), options: MLPredictionOptions())
        var sec = ccnn_now() - t
        var ok = 0
        for i in 0..<n where argmax(out.features(at: i)) == Int(testY[i]) { ok += 1 }
        add(BenchResult(method: method, kind: kind, task: "\(kind.uppercased()) 推論", n: n, sec: sec, acc: Double(ok) / Double(n)))
        // 1 枚ずつ (中央値も記録)
        var lat = [Double]()
        ok = 0
        t = ccnn_now()
        for i in 0..<n1 {
          let a = ccnn_now()
          let f = try! m.prediction(from: inputs[i])
          lat.append(ccnn_now() - a)
          if argmax(f) == Int(testY[i]) { ok += 1 }
        }
        sec = ccnn_now() - t
        lat.sort()
        add(BenchResult(method: method, kind: kind, task: "\(kind.uppercased()) 推論 1 枚ずつ", n: n1, sec: sec, acc: Double(ok) / Double(n1),
                        note: String(format: "中央値 %.3f ms", lat[n1 / 2] * 1000)))
        step += 1
        progress(0.6 + 0.4 * Double(step) / Double(units.count * 2))
      }
    }
  }

  /// Core ML が各層をどの装置で動かす予定か (MLComputePlan). 例: "Neural Engine 7, CPU 2"
  static func computePlan(_ url: URL, _ cfg: MLModelConfiguration) -> String? {
    guard #available(macOS 14.4, iOS 17.4, *) else { return nil }
    var out: String? = nil
    let sem = DispatchSemaphore(value: 0)
    Task {
      defer { sem.signal() }
      guard let plan = try? await MLComputePlan.load(contentsOf: url, configuration: cfg) else { return }
      var usages = [MLComputeDevice?]()
      switch plan.modelStructure {
      case let .neuralNetwork(nn): usages = nn.layers.map { plan.deviceUsage(for: $0)?.preferred }
      case let .program(prog):  // ML Program: 計算する演算 (定数以外) ごと
        if let f = prog.functions["main"] { usages = f.block.operations.filter { $0.operatorName != "const" }.map { plan.deviceUsage(for: $0)?.preferred } }
      default: return
      }
      var count = [String: Int]()
      for u in usages {
        guard let u else { continue }  // 割り当てのない演算 (形を変えるだけのものなど)
        let d: String
        switch u {
        case .cpu: d = "CPU"
        case .gpu: d = "GPU"
        case .neuralEngine: d = "Neural Engine"
        default: d = "?"
        }
        count[d, default: 0] += 1
      }
      out = "層の割り当て: " + count.sorted { $0.key < $1.key }.map { "\($0.key) \($0.value)" }.joined(separator: ", ")
    }
    sem.wait()
    return out
  }

  // ---------- 4. Core ML の新しい形式 (ML Program, FP16) ----------
  //  MNIST{MLP,CNN}_P100: 100 枚をまとめて 1 回で渡す. _P1: 1 枚ずつ. mkmlprogram.py で作る
  func benchCoreMLProgram() {
    var units: [(String, MLComputeUnits)] = [("CPU", .cpuOnly), ("CPU+GPU", .cpuAndGPU)]
    if #available(macOS 13.0, iOS 16.0, *) { units.append(("CPU+Neural Engine", .cpuAndNeuralEngine)) }
    units.append(("すべて", .all))
    let n = quick ? 2000 : 10000, n1 = quick ? 500 : 2000, P = 100
    func provider(_ start: Int, _ b: Int) -> MLFeatureProvider {
      let a = try! MLMultiArray(shape: [b as NSNumber, 1, 28, 28], dataType: .float32)
      let p = a.dataPointer.bindMemory(to: Float.self, capacity: b * 784)
      testX.withUnsafeBufferPointer { src in p.update(from: src.baseAddress! + start * 784, count: b * 784) }
      return try! MLDictionaryFeatureProvider(dictionary: ["image": MLFeatureValue(multiArray: a)])
    }
    let big = stride(from: 0, to: n, by: P).map { provider($0, P) }
    let one = (0..<n1).map { provider($0, 1) }
    func countOK(_ f: MLFeatureProvider, _ start: Int, _ b: Int) -> Int {
      let a = f.featureValue(for: "prob")!.multiArrayValue!
      var ok = 0  // 出力は FP16 のことがある. floatValue で読む (時間には含めない)
      for r in 0..<b {
        var best = 0
        for j in 1..<10 {
          if a[r * 10 + j].floatValue > a[r * 10 + best].floatValue { best = j }
        }
        if best == Int(testY[start + r]) { ok += 1 }
      }
      return ok
    }
    for kind in ["MLP", "CNN"] {
      for (uname, u) in units {
        let method = "Core ML FP16 \(uname)"
        log("\(method): \(kind)")
        let cfg = MLModelConfiguration()
        cfg.computeUnits = u
        let u100 = res.appendingPathComponent("MNIST\(kind)_P\(P).mlmodelc"), u1 = res.appendingPathComponent("MNIST\(kind)_P1.mlmodelc")
        let t0 = ccnn_now()
        guard let m = try? MLModel(contentsOf: u100, configuration: cfg), let m1 = try? MLModel(contentsOf: u1, configuration: cfg) else {
          log("\(method): 読み込めません"); continue
        }
        add(BenchResult(method: method, kind: kind.lowercased(), task: "\(kind) 読み込み", n: 1, sec: ccnn_now() - t0, note: Bench.computePlan(u100, cfg)))
        for i in 0..<3 { _ = try? m.prediction(from: big[i]) }
        for i in 0..<20 { _ = try? m1.prediction(from: one[i]) }
        var t = ccnn_now(), ok = 0
        var outs = [MLFeatureProvider]()
        for b in big { outs.append(try! m.prediction(from: b)) }
        var sec = ccnn_now() - t
        for (k, f) in outs.enumerated() { ok += countOK(f, k * P, P) }
        add(BenchResult(method: method, kind: kind.lowercased(), task: "\(kind) 推論", n: n, sec: sec, acc: Double(ok) / Double(n), note: "\(P) 枚ずつ渡す"))
        ok = 0
        var lat = [Double]()
        t = ccnn_now()
        for i in 0..<n1 {
          let a = ccnn_now()
          let f = try! m1.prediction(from: one[i])
          lat.append(ccnn_now() - a)
          ok += countOK(f, i, 1)
        }
        sec = ccnn_now() - t
        lat.sort()
        add(BenchResult(method: method, kind: kind.lowercased(), task: "\(kind) 推論 1 枚ずつ", n: n1, sec: sec, acc: Double(ok) / Double(n1),
                        note: String(format: "中央値 %.3f ms", lat[n1 / 2] * 1000)))
      }
    }
  }

  // ---------- 端末情報 ----------
  static func sysctlString(_ name: String) -> String? {
    var size = 0
    guard sysctlbyname(name, nil, &size, nil, 0) == 0, size > 0 else { return nil }
    var buf = [CChar](repeating: 0, count: size)
    guard sysctlbyname(name, &buf, &size, nil, 0) == 0 else { return nil }
    return String(cString: buf)
  }
  static func sysctlInt(_ name: String) -> Int? {
    var v: Int64 = 0
    var size = MemoryLayout<Int64>.size
    guard sysctlbyname(name, &v, &size, nil, 0) == 0 else { return nil }
    return size == 4 ? Int(Int32(truncatingIfNeeded: v)) : Int(v)
  }
  static func thermal() -> String {
    switch ProcessInfo.processInfo.thermalState {
    case .nominal: return "nominal"
    case .fair: return "fair"
    case .serious: return "serious"
    case .critical: return "critical"
    @unknown default: return "unknown"
    }
  }
  static func deviceInfo() -> [String: String] {
    let pi = ProcessInfo.processInfo
    var d: [String: String] = [
      "machine": sysctlString("hw.machine") ?? "?",
      "model": sysctlString("hw.model") ?? "?",
      "os": pi.operatingSystemVersionString,
      "cores": "\(pi.processorCount)",
      "activeCores": "\(pi.activeProcessorCount)",
      "memoryGB": String(format: "%.1f", Double(pi.physicalMemory) / 1_073_741_824),
      "thermalStart": thermal(),
    ]
    if let c = sysctlString("machdep.cpu.brand_string") { d["cpu"] = c }
    if let p = sysctlInt("hw.perflevel0.physicalcpu") { d["perfCores"] = "\(p)" }
    if let e = sysctlInt("hw.perflevel1.physicalcpu") { d["effCores"] = "\(e)" }
    if let dev = MTLCreateSystemDefaultDeviceName() { d["gpu"] = dev }
    return d
  }

  func run() throws -> BenchReport {
    var info = Bench.deviceInfo()
    log("データを読み込んでいます")
    try load()
    let t0 = ccnn_now()
    benchEngine()
    benchGPU()
    benchCoreML()
    benchCoreMLProgram()
    info["thermalEnd"] = Bench.thermal()
    info["totalSec"] = String(format: "%.1f", ccnn_now() - t0)
    info["quick"] = quick ? "1" : "0"
    progress(1)
    return BenchReport(info: info, results: results)
  }
}

import Metal
func MTLCreateSystemDefaultDeviceName() -> String? { MTLCreateSystemDefaultDevice()?.name }

extension BenchReport {
  func json() -> String {
    let enc = JSONEncoder()
    enc.outputFormatting = [.prettyPrinted, .sortedKeys]
    return String(data: try! enc.encode(self), encoding: .utf8)!
  }
}
