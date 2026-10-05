// MNIST × EusLisp: Mac と iPhone の計算スピード比較スライド生成
const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");
const { applyTheme } = require(process.env.SKILL_DIR + "/scripts/apply_theme.js");

const W = __dirname;
const OUT = process.argv[2] || path.join(W, "mnist_mac_iphone.pptx");
const fig = (f) => path.join(W, "fig", f);

const THEME = {
  name: "MNIST Ink",
  headFontFace: "BIZ UDPGothic",
  bodyFontFace: "BIZ UDPGothic",
  colors: {
    dk1: "14213D", lt1: "FFFFFF", dk2: "2B3A55", lt2: "EEF1F6",
    accent1: "E4572E", accent2: "3A6EA5", accent3: "F2A541",
    accent4: "5B8C5A", accent5: "8E7DBE", accent6: "5B6577",
    hlink: "3A6EA5", folHlink: "8E7DBE",
  },
};
const HEX = THEME.colors;
const MONO = "BIZ UDGothic";

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = "MNIST を Mac と iPhone で — 計算スピードの比較";
pres.author = "Masayuki Inaba";
pres.subject = "MNIST MLP and CNN on Mac and iPhone: C++ + Accelerate, Core ML, EusLisp";
const C = pres.SchemeColor;

// ---------- layouts ----------
const FOOT = "MNIST × EusLisp — Mac と iPhone での計測";
pres.defineSlideMaster({
  title: "TITLE_DARK",
  background: { color: C.text1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.1, w: 11.7, h: 1.6, fontSize: 34, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 3.9, w: 11.7, h: 1.6, fontSize: 18, color: "CADCFC", valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "SECTION",
  background: { color: C.text1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 2.6, y: 2.75, w: 10.0, h: 1.0, fontSize: 36, bold: true, color: C.background1, valign: "bottom", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 2.6, y: 3.9, w: 10.0, h: 1.2, fontSize: 16, color: "CADCFC", valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 12.3, y: 7.0, w: 0.6, h: 0.3, fontSize: 9, color: "8090B0", align: "right" },
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.6, y: 0.3, w: 12.1, h: 0.8, fontSize: 28, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "" } },
    { text: { text: FOOT, options: { x: 0.6, y: 7.02, w: 8, h: 0.3, fontSize: 9, color: C.accent6, margin: 0 } } },
  ],
  slideNumber: { x: 12.1, y: 7.02, w: 0.6, h: 0.3, fontSize: 9, color: C.accent6, align: "right" },
});
pres.defineSlideMaster({
  title: "SHEET",
  background: { color: "0B0F1A" },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.4, y: 0.12, w: 12.5, h: 0.5, fontSize: 18, bold: true, color: C.background1, valign: "middle", align: "left", margin: 0 }, text: "" } },
  ],
  slideNumber: { x: 12.3, y: 7.1, w: 0.6, h: 0.3, fontSize: 9, color: "8090B0", align: "right" },
});

// ---------- helpers ----------
let curSection = null;
function section(title) { pres.addSection({ title }); curSection = title; }
function slide(master, title, notes) {
  const s = pres.addSlide({ masterName: master, sectionTitle: curSection });
  if (title) s.addText(title, { placeholder: "title" });
  if (notes) s.addNotes(notes);
  return s;
}
let objN = 0;
const nm = (p) => `${p}-${++objN}`;
function card(s, x, y, w, h, fill) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill || C.background2 }, line: { type: "none" }, objectName: nm("card") });
}
// motif: 「画素タイル」— 角丸の小正方形に番号/記号
function tile(s, x, y, label, fill, size) {
  const z = size || 0.42;
  s.addText(label, { x, y, w: z, h: z, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, fill: { color: fill || C.text1 }, color: C.background1, fontSize: z > 0.6 ? 28 : 13, bold: true, align: "center", valign: "middle", margin: 0, isTextBox: true, objectName: nm("tile") });
}
function head(s, x, y, w, label, text, fill) {
  tile(s, x, y, label, fill);
  s.addText(text, { x: x + 0.55, y, w: w - 0.55, h: 0.42, fontSize: 17, bold: true, color: C.text1, valign: "middle", margin: 0, isTextBox: true, objectName: nm("head") });
}
function bullets(s, items, x, y, w, h, fs) {
  const arr = items.map((t, i) => {
    const o = { bullet: true, breakLine: i < items.length - 1, paraSpaceAfter: 5 };
    if (Array.isArray(t)) return { text: t[0], options: Object.assign(o, { bullet: { indent: 18 }, indentLevel: 1, fontSize: (fs || 14) - 1, color: C.accent6 }) };
    return { text: t, options: o };
  });
  s.addText(arr, { x, y, w, h, fontSize: fs || 14, color: C.text1, valign: "top", margin: 0, isTextBox: true, objectName: nm("bullets") });
}
function para(s, text, x, y, w, h, opts) {
  s.addText(text, Object.assign({ x, y, w, h, fontSize: 14, color: C.text1, valign: "top", margin: 0, isTextBox: true, objectName: nm("text") }, opts || {}));
}
function code(s, text, x, y, w, h, fs) {
  s.addText(text, { x, y, w, h, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, fill: { color: "1B2433" }, color: "E8ECF3", fontFace: MONO, fontSize: fs || 11, valign: "top", margin: 0.15, isTextBox: true, objectName: nm("code") });
}
function stat(s, x, y, w, big, small, color) {
  s.addText(big, { x, y, w, h: 0.9, fontSize: 40, bold: true, color: color || C.accent1, margin: 0, valign: "bottom", isTextBox: true, objectName: nm("stat") });
  s.addText(small, { x, y: y + 0.95, w, h: 0.6, fontSize: 12, color: C.accent6, margin: 0, valign: "top", isTextBox: true, objectName: nm("statlbl") });
}
function table(s, rows, x, y, w, colW, fs, opt) {
  const hdr = rows[0].map((t) => ({ text: t, options: { bold: true, color: HEX.lt1, fill: { color: HEX.dk1 } } }));
  const body = rows.slice(1).map((r, i) => r.map((t) => {
    if (t && typeof t === "object") return t;
    return { text: String(t), options: { fill: { color: i % 2 ? HEX.lt1 : HEX.lt2 } } };
  }));
  s.addTable([hdr, ...body], Object.assign({ x, y, w, colW, fontSize: fs || 12, color: HEX.dk1, border: { type: "solid", pt: 0.5, color: "D5DAE3" }, margin: [3, 6, 3, 6], valign: "middle", objectName: nm("table") }, opt || {}));
}
const hl = (t) => ({ text: String(t), options: { bold: true, color: HEX.accent1, fill: { color: "FDECE7" } } });
const chartBase = () => ({
  catAxisLabelColor: HEX.accent6, valAxisLabelColor: HEX.accent6, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
  catAxisLabelFontSize: 11, valAxisLabelFontSize: 11, valGridLine: { color: "E2E6EE", size: 0.5 }, catGridLine: { style: "none" },
  titleFontFace: "+mn-lt", legendFontFace: "+mn-lt", dataLabelFontFace: "+mn-lt", titleColor: HEX.dk1, titleFontSize: 13,
});
const fmt = (x, d) => Number(x).toFixed(d);
const pct = (x, d) => (x * 100).toFixed(d === undefined ? 2 : d) + "%";


