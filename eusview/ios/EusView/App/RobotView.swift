// RobotView.swift : ロボットの 3D 表示と操作 (関節・姿勢・動作・接続)
import SwiftUI
import SceneKit

struct SceneViewRep: UIViewRepresentable {
  let rs: RobotScene
  func makeUIView(context: Context) -> SCNView {
    let v = SCNView()
    v.scene = rs.scene
    v.allowsCameraControl = true
    v.antialiasingMode = .multisampling4X
    v.backgroundColor = UIColor.systemBackground
    let cam = SCNNode()
    cam.camera = SCNCamera()
    cam.camera!.zNear = 0.005
    let (c, r) = rs.bounds()
    cam.position = SCNVector3(c.x + r * 1.6, c.y + r * 0.9, c.z + r * 2.2)
    cam.look(at: c)
    rs.scene.rootNode.addChildNode(cam)
    v.pointOfView = cam
    v.defaultCameraController.target = c
    return v
  }
  func updateUIView(_ v: SCNView, context: Context) {}
}

@MainActor
final class RobotState: ObservableObject {
  let rs: RobotScene
  @Published var angles: [Float]
  @Published var playing: String?
  @Published var live = LiveLink()
  @Published var physics = false      // 物理モード (ODE)
  @Published var servoOn = true
  @Published var simInfo = ""
  private var timer: Timer?
  private var sim: PhysicsSim?
  private var simTimer: Timer?
  init(rs: RobotScene) {
    self.rs = rs
    angles = rs.angles
    if let p = rs.model.poses?["reset-pose"] { set(p) }
  }
  /// 関節角の指令. 物理モードではサーボの目標, そうでなければそのまま表示
  func set(_ a: [Float]) {
    angles = a
    if let sim { sim.setTargets(a) } else { rs.setAngles(a) }
  }

  /// 物理モードを始める (今の姿勢で床に置く) / やめる
  func setPhysics(_ on: Bool) {
    simTimer?.invalidate(); simTimer = nil; sim = nil
    physics = on
    if !on { rs.setAngles(angles); return }
    let s = PhysicsSim(model: rs.model, angles: angles)
    s.setServo(servoOn)
    sim = s
    rs.setWorldPoses(s.linkPoses())
    simTimer = Timer.scheduledTimer(withTimeInterval: 1 / 60, repeats: true) { [weak self] _ in
      Task { @MainActor in
        guard let self, let sim = self.sim else { return }
        let t0 = Date()
        sim.step(1 / 60)
        self.rs.setWorldPoses(sim.linkPoses())
        let ms = Date().timeIntervalSince(t0) * 1000
        self.simInfo = String(format: "%.1f 秒  接触 %d 点  計算 %.1f ms/コマ", sim.time, sim.contacts, ms)
      }
    }
  }
  func setServo(_ on: Bool) { servoOn = on; sim?.setServo(on) }
  /// 今の姿勢から目標の姿勢へ 0.6 秒で動かす
  func move(to target: [Float]) {
    stop()
    let from = angles, t0 = Date()
    timer = Timer.scheduledTimer(withTimeInterval: 1 / 60, repeats: true) { [weak self] t in
      Task { @MainActor in
        guard let self else { return }
        let s = Float(min(1, Date().timeIntervalSince(t0) / 0.6))
        let e = s * s * (3 - 2 * s)
        self.set(zip(from, target).map { $0 + ($1 - $0) * e })
        if s >= 1 { t.invalidate() }
      }
    }
  }
  func play(_ m: RobotMotion) {
    stop()
    playing = m.name
    var i = 0
    timer = Timer.scheduledTimer(withTimeInterval: Double(1 / max(m.fps, 1)), repeats: true) { [weak self] t in
      Task { @MainActor in
        guard let self else { return }
        if i >= m.frames.count { i = 0 }
        if self.sim != nil { self.set(m.frames[i]) }   // 物理モード: 動作の関節角をサーボの目標にする
        else { self.rs.setFrame(m, i); self.angles = self.rs.angles }
        i += 1
      }
    }
  }
  func stop() { timer?.invalidate(); timer = nil; playing = nil }
  func shutdown() { stop(); simTimer?.invalidate(); simTimer = nil; sim = nil }
}

struct RobotView: View {
  @StateObject var st: RobotState
  @State var tab = 0
  init(rs: RobotScene) { _st = StateObject(wrappedValue: RobotState(rs: rs)) }
  var model: RobotModel { st.rs.model }
  var body: some View {
    VStack(spacing: 0) {
      SceneViewRep(rs: st.rs).ignoresSafeArea(edges: .horizontal)
        .overlay(alignment: .topLeading) {
          if st.physics { Text(st.simInfo).font(.caption2.monospacedDigit()).padding(6).background(.thinMaterial, in: RoundedRectangle(cornerRadius: 6)).padding(8) }
        }
      HStack {
        Toggle("物理（ODE）", isOn: Binding(get: { st.physics }, set: { st.setPhysics($0) })).fixedSize()
        if st.physics {
          Toggle("サーボ", isOn: Binding(get: { st.servoOn }, set: { st.setServo($0) })).fixedSize()
          Button("置き直す") { st.setPhysics(true) }
        }
        Spacer()
      }.font(.footnote).padding(.horizontal, 12).padding(.top, 6)
      Picker("", selection: $tab) {
        Text("関節").tag(0); Text("姿勢").tag(1); Text("動作").tag(2); Text("接続").tag(3)
      }.pickerStyle(.segmented).padding(8)
      Group {
        switch tab {
        case 0: jointList
        case 1: poseList
        case 2: motionList
        default: LiveView(st: st)
        }
      }.frame(height: 260)
    }
    .navigationTitle(model.name)
    .navigationBarTitleDisplayMode(.inline)
    .onDisappear { st.shutdown(); st.live.disconnect() }
  }

  var jointList: some View {
    List(Array(model.joints.enumerated()), id: \.offset) { k, j in
      VStack(alignment: .leading, spacing: 2) {
        HStack {
          Text(j.name).font(.caption)
          Spacer()
          Text(String(format: j.type == "linear" ? "%.1f mm" : "%.1f°", st.angles[k])).font(.caption.monospacedDigit()).foregroundStyle(.secondary)
        }
        Slider(value: Binding(get: { st.angles[k] }, set: { v in var a = st.angles; a[k] = v; st.stop(); st.set(a) }),
               in: (j.min ?? -180)...max((j.max ?? 180), (j.min ?? -180) + 0.1))
      }
    }.listStyle(.plain)
  }

  var poseList: some View {
    List {
      ForEach((model.poses ?? [:]).keys.sorted(), id: \.self) { name in
        Button(name) { st.move(to: model.poses![name]!) }
      }
      Button("すべて 0") { st.move(to: [Float](repeating: 0, count: model.joints.count)) }
    }.listStyle(.plain)
  }

  var motionList: some View {
    List {
      if (model.motions ?? []).isEmpty { Text("このロボットには動作が入っていません").foregroundStyle(.secondary) }
      ForEach(model.motions ?? [], id: \.name) { m in
        Button { st.playing == m.name ? st.stop() : st.play(m) } label: {
          Label("\(m.name)（\(m.frames.count) コマ）", systemImage: st.playing == m.name ? "stop.fill" : "play.fill")
        }
      }
    }.listStyle(.plain)
  }
}
