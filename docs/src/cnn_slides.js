// ---- CNN 版スライド本体 (build_cnn.js から読み込む) ----
const K = JSON.parse(fs.readFileSync(path.join(W, "cnn.json")));
const f1 = (v, d) => Number(v).toFixed(d === undefined ? 1 : d);
const pc = (c) => (c / 100).toFixed(2) + "%";
const fig2 = (f) => path.join(W, "figc", f);
const NN = { mlp: "MLP（CNN なし）", lenet5: "LeNet-5 型 CNN", cnn: "CNN（20/50ch）" };
const NC = { mlp: HEX.accent6, lenet5: HEX.accent3, cnn: HEX.accent2 };
const lastc = (k) => K.train[k][K.train[k].length - 1][3];
const sumt = (k) => K.train[k].reduce((a, r) => a + r[2], 0);
const firstReach = (k, th) => { const r = K.train[k].find((x) => x[3] >= th); return r ? r[0] : null; };
const timeReach = (k, th) => { let t = 0; for (const r of K.train[k]) { t += r[2]; if (r[3] >= th) return t; } return null; };

// =====================================================================
section("タイトル");
{
  const s = slide("TITLE_DARK", "MNIST × EusLisp に CNN を入れる\n認識率と計算時間はどう変わるか");
  s.addText([
    { text: "nn.l の全結合ネット（MLP）に畳み込み（CNN）を加えた版を作り、同じ学習条件で認識率と計算時間を比較。CNN の仕組み・パラメータの効果・用語の説明つき", options: { breakLine: true } },
    { text: `計測環境: DGX Spark — ${K.gpu}, CUDA 13.0 / cuBLAS, OpenBLAS 0.3.26（CPU は OpenMP 10 + OpenBLAS 10 スレッド）`, options: { fontSize: 13, color: "8FA3C8" } },
  ], { placeholder: "body" });
  s.addImage({ path: fig2("conv1_filters.png"), x: 0.8, y: 0.55, w: 6.0, h: 6.0 * 288 / 1280, objectName: "title-filters" });
  s.addText("2026-10-03", { x: 0.8, y: 6.6, w: 4, h: 0.4, fontSize: 12, color: "8FA3C8", margin: 0, isTextBox: true });
}
{
  const s = slide("CONTENT", "概要 — CNN を入れると", "同じ学習条件: SGD, 学習率 0.001（勾配はバッチ和）, バッチ 200, 20 エポック, 初期値 U(−0.08, 0.08)。GPU は FP32。");
  const st = [
    [pc(lastc("mlp")), `MLP（CNN なし）のテスト認識率\n誤り ${10000 - lastc("mlp")} 枚`, C.accent6],
    [pc(lastc("cnn")), `CNN のテスト認識率\n誤り ${10000 - lastc("cnn")} 枚（${f1((10000 - lastc("cnn")) / (10000 - lastc("mlp")) * 100, 0)}% に減少）`, C.accent2],
    [`×${f1(K.epoch.cnn.gpu32 / K.epoch.mlp.gpu32)}`, `1エポックの時間（GPU FP32）\nMLP ${f1(K.epoch.mlp.gpu32, 2)} 秒 → CNN ${f1(K.epoch.cnn.gpu32, 2)} 秒`, C.accent3],
    [`1/${f1(K.nets.mlp.params / K.nets.cnn.params, 1)}`, `パラメータ数\n${(K.nets.mlp.params / 1e6).toFixed(2)}M → ${(K.nets.cnn.params / 1e6).toFixed(2)}M`, C.accent4],
  ];
  const xs = [0.6, 3.7, 6.8, 9.9];
  st.forEach(([b, l, c], i) => {
    card(s, xs[i], 1.45, 2.85, 2.2);
    s.addText(b, { x: xs[i] + 0.2, y: 1.6, w: 2.5, h: 0.95, fontSize: 36, bold: true, color: c, valign: "bottom", margin: 0, isTextBox: true, fit: "shrink" });
    s.addText(l, { x: xs[i] + 0.2, y: 2.65, w: 2.5, h: 0.9, fontSize: 11.5, color: C.accent6, valign: "top", margin: 0, isTextBox: true });
  });
  head(s, 0.6, 3.95, 6, "1", "基本の用語（チャネル・バッチ・エポック・時計 など）", C.text1);
  head(s, 0.6, 4.45, 6, "2", "CNN の働き・LeNet・MLP との違い", C.accent2);
  head(s, 0.6, 4.95, 6, "3", "学習のしくみ（逆伝播・カーネルの変化）", C.accent1);
  head(s, 0.6, 5.45, 6, "4", "パラメータを変えるとどう変わるか", C.accent4);
  head(s, 6.9, 3.95, 6, "5", "認識率の比較", C.accent3);
  head(s, 6.9, 4.45, 6, "6", "計算時間の比較", C.accent1);
  head(s, 6.9, 4.95, 6, "7", "実装と使い方", C.accent6);
  para(s, `CNN は MLP の約 ${f1(K.nets.cnn.flops / K.nets.mlp.flops)} 倍の計算量で、誤りが半分以下になる。98% に届くまでの時間は CNN の方が短い（CNN ${f1(timeReach("cnn", 9800), 1)} 秒 / MLP ${f1(timeReach("mlp", 9800), 1)} 秒）。`, 0.6, 6.1, 12.1, 0.7, { fontSize: 12.5, color: C.accent6, italic: true });
}

// =====================================================================
section("1. 基本の用語");
{
  const s = slide("SECTION", "基本の用語");
  s.addText("ネットワークの形・学習の進め方・計算機・時間の測り方の言葉", { placeholder: "body" });
  tile(s, 0.9, 2.75, "1", C.accent6, 1.2);
}
{
  const s = slide("CONTENT", "用語（1）ネットワークの形", "カーネルという言葉は、畳み込みの重み（このページ）と GPU で動くプログラム（計算機のページ）の2つの意味で使われる。");
  table(s, [
    ["用語", "意味", "なぜあるか"],
    ["層（レイヤー）", "入力に決まった計算をして次へ渡す1段", "簡単な変換を重ねて複雑な判断を作る"],
    ["全結合（FC, MLP）", "全入力と全出力を重みでつなぐ層。MLP はこれだけの多層ネット", "どんな入出力の関係も表せる汎用の部品"],
    ["畳み込み（conv）", "小さな重みの窓を画像の上でずらしながら掛け合わせる", "近くの画素どうしの形（線・角）を見つける"],
    ["カーネル / フィルタ", "畳み込みの重みの窓（5×5 など）。学習で値が決まる", "1つのカーネルが1種類の形を見つける"],
    ["カーネルサイズ", "窓の大きさ（3×3, 5×5, 7×7）", "一度に見る範囲。大きいほど広い形を見る"],
    ["チャネル", "1つの位置が持つ値の個数。入力は濃淡の1チャネル、畳み込みの出力はカーネルの数", "何種類の形を同時に調べるか"],
    ["特徴マップ", "1つのカーネルの出力（どこにその形があるかの地図）", "次の層はこの地図の組合せを見る"],
    ["プーリング", "2×2 の範囲の最大値を取り、縦横を半分にする", "大きさを減らし、少しの位置ずれを吸収する"],
    ["ストライド / パディング", "窓をずらす幅 / 画像の周りに 0 を足すこと（本実装は 1 / なし）", "出力の大きさを調整する"],
    ["ReLU", "負の値を 0 にする関数 max(0, u)", "非線形にして層を重ねる意味を持たせる"],
    ["Softmax", "10 個の出力を合計 1 の確率にする", "どの数字かを確率として表す"],
  ], 0.6, 1.35, 12.1, [2.3, 5.3, 4.5], 11.5, { rowH: 0.43 });
}
{
  const s = slide("CONTENT", "用語（2）学習の進め方", "本実装の値: バッチ 200, 学習率 0.001, 20 エポック → 300 回 × 20 = 6,000 回の更新。");
  table(s, [
    ["用語", "意味", "なぜあるか / 本実装の値"],
    ["パラメータ（重み・バイアス）", "学習で変える数。W（掛ける）と b（足す）", "MLP 180 万個、CNN 43 万個"],
    ["損失（交差エントロピー）", "正解の確率 p に対する −log p", "小さくするほど正解に自信を持つ。学習の目標"],
    ["勾配", "損失をパラメータで微分した値（どちらに動かせば損失が減るか）", "誤差逆伝播法で全パラメータの勾配を一度に求める"],
    ["学習率", "1 回の更新で勾配の何倍動かすか", "大きいと速いが不安定、小さいと遅い。0.001"],
    ["バッチ（ミニバッチ）", "1 回の更新に使う画像の束", "1 枚ずつより勾配が安定し、行列計算でまとめて速く計算できる。200 枚"],
    ["イテレーション（更新）", "1 バッチ分の学習（順伝播→逆伝播→更新）", "60,000 / 200 = 300 回で 1 エポック"],
    ["エポック", "学習データ全部を 1 回ずつ使い切る単位", "何周学習したかの目安。20 エポック"],
    ["過学習", "学習データだけに合いすぎて新しいデータで間違える", "テストデータで確かめる理由"],
    ["学習データ / テストデータ", "学習に使う 60,000 枚 / 性能を測るだけの 10,000 枚", "見たことのない字で正しく読めるかを測る"],
  ], 0.6, 1.35, 12.1, [2.9, 4.9, 4.3], 11.5, { rowH: 0.47 });
}
{
  const s = slide("CONTENT", "用語（3）計算機まわり", "FLOP（演算数）と FLOPS（1 秒あたりの演算数）は別のもの。");
  table(s, [
    ["用語", "意味", "なぜあるか / 本実装では"],
    ["CPU / GPU", "汎用の演算装置 / 同じ計算を数千並列で行う装置", "行列計算は GPU が得意。GB10 は 48 SM"],
    ["スレッド", "同時に動く処理の流れ。CPU は 20 コア", "多すぎると取り合いで遅くなる（OpenMP 10 + BLAS 10 が最速だった）"],
    ["FP64 / FP32", "倍精度（64bit）/ 単精度（32bit）の浮動小数点", "EusLisp の float は FP64。GB10 は FP32 が約 40 倍速い"],
    ["FLOP / FLOPS", "演算の回数 / 1 秒あたりの演算回数（TFLOPS = 10¹² 回/秒）", "MLP 1 枚 3.6 MFLOP、CNN 1 枚 4.6 MFLOP（順伝播）"],
    ["BLAS / gemm", "行列計算の標準ライブラリ / 行列積 C = αAB + βC", "OpenBLAS（CPU）、cuBLAS（GPU）"],
    ["GPU カーネル", "GPU 上で並列に動く関数（畳み込みのカーネルとは別）", "ReLU・pooling・im2col などは自作のカーネル"],
    ["im2col", "畳み込みの窓を行列の行に並べ直す方法", "畳み込みを gemm 1 回で計算できる"],
    ["NHWC", "画像の並び（枚, 縦, 横, チャネル）", "im2col と全結合が自然につながる"],
  ], 0.6, 1.35, 12.1, [2.2, 5.1, 4.8], 12, { rowH: 0.5 });
}
{
  const s = slide("CONTENT", "時間の測り方 — 壁時計時間と CPU 時間とその他の時計", "このスライド群の時間はすべて「GPU の処理を待ってから測った壁時計時間（単調時計）」。");
  table(s, [
    ["時計", "何を測るか", "取り方（例）", "注意点"],
    [hl("壁時計時間 (wall-clock)"), "開始から終了までの実際の経過時間。人が待つ時間", "unix:gettimeofday, clock_gettime(CLOCK_REALTIME), time の real", "他のプロセスの負荷でも伸びる"],
    ["単調時計 (monotonic)", "壁時計と同じく経過時間。ただし時刻合わせで戻らない", "CLOCK_MONOTONIC, std::chrono::steady_clock", "区間の計測に最適（cudacnn.cu の層ごとの計測）"],
    ["CPU 時間（プロセス）", "CPU が実際に働いた時間の合計。全スレッドの合計", "unix:runtime（1/100 秒単位）, time の user+sys", "20 スレッドなら壁時計の最大 20 倍。nn.l の [sec] はこれ"],
    ["ユーザー / システム時間", "自分のプログラム / OS（メモリ確保・入出力）の CPU 時間", "time コマンドの user / sys", "待ちスピンもユーザー時間に入る"],
    ["スレッド CPU 時間", "1 つのスレッドの CPU 時間", "CLOCK_THREAD_CPUTIME_ID", "並列処理の偏りを見る"],
    ["GPU 時間", "GPU 上での処理時間", "cudaEvent, Nsight Systems", "GPU は非同期。同期せずに測ると速く見える"],
  ], 0.6, 1.35, 12.1, [2.4, 3.3, 3.5, 2.9], 11.5, { rowH: 0.62 });
  para(s, "例（前回）: 1 エポックの壁時計 31.9 秒に対し CPU 時間 576 秒。OpenBLAS の 20 スレッドが待ちの間も CPU を使うため、CPU 時間は「かかった時間」ではない。", 0.6, 6.15, 12.1, 0.7, { fontSize: 12.5, color: C.accent1 });
}