// ---- Mac と iPhone のスライド本体 ----
const D = JSON.parse(fs.readFileSync(path.join(W, "macios.json")));
const f1 = (v, d) => Number(v).toFixed(d === undefined ? 1 : d);
const fmtS = (s) => (s == null ? "—" : s >= 100 ? f1(s, 0) + " 秒" : s >= 10 ? f1(s, 1) + " 秒" : s >= 1 ? f1(s, 2) + " 秒" : f1(s * 1000, s < 0.01 ? 2 : 1) + " ms");
const fmtMs = (ms) => (ms == null ? "—" : ms >= 100 ? f1(ms, 0) + " ms" : ms >= 1 ? f1(ms, 2) + " ms" : ms >= 0.01 ? f1(ms * 1000, 0) + " µs" : f1(ms * 1000, 1) + " µs");
const G = D.dgx, mac = D.devices.mac, iph = D.devices.iphone || null;
const IPN = iph ? iph.info.name || iph.info.machine : "iPhone";
const MACN = "MacBook Pro（2019, Intel）";
const ep = (dev, m, k) => (dev ? dev.epoch[`${m}|${k}`] : null);
const inf = (dev, m, k) => (dev ? dev.infer[`${m}|${k}`] || null : null);
const F32 = "C++ + Accelerate FP32", F64 = "C++ + Accelerate FP64", F1 = "C++ + Accelerate FP32（1 スレッド）";
const NV = "C++ 素朴なループ FP32（1 スレッド, SIMD なし）", GP = "GPU（Metal MPSGraph）FP32";
const CML = ["Core ML CPU", "Core ML CPU+GPU", "Core ML CPU+Neural Engine", "Core ML すべて"];
const CMLS = { "Core ML CPU": "CPU のみ", "Core ML CPU+GPU": "CPU + GPU", "Core ML CPU+Neural Engine": "CPU + Neural Engine", "Core ML すべて": "すべて（.all）" };
const pend = "（iPhone は未計測）";
const ratio = (a, b) => (a == null || b == null ? "—" : a / b >= 10 ? `×${f1(a / b, 0)}` : `×${f1(a / b, 1)}`);
// Core ML で最も速い計算装置（まとめて処理）
const bestCML = (dev, k, key) => {
  if (!dev) return null;
  return CML.map((m) => [m, inf(dev, m, k)]).filter(([, r]) => r && r[key] != null).sort((a, b) => a[1][key] - b[1][key])[0] || null;
};

// =====================================================================
section("タイトル");
{
  const s = slide("TITLE_DARK", "MNIST を Mac と iPhone で\n計算スピードの比較実験");
  s.addText([
    { text: "EusLisp で作った MNIST の MLP と CNN を、同じ C++ + Accelerate のコードと Core ML で Mac と iPhone の上で動かし、学習と推論の時間を DGX Spark と比べた", options: { breakLine: true } },
    { text: `計測した機器: ${MACN} ／ ${iph ? IPN : "iPhone（計測待ち）"} ／ 比較: DGX Spark（GB10）`, options: { fontSize: 13, color: "8FA3C8" } },
  ], { placeholder: "body" });
  s.addText("2026-10-04", { x: 0.8, y: 6.6, w: 4, h: 0.4, fontSize: 12, color: "8FA3C8", margin: 0, isTextBox: true });
}
{
  const s = slide("CONTENT", "概要", "時間は 60,000 枚あたりに換算（学習は 1 エポック, バッチ 200）。C++ + Accelerate は 6,000 枚 × 2 エポックを測り、速い方から換算。");
  const st = [
    [fmtS(D.eus_mac.best_wall), `Mac: 元の EusLisp（nn.l）\nMLP 1 エポック（DGX ${fmtS(G.eus)}）`, C.text1],
    [fmtS(ep(mac, F32, "CNN")), `Mac: C++ + Accelerate\nCNN 1 エポック（DGX CPU ${fmtS(G.cpu32_cnn)}）`, C.accent2],
    [iph ? fmtS(ep(iph, F32, "CNN")) : "—", iph ? `${IPN}: C++ + Accelerate\nCNN 1 エポック` : "iPhone: CNN 1 エポック\n（計測待ち）", C.accent1],
    [iph ? fmtMs(inf(iph, "Core ML FP16 CPU+Neural Engine", "CNN").batch_ms) : "—", iph ? `${IPN}: Neural Engine\nCNN 推論 1 枚（Core ML）` : "iPhone: Core ML 推論\n（計測待ち）", C.accent4],
  ];
  const xs = [0.6, 3.7, 6.8, 9.9];
  st.forEach(([b, l, c], i) => {
    card(s, xs[i], 1.45, 2.85, 2.2);
    s.addText(b, { x: xs[i] + 0.2, y: 1.6, w: 2.5, h: 0.95, fontSize: 34, bold: true, color: c, valign: "bottom", margin: 0, isTextBox: true, fit: "shrink", objectName: nm("stat") });
    s.addText(l, { x: xs[i] + 0.2, y: 2.65, w: 2.5, h: 0.9, fontSize: 12, color: C.accent6, valign: "top", margin: 0, isTextBox: true, objectName: nm("statlbl") });
  });
  head(s, 0.6, 3.95, 6, "1", "実験の方法 — 同じコードを Mac と iPhone で", C.text1);
  head(s, 0.6, 4.45, 6, "2", "元の EusLisp（nn.l）を Mac で動かす", C.accent3);
  head(s, 0.6, 4.95, 6, "3", "学習の時間（1 エポック）", C.accent2);
  head(s, 6.9, 3.95, 6, "4", "ハードウェアを使う・使わない", C.accent1);
  head(s, 6.9, 4.45, 6, "5", "推論の時間と Core ML の計算装置", C.accent4);
  para(s, D.summary || "", 0.6, 5.6, 12.1, 1.25, { fontSize: 13, color: C.accent6, italic: true });
}

