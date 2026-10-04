// MNIST × EusLisp 解説スライド生成
const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");
const { applyTheme } = require(process.env.SKILL_DIR + "/scripts/apply_theme.js");

const W = __dirname;
const OUT = process.argv[2] || path.join(W, "mnist_phone.pptx");
const ev = JSON.parse(fs.readFileSync(path.join(W, "eval.json")));
const prof = JSON.parse(fs.readFileSync(path.join(W, "prof.json")));
const examples = JSON.parse(fs.readFileSync(path.join(W, "examples.json")));
const wrongTest = JSON.parse(fs.readFileSync(path.join(W, "wrong_test.json")));
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
pres.title = "MNIST をスマートフォンで — 方法・AI 機能・計算時間";
pres.author = "Masayuki Inaba";
pres.subject = "MNIST dataset, MLP implementation in EusLisp, profiling and results";
const C = pres.SchemeColor;

// ---------- layouts ----------
const FOOT = "MNIST × EusLisp — スマートフォンでの計測";
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

// ---- スマートフォン版スライド本体 (build_phone.js から読み込む) ----
const PH = JSON.parse(fs.readFileSync(path.join(W, "phone.json")));
const f1 = (v, d) => Number(v).toFixed(d === undefined ? 1 : d);
const figp = (f) => path.join(W, "figp", f);
const fmtS = (s) => (s >= 100 ? f1(s, 0) + " 秒" : s >= 10 ? f1(s, 1) + " 秒" : s >= 1 ? f1(s, 2) + " 秒" : f1(s * 1000, s < 0.01 ? 2 : 1) + " ms");
const fmtMs = (ms) => (ms >= 100 ? f1(ms, 0) + " ms" : ms >= 1 ? f1(ms, 2) + " ms" : ms >= 0.01 ? f1(ms * 1000, 0) + " µs" : f1(ms * 1000, 1) + " µs");
const per = (r) => r.sec / r.n;
const bestOf = (R, task) => R.filter((r) => !r.skipped && r.task === task).sort((a, b) => per(a) - per(b))[0];
const ofMethod = (R, m, task) => R.find((r) => r.method === m && r.task === task);
const METHODS = ["JavaScript（自作）", "TensorFlow.js WASM", "TensorFlow.js WebGL（GPU）", "TensorFlow.js WebGPU（GPU）", "TensorFlow.js CPU（JS）"];
const MSHORT = { "JavaScript（自作）": "JS 自作", "TensorFlow.js WASM": "TF.js WASM", "TensorFlow.js WebGL（GPU）": "TF.js WebGL", "TensorFlow.js WebGPU（GPU）": "TF.js WebGPU", "TensorFlow.js CPU（JS）": "TF.js CPU" };
const phones = PH.phones;
const dgxB = PH.dgx_browser.results;
const phoneName = (p) => p.device || "スマートフォン";

