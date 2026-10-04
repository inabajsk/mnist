// MNIST × EusLisp 解説スライド生成
const pptxgen = require("pptxgenjs");
const fs = require("fs");
const path = require("path");
const { applyTheme } = require(process.env.SKILL_DIR + "/scripts/apply_theme.js");

const W = __dirname;
const OUT = process.argv[2] || path.join(W, "mnist_euslisp.pptx");
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
pres.title = "MNIST 手書き数字認識 — EusLisp + OpenBLAS 実装の解説";
pres.author = "Masayuki Inaba";
pres.subject = "MNIST dataset, MLP implementation in EusLisp, profiling and results";
const C = pres.SchemeColor;

// ---------- layouts ----------
const FOOT = "MNIST 手書き数字認識 — EusLisp + OpenBLAS 実装";
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

const last = ev[ev.length - 1];

// =====================================================================
section("タイトル");
{
  const s = slide("TITLE_DARK", "MNIST 手書き数字認識\nEusLisp + OpenBLAS による多層パーセプトロン");
  s.addText([
    { text: "原論文・データセットの出典から、本リポジトリの実装・NN構成・処理時間プロファイル・学習経過・認識テスト結果、使用した全70,000枚の画像まで", options: { breakLine: true } },
    { text: "対象: ~/mnist（nn.l / mnist.l / mnist-draw.l / cblaslib.l / MATPROD）　計測環境: DGX Spark (aarch64, 20コア), OpenBLAS 0.3.26 (64bit-int, pthread)", options: { fontSize: 13, color: "8FA3C8" } },
  ], { placeholder: "body" });
  // pixel motif: 16 test digits strip
  s.addImage({ path: fig("class_samples.png"), x: 0.8, y: 0.6, w: 5.2, h: 5.2 * (10 * 28 + 36) / (20 * 28 + 76), sizing: { type: "crop", x: 0, y: 0, w: 5.2, h: 1.05 }, objectName: "title-digits" });
  s.addText("2026-10-02", { x: 0.8, y: 6.6, w: 4, h: 0.4, fontSize: 12, color: "8FA3C8", margin: 0, isTextBox: true });
}

{
  const s = slide("CONTENT", "概要 — 4つの数字で見る本実装", "このスライドは全体のまとめ。詳細は後続スライド。");
  const xs = [0.6, 3.7, 6.8, 9.9];
  const st = [
    ["70,000", "使用画像数\n学習 60,000 ＋ テスト 10,000（MNIST全数）", C.text1],
    ["784-1000-1000-10", "全結合NN（ReLU×2, Softmax）\nパラメータ 1,796,010 個", C.accent2],
    [pct(last.test_acc), `テスト認識率（20エポック後）\n誤り ${last.test_err} / 10,000 枚`, C.accent1],
    [`${fmt(prof.epoch.wall, 0)} 秒`, `1エポック学習の実測壁時計時間\n(バッチ200, 300回更新)`, C.accent4],
  ];
  st.forEach(([b, l, c], i) => {
    card(s, xs[i], 1.45, 2.85, 2.2);
    s.addText(b, { x: xs[i] + 0.2, y: 1.6, w: 2.5, h: 0.95, fontSize: i === 1 ? 20 : 34, bold: true, color: c, valign: "bottom", margin: 0, isTextBox: true, fit: "shrink" });
    s.addText(l, { x: xs[i] + 0.2, y: 2.65, w: 2.5, h: 0.9, fontSize: 11.5, color: C.accent6, valign: "top", margin: 0, isTextBox: true });
  });
  head(s, 0.6, 4.05, 6, "1", "MNISTとは（出典・内容・ダウンロード）", C.text1);
  head(s, 0.6, 4.6, 6, "2", "本リポジトリの実装とNN構成", C.accent2);
  head(s, 0.6, 5.15, 6, "3", "処理時間プロファイル", C.accent4);
  head(s, 6.9, 4.05, 6, "4", "学習方法と学習経過（20エポック）", C.accent3);
  head(s, 6.9, 4.6, 6, "5", "認識テスト結果・誤認識の全画像", C.accent1);
  head(s, 6.9, 5.15, 6, "6", "使用した手書き画像 全70,000枚（付録）", C.accent6);
  para(s, "数値はすべて本リポジトリのコードとデータを実際に実行・解析して得た値（2026-10-02 計測）。", 0.6, 6.05, 12, 0.4, { fontSize: 12, color: C.accent6, italic: true });
}