// =====================================================================
section("1. 実験の方法");
{
  const s = slide("SECTION", "実験の方法");
  s.addText("同じ C++ + Accelerate のコードと Core ML のモデルを、Mac（コマンドライン）と iPhone（アプリ）で動かす", { placeholder: "body" });
  tile(s, 0.9, 2.75, "1", C.text1, 1.2);
}
{
  const s = slide("CONTENT", "比べた 3 つの機器", "DGX Spark の値は前回の計測（docs/mnist_cnn.pptx, mnist_euslisp.pptx）。Mac と iPhone は今回の計測。");
  const ii = iph ? iph.info : null;
  table(s, [["", "DGX Spark", MACN, iph ? IPN : "iPhone"],
    ["CPU", "ARM 20 コア（Cortex-X925 ×10 + A725 ×10）", `${mac.info.cpu.replace("(R)", "").replace("(TM)", "").replace(" CPU", "")}（4 コア 8 スレッド）`, ii ? `Apple ${ii.chip}（${ii.perfCores} 高性能 + ${ii.effCores} 高効率コア）` : "—"],
    ["GPU", "NVIDIA GB10（CUDA）", mac.info.gpu.replace("(R)", "").replace("(TM)", ""), ii ? `${ii.gpu}（6 コア）` : "—"],
    ["NPU", "なし", "なし（Intel Mac には Neural Engine がない）", ii ? "Apple Neural Engine（16 コア）" : "—"],
    ["メモリ", "128 GB（統合メモリ）", `${f1(mac.info.memoryGB, 0)} GB`, ii ? `${f1(ii.memoryGB, 1)} GB（統合メモリ）` : "—"],
    ["OS", "Ubuntu 24.04", mac.info.os.replace("Version ", "macOS ").replace(/ \(Build.*\)/, ""), ii ? ii.os.replace("Version ", "iOS ").replace(/ \(Build.*\)/, "") : "—"],
    ["行列計算", "OpenBLAS（CPU）/ cuBLAS（GPU）", "Accelerate（CPU）/ Core ML", "Accelerate（CPU）/ Core ML"],
    ["動かしたもの", "EusLisp nn.l, C++ + OpenBLAS, CUDA", "EusLisp nn.l, C++ + Accelerate, Core ML", "C++ + Accelerate, Core ML（EusLisp は動かない）"]],
    0.6, 1.4, 12.1, [1.6, 3.4, 3.7, 3.4], 12, { rowH: 0.56 });
  para(s, "iPhone では EusLisp は動かせない（アプリの中で別のプログラムを起動できない）。そこで nn.l と同じ計算をする C++ のエンジンを作り、Mac と iPhone の両方で同じものを動かした。", 0.6, 6.15, 12.1, 0.7, { fontSize: 13, color: C.accent2 });
}
{
  const s = slide("CONTENT", "同じコードを Mac と iPhone で動かすしくみ", "データと重みはブラウザの計測ページ（phone/site）と同じファイル。Core ML のモデルは ios/models の .mlmodel（EusLisp で学習した重み）。");
  // 流れの図: 入力 → 共通のコード → 2 つの実行形 → 結果
  const box = (x, y, w, h, t, sub, fill, tc) => {
    s.addText([{ text: t, options: { bold: true, fontSize: 14, breakLine: true } }, { text: sub, options: { fontSize: 11 } }],
      { x, y, w, h, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, fill: { color: fill }, color: tc || C.text1, valign: "middle", margin: 0.12, isTextBox: true, objectName: nm("box") });
  };
  const arrow = (x1, y1, x2, y2) => s.addShape(pres.shapes.LINE, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, flipV: y2 < y1, line: { color: HEX.accent6, width: 1.5, endArrowType: "triangle" }, objectName: nm("arrow") });
  box(0.6, 1.45, 2.9, 1.2, "データ・重み", "テスト 10,000 枚, 学習 6,000 枚\nMLP・CNN の重み（gzip + Base64）", C.background2);
  box(0.6, 2.95, 2.9, 1.2, "Core ML モデル", "旧形式 MNIST{MLP,CNN}.mlmodel\n新形式 MNIST{MLP,CNN}_P{1,100}\n.mlpackage（FP16）", C.background2);
  box(4.2, 1.45, 4.0, 2.7, "共通のコード", "Bench.swift: 計測の手順・結果の JSON\ncpucnn.cpp: cudacnn.cu の CPU 経路を Accelerate + GCD に移植（素朴なループも）\nGPUNet.swift: MPSGraph で GPU の学習・推論\n\nMLP と CNN の学習と推論、Core ML 4 通り × 2 形式", C.text1, C.background1);
  box(8.9, 1.45, 3.8, 1.2, "Mac: コマンドライン", "make -C ios mac\nios/build/mac/mnistbench", C.accent2, C.background1);
  box(8.9, 2.95, 3.8, 1.2, "iPhone: アプリ", "ios/MNISTBench.xcodeproj（SwiftUI）\nUSB でつないでビルド・実行", C.accent1, C.background1);
  arrow(3.5, 2.05, 4.2, 2.45); arrow(3.5, 3.55, 4.2, 3.15); arrow(8.2, 2.5, 8.9, 2.05); arrow(8.2, 3.1, 8.9, 3.55);
  bullets(s, [
    "学習: nn.l と同じ。SGD, 学習率 0.001, 勾配はバッチ和, バッチ 200, 初期値 U(−0.08, 0.08)。6,000 枚 × 2 エポックを測り、速い方を 60,000 枚に換算",
    "推論: EusLisp で学習した重み（MLP: mnist-mlp-19.l, CNN: 20 エポック後）でテスト 10,000 枚。認識数で正しさを確かめる",
    "ハードウェアを使う・使わない: 行列積を素朴なループ（1 スレッド, SIMD なし）→ Accelerate（SIMD・行列ユニット）1 スレッド → 全コア → GPU（Metal MPSGraph）→ Neural Engine（Core ML）",
    "Core ML: 旧形式（NeuralNetwork, FP32）と新形式（ML Program, FP16, 100 枚ずつ）で、computeUnits を 4 通りに切り替えて推論を測る",
    "結果は JSON（Mac はファイル、iPhone は USB 経由の標準出力）。phone/native/*.json に置き、mkmacios.py で集計",
  ], 0.6, 4.45, 12.1, 2.4, 13);
}
{
  const s = slide("CONTENT", "DGX の CUDA 版から Mac・iPhone 版への置き換え", "OpenMP は Apple の clang にないので GCD（Grand Central Dispatch）の dispatch_apply で同じ並列ループを作った。行列積は Accelerate の cblas。");
  code(s, [
    "// cudacnn.cu（DGX）: CPU は OpenMP + OpenBLAS",
    "#pragma omp parallel for schedule(static)",
    "for (long i = 0; i < n; i++) f(i);",
    "cblas_sgemm(101, ta?112:111, tb?112:111, m, n, k, ...);",
    "",
    "// cpucnn.cpp（Mac・iPhone）: GCD + Accelerate",
    "dispatch_apply(nchunk, DISPATCH_APPLY_AUTO, ^(size_t c) {",
    "  for (long i = c*step; i < min(n, (c+1)*step); i++) f(i);",
    "});",
    "cblas_sgemm(CblasRowMajor, ..., m, n, k, ...);",
    "BLASSetThreading(BLAS_THREADING_SINGLE_THREADED); // 1 スレッドの計測",
  ].join("\n"), 0.6, 1.4, 6.6, 3.3, 12);
  code(s, [
    "// Core ML: 計算装置を選んで読み込む（Bench.swift）",
    "let cfg = MLModelConfiguration()",
    "cfg.computeUnits = .cpuOnly        // CPU のみ",
    "//               .cpuAndGPU       // CPU + GPU",
    "//               .cpuAndNeuralEngine",
    "//               .all             // 自動で選ぶ",
    "let m = try MLModel(contentsOf: url,",
    "                    configuration: cfg)",
    "// まとめて",
    "m.predictions(from: MLArrayBatchProvider(...))",
    "// 1 枚ずつ",
    "m.prediction(from: input)",
  ].join("\n"), 7.4, 1.4, 5.3, 3.3, 12);
  bullets(s, [
    "層の並べ方・im2col・逆伝播の式は cudacnn.cu の CPU 経路と同じ。MLP も同じエンジンで（全結合 + ReLU の並び）動かす",
    `確認: Mac の C++ で認識数 MLP ${Math.round(inf(mac, F32, "MLP").acc * 10000)}・CNN ${Math.round(inf(mac, F32, "CNN").acc * 10000)}、Core ML でも同じ（EusLisp・PyTorch・ONNX と一致）`,
  ], 0.6, 5.0, 12.1, 1.3, 14);
}
{
  const s = slide("CONTENT", "元の EusLisp（nn.l）を Mac で動かす", "eus は Homebrew の jskeus 1.2.1。起動直後に 3〜5 割の確率で落ちる（Bus error）ので、出力を見てやり直した。irteusgl は libjpeg がなく使えず、描画なしの eus で動かした。");
  head(s, 0.6, 1.4, 5.9, "A", "変更（Linux の動作は変えていない）", C.accent3);
  bullets(s, [
    "cblaslib.l: macOS なら Accelerate の BLAS を読む（load-foreign で直接開けないので、Accelerate をリンクしただけの小さなライブラリ libaccelblas.so を経由）",
    "nn.l: MATPROD/Darwin/libmatprod を読む。描画（mnist-draw.l）は使えるときだけ",
    "MATPROD/Makefile.Darwin: Homebrew の jskeus の defun の引数の違いを吸収してビルド",
  ], 0.6, 1.95, 5.9, 3.2, 13);
  const E = D.eus_mac.runs.filter((e) => e.log.startsWith("mac_eus_epoch2"));
  table(s, [["計測", "実時間", "CPU 時間", "CPU / 実時間"],
    ...E.map((e, i) => [`${Math.floor(i / 2) + 1} 回目・${e.epoch} エポック目`, fmtS(e.wall), fmtS(e.cpu), f1(e.cpu / e.wall, 2)]),
    ["1 スレッドに制限", fmtS(D.eus_mac.one_thread), fmtS(D.eus_mac.one_thread), "1.00"],
    [{ text: "DGX Spark（OpenBLAS）", options: { bold: true, fill: { color: "FDECE7" } } }, hl(fmtS(G.eus)), "—", "—"]],
    6.8, 1.4, 5.9, [2.5, 1.1, 1.1, 1.2], 12, { rowH: 0.4 });
  bullets(s, [
    `1 エポック（60,000 枚, バッチ 200）は ${fmtS(D.eus_mac.best_wall)}〜${fmtS(D.eus_mac.max_wall)}。DGX Spark の ${fmtS(G.eus)} とほぼ同じ`,
    "CPU 時間は実時間の 1.5 倍ほど。行列積は複数のコアで動くが、nn.l は行列積以外（バッチ作成・配列の確保など）が多い",
    `学習済みの mnist-mlp-19.l でテスト 10,000 枚中 ${D.eus_mac.test_correct} 枚正解（DGX と同じ）`,
  ], 6.8, 4.5, 5.9, 2.4, 13);
}

