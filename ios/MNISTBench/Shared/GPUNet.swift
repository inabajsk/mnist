// GPUNet.swift : Metal Performance Shaders Graph (MPSGraph) で MLP と CNN を GPU で学習・推論する
//   cpucnn.cpp と同じ計算: NHWC, 畳み込みの重み (出力ch, 入力ch, ky, kx), 全結合の重み (出力, 入力),
//   softmax + 交差エントロピー (バッチの和), SGD (学習率 0.001), ReLU, 2x2 max pool
//   Mac (Intel Iris) と iPhone (Apple GPU) で同じコードが動く
import Foundation
import Metal
import MetalPerformanceShaders
import MetalPerformanceShadersGraph

final class GPUNet {
  let dev: MTLDevice
  let queue: MTLCommandQueue
  let graph = MPSGraph()
  let B: Int
  let cnn: Bool
  var x: MPSGraphTensor!, t: MPSGraphTensor!
  var vars = [MPSGraphTensor]()
  var prob: MPSGraphTensor!, loss: MPSGraphTensor!, correct: MPSGraphTensor!
  var updates = [MPSGraphOperation]()

  init?(cnn: Bool, batch: Int, params: [[Float]]) {
    guard let d = MTLCreateSystemDefaultDevice(), let q = d.makeCommandQueue() else { return nil }
    dev = d; queue = q; B = batch; self.cnn = cnn
    build(params)
  }

  private func variable(_ v: [Float], _ shape: [Int]) -> MPSGraphTensor {
    let data = v.withUnsafeBufferPointer { Data(buffer: $0) }
    let t = graph.variable(with: data, shape: shape.map { NSNumber(value: $0) }, dataType: .float32, name: nil)
    vars.append(t)
    return t
  }

  private func fc(_ h: MPSGraphTensor, _ W: MPSGraphTensor, _ b: MPSGraphTensor) -> MPSGraphTensor {
    graph.addition(graph.matrixMultiplication(primary: h, secondary: graph.transposeTensor(W, dimension: 0, withDimension: 1, name: nil), name: nil), b, name: nil)
  }

  private func build(_ P: [[Float]]) {
    x = graph.placeholder(shape: [B as NSNumber, 28, 28, 1], dataType: .float32, name: "x")
    t = graph.placeholder(shape: [B as NSNumber, 10], dataType: .float32, name: "t")
    var h: MPSGraphTensor
    var logits: MPSGraphTensor
    if cnn {
      let W1 = variable(P[0], [20, 1, 5, 5]), b1 = variable(P[1], [20])
      let W2 = variable(P[2], [50, 20, 5, 5]), b2 = variable(P[3], [50])
      let W3 = variable(P[4], [500, 800]), b3 = variable(P[5], [500])
      let W4 = variable(P[6], [10, 500]), b4 = variable(P[7], [10])
      let cd = MPSGraphConvolution2DOpDescriptor(strideInX: 1, strideInY: 1, dilationRateInX: 1, dilationRateInY: 1, groups: 1,
                                                 paddingStyle: .TF_VALID, dataLayout: .NHWC, weightsLayout: .OIHW)!
      let pd = MPSGraphPooling2DOpDescriptor(kernelWidth: 2, kernelHeight: 2, strideInX: 2, strideInY: 2, paddingStyle: .TF_VALID, dataLayout: .NHWC)!
      h = graph.addition(graph.convolution2D(x, weights: W1, descriptor: cd, name: nil), b1, name: nil)
      h = graph.maxPooling2D(withSourceTensor: graph.reLU(with: h, name: nil), descriptor: pd, name: nil)
      h = graph.addition(graph.convolution2D(h, weights: W2, descriptor: cd, name: nil), b2, name: nil)
      h = graph.maxPooling2D(withSourceTensor: graph.reLU(with: h, name: nil), descriptor: pd, name: nil)
      h = graph.reshape(h, shape: [B as NSNumber, 800], name: nil)   // NHWC の順で平らにする (cpucnn と同じ)
      h = graph.reLU(with: fc(h, W3, b3), name: nil)
      logits = fc(h, W4, b4)
    } else {
      let W1 = variable(P[0], [1000, 784]), b1 = variable(P[1], [1000])
      let W2 = variable(P[2], [1000, 1000]), b2 = variable(P[3], [1000])
      let W3 = variable(P[4], [10, 1000]), b3 = variable(P[5], [10])
      h = graph.reshape(x, shape: [B as NSNumber, 784], name: nil)
      h = graph.reLU(with: fc(h, W1, b1), name: nil)
      h = graph.reLU(with: fc(h, W2, b2), name: nil)
      logits = fc(h, W3, b3)
    }
    prob = graph.softMax(with: logits, axis: 1, name: nil)
    // 損失はバッチの和 (nn.l と同じ)
    loss = graph.softMaxCrossEntropy(logits, labels: t, axis: 1, reuctionType: .sum, name: nil)
    let am = graph.reductionArgMaximum(with: logits, axis: 1, name: nil)
    let al = graph.reductionArgMaximum(with: t, axis: 1, name: nil)
    correct = graph.reductionSum(with: graph.cast(graph.equal(am, al, name: nil), to: .float32, name: "c"), axes: [0, 1], name: nil)
    let grads = graph.gradients(of: loss, with: vars, name: nil)
    let lr = graph.constant(0.001, dataType: .float32)
    for v in vars {
      let nv = graph.subtraction(v, graph.multiplication(lr, grads[v]!, name: nil), name: nil)
      updates.append(graph.assign(v, tensor: nv, name: nil))
    }
  }

  /// 画像 (N×784, 0〜1) とラベルを B 枚ずつの GPU のデータにする (時間に含めない. CUDA 版で GPU に常駐させたのと同じ)
  func batches(_ X: [Float], _ Y: [UInt8], count n: Int) -> [(MPSGraphTensorData, MPSGraphTensorData)] {
    (0..<(n / B)).map { k in
      let xs = Array(X[(k * B * 784)..<((k + 1) * B * 784)])
      var ts = [Float](repeating: 0, count: B * 10)
      for i in 0..<B { ts[i * 10 + Int(Y[k * B + i])] = 1 }
      let xb = dev.makeBuffer(bytes: xs, length: xs.count * 4, options: .storageModeShared)!
      let tb = dev.makeBuffer(bytes: ts, length: ts.count * 4, options: .storageModeShared)!
      return (MPSGraphTensorData(xb, shape: [B as NSNumber, 28, 28, 1], dataType: .float32),
              MPSGraphTensorData(tb, shape: [B as NSNumber, 10], dataType: .float32))
    }
  }

  /// 1 エポック. 平均損失を返す. 最後に損失を読み出すまでを時間に含める
  func trainEpoch(_ data: [(MPSGraphTensorData, MPSGraphTensorData)]) -> Double {
    var sum = 0.0
    for (xd, td) in data {
      let r = graph.run(with: queue, feeds: [x: xd, t: td], targetTensors: [loss], targetOperations: updates)
      var v: Float = 0
      r[loss]!.mpsndarray().readBytes(&v, strideBytes: nil)
      sum += Double(v)
    }
    return sum / Double(data.count * B)
  }

  /// 推論. 正解数を返す
  func evaluate(_ data: [(MPSGraphTensorData, MPSGraphTensorData)]) -> Int {
    var ok = 0
    for (xd, td) in data {
      let r = graph.run(with: queue, feeds: [x: xd, t: td], targetTensors: [correct], targetOperations: nil)
      var v: Float = 0
      r[correct]!.mpsndarray().readBytes(&v, strideBytes: nil)
      ok += Int(v)
    }
    return ok
  }
}