// =====================================================================
section("1. MNISTとは");
{
  const s = slide("SECTION", "MNISTとは");
  s.addText("原論文・出典・データの作り方・ファイル形式・ダウンロード先・ベンチマーク", { placeholder: "body" });
  tile(s, 0.9, 2.75, "1", C.accent1, 1.2);
}
{
  const s = slide("CONTENT", "原論文と出典", "MNISTの初出はLeCunら1998年のProc. IEEE論文。データセット自体はLeCun, Cortes, Burgesが公開。");
  card(s, 0.6, 1.4, 6.3, 2.55);
  head(s, 0.85, 1.6, 6, "論", "原論文（MNIST の初出）", C.text1);
  para(s, [
    { text: "Y. LeCun, L. Bottou, Y. Bengio, P. Haffner", options: { bold: true, breakLine: true } },
    { text: "“Gradient-Based Learning Applied to Document Recognition”", options: { italic: true, breakLine: true } },
    { text: "Proceedings of the IEEE, vol. 86, no. 11, pp. 2278–2324, Nov. 1998", options: { breakLine: true } },
    { text: "DOI: 10.1109/5.726791", options: { color: C.accent2 } },
  ], 0.85, 2.15, 5.9, 1.7, { fontSize: 13.5 });
  card(s, 0.6, 4.15, 6.3, 2.6);
  head(s, 0.85, 4.35, 6, "D", "データセットの公開元", C.accent2);
  para(s, [
    { text: "Y. LeCun, C. Cortes, C. J. C. Burges", options: { bold: true, breakLine: true } },
    { text: "“The MNIST database of handwritten digits”", options: { italic: true, breakLine: true } },
    { text: "http://yann.lecun.com/exdb/mnist/", options: { color: C.accent2, breakLine: true } },
    { text: "MNIST = Modified NIST。米国標準技術研究所（NIST）の手書き文字データベースを再構成したもの", options: { fontSize: 12, color: C.accent6 } },
  ], 0.85, 4.9, 5.9, 1.8, { fontSize: 13.5 });
  head(s, 7.3, 1.45, 5.4, "内", "原論文の主な内容", C.accent1);
  bullets(s, [
    "勾配法で学習する畳み込みニューラルネット（CNN）を提案 — LeNet-5",
    ["入力32×32 → C1(6@28×28) → S2 → C3(16@10×10) → S4 → C5(120) → F6(84) → 出力10（RBF）"],
    ["局所受容野・重み共有・サブサンプリングにより、位置ずれや変形に頑健"],
    "MNIST を構築し、線形分類器・k-NN・SVM・多層NN・LeNet 系を同一条件で比較",
    ["LeNet-5 誤り率 0.95%、変形データ拡張で 0.8%、Boosted LeNet-4 で 0.7%"],
    "複数モジュールを大域的に学習する Graph Transformer Networks（GTN）",
    "小切手読み取りシステムへの実用化（NCR社、1日数百万枚規模）",
  ], 7.3, 2.0, 5.4, 4.8, 13);
}
{
  const s = slide("CONTENT", "データセットの作り方 — NIST SD-3 / SD-1 から 28×28 へ", "SD-3は国勢調査局職員、SD-1は高校生が書いたもの。両者を半々に混ぜて学習・テストを作った点がMNISTの要点。");
  // flow diagram
  const bx = [0.6, 3.45, 6.3, 9.15];
  const lbl = [
    ["NIST SD-3", "米国国勢調査局の職員が記入\n（きれいで読みやすい）"],
    ["NIST SD-1", "高校生が記入\n（くせが強く難しい）"],
  ];
  card(s, 0.6, 1.45, 2.6, 1.15, "E3ECF7"); para(s, [{ text: lbl[0][0], options: { bold: true, fontSize: 15, breakLine: true } }, { text: lbl[0][1], options: { fontSize: 11, color: C.accent6 } }], 0.75, 1.52, 2.35, 1.05);
  card(s, 0.6, 2.75, 2.6, 1.15, "FBE7DF"); para(s, [{ text: lbl[1][0], options: { bold: true, fontSize: 15, breakLine: true } }, { text: lbl[1][1], options: { fontSize: 11, color: C.accent6 } }], 0.75, 2.82, 2.35, 1.05);
  const steps = [
    ["① 2値画像を切り出し", "1文字ずつの白黒画像"],
    ["② 20×20 に正規化", "縦横比を保って拡縮\nアンチエイリアスで256階調化"],
    ["③ 28×28 に配置", "画素の重心が中心に\nくるよう平行移動"],
  ];
  steps.forEach(([a, b], i) => {
    const x = 3.75 + i * 3.05;
    s.addShape(pres.shapes.RIGHT_ARROW, { x: x - 0.42, y: 2.45, w: 0.35, h: 0.3, fill: { color: C.accent6 }, line: { type: "none" } });
    card(s, x, 1.45, 2.75, 2.45);
    para(s, [{ text: a, options: { bold: true, fontSize: 14.5, breakLine: true } }, { text: b, options: { fontSize: 11.5, color: C.accent6 } }], x + 0.15, 1.6, 2.5, 2.2);
  });
  s.addImage({ path: fig("digit_zoom.png"), x: 10.5, y: 2.3, w: 1.55, h: 1.55, objectName: "digit-zoom" });
  head(s, 0.6, 4.25, 6, "学", "学習セット 60,000 枚", C.text1);
  bullets(s, [
    "SD-3 から 30,000 枚 ＋ SD-1 から 30,000 枚",
    "書き手は約 250 人（テストの書き手とは重複なし）",
  ], 1.15, 4.75, 5.6, 1.1, 13.5);
  head(s, 6.9, 4.25, 6, "試", "テストセット 10,000 枚", C.accent1);
  bullets(s, [
    "SD-3 から 5,000 枚 ＋ SD-1 から 5,000 枚",
    "元は 60,000 枚あったが公開は 10,000 枚のみ（残りは後に QMNIST が復元）",
  ], 7.45, 4.75, 5.3, 1.1, 13.5);
  para(s, "画素値: 0 = 背景、255 = 筆跡（インク）。クラスは 0〜9 の10種。右上図は本データのテスト画像 #0（ラベル6）を 28×28 画素で拡大表示", 0.6, 6.15, 12.1, 0.6, { fontSize: 12, color: C.accent6 });
}
{
  const s = slide("CONTENT", "ファイル形式（IDX）とダウンロード先", "本スライドのサイズとMD5は、2026-10-02 に Google Cloud のミラーから実際にダウンロードして確認した値。");
  table(s, [
    ["ファイル", "内容", "gzipサイズ (byte)", "MD5 (gz)"],
    ["train-images-idx3-ubyte.gz", "学習画像 60,000×28×28", "9,912,422", "f68b3c2dcbeaaa9fbdd348bbdeb94873"],
    ["train-labels-idx1-ubyte.gz", "学習ラベル 60,000", "28,881", "d53e105ee54ea40749a09fcbcd1e9432"],
    ["t10k-images-idx3-ubyte.gz", "テスト画像 10,000×28×28", "1,648,877", "9fb629c4189551a2d022fa330f9573f3"],
    ["t10k-labels-idx1-ubyte.gz", "テストラベル 10,000", "4,542", "ec29112dd5afa0611ce80d1b7f02629c"],
  ], 0.6, 1.4, 12.1, [3.2, 2.7, 1.9, 4.3], 12);
  head(s, 0.6, 3.7, 5.8, "形", "IDX 形式（ビッグエンディアン）", C.text1);
  code(s, [
    "画像: [magic 0x00000803][枚数][行=28][列=28]",
    "      続いて uint8 画素を行優先で 784 個×枚数",
    "ラベル: [magic 0x00000801][枚数]",
    "      続いて uint8 ラベル (0〜9) ×枚数",
    "ヘッダはすべて 32bit 整数",
  ].join("\n"), 0.6, 4.25, 5.8, 1.75, 11.5);
  head(s, 6.9, 3.7, 5.8, "↓", "ダウンロード先", C.accent2);
  bullets(s, [
    "公式: http://yann.lecun.com/exdb/mnist/（近年はアクセス制限で取得できないことがある）",
    "ミラー: https://storage.googleapis.com/cvdf-datasets/mnist/（本検証で使用）",
    "ミラー: https://ossci-datasets.s3.amazonaws.com/mnist/（torchvision が使用）",
    "npz版: https://storage.googleapis.com/tensorflow/tf-keras-datasets/mnist.npz（Keras）",
    "ライブラリ: torchvision.datasets.MNIST, tf.keras.datasets.mnist, sklearn fetch_openml('mnist_784')",
  ], 6.9, 4.25, 5.85, 2.6, 12);
}
{
  const s = slide("CONTENT", "ベンチマーク — 原論文の比較結果と本実装の位置", "原論文 Fig.9 および公式ページの表から主要な手法を抜粋。本実装は前処理・データ拡張なしの3層全結合NN。");
  const rows = [
    ["手法（前処理・拡張なし中心）", "テスト誤り率"],
    ["線形分類器（1層NN）", "12.0%"],
    ["k-NN（ユークリッド距離）", "5.0%"],
    ["2層NN 300隠れユニット", "4.7%"],
    ["3層NN 300+100 隠れユニット", "3.05%"],
    ["3層NN 500+150 隠れユニット", "2.95%"],
    ["LeNet-1（CNN）", "1.7%"],
    ["SVM 多項式4次", "1.1%"],
    ["LeNet-5（CNN）", "0.95%"],
    ["LeNet-5 ＋ 変形データ拡張", "0.8%"],
    ["Boosted LeNet-4 ＋ 変形", "0.7%"],
    [hl("本実装: 784-1000-1000-10 ReLU/Softmax"), hl(pct(1 - last.test_acc))],
  ];
  table(s, rows, 0.6, 1.4, 6.6, [4.8, 1.8], 12.5);
  const methods = ["線形", "k-NN", "2層NN", "3層NN\n300+100", "3層NN\n500+150", "LeNet-1", "SVM", "LeNet-5", "本実装"];
  const vals = [12.0, 5.0, 4.7, 3.05, 2.95, 1.7, 1.1, 0.95, +((1 - last.test_acc) * 100).toFixed(2)];
  s.addChart(pres.charts.BAR, [{ name: "誤り率 %", labels: methods, values: vals }], Object.assign(chartBase(), {
    x: 7.5, y: 1.35, w: 5.3, h: 4.6, barDir: "bar", catAxisOrientation: "maxMin", chartColors: [HEX.accent6],
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 10, dataLabelColor: HEX.dk1, dataLabelFormatCode: "0.0#",
    showTitle: true, title: "テスト誤り率 [%]（小さいほど良い）", showLegend: false, valAxisHidden: true, valGridLine: { style: "none" },
    catAxisLabelFontSize: 10, objectName: "bench-chart",
  }));
  para(s, "後年の記録: 784-2500-…-10 の深い全結合NN＋弾性変形 0.35%（Cireşan 2010）、CNN 35個の委員会 0.23%（Cireşan 2012）。本実装の 1.76% は、拡張なしの全結合NNとしては妥当な水準。", 7.5, 6.05, 5.3, 0.85, { fontSize: 11, color: C.accent6 });
}
{
  const s = slide("CONTENT", "関連データセットと参照先", "MNISTは易しすぎるとの指摘から多くの派生データセットが作られている。");
  const ds = [
    ["QMNIST", "Yadav & Bottou, NeurIPS 2019", "失われたテスト 50,000 枚を NIST から再構成。書き手IDなどのメタデータも付与"],
    ["EMNIST", "Cohen et al., 2017", "NIST SD-19 から英字も含めて MNIST と同じ手順で 28×28 化"],
    ["Fashion-MNIST", "Xiao et al., 2017", "衣類10クラス・同形式（28×28, 60k/10k）。MNIST の置き換え用"],
    ["Kuzushiji-MNIST", "Clanuwat et al., 2018", "くずし字（ひらがな10クラス）・同形式"],
  ];
  ds.forEach(([a, b, c], i) => {
    const y = 1.45 + i * 0.95;
    tile(s, 0.6, y + 0.1, String.fromCharCode(65 + i), [C.text1, C.accent2, C.accent1, C.accent4][i]);
    para(s, [{ text: a + "　", options: { bold: true, fontSize: 15 } }, { text: b, options: { fontSize: 11, color: C.accent6, breakLine: true } }, { text: c, options: { fontSize: 12.5 } }], 1.2, y, 5.6, 0.85);
  });
  head(s, 7.2, 1.45, 5.5, "参", "参照先", C.accent6);
  bullets(s, [
    "LeCun et al., Proc. IEEE 86(11):2278–2324, 1998（原論文）",
    "http://yann.lecun.com/exdb/mnist/（公式ページ・手法別誤り率表）",
    "NIST Special Database 19（SD-1/SD-3 の後継統合版）https://www.nist.gov/srd/nist-special-database-19",
    "C. Yadav, L. Bottou, “Cold Case: The Lost MNIST Digits”, NeurIPS 2019",
    "D. Cireşan et al., “Deep, Big, Simple Neural Nets for Handwritten Digit Recognition”, Neural Computation, 2010",
    "Hinton & Salakhutdinov 系の 784-500-300-10 NN（公式表 1.53%）",
  ], 7.2, 2.0, 5.55, 4.8, 12);
}