// =====================================================================
section("2. 学習の時間");
{
  const s = slide("SECTION", "学習の時間");
  s.addText("1 エポック（60,000 枚, バッチ 200）の時間を、DGX Spark・Mac・iPhone で比べる", { placeholder: "body" });
  tile(s, 0.9, 2.75, "2", C.accent2, 1.2);
}
const EROWS = [
  ["DGX: EusLisp nn.l", G.eus, null],
  ["Mac: EusLisp nn.l", D.eus_mac.best_wall, null],
  ["DGX: C++ + OpenBLAS FP32", G.cpu32, G.cpu32_cnn],
  ["Mac: C++ + Accelerate FP32", ep(mac, F32, "MLP"), ep(mac, F32, "CNN")],
  ...(iph ? [[`iPhone: C++ + Accelerate FP32`, ep(iph, F32, "MLP"), ep(iph, F32, "CNN")]] : []),
  ["Mac: GPU（MPSGraph）", ep(mac, GP, "MLP"), ep(mac, GP, "CNN")],
  ...(iph ? [[`iPhone: GPU（MPSGraph）`, ep(iph, GP, "MLP"), ep(iph, GP, "CNN")]] : []),
  ["DGX: CUDA GPU FP32", G.gpu32, G.gpu32_cnn],
];
{
  const s = slide("CONTENT", "1 エポックの学習時間 — 3 つの機器の比較", "60,000 枚・バッチ 200 の 1 エポック。対数目盛。EusLisp の nn.l は MLP だけ。CUDA は DGX Spark の GPU。");
  s.addChart(pres.charts.BAR, [
    { name: "MLP", labels: EROWS.map((r) => r[0]), values: EROWS.map((r) => (r[1] == null ? null : +r[1].toFixed(3))) },
    { name: "CNN", labels: EROWS.map((r) => r[0]), values: EROWS.map((r) => (r[2] == null ? null : +r[2].toFixed(3))) },
  ], Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 8.0, h: 5.6, barDir: "bar", catAxisOrientation: "maxMin", chartColors: [HEX.accent6, HEX.accent2],
    valAxisLogScaleBase: 10, valAxisMinVal: 0.01, valAxisMaxVal: 1000, showLegend: true, legendPos: "t", legendFontSize: 11,
    showValue: true, dataLabelFormatCode: "0.0#", dataLabelFontSize: 9, dataLabelColor: HEX.dk1, dataLabelPosition: "outEnd",
    showTitle: true, title: "1 エポック [秒]（対数, 短いほど速い）", catAxisLabelFontSize: 10.5, objectName: "epoch-chart",
  }));
  bullets(s, D.epoch_notes || [], 8.8, 1.4, 3.95, 5.4, 13);
}
{
  const s = slide("CONTENT", "学習時間の表 — 精度とスレッドの違い", "C++ のエンジンは同じコード。DGX は OpenMP 10 + OpenBLAS 10 スレッド、Mac・iPhone は GCD + Accelerate（スレッド数は Accelerate が決める）。");
  const row = (label, a, b, c, d) => [label, fmtS(a), fmtS(b), fmtS(c), fmtS(d)];
  table(s, [["機器・方法", "MLP FP32", "MLP FP64", "CNN FP32", "CNN FP64"],
    row("DGX Spark: C++ + OpenBLAS", G.cpu32, G.cpu64, G.cpu32_cnn, G.cpu64_cnn),
    row(`Mac: C++ + Accelerate`, ep(mac, F32, "MLP"), ep(mac, F64, "MLP"), ep(mac, F32, "CNN"), ep(mac, F64, "CNN")),
    iph ? row(`iPhone: C++ + Accelerate`, ep(iph, F32, "MLP"), ep(iph, F64, "MLP"), ep(iph, F32, "CNN"), ep(iph, F64, "CNN")) : ["iPhone: C++ + Accelerate", pend, "", "", ""],
    [`Mac: GPU（MPSGraph）`, fmtS(ep(mac, GP, "MLP")), "—", fmtS(ep(mac, GP, "CNN")), "—"],
    iph ? [`iPhone: GPU（MPSGraph）`, fmtS(ep(iph, GP, "MLP")), "—", fmtS(ep(iph, GP, "CNN")), "—"] : ["iPhone: GPU（MPSGraph）", pend, "", "", ""],
    ["DGX Spark: CUDA（GPU）", fmtS(G.gpu32), fmtS(G.gpu64), fmtS(G.gpu32_cnn), fmtS(G.gpu64_cnn)]],
    0.6, 1.4, 12.1, [4.1, 2.0, 2.0, 2.0, 2.0], 13, { rowH: 0.48 });
  bullets(s, D.train_notes || [], 0.6, 5.1, 12.1, 1.8, 13);
}

