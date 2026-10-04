// MNIST × EusLisp 解説スライド生成
const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");
const { applyTheme } = require(process.env.SKILL_DIR + "/scripts/apply_theme.js");

const W = __dirname;
const OUT = process.argv[2] || path.join(W, "mnist_cuda.pptx");
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
pres.title = "MNIST × EusLisp を CUDA で — 接続方法の比較と速度";
pres.author = "Masayuki Inaba";
pres.subject = "MNIST dataset, MLP implementation in EusLisp, profiling and results";
const C = pres.SchemeColor;

// ---------- layouts ----------
const FOOT = "MNIST × EusLisp — CUDA 接続方法の比較";
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

// ---- CUDA 版スライド本体 (build_cuda.js から読み込む) ----
const R = JSON.parse(fs.readFileSync(path.join(W, "cuda.json")));
const x = (a, b, d) => (a / b).toFixed(d === undefined ? 1 : d);
const s2 = (v, d) => Number(v).toFixed(d === undefined ? 2 : d);
const base = R.base;                   // nn.l のループ + OpenBLAS (元の実装) 1エポック
const g64 = R.res.A_epoch64, g32 = R.res.A_epoch32, cpuC = R.res.c_openblas;

// =====================================================================
section("タイトル");
{
  const s = slide("TITLE_DARK", "MNIST × EusLisp を CUDA で\n接続方法の比較と速度");
  s.addText([
    { text: "nn.l（EusLisp + OpenBLAS）の学習を GPU で行うために、EusLisp と CUDA をつなぐ 4 つの方法を実装し、OpenBLAS（cblas）に対する速さを比較", options: { breakLine: true } },
    { text: `計測環境: DGX Spark — ${R.gpu}, CUDA 13.0 / cuBLAS 13.1, PyTorch 2.12, OpenBLAS 0.3.26`, options: { fontSize: 13, color: "8FA3C8" } },
  ], { placeholder: "body" });
  s.addImage({ path: fig("class_samples.png"), x: 0.8, y: 0.6, w: 5.2, h: 5.2 * (10 * 28 + 36) / (20 * 28 + 76), sizing: { type: "crop", x: 0, y: 0, w: 5.2, h: 1.05 }, objectName: "title-digits" });
  s.addText("2026-10-03", { x: 0.8, y: 6.6, w: 4, h: 0.4, fontSize: 12, color: "8FA3C8", margin: 0, isTextBox: true });
}
{
  const s = slide("CONTENT", "概要 — 1エポックの学習時間（バッチ200）", "倍率はすべて、元の nn.l（Lisp のループ + OpenBLAS）の1エポックに対する比。");
  const st = [
    [`${s2(base, 1)} 秒`, "元の nn.l（Lisp + OpenBLAS）\n1エポックの壁時計時間", C.accent6],
    [`×${x(base, R.lispA2, 2)}`, `dgemm だけ GPU に差し替え\n(${s2(R.lispA2, 1)} 秒) — Lisp 側が律速`, C.accent3],
    [`×${x(base, g64, 0)}`, `GPU 常駐・倍精度 FP64\n(${s2(g64, 2)} 秒)`, C.accent2],
    [`×${x(base, g32, 0)}`, `GPU 常駐・単精度 FP32\n(${s2(g32, 3)} 秒)`, C.accent1],
  ];
  const xs = [0.6, 3.7, 6.8, 9.9];
  st.forEach(([b, l, c], i) => {
    card(s, xs[i], 1.45, 2.85, 2.2);
    s.addText(b, { x: xs[i] + 0.2, y: 1.6, w: 2.5, h: 0.95, fontSize: 36, bold: true, color: c, valign: "bottom", margin: 0, isTextBox: true, fit: "shrink" });
    s.addText(l, { x: xs[i] + 0.2, y: 2.65, w: 2.5, h: 0.9, fontSize: 11.5, color: C.accent6, valign: "top", margin: 0, isTextBox: true });
  });
  head(s, 0.6, 4.05, 6, "1", "どこを GPU に移すか", C.text1);
  head(s, 0.6, 4.6, 6, "2", "EusLisp と CUDA の接続方法 4 つ", C.accent2);
  head(s, 0.6, 5.15, 6, "3", "速度の比較（dgemm・1エポック・推論）", C.accent4);
  head(s, 6.9, 4.05, 6, "4", "結果の正しさの確認", C.accent3);
  head(s, 6.9, 4.6, 6, "5", "どの方法を選ぶか・使い方", C.accent1);
  para(s, `同じアルゴリズムを C + OpenBLAS で書いた版は ${s2(cpuC, 1)} 秒（GPU FP64 はその ×${x(cpuC, g64)}、FP32 は ×${x(cpuC, g32, 0)}）。Lisp の処理を減らすだけでも速くなり、残りが GPU の効果。`, 0.6, 5.95, 12.1, 0.8, { fontSize: 12.5, color: C.accent6, italic: true });
}