// =====================================================================
section("2. 本リポジトリの実装");
{
  const s = slide("SECTION", "本リポジトリの実装とNN構成");
  s.addText("EusLisp（roseus / irteusgl）＋ OpenBLAS の C 関数呼び出し ＋ 自作 C 拡張 MATPROD", { placeholder: "body" });
  tile(s, 0.9, 2.75, "2", C.accent2, 1.2);
}
{
  const s = slide("CONTENT", "リポジトリ構成", "大きなデータファイルは Git LFS 管理（.gitattributes で *.l と *.tgz を LFS 指定）。");
  code(s, [
    "~/mnist",
    "├── README.md        インストールと実行手順",
    "├── Makefile         OpenBLAS を apt で導入し setup.sh を実行",
    "├── setup.sh         MATPROD をビルドし mlp/*.gz を展開",
    "├── nn.l             ★ NN 本体（Perceptron / MultiLayerPerceptron）",
    "├── cblaslib.l       OpenBLAS の cblas_* を defforeign で呼ぶ",
    "├── mnist.l          テキスト → float-vector 読み込み、モデル保存",
    "├── mnist-draw.l     irtviewer で画像・認識結果を表示",
    "├── MATPROD/",
    "│   ├── src/matprod.c   C拡張: mprod / mrelu / msoftmax",
    "│   └── Makefile.*      Linux / Linux64 / LinuxARM / Darwin / Cygwin",
    "└── mlp/",
    "    ├── mnist-datasets.l     学習・テスト全データ (270 MB)",
    "    ├── mnist-{train,test}-{images,labels}.l  分割版",
    "    └── mnist-mlp-{0..19}.l  各エポックのモデル 43MB",
  ].join("\n"), 0.6, 1.4, 7.4, 5.4, 14.5);
  head(s, 8.35, 1.45, 4.4, "要", "ポイント", C.accent2);
  bullets(s, [
    "Lisp だけで NN を書き、重い行列演算だけ OpenBLAS（C）に任せる構成",
    "活性化関数と要素積は MATPROD の C 関数で高速化",
    "データもモデルも EusLisp の S 式テキストとして保存 → load 1回で復元できる",
    "モデルファイルには重みに加え、最後のバッチの中間値 u, z, δ (200行) も含まれるため 43 MB と大きい",
    "aarch64（DGX Spark）用の BLAS パス libblas64.so を 2026-06-18 に追加",
  ], 8.35, 2.0, 4.4, 4.8, 12.5);
}
{
  const s = slide("CONTENT", "ソフトウェア構成 — どの処理をどこで計算するか", "上から下へ呼び出し。Lispの配列(float-vector)の実体ポインタをそのままCに渡しているのでコピーは発生しない。");
  const layers = [
    ["nn.l", "学習ループ・バッチ作成・損失計算・クラス定義（EusLisp）", C.text1, 1.4],
    ["cblaslib.l", "cblas_dgemm / cblas_daxpy などを defforeign で外部関数化（行優先 101, 転置なし 111）", C.accent2, 2.35],
    ["MATPROD", "libmatprod.so: mprod（要素積）, mrelu（ReLUと微分）, msoftmax（行ごとSoftmax）", C.accent4, 3.3],
    ["OpenBLAS", "libblas64.so（openblas64-pthread, 64bit整数版）— 20スレッドで dgemm を並列実行", C.accent1, 4.25],
    ["irtviewer", "mnist-draw.l: 28×28 を3回 :double して 224×224 で表示（テスト時のみ）", C.accent6, 5.2],
  ];
  layers.forEach(([a, b, c, y]) => {
    s.addText(a, { x: 0.6, y, w: 2.4, h: 0.8, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, fill: { color: c }, color: C.background1, fontSize: 17, bold: true, align: "center", valign: "middle", margin: 0, isTextBox: true });
    card(s, 3.15, y, 9.55, 0.8);
    para(s, b, 3.35, y, 9.2, 0.8, { valign: "middle", fontSize: 13.5 });
  });
  para(s, "EusLisp の float は 64bit double。行列は (make-array '(行 列) :element-type :float) で、実体 (m . entity) は連続した double 配列 → BLAS にそのまま渡せる。", 0.6, 6.2, 12.1, 0.6, { fontSize: 12, color: C.accent6 });
}
{
  const s = slide("CONTENT", "データの変換と検証 — 元の MNIST と完全一致", "本スライドの一致確認は、ミラーから取得した IDX ファイルと mlp/mnist-datasets.l を Python で比較して行った。");
  head(s, 0.6, 1.45, 6, "変", "変換方法（mnist.l）", C.text1);
  bullets(s, [
    "テキスト（1画像=784個の整数）を read で読み、×1/255 して float-vector に",
    "読み込み時に push で積むため、リストの順序は元ファイルの逆順になる",
    "ラベルは 1要素の float-vector: #f(8.0) など",
    "(setq *train-images* '(#f(…) …)) の形で保存 → (load …) だけで復元",
  ], 0.6, 2.0, 6, 2.4, 13);
  code(s, "(setq *train-labels* '(#f(8.0) #f(6.0) #f(5.0) #f(3.0) ...\n(setq *train-images* '(#f(0.0 0.0 ... 0.003922 0.007843 ...", 0.6, 4.35, 6, 0.9, 10.5);
  head(s, 6.9, 1.45, 6, "検", "検証結果", C.accent1);
  table(s, [
    ["項目", "学習", "テスト"],
    ["枚数（画像 / ラベル）", "60,000 / 60,000", "10,000 / 10,000"],
    ["元IDXを逆順にした列と一致", "ラベル完全一致", "ラベル完全一致"],
    ["画素の最大誤差（×255）", "1.25×10⁻⁴", "1.25×10⁻⁴"],
    ["画素値の種類", "256 階調（0〜1）", "256 階調（0〜1）"],
    ["先頭ラベル（本データ）", "8 6 5 3 8 1 5 9 …", "6 5 4 3 2 1 0 9 …"],
    ["元MNIST 末尾から", "8 6 5 3 8 1 5 9 …", "6 5 4 3 2 1 0 9 …"],
  ], 6.9, 2.0, 5.8, [2.4, 1.7, 1.7], 11.5);
  para(s, "誤差は小数6桁丸め（例: 1/255 → 0.003922）によるもので、値は実質同一。", 6.9, 4.95, 5.8, 0.5, { fontSize: 11.5, color: C.accent6 });
  table(s, [
    ["mlp/ のファイル", "中身", "サイズ"],
    ["mnist-datasets.l", "学習・テストの画像とラベル4つ", "270 MB"],
    ["mnist-train-images.l", "学習画像", "231 MB"],
    ["mnist-test-labels.l", "テスト画像＋ラベル（名前に注意）", "38.6 MB"],
    ["mnist-test-images.l / train-labels.l", "テスト画像 / 学習ラベル", "38.5 / 0.48 MB"],
  ], 0.6, 5.45, 12.1, [4.0, 6.0, 2.1], 11);
}
{
  const s = slide("CONTENT", "NN の構成 — 784-1000-1000-10 の全結合ネットワーク", "パラメータ数: 784×1000+1000 + 1000×1000+1000 + 1000×10+10 = 1,796,010。");
  const L = [
    ["入力", "784", "28×28 画素\n0〜1 に正規化", C.accent6, 0.6],
    ["隠れ層1", "1000", "全結合 W₁: 1000×784\n+ b₁ → ReLU", C.accent2, 3.35],
    ["隠れ層2", "1000", "全結合 W₂: 1000×1000\n+ b₂ → ReLU", C.accent2, 6.1],
    ["出力", "10", "全結合 W₃: 10×1000\n+ b₃ → Softmax", C.accent1, 8.85],
  ];
  L.forEach(([a, n, d, c, x], i) => {
    s.addText([{ text: a, options: { fontSize: 13, breakLine: true } }, { text: n, options: { fontSize: 34, bold: true } }], { x, y: 1.5, w: 2.35, h: 1.5, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.1, fill: { color: c }, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
    para(s, d, x, 3.1, 2.35, 0.8, { align: "center", fontSize: 12, color: C.accent6 });
    if (i < 3) s.addShape(pres.shapes.RIGHT_ARROW, { x: x + 2.42, y: 2.1, w: 0.33, h: 0.3, fill: { color: C.text1 }, line: { type: "none" } });
  });
  s.addText([{ text: "y", options: { fontSize: 26, bold: true, breakLine: true } }, { text: "10クラスの確率", options: { fontSize: 11 } }], { x: 11.55, y: 1.65, w: 1.2, h: 1.2, color: C.accent1, align: "center", valign: "middle", margin: 0, isTextBox: true });
  table(s, [
    ["層", "重み W", "バイアス b", "パラメータ数", "1枚あたり積和"],
    ["隠れ層1", "1000 × 784", "1000", "785,000", "784,000"],
    ["隠れ層2", "1000 × 1000", "1000", "1,001,000", "1,000,000"],
    ["出力層", "10 × 1000", "10", "10,010", "10,000"],
    [hl("合計"), "", "", hl("1,796,010"), hl("1,794,000")],
  ], 0.6, 4.05, 7.6, [1.4, 1.6, 1.3, 1.6, 1.7], 12);
  bullets(s, [
    "重みは倍精度 (64bit) で 約 14.4 MB",
    "初期値: 一様乱数 U(−0.08, 0.08)、バイアス 0",
    "1枚の順伝播 ≒ 3.6 MFLOP、学習（順＋逆＋更新）≒ 9.2 MFLOP",
    "畳み込みは使わない → 画像の位置ずれに弱い（誤認識例で確認）",
  ], 8.55, 4.05, 4.2, 2.8, 12.5);
}
{
  const s = slide("CONTENT", "実装の詳細（1）— クラス構成（nn.l）", "Perceptron が1層分、MultiLayerPerceptron が層のリストを持つ。:call は (バッチ×入力) 行列を受けて (バッチ×出力) を返す。");
  code(s, [
    "(defclass Perceptron :super propertied-object",
    "  :slots (W Wt b delta activation p mask pre-dW pre-db",
    "          u z in-dim out-dim dW db))",
    "",
    "(:call (x)       ; x: バッチ×in-dim の行列",
    "  ;; u = x・Wᵀ + 1・bᵀ   (C ← A・B + C を dgemm で)",
    "  (setq u (cblas-dgemm x Wt",
    "            (extended-matrix b (array-dimension x 0))))",
    "  ;; z = f(u)   mReLU / mSoftmax (MATPROD の C 関数)",
    "  (setq z (funcall (symbol-function activation) 0 u)))",
    "",
    "(setq mlp (instance MultiLayerPerceptron :init",
    "  (list (instance Perceptron :init 784 1000 1.0 'mReLU)",
    "        (instance Perceptron :init 1000 1000 1.0 'mReLU)",
    "        (instance Perceptron :init 1000 10 1.0 'mSoftmax))))",
  ].join("\n"), 0.6, 1.4, 7.3, 5.4, 13.5);
  head(s, 8.25, 1.45, 4.5, "P", "Perceptron（1層）", C.accent2);
  bullets(s, [
    "W と、その転置 Wt を両方保持（順伝播で Wt を使う）",
    "u（活性化前）と z（出力）を保存し逆伝播で再利用",
    "p, mask, pre-dW は dropout / momentum 用だが未使用",
  ], 8.25, 2.0, 4.5, 1.9, 12.5);
  head(s, 8.25, 4.0, 4.5, "M", "MultiLayerPerceptron", C.accent1);
  bullets(s, [
    ":train-batch — 順伝播・損失・逆伝播・重み更新を1バッチ分",
    ":test — 1枚を 1×784 行列にして順伝播",
    "extended-matrix で b をバッチ行数ぶん複製",
  ], 8.25, 4.55, 4.5, 2.2, 12.5);
}
{
  const s = slide("CONTENT", "実装の詳細（2）— 順伝播・逆伝播と BLAS 呼び出しの対応", "Softmax＋交差エントロピーの組合せなので出力層の誤差は y − t になる。勾配はバッチ内で平均せず合計している点に注意。");
  table(s, [
    ["処理", "数式（B=バッチ200）", "nn.l での実装"],
    ["順伝播", "uₗ = zₗ₋₁ Wₗᵀ + 1 bₗᵀ,   zₗ = f(uₗ)", "cblas-dgemm x Wt (extended-matrix b B) → mrelu / msoftmax"],
    ["損失", "L = −(1/B) Σᵢ log yᵢ,tᵢ", "Lisp ループで正解位置の log を加算"],
    ["出力層の誤差", "δ₃ = y − t", "copy-object y → cblas-daxpy t δ :alpha −1"],
    ["誤差逆伝播", "δₗ = (δₗ₊₁ Wₗ₊₁) ⊙ f′(uₗ)", "cblas-dgemm δ W → mprod (mrelu 1 u)"],
    ["重みの勾配", "ΔWₗ = δₗᵀ zₗ₋₁（バッチ和）", "cblas-dgemm (transpose δ) z dW"],
    ["バイアスの勾配", "Δbₗ = 1ᵀ δₗ", "cblas-dgemm (one-matrix 1×B) δ db"],
    ["更新（SGD）", "Wₗ ← Wₗ − η ΔWₗ,  bₗ ← bₗ − η Δbₗ", "cblas-daxpy dW W :alpha −η, Wt を transpose で作り直す"],
  ], 0.6, 1.4, 12.1, [2.0, 4.6, 5.5], 14, { rowH: 0.46 });
  para(s, [
    { text: "f′: ReLU の微分は u ≥ 0 で 1、それ以外 0（mrelu の flag=1）。", options: { breakLine: true } },
    { text: "η = 0.001 を勾配の「合計」に掛けるため、平均勾配に換算すると学習率 0.2 相当（= 0.001 × 200）。バッチサイズを変えると実効学習率も変わる。" },
  ], 0.6, 5.55, 12.1, 1.0, { fontSize: 14, color: C.accent6 });
}
{
  const s = slide("CONTENT", "学習方法 — test-mnist-batch のハイパーパラメータ", "保存されたモデルの u スロットの形が 200×1000 であることから、保存済みの学習はバッチ200で行われたと確認できる。");
  table(s, [
    ["項目", "設定", "備考"],
    ["最適化", "ミニバッチ SGD（モーメンタムなし）", "*mr* = 0.5 は定義のみで未使用（TODO）"],
    ["学習率 η", "0.001（*lr*）", "勾配はバッチ和 → 平均換算 0.2"],
    ["バッチサイズ", "200（README: (test-mnist-batch 200)）", "1エポック = 300 回更新"],
    ["エポック数", "20（:epoch 既定値）", "合計 6,000 回更新"],
    ["損失関数", "交差エントロピー（Softmax 出力）", ""],
    ["初期化", "W ~ U(−0.08, 0.08), b = 0", "EusLisp の random は既定シードで再現性あり"],
    ["データ順", "毎エポック同じ順（シャッフルなし）", "リストの先頭から 200 枚ずつ"],
    ["正則化", "なし", "dropout 引数（1.0）は未使用"],
    ["保存", "各エポック後に mlp/mnist-mlp-N.l", "dump-loadable-structure"],
  ], 0.6, 1.4, 8.1, [1.7, 3.4, 3.0], 12);
  head(s, 9.0, 1.45, 3.8, "実", "実行方法", C.text1);
  code(s, "$ roseus nn.l\n;; 学習（20エポック）\n$ (test-mnist-batch 200)\n;; テスト画像で認識\n$ (test-mnist-test)\n;; 学習画像で認識\n$ (test-mnist-train)", 9.0, 2.0, 3.75, 2.75, 13.5);
  para(s, "各エポックの終わりに時刻・平均損失・経過時間を表示し、モデルを保存する。", 9.0, 4.95, 3.75, 1.0, { fontSize: 12, color: C.accent6 });
}

// =====================================================================
section("3. 処理時間プロファイル");
{
  const s = slide("SECTION", "処理時間プロファイル");
  s.addText("1エポック学習の内訳、バッチサイズ・スレッド数による変化、読み込みと推論の時間", { placeholder: "body" });
  tile(s, 0.9, 2.75, "3", C.accent4, 1.2);
}
{
  const s = slide("CONTENT", `1エポック学習の内訳（バッチ200, 壁時計 ${fmt(prof.epoch.wall, 1)} 秒）`, "nn.l の :train-batch と同じ処理を、区間ごとに gettimeofday で計測するラッパーで実行した。別プロセスの負荷があったため数値は目安。");
  const items = prof.epoch.items; // [[label, ms], ...] sorted desc
  s.addChart(pres.charts.BAR, [{ name: "時間 [s]", labels: items.map((d) => d[0]), values: items.map((d) => +(d[1] / 1000).toFixed(2)) }], Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 7.6, h: 5.6, barDir: "bar", catAxisOrientation: "maxMin", chartColors: [HEX.accent2],
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 10, dataLabelColor: HEX.dk1, dataLabelFormatCode: "0.0",
    showLegend: false, valAxisHidden: true, valGridLine: { style: "none" }, catAxisLabelFontSize: 10.5, objectName: "prof-epoch",
  }));
  const bm = items.find((d) => d[0].startsWith("バッチ作成"))[1] / 1000;
  stat(s, 8.5, 1.35, 4.3, pct(bm / prof.epoch.wall, 0), "がバッチ作成（画像のコピー）。\n(elt リスト i) が先頭から辿るため O(N) — 最大のボトルネック");
  stat(s, 8.5, 3.0, 4.3, `${fmt(prof.epoch.blas / 1000, 1)} 秒`, `dgemm 合計（順・逆・勾配）。\n約 ${fmt(prof.epoch.gflop / (prof.epoch.blas / 1000), 0)} GFLOPS（倍精度）で計算`, C.accent2);
  stat(s, 8.5, 4.65, 4.3, `${fmt(prof.epoch.cpu, 0)} 秒`, `同じ1エポックの CPU 時間（全スレッド合計）。\nnn.l の表示 [sec] は unix::runtime = CPU 時間`, C.accent6);
  para(s, "参考: 保存済みモデルのファイル時刻の間隔は 1エポック約 60 秒（学習＋保存、当時の負荷込み）。今回はモデル保存 1.4 秒を別途計測。", 8.5, 6.25, 4.3, 0.7, { fontSize: 10.5, color: C.accent6 });
}
{
  const s = slide("CONTENT", "バッチサイズとスレッド数による学習時間の変化", "先頭6,000枚で計測し60,000枚に換算。バッチ500以上は元の libmatprod.so ではクラッシュするため、free() を修正したコピーで計測した。");
  const sw = prof.sweep; // [{bs, wall, bm}]
  s.addChart(pres.charts.BAR, [
    { name: "計算（バッチ作成以外）", labels: sw.map((d) => String(d.bs)), values: sw.map((d) => +(d.wall - d.bm).toFixed(1)) },
    { name: "バッチ作成", labels: sw.map((d) => String(d.bs)), values: sw.map((d) => +d.bm.toFixed(1)) },
  ], Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 6.6, h: 4.7, barDir: "col", barGrouping: "stacked", chartColors: [HEX.accent2, HEX.accent3],
    showValue: false, showLegend: true, legendPos: "b", legendFontSize: 11, showTitle: true, title: "1エポック換算の壁時計時間 [s] vs バッチサイズ",
    showCatAxisTitle: true, catAxisTitle: "バッチサイズ", catAxisTitleFontSize: 11, catAxisTitleColor: HEX.accent6, objectName: "prof-sweep",
  }));
  const th = prof.threads; // [{t, wall, cpu}]
  s.addChart(pres.charts.BAR, [{ name: "壁時計 [s]", labels: th.map((d) => d.t + " スレッド"), values: th.map((d) => +d.wall.toFixed(1)) }], Object.assign(chartBase(), {
    x: 7.4, y: 1.3, w: 5.4, h: 3.1, barDir: "col", chartColors: [HEX.accent4], showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 11, dataLabelColor: HEX.dk1, dataLabelFormatCode: "0.0",
    showLegend: false, showTitle: true, title: "OPENBLAS_NUM_THREADS 別（バッチ200, 1エポック換算 [s]）", valAxisHidden: true, valGridLine: { style: "none" }, objectName: "prof-threads",
  }));
  bullets(s, [
    "バッチが小さいと dgemm 1回あたりの仕事が少なく、Lisp 側の手間と BLAS 起動コストが支配的",
    "バッチ 500 付近で最短（17.5 秒）。1000 では再び少し遅くなる",
    "4 スレッドが最速。20 スレッドは 200×1000 程度の行列には多すぎ、同期待ちで逆に遅く、CPU 時間は 467 秒に膨らむ",
  ], 7.4, 4.6, 5.35, 2.3, 12);
  para(s, "※ 6,000枚の範囲ではリスト辿りが短いため、バッチ作成の割合は全60,000枚の1エポックより小さく出る。", 0.6, 6.15, 6.5, 0.6, { fontSize: 11, color: C.accent6 });
}
{
  const s = slide("CONTENT", "読み込み・推論・保存の時間", "推論は保存済みモデル mnist-mlp-19.l を使用。1枚ずつ :test を呼ぶ方法と、10,000枚を1つの行列にまとめる方法を比較した。");
  const t = prof.misc;
  const rows = [
    ["処理", "時間", "メモ"],
    ["データ読み込み (load \"mlp/mnist-datasets.l\")", `${fmt(t.load_data, 1)} 秒`, "270 MB の S 式テキストを読む"],
    ["モデル読み込み (load \"mlp/mnist-mlp-19.l\")", `${fmt(t.load_model, 1)} 秒`, "43 MB"],
    ["モデル保存 (dump-loadable-structure)", `${fmt(t.dump, 1)} 秒`, "各エポック末に実行"],
    ["テスト推論: 1枚ずつ :test（elt でアクセス）", `${fmt(t.infer_1by1, 1)} 秒`, `${fmt(t.infer_1by1 / 10, 2)} ms/枚（リスト辿り込み）`],
    ["テスト推論: 1枚ずつ :test（dolist でアクセス）", `${fmt(t.infer_1by1_dolist, 1)} 秒`, `${fmt(t.infer_1by1_dolist / 10, 2)} ms/枚`],
    [hl("テスト推論: 10,000枚を1行列で"), hl(`${fmt(t.infer_batch_test, 2)} 秒`), hl(`${fmt(t.infer_batch_test * 0.1, 3)} ms/枚`)],
    ["学習データ推論: 60,000枚を1行列で", `${fmt(t.infer_batch_train, 2)} 秒`, "認識率の再計算に使用"],
  ];
  table(s, rows, 0.6, 1.4, 12.1, [5.4, 1.9, 4.8], 13.5, { rowH: 0.42 });
  stat(s, 0.6, 4.75, 3.8, `×${fmt(t.infer_1by1_dolist / t.infer_batch_test, 0)}`, "まとめて行列にした推論の速度向上\n（1枚ずつ dolist 比）", C.accent1);
  stat(s, 4.6, 4.75, 3.8, `${t.acc_test} 枚`, "EusLisp 上で再計算したテスト正解数\n（Python での検証結果と一致）", C.accent2);
  stat(s, 8.6, 4.75, 4.1, `${t.acc_train} 枚`, "EusLisp 上で再計算した学習データ正解数\n（60,000 枚中）", C.accent4);
}

