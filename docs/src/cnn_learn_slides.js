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
    { text: "ΔW[co, c, ky, kx] = Σₙ Σ_oy Σ_ox δ[n, oy, ox, co] · x[n, oy+ky, ox+kx, c]", options: { fontSize: 14.5, bold: true, breakLine: true } },
    { text: "バイアス", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "Δb[co] = Σₙ Σ_oy Σ_ox δ[n, oy, ox, co]", options: { fontSize: 14.5, bold: true, breakLine: true } },
    { text: "下の層へ戻す誤差", options: { bold: true, color: C.accent1, breakLine: true } },
    { text: "δx[n, y, x, c] = Σ_co Σ_ky Σ_kx δ[n, y−ky, x−kx, co] · W[co, c, ky, kx]", options: { fontSize: 14.5, bold: true, breakLine: true } },
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
  para(s, "横: 入力チャネル c（20）\n縦: 出力チャネル co（50）\n1 マス = 5×5 の重み", 11.35, 2.0, 1.45, 1.6, { fontSize: 10.5, color: C.accent6 });
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
  stat(s, 0.6, 4.45, 3.0, `${f1(k.absmax["0"], 2)} → ${f1(k.absmax["20"], 2)}`, "重みの絶対値の最大\n（初期値 → 20 エポック後）", C.accent1);
  stat(s, 3.9, 4.45, 3.0, `×${f1(k.norm["20"] / k.norm["0"])}`, `重み全体の大きさ（ノルム）\n1 エポック後で既に ×${f1(k.norm["1"] / k.norm["0"])}`, C.accent2);
  const cr = k.per_kernel_corr_init_vs_20;
  stat(s, 7.2, 4.45, 2.6, `${f1(Math.min(...cr), 2)}〜${f1(Math.max(...cr), 2)}`, "初期値と 20 エポック後の\n形の相関（カーネルごと）", C.accent6);
  s.addImage({ path: fig2("kernel_hist.png"), x: 9.9, y: 4.3, w: 2.9, h: 2.9 * 448 / 720, objectName: "kern-hist" });
  para(s, "カーネルの 25 個の数値は固定ではなく、毎回の更新で変わる。最初の 1 エポックで大きく動いて形ができ、その後はゆっくり強まる。初期の乱数の模様も少し残る。", 0.6, 6.3, 9.1, 0.6, { fontSize: 12 });
}
{
  const s = slide("CONTENT", "似たカーネルはできるか — 20 個どうしの類似度", "類似度 = 2 つのカーネルを 25 次元のベクトルとみたときのコサイン（1 = 同じ形、−1 = 白黒反転した形、0 = 無関係）。");
  s.addImage({ path: fig2("kernel_similarity.png"), x: 0.5, y: 1.3, w: 7.0, h: 7.0 * 560 / 1290, objectName: "kern-sim" });
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
