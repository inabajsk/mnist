// Mac のコマンドライン版: iPhone アプリと同じ Bench.swift と cpucnn.cpp を動かす
//   make -C ios mac && ios/build/mac/mnistbench [--quick] [--out 結果.json]
import Foundation

var args = CommandLine.arguments.dropFirst()
let quick = args.contains("--quick")
var out: String? = nil
if let i = args.firstIndex(of: "--out"), args.index(after: i) < args.endIndex { out = args[args.index(after: i)] }
let exe = URL(fileURLWithPath: CommandLine.arguments[0]).resolvingSymlinksInPath().deletingLastPathComponent()
let b = Bench(resources: exe.appendingPathComponent("Resources"))
b.quick = quick
setvbuf(stdout, nil, _IOLBF, 0)
let rep = try b.run()
let js = rep.json()
if let o = out { try js.write(toFile: o, atomically: true, encoding: .utf8); print("wrote", o) } else { print(js) }