// =====================================================================
section("4. 学習経過");
{
  const s = slide("SECTION", "学習経過（20エポック）");
  s.addText("保存された mnist-mlp-0.l 〜 mnist-mlp-19.l を全学習データ・全テストデータで評価", { placeholder: "body" });
  tile(s, 0.9, 2.75, "4", C.accent3, 1.2);
}
{
  const s = slide("CONTENT", "損失の推移 — 学習データとテストデータ", "各エポック終了時点のモデルで全データの平均交差エントロピーを計算。nn.l の表示値はエポック内の移動平均なのでこれより大きめに出る。");
  const lab = ev.map((r) => String(r.epoch + 1));
  s.addChart(pres.charts.LINE, [
    { name: "学習 60,000枚", labels: lab, values: ev.map((r) => +r.train_loss.toFixed(4)) },
    { name: "テスト 10,000枚", labels: lab, values: ev.map((r) => +r.test_loss.toFixed(4)) },
  ], Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 8.2, h: 5.5, chartColors: [HEX.accent2, HEX.accent1], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 6,
    showLegend: true, legendPos: "t", legendFontSize: 12, showCatAxisTitle: true, catAxisTitle: "エポック", catAxisTitleColor: HEX.accent6, catAxisTitleFontSize: 11,
    showValAxisTitle: true, valAxisTitle: "平均交差エントロピー", valAxisTitleColor: HEX.accent6, valAxisTitleFontSize: 11, valAxisLabelFormatCode: "0.00", objectName: "loss-chart",
  }));
  stat(s, 9.1, 1.4, 3.7, fmt(last.train_loss, 4), `学習損失（エポック20）\nエポック1: ${fmt(ev[0].train_loss, 3)} → 約 1/${fmt(ev[0].train_loss / last.train_loss, 0)}`, C.accent2);
  stat(s, 9.1, 3.1, 3.7, fmt(last.test_loss, 4), `テスト損失（エポック20）\nエポック1: ${fmt(ev[0].test_loss, 3)}`, C.accent1);
  para(s, "学習損失は下がり続ける一方、テスト損失はエポック 12 前後から 0.06 付近でほぼ横ばい → 学習データへの過学習が始まっている。", 9.1, 4.85, 3.7, 1.6, { fontSize: 12.5 });
}
{
  const s = slide("CONTENT", "認識率の推移", "ファイルの更新時刻からエポック5〜20は 07:24〜07:40、エポック1〜4は 08:18〜08:21 に書かれている（後で再実行され上書き）。既定シードの乱数のため同じ結果になり、曲線は連続している。");
  const lab = ev.map((r) => String(r.epoch + 1));
  s.addChart(pres.charts.LINE, [
    { name: "学習", labels: lab, values: ev.map((r) => +(r.train_acc * 100).toFixed(2)) },
    { name: "テスト", labels: lab, values: ev.map((r) => +(r.test_acc * 100).toFixed(2)) },
  ], Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 6.9, h: 5.5, chartColors: [HEX.accent2, HEX.accent1], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 6,
    showLegend: true, legendPos: "t", legendFontSize: 12, valAxisMinVal: 94, valAxisMaxVal: 100, valAxisMajorUnit: 1, valAxisLabelFormatCode: "0",
    showCatAxisTitle: true, catAxisTitle: "エポック", catAxisTitleColor: HEX.accent6, catAxisTitleFontSize: 11,
    showValAxisTitle: true, valAxisTitle: "認識率 [%]", valAxisTitleColor: HEX.accent6, valAxisTitleFontSize: 11, objectName: "acc-chart",
  }));
  const pick = [0, 1, 2, 4, 9, 14, 19];
  table(s, [["エポック", "学習 認識率", "テスト 認識率", "テスト誤り"], ...pick.map((i) => {
    const r = ev[i]; const row = [String(i + 1), pct(r.train_acc), pct(r.test_acc), String(r.test_err)];
    return i === 19 ? row.map(hl) : row;
  })], 7.7, 1.4, 5.0, [1.1, 1.35, 1.35, 1.2], 12);
  para(s, "1エポックで既に 94.7%。20エポックで学習 99.97% / テスト 98.24%。学習データの誤りは 3,081 → 19 枚まで減った。", 7.7, 4.85, 5.0, 1.3, { fontSize: 12.5 });
}