// =====================================================================
section("3. ハードウェアを使う・使わない");
{
  const s = slide("SECTION", "ハードウェアを使う・使わない");
  s.addText("CPU の積和命令（SIMD）・行列ユニット・複数コア・GPU・Neural Engine を、使う場合と使わない場合で比べる", { placeholder: "body" });
  tile(s, 0.9, 2.75, "3", C.accent1, 1.2);
}
{
  const s = slide("CONTENT", "Mac と iPhone の計算用ハードウェア", "Mac の CPU の命令は sysctl machdep.cpu で確認。iPhone のコア数・GPU 名は計測アプリで取得。行列ユニットと Neural Engine の性能は Apple の公開資料による（公称）。");
  const ii = iph ? iph.info : null;
  table(s, [["ハードウェア", MACN, iph ? IPN : "iPhone", "使う方法（今回）", "使わない比較"],
    ["CPU の SIMD 積和", "AVX2 + FMA（FP32 を 8 個ずつ積和）", "NEON（FP32 を 4 個ずつ積和, 128 bit）", "Accelerate の cblas", "素朴なループ（SIMD を止める）"],
    ["行列演算ユニット", "なし", "あり（Accelerate から使われる。公開の命令では直接使えない）", "Accelerate の cblas", "素朴なループ"],
    ["複数コア", "4 コア 8 スレッド", ii ? `${ii.perfCores} 高性能 + ${ii.effCores} 高効率コア` : "高性能 + 高効率コア", "GCD + Accelerate", "1 スレッド"],
    ["GPU", "Intel Iris Plus 655（内蔵）", ii ? ii.gpu || "Apple GPU" : "Apple GPU", "Metal MPSGraph（学習・推論）, Core ML", "CPU だけで動かす"],
    ["NN 専用（NPU）", "なし", "Neural Engine（16 コア）", "Core ML（推論のみ）", "Core ML の CPU のみ"]],
    0.6, 1.4, 12.1, [2.0, 2.7, 2.9, 2.5, 2.0], 12, { rowH: 0.62 });
  bullets(s, [
    "Intel Mac には Neural Engine がない。Core ML で CPU + Neural Engine を選んでも CPU で動く（時間も CPU のみと同じ）",
    "Neural Engine は推論専用で、学習には使えない。学習で使えるのは CPU（Accelerate）と GPU（MPSGraph）",
  ], 0.6, 5.5, 12.1, 1.3, 13);
}
const HW_TRAIN = [["素朴なループ\n1 スレッド", NV], ["Accelerate\n1 スレッド", F1], ["Accelerate\n全コア", F32], ["GPU\nMPSGraph", GP]];
{
  const s = slide("CONTENT", "学習: ハードウェアを使うほど速くなるか（CNN）", "CNN 1 エポック（60,000 枚）の換算時間。素朴なループは 1,000 枚、ほかは 6,000 枚から換算。対数目盛。");
  const ser = [{ name: "Mac", labels: HW_TRAIN.map((r) => r[0]), values: HW_TRAIN.map(([, m]) => +(ep(mac, m, "CNN") || 0).toFixed(2)) }];
  if (iph) ser.push({ name: "iPhone", labels: HW_TRAIN.map((r) => r[0]), values: HW_TRAIN.map(([, m]) => +(ep(iph, m, "CNN") || 0).toFixed(2)) });
  s.addChart(pres.charts.BAR, ser, Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 7.6, h: 5.5, barDir: "col", chartColors: [HEX.accent2, HEX.accent1], showLegend: true, legendPos: "t", legendFontSize: 11,
    valAxisLogScaleBase: 10, valAxisMinVal: 1, valAxisMaxVal: 10000,
    showValue: true, dataLabelFormatCode: "0.0", dataLabelFontSize: 10, dataLabelColor: HEX.dk1, dataLabelPosition: "outEnd",
    showTitle: true, title: "CNN 1 エポック [秒]（対数, 短いほど速い）", objectName: "hw-train-chart",
  }));
  const tr = (dev) => dev ? [
    `SIMD・行列ユニット: ${ratio(ep(dev, NV, "CNN"), ep(dev, F1, "CNN"))}`,
    `複数コア: ${ratio(ep(dev, F1, "CNN"), ep(dev, F32, "CNN"))}`,
    `GPU（全コアの CPU と比べて）: ${ep(dev, GP, "CNN") < ep(dev, F32, "CNN") ? ratio(ep(dev, F32, "CNN"), ep(dev, GP, "CNN")) + " 速い" : ratio(ep(dev, GP, "CNN"), ep(dev, F32, "CNN")) + " 遅い"}`,
  ] : [pend];
  para(s, [{ text: "Mac", options: { bold: true, breakLine: true } }, ...tr(mac).map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: true } })),
    { text: iph ? IPN : "iPhone", options: { bold: true, breakLine: true } }, ...tr(iph).map((t, i, a) => ({ text: t, options: { bullet: true, breakLine: i < a.length - 1 } }))],
    8.4, 1.4, 4.35, 3.2, { fontSize: 13 });
  bullets(s, D.hw_train_notes || [], 8.4, 4.1, 4.35, 2.7, 12);
}
const HW_INF = [["素朴なループ", NV, "batch_ms"], ["Accelerate", F32, "batch_ms"], ["GPU MPSGraph", GP, "batch_ms"], ["Core ML CPU", "Core ML FP16 CPU", "batch_ms"], ["Core ML GPU", "Core ML FP16 CPU+GPU", "batch_ms"], ["Core ML\nNeural Engine", "Core ML FP16 CPU+Neural Engine", "batch_ms"]];
{
  const s = slide("CONTENT", "推論: ハードウェアごとの CNN 1 枚あたりの時間", "まとめて処理したときの 1 枚あたり。素朴なループは 1,000 枚、ほかは 10,000 枚。Core ML は新形式（ML Program, FP16）に 100 枚ずつ渡した値。GPU = CPU + GPU、Neural Engine = CPU + Neural Engine を選んだ場合。対数目盛。");
  const val = (dev, m, k) => +(((inf(dev, m, "CNN") || {})[k]) || 0).toFixed(4);
  const ser = [{ name: "Mac", labels: HW_INF.map((r) => r[0]), values: HW_INF.map(([, m, k]) => val(mac, m, k)) }];
  if (iph) ser.push({ name: "iPhone", labels: HW_INF.map((r) => r[0]), values: HW_INF.map(([, m, k]) => val(iph, m, k)) });
  s.addChart(pres.charts.BAR, ser, Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 7.6, h: 5.5, barDir: "col", chartColors: [HEX.accent2, HEX.accent1], showLegend: true, legendPos: "t", legendFontSize: 11,
    valAxisLogScaleBase: 10, valAxisMinVal: 0.001, valAxisMaxVal: 10, catAxisLabelFontSize: 10,
    showTitle: true, title: "CNN 推論 1 枚あたり [ms]（対数, 短いほど速い）", objectName: "hw-infer-chart",
  }));
  bullets(s, D.hw_infer_notes || [], 8.4, 1.4, 4.35, 5.4, 13);
}