// =====================================================================
section("タイトル");
{
  const s = slide("TITLE_DARK", "MNIST をスマートフォンで\n方法・AI 機能・計算時間の比較");
  s.addText([
    { text: "スマートフォンで NN を動かす方法とスマートフォンの AI 機能を整理し、EusLisp で学習した MNIST の MLP と CNN をブラウザで動かす計測ページを作って、DGX Spark（OpenBLAS / CUDA）と時間を比べた", options: { breakLine: true } },
    { text: `計測した端末: ${phones.length ? phones.map(phoneName).join("、") : "（スマートフォンの結果待ち）"} ／ 比較: DGX Spark（GB10 GPU, 20 コア ARM CPU）`, options: { fontSize: 13, color: "8FA3C8" } },
  ], { placeholder: "body" });
  s.addText("2026-10-03", { x: 0.8, y: 6.6, w: 4, h: 0.4, fontSize: 12, color: "8FA3C8", margin: 0, isTextBox: true });
}
{
  const s = slide("CONTENT", "概要", "時間は 60,000 枚あたりに換算（学習は 1 エポック）。スマートフォンの値は計測ページで最も速かった方法。");
  const p0 = phones[0];
  const R = p0 ? p0.results : [];
  const st = p0 ? [
    [fmtS(per(bestOf(R, "MLP 学習")) * 60000), `${phoneName(p0)}: MLP 1 エポック\n（${bestOf(R, "MLP 学習").method}）`, C.accent2],
    [fmtS(per(bestOf(R, "CNN 学習")) * 60000), `${phoneName(p0)}: CNN 1 エポック\n（${bestOf(R, "CNN 学習").method}）`, C.accent1],
    [fmtMs(per(bestOf(R, "CNN 推論")) * 1000), `${phoneName(p0)}: CNN 推論 1 枚あたり\n（まとめて処理, ${bestOf(R, "CNN 推論").method}）`, C.accent4],
    [`×${f1(per(bestOf(R, "CNN 学習")) * 60000 / PH.ref.cuda_cnn32, 0)}`, `CNN 1 エポックの時間\nDGX Spark GPU（${fmtS(PH.ref.cuda_cnn32)}）との比`, C.accent6],
  ] : [["—", "スマートフォンの結果待ち", C.accent6], ["—", "", C.accent6], ["—", "", C.accent6], ["—", "", C.accent6]];
  const xs = [0.6, 3.7, 6.8, 9.9];
  st.forEach(([b, l, c], i) => {
    card(s, xs[i], 1.45, 2.85, 2.2);
    s.addText(b, { x: xs[i] + 0.2, y: 1.6, w: 2.5, h: 0.95, fontSize: 34, bold: true, color: c, valign: "bottom", margin: 0, isTextBox: true, fit: "shrink" });
    s.addText(l, { x: xs[i] + 0.2, y: 2.65, w: 2.5, h: 0.9, fontSize: 11.5, color: C.accent6, valign: "top", margin: 0, isTextBox: true });
  });
  head(s, 0.6, 3.95, 6, "1", "スマートフォンで NN を動かす方法", C.text1);
  head(s, 0.6, 4.45, 6, "2", "スマートフォンの AI 機能（Android / iOS / ブラウザ）", C.accent2);
  head(s, 0.6, 4.95, 6, "3", "MNIST をスマートフォンで行う方法", C.accent4);
  head(s, 6.9, 3.95, 6, "4", "実装した計測ページ", C.accent3);
  head(s, 6.9, 4.45, 6, "5", "計算時間の比較", C.accent1);
  head(s, 6.9, 4.95, 6, "6", "まとめと使い方", C.accent6);
  para(s, PH.summary, 0.6, 5.7, 12.1, 1.1, { fontSize: 12.5, color: C.accent6, italic: true });
}