// =====================================================================
section("5. 認識テストの結果");
{
  const s = slide("SECTION", "認識テストの結果");
  s.addText("最終モデル mnist-mlp-19.l（20エポック後）によるテスト 10,000 枚・学習 60,000 枚の認識", { placeholder: "body" });
  tile(s, 0.9, 2.75, "5", C.accent1, 1.2);
}
{
  const s = slide("CONTENT", "認識結果のまとめと数字ごとの認識率", "クラスごとの認識率 = 混同行列の対角 / 行の合計。3, 5, 8 が相対的に難しい。");
  stat(s, 0.6, 1.35, 3.6, pct(last.test_acc), `テスト認識率\n誤り ${last.test_err} / 10,000 枚`, C.accent1);
  stat(s, 0.6, 3.05, 3.6, pct(last.train_acc), `学習データ認識率\n誤り ${last.train_err} / 60,000 枚`, C.accent2);
  stat(s, 0.6, 4.75, 3.6, "0.78", "誤認識した画像の最大確率の中央値\n（正解画像では 0.99999）", C.accent6);
  const pc = prof.perclass;
  s.addChart(pres.charts.BAR, [{ name: "認識率 %", labels: pc.map((d) => String(d[0])), values: pc.map((d) => d[1]) }], Object.assign(chartBase(), {
    x: 4.5, y: 1.3, w: 8.3, h: 5.5, barDir: "col", chartColors: [HEX.accent2], showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 11, dataLabelColor: HEX.dk1, dataLabelFormatCode: "0.0",
    valAxisMinVal: 96, valAxisMaxVal: 100, valAxisMajorUnit: 1, showLegend: false, showTitle: true, title: "数字ごとのテスト認識率 [%]",
    showCatAxisTitle: true, catAxisTitle: "正解の数字", catAxisTitleColor: HEX.accent6, catAxisTitleFontSize: 11, objectName: "perclass-chart",
  }));
}
{
  const s = slide("CONTENT", "混同行列 — どの数字をどれと間違えたか", "行が正解、列が予測。対角以外の色が濃いほど間違いが多い。");
  s.addImage({ path: fig("confusion.png"), x: 0.5, y: 1.25, w: 6.1, h: 6.1 * 864 / 960, objectName: "confusion" });
  head(s, 7.0, 1.45, 5.7, "誤", "間違いの多い組合せ（テスト）", C.accent1);
  table(s, [["正解 → 予測", "枚数", "理由の例"],
    ["4 → 9", "10", "上部が閉じた 4"], ["7 → 9", "8", "横棒・ループ付きの 7"], ["3 → 5", "7", "上半分が角ばった 3"],
    ["7 → 2", "6", "下に横線を引く 7"], ["3 → 9", "6", "太く丸い 3"], ["3 → 8", "6", "左側が閉じかけた 3"]], 7.0, 2.0, 5.7, [1.7, 0.9, 3.1], 12.5);
  para(s, "形の似た数字の取り違えが中心。全結合NNは画素位置ごとに重みを持つため、筆跡の位置・傾き・太さの変化に弱い。", 7.0, 4.9, 5.7, 1.2, { fontSize: 12.5 });
}
{
  const s = slide("CONTENT", `テストで誤認識した全 ${last.test_err} 枚（正解→予測）`, "インデックスは nn.l の *test-images* の番号（元 MNIST の番号 = 9999 − i）。白黒反転して表示。");
  s.addImage({ path: fig("wrong_test.png"), x: 0.6, y: 1.25, w: 12.1, h: 12.1 * 608 / 1320, objectName: "wrong-test" });
}
{
  const s = slide("CONTENT", `学習データで誤認識した ${last.train_err} 枚と、自信満々の誤り`, "学習データでも誤るものは、ラベル自体があいまいな画像が多い。");
  s.addImage({ path: fig("wrong_train.png"), x: 0.6, y: 1.45, w: 6.0, h: 6.0 * 152 / 600, objectName: "wrong-train" });
  para(s, "学習データ 60,000 枚中の誤り（正解→予測）。4→9、3→5、7→1/9 など、テストと同じ傾向。", 0.6, 3.15, 6.0, 0.8, { fontSize: 12.5, color: C.accent6 });
  head(s, 0.6, 4.1, 6, "!", "確率 0.998 以上の誤り（テスト上位5枚）", C.accent1);
  const top = wrongTest.slice().sort((a, b) => b.p - a.p).slice(0, 5);
  table(s, [["i", "元番号", "正解", "予測", "予測の確率"], ...top.map((d) => [String(d.i), String(d.orig), String(d.label), String(d.pred), d.p.toFixed(4)])], 0.6, 4.65, 6.0, [1.0, 1.2, 1.0, 1.0, 1.8], 12);
  const ex = examples[2];
  s.addImage({ path: fig(`test_${ex.i}.png`), x: 7.2, y: 1.45, w: 2.2, h: 2.2, objectName: "conf-wrong-img" });
  para(s, [{ text: `テスト i=${ex.i}（元 #${9999 - ex.i}）`, options: { bold: true, breakLine: true } }, { text: `正解 ${ex.label} → 予測 ${ex.pred}（確率 ${ex.p[ex.pred].toFixed(5)}）`, options: { color: C.accent1, breakLine: true } }, { text: "細く縦長に書かれた 6 は、1 の典型的な画素分布と重なる。確率の高さは正しさを保証しない例。", options: { fontSize: 12, color: C.accent6 } }], 9.6, 1.5, 3.15, 2.6, { fontSize: 13 });
}
{
  const s = slide("CONTENT", "推論の例 — 出力層 Softmax の確率", "test-mnist-test は誤認識した画像だけを irtviewer に表示し、1位と2位の候補と確率を描く。");
  const exs = [examples[0], examples[1]];
  exs.forEach((ex, k) => {
    const x = 0.6 + k * 6.25;
    s.addImage({ path: fig(`test_${ex.i}.png`), x, y: 1.5, w: 2.2, h: 2.2, objectName: nm("ex-img") });
    para(s, [{ text: `テスト i=${ex.i}`, options: { bold: true, breakLine: true } }, { text: `正解 ${ex.label} / 予測 ${ex.pred}`, options: { color: ex.label === ex.pred ? C.accent4 : C.accent1, bold: true } }], x, 3.8, 2.2, 0.8, { fontSize: 13 });
    s.addChart(pres.charts.BAR, [{ name: "確率", labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], values: ex.p.map((v) => +v.toFixed(3)) }], Object.assign(chartBase(), {
      x: x + 2.35, y: 1.3, w: 3.6, h: 3.6, barDir: "col", chartColors: [ex.label === ex.pred ? HEX.accent4 : HEX.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 9, dataLabelColor: HEX.dk1, dataLabelFormatCode: "0.00",
      valAxisMinVal: 0, valAxisMaxVal: 1.1, valAxisHidden: true, valGridLine: { style: "none" }, showLegend: false, objectName: nm("ex-chart"),
    }));
  });
  head(s, 0.6, 5.0, 12, "表", "irtviewer での表示（mnist-draw.l / draw-test-image）", C.accent6);
  bullets(s, [
    "28×28 の画像を :double を3回かけて 224×224 に拡大し、cnt（誤り通番）、right（正解）、0: 1位候補と確率、1: 2位候補と確率 を描画",
    "キー入力まで (do-until-key) 次々に画像を処理し、誤った画像だけ画面に残す",
  ], 0.6, 5.5, 12.1, 1.3, 12.5);
}
{
  const s = slide("CONTENT", "学習された重み — 第1層 W₁ の可視化", "W₁ の各行（784次元）を 28×28 に並べ直したもの。初期値（±0.08 の一様乱数）からの変化が大きい100個を表示。赤=正、青=負。");
  s.addImage({ path: fig("w1_filters.png"), x: 0.6, y: 1.3, w: 5.5, h: 5.5, objectName: "w1" });
  s.addImage({ path: fig("w_hist.png"), x: 6.5, y: 1.4, w: 6.3, h: 6.3 * 480 / 1400, objectName: "whist" });
  bullets(s, [
    "20エポック・6,000回の更新では、初期乱数の模様がまだ強く残る（点線は初期分布の範囲 ±0.08）",
    "中央付近にストロークの断片のような正負の構造が出ているユニットがある",
    "テスト画像での隠れユニットの発火率: 第1層 50%、第2層 58%。一度も発火しない“死んだ”ユニットは 0 個",
    "重みのノルムは出力層 W₃ が 6.1 → 10.1 と最も大きく変化（第1・2層は約 2% 増）",
  ], 6.5, 3.85, 6.3, 3.0, 12.5);
}