// =====================================================================
section("2. CNN は何をするか");
{
  const s = slide("SECTION", "CNN は何をするか・なぜ MLP より良いか");
  s.addText("畳み込み・プーリングの働き、全体の構成、LeNet、MLP との違いを実験で確かめる", { placeholder: "body" });
  tile(s, 0.9, 2.75, "2", C.accent2, 1.2);
}
{
  const s = slide("CONTENT", "畳み込みは何をするか", "図は学習後の CNN の第 1 層のカーネルの 1 つ。数字 6 の横向きの筆跡の上側の縁で強く反応している。");
  s.addImage({ path: fig2("conv_illust.png"), x: 0.5, y: 1.3, w: 7.6, h: 7.6 * 561 / 1530, objectName: "conv-illust" });
  bullets(s, [
    "5×5 の窓（カーネル）を 1 画素ずつずらし、窓の中の画素とカーネルの重みを掛けて足す",
    "窓の中の形がカーネルの模様に似ているほど大きな値になる → 「どこにその形があるか」の地図（特徴マップ）",
    "同じカーネルを画像のどこでも使う（重み共有）→ 場所が変わっても同じ形を見つけられ、重みも 25 個で済む",
    "カーネルを 20 個使えば 20 種類の形を調べられる（出力 20 チャネル）",
    "2 層目は 1 層目の 20 枚の地図を組み合わせて、より大きな部品（曲線・交差・輪）を見る",
  ], 0.6, 4.35, 7.5, 2.5, 12.5);
  head(s, 8.5, 1.4, 4.2, "≡", "計算は行列積にできる（im2col）", C.text1);
  bullets(s, [
    "窓の中の 25 画素を 1 行に並べた行列（576 行 × 25 列 / 1 枚）を作る",
    "それにカーネル（20 × 25）を掛ければ 20 枚の特徴マップが一度に出る",
    "逆伝播も行列積 2 回（重みの勾配・入力の勾配）",
  ], 8.5, 1.95, 4.2, 2.5, 12.5);
  head(s, 8.5, 4.5, 4.2, "M", "MLP との違い", C.accent1);
  para(s, "MLP の 1 層目は 784 画素すべてに別々の重みを持つ（1,000 ユニット × 784）。画素の並び（どれが隣か）を使わない。", 8.5, 5.05, 4.2, 1.7, { fontSize: 12.5 });
}
{
  const s = slide("CONTENT", "プーリングは何をするか・CNN の全体構成", "pooling は重みを持たない。ReLU の前後どちらに置いても結果は同じ（最大値と max(0, ·) は順番を入れ替えられる）。");
  s.addImage({ path: fig2("pool_illust.png"), x: 0.6, y: 1.35, w: 4.4, h: 4.4 * 442 / 850, objectName: "pool-illust" });
  bullets(s, [
    "2×2 の中の最大値だけを残す → 縦横が半分、データは 1/4",
    "1 画素くらいずれても最大値は同じ → 位置ずれに強くなる",
    "後ろの層の計算と重みが減る",
  ], 0.6, 3.85, 4.4, 2.3, 12.5);
  // 構成図
  const L = [
    ["入力", "28×28×1", C.accent6], ["conv 5×5", "24×24×20", C.accent2], ["pool", "12×12×20", C.accent4], ["conv 5×5", "8×8×50", C.accent2],
    ["pool", "4×4×50", C.accent4], ["全結合", "500", C.accent1], ["全結合", "10", C.accent1],
  ];
  L.forEach(([a, b, c], i) => {
    const y = 1.35 + i * 0.75;
    s.addText([{ text: a + "  ", options: { bold: true } }, { text: b }], { x: 5.5, y, w: 2.6, h: 0.55, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, fill: { color: c }, color: C.background1, fontSize: 13, align: "center", valign: "middle", margin: 0, isTextBox: true });
    if (i < L.length - 1) s.addShape(pres.shapes.DOWN_ARROW, { x: 6.65, y: y + 0.56, w: 0.3, h: 0.18, fill: { color: C.text1 }, line: { type: "none" } });
  });
  table(s, [["層", "パラメータ", "1 枚の積和"],
    ["conv1 20@5×5", "520", "288,000"], ["conv2 50@5×5×20", "25,050", "1,600,000"], ["全結合 800→500", "400,500", "400,000"], ["全結合 500→10", "5,010", "5,000"],
    [hl("合計"), hl("431,080"), hl("2,293,000")]], 8.5, 1.35, 4.25, [1.85, 1.2, 1.2], 11.5);
  para(s, "conv2 が計算の 7 割、全結合 800→500 がパラメータの 9 割を占める。MLP（1,794,000 積和）より計算は多いがパラメータは 1/4。", 8.5, 4.2, 4.25, 1.6, { fontSize: 12 });
  para(s, "ReLU は各畳み込み・全結合の後（図では省略）", 5.5, 6.65, 3.0, 0.3, { fontSize: 10.5, color: C.accent6 });
}
{
  const s = slide("CONTENT", "LeNet とは — LeCun の CNN と本実装の 2 つの CNN", "LeNet は Yann LeCun（ルカン）らが Bell 研究所で作った CNN の系列。LeNet-1（1989, 郵便番号の読み取り）から始まり、LeNet-5 は MNIST の原論文（Proc. IEEE, 1998）で発表された。");
  table(s, [["", "元の LeNet-5（1998）", "本実装「LeNet-5 型」", "本実装「CNN（20/50ch）」"],
    ["入力", "32×32（28×28 の周りに 2 画素ずつ余白）", "28×28（余白なし）", "28×28"],
    ["畳み込み 1", "C1: 5×5, 6 枚 → 28×28×6", "5×5, 6 枚 → 24×24×6", "5×5, 20 枚 → 24×24×20"],
    ["縮小 1", "S2: 2×2 の平均（学習する係数つき）→ 14×14", "2×2 の最大値 → 12×12", "2×2 の最大値 → 12×12"],
    ["畳み込み 2", "C3: 5×5, 16 枚（入力 6 枚の一部とだけつなぐ）→ 10×10", "5×5, 16 枚（全部とつなぐ）→ 8×8", "5×5, 50 枚 → 8×8"],
    ["縮小 2", "S4: 平均 → 5×5×16", "最大値 → 4×4×16", "最大値 → 4×4×50"],
    ["全結合", "C5: 120 → F6: 84", "120 → 84", "500"],
    ["出力", "10（RBF: 手本との距離）", "10（Softmax）", "10（Softmax）"],
    ["活性化関数", "tanh（1.7159·tanh(2u/3)）", "ReLU", "ReLU"],
    ["パラメータ", "約 6 万", "44,426", "431,080"],
    ["テスト誤り率", "0.95%（変形データで 0.8%）", `${f1(100 - lastc("lenet5") / 100, 2)}%（20 エポック）`, `${f1(100 - lastc("cnn") / 100, 2)}%（20 エポック）`]],
    0.6, 1.35, 12.1, [1.6, 4.1, 3.2, 3.2], 11.5, { rowH: 0.43 });
  para(s, "「CNN（20/50ch）」は深層学習ライブラリ Caffe の MNIST 例題（lenet_train_test.prototxt）と同じ構成で、「LeNet」と呼ばれることが多い。どちらも LeNet-5 の考え方（畳み込み → 縮小 → 畳み込み → 縮小 → 全結合）を今の標準的な部品（ReLU・最大値プーリング・Softmax）で作り直したもの。", 0.6, 6.15, 12.1, 0.75, { fontSize: 11.5, color: C.accent6 });
}
{
  const s = slide("CONTENT", "学習した CNN の中身 — カーネルと特徴マップ", "上: 第 1 層の 20 個のカーネル（赤 = 正、青 = 負）。中: 数字 6 を入れたときの第 1 層の 20 枚の特徴マップ。下: 第 2 層の 50 枚のうち 20 枚。");
  s.addImage({ path: fig2("input0.png"), x: 0.6, y: 1.45, w: 2.2, h: 2.2, objectName: "fm-input" });
  para(s, "入力（テスト #0, 6）", 0.6, 3.7, 2.2, 0.3, { fontSize: 11, color: C.accent6 });
  const rows = [["conv1_filters.png", "第 1 層のカーネル 5×5（20 個）"], ["fmap1.png", "第 1 層の特徴マップ 24×24（20 枚）"], ["fmap2.png", "第 2 層の特徴マップ 8×8（50 枚中 20 枚）"]];
  rows.forEach(([f, t], i) => {
    const y = 1.3 + i * 1.7;
    s.addImage({ path: fig2(f), x: 3.2, y, w: 6.6, h: 6.6 * 288 / 1280, objectName: nm("fm") });
    para(s, t, 10.6, y + 0.4, 2.2, 0.9, { fontSize: 12 });
  });
  para(s, "第 1 層は縦・横・斜めの縁を、第 2 層はそれらを組み合わせた部品（輪の一部・端点など）を見つけている。", 0.6, 6.55, 12.1, 0.4, { fontSize: 12.5 });
}
{
  const s = slide("CONTENT", "なぜ性能が上がるか（1）— 位置ずれに強い", "テスト画像全体を左右にずらして認識させた（学習はずらしていない画像のまま）。回転は画像の中心まわり。");
  const sh = K.analysis.shifts.map((v) => (v > 0 ? "+" : "") + v);
  s.addChart(pres.charts.LINE, ["mlp", "lenet5", "cnn"].map((k) => ({ name: NN[k], labels: sh, values: K.analysis.shift[k].map((v) => +(v * 100).toFixed(2)) })), Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 6.2, h: 4.2, chartColors: [NC.mlp, NC.lenet5, NC.cnn], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 6,
    valAxisMinVal: 30, valAxisMaxVal: 100, showLegend: true, legendPos: "t", legendFontSize: 11, showTitle: true, title: "左右にずらした画素数とテスト認識率 [%]", objectName: "shift-chart",
  }));
  const ro = K.analysis.rots.map((v) => (v > 0 ? "+" : "") + v + "°");
  s.addChart(pres.charts.LINE, ["mlp", "lenet5", "cnn"].map((k) => ({ name: NN[k], labels: ro, values: K.analysis.rot[k].map((v) => +(v * 100).toFixed(2)) })), Object.assign(chartBase(), {
    x: 6.9, y: 1.3, w: 5.9, h: 4.2, chartColors: [NC.mlp, NC.lenet5, NC.cnn], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 6,
    valAxisMinVal: 60, valAxisMaxVal: 100, showLegend: true, legendPos: "t", legendFontSize: 11, showTitle: true, title: "回転させた角度とテスト認識率 [%]", objectName: "rot-chart",
  }));
  s.addImage({ path: fig2("shift_examples.png"), x: 0.6, y: 5.6, w: 4.6, h: 4.6 * 240 / 1050, objectName: "shift-ex" });
  const i2 = K.analysis.shifts.indexOf(2);
  para(s, `2 画素ずらすと MLP は ${f1(K.analysis.shift.mlp[i2] * 100)}% に落ちるが、CNN は ${f1(K.analysis.shift.cnn[i2] * 100)}% を保つ。MLP は「どの画素に字があるか」を覚え、CNN は「どんな形があるか」を見ているため。`, 5.5, 5.65, 7.2, 1.2, { fontSize: 12.5 });
}
{
  const s = slide("CONTENT", "なぜ性能が上がるか（2）— 画素の並びを使っている", "784 画素の並びを固定の乱順に入れ替えたデータで学習・テストした（学習もテストも同じ入れ替え）。初期値は両方とも U(−0.08, 0.08) の同じ乱数列。");
  const P = K.permute;
  s.addImage({ path: fig2("permuted.png"), x: 0.6, y: 1.4, w: 4.6, h: 4.6 * 480 / 900, objectName: "perm-img" });
  s.addChart(pres.charts.BAR, [
    { name: "元の画像", labels: ["MLP", "CNN"], values: [+P.mlp_orig[19].toFixed(2), +P.cnn_orig[19].toFixed(2)] },
    { name: "画素を入れ替えた画像", labels: ["MLP", "CNN"], values: [+P.mlp_perm[19].toFixed(2), +P.cnn_perm[19].toFixed(2)] },
  ], Object.assign(chartBase(), {
    x: 5.5, y: 1.3, w: 7.2, h: 3.6, barDir: "col", chartColors: [HEX.accent2, HEX.accent1], showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 11, dataLabelColor: HEX.dk1, dataLabelFormatCode: "0.00",
    valAxisMinVal: 90, valAxisMaxVal: 100, showLegend: true, legendPos: "b", legendFontSize: 11, showTitle: true, title: "20 エポック後のテスト認識率 [%]", objectName: "perm-chart",
  }));
  bullets(s, [
    `MLP は入れ替えても同じ（${f1(P.mlp_orig[19], 2)}% → ${f1(P.mlp_perm[19], 2)}%）: 全結合は画素の並びを最初から使っていない`,
    `CNN は大きく落ちる（${f1(P.cnn_orig[19], 2)}% → ${f1(P.cnn_perm[19], 2)}%）: 隣の画素どうしの関係（局所性）を使って性能を上げている`,
    "画像には「近い画素ほど関係が深い」「同じ形がどこにでも出る」という性質がある。CNN はそれを構造として持ち込むので、少ない重みで汎化する",
  ], 0.6, 5.1, 12.1, 1.8, 12.5);
}
{
  const s = slide("CONTENT", "なぜ性能が上がるか（3）— まとめ", "");
  const P = [
    ["局所性", "畳み込みは近くの画素だけを見る。線や角など、字を作る部品は数画素の範囲にある", C.accent2],
    ["重み共有", "同じカーネルを画像全体で使う。どこに書かれても同じ形として扱え、重みが少ないので過学習しにくい（学習データにだけ合いすぎない）", C.accent4],
    ["位置ずれへの強さ", "プーリングで少しのずれを吸収。手書き文字の位置・大きさのばらつきに強い", C.accent3],
    ["階層的な特徴", "1 層目で縁、2 層目で部品、全結合で数字、と段階的に組み立てる", C.accent1],
  ];
  P.forEach(([a, b, c], i) => {
    const y = 1.4 + i * 1.1;
    card(s, 0.6, y, 7.3, 0.95);
    tile(s, 0.8, y + 0.2, String(i + 1), c, 0.55);
    para(s, [{ text: a, options: { bold: true, fontSize: 15, breakLine: true } }, { text: b, options: { fontSize: 12, color: C.accent6 } }], 1.55, y + 0.08, 6.2, 0.85);
  });
  head(s, 8.3, 1.45, 4.4, "!", "MLP の弱点", C.accent1);
  bullets(s, [
    "784 画素を互いに無関係な 784 個の数として扱う",
    "1 画素ずれただけで、別の入力に見える",
    "その分、多くの重み（180 万個）と学習データが必要",
    "学習データには 99.97% 合うのに、テストは 98.2% で止まる（過学習）",
  ], 8.3, 2.0, 4.4, 3.2, 12.5);
  para(s, `CNN: 学習データ ${pc(K.trainacc.cnn / 6)} / テスト ${pc(lastc("cnn"))}（差 ${f1(K.trainacc.cnn / 600 - lastc("cnn") / 100, 2)} ポイント）、MLP: ${pc(K.trainacc.mlp / 6)} / ${pc(lastc("mlp"))}（差 ${f1(K.trainacc.mlp / 600 - lastc("mlp") / 100, 2)} ポイント）`, 0.6, 5.95, 12.1, 0.8, { fontSize: 12.5, bold: true, color: C.accent2 });
}