// =====================================================================
section("1. スマホで NN を動かす方法");
{
  const s = slide("SECTION", "スマートフォンで NN を動かす方法");
  s.addText("ブラウザ ／ ネイティブアプリ ／ OS の AI 機能 ／ Linux 環境（Termux）／ サーバーに送る", { placeholder: "body" });
  tile(s, 0.9, 2.75, "1", C.accent6, 1.2);
}
{
  const s = slide("CONTENT", "5 つの方法の全体像", "右の列は、その方法から使える計算装置。NPU（AI 専用の演算装置）は、基本的に OS やアプリ向けの仕組みからしか使えない。");
  const R = [
    ["A", "ブラウザ（Web アプリ）", "JavaScript, WebAssembly, WebGL, WebGPU。TensorFlow.js, ONNX Runtime Web など", "インストール不要・URL を開くだけ", "CPU, GPU", C.accent2],
    ["B", "ネイティブアプリ", "Android: LiteRT（旧 TensorFlow Lite）, ONNX Runtime Mobile, ExecuTorch ／ iOS: Core ML", "最速。NPU も使える。アプリの作成・配布が必要", "CPU, GPU, NPU", C.accent1],
    ["C", "OS の AI 機能を呼ぶ", "Android: ML Kit（手書き認識あり）, Gemini Nano ／ iOS: Vision（文字認識）, Foundation Models", "学習済みの機能をすぐ使える。中身は選べない", "CPU, GPU, NPU", C.accent4],
    ["D", "Linux 環境（Termux など）", "Android の Termux で Python・C・EusLisp をビルドして動かす", "PC と同じコードが動く。GPU・NPU は使いにくい", "CPU", C.accent3],
    ["E", "サーバーに送る", "画像をスマートフォンから DGX Spark などに送り、結果を返す（HTTP, ROS など）", "端末の性能に依らない。通信の遅れと接続が必要", "サーバー側", C.accent6],
  ];
  table(s, [["", "方法", "使うもの", "特徴", "計算装置"], ...R.map((r) => [{ text: r[0], options: { bold: true, color: HEX.lt1, fill: { color: [HEX.accent2, HEX.accent1, HEX.accent4, HEX.accent3, HEX.accent6][R.indexOf(r)] }, align: "center" } }, { text: r[1], options: { bold: true } }, r[2], r[3], r[4]])],
    0.6, 1.35, 12.1, [0.5, 2.3, 4.6, 3.3, 1.4], 11.5, { rowH: 0.78 });
  para(s, "今回は A（ブラウザ）を実装してスマートフォンで計測し、B 用には ONNX 形式のモデルを用意した。C・D・E は使い方と手順を整理した。", 0.6, 6.45, 12.1, 0.4, { fontSize: 12.5 });
}
{
  const s = slide("CONTENT", "スマートフォンの計算資源", "数値は機種で大きく違うため、ここでは種類と特徴だけを示す。");
  const R = [
    ["CPU", "ARM の高性能コア数個 + 省電力コア数個。NEON（SIMD）で 4〜8 個の数を同時に計算", "ブラウザの JavaScript・WebAssembly、Termux、アプリ"],
    ["GPU", "Apple GPU, Qualcomm Adreno, ARM Mali など。単精度（FP32）・半精度（FP16）の並列計算が得意。FP64 はほぼ使えない", "WebGL, WebGPU（ブラウザ）、Metal / Vulkan / OpenCL（アプリ）"],
    ["NPU", "AI 専用の演算装置（Apple Neural Engine, Qualcomm Hexagon, Google Tensor の TPU など）。INT8 / FP16 で数十 TOPS（公称）", "Core ML, LiteRT / NNAPI, QNN など OS・アプリ向けの仕組みから"],
    ["メモリ", "CPU・GPU・NPU で共有（統合メモリ）。PC の GPU のような転送はいらないが、帯域は PC より小さい", "すべて"],
    ["熱と電池", "長く全力で動かすと温度が上がり、クロックが下がる（サーマルスロットリング）", "長い学習ほど影響が大きい"],
  ];
  table(s, [["装置", "特徴", "どこから使えるか"], ...R], 0.6, 1.35, 12.1, [1.4, 6.4, 4.3], 12, { rowH: 0.8 });
  para(s, "DGX Spark（GB10）も ARM CPU + GPU + 統合メモリという、スマートフォンと同じ形の構成。違いは規模（コア数・メモリ帯域・電力）。", 0.6, 6.45, 12.1, 0.4, { fontSize: 12.5, color: C.accent2 });
}