// =====================================================================
section("4. 推論の時間");
{
  const s = slide("SECTION", "推論の時間と Core ML の計算装置");
  s.addText("EusLisp で学習した重みでテスト 10,000 枚を認識。C++ + Accelerate と Core ML（CPU / GPU / Neural Engine）", { placeholder: "body" });
  tile(s, 0.9, 2.75, "4", C.accent4, 1.2);
}
{
  const s = slide("CONTENT", "推論 1 枚あたりの時間", "まとめて = 10,000 枚を処理した 1 枚あたり（C++ はバッチ 200、Core ML は batch API）。1 枚ずつ = 1 枚ごとに呼んだときの平均。µs = 1/1000 ms。");
  const ms = [[NV, "C++ 素朴なループ（1 スレッド）"], [F32, "C++ + Accelerate"], [GP, "GPU（MPSGraph）"],
    ["Core ML CPU", "Core ML（旧）CPU のみ"], ["Core ML CPU+GPU", "Core ML（旧）CPU + GPU"], ["Core ML CPU+Neural Engine", "Core ML（旧）CPU + Neural Engine"],
    ["Core ML FP16 CPU", "Core ML（新）CPU のみ"], ["Core ML FP16 CPU+GPU", "Core ML（新）CPU + GPU"], ["Core ML FP16 CPU+Neural Engine", "Core ML（新）CPU + Neural Engine"]];
  const cell = (dev, m, k, key) => fmtMs((inf(dev, m, k) || {})[key]);
  const rows = ms.map(([m, l]) => [l, cell(mac, m, "MLP", "batch_ms"), cell(mac, m, "CNN", "batch_ms"),
    cell(iph, m, "MLP", "batch_ms"), cell(iph, m, "CNN", "batch_ms"), cell(iph, m, "CNN", "one_ms")]);
  const best = Math.min(...ms.map(([m]) => (inf(iph, m, "CNN") || {}).batch_ms || 1e9));
  rows.forEach((r, i) => { if ((inf(iph, ms[i][0], "CNN") || {}).batch_ms === best) r[4] = hl(r[4]); });
  table(s, [["方法", "Mac\nMLP まとめて", "Mac\nCNN まとめて", "iPhone\nMLP まとめて", "iPhone\nCNN まとめて", "iPhone\nCNN 1 枚ずつ"], ...rows,
    ["参考: DGX CPU（C++ + OpenBLAS）", fmtMs(G.infer_cpu_ms.MLP), fmtMs(G.infer_cpu_ms.CNN), "", "", ""],
    ["参考: DGX GPU（CUDA）", fmtMs(G.infer_gpu_ms.MLP), fmtMs(G.infer_gpu_ms.CNN), "", "", ""]],
    0.6, 1.3, 12.1, [3.85, 1.65, 1.65, 1.65, 1.65, 1.65], 11, { rowH: 0.37 });
  bullets(s, D.infer_notes || [], 0.6, 6.05, 12.1, 0.9, 11.5);
}
{
  const s = slide("CONTENT", "Core ML のモデル形式と Neural Engine（iPhone, CNN）", "旧形式 = NeuralNetwork（FP32, 1 枚ずつ受け取る。batch API で 10,000 枚）。新形式 = ML Program（FP16, 100 枚ずつ受け取る）。層の割り当ては MLComputePlan で調べた。");
  const U = [["CPU のみ", "CPU"], ["CPU + GPU", "CPU+GPU"], ["CPU + Neural Engine", "CPU+Neural Engine"]];
  s.addChart(pres.charts.BAR, [
    { name: "旧形式（FP32, 1 枚ずつ）", labels: U.map((u) => u[0]), values: U.map(([, u]) => +(inf(iph, `Core ML ${u}`, "CNN").batch_ms * 1000).toFixed(1)) },
    { name: "新形式（FP16, 100 枚ずつ）", labels: U.map((u) => u[0]), values: U.map(([, u]) => +(inf(iph, `Core ML FP16 ${u}`, "CNN").batch_ms * 1000).toFixed(1)) },
  ], Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 6.6, h: 5.5, barDir: "col", chartColors: [HEX.accent6, HEX.accent1], showLegend: true, legendPos: "t", legendFontSize: 11,
    showValue: true, dataLabelFormatCode: "0.0", dataLabelFontSize: 10, dataLabelColor: HEX.dk1, dataLabelPosition: "outEnd",
    showTitle: true, title: "CNN 推論 1 枚あたり [µs]（短いほど速い）", objectName: "coreml-chart",
  }));
  const pl = (dev, m) => ((inf(dev, m, "CNN") || {}).plan || "—");
  table(s, [["計算装置の指定", "旧形式の割り当て", "新形式の割り当て"],
    ...U.map(([l, u]) => [l, pl(iph, `Core ML ${u}`), pl(iph, `Core ML FP16 ${u}`)])],
    7.4, 1.4, 5.35, [1.75, 1.8, 1.8], 11, { rowH: 0.45 });
  bullets(s, D.coreml_notes || [], 7.4, 3.45, 5.35, 3.4, 12);
}
{
  const s = slide("CONTENT", "考察 — Mac と iPhone で速さを左右するもの", "");
  (D.discussion || []).forEach(([a, b], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + col * 6.15, y = 1.4 + row * 1.8;
    card(s, x, y, 5.95, 1.65);
    tile(s, x + 0.2, y + 0.2, String(i + 1), [C.accent2, C.accent1, C.accent4, C.accent3, C.accent6, C.text1][i]);
    para(s, [{ text: a, options: { bold: true, fontSize: 14, breakLine: true } }, { text: b, options: { fontSize: 12, color: C.accent6 } }], x + 0.8, y + 0.18, 5.0, 1.4);
  });
}

// =====================================================================
section("5. ブラウザでの計測");
{
  const s = slide("SECTION", "ブラウザでの計測");
  s.addText("同じ計測ページ（自作 JavaScript と TensorFlow.js）を DGX Spark・Mac・iPhone のブラウザで動かす", { placeholder: "body" });
  tile(s, 0.9, 2.75, "5", C.accent3, 1.2);
}
const BENV = Object.keys(D.browser);
const BSH = { "JavaScript（自作）": "JS 自作（1 コア）", "TensorFlow.js WASM": "TF.js WASM（CPU）", "TensorFlow.js WebGL（GPU）": "TF.js WebGL（GPU）", "TensorFlow.js WebGPU（GPU）": "TF.js WebGPU（GPU）", "TensorFlow.js CPU（JS）": "TF.js CPU（JS）" };
const bv = (env, m, task) => D.browser[env][`${m}|${task}`];
const ENVS = (e) => e.replace("（", "\n（");
function browserTable(s, tasks, fmt, y, title) {
  const hdr = ["方法", ...BENV.flatMap((e) => tasks.map((t) => `${e.split("（")[0]}\n${t[1]}`))];
  const f0 = (v) => (v === 0 ? "1 ms 未満" : fmt(v));  // ブラウザのタイマーが 0 を返したもの
  const rows = D.browser_methods.map((m) => [BSH[m], ...BENV.flatMap((e) => tasks.map(([t]) => (bv(e, m, t) == null ? "—" : f0(bv(e, m, t)))))]);
  // 環境・内容ごとに最速を強調
  BENV.forEach((e, ei) => tasks.forEach(([t], ti) => {
    const all = D.browser_methods.map((m) => bv(e, m, t)).filter((v) => v != null);
    if (all.includes(0)) return;  // 「1 ms 未満」(タイマーで計れない) があるときは最速を決めない
    const mn = Math.min(...all);
    D.browser_methods.forEach((m, mi) => { if (bv(e, m, t) === mn) rows[mi][1 + ei * tasks.length + ti] = hl(fmt(mn)); });
  }));
  const n = hdr.length - 1;
  table(s, [hdr, ...rows], 0.6, y, 12.1, [2.5, ...Array(n).fill(9.6 / n)], 12, { rowH: 0.45 });
}
{
  const s = slide("CONTENT", "ブラウザ: 学習 1 エポックの時間", "60,000 枚 1 エポックに換算（JS 自作は 600 枚、TF.js CPU は 400 枚（CNN 200 枚）、ほかは 6,000 枚から）。赤 = その機器で最速。iPhone は Safari、Mac は Safari、DGX は Chromium。");
  browserTable(s, [["MLP 学習", "MLP"], ["CNN 学習", "CNN"]], fmtS, 1.4);
  bullets(s, D.browser_train_notes || [], 0.6, 4.6, 12.1, 2.2, 13);
}
{
  const s = slide("CONTENT", "ブラウザ: 推論 1 枚あたりの時間", "まとめて = 1,000 枚ずつ処理した 1 枚あたり（JS 自作・TF.js CPU は 1,000 枚、ほかは 10,000 枚）。1 枚ずつ = 1 枚だけ認識したときの応答時間（中央値, ブラウザのタイマーの細かさで丸められる）。");
  browserTable(s, [["CNN 推論", "CNN まとめて"], ["CNN 推論 1 枚ずつ", "CNN 1 枚ずつ"]], fmtMs, 1.4);
  bullets(s, D.browser_infer_notes || [], 0.6, 4.6, 12.1, 2.2, 13);
}

