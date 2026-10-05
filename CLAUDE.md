# MNIST × EusLisp — 作業の引き継ぎメモ

この README とあわせて読むこと。ユーザーへの返答・スライド・コメントは日本語で書く。

## これまでにやったこと（ブランチ `cuda-backend`）

| スライド（docs/） | 内容 |
|---|---|
| `mnist_euslisp.pptx` | MNIST の原論文・出典・データ、nn.l の実装と NN 構成、処理時間プロファイル、学習経過、認識結果、全 70,000 枚の画像 |
| `mnist_cuda.pptx` | EusLisp と CUDA の接続方法 4 つ（A defforeign + C ライブラリ / B CUDAPROD モジュール / C libcublas 直接 / D PyTorch 別プロセス）と速度比較 |
| `mnist_cnn.pptx` | CNN あり / なしの比較（認識率・時間）、用語、学習のしくみ（MLP と CNN の逆伝播、カーネルの更新）、LeNet、パラメータの効果 |
| `mnist_phone.pptx` | スマートフォンで NN を動かす方法・AI 機能、ブラウザの計測ページ、時間比較（**スマートフォンの結果は未反映**） |
| `mnist_mac_iphone.pptx` | Mac（MacBook Pro 2019, Intel）と iPhone 16 Pro での計測: EusLisp nn.l（Mac）, C++ + Accelerate, GPU（MPSGraph）, Core ML 旧形式・新形式（FP16）, ハードウェアを使う・使わないの比較 |

コード: `CUDA/src/cudamlp.cu`（MLP, GPU/CPU）, `CUDA/src/cudacnn.cu`（CNN, GPU/CPU 両用）, `cudalib.l`, `nn-cuda.l`, `cudacnn.l`, `nn-cnn.l`, `CUDAPROD/`, `cuda-direct.l`, `cuda-ipc.l`, `ipc/torch_server.py`, `bench-cuda.l`, `phone/`, `ios/models/`。

## 環境

- **DGX Spark**（Ubuntu 24.04, aarch64, NVIDIA GB10, CUDA 13.0, jskeus は `~/jskeus`）: CUDA・EusLisp の計測はここでしか動かない。
- **Mac**: iPhone アプリ（Xcode）と Android アプリ（Android Studio）のビルド用。CUDA 関係のコードは Mac では動かない。
- ユーザーの端末: **Android と iPhone** の両方。

## 作業の決まり

- 数値は必ず実際に動かして測った値を使う。測っていない値は「目安」「公称」と明記する。
- スライドはテーマごとに **別ファイル** で `docs/` に置く（既存のスライドに追記しない）。
- フォントは Windows でも使える **BIZ UDPGothic**（コードは **BIZ UDGothic**）。グラフの文字にも日本語フォントを入れる（`docs/src/build*.js` の最後の後処理）。
- `mlp/*.l`（元の学習済みモデル・データ）は上書きしない。GPU で学習したモデルは `mlp-cuda/` に保存。
- コミットは `cuda-backend` ブランチに、ユーザーに頼まれたときだけ。push も頼まれたときだけ。

## スライドの作り直し方（docs/src）

```
cd docs/src && npm install            # pptxgenjs
SKILL_DIR=<pptx スキルのディレクトリ> node build_phone.js   # build.js / build_cuda.js / build_cnn.js も同じ
```
- `build*.js` は `<pptx スキル>/scripts/apply_theme.js` を `SKILL_DIR` から読む。出力は `docs/src/*.pptx` → `docs/` にコピー。
- 集計データ: `eval.json`, `prof.json`（euslisp）, `cuda.json`, `cnn.json`, `phone.json`。図: `fig/`, `figc/`, `figp/`。
- 分析スクリプト（`*.py`）は `docs/src` で実行する前提。多くは `datasets.npz`（`parse_data.py` で `mlp/mnist-datasets.l` から作る, 400 MB, リポジトリには入れていない）を使う。
- 計測ログは `docs/src/logs/`、EusLisp の計測スクリプトは `docs/src/eus/`（DGX の一時フォルダのパスが書かれている記録用）。
- QA は LibreOffice で PDF にして画像で確認（はみ出し・重なり）。