// =====================================================================
section("2. スマホの AI 機能");
{
  const s = slide("SECTION", "スマートフォンの AI 機能");
  s.addText("Android・iOS・ブラウザで使える NN の仕組みと、手書き認識などの学習済み機能", { placeholder: "body" });
  tile(s, 0.9, 2.75, "2", C.accent2, 1.2);
}
{
  const s = slide("CONTENT", "Android の AI 機能と NN の仕組み", "Google の Android 開発者向け資料をもとに整理。NNAPI は Android 15 で非推奨になり、LiteRT（TensorFlow Lite の後継の名前）が中心。");
  table(s, [["仕組み", "何ができるか", "MNIST での使い方"],
    ["LiteRT（旧 TensorFlow Lite）", "自分の学習済みモデル（.tflite）を CPU（XNNPACK）・GPU・NPU で実行", "MLP / CNN を .tflite に変換して実行"],
    ["ONNX Runtime Mobile", "ONNX モデルを実行。NNAPI / QNN（Qualcomm NPU）/ XNNPACK を選べる", "今回作った mnist_cnn.onnx をそのまま使える"],
    ["ExecuTorch", "PyTorch のモデルを書き出して端末で実行（PyTorch 公式）", "PyTorch で同じ構成を作って書き出す"],
    ["MediaPipe", "画像分類・物体検出・手の検出などの部品をまとめたもの", "画像分類器としてモデルを載せる"],
    ["ML Kit", "学習済みの機能: 文字認識（OCR）, デジタルインク認識（手書き文字）, 顔・バーコード検出など", "デジタルインク認識で、指で書いた数字をそのまま認識できる"],
    ["Gemini Nano（AICore / ML Kit GenAI）", "端末内で動く生成 AI。要約・文章生成・画像の説明など（対応機種のみ）", "数字の認識よりも説明や対話に向く"]], 0.6, 1.4, 12.1, [3.0, 5.3, 3.8], 12, { rowH: 0.72 });
}
{
  const s = slide("CONTENT", "iOS（iPhone）の AI 機能と NN の仕組み", "Apple の開発者向け資料をもとに整理。Core ML が CPU・GPU・Neural Engine を自動で使い分ける。");
  table(s, [["仕組み", "何ができるか", "MNIST での使い方"],
    ["Core ML", "学習済みモデル（.mlmodel / .mlpackage）を CPU・GPU・Neural Engine で実行", "coremltools で PyTorch / ONNX から変換して実行"],
    ["Vision", "画像処理と学習済み機能: 文字認識（手書きを含む）, 顔・物体検出など。Core ML のモデルも呼べる", "VNRecognizeTextRequest で書いた数字を読む"],
    ["Create ML", "Mac で画像分類などのモデルを作る道具", "MNIST の画像から分類器を作れる"],
    ["Metal Performance Shaders Graph", "GPU で NN の計算を組む低いレベルの仕組み", "自分で層を書いて GPU で動かす"],
    ["Accelerate（BNNS, vDSP）", "CPU の SIMD を使う数値計算（BLAS もある）", "OpenBLAS の代わりに行列積を速く"],
    ["Foundation Models（Apple Intelligence）", "端末内の言語モデルを呼ぶ（対応機種）", "説明・要約向け。数字認識には使わない"]], 0.6, 1.4, 12.1, [3.4, 5.0, 3.7], 12, { rowH: 0.72 });
}
{
  const s = slide("CONTENT", "ブラウザで使える NN の仕組み", "ブラウザは同じページが Android・iPhone・PC のどれでも動く。今回の計測ページはこの方法。");
  table(s, [["仕組み", "計算装置", "特徴"],
    ["JavaScript（Float32Array のループ）", "CPU 1 コア", "ライブラリ不要。遅い（今回の「自作」）"],
    ["WebAssembly（WASM）+ SIMD", "CPU", "C/C++ をコンパイルした速いコード。マルチスレッドはページの設定（cross-origin isolation）が必要"],
    ["WebGL", "GPU", "画像描画の仕組みを計算に流用。ほぼすべての端末で使える"],
    ["WebGPU", "GPU", "計算用に設計された新しい仕組み。Chrome（Android）・Safari（iOS 26 以降）などで順次対応"],
    ["WebNN", "CPU / GPU / NPU", "NN 専用の新しい API（策定中）。ブラウザから NPU を使える見込み"],
    ["TensorFlow.js", "上のどれでも", "Google のライブラリ。学習もできる。backend を切り替える"],
    ["ONNX Runtime Web / Transformers.js", "WASM / WebGPU", "ONNX モデルや Hugging Face のモデルを動かす"]], 0.6, 1.4, 12.1, [3.6, 2.0, 6.5], 12, { rowH: 0.66 });
}