// =====================================================================
section("6. すべての結果の比較");
{
  const s = slide("SECTION", "すべての計測結果の比較");
  s.addText("DGX Spark・Mac・iPhone の、EusLisp・C++・GPU・Neural Engine・ブラウザの結果を 1 つの表に", { placeholder: "body" });
  tile(s, 0.9, 2.75, "6", C.accent6, 1.2);
}
const BHW = { "JS 自作": "CPU 1 コア", "TF.js WASM": "CPU 1 コア（SIMD）", "TF.js WebGL": "GPU", "TF.js WebGPU": "GPU", "TF.js CPU": "CPU 1 コア" };
const bhw = (...names) => [...new Set(names.filter(Boolean).map((n) => BHW[n] || n))].join(" / ");
const bbest = (env, task) => { if (!D.browser[env]) return [null, null]; const c = D.browser_methods.map((m) => [m, bv(env, m, task)]).filter(([, v]) => v != null).sort((a, b) => a[1] - b[1])[0]; return c ? [c[1], BSH[c[0]].replace(/（.*）/, "")] : [null, null]; };
const BMAC = BENV.find((e) => e.startsWith("Mac")), BIPH = BENV.find((e) => e.startsWith("iPhone")), BDGX = BENV.find((e) => e.startsWith("DGX"));
const ALL_TRAIN = [
  // [機器, 方法, MLP, CNN, 使うハードウェア]
  ["DGX Spark", "EusLisp nn.l（OpenBLAS）", G.eus, null, "CPU（BLAS）"],
  ["DGX Spark", "C++ + OpenBLAS FP32", G.cpu32, G.cpu32_cnn, "CPU 20 コア（SIMD）"],
  ["DGX Spark", "CUDA FP32", G.gpu32, G.gpu32_cnn, "GPU（GB10）"],
  ["DGX Spark", `ブラウザ 最速（${bbest(BDGX, "MLP 学習")[1]} / ${bbest(BDGX, "CNN 学習")[1]}）`, bbest(BDGX, "MLP 学習")[0], bbest(BDGX, "CNN 学習")[0], bhw(bbest(BDGX, "MLP 学習")[1], bbest(BDGX, "CNN 学習")[1])],
  ["Mac", "EusLisp nn.l（Accelerate）", D.eus_mac.best_wall, null, "CPU（BLAS）"],
  ["Mac", "C++ 素朴なループ", ep(mac, NV, "MLP"), ep(mac, NV, "CNN"), "CPU 1 コア, SIMD なし"],
  ["Mac", "C++ + Accelerate 1 スレッド", ep(mac, F1, "MLP"), ep(mac, F1, "CNN"), "CPU 1 コア（AVX2・FMA）"],
  ["Mac", "C++ + Accelerate FP32", ep(mac, F32, "MLP"), ep(mac, F32, "CNN"), "CPU 4 コア（AVX2・FMA）"],
  ["Mac", "GPU（MPSGraph）", ep(mac, GP, "MLP"), ep(mac, GP, "CNN"), "GPU（Iris Plus 655）"],
  ...(BMAC ? [["Mac", `ブラウザ 最速（${bbest(BMAC, "MLP 学習")[1]} / ${bbest(BMAC, "CNN 学習")[1]}）`, bbest(BMAC, "MLP 学習")[0], bbest(BMAC, "CNN 学習")[0], bhw(bbest(BMAC, "MLP 学習")[1], bbest(BMAC, "CNN 学習")[1])]] : []),
  ["iPhone", "C++ 素朴なループ", ep(iph, NV, "MLP"), ep(iph, NV, "CNN"), "CPU 1 コア, SIMD なし"],
  ["iPhone", "C++ + Accelerate 1 スレッド", ep(iph, F1, "MLP"), ep(iph, F1, "CNN"), "CPU 1 コア（NEON・行列ユニット）"],
  ["iPhone", "C++ + Accelerate FP32", ep(iph, F32, "MLP"), ep(iph, F32, "CNN"), "CPU 6 コア（NEON・行列ユニット）"],
  ["iPhone", "GPU（MPSGraph）", ep(iph, GP, "MLP"), ep(iph, GP, "CNN"), "GPU（A18 Pro）"],
  ...(BIPH ? [["iPhone", `ブラウザ 最速（${bbest(BIPH, "MLP 学習")[1]} / ${bbest(BIPH, "CNN 学習")[1]}）`, bbest(BIPH, "MLP 学習")[0], bbest(BIPH, "CNN 学習")[0], bhw(bbest(BIPH, "MLP 学習")[1], bbest(BIPH, "CNN 学習")[1])]] : [["iPhone", "ブラウザ（計測中）", null, null, ""]]),
];
const devFill = { "DGX Spark": "E8EEF6", "Mac": "EEF1F6", "iPhone": "FDF0EC" };
function allTable(s, rows, fmt, cols) {
  const mins = [2, 3].map((k) => Math.min(...rows.map((r) => r[k]).filter((v) => v != null)));
  const body = rows.map((r) => [r[0], r[1], ...[2, 3].map((k) => (r[k] == null ? "—" : r[k] === mins[k - 2] ? hl(fmt(r[k])) : fmt(r[k]))), r[4]]
    .map((c) => (typeof c === "object" ? c : { text: String(c), options: { fill: { color: devFill[r[0]] } } })));
  table(s, [["機器", "方法", ...cols, "使うハードウェア"], ...body], 0.6, 1.3, 12.1, [1.3, 4.3, 1.5, 1.5, 3.5], 11, { rowH: 0.34 });
}
{
  const s = slide("CONTENT", "すべての結果: 学習 1 エポック（60,000 枚）", "C++・GPU は 6,000 枚 × 2 エポックの速い方から換算。ブラウザは各機器で最も速かった方法。赤 = 全体で最速。");
  allTable(s, ALL_TRAIN, fmtS, ["MLP", "CNN"]);
}
const binf = (env, task) => bbest(env, task);
const ALL_INF = [
  ["DGX Spark", "C++ + OpenBLAS FP32（CPU）", G.infer_cpu_ms.MLP, G.infer_cpu_ms.CNN, "CPU 20 コア"],
  ["DGX Spark", "CUDA（GPU）", G.infer_gpu_ms.MLP, G.infer_gpu_ms.CNN, "GPU（GB10）"],
  ["DGX Spark", `ブラウザ 最速（${[...new Set([binf(BDGX, "MLP 推論")[1], binf(BDGX, "CNN 推論")[1]])].join(" / ")}）`, binf(BDGX, "MLP 推論")[0], binf(BDGX, "CNN 推論")[0], bhw(binf(BDGX, "MLP 推論")[1], binf(BDGX, "CNN 推論")[1])],
  ["Mac", "C++ 素朴なループ", inf(mac, NV, "MLP").batch_ms, inf(mac, NV, "CNN").batch_ms, "CPU 1 コア, SIMD なし"],
  ["Mac", "C++ + Accelerate FP32", inf(mac, F32, "MLP").batch_ms, inf(mac, F32, "CNN").batch_ms, "CPU 4 コア"],
  ["Mac", "GPU（MPSGraph）", inf(mac, GP, "MLP").batch_ms, inf(mac, GP, "CNN").batch_ms, "GPU（Iris Plus 655）"],
  ["Mac", "Core ML（新形式）CPU のみ", inf(mac, "Core ML FP16 CPU", "MLP").batch_ms, inf(mac, "Core ML FP16 CPU", "CNN").batch_ms, "CPU"],
  ...(BMAC ? [["Mac", `ブラウザ 最速（${[...new Set([binf(BMAC, "MLP 推論")[1], binf(BMAC, "CNN 推論")[1]])].join(" / ")}）`, binf(BMAC, "MLP 推論")[0], binf(BMAC, "CNN 推論")[0], bhw(binf(BMAC, "MLP 推論")[1], binf(BMAC, "CNN 推論")[1])]] : []),
  ["iPhone", "C++ 素朴なループ", inf(iph, NV, "MLP").batch_ms, inf(iph, NV, "CNN").batch_ms, "CPU 1 コア, SIMD なし"],
  ["iPhone", "C++ + Accelerate FP32", inf(iph, F32, "MLP").batch_ms, inf(iph, F32, "CNN").batch_ms, "CPU 6 コア（行列ユニット）"],
  ["iPhone", "GPU（MPSGraph）", inf(iph, GP, "MLP").batch_ms, inf(iph, GP, "CNN").batch_ms, "GPU（A18 Pro）"],
  ["iPhone", "Core ML（新形式）CPU のみ", inf(iph, "Core ML FP16 CPU", "MLP").batch_ms, inf(iph, "Core ML FP16 CPU", "CNN").batch_ms, "CPU"],
  ["iPhone", "Core ML（新形式）Neural Engine", inf(iph, "Core ML FP16 CPU+Neural Engine", "MLP").batch_ms, inf(iph, "Core ML FP16 CPU+Neural Engine", "CNN").batch_ms, "Neural Engine"],
  ...(BIPH ? [["iPhone", `ブラウザ 最速（${[...new Set([binf(BIPH, "MLP 推論")[1], binf(BIPH, "CNN 推論")[1]])].join(" / ")}）`, binf(BIPH, "MLP 推論")[0], binf(BIPH, "CNN 推論")[0], bhw(binf(BIPH, "MLP 推論")[1], binf(BIPH, "CNN 推論")[1])]] : [["iPhone", "ブラウザ（計測中）", null, null, ""]]),
];
{
  const s = slide("CONTENT", "すべての結果: 推論 1 枚あたり（まとめて処理）", "10,000 枚（素朴なループは 1,000 枚）をまとめて処理した 1 枚あたり。ブラウザは各機器で最も速かった方法。赤 = 全体で最速。");
  allTable(s, ALL_INF, fmtMs, ["MLP", "CNN"]);
}