// =====================================================================
section("6. 使用した手書き画像（全70,000枚）");
{
  const s = slide("SECTION", "使用した手書き画像 全 70,000 枚");
  s.addText("学習 60,000 枚（12 枚のシート）＋ テスト 10,000 枚（2 枚のシート）。1シート = 100列 × 50行 = 5,000 枚、各画像 28×28 画素を等倍で配置", { placeholder: "body" });
  tile(s, 0.9, 2.75, "6", C.accent6, 1.2);
}
{
  const s = slide("CONTENT", "数字ごとの例（学習データ、各クラス先頭 20 枚）と枚数", "枚数は本データで数えた値。クラスの偏りは小さい（最少 5 の 5,421 枚、最多 1 の 6,742 枚）。");
  s.addImage({ path: fig("class_samples.png"), x: 0.6, y: 1.3, w: 7.4, h: 7.4 * 316 / 636, objectName: "classes" });
  const tr = [5923, 6742, 5958, 6131, 5842, 5421, 5918, 6265, 5851, 5949];
  const te = [980, 1135, 1032, 1010, 982, 892, 958, 1028, 974, 1009];
  table(s, [["数字", "学習", "テスト"], ...tr.map((v, i) => [String(i), v.toLocaleString(), te[i].toLocaleString()]), [hl("合計"), hl("60,000"), hl("10,000")]], 8.4, 1.3, 4.3, [1.1, 1.6, 1.6], 11.5, { rowH: 0.36 });
}
for (let k = 0; k < 12; k++) {
  const s = slide("SHEET", `学習画像 ${k + 1}/12 — *train-images* i = ${(k * 5000).toLocaleString()} 〜 ${(k * 5000 + 4999).toLocaleString()}（元 MNIST #${(59999 - k * 5000).toLocaleString()} 〜 #${(59999 - k * 5000 - 4999).toLocaleString()}）`,
    "1行100枚×50行。左上が i の小さい順、行ごとに右へ。拡大表示すると個々の数字を確認できる。");
  s.addImage({ path: fig(`train_${String(k).padStart(2, "0")}.png`), x: 0.4, y: 0.7, w: 12.53, h: 6.265, objectName: `train-sheet-${k + 1}` });
}
for (let k = 0; k < 2; k++) {
  const s = slide("SHEET", `テスト画像 ${k + 1}/2 — *test-images* i = ${(k * 5000).toLocaleString()} 〜 ${(k * 5000 + 4999).toLocaleString()}（元 MNIST #${(9999 - k * 5000).toLocaleString()} 〜 #${(9999 - k * 5000 - 4999).toLocaleString()}）`,
    "1行100枚×50行。左上が i の小さい順、行ごとに右へ。");
  s.addImage({ path: fig(`test_${String(k).padStart(2, "0")}.png`), x: 0.4, y: 0.7, w: 12.53, h: 6.265, objectName: `test-sheet-${k + 1}` });
}