// =====================================================================
section("3. MNIST をスマホで行う方法");
{
  const s = slide("SECTION", "MNIST をスマートフォンで行う方法");
  s.addText("ブラウザで動かす（実装・計測）／ アプリに組み込む（ONNX モデル）／ OS の手書き認識を使う ／ Termux で EusLisp", { placeholder: "body" });
  tile(s, 0.9, 2.75, "3", C.accent4, 1.2);
}
{
  const s = slide("CONTENT", "4 つのやり方と今回の対応", "◎ = 実装して計測、○ = ファイルを用意、△ = 手順の整理のみ（このマシンにはスマートフォンの開発環境がない）。");
  table(s, [["やり方", "学習", "推論", "使える計算装置", "今回"],
    ["① ブラウザの計測ページ（TensorFlow.js と自作 JS）", "できる", "できる", "CPU, GPU", hl("◎ 実装・計測")],
    ["② アプリ（ONNX Runtime Mobile / LiteRT / Core ML）", "難しい（推論向け）", "できる", "CPU, GPU, NPU", "○ ONNX モデルを用意"],
    ["③ OS の手書き認識（ML Kit / Vision）", "できない", "できる（文字一般）", "CPU, GPU, NPU", "△ 使い方を整理"],
    ["④ Termux で EusLisp / Python", "できる", "できる", "CPU", "△ 手順を整理"]], 0.6, 1.4, 12.1, [4.6, 1.6, 1.6, 2.0, 2.3], 12.5, { rowH: 0.62 });
  bullets(s, [
    "学習まで含めてスマートフォンで試すなら ①（ブラウザ）が手軽。WebGL / WebGPU で GPU も使える",
    "製品として速く動かすなら ②。モデルは PC（DGX Spark）で学習し、スマートフォンでは推論だけを行うのが普通",
    "手書きの数字を読むだけなら ③ の学習済み機能で足りる（MNIST のモデルを作る必要がない）",
    "EusLisp のコードをそのまま試すなら ④。ARM の Linux 環境なので、DGX Spark（aarch64）と同じ手順でビルドできる見込み",
  ], 0.6, 4.75, 12.1, 2.2, 12);
}
{
  const s = slide("CONTENT", "アプリに組み込む例 — ONNX モデルを使う", "phone/onnx/mnist_cnn.onnx は入力 image（n×1×28×28, 0〜1）、出力 prob（n×10 の確率）。以下はコードの例（このマシンではビルドしていない）。");
  code(s, [
    "// Android (Kotlin) + ONNX Runtime Mobile",
    "val env = OrtEnvironment.getEnvironment()",
    "val opts = OrtSession.SessionOptions()",
    "opts.addNnapi()          // NPU / GPU を使う (使えなければ CPU)",
    "val session = env.createSession(",
    "    assets.open(\"mnist_cnn.onnx\").readBytes(), opts)",
    "val x = OnnxTensor.createTensor(env,",
    "    FloatBuffer.wrap(pixels), longArrayOf(1, 1, 28, 28))",
    "val prob = session.run(mapOf(\"image\" to x))[0].value",
    "    as Array<FloatArray>",
    "val digit = prob[0].indices.maxBy { prob[0][it] }",
  ].join("\n"), 0.6, 1.4, 6.0, 4.2, 12);
  code(s, [
    "# Mac で Core ML に変換 (Python, coremltools)",
    "import coremltools as ct, torch",
    "m = torch.jit.trace(cnn, torch.zeros(1,1,28,28))",
    "ml = ct.convert(m, inputs=[ct.TensorType(",
    "        name=\"image\", shape=(1,1,28,28))])",
    "ml.save(\"MNISTCNN.mlpackage\")",
    "",
    "// iPhone (Swift) で推論",
    "let model = try MNISTCNN(configuration: .init())",
    "// computeUnits = .all で Neural Engine も使う",
    "let out = try model.prediction(image: input)",
  ].join("\n"), 6.8, 1.4, 5.9, 4.2, 12);
  bullets(s, [
    "モデルは同じ重み（EusLisp で学習したもの）。ONNX Runtime（このマシンの ARM CPU, 4 スレッド）で 10,000 枚の認識数が MLP 9824・CNN 9917 と一致することを確認済み",
    "LiteRT（.tflite）へは ONNX → TensorFlow → LiteRT の変換か、PyTorch から ai-edge-torch で変換する",
  ], 0.6, 5.8, 12.1, 1.1, 12);
}
{
  const s = slide("CONTENT", "OS の手書き認識を使う・Termux で EusLisp を動かす", "Termux の手順は案（実機では未確認）。jskeus は aarch64 の Linux（DGX Spark）で動いているので、同じ ARM の Android でもビルドできる見込み。");
  head(s, 0.6, 1.4, 6.0, "C", "OS の手書き認識（学習済み）", C.accent4);
  bullets(s, [
    "Android: ML Kit の Digital Ink Recognition。指で書いた線（座標の列）から文字を認識。言語ごとのモデルを端末に落として使う",
    "iOS: Vision の VNRecognizeTextRequest。画像中の文字（手書きを含む）を読む",
    "MNIST の学習は不要。ただし数字 1 文字の分類に特化したものではないので、精度や速さは別に評価が必要",
  ], 0.6, 1.95, 6.0, 3.2, 12);
  head(s, 6.9, 1.4, 5.8, "D", "Termux で EusLisp（手順案）", C.accent3);
  code(s, [
    "$ pkg install git clang make libx11 openblas",
    "$ git clone https://github.com/euslisp/jskeus",
    "$ cd jskeus && make          # aarch64 の設定",
    "$ git clone https://github.com/inabajsk/mnist",
    "$ cd mnist/MATPROD && make",
    "$ eusgl nn.l   ; X なしなら描画の部分を外す",
    "",
    "# Python + ONNX Runtime でも可",
    "$ pkg install python && pip install onnxruntime",
  ].join("\n"), 6.9, 1.95, 5.8, 3.2, 11.5);
  para(s, "Termux では GPU・NPU は使いにくく CPU だけになる。cblaslib.l の OpenBLAS のパスは Termux のライブラリの場所（$PREFIX/lib）に合わせて追加が必要。", 0.6, 5.4, 12.1, 0.9, { fontSize: 12.5, color: C.accent6 });
}