// =====================================================================
section("7. まとめ");
{
  const s = slide("CONTENT", "追加したファイルと使い方", "iPhone アプリのビルドには Xcode の iOS プラットフォームと Apple ID（無料で可）、iPhone のデベロッパモードが必要。");
  code(s, [
    "ios/MNISTBench/Engine/cpucnn.cpp   C++ エンジン（cudacnn.cu の CPU 経路を Accelerate + GCD に移植）",
    "ios/MNISTBench/Shared/Bench.swift  計測の手順, 結果の JSON    GPUNet.swift  GPU（MPSGraph）の学習・推論",
    "ios/models/mkmlprogram.py          Core ML の新形式（ML Program, FP16）のモデルを作る",
    "ios/MNISTBench/App/                iPhone アプリ（SwiftUI）  ios/MNISTBench/Mac/  Mac のコマンドライン",
    "ios/project.yml, ios/Makefile      Xcode プロジェクト（XcodeGen）と Mac 版のビルド",
    "phone/native/*.json                計測結果    docs/src/mkmacios.py, build_macios.js  このスライド",
    "cblaslib.l, nn.l, MATPROD/Makefile.Darwin   EusLisp を Mac（Accelerate）で動かす変更",
  ].join("\n"), 0.6, 1.4, 12.1, 2.15, 12);
  code(s, [
    "# Mac",
    "$ make -C ios mac && ios/build/mac/mnistbench --out phone/native/mac_run1.json",
    "$ MAC_EPOCH=2 eus '(load \"docs/src/eus/mac_bench.l\")'     # EusLisp nn.l",
    "# iPhone（USB でつなぐ）",
    "$ make -C ios project && xcodebuild -project ios/MNISTBench.xcodeproj -scheme MNISTBench \\",
    "    -destination 'generic/platform=iOS' -allowProvisioningUpdates DEVELOPMENT_TEAM=<チーム ID> build",
    "$ xcrun devicectl device process launch --console --device <ID> jp.jsk.mnist.MNISTBench -autorun",
    "# スライド",
    "$ cd docs/src && python3 mkmacios.py && node build_macios.js",
  ].join("\n"), 0.6, 3.65, 12.1, 2.6, 12.5);
}
{
  const s = slide("TITLE_DARK", "まとめ");
  const T = D.conclusion || [];
  // 項目が多いので本文の枠を広く取る (タイトルの下から下端の 0.5" 手前まで)
  s.addText(T.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < T.length - 1, paraSpaceAfter: 6 } })),
    { x: 0.8, y: 3.85, w: 11.7, h: 3.15, fontSize: 16, color: "CADCFC", valign: "top", margin: 0, isTextBox: true, objectName: "conclusion" });
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  const JSZip = require("jszip");
  const zip = await JSZip.loadAsync(fs.readFileSync(OUT));
  // グラフの文字にも日本語フォントを明示 (Arial → テーマのフォント, ea を追加)
  for (const f of Object.keys(zip.files).filter((f) => /ppt\/charts\/chart\d+\.xml$/.test(f))) {
    let x = await zip.file(f).async("string");
    x = x.replace(/<a:latin typeface="Arial"\/>/g, `<a:latin typeface="${THEME.bodyFontFace}"/>`)
         .replace(/(<a:latin typeface="[^"]*"\/>)(?!<a:ea)/g, `$1<a:ea typeface="${THEME.bodyFontFace}"/>`);
    zip.file(f, x);
  }
  for (const f of Object.keys(zip.files).filter((f) => /ppt\/theme\/theme\d+\.xml$/.test(f))) {
    let x = await zip.file(f).async("string");
    x = x.replace(/<a:ea typeface="[^"]*"\s*\/>/g, `<a:ea typeface="${THEME.bodyFontFace}"/>`);
    zip.file(f, x);
  }
  fs.writeFileSync(OUT, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log("wrote", OUT);
})();