// =====================================================================
section("まとめ");
{
  const s = slide("CONTENT", "気づいた問題点と改善案", "いずれもリポジトリのコードは変更していない。matprod.c の free() 修正はプロファイル用の一時コピーにのみ適用した。");
  const P = [
    ["1", "matprod.c: msoftmax の free() 誤り", "行数 > 256 で malloc した配列ではなくスタック配列 maxv/sumv を free → バッチ500で munmap_chunk(): invalid pointer で異常終了。free(max), free(sum) が正しい", C.accent1],
    ["2", "バッチ作成が O(N²)", "(elt *train-images* k) はリストを先頭から辿る。1エポックの約4割。最初に (coerce … vector) で配列化すれば解消", C.accent1],
    ["3", "経過時間の表示が CPU 時間", "unix::runtime は全スレッドの CPU 時間。20スレッドの BLAS では壁時計の十数倍の値が [sec] と表示される", C.accent3],
    ["4", "学習率がバッチサイズに依存", "勾配をバッチで平均せず合計。バッチを変えるなら η も変える必要がある", C.accent3],
    ["5", "未実装の機能", "モーメンタム (*mr*)、dropout、エポックごとのシャッフル。毎バッチ 1000×1000 の dW を新規確保（約 3.5 秒/エポック）", C.accent2],
    ["6", "表示まわり", "draw-test-image の2位候補は真の2位でない場合がある。test-mnist-* は削除済みの mnist-lisp-data.tgz を参照（mlp/ が無いとき）", C.accent2],
  ];
  P.forEach(([n, a, b, c], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.6 + col * 6.15, y = 1.4 + row * 1.85;
    card(s, x, y, 5.95, 1.7);
    tile(s, x + 0.2, y + 0.2, n, c);
    para(s, [{ text: a, options: { bold: true, fontSize: 14, breakLine: true } }, { text: b, options: { fontSize: 13, color: C.accent6 } }], x + 0.8, y + 0.18, 5.0, 1.4);
  });
}
{
  const s = slide("TITLE_DARK", "まとめ");
  s.addText([
    { text: `MNIST（LeCun et al. 1998）の 70,000 枚を、EusLisp＋OpenBLAS の 784-1000-1000-10 全結合NNで学習し、テスト認識率 ${pct(last.test_acc)}（誤り ${last.test_err} 枚）を確認`, options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: "データは元の MNIST と完全一致（逆順・1/255 正規化）。モデル20個すべてを評価し、学習曲線は滑らかに収束", options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: `1エポック ${fmt(prof.epoch.wall, 0)} 秒のうち約4割がリストのバッチ作成。配列化・バッファ再利用で大幅に短縮できる見込み`, options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: "次の一歩: シャッフル・モーメンタム・softmax の free 修正、さらに CNN（LeNet-5）で 1% 未満の誤り率へ", options: { bullet: true } },
  ], { placeholder: "body" });
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
