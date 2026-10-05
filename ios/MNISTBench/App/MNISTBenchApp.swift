// iPhone 用の計測アプリ. 起動引数 -autorun があれば起動してすぐ計測し (-quick で短め), 結果の JSON を
// 標準出力 (xcrun devicectl ... --console で見える) と Documents/result.json に書く
import SwiftUI
import UIKit

@main
struct MNISTBenchApp: App {
  var body: some Scene { WindowGroup { ContentView() } }
}

@MainActor
final class Runner: ObservableObject {
  @Published var lines: [String] = []
  @Published var prog = 0.0
  @Published var running = false
  @Published var json = ""
  @Published var quick = false

  func start() {
    guard !running else { return }
    running = true; lines = []; json = ""; prog = 0
    UIApplication.shared.isIdleTimerDisabled = true  // 計測中は画面を消さない
    let quick = self.quick
    Thread.detachNewThread {
      let b = Bench(resources: Bundle.main.resourceURL!)
      b.quick = quick
      b.log = { s in print(s); DispatchQueue.main.async { self.lines.append(s) } }
      b.progress = { p in DispatchQueue.main.async { self.prog = p } }
      let js: String
      do { js = try b.run().json() } catch { js = "{\"error\": \"\(error)\"}" }
      print("=====RESULT-JSON-BEGIN=====\n\(js)\n=====RESULT-JSON-END=====")
      let doc = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0]
      try? js.write(to: doc.appendingPathComponent("result.json"), atomically: true, encoding: .utf8)
      DispatchQueue.main.async {
        self.json = js; self.running = false
        if ProcessInfo.processInfo.arguments.contains("-exit") { exit(0) }  // devicectl から動かしたとき
        UIApplication.shared.isIdleTimerDisabled = false
      }
    }
  }
}

struct ContentView: View {
  @StateObject var r = Runner()
  @State var copied = false
  var body: some View {
    NavigationStack {
      List {
        Section {
          Text("EusLisp で学習した MNIST の MLP（784-1000-1000-10）と CNN を、C++ + Accelerate と Core ML（CPU / GPU / Neural Engine）で動かして時間を測ります。標準で 3〜5 分かかります。")
            .font(.footnote).foregroundStyle(.secondary)
          Toggle("短め（確認用）", isOn: $r.quick).disabled(r.running)
          Button(r.running ? "計測中…" : "計測を始める") { r.start() }.disabled(r.running)
          if r.running || r.prog > 0 { ProgressView(value: r.prog) }
        }
        if !r.json.isEmpty {
          Section {
            Button(copied ? "コピーしました" : "結果（JSON）をコピー") { UIPasteboard.general.string = r.json; copied = true }
            ShareLink(item: r.json) { Label("共有", systemImage: "square.and.arrow.up") }
          }
        }
        Section("経過") {
          ForEach(Array(r.lines.enumerated()), id: \.offset) { _, s in Text(s).font(.system(.caption, design: .monospaced)) }
        }
      }
      .navigationTitle("MNIST 計測")
    }
    .onAppear {
      let a = ProcessInfo.processInfo.arguments
      if a.contains("-quick") { r.quick = true }
      if a.contains("-autorun") { r.start() }
    }
  }
}