## 分かっている注意点

- nn.l の `Perceptron :init` は `Wt` を乱数で埋める前の `W` から作る → 最初の 1 バッチだけ重み 0 で順伝播。
- `MATPROD/src/matprod.c` の msoftmax は 257 行以上で `free(maxv)`（スタック配列）を解放して落ちる。正しくは `free(max)`, `free(sum)`。
- nn.l のバッチ作成は `(elt リスト i)` で O(N²)。nn.l の `[sec]` 表示は CPU 時間（全スレッド合計）。
- 学習の勾配はバッチ和（学習率 0.001 × バッチ 200 = 平均換算 0.2）。ReLU の微分は u ≥ 0 で 1（PyTorch と比べるときは合わせる）。
- CPU 計測は OpenMP 10 + OpenBLAS 10 スレッドが最速（20 + 20 は取り合いで遅い）。

## スマートフォンの計測（進行中）

- ブラウザの計測ページ（claude.ai Artifact, 非公開）: https://claude.ai/artifact/3373AhmSK4JkSFxqCw6e3S
  - ソース: `phone/site/index.html`（Artifact 版は `<head>` なしの中身。リポジトリ版は単体で開ける完全な HTML）
  - 結果はページの db の `runs` コレクションに保存される。読み出し: ArtifactData の `list`（url と collection `runs`, `out_dir` にリポジトリの `phone/db`）で `phone/db/runs/*.json` を作り、`cd docs/src && python3 mkphonejson.py && node build_phone.js`。
  - 2026-10-03 時点でスマートフォンの結果はまだ 0 件。DGX Spark のブラウザ（Chromium）の結果は `phone/dgx_browser.json`。
- アプリ用モデル: `phone/onnx/mnist_{mlp,cnn}.onnx`（入力 `image` n×1×28×28, 0〜1、出力 `prob` n×10。認識数 MLP 9824 / CNN 9917 を確認済み）
- Core ML: `ios/models/MNIST{MLP,CNN}.mlmodel`（NeuralNetwork 形式, 入力 `image` 1×1×28×28, 出力 `prob` 1×10）。DGX の coremltools では ML Program 形式が書けなかったため。Mac では `ios/models/tocoreml.py` を `convert_to="mlprogram"` に変えて作り直せる（`pip install coremltools torch`）。
- データとモデルの作り直し: `mkdir -p mlp-cuda && cp docs/src/eus/params-cnn.l mlp-cuda/mnist-cnn-9.l && python3 phone/make_data.py`

## Mac と iPhone の計測（2026-10-04）

- `ios/`: 計測コード。`Engine/cpucnn.cpp`（cudacnn.cu の CPU 経路を Accelerate + GCD に移植, threads=2 で素朴なループ）, `Shared/Bench.swift`, `Shared/GPUNet.swift`（MPSGraph）, `App/`（iPhone）, `Mac/`（コマンドライン）, `models/mkmlprogram.py`（ML Program FP16 のモデル, coremltools だけで作れる）
- Mac: `make -C ios mac && ios/build/mac/mnistbench --out phone/native/mac_runN.json`
- iPhone（Mi16pro, iPhone17,1, チーム 39WXY2YNCK）: `make -C ios project DEVELOPMENT_TEAM=39WXY2YNCK XCODEGEN=<xcodegen>` → `xcodebuild ... -allowProvisioningUpdates build` → `xcrun devicectl device install app` → `xcrun devicectl device process launch --console --device <id> jp.jsk.mnist.MNISTBench -- -autorun -exit`（画面のロックを解除しておく）。出力の RESULT-JSON の部分を `phone/native/iphone_runN.json` に（info に name, chip を足す）
- EusLisp を Mac で: Homebrew の jskeus。`MAC_EPOCH=2 eus '(load "docs/src/eus/mac_bench.l")'`（起動直後に落ちることがあるのでやり直す）。git-lfs は `~/bin/git-lfs`
- スライド: `cd docs/src && python3 mkmacios.py && NODE_PATH=$PWD/node_modules SKILL_DIR=<pptx スキル> node build_macios.js`
- この Mac には LibreOffice がない（scratchpad に置いて QA した）。BIZ UD フォントは ~/Library/Fonts に入れた