// =====================================================================
section("4. 計測ページ");
{
  const s = slide("SECTION", "実装した計測ページ");
  s.addText("同じ重みの MLP と CNN を、自作 JavaScript と TensorFlow.js（WASM / WebGL / WebGPU / CPU）で動かし、推論と学習の時間を測る", { placeholder: "body" });
  tile(s, 0.9, 2.75, "4", C.accent3, 1.2);
}
{
  const s = slide("CONTENT", "計測ページの構成", "claude.ai の Artifact として公開（非公開・本人のみ）。結果はページのデータベースに保存され、後から読み出してこのスライドに使った。");
  if (fs.existsSync(figp("page_top.png"))) s.addImage({ path: figp("page_top.png"), x: 0.9, y: 1.3, w: 5.5 * 1170 / 3400, h: 5.5, objectName: "page-shot" });
  bullets(s, [
    "読み込み: テスト 10,000 枚・学習 6,000 枚・重み（MLP 7.2 MB, CNN 1.7 MB）。gzip + Base64 で置き、ブラウザの DecompressionStream で展開",
    "端末の情報: CPU のコア数、メモリ、GPU の名前（WebGL）、WebGPU の有無",
    "計測: 方法ごとに MLP・CNN の推論（まとめて / 1 枚ずつ）と学習（バッチ 200, 学習率 0.001, 勾配はバッチ和）",
    "表示: 1 枚あたりの時間と 60,000 枚換算。DGX Spark の値と並べる",
    "保存: 端末名と結果をデータベースへ。複数の端末の結果を一覧",
  ], 3.7, 1.35, 9.0, 2.75, 11.5);
  table(s, [["方法", "推論", "学習", "1 回の量（標準）"],
    ["JavaScript（自作）", "◎", "◎", "推論 1,000 / 学習 600 枚"],
    ["TensorFlow.js WASM", "◎", "MLP のみ（CNN 学習は未対応）", "推論 10,000 / 学習 6,000 枚"],
    ["TensorFlow.js WebGL", "◎", "◎", "推論 10,000 / 学習 6,000 枚"],
    ["TensorFlow.js WebGPU", "◎", "◎", "推論 10,000 / 学習 6,000 枚"],
    ["TensorFlow.js CPU", "◎", "◎", "推論 1,000 / 学習 400（CNN 200）枚"]], 3.7, 4.2, 9.0, [2.4, 0.8, 2.7, 3.1], 11, { rowH: 0.4 });
}
{
  const s = slide("CONTENT", "計測の中身と正しさの確認", "時間は performance.now() で測る。GPU は非同期なので、結果を data() で取り出すまでを時間に含める。最初に 1 回準備運転してから測る。");
  code(s, [
    "// 自作 JS: 行列積 C = A · Bᵀ + b（重みは EusLisp と同じ 出力×入力）",
    "for (i = 0; i < M; i++) for (j = 0; j < N; j++) {",
    "  s = b[j]; for (k = 0; k < K; k++) s += A[i*K+k] * B[j*K+k];",
    "  C[i*N+j] = s; }",
    "",
    "// TensorFlow.js: 畳み込みの重み (co, c·5·5) → [ky, kx, c, co]",
    "tf.conv2d(x /* [n,28,28,1] NHWC */, K1, 1, \"valid\")",
    "// 学習: 損失はバッチの和, SGD 0.001（nn.l と同じ）",
    "tf.losses.softmaxCrossEntropy(t, logits, undefined, 0, tf.Reduction.SUM)",
  ].join("\n"), 0.6, 1.4, 7.4, 3.3, 11.5);
  bullets(s, [
    "重みは EusLisp で学習したもの（MLP: mnist-mlp-19.l, CNN: nn-cnn.l の 20 エポック後）",
    "TensorFlow.js の推論は 10,000 枚で MLP 9824・CNN 9917 枚正解。EusLisp・PyTorch・ONNX Runtime と同じ",
    "自作 JS の MLP は先頭 1,000 枚で 98.3%（Python での計算と一致）",
    "学習は乱数の初期値 U(−0.08, 0.08) から。時間を測るのが目的で、認識率は見ていない",
    "WASM の TensorFlow.js は畳み込みの重みの勾配（Conv2DBackpropFilter）が未実装で、CNN の学習はできなかった",
  ], 8.3, 1.4, 4.45, 5.4, 11.5);
  para(s, "NHWC: 画像の並びを（枚, 縦, 横, チャネル）にすると、EusLisp 版の CNN と同じ順で全結合層につながる。", 0.6, 4.9, 7.4, 0.6, { fontSize: 11.5, color: C.accent6 });
}