// =====================================================================
section("1. どこを GPU に移すか");
{
  const s = slide("SECTION", "どこを GPU に移すか");
  s.addText("元の実装の時間の内訳と、GPU に任せる範囲（粒度）の選び方", { placeholder: "body" });
  tile(s, 0.9, 2.75, "1", C.accent6, 1.2);
}
{
  const s = slide("CONTENT", "元の実装で時間がかかっている所", "前回のプロファイル（バッチ200, 1エポック 31.9 秒）の再掲。dgemm は全体の約 1/4 しかない。");
  const items = [["バッチ作成（elt でリストを辿る）", 13.56], ["dgemm（順伝播・逆伝播・勾配）", 8.48], ["dW 配列の確保", 3.51], ["ReLU・要素積・転置などの Lisp/C 処理", 6.37]];
  s.addChart(pres.charts.DOUGHNUT, [{ name: "秒", labels: items.map((d) => d[0]), values: items.map((d) => d[1]) }], Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 6.2, h: 5.5, chartColors: [HEX.accent3, HEX.accent2, HEX.accent6, "A9B4C4"], holeSize: 55,
    showLegend: true, legendPos: "b", legendFontSize: 11, showValue: false, showPercent: true, dataLabelColor: HEX.lt1, dataLabelFontSize: 12, objectName: "orig-breakdown",
  }));
  head(s, 7.1, 1.45, 5.6, "!", "dgemm だけ GPU にしても限界がある", C.accent1);
  bullets(s, [
    "dgemm が 0 秒になっても、残り約 23 秒は Lisp 側の処理",
    "アムダールの法則: 最大でも 31.9 / 23.4 ≒ 1.4 倍",
    "大きく速くするには、バッチ作成・活性化・更新まで GPU に移し、Lisp との往復を減らす必要がある",
  ], 7.1, 2.0, 5.6, 2.4, 13.5);
  head(s, 7.1, 4.5, 5.6, "粒", "GPU に任せる粒度", C.accent2);
  table(s, [["粒度", "Lisp が持つもの", "GPU との通信"],
    ["① 演算ごと", "重み・データ・ループ", "dgemm 毎に行列を転送"],
    ["② バッチごと", "ループだけ", "1 バッチ 1 回の呼び出し"],
    ["③ エポックごと", "設定と結果だけ", "1 エポック 1 回の呼び出し"]], 7.1, 5.05, 5.6, [1.5, 2.0, 2.1], 11.5);
}
{
  const s = slide("CONTENT", "GPU 常駐版の計算の流れ（CUDA/src/cudamlp.cu）", "重み W, b と学習データ 60,000 枚を最初に1回だけ GPU に送り、以降はすべて GPU 上で計算する。");
  const steps = [
    ["準備（1回）", "Lisp の重み W, b と\n60,000 枚を GPU へ転送", C.accent6],
    ["順伝播", "cuBLAS gemm: u = z Wᵀ\nカーネル: +b, ReLU, Softmax", C.accent2],
    ["誤差", "カーネル: δ = y − t\n損失 −log y を加算", C.accent1],
    ["逆伝播", "cuBLAS gemm: δ W\nカーネル: ⊙ (u ≥ 0)", C.accent2],
    ["更新", "cuBLAS gemm で\nW ← W − η δᵀz（β=1）", C.accent4],
  ];
  steps.forEach(([a, b, c], i) => {
    const xx = 0.6 + i * 2.5;
    s.addText(a, { x: xx, y: 1.5, w: 2.2, h: 0.6, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, fill: { color: c }, color: C.background1, fontSize: 15, bold: true, align: "center", valign: "middle", margin: 0, isTextBox: true });
    card(s, xx, 2.2, 2.2, 1.35);
    para(s, b, xx + 0.12, 2.3, 2.0, 1.2, { fontSize: 13 });
    if (i < 4) s.addShape(pres.shapes.RIGHT_ARROW, { x: xx + 2.23, y: 1.65, w: 0.25, h: 0.3, fill: { color: C.text1 }, line: { type: "none" } });
  });
  bullets(s, [
    "バッチは GPU 上のデータ配列の位置（start × 784）を指すだけ → バッチ作成のコピーがなくなる",
    "dW を別に確保せず、gemm の β=1 で W に直接足し込む（W ← −η δᵀz + W）",
    "バイアスの勾配も gemm（1ᵀ δ）で求め、b に直接足し込む",
    "テンプレートで double / float の両方を用意: FP64 は nn.l と同じ精度、FP32 は GB10 で速い",
    "同じ処理を C + OpenBLAS で書いた比較用の版（cpumlp_*）も同じファイルにある",
  ], 0.6, 3.9, 12.1, 2.9, 15);
}