// =====================================================================
// ---- 「学習のしくみ」の節 (cnn_slides.js の section("4. パラメータの効果") の前に入る) ----
section("3. 学習のしくみ");
{
  const s = slide("SECTION", "学習のしくみ — 誤差逆伝播");
  s.addText("全結合（MLP）の学習処理 → CNN の逆伝播とカーネルの各チャネルの更新 → 学習でカーネルはどう変わるか", { placeholder: "body" });
  tile(s, 0.9, 2.75, "3", C.accent1, 1.2);
}
{
  const s = slide("CONTENT", "MLP の学習処理（1）— 順伝播と誤差逆伝播の流れ", "nn.l の :train-batch と同じ。1 回の更新はバッチ 200 枚をまとめて行列で計算する。");
  const L = [["入力 x", "200×784", C.accent6], ["層 1", "200×1000", C.accent2], ["層 2", "200×1000", C.accent2], ["出力 y", "200×10", C.accent1]];
  L.forEach(([a, b, c], i) => {
    const x = 0.6 + i * 3.15;
    s.addText([{ text: a, options: { bold: true, fontSize: 15, breakLine: true } }, { text: b, options: { fontSize: 11 } }], { x, y: 1.45, w: 2.3, h: 0.95, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.08, fill: { color: c }, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
    if (i < 3) {
      s.addShape(pres.shapes.RIGHT_ARROW, { x: x + 2.35, y: 1.5, w: 0.75, h: 0.3, fill: { color: C.accent2 }, line: { type: "none" } });
      s.addShape(pres.shapes.LEFT_ARROW, { x: x + 2.35, y: 2.05, w: 0.75, h: 0.3, fill: { color: C.accent1 }, line: { type: "none" } });
    }
  });
  para(s, [{ text: "→ 順伝播（青）", options: { color: C.accent2, bold: true } }, { text: "　　← 誤差 δ の逆伝播（赤）", options: { color: C.accent1, bold: true } }], 0.6, 2.5, 12, 0.35, { fontSize: 12 });
  table(s, [["手順", "式", "意味"],
    ["① 順伝播", "uₗ = zₗ₋₁ Wₗᵀ + bₗ,   zₗ = ReLU(uₗ)（最後は Softmax）", "各層の u と z を覚えておく（逆伝播で使う）"],
    ["② 損失", "L = −Σ log yₙ,正解", "正解の確率が小さいほど大きい"],
    ["③ 出力の誤差", "δ₃ = y − t（t は正解だけ 1 の列）", "正解の確率は上げ、他は下げる向き"],
    ["④ 誤差の逆伝播", "δₗ = (δₗ₊₁ Wₗ₊₁) ⊙ ReLU′(uₗ)", "上の層の誤差を同じ重みで下へ配る。u < 0 のユニットには伝わらない"],
    ["⑤ 勾配", "ΔWₗ = δₗᵀ zₗ₋₁,   Δbₗ = Σₙ δₗ", "バッチ 200 枚分の和"],
    ["⑥ 更新", "Wₗ ← Wₗ − η ΔWₗ,   bₗ ← bₗ − η Δbₗ", "η = 0.001。全層の δ を求めてから更新する"]], 0.6, 2.95, 12.1, [1.7, 5.4, 5.0], 12, { rowH: 0.52 });
}
{
  const s = slide("CONTENT", "MLP の学習処理（2）— 1 本の重みはどう更新されるか", "ΔW = δᵀ z を 1 要素ずつ書くと右の式になる。行列積はこれを全要素まとめて計算している。");
  // 2 ユニットの図
  s.addShape(pres.shapes.OVAL, { x: 0.9, y: 2.0, w: 1.1, h: 1.1, fill: { color: C.accent6 }, line: { type: "none" } });
  s.addText("j", { x: 0.9, y: 2.0, w: 1.1, h: 1.1, fontSize: 22, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addShape(pres.shapes.OVAL, { x: 4.6, y: 2.0, w: 1.1, h: 1.1, fill: { color: C.accent2 }, line: { type: "none" } });
  s.addText("i", { x: 4.6, y: 2.0, w: 1.1, h: 1.1, fontSize: 22, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
  s.addShape(pres.shapes.LINE, { x: 2.0, y: 2.55, w: 2.6, h: 0, line: { color: C.text1, width: 2.5, endArrowType: "triangle" } });
  para(s, "重み Wᵢⱼ", 2.6, 2.1, 1.6, 0.4, { fontSize: 14, bold: true, align: "center" });
  para(s, "入力側の値 zⱼ", 0.5, 3.2, 2.0, 0.4, { fontSize: 12, align: "center", color: C.accent6 });
  para(s, "出力側の誤差 δᵢ", 4.1, 3.2, 2.1, 0.4, { fontSize: 12, align: "center", color: C.accent2 });
  card(s, 0.6, 3.85, 5.6, 1.2, "FBE7DF");
  para(s, [{ text: "ΔWᵢⱼ = Σₙ δᵢ⁽ⁿ⁾ · zⱼ⁽ⁿ⁾", options: { bold: true, fontSize: 20, breakLine: true } }, { text: "（n はバッチの 200 枚）　Wᵢⱼ ← Wᵢⱼ − η ΔWᵢⱼ", options: { fontSize: 12.5 } }], 0.8, 3.95, 5.3, 1.0, { align: "center" });
  bullets(s, [
    "「入力側がどれだけ働いたか（zⱼ）」×「出力側がどれだけ間違えたか（δᵢ）」で決まる",
    "zⱼ = 0（ReLU で止まっている・画素が黒）なら、その重みは変わらない",
    "δᵢ > 0（出力が大きすぎた）なら重みを減らし、δᵢ < 0 なら増やす",
  ], 0.6, 5.25, 5.6, 1.6, 12.5);
  head(s, 6.6, 1.45, 6.1, "δ", "誤差 δ の求め方（連鎖律）", C.accent1);
  card(s, 6.6, 2.0, 6.1, 1.0);
  para(s, [{ text: "δⱼ = ( Σᵢ Wᵢⱼ δᵢ ) × ReLU′(uⱼ)", options: { bold: true, fontSize: 17 } }], 6.8, 2.1, 5.8, 0.8, { valign: "middle" });
  bullets(s, [
    "下の層のユニット j の誤差は、つながっている上の層の誤差 δᵢ を重み Wᵢⱼ で集めたもの",
    "ReLU′(u) は u ≥ 0 で 1、u < 0 で 0（nn.l の定義）。止まっていたユニットには誤差が戻らない",
    "出力層は δ = y − t。Softmax と交差エントロピーを組み合わせると、この簡単な形になる",
  ], 6.6, 3.15, 6.1, 2.2, 12.5);
  head(s, 6.6, 5.35, 6.1, "#", "1 回の更新で計算する量", C.accent6);
  para(s, "層 1 の重み 784,000 個それぞれに 200 枚分の積の和。3 層で 179 万個の重みを一度に更新する（行列積 3 回 + 逆伝播の行列積 2 回）。", 6.6, 5.85, 6.1, 1.0, { fontSize: 12.5 });
}
{
  const s = slide("CONTENT", "CNN の学習処理（1）— 層ごとの逆伝播", "全体の流れは MLP と同じ（順伝播で値を覚える → 出力の誤差 → 下へ逆伝播 → 勾配で更新）。層の種類ごとに誤差の戻し方が違う。");
  table(s, [["層", "順伝播", "誤差の戻し方（δ_in）", "重みの勾配"],
    ["全結合", "u = z Wᵀ + b", "δ_in = (δ W) ⊙ ReLU′ … MLP と同じ", "ΔW = δᵀ z,  Δb = Σ δ"],
    ["ReLU", "z = max(0, u)", "u ≥ 0 の所だけそのまま通し、他は 0", "なし"],
    ["最大値プーリング", "2×2 の最大値を取る（位置を覚える）", "最大だった 1 か所にだけ戻す。他の 3 か所は 0", "なし"],
    [hl("畳み込み"), "5×5 の窓で掛けて足す（im2col + 行列積）", "カーネルを 180° 回した全畳み込み（col2im で集める）", "入力と δ の相関（次のスライド）"]], 0.6, 1.35, 12.1, [1.9, 3.3, 3.9, 3.0], 12.5, { rowH: 0.62 });
  const F = [["入力", C.accent6], ["conv1", C.accent2], ["ReLU", "A9B4C4"], ["pool", C.accent4], ["conv2", C.accent2], ["ReLU", "A9B4C4"], ["pool", C.accent4], ["fc500", C.accent1], ["ReLU", "A9B4C4"], ["fc10", C.accent1], ["Softmax", C.text1]];
  F.forEach(([a, c], i) => {
    const x = 0.6 + i * 1.105;
    s.addText(a, { x, y: 4.75, w: 0.95, h: 0.55, shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: 0.06, fill: { color: c }, color: C.background1, fontSize: 11.5, bold: true, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  s.addShape(pres.shapes.RIGHT_ARROW, { x: 0.6, y: 4.35, w: 12.0, h: 0.28, fill: { color: C.accent2 }, line: { type: "none" } });
  s.addShape(pres.shapes.LEFT_ARROW, { x: 0.6, y: 5.42, w: 12.0, h: 0.28, fill: { color: C.accent1 }, line: { type: "none" } });
  para(s, [{ text: "順伝播 → ", options: { color: C.accent2, bold: true } }, { text: "　← 逆伝播（δ = y − t から始めて下へ）", options: { color: C.accent1, bold: true } }], 0.6, 5.8, 12.1, 0.35, { fontSize: 12 });
  para(s, "重みを持つのは conv1, conv2, fc500, fc10 の 4 層だけ。ReLU とプーリングは誤差の通り道を決めるだけで、学習するものはない。", 0.6, 6.25, 12.1, 0.6, { fontSize: 12.5 });
}
{
  const s = slide("CONTENT", "CNN の学習処理（2）— カーネルの各チャネルはどう更新されるか", "記号: n = 画像, (oy, ox) = 出力の位置, (ky, kx) = カーネル内の位置, c = 入力チャネル, co = 出力チャネル（= カーネルの番号）。");
  card(s, 0.6, 1.35, 7.3, 2.75, "EEF1F6");
  para(s, [
    { text: "カーネルの勾配", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "ΔW[co, c, ky, kx] = Σₙ Σ_oy Σ_ox δ[n, oy, ox, co] · x[n, oy+ky, ox+kx, c]", options: { fontSize: 12.5, bold: true, breakLine: true } },
    { text: "バイアス", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "Δb[co] = Σₙ Σ_oy Σ_ox δ[n, oy, ox, co]", options: { fontSize: 12.5, bold: true, breakLine: true } },
    { text: "下の層へ戻す誤差", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "δx[n, y, x, c] = Σ_co Σ_ky Σ_kx δ[n, y−ky, x−kx, co] · W[co, c, ky, kx]", options: { fontSize: 12.5, bold: true, breakLine: true } },
    { text: "更新は全結合と同じ:  W ← W − η ΔW,  b ← b − η Δb", options: { fontSize: 13 } },
  ], 0.8, 1.45, 7.0, 2.6, { fontSize: 12.5 });
  bullets(s, [
    "出力チャネル co のカーネルは、自分の出力に戻ってきた誤差の地図 δ_co だけで更新される（他のカーネルの誤差は使わない）",
    "その中の入力チャネル c の 5×5 は「入力の地図 c」と「δ_co」の相関。δ が大きい位置の入力の 5×5 の窓を、δ の重みで足し合わせたもの",
    "重み共有なので、勾配は全位置・全画像の和になる。1 つの重みの勾配は conv1 で 200 枚 × 576 位置 = 115,200 個、conv2 で 200 × 64 = 12,800 個の積の和",
  ], 0.6, 4.3, 7.3, 2.6, 12);
  head(s, 8.3, 1.4, 4.4, "▦", "conv2 のカーネルの形", C.accent2);
  // 50 x 20 x 5x5 の図
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 6; c++) {
      s.addShape(pres.shapes.RECTANGLE, { x: 8.4 + c * 0.42, y: 2.0 + r * 0.42, w: 0.36, h: 0.36, fill: { color: (r + c) % 2 ? "BFD3EA" : "E3ECF7" }, line: { color: "8FA9C8", width: 0.5 } });
    }
  }
  para(s, "…", 10.95, 2.55, 0.4, 0.4, { fontSize: 16 });
  para(s, "横: 入力 c（20）\n縦: 出力 co（50）\n1 マス = 5×5", 11.35, 2.0, 1.45, 1.6, { fontSize: 10.5, color: C.accent6 });
  bullets(s, [
    "W は 50 × (20 × 5 × 5) = 25,000 個",
    "1 行（co）が 1 つのカーネル。20 枚の入力の地図をそれぞれ 5×5 で見て、全部足して 1 枚の出力の地図を作る",
    "conv1 は入力が 1 チャネルなので 20 × (1 × 5 × 5)",
  ], 8.3, 3.85, 4.45, 2.4, 11.5);
  head(s, 8.3, 5.95, 4.4, "≡", "実装（cudacnn.cu）", C.text1);
  para(s, "ΔW = δᵀ · col（行列積 1 回）、δx は δ · W（行列積）→ col2im で 5×5 の重なりを足し戻す", 8.3, 6.4, 4.45, 0.6, { fontSize: 11 });
}
{
  const s = slide("CONTENT", "CNN の学習処理（3）— 1 枚の画像で見るカーネルの勾配", `学習後の CNN にテスト #0（6）を入れ、第 1 層のカーネル ${K.gradfig.k} の勾配を自動微分で求めた。手計算（右の式）と 1×10⁻²⁶ 以下の差で一致。`);
  s.addImage({ path: fig2("conv_grad.png"), x: 0.5, y: 1.3, w: 12.3, h: 12.3 * 465 / 1920, objectName: "conv-grad" });
  bullets(s, [
    `誤差 δ が戻ってきたのは 576 位置のうち ${K.gradfig.nz} か所だけ。最大値プーリングで選ばれた位置（4 か所に 1 か所）で、しかも上の層で使われた所に限られる`,
    "勾配 ΔW = Σ δ(oy, ox) × [入力の (oy, ox) から始まる 5×5 の窓]。δ が大きい位置の筆跡の形が勾配に写る",
    "更新は W ← W − η ΔW。勾配の逆向きに少し動かすので、この画像の損失が減る方向にカーネルの形が変わる",
    "実際の更新は 200 枚分の勾配の和で行う。1 枚ごとのばらつきは平均され、多くの字に共通する形がカーネルに残る",
  ], 0.6, 4.5, 12.1, 2.4, 12.5);
}
{
  const s = slide("CONTENT", "学習でカーネルはどう変わるか", "CNN（20/50ch）の第 1 層の 20 個のカーネル（5×5）を、学習前と 1・5・20 エポック後に取り出した。色の範囲は 20 エポック後に合わせてある（赤 = 正、青 = 負）。");
  s.addImage({ path: fig2("kernels_epochs.png"), x: 0.5, y: 1.3, w: 12.3, h: 12.3 * 464 / 1920, objectName: "kern-epochs" });
  const k = K.kern;
  stat(s, 0.6, 4.45, 3.0, f1(k.absmax["20"], 2), `重みの絶対値の最大（20 エポック後）\n初期値は ${f1(k.absmax["0"], 2)}`, C.accent1);
  stat(s, 3.9, 4.45, 3.0, `×${f1(k.norm["20"] / k.norm["0"])}`, `重み全体の大きさ（ノルム）\n1 エポック後で既に ×${f1(k.norm["1"] / k.norm["0"])}`, C.accent2);
  const cr = k.per_kernel_corr_init_vs_20;
  stat(s, 7.2, 4.45, 2.6, f1(cr.reduce((a, b) => a + b, 0) / cr.length, 2), `初期値との形の相関（平均）\nカーネルごとに ${f1(Math.min(...cr), 2)}〜${f1(Math.max(...cr), 2)}`, C.accent6);
  s.addImage({ path: fig2("kernel_hist.png"), x: 9.9, y: 4.3, w: 2.9, h: 2.9 * 448 / 720, objectName: "kern-hist" });
  para(s, "カーネルの 25 個の数値は固定ではなく、毎回の更新で変わる。最初の 1 エポックで大きく動いて形ができ、その後はゆっくり強まる。初期の乱数の模様も少し残る。", 0.6, 6.3, 9.1, 0.6, { fontSize: 12 });
}
{
  const s = slide("CONTENT", "似たカーネルはできるか — 20 個どうしの類似度", "類似度 = 2 つのカーネルを 25 次元のベクトルとみたときのコサイン（1 = 同じ形、−1 = 白黒反転した形、0 = 無関係）。");
  s.addImage({ path: fig2("kernel_similarity.png"), x: 0.5, y: 1.3, w: 7.0, h: 7.0 * 476 / 1096, objectName: "kern-sim" });
  const k = K.kern, F = K.freeze;
  bullets(s, [
    `学習後もほとんどは別の形。類似度 0.8 を超える組は 1 組（カーネル ${k.most_similar[0]} と ${k.most_similar[1]}: ${f1(k.most_similar[2], 2)}）、反転に近い組が 1 組（${k.most_opposite[0]} と ${k.most_opposite[1]}: ${f1(k.most_opposite[2], 2)}）`,
    `類似度の絶対値の平均は ${f1(k.cos0.mean_abs, 2)}（乱数）→ ${f1(k.cos20.mean_abs, 2)}。少しは似てくる（縦・横の縁など共通の部品）`,
  ], 0.6, 4.5, 6.9, 2.4, 12);
  head(s, 7.8, 1.4, 4.9, "?", "なぜ別々の形になるのか", C.accent1);
  bullets(s, [
    "初期値が乱数で、カーネルごとに出力が違う → 戻ってくる誤差 δ_co も違う → 違う向きに更新される",
    `実験 1: 20 個を最初から同じ値にしても、次の層（conv2）の重みがチャネルごとに違うので、誤差が違って分かれていく（20 エポック後の類似度の最小 ${f1(F.same_init_cos_min, 2)}、テスト ${f1(F.same_init[19], 2)}%）`,
    `実験 2: conv2 もチャネルについて同じ値にする（完全に対称）と、20 個は何エポックたっても同じまま（差 ${F.fullsym_maxdiff}）。学習も進まない（テスト ${f1(F.fullsym_acc3, 2)}%）`,
    "→ 乱数の初期値が「対称性を壊す」役目をしている。似たカーネルが残るのは無駄だが、チャネルを減らしても精度はあまり落ちない（10/25ch で 99.06%）",
  ], 7.8, 1.95, 4.9, 4.95, 11.5);
}
{
  const s = slide("CONTENT", "カーネルを学習しないとどうなるか", "初期値（乱数）のカーネルに固定し、残りの層だけを学習した（各バッチの更新後に固定した層を初期値に戻す）。同じ初期値・同じ条件で 20 エポック。");
  const F = K.freeze;
  const rows = [["通常（全部学習）", F.normal[19], HEX.accent2], ["conv1 を固定", F.freeze_conv1[19], HEX.accent3], ["conv1 と conv2 を固定", F.freeze_conv12[19], HEX.accent1], ["参考: MLP（CNN なし）", lastc("mlp") / 100, HEX.accent6]];
  s.addChart(pres.charts.BAR, [{ name: "テスト認識率", labels: rows.map((r) => r[0]), values: rows.map((r) => +r[1].toFixed(2)) }], Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 7.2, h: 5.4, barDir: "bar", catAxisOrientation: "maxMin", chartColors: rows.map((r) => r[2]), valAxisMinVal: 96, valAxisMaxVal: 99.5,
    showValue: true, dataLabelPosition: "outEnd", dataLabelFontSize: 12, dataLabelColor: HEX.dk1, dataLabelFormatCode: "0.00", showLegend: false,
    showTitle: true, title: "20 エポック後のテスト認識率 [%]", catAxisLabelFontSize: 12, objectName: "freeze-chart",
  }));
  bullets(s, [
    `conv1 だけ固定: ${f1(F.freeze_conv1[19], 2)}%。乱数の 5×5 でも何かしらの濃淡の変化は拾えるので、後ろの層がある程度補う`,
    `conv1・conv2 とも固定: ${f1(F.freeze_conv12[19], 2)}%。MLP（${pc(lastc("mlp"))}）より悪くなる。形を見つける部品を学習しないと CNN の利点が出ない`,
    "カーネルの学習が CNN の性能の大部分を担っている。学習の初期で大きく形が作られるのもそのため",
  ], 8.0, 1.5, 4.75, 5.3, 12.5);
}

section("4. パラメータの効果");
{
  const s = slide("SECTION", "パラメータを変えるとどう変わるか");
  s.addText("チャネル数・カーネルサイズ・層の数・プーリング・全結合の大きさ・学習率・バッチサイズを 1 つずつ変えて 20 エポック学習", { placeholder: "body" });
  tile(s, 0.9, 2.75, "4", C.accent4, 1.2);
}
{
  const s = slide("CONTENT", "構造を変えたときの認識率・パラメータ数・時間", "基準は CNN（20/50ch, 5×5, pool 2 回, 全結合 500）。それ以外の条件は同じ。時間は GPU FP32 の 1 エポック（テストの評価を除く）。");
  const rows = K.ablate.map((a) => {
    const best = Math.max(...a.log.map((r) => r[3]));
    const tpe = a.log.slice(1).reduce((x, r) => x + r[2], 0) / (a.log.length - 1);
    const r = [a.label, a.desc, a.params.toLocaleString(), f1(a.flops / 1e6, 2), pc(a.log[a.log.length - 1][3]), pc(best), f1(tpe, 3)];
    return a.base ? r.map(hl) : r;
  });
  table(s, [["条件", "構成", "パラメータ", "MFLOP/枚", "20 エポック後", "最高", "秒/エポック"], ...rows], 0.6, 1.35, 12.1, [1.6, 4.3, 1.4, 1.2, 1.35, 1.1, 1.15], 11, { rowH: 0.42 });
}
{
  const s = slide("CONTENT", "構造のパラメータの効果（まとめ）", "数字は前のスライドの表から。差が 0.1 ポイント程度のものは、乱数の違いで入れ替わりうる範囲。");
  const A = Object.fromEntries(K.ablate.map((a) => [a.label, a]));
  const fin = (l) => { const a = A[l]; if (!a) return "-"; const f = a.log[a.log.length - 1][3], b = Math.max(...a.log.map((r) => r[3])); return f < 5000 ? `発散（途中の最高 ${pc(b)}）` : (b - f >= 30 ? `${pc(f)}（最高 ${pc(b)}）` : pc(f)); };
  const P = [
    ["チャネル数（カーネルの数）", `6/16: ${fin("ch 6/16")} → 20/50: ${fin("ch 20/50")} → 32/64: ${fin("ch 32/64")}`, "多いほど多くの種類の形を調べられ精度が上がるが、計算は比例して増える。ある程度で頭打ち"],
    ["カーネルサイズ", `3×3: ${fin("k 3")}, 5×5: ${fin("ch 20/50")}, 7×7: ${fin("k 7")}`, "大きいほど一度に広い範囲を見る。3×3 は 2 層でも見る範囲が狭く、後ろの全結合（1,250 入力）が大きくなり、終盤に学習が不安定になった"],
    ["畳み込みの層数", `1 層: ${fin("conv 1 layer")}, 2 層: ${fin("ch 20/50")}`, "層を重ねると部品の組合せ（曲線・輪）を表せる"],
    ["プーリング", `2 回: ${fin("ch 20/50")}, 1 回: ${fin("pool 1 time")}`, "1 回にすると全結合の入力が 800 → 3,200 に増え（重み 1.6M）、勾配の合計が大きくなって同じ学習率では途中で発散した"],
    ["全結合の大きさ", `500: ${fin("ch 20/50")}, 100: ${fin("fc 100")}, なし: ${fin("fc none")}`, "畳み込みの特徴を数字に結びつける部分。小さくしても精度は大きくは落ちない → CNN の主役は畳み込み"],
  ];
  P.forEach(([a, b, c], i) => {
    const y = 1.35 + i * 1.08;
    card(s, 0.6, y, 12.1, 0.95);
    para(s, [{ text: a + "　", options: { bold: true, fontSize: 14.5 } }, { text: b, options: { fontSize: 12.5, color: C.accent2, bold: true, breakLine: true } }, { text: c, options: { fontSize: 12, color: C.accent6 } }], 0.8, y + 0.08, 11.7, 0.85);
  });
}
{
  const s = slide("CONTENT", "学習のパラメータの効果 — 学習率・バッチサイズ・エポック", "CNN（20/50ch）で学習率またはバッチサイズだけを変えた。勾配はバッチ和なので、バッチを変えると 1 枚あたりの学習率は同じで更新回数が変わる。");
  const lab = K.train.cnn.map((r) => String(r[0]));
  const ser = [["学習率 0.0005", K.lr["0.0005"], HEX.accent3], ["学習率 0.001（基準）", K.lr["0.001"], HEX.accent2], ["学習率 0.002", K.lr["0.002"], HEX.accent1],
    ["バッチ 50", K.bs["50"], HEX.accent4], ["バッチ 500・学習率 0.0004", K.bs["500lr"], HEX.accent6]];
  s.addChart(pres.charts.LINE, ser.map(([n, log]) => ({ name: n, labels: lab, values: log.map((r) => +(r[3] / 100).toFixed(2)) })), Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 7.6, h: 5.5, chartColors: ser.map((x) => x[2]), lineSize: 2, lineDataSymbol: "circle", lineDataSymbolSize: 4,
    valAxisMinVal: 96, valAxisMaxVal: 99.5, valAxisMajorUnit: 0.5, showLegend: true, legendPos: "t", legendFontSize: 10.5,
    showCatAxisTitle: true, catAxisTitle: "エポック", catAxisTitleColor: HEX.accent6, catAxisTitleFontSize: 11,
    showValAxisTitle: true, valAxisTitle: "テスト認識率 [%]", valAxisTitleColor: HEX.accent6, valAxisTitleFontSize: 11, objectName: "lrbs-chart",
  }));
  const fin = (log) => pc(log[log.length - 1][3]);
  bullets(s, [
    `学習率: 0.0005 → ${fin(K.lr["0.0005"])}, 0.001 → ${fin(K.lr["0.001"])}, 0.002 → ${fin(K.lr["0.002"])}, 0.004 → 発散（全部を「1」と答える ${fin(K.lr["0.004"])}）`,
    `バッチ: 50 → ${fin(K.bs["50"])}。500 と 1000 は学習率 0.001 のままだと発散。勾配をバッチの合計で使うので、バッチを大きくすると 1 回の更新が大きくなりすぎる`,
    `バッチ 500 でも学習率を 0.0004 に下げる（バッチ × 学習率 = 0.2 を保つ）と ${fin(K.bs["500lr"])}`,
    "エポック: 数エポックで頭打ち。増やしても学習データに合っていくだけ（過学習）",
  ], 8.4, 1.4, 4.35, 5.4, 12);
}

// =====================================================================
section("5. 認識率の比較");
{
  const s = slide("SECTION", "認識率の比較");
  s.addText("MLP（CNN なし）・LeNet-5 型・CNN（20/50ch）を同じ条件で 20 エポック学習", { placeholder: "body" });
  tile(s, 0.9, 2.75, "5", C.accent3, 1.2);
}
{
  const s = slide("CONTENT", "テスト認識率の推移（GPU FP32, 20 エポック）", "MLP は nn.l と同じ初期値（乱数の初期状態から作った 784-1000-1000-10）。");
  const lab = K.train.mlp.map((r) => String(r[0]));
  s.addChart(pres.charts.LINE, ["mlp", "lenet5", "cnn"].map((k) => ({ name: NN[k], labels: lab, values: K.train[k].map((r) => +(r[3] / 100).toFixed(2)) })), Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 7.6, h: 5.5, chartColors: [NC.mlp, NC.lenet5, NC.cnn], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 5,
    valAxisMinVal: 94, valAxisMaxVal: 100, valAxisMajorUnit: 1, showLegend: true, legendPos: "t", legendFontSize: 11,
    showCatAxisTitle: true, catAxisTitle: "エポック", catAxisTitleColor: HEX.accent6, catAxisTitleFontSize: 11,
    showValAxisTitle: true, valAxisTitle: "テスト認識率 [%]", valAxisTitleColor: HEX.accent6, valAxisTitleFontSize: 11, objectName: "acc-chart",
  }));
  table(s, [["", "MLP", "LeNet-5 型", "CNN"],
    ["テスト（20 エポック）", pc(lastc("mlp")), pc(lastc("lenet5")), hl(pc(lastc("cnn")))],
    ["テストの誤り", String(10000 - lastc("mlp")), String(10000 - lastc("lenet5")), hl(String(10000 - lastc("cnn")))],
    ["学習データ", pc(K.trainacc.mlp / 6), pc(K.trainacc.lenet5 / 6), pc(K.trainacc.cnn / 6)],
    ["98% に届くエポック", String(firstReach("mlp", 9800) || "-"), String(firstReach("lenet5", 9800) || "-"), String(firstReach("cnn", 9800) || "-")],
    ["99% に届くエポック", String(firstReach("mlp", 9900) || "-"), String(firstReach("lenet5", 9900) || "-"), String(firstReach("cnn", 9900) || "-")],
    ["パラメータ", "1,796,010", "44,426", "431,080"]], 8.4, 1.4, 4.35, [1.4, 1.05, 1.0, 0.9], 10.5);
  para(s, "LeNet-5 型は重みが MLP の 1/40 でも MLP より正確。CNN は 1 エポック目で既に MLP の 4 エポック目を超える。", 8.4, 4.75, 4.35, 1.5, { fontSize: 12.5 });
}
{
  const s = slide("CONTENT", "数字ごとの認識率と、誤りの重なり", "誤りの重なり: テスト 10,000 枚のうち、それぞれのモデルが間違えた画像の集合を比べた。");
  s.addChart(pres.charts.BAR, [
    { name: "MLP", labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], values: K.analysis.mlp_perclass },
    { name: "CNN", labels: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"], values: K.analysis.cnn_perclass },
  ], Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 7.4, h: 5.4, barDir: "col", chartColors: [NC.mlp, NC.cnn], valAxisMinVal: 96, valAxisMaxVal: 100, valAxisMajorUnit: 1,
    showLegend: true, legendPos: "t", legendFontSize: 11, showTitle: true, title: "数字ごとのテスト認識率 [%]", objectName: "perclass",
  }));
  const O = K.analysis.overlap;
  stat(s, 8.3, 1.4, 4.4, String(O.mlp_only), "MLP だけが間違え、CNN は正解した画像", C.accent2);
  stat(s, 8.3, 2.95, 4.4, String(O.cnn_only), "CNN だけが間違えた画像", C.accent1);
  stat(s, 8.3, 4.5, 4.4, String(O.both), "両方とも間違えた画像（人にも読みにくいものが多い）", C.accent6);
}
{
  const s = slide("CONTENT", `MLP だけが誤った例と、CNN の全誤り ${10000 - lastc("cnn")} 枚`, `上: MLP は誤り CNN は正解した ${K.analysis.overlap.mlp_only} 枚のうち 24 枚（赤 = MLP の答え、青 = CNN の答え = 正解）。下: CNN の誤り（正解→予測）。白黒反転して表示。`);
  s.addImage({ path: fig2("mlp_wrong_cnn_right.png"), x: 0.6, y: 1.3, w: 8.0, h: 8.0 * 196 / 768, objectName: "mlpwrong" });
  para(s, "MLP は字が端に寄っている・傾いている・線が細い字で間違えやすい。CNN は形で見るので読める。", 8.9, 1.4, 3.85, 1.6, { fontSize: 12.5 });
  s.addImage({ path: fig2("wrong_cnn.png"), x: 0.6, y: 3.5, w: 11.0, h: 11.0 * 304 / 1260, objectName: "cnnwrong" });
  para(s, "CNN の誤りの多くは、ラベル自体が紛らわしい字（4 と 9、7 と 1 など）。", 0.6, 6.25, 12.1, 0.4, { fontSize: 12.5, color: C.accent6 });
}