// =====================================================================
section("5. 計算時間の比較");
{
  const s = slide("SECTION", "計算時間の比較");
  s.addText("DGX Spark のブラウザ・ネイティブ（OpenBLAS / CUDA / ONNX Runtime）と、スマートフォンのブラウザ", { placeholder: "body" });
  tile(s, 0.9, 2.75, "5", C.accent1, 1.2);
}
function resultSlide(title, R, note) {
  const s = slide("CONTENT", title, note);
  const tasks = ["MLP 推論", "CNN 推論", "MLP 推論 1 枚ずつ", "CNN 推論 1 枚ずつ", "MLP 学習", "CNN 学習"];
  const rows = METHODS.map((m) => [MSHORT[m], ...tasks.map((t) => {
    const r = ofMethod(R, m, t);
    if (!r) return "—";
    return t.includes("1 枚ずつ") ? fmtMs(per(r) * 1000) : fmtS(per(r) * 60000);
  })]);
  table(s, [["方法", "MLP 推論\n6 万枚", "CNN 推論\n6 万枚", "MLP 1 枚\n（応答）", "CNN 1 枚\n（応答）", "MLP 学習\n1 エポック", "CNN 学習\n1 エポック"], ...rows], 0.6, 1.4, 12.1, [2.5, 1.6, 1.6, 1.6, 1.6, 1.6, 1.6], 12.5, { rowH: 0.6 });
  return s;
}
{
  const s = resultSlide("DGX Spark のブラウザ（Chromium）での結果", dgxB, "同じ計測ページを DGX Spark の Chromium（headless, GPU は Vulkan 経由の WebGL）で実行。60,000 枚換算。WebGPU は headless では使えなかった。");
  bullets(s, PH.dgx_notes, 0.6, 5.3, 12.1, 1.6, 12);
}
phones.forEach((p) => {
  const s = resultSlide(`${phoneName(p)} のブラウザでの結果`, p.results, `計測日時 ${new Date(p.when).toLocaleString("ja-JP")}。端末の情報: CPU ${p.info.cores ?? "?"} コア、GPU ${p.info.gpu}、WebGPU ${p.info.webgpu}。60,000 枚換算。`);
  bullets(s, p.notes || [], 0.6, 5.3, 12.1, 1.6, 12);
});
if (!phones.length) {
  const s = slide("CONTENT", "スマートフォンでの結果", "");
  para(s, "スマートフォンでの計測結果はまだありません。計測ページを開いて「計測を始める」を押すと、ここに入ります。", 0.6, 2.0, 12.1, 1.0, { fontSize: 16 });
}
{
  const s = slide("CONTENT", "1 エポックの学習時間 — 環境ごとの比較", "60,000 枚・バッチ 200 の 1 エポック。スマートフォンとブラウザは計測した枚数から換算。対数目盛。");
  const rows = PH.epoch_rows; // [label, mlp, cnn, color]
  s.addChart(pres.charts.BAR, [
    { name: "MLP", labels: rows.map((r) => r[0]), values: rows.map((r) => (r[1] == null ? null : +r[1].toFixed(3))) },
    { name: "CNN", labels: rows.map((r) => r[0]), values: rows.map((r) => (r[2] == null ? null : +r[2].toFixed(3))) },
  ], Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 8.0, h: 5.6, barDir: "bar", catAxisOrientation: "maxMin", chartColors: [HEX.accent6, HEX.accent2],
    valAxisLogScaleBase: 10, valAxisMinVal: 0.01, valAxisMaxVal: 10000, showLegend: true, legendPos: "t", legendFontSize: 11,
    showTitle: true, title: "1 エポック [秒]（対数, 短いほど速い）", catAxisLabelFontSize: 10.5, objectName: "epoch-env",
  }));
  bullets(s, PH.epoch_notes, 8.8, 1.4, 3.95, 5.4, 12);
}
{
  const s = slide("CONTENT", "推論の時間 — まとめて処理と 1 枚ずつ", "まとめて処理 = 1,000 枚ずつ 10,000 枚を認識した 1 枚あたりの時間。1 枚ずつ = 1 枚だけ認識したときの応答時間（中央値）。");
  table(s, [["環境・方法", "MLP まとめて", "CNN まとめて", "MLP 1 枚", "CNN 1 枚"], ...PH.infer_rows.map((r) => [r[0], ...r.slice(1).map((v) => (v == null ? "—" : fmtMs(v)))])],
    0.6, 1.4, 8.2, [3.6, 1.15, 1.15, 1.15, 1.15], 11.5, { rowH: 0.42 });
  bullets(s, PH.infer_notes, 9.1, 1.4, 3.65, 5.4, 12);
}
{
  const s = slide("CONTENT", "考察 — スマートフォンで速さを左右するもの", "");
  const P = PH.discussion; // [[title, text], ...]
  P.forEach(([a, b], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + col * 6.15, y = 1.4 + row * 1.8;
    card(s, x, y, 5.95, 1.65);
    tile(s, x + 0.2, y + 0.2, String(i + 1), [C.accent2, C.accent1, C.accent4, C.accent3, C.accent6, C.text1][i]);
    para(s, [{ text: a, options: { bold: true, fontSize: 14, breakLine: true } }, { text: b, options: { fontSize: 12, color: C.accent6 } }], x + 0.8, y + 0.18, 5.0, 1.4);
  });
}