// =====================================================================
section("2. 接続方法の候補");
{
  const s = slide("SECTION", "EusLisp と CUDA の接続方法");
  s.addText("A defforeign + C ライブラリ ／ B C 拡張モジュール（MATPROD 方式）／ C cuBLAS を直接 defforeign ／ D 別プロセス（PyTorch）", { placeholder: "body" });
  tile(s, 0.9, 2.75, "2", C.accent2, 1.2);
}
{
  const s = slide("CONTENT", "4 つの方法の全体像", "A〜D はすべて実装して動かした。E は検討のみ。");
  const M = [
    ["A", "defforeign + C 共有ライブラリ", "cudalib.l → CUDA/<arch>/libcudamlp.so", "C の関数（extern \"C\"）を load-foreign / defforeign で呼ぶ。CUDA カーネルと cuBLAS は .cu に書く", C.text1],
    ["B", "EusLisp C 拡張モジュール", "CUDAPROD/<arch>/libcudaprod.so", "MATPROD と同じ形式。eus.h を使い、Lisp の行列を受けて型・大きさを検査し、Lisp のエラーを出せる", C.accent2],
    ["C", "libcublas.so を直接 defforeign", "cuda-direct.l", "C を書かずに cudaMalloc / cudaMemcpy / cublasDgemm を呼ぶ。GPU のアドレスは整数で持つ", C.accent4],
    ["D", "別プロセス（Python + PyTorch）", "cuda-ipc.l + ipc/torch_server.py", "piped-fork で起動し、標準入出力でバイナリの行列をやりとり。ROS の topic/service でも同じ形", C.accent1],
  ];
  M.forEach(([k, a, f, d, c], i) => {
    const y = 1.4 + i * 1.12;
    tile(s, 0.6, y + 0.12, k, c, 0.6);
    para(s, [{ text: a + "　", options: { bold: true, fontSize: 16 } }, { text: f, options: { fontSize: 11.5, color: C.accent2, fontFace: MONO, breakLine: true } }, { text: d, options: { fontSize: 12.5, color: C.accent6 } }], 1.4, y, 11.3, 1.0);
  });
  card(s, 0.6, 5.95, 12.1, 0.85);
  para(s, [{ text: "E その他: ", options: { bold: true } }, { text: "CPython を libpython ごと埋め込む（GIL・初期化が複雑）、NVRTC で Lisp の文字列からカーネルを実行時コンパイル、GB10 の統合メモリで Lisp の配列を cudaHostRegister して直接読ませる、など" }], 0.8, 6.02, 11.7, 0.75, { fontSize: 12 });
}
{
  const s = slide("CONTENT", "方法 A — defforeign + C 共有ライブラリ（cudalib.l）", "C 側は Lisp のオブジェクトを知らず、double* と long だけを受け取る。");
  code(s, [
    ";; cudalib.l",
    "(setq *cudamlplib* (load-foreign \"CUDA/LinuxARM/libcudamlp.so\"))",
    "(defforeign cuda_dgemm_host *cudamlplib* \"cuda_dgemm_host\" () :integer)",
    "(defforeign cmlp_train_epoch *cudamlplib* \"cmlp_train_epoch\" () :float)",
    "",
    "(defun cuda-dgemm (a b c &optional (alpha 1.0) (beta 1.0))",
    "  (cuda_dgemm_host (array-dimension a 0) (array-dimension b 1)",
    "                   (array-dimension a 1) alpha",
    "                   (a . entity) (b . entity) beta (c . entity))",
    "  c)",
    "",
    "// CUDA/src/cudamlp.cu",
    "extern \"C\" long cuda_dgemm_host(long m, long n, long k,",
    "    double alpha, const double *A, const double *B,",
    "    double beta, double *C) { ... cublasDgemm ... }",
  ].join("\n"), 0.6, 1.4, 7.0, 5.4, 13.5);
  head(s, 7.95, 1.45, 4.8, "+", "良い点", C.accent4);
  bullets(s, [
    "cblaslib.l と同じ書き方。EusLisp のヘッダ不要",
    "nvcc だけでビルドでき、Python などからも同じ .so を使える",
    "カーネルも cuBLAS も自由に書ける",
  ], 7.95, 2.0, 4.8, 1.9, 12.5);
  head(s, 7.95, 4.0, 4.8, "−", "注意点", C.accent1);
  bullets(s, [
    "引数の型・大きさの検査がない。行列の形を間違えると黙って範囲外を読み書きする",
    "エラーは戻り値で返すしかない",
  ], 7.95, 4.55, 4.8, 2.2, 12.5);
}
{
  const s = slide("CONTENT", "方法 B — C 拡張モジュール CUDAPROD（MATPROD 方式）", "load-library でモジュールの初期化関数 ___cudaprod が呼ばれ、defun で Lisp の関数が登録される。計算本体は A と同じ libcudamlp.so。");
  code(s, [
    "/* CUDAPROD/src/cudaprod.c */",
    "#include <eus.h>",
    "pointer CUDADGEMM(register context *ctx, int n, pointer *argv)",
    "{ pointer a = argv[0], b = argv[1], c = argv[2];",
    "  ckarg2(3, 5);",
    "  if (!ismatrix(a) || !ismatrix(b) || !ismatrix(c)) error(E_NOVECTOR);",
    "  if (colsize(a) != rowsize(b) || ...) error(E_VECINDEX);",
    "  cuda_dgemm_host(rowsize(a), colsize(b), colsize(a), alpha,",
    "                  matfv(a), matfv(b), beta, matfv(c));",
    "  return c; }",
    "pointer ___cudaprod(context *ctx, int n, pointer *argv)",
    "{ defun(ctx, \"CUDAPROD-DGEMM\", argv[0], CUDADGEMM, NULL); ... }",
    "",
    ";; Lisp",
    "(load-library \"CUDAPROD/LinuxARM/libcudaprod\" '(\"cudaprod\"))",
    "(cudaprod-dgemm a b c)",
  ].join("\n"), 0.6, 1.4, 7.0, 5.4, 12.5);
  head(s, 7.95, 1.45, 4.8, "+", "良い点", C.accent4);
  bullets(s, [
    "Lisp の行列をそのまま受け、形の誤りを Lisp のエラー（vector dimension mismatch）にできる",
    "結果を Lisp のリストや数で返せる（例: (正解数 損失)）",
    "MATPROD と同じ作り方で、既存の流儀に合う",
  ], 7.95, 2.0, 4.8, 2.3, 12.5);
  head(s, 7.95, 4.4, 4.8, "−", "注意点", C.accent1);
  bullets(s, [
    "eus.h と EusLisp の内部（numunion, makeflt など）に依存。アーキテクチャごとにビルドが必要",
    "速さは A と同じ（呼び出しの手間の差は無視できる）",
  ], 7.95, 4.95, 4.8, 1.85, 12.5);
}
{
  const s = slide("CONTENT", "方法 C — libcublas.so を直接 defforeign（cuda-direct.l）", "cblaslib.l の #+:cublas の部分は handle も GPU メモリも用意していないため動かない。これはその動く版。");
  code(s, [
    "(setq *cublas-lib* (load-foreign \"/usr/local/cuda/lib64/libcublas.so\"))",
    "(defforeign cudaMalloc *cudart-lib* \"cudaMalloc\" () :integer)",
    "(defforeign cublasDgemm_v2 *cublas-lib* \"cublasDgemm_v2\" () :integer)",
    "",
    ";; GPU のアドレスは integer-vector に書いてもらい整数で持つ",
    "(let ((p (integer-vector 0)))",
    "  (cudaMalloc p (* 8 nelem)) (elt p 0))",
    "",
    ";; cuBLAS v2 は alpha, beta をポインタで受ける -> float-vector",
    "(cudaMemcpy da (a . entity) (* 8 m k) 1)   ; host -> device",
    "(cublasDgemm_v2 handle 0 0 n m k (float-vector alpha)",
    "                db n da k (float-vector beta) dc n)",
    "(cudaMemcpy (c . entity) dc (* 8 m n) 2)   ; device -> host",
  ].join("\n"), 0.6, 1.4, 7.0, 5.0, 13);
  head(s, 7.95, 1.45, 4.8, "+", "良い点", C.accent4);
  bullets(s, [
    "C のコードもビルドも不要。Lisp のファイルだけで GPU を使える",
    "cuBLAS / cuFFT / cuSOLVER などライブラリにある処理ならすぐ試せる",
  ], 7.95, 2.0, 4.8, 1.9, 12.5);
  head(s, 7.95, 4.0, 4.8, "−", "注意点", C.accent1);
  bullets(s, [
    "ReLU・softmax などの独自カーネルが書けない → 演算ごとの転送になり、GPU 常駐にできない",
    "アドレスを整数で扱うので、間違えると即クラッシュ",
  ], 7.95, 4.55, 4.8, 2.2, 12.5);
}
{
  const s = slide("CONTENT", "方法 D — 別プロセスの PyTorch（cuda-ipc.l）", "float-vector の中身は (sys:address v)+16 から並ぶので、make-foreign-string でその領域を文字列に見せ、コピーせずにパイプへ書く。");
  code(s, [
    "(setq *ipc* (piped-fork \"python3\" \"ipc/torch_server.py\"))",
    "",
    "(defun fv-bytes (v)   ; float-vector をコピーせずバイト列に",
    "  (make-foreign-string (+ (sys:address v) 16) (* 8 (length v))))",
    "",
    "(defun ipc-dgemm (a b c &optional (alpha 1.0) (beta 1.0))",
    "  (ipc-send-header 1 m n k 1)      ; int64 x 8",
    "  (ipc-write (a . entity)) (ipc-write (b . entity))",
    "  (ipc-write (c . entity))",
    "  (ipc-read (c . entity)))        ; unix:uread で直接書き込む",
    "",
    "# Python 側",
    "A = torch.from_numpy(np.frombuffer(buf)).to('cuda')",
    "C = alpha * (A @ B) + beta * C",
  ].join("\n"), 0.6, 1.4, 7.0, 5.0, 13);
  head(s, 7.95, 1.45, 4.8, "+", "良い点", C.accent4);
  bullets(s, [
    "PyTorch / CuPy / JAX など Python の資産がそのまま使える",
    "GPU 側が落ちても EusLisp は落ちない。別マシンの GPU にも広げられる（ROS topic/service）",
  ], 7.95, 2.0, 4.8, 2.0, 12.5);
  head(s, 7.95, 4.1, 4.8, "−", "注意点", C.accent1);
  bullets(s, [
    "1 回の往復に数〜数十 ms（パイプ転送と Python の処理）。演算ごとに呼ぶと遅い",
    "常駐させて 1 エポック単位で頼めば A と同程度（FP64）",
  ], 7.95, 4.65, 4.8, 2.1, 12.5);
}
{
  const s = slide("CONTENT", "接続方法の比較（まとめ）", "時間は本計測（バッチ200）の値。○△× は筆者の評価。");
  table(s, [
    ["", "A defforeign + C", "B モジュール (CUDAPROD)", "C cuBLAS 直接", "D 別プロセス (PyTorch)"],
    ["必要なもの", "nvcc", "nvcc + eus.h", "なし（Lisp のみ）", "Python + PyTorch"],
    ["独自の CUDA カーネル", "○", "○", "×", "○（PyTorch で）"],
    ["引数の検査・Lisp のエラー", "×", "○", "×", "△（Python 側で）"],
    ["GPU 常駐（重み・データ）", "○", "○", "×（演算ごと）", "○"],
    ["dgemm 1 回 200×1000×1000", `${s2(R.dgemm["200x1000x1000"].A)} ms`, `${s2(R.dgemm["200x1000x1000"].B)} ms`, `${s2(R.dgemm["200x1000x1000"].C)} ms`, `${s2(R.dgemm["200x1000x1000"].D, 1)} ms`],
    ["nn.l のまま dgemm 差し替え 1エポック", `${s2(R.lisp.A, 1)} 秒`, `${s2(R.lisp.B, 1)} 秒`, `${s2(R.lisp.C, 1)} 秒`, `${s2(R.lisp.D, 1)} 秒`],
    ["GPU 常駐 1エポック FP64", hl(`${s2(R.res.A_epoch64, 2)} 秒`), `${s2(R.res.B64, 2)} 秒`, "—", `${s2(R.res.D64, 2)} 秒`],
    ["GPU 常駐 1エポック FP32", hl(`${s2(R.res.A_epoch32, 3)} 秒`), `${s2(R.res.B32, 3)} 秒`, "—", `${s2(R.res.D32, 3)} 秒`],
    ["向いている使い方", "速さ重視の本体", "EusLisp に組み込む部品", "手軽な試し", "Python の資産・分離"],
  ], 0.6, 1.4, 12.1, [2.9, 2.3, 2.4, 2.1, 2.4], 12.5, { rowH: 0.47 });
  para(s, `参考: 元の nn.l（OpenBLAS）は dgemm 1回 ${s2(R.dgemm["200x1000x1000"].cblas)} ms、1エポック ${s2(R.lisp.cblas, 1)} 秒（差し替えと同じ計測回）／ ${s2(base, 1)} 秒（常駐と同じ計測回）。`, 0.6, 6.45, 12.1, 0.4, { fontSize: 12, color: C.accent6 });
}