// =====================================================================
section("6. 計算時間の比較");
{
  const s = slide("SECTION", "計算時間の比較");
  s.addText("1 エポックの学習時間（GPU / CPU, FP32 / FP64）、層ごとの内訳、バッチサイズ、推論", { placeholder: "body" });
  tile(s, 0.9, 2.75, "6", C.accent1, 1.2);
}
{
  const s = slide("CONTENT", "1 エポックの学習時間（バッチ 200）", "GPU は 3 回の最小、CPU は 1 回。参考の PyTorch（cuDNN）は同じ構成・同じ SGD をデータを GPU に置いて実行したもの。");
  const nets = ["mlp", "lenet5", "cnn"];
  const devs = [["gpu32", "GPU FP32"], ["gpu64", "GPU FP64"], ["cpu32", "CPU FP32"], ["cpu64", "CPU FP64"]];
  table(s, [["", ...devs.map((d) => d[1]), "PyTorch FP32"],
    ...nets.map((k) => [NN[k], ...devs.map((d) => `${f1(K.epoch[k][d[0]], K.epoch[k][d[0]] < 1 ? 3 : 2)} 秒`), K.torch[k + "32"] ? `${f1(K.torch[k + "32"], 3)} 秒` : "—"]),
    ["CNN / MLP の比", ...devs.map((d) => hl(`×${f1(K.epoch.cnn[d[0]] / K.epoch.mlp[d[0]])}`)), `×${f1(K.torch.cnn32 / K.torch.mlp32)}`],
  ], 0.6, 1.35, 12.1, [2.6, 1.9, 1.9, 1.9, 1.9, 1.9], 12.5, { rowH: 0.45 });
  s.addChart(pres.charts.BAR, nets.map((k) => ({ name: NN[k], labels: devs.map((d) => d[1]), values: devs.map((d) => +K.epoch[k][d[0]].toFixed(3)) })), Object.assign(chartBase(), {
    x: 0.5, y: 4.15, w: 7.6, h: 2.8, barDir: "col", chartColors: [NC.mlp, NC.lenet5, NC.cnn], valAxisLogScaleBase: 10, valAxisMinVal: 0.01, valAxisMaxVal: 100,
    showLegend: true, legendPos: "r", legendFontSize: 10.5, showTitle: true, title: "1 エポック [s]（対数）", objectName: "epoch-chart",
  }));
  bullets(s, [
    `CNN は MLP の約 ${f1(K.epoch.cnn.gpu32 / K.epoch.mlp.gpu32)} 倍（GPU FP32）、約 ${f1(K.epoch.cnn.cpu32 / K.epoch.mlp.cpu32)} 倍（CPU FP32）の時間`,
    `元の nn.l（Lisp + OpenBLAS, MLP）は ${f1(K.base, 1)} 秒。GPU の CNN はその 1/${f1(K.base / K.epoch.cnn.gpu32, 0)}`,
    "LeNet-5 型は計算が少なく、GPU FP64 では MLP より速い",
  ], 8.4, 4.25, 4.35, 2.6, 12);
}
{
  const s = slide("CONTENT", "なぜ CNN は計算量の割に時間がかかるか — 層ごとの時間", "CNN（20/50ch）を 1 エポック学習したときの層ごとの時間（同期してから単調時計で測定。測定のための同期で全体は少し遅くなる）。");
  const lp = K.layerprof;
  const names = lp.gpu.map((r) => r[0]);
  s.addChart(pres.charts.BAR, [
    { name: "順伝播", labels: names, values: lp.gpu.map((r) => +(r[1] * 1000).toFixed(1)) },
    { name: "逆伝播＋更新", labels: names, values: lp.gpu.map((r) => +(r[2] * 1000).toFixed(1)) },
  ], Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 6.2, h: 5.5, barDir: "bar", barGrouping: "stacked", catAxisOrientation: "maxMin", chartColors: [HEX.accent2, HEX.accent1],
    showLegend: true, legendPos: "b", legendFontSize: 11, showTitle: true, title: "GPU FP32 [ms / エポック]", catAxisLabelFontSize: 10.5, objectName: "lp-gpu",
  }));
  s.addChart(pres.charts.BAR, [
    { name: "順伝播", labels: names, values: lp.cpu.map((r) => +r[1].toFixed(2)) },
    { name: "逆伝播＋更新", labels: names, values: lp.cpu.map((r) => +r[2].toFixed(2)) },
  ], Object.assign(chartBase(), {
    x: 6.9, y: 1.3, w: 5.9, h: 3.6, barDir: "bar", barGrouping: "stacked", catAxisOrientation: "maxMin", chartColors: [HEX.accent2, HEX.accent1],
    showLegend: false, showTitle: true, title: "CPU FP32 [s / エポック]", catAxisLabelFontSize: 10, objectName: "lp-cpu",
  }));
  bullets(s, [
    "時間の大半は 2 つの畳み込み層。im2col（窓の並べ直し）と col2im（勾配を集める）はメモリを大量に読み書きする",
    "畳み込みの行列は細長い（例 115,200×25 と 25×20）ので、gemm が性能を出しにくい",
    "cuDNN のような専用の畳み込みを使えばさらに速くできる",
  ], 6.9, 5.05, 5.85, 1.85, 11.5);
}
{
  const s = slide("CONTENT", "バッチサイズと 1 エポックの時間・推論の時間", "推論は学習済みの重みで テスト 10,000 枚（1,000 枚ずつ）を認識した時間。");
  const bss = ["50", "100", "200", "500", "1000"];
  s.addChart(pres.charts.LINE, [
    { name: "MLP", labels: bss, values: bss.map((b) => +K.sweep[b].mlp.toFixed(3)) },
    { name: "CNN", labels: bss, values: bss.map((b) => +K.sweep[b].cnn.toFixed(3)) },
  ], Object.assign(chartBase(), {
    x: 0.5, y: 1.3, w: 6.2, h: 4.4, chartColors: [NC.mlp, NC.cnn], lineSize: 2.5, lineDataSymbol: "circle", lineDataSymbolSize: 6, valAxisMinVal: 0,
    showLegend: true, legendPos: "t", legendFontSize: 11, showTitle: true, title: "GPU FP32 1 エポック [s] vs バッチサイズ", objectName: "sweep",
  }));
  para(s, "MLP はバッチが大きいほど速い（大きな行列積になる）。CNN は 200 付近で最小。畳み込みのメモリ処理が支配的で、バッチを大きくしても速くならない。", 0.6, 5.85, 6.1, 1.0, { fontSize: 12 });
  const I = K.infer;
  table(s, [["推論 10,000 枚", "GPU FP32", "CPU FP32", "正解"],
    ...["mlp", "lenet5", "cnn"].map((k) => [NN[k], `${f1(I[k].gpu[0] * 1000, 1)} ms`, `${f1(I[k].cpu[0], 2)} 秒`, pc(I[k].gpu[1])])], 7.0, 1.4, 5.75, [2.2, 1.2, 1.2, 1.15], 12, { rowH: 0.5 });
  bullets(s, [
    `GPU なら CNN でも 1 枚 ${f1(I.cnn.gpu[0] / 10, 4)} ms`,
    `CPU では CNN は MLP の ${f1(I.cnn.cpu[0] / I.mlp.cpu[0])} 倍の時間`,
  ], 7.0, 3.75, 5.75, 1.5, 12.5);
}
{
  const s = slide("CONTENT", "認識率と時間の兼ね合い — 目標の認識率に届くまでの時間", "累積の学習時間（GPU FP32, テストの評価は除く）でテスト認識率を並べた。");
  table(s, [["目標", "MLP", "LeNet-5 型", "CNN"],
    ...[9700, 9800, 9850, 9900].map((th) => [`テスト ${(th / 100).toFixed(1)}%`, ...["mlp", "lenet5", "cnn"].map((k) => { const t = timeReach(k, th); return t === null ? "届かない" : `${f1(t, 2)} 秒（${firstReach(k, th)} エポック）`; })])],
    0.6, 1.4, 12.1, [2.3, 3.3, 3.3, 3.2], 13, { rowH: 0.6 });
  bullets(s, [
    "CNN は 1 エポックあたりは遅いが、少ないエポックで高い認識率に届くので、同じ認識率に必要な時間はむしろ短い",
    "MLP は 98.5% 以上には 20 エポックでも届かない。時間をかけても構造の差は埋まらない",
    "LeNet-5 型は時間と重みの少なさのバランスが良い（組込み向け）",
  ], 0.6, 4.6, 12.1, 2.2, 13);
}