## EusView（jskeus / kxreus のロボットを iPhone・Mac・Android・デスクトップで表示）→ kxreus/eusview に移した（2026-10-06）

- もとはこのリポジトリの `eusview/`（アプリ・書き出しのスクリプト・ロボットの JSON・BVH・全身 QP）と
  スライド `docs/eusview.pptx`（`docs/src/build_eusview.js`, `docs/src/eusview_media/`）。
  **今は kxreus（GitHub inabajsk/kxreus）の `eusview/` と `eusview/docs/` にある**（~/kxreus/eusview）。mnist からは消した。
- 使い方・作業の記録は `~/kxreus/eusview/README.md`, `eusview/bvh/QP.md`, `eusview/docs/README.md`。
- 書き出しは `cd ~/kxreus && eusview/run-eus.sh eusview/export-demo.l`（run-eus.sh が `EUSVIEW_DIR` を渡す）。
- 注意: kxreus の glbodies には書き込まない（キャッシュは `kxreus/eusview/cache`, git に入れない）。

## kxreus の EusView デモ（Ubuntu 向け, 2026-10-05）

- ~/kxreus に eusview.l（irteusgl のデモ: KXR/KHR/JSK, 姿勢, 動作の繰り返し, physics（eusview-ode/ の ODE, kxrdyna があればそちら）, servo, live）, eusview-physics.l, eusview-xft.l（Xft で日本語）, eusview.sh, eusview-live.py, projects/Hello_khr3*。Makefile: eusview, eusview-ode, eusview-desktop
- inabajsk/kxreus に push 済み（befee34, 887b7d2, 1c1bdd7, 202ac20, 19b6a20）。~/kxreus の Makefile の /usr/bin/uname はこの Mac だけの手元の変更（コミットしない）
- Mac の XQuartz で動作確認済み。kxreus の EusView → live → iPhone の EusView で kxrl2l6a6h2 の歩行が動くことを確認。Ubuntu では未確認
- 摩擦: mu 0.8, 接触点 4, soft_cfm 0.001（kxr-dyna の mu 0.1 / 1 点では立っているだけで滑る）

## 次にやること

1. ~~**iPhone アプリ**~~（済み, 上の「Mac と iPhone の計測」）。以下は当初の計画:
   - Core ML の computeUnits を `.cpuOnly` / `.cpuAndGPU` / `.cpuAndNeuralEngine` / `.all` で切り替え、テスト 10,000 枚の推論時間（まとめて・1 枚ずつ）と認識数（MLP 9824, CNN 9917 になるはず）を測る。
   - Accelerate（`cblas_sgemm`）で MLP と CNN の学習時間も測る（`CUDA/src/cudamlp.cu` の cpumlp と `cudacnn.cu` の CPU 経路を移植）。
   - 結果は画面に表示し、JSON をコピーできるようにする（チャットに貼ってもらう）。
2. **Android アプリ**（Mac, Android Studio）: Kotlin + ONNX Runtime Mobile で `phone/onnx/*.onnx` を CPU（XNNPACK）/ NNAPI で推論し時間を測る。
3. ユーザーにブラウザの計測ページを実行してもらい、結果を `docs/mnist_phone.pptx` に反映。ネイティブアプリの結果も同じスライドに加える。