// =====================================================================
section("3. 速度の比較");
{
  const s = slide("SECTION", "速度の比較");
  s.addText("dgemm 1 回 ／ nn.l のループのまま ／ GPU 常駐 ／ バッチサイズ ／ 推論", { placeholder: "body" });
  tile(s, 0.9, 2.75, "3", C.accent4, 1.2);
}
{
  const s = slide("CONTENT", "dgemm 1 回の時間（転送込み）", "20回の平均。GPU の値は host→GPU→host の転送を含む。D はパイプでの往復と Python の処理を含む。");
  const shapes = ["200x784x1000", "200x1000x1000", "1000x200x1000"];
  const lbl = ["順伝播 層1\n200×784·784×1000", "順伝播 層2\n200×1000·1000×1000", "勾配 dW\n1000×200·200×1000"];
  const meth = [["cblas", "OpenBLAS（元）", HEX.accent6], ["A", "A defforeign", HEX.dk1], ["B", "B モジュール", HEX.accent2], ["C", "C cuBLAS 直接", HEX.accent4], ["D", "D PyTorch 別プロセス", HEX.accent1]];
  s.addChart(pres.charts.BAR, meth.map(([k, n]) => ({ name: n, labels: lbl, values: shapes.map((sh) => +R.dgemm[sh][k].toFixed(2)) })), Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 8.2, h: 5.5, barDir: "col", barGrouping: "clustered", chartColors: meth.map((m) => m[2]),
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 9, dataLabelColor: HEX.dk1, dataLabelFormatCode: "0.0",
    showLegend: true, legendPos: "b", legendFontSize: 11, showTitle: true, title: "1 回あたり [ms]（小さいほど速い）", valAxisHidden: true, valGridLine: { style: "none" }, catAxisLabelFontSize: 10, objectName: "dgemm-chart",
  }));
  const sh = "200x1000x1000";
  stat(s, 9.1, 1.4, 3.7, `×${x(R.dgemm[sh].cblas, R.dgemm[sh].A)}`, "A/B/C は OpenBLAS より速い\n（200×1000×1000, 転送込み）", C.accent2);
  stat(s, 9.1, 3.05, 3.7, `${s2(R.dgemm[sh].D, 0)} ms`, `D は 1 回 ${x(R.dgemm[sh].D, R.dgemm[sh].A, 0)} 倍遅い。\n演算ごとに呼ぶ用途には向かない`, C.accent1);
  para(s, "A・B・C は中で同じ cuBLAS を呼ぶので差はほぼない（Lisp からの呼び出しの手間は 0.1 ms 未満）。", 9.1, 4.85, 3.7, 1.5, { fontSize: 12.5 });
}
{
  const s = slide("CONTENT", "nn.l のループのまま dgemm だけ差し替えた 1 エポック", "test-mnist-batch-lisp（nn.l の test-mnist-batch と同じループ、モデル保存なし）で cblas-dgemm を置き換えて計測。");
  const meth = [["cblas", "OpenBLAS（元）"], ["A", "A defforeign"], ["B", "B モジュール"], ["C", "C cuBLAS 直接"], ["D", "D PyTorch 別プロセス"]];
  s.addChart(pres.charts.BAR, [{ name: "秒", labels: meth.map((m) => m[1]), values: meth.map((m) => +R.lisp[m[0]].toFixed(1)) }], Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 7.4, h: 5.4, barDir: "bar", catAxisOrientation: "maxMin", chartColors: [HEX.accent6, HEX.dk1, HEX.accent2, HEX.accent4, HEX.accent1],
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 11, dataLabelColor: HEX.dk1, dataLabelFormatCode: "0.0", showLegend: false,
    showTitle: true, title: "1 エポック（300 バッチ）の壁時計時間 [s]", valAxisHidden: true, valGridLine: { style: "none" }, catAxisLabelFontSize: 12, objectName: "lisp-loop-chart",
  }));
  stat(s, 8.4, 1.4, 4.3, `×${x(R.lisp.cblas, R.lisp.A, 2)}`, "dgemm を GPU にしたときの速さ。\n約 2 割しか短くならない", C.accent3);
  bullets(s, [
    "残りはバッチ作成（リストの elt）・dW の確保・ReLU・転置など Lisp 側の処理",
    "D は 1 バッチ 7 回の dgemm がすべてパイプ往復になり、元より遅い",
    "→ GPU の効果を出すには、ループごと GPU に移す（次のスライド）",
  ], 8.4, 3.2, 4.3, 3.5, 13);
}
{
  const s = slide("CONTENT", "GPU 常駐の 1 エポック（バッチ200）— 元の nn.l との比較", "3 回の最小値。「C + OpenBLAS」は GPU 版と同じアルゴリズムを C で書き OpenBLAS で計算したもの（CPU での上限の目安）。");
  const rows = [
    ["元の nn.l（Lisp + OpenBLAS）", base],
    ["C + OpenBLAS（CPU）", cpuC],
    ["A FP64（エポックを C で回す）", R.res.A_epoch64],
    ["A FP64（バッチのループは Lisp）", R.res.A_loop64],
    ["B モジュール FP64", R.res.B64],
    ["D PyTorch FP64", R.res.D64],
    ["A FP32（エポックを C で回す）", R.res.A_epoch32],
    ["A FP32（バッチのループは Lisp）", R.res.A_loop32],
    ["B モジュール FP32", R.res.B32],
    ["D PyTorch FP32", R.res.D32],
  ];
  table(s, [["方法", "1エポック", "元の nn.l 比", "C+OpenBLAS 比"], ...rows.map(([n, v], i) => {
    const r = [n, v < 1 ? `${s2(v, 3)} 秒` : `${s2(v, 2)} 秒`, `×${x(base, v, v < 1 ? 0 : 1)}`, `×${x(cpuC, v, v < 1 ? 0 : 1)}`];
    return i === 2 || i === 6 ? r.map(hl) : r;
  })], 0.6, 1.4, 7.6, [3.7, 1.3, 1.3, 1.3], 12, { rowH: 0.43 });
  stat(s, 8.6, 1.4, 4.1, `×${x(base, g64, 0)}`, "GPU FP64（元の nn.l 比）\nnn.l と同じ倍精度で同じ結果", C.accent2);
  stat(s, 8.6, 3.0, 4.1, `×${x(base, g32, 0)}`, "GPU FP32（元の nn.l 比）\n認識率は FP64 とほぼ同じ", C.accent1);
  bullets(s, [
    "FP64 では A・B・D の差がない → GB10 の FP64 演算性能で頭打ち",
    "FP32 では Lisp や Python からの呼び出し回数の差が見える（D は 1 バッチごとに Python の処理が入る）",
  ], 8.6, 4.7, 4.1, 2.1, 12);
}
{
  const s = slide("CONTENT", "バッチサイズを変えたときの 1 エポックの時間", "学習率は合計の勾配に掛けるので、バッチを変えると学習の進み方も変わる（ここでは時間だけを比較）。");
  const bss = ["50", "100", "200", "500", "1000"];
  s.addChart(pres.charts.LINE, [
    { name: "C + OpenBLAS", labels: bss, values: bss.map((b) => +R.sweep[b].cpu.toFixed(3)) },
    { name: "GPU FP64", labels: bss, values: bss.map((b) => +R.sweep[b].g64.toFixed(3)) },
    { name: "GPU FP32", labels: bss, values: bss.map((b) => +R.sweep[b].g32.toFixed(3)) },
  ], Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 7.8, h: 5.5, chartColors: [HEX.accent6, HEX.accent2, HEX.accent1], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 7,
    valAxisLogScaleBase: 10, valAxisMinVal: 0.01, valAxisMaxVal: 100, showLegend: true, legendPos: "t", legendFontSize: 12,
    showCatAxisTitle: true, catAxisTitle: "バッチサイズ", catAxisTitleColor: HEX.accent6, catAxisTitleFontSize: 11,
    showValAxisTitle: true, valAxisTitle: "1エポック [s]（対数）", valAxisTitleColor: HEX.accent6, valAxisTitleFontSize: 11, objectName: "sweep-chart",
  }));
  table(s, [["バッチ", "C+OpenBLAS", "GPU FP64", "GPU FP32"], ...bss.map((b) => [b, `${s2(R.sweep[b].cpu, 2)}`, `${s2(R.sweep[b].g64, 2)}`, `${s2(R.sweep[b].g32, 3)}`])], 8.6, 1.4, 4.15, [0.75, 1.3, 1.0, 1.1], 11.5);
  bullets(s, [
    "FP32 はバッチが大きいほど速い（行列が大きいほど GPU が埋まる）",
    "FP64 はどのバッチでも約 1.5 秒（演算性能で頭打ち）",
  ], 8.7, 4.2, 4.0, 2.5, 12.5);
}
{
  const s = slide("CONTENT", "推論（テスト 10,000 枚）と準備の時間", "保存済みモデル mlp/mnist-mlp-19.l を使用。Lisp はバッチ200 ずつ（10,000 行をまとめると msoftmax の free バグで落ちるため）。");
  const I = R.infer;
  table(s, [
    ["方法", "10,000 枚", "1 枚あたり", "正解数"],
    ["Lisp + OpenBLAS（バッチ200）", `${s2(I.lisp_cblas, 3)} 秒`, `${s2(I.lisp_cblas * 0.1, 3)} ms`, String(I.ok)],
    ["Lisp + A の dgemm（バッチ200）", `${s2(I.lisp_A, 3)} 秒`, `${s2(I.lisp_A * 0.1, 3)} ms`, String(I.ok)],
    [hl("A GPU 常駐 FP64"), hl(`${s2(I.A64 * 1000, 1)} ms`), hl(`${s2(I.A64 * 0.1, 4)} ms`), hl(String(I.ok))],
    ["A GPU 常駐 FP32", `${s2(I.A32 * 1000, 1)} ms`, `${s2(I.A32 * 0.1, 4)} ms`, String(I.ok)],
    ["D PyTorch FP64", `${s2(I.D64 * 1000, 1)} ms`, `${s2(I.D64 * 0.1, 4)} ms`, String(I.ok)],
    ["D PyTorch FP32", `${s2(I.D32 * 1000, 1)} ms`, `${s2(I.D32 * 0.1, 4)} ms`, String(I.ok)],
  ], 0.6, 1.4, 7.6, [3.4, 1.4, 1.5, 1.3], 12.5, { rowH: 0.45 });
  stat(s, 8.6, 1.4, 4.1, `×${x(I.lisp_cblas, I.A32, 0)}`, "推論の速さ（Lisp + OpenBLAS 比, FP32）", C.accent1);
  head(s, 8.6, 3.2, 4.1, "準", "準備（重み＋60,000 枚の転送）", C.accent6);
  bullets(s, [
    `A: ${s2(R.setup.A, 1)} 秒（Lisp のリスト → 行列 → GPU）`,
    `D: ${s2(R.setup.D, 1)} 秒（パイプで約 380 MB を送る）`,
    "どちらも最初に 1 回だけ。20 エポックの学習なら十分小さい",
  ], 8.6, 3.75, 4.1, 2.6, 12.5);
}