// =====================================================================
section("6. まとめ");
{
  const s = slide("CONTENT", "追加したファイルと使い方", "計測ページは claude.ai の Artifact として公開済み（リンクは非公開。共有はページの Share から）。");
  code(s, [
    "phone/site/index.html     計測ページ（自作 JS と TensorFlow.js）",
    "phone/site/*.gz.txt       データと重み（gzip + Base64）",
    "phone/site/tfjs/*.wasm    TensorFlow.js の WASM（CDN から直接は読めないので同梱）",
    "phone/make_data.py        EusLisp の出力からデータ・重み・ONNX モデルを作る",
    "phone/onnx/mnist_mlp.onnx, mnist_cnn.onnx   アプリ用モデル（入力 n×1×28×28）",
  ].join("\n"), 0.6, 1.4, 12.1, 2.0, 12.5);
  code(s, [
    "# データとモデルを作り直す（EusLisp で学習した後）",
    "$ roseus nn-cnn.l    ;; (test-mnist-cnn *cnn-net* :save t) で mlp-cuda/mnist-cnn-9.l",
    "$ python3 phone/make_data.py",
    "",
    "# PC で試す（ローカルのサーバー）",
    "$ cd phone/site && python3 -m http.server 8000",
    "#   → http://localhost:8000/ （同じ LAN のスマートフォンからは PC の IP アドレスで）",
  ].join("\n"), 0.6, 3.6, 12.1, 2.6, 12.5);
  para(s, PH.artifact_url ? `計測ページ: ${PH.artifact_url}` : "", 0.6, 6.4, 12.1, 0.4, { fontSize: 12, color: C.accent2 });
}
{
  const s = slide("TITLE_DARK", "まとめ");
  s.addText(PH.conclusion.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < PH.conclusion.length - 1, paraSpaceAfter: 8 } })), { placeholder: "body" });
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  // 日本語（East Asian）フォントをテーマにも設定
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