// =====================================================================
section("7. 実装と使い方");
{
  const s = slide("CONTENT", "実装 — CUDA/src/cudacnn.cu と cudacnn.l", "前回の比較で最速だった方法 A（defforeign + C 共有ライブラリ）で実装。");
  code(s, [
    ";; cudacnn.l : ネットワークは層のリストで書く",
    "(defparameter *cnn-net*",
    "  '((:conv 5 20) (:relu) (:pool) (:conv 5 50) (:relu) (:pool)",
    "    (:fc 500) (:relu) (:fc 10)))",
    "(defparameter *mlp-net* '((:fc 1000) (:relu) (:fc 1000) (:relu) (:fc 10)))",
    "",
    "(cnn-create *cnn-net* :precision 32 :device :gpu)  ; :cpu も可",
    "(cnn-upload-dataset 0 *train-images* *train-labels*)",
    "(cnn_train_epoch 200 *lr*)                          ; 1 エポック",
    "(cnn-eval 1)                                       ; => (正解数 損失)",
  ].join("\n"), 0.6, 1.35, 7.2, 3.6, 12.5);
  bullets(s, [
    "活性は NHWC。畳み込みは im2col + gemm、逆伝播は gemm 2 回 + col2im（atomic を使わず集める）",
    "pooling は最大値の位置を覚えておき、逆伝播でそこにだけ勾配を返す",
    "同じソースを GPU（CUDA カーネル + cuBLAS）と CPU（OpenMP + OpenBLAS）で動かす（__host__ __device__ ラムダ）",
    "FP64 / FP32 をテンプレートで切り替え",
    "nn.l と同じ学習則: SGD、勾配はバッチ和、ReLU の微分は u ≥ 0 で 1、逆伝播は更新前の重みを使う",
  ], 8.1, 1.4, 4.65, 5.4, 12);
  head(s, 0.6, 5.15, 7.2, "✓", "正しさの確認", C.accent4);
  para(s, "PyTorch の自動微分と比べ、10 バッチ学習後の重みの差は 1×10⁻¹⁵ 程度（FP64, GPU・CPU とも）。ただし ReLU の微分を u = 0 で 0 とする PyTorch の定義に合わせないと一致しない（MNIST の背景は 0 なので u = 0 が多い）。", 0.6, 5.7, 7.2, 1.2, { fontSize: 12 });
}
{
  const s = slide("CONTENT", "追加したファイルと使い方", "既存の nn.l・mlp/ のモデルは変更していない。");
  code(s, [
    "CUDA/src/cudacnn.cu   CNN エンジン (conv / pool / relu / fc, GPU と CPU, FP64/FP32)",
    "CUDA/Makefile         → CUDA/LinuxARM/libcudacnn.so も作る",
    "cudacnn.l             defforeign とネットワークの記述・初期化",
    "nn-cnn.l              学習・比較の関数 (nn-cuda.l を読み込む)",
  ].join("\n"), 0.6, 1.35, 12.1, 1.5, 13);
  code(s, [
    "$ (cd CUDA; make)",
    "$ roseus nn-cnn.l",
    "$ (test-mnist-cnn *cnn-net*)                         ;; CNN を GPU FP32 で 20 エポック",
    "$ (test-mnist-cnn *lenet5-net*)                      ;; LeNet-5 型",
    "$ (test-mnist-cnn *mlp-net* :params :nnl)            ;; CNN なし (nn.l と同じ初期値)",
    "$ (test-mnist-cnn *cnn-net* :device :cpu :epoch 1)   ;; CPU",
    "$ (test-mnist-cnn '((:conv 3 32) (:relu) (:pool) (:fc 10)))  ;; 好きな構成",
    "$ (bench-mnist-cnn)                                  ;; 本スライドの比較",
    "",
    "# CPU のスレッド数 (取り合いを避ける)",
    "$ OMP_NUM_THREADS=10 OPENBLAS_NUM_THREADS=10 roseus nn-cnn.l",
  ].join("\n"), 0.6, 3.05, 12.1, 3.8, 13);
}
{
  const s = slide("TITLE_DARK", "まとめ");
  s.addText([
    { text: `CNN を入れるとテストの誤りが ${10000 - lastc("mlp")} 枚 → ${10000 - lastc("cnn")} 枚（${pc(lastc("mlp"))} → ${pc(lastc("cnn"))}）。重みは 1/4 で、学習データとの差（過学習）も小さい`, options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: "理由は画像の性質（近くの画素の関係・同じ形がどこにでも出る）を構造として持つこと。ずらした画像や画素を入れ替えた実験で確認", options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: `1 エポックは GPU で ${f1(K.epoch.mlp.gpu32, 2)} → ${f1(K.epoch.cnn.gpu32, 2)} 秒（×${f1(K.epoch.cnn.gpu32 / K.epoch.mlp.gpu32)}）、CPU で ×${f1(K.epoch.cnn.cpu32 / K.epoch.mlp.cpu32)}。ただし同じ認識率に届く時間は CNN の方が短い`, options: { bullet: true, breakLine: true, paraSpaceAfter: 8 } },
    { text: "チャネル数・層の数は精度と時間の兼ね合い。畳み込み部分が性能の主役で、全結合は小さくてよい", options: { bullet: true } },
  ], { placeholder: "body" });
}