// =====================================================================
section("4. 結果の正しさ");
{
  const s = slide("SECTION", "結果の正しさの確認");
  s.addText("同じ初期値から学習して重みが一致するか、20 エポックの認識率の推移が同じか", { placeholder: "body" });
  tile(s, 0.9, 2.75, "4", C.accent3, 1.2);
}
{
  const s = slide("CONTENT", "数値の一致と、見つかった nn.l の初期化の問題", "初期値は make-mnist-mlp で乱数の初期状態 #i(123456 789012) から作るので、nn.l と同じ重みから始まる。");
  head(s, 0.6, 1.45, 6, "=", "同じ初期値から 50 バッチ学習した後の重みの差", C.accent4);
  table(s, [["層", "|W_Lisp − W_C+OpenBLAS|", "|W_Lisp − W_GPU FP64|", "|W_Lisp|"],
    ["W₁", "1.8×10⁻¹⁴", "4.1×10⁻¹⁵", "41.0"], ["W₂", "2.7×10⁻¹⁴", "5.0×10⁻¹⁵", "46.2"], ["W₃", "3.1×10⁻¹⁵", "3.0×10⁻¹⁵", "5.2"]], 0.6, 2.0, 6.1, [0.7, 1.9, 1.9, 1.6], 12);
  para(s, "→ 丸め誤差の範囲で一致。dgemm 単体も 4 方法すべて OpenBLAS と差 1×10⁻¹² 以下。", 0.6, 3.6, 6.1, 0.6, { fontSize: 12.5 });
  head(s, 7.0, 1.45, 5.7, "!", "nn.l の Perceptron :init の問題", C.accent1);
  code(s, "(setq W (make-matrix out-dim in-dim))\n(setq Wt (transpose W))   ; ← W はまだ 0\n(dotimes (i ...) (dotimes (j ...)\n  (setf (aref W i j) (- (random 0.16) 0.08))))", 7.0, 2.0, 5.7, 1.55, 11.5);
  bullets(s, [
    "Wt を乱数で埋める前の W から作るので、最初の 1 バッチだけ重み 0 で順伝播する（損失 = ln 10 = 2.3026）",
    "2 バッチ目からは更新後の W から Wt を作り直すので、影響は小さい（20 エポック後のテスト 98.24% → 98.22%）",
    "比較のときは Lisp 側の Wt を (transpose W) に直して一致を確認した",
    "直し方: Wt の行を乱数の後ろに移す",
  ], 7.0, 3.75, 5.7, 3.0, 12);
  head(s, 0.6, 4.45, 6, "≡", "GPU 版は修正後の正しい初期化で計算", C.text1);
  para(s, "cuda-mlp-create は W から計算するので Wt の問題の影響を受けない。そのため元の保存済みモデル（mlp/）とは最初の 1 バッチ分だけ経過が異なる。", 0.6, 5.0, 6.1, 1.2, { fontSize: 12.5, color: C.accent6 });
}
{
  const s = slide("CONTENT", "20 エポックのテスト認識率の推移", "元の学習は mlp/mnist-mlp-*.l の評価値。GPU FP64・FP32、PyTorch FP64 は今回 GPU で学習したもの。");
  const lab = R.orig.map((v, i) => String(i + 1));
  s.addChart(pres.charts.LINE, [
    { name: "元の nn.l", labels: lab, values: R.orig.map((v) => +(v / 100).toFixed(2)) },
    { name: "GPU FP64", labels: lab, values: R.train20.g64.map((r) => +(r[3] / 100).toFixed(2)) },
    { name: "GPU FP32", labels: lab, values: R.train20.g32.map((r) => +(r[3] / 100).toFixed(2)) },
    { name: "PyTorch FP64", labels: lab, values: R.train20.t64.map((r) => +(r[3] / 100).toFixed(2)) },
  ], Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 8.0, h: 5.5, chartColors: [HEX.accent6, HEX.accent2, HEX.accent1, HEX.accent4], lineSize: 2, lineDataSymbol: "circle", lineDataSymbolSize: 5,
    valAxisMinVal: 94, valAxisMaxVal: 99, valAxisMajorUnit: 1, showLegend: true, legendPos: "t", legendFontSize: 11,
    showCatAxisTitle: true, catAxisTitle: "エポック", catAxisTitleColor: HEX.accent6, catAxisTitleFontSize: 11,
    showValAxisTitle: true, valAxisTitle: "テスト認識率 [%]", valAxisTitleColor: HEX.accent6, valAxisTitleFontSize: 11, objectName: "acc20-chart",
  }));
  const lastOf = (a) => a[a.length - 1];
  table(s, [["", "20 エポック後", "20 エポックの時間"],
    ["元の nn.l", `${(R.orig[19] / 100).toFixed(2)}%`, `約 ${s2(base * 20 / 60, 0)} 分（計算のみ）`],
    ["GPU FP64", `${(lastOf(R.train20.g64)[3] / 100).toFixed(2)}%`, `${s2(R.train20.g64.reduce((a, r) => a + r[2], 0), 1)} 秒`],
    ["GPU FP32", `${(lastOf(R.train20.g32)[3] / 100).toFixed(2)}%`, `${s2(R.train20.g32.reduce((a, r) => a + r[2], 0), 1)} 秒`],
    ["PyTorch FP64", `${(lastOf(R.train20.t64)[3] / 100).toFixed(2)}%`, `${s2(R.train20.t64.reduce((a, r) => a + r[2], 0), 1)} 秒`]], 8.8, 1.4, 3.95, [1.3, 1.25, 1.4], 11.5);
  para(s, "GPU FP64 と PyTorch FP64 は同じ計算なので同じ推移。FP32 にしても認識率はほとんど変わらない。", 8.8, 4.2, 3.95, 1.5, { fontSize: 12.5 });
}
{
  const s = slide("CONTENT", "なぜ FP64 と FP32 でこれほど差があるか — GB10 の演算性能", "PyTorch で 4096×4096 の行列積を測った値（実効性能）。");
  s.addChart(pres.charts.BAR, [{ name: "TFLOPS", labels: ["CPU OpenBLAS FP64\n(numpy 4096²)", "GB10 FP64", "GB10 FP32", "GB10 TF32"], values: [+(R.peak.cpu64).toFixed(2), +(R.peak.fp64).toFixed(2), +(R.peak.fp32).toFixed(1), +(R.peak.tf32).toFixed(1)] }], Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 7.0, h: 5.4, barDir: "col", chartColors: [HEX.accent6, HEX.accent2, HEX.accent1, HEX.accent3], showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 12, dataLabelColor: HEX.dk1, dataLabelFormatCode: "0.00",
    showLegend: false, showTitle: true, title: "行列積の実効性能 [TFLOPS]", valAxisHidden: true, valGridLine: { style: "none" }, catAxisLabelFontSize: 11, objectName: "peak-chart",
  }));
  bullets(s, [
    `GB10 の FP64 は FP32 の約 1/${x(R.peak.fp32, R.peak.fp64, 0)}。科学計算向けの GPU（H100 など）と違い FP64 が弱い`,
    `それでも CPU（OpenBLAS）の約 ${x(R.peak.fp64, R.peak.cpu64, 0)} 倍あるので、FP64 でも速くなる`,
    "MNIST の学習は FP32 で十分な精度 → FP32 を使うのが実用的",
    "TF32（Tensor Core）を使えばさらに速くなるが、今回の規模では呼び出しの手間が先に効く",
  ], 7.9, 1.5, 4.8, 5.2, 13);
}

// =====================================================================
section("5. まとめ");
{
  const s = slide("CONTENT", "どの方法を選ぶか", "");
  const P = [
    ["A", "速さを求めるなら A（defforeign + C）", "ループごと GPU に置けて一番速い。cblaslib.l と同じ書き方で、EusLisp の内部に依存しない", C.text1],
    ["B", "EusLisp に部品として組み込むなら B（CUDAPROD）", "MATPROD と同じ流儀。行列の形の誤りを Lisp のエラーにでき、結果を Lisp のオブジェクトで返せる。速さは A と同じ", C.accent2],
    ["C", "とりあえず試すなら C（cuBLAS 直接）", "Lisp だけで動く。ただし独自カーネルが書けず演算ごとの転送になるので、nn.l では約 2 割しか速くならない", C.accent4],
    ["D", "Python の資産を使う・プロセスを分けるなら D", "PyTorch に任せれば実装は短い。往復が数〜数十 ms なので、エポック単位など大きな単位で頼む", C.accent1],
  ];
  P.forEach(([k, a, b, c], i) => {
    const y = 1.4 + i * 1.3;
    card(s, 0.6, y, 12.1, 1.15);
    tile(s, 0.8, y + 0.25, k, c, 0.6);
    para(s, [{ text: a, options: { bold: true, fontSize: 16, breakLine: true } }, { text: b, options: { fontSize: 12.5, color: C.accent6 } }], 1.6, y + 0.12, 10.9, 0.95);
  });
  para(s, "共通の教訓: GPU の効果を出すには、演算だけでなくデータとループも GPU に置き、Lisp との往復を減らすこと。", 0.6, 6.6, 12.1, 0.4, { fontSize: 13, bold: true, color: C.accent1 });
}
{
  const s = slide("CONTENT", "追加したファイルと使い方", "既存の nn.l・mlp/ のモデルは変更していない。GPU で学習したモデルは :save t のとき mlp-cuda/ に保存する。");
  code(s, [
    "CUDA/src/cudamlp.cu   GPU 計算本体 (cuBLAS + カーネル, FP64/FP32) と C+OpenBLAS 版",
    "CUDA/Makefile         → CUDA/LinuxARM/libcudamlp.so",
    "cudalib.l             方法 A: defforeign の定義と Lisp の関数",
    "CUDAPROD/src/cudaprod.c, Makefile   方法 B: MATPROD 形式のモジュール",
    "cuda-direct.l         方法 C: libcublas.so を直接 defforeign",
    "cuda-ipc.l, ipc/torch_server.py     方法 D: PyTorch 別プロセス",
    "nn-cuda.l             学習・テストの関数 (nn.l を読み込む)",
    "bench-cuda.l          本スライドの計測 (RESULT 行を出力)",
  ].join("\n"), 0.6, 1.4, 12.1, 2.55, 13.5);
  code(s, [
    "$ (cd CUDA; make) && (cd CUDAPROD; make)",
    "$ roseus nn-cuda.l",
    "$ (test-mnist-batch-cuda 200)                 ;; GPU 常駐 FP64 で 20 エポック",
    "$ (test-mnist-batch-cuda 200 :precision 32)   ;; FP32",
    "$ (test-mnist-batch-lisp 200 :dgemm :cuda)    ;; nn.l のループのまま dgemm だけ GPU",
    "$ (test-mnist-cuda-test)                      ;; mlp/mnist-mlp-19.l を GPU で認識",
    "$ irteusgl bench-cuda.l                       ;; 接続方法の比較 (約 10 分)",
  ].join("\n"), 0.6, 4.15, 12.1, 2.6, 13.5);
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
