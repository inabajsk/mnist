# eusview: EusLisp のロボットモデルを JSON に書き出す（iPhone SceneKit ビューア用）

## 実行方法（Mac, ~/jskeus の irteusgl）

```
cd /Users/inaba/mnist
eusview/run-eus.sh eusview/export-demo.l     # irteus/demo のロボット 4 体 → robots/jsk/sample-*.json
eusview/run-eus.sh eusview/export-walk.l     # sample-robot + 歩行モーション → robots/jsk/sample-robot-walk.json
EUS_TIMEOUT=900 eusview/run-eus.sh eusview/export-jsk.l   # ~/jskeus/eus/models のロボット 37 体 → robots/jsk/<名前>.json
EUSVIEW_ROBOTS="h7 darwin" ... export-jsk.l                # 名前を指定
eusview/run-eus.sh eusview/export-kxr.l      # kxreus のロボット 5 体（既定, 形だけ）→ robots/kxr/ か robots/khr/
EUSVIEW_ROBOTS="kxrl2l6a6h2 kxrl4th2" eusview/run-eus.sh eusview/export-kxr.l   # 名前を指定
EUSVIEW_PROJECTS="kxrl2l6a6h2 kxrl4r" EUS_TIMEOUT=900 eusview/run-eus.sh eusview/export-motions.l
                     # kxreus のプロジェクト（Heart-to-Heart 4）のモーション + 物理パラメータ → robots/kxr/<ロボット>.json
EUSVIEW_ROBOTS="kxrl2l2a6h2m" ... export-motions.l   # ロボット名で指定（プロジェクトはそのロボットの :project-file）
EUSVIEW_PROJECTS="kxrl2l2a6h2g:kxrl2l2a6h2m" ...      # プロジェクト:ロボット（別のロボットに当てる）
EUSVIEW_PROJECTS="~/prog/rcb4eus/projects/Hello_khr3sl5a3h2/Hello_KHR3(V2.3).h4p:khr20h2" ...
                     # プロジェクトのフォルダか .h4p のパス:ロボット（kxreus にないプロジェクト。KHR 用, 下を参照）
python3 eusview/verify.py eusview/robots/*/*.json   # ビューアと同じ式で FK して check と照合
```

- 出力は `robots/<グループ>/<名前>.json`。グループは `kxr`（kxreus の KXR）, `khr`（kxreus の KHR, 名前が khr で始まるもの）,
  `jsk`（jskeus の irteus/demo と eus/models）。JSON のトップにも `"group"` を入れる（アプリは robots/ をサブフォルダごと読む）。
- kxreus で作れるロボット名の一覧は `kxr-robot-names.txt`（`*kxr-body-config-alist*` の 593 件, 古い kxreus で作った一覧）。

### jskeus をこの Mac で動かすための工夫

- 既定は `~/jskeus`（inabajsk/jskeus c2682e78 をこの Mac でビルドしたもの, EusLisp 9.30）の `eus/Darwin/bin/irteusgl` を
  そのまま使う（`EUSDIR=~/jskeus/eus`, `ARCHDIR=Darwin`）。`irteus/irtstl.l` の `stl2eus` が入っている。
  `JSKEUS_DIR` で場所を変えられる。`EUSVIEW_JSKEUS=homebrew` で以前の Homebrew jskeus 1.2.1 に戻せる
  （そのときは `bin/eusgl`（`libexec/eusgl` へのリンク）+ `irtload.l` で irt ライブラリを手で読む。libirteusimg が
  libjpeg.9 を参照していて読めないため。stl2eus はないので STL を使う部品のあるロボットは作れない）。
  スクリプトは常に `irtload.l` を読むが、irteusgl では何もしない。
- eus は起動直後にランダムに落ちる（Bus error / Segfault）ので、`run-eus.sh` は最後の `;;EUSVIEW-DONE` が出るまで最大 10 回やり直す。
  1 回の実行は `EUS_TIMEOUT` 秒（既定 300）で打ち切る。標準入力は `/dev/null`（エラーのときは止まらずに終わる）。
  出力に `ERROR` があれば失敗として終わる（eus はエラーのあとも先へ進むことがあるので、ログは必ず確認する）。
- kxreus（`~/kxreus`, GitHub 8623701, 2026-10-01）は `~/.eusrc` で読み込みパスが通っている。`Darwin/obj` の .so ではなく
  ソース（.l）を読む。共通の準備は `kxr-env.l`（export-kxr.l / export-motions.l が読む）:
  - kxreus は部品の形を `(rcb4eus-mkdir "glbodies")` に `*-func.bod`（kxrbody.l の memoize）・`*.gv`（glvertices）として、
    `(rcb4eus-mkdir "glbodies/stlcache")` に `stl2eus-<hash>.l`（kxr-stl-cache.l: stl2eus の結果を数値の表で保存）として
    キャッシュする（ファイルがなければ書き込む）。`rcb4eus-mkdir` を置き換えて書き込み先を `eusview/cache/...` にする。
    ~/kxreus には書き込まない（キャッシュは最新の kxreus で作り直すため空から始める。
    `EUSVIEW_LINK_KXREUS_CACHE=1` で ~/kxreus/glbodies のファイルへのリンクを張って読むだけにできる）。
  - kxreus utils.l は面の三角形分割（部品の `*.gv` と PQP の衝突モデル）に GLU のコールバック `gl::eus_tess_*` を使う。
    ~/jskeus は inabajsk/EusLisp の glu-tess-collector（`opengl/src/util.c` に `eus_tess_*`）でビルドし直してあるので、
    そのまま使われる（ログに `;; GLU tessellation (gl::eus_tess_*) is used`）。`eus_tess_*` のない jskeus のときと
    `EUSVIEW_NO_GLU_TESS=1` のときは `kxreus-glu-triangulate-face` を nil を返すものにして、kxreus 自身のフォールバック
    （`geometry::face-to-triangle-aux`）を使わせる。比べた結果（kxrl2l6a6h2, キャッシュ空から）: 1 体 15 s（GLU）と 82 s
    （フォールバック）。`*.gv` の三角形数は 29 ファイルで 4752 → 4744（back-pack 544 → 542, body-plate 720 → 714 だけ違う）。
    JSON は eus2json が自分で面を三角形に分けるので変わらない（全 79 体を GLU 版で作り直して、三角形数 625708 で同じ。
    違いは物理の慣性の最後の桁が 3 体だけ）。
  - `tiny-xml` パッケージがあっても `parse` がないことがあるので、そのときは kxreus の tiny-xml.l を読む。
  - `EUSVIEW_STL_SUBST="ない.STL=代わり.STL ..."`（任意）: kxreus が `stl2eus` で読む STL が ~/kxreus/stls にないとき、
    同じフォルダの別のファイルを使う（`stl2eus` を包む）。KHR の `:m3deye` 頭（`:3eye-rev 6`）の
    `M5Stickhead_3eye_mount_rev6.STL` がないため、khrt1l6a4h2 は `rev3` で代用した。
- 以前の自作 `stl2eus.l` は消した（jskeus の irtstl.l を使う）。

## JSON の形式

単位は m と deg（直動関節は mm）。座標は EusLisp のワールド座標（z が上）。

```
{ "name", "source", "units",
  "links":  [ { "name", "parent": -1 か 親の番号（親が先に並ぶ）,
                "pos": [x,y,z], "rot": [r00..r22]（行優先）,   // 全関節 0 のときの、親リンク座標系での位置と姿勢
                "meshes": [ { "color": [r,g,b,a], "vertices": [x,y,z,...]（リンク座標系, m）, "indices": [三角形] } ] } ],
  "joints": [ { "name", "link": 子リンクの番号, "type": "rotational" | "linear",
                "axis": 子リンク座標系での単位ベクトル, "min", "max" } ],
  "poses":  { "zero-pose", "reset-pose", "reset-manip-pose", "init-pose", "sit-pose", "test-pose" ... }, // 関節の順
  "check":  { "pose", "angles", "link_world_pos": [[x,y,z] リンクごと] },
  "motions": [ { "name", "fps", "frames": [[角度...]], "root": [[x,y,z,r00..r22]],
                 "check": { "frame", "link_world_pos" } } ],         // sample-robot-walk.json
  "motions": [ { "name": "XL2G_201_挨拶", "fps": 50, "number": モーション番号, "keyframes": キーフレーム数,
                 "truncated": true（打ち切ったときだけ）, "frames": [[角度...]] } ],   // export-motions.l（root なし）
  "physics": { ... }                                                  // export-motions.l（下の「物理パラメータ」）
}
```

- 子リンクの座標 = 親 × T(pos)·R(rot)·R(axis, 角度)（回転関節）, × T(pos)·R(rot)·T(axis × mm / 1000)（直動関節）。
  EusLisp の `rotational-joint :joint-angle` が `(send child-link :replace-coords default-coords)` のあと
  `(send child-link :rotate (deg2rad angle) axis)`（ローカル座標）をしているのと同じ。
- `poses` はロボットのクラスにあるメソッド（:reset-pose など）を呼んで得た角度。`zero-pose` は全部 0、
  `test-pose` は各関節を可動範囲の 30% の位置にしたもの（確認用）。
- `motions[].root` はルートリンク（links[0]）のワールド座標で、links[0] の pos/rot の代わりに使う。
- メッシュは物体（body）ごとに 1 つ。面ごとに頂点を分けている（法線を面ごとに付けられる）。
  凸な面は扇形に、穴や凹みのある面は `geo::face-to-triangle` で三角形に分ける。体積が負の物体（裏返し）は向きを直す。
  `gl::glvertices` しかない物体（collada 由来など）は mesh-list をそのまま出す。

## kxreus のプロジェクトのモーション（export-motions.l, RCB4 のエミュレーション）

`~/kxreus/projects/Hello_<プロジェクト>/*.h4p`（Heart-to-Heart 4 のプロジェクト, UTF-8 の XML）のモーションを、
kxreus の RCB4 エミュレータで実行して関節角の列にする。1 プロジェクト 1〜2 分（モデル作成が大半）。

- ロボット: `Hello_<名前>` の `<名前>` がロボット名ならそれ、なければ `:project-file` が `<名前>` の最初のロボット
  （例 `kxrl2l2a6h2g` → `kxrl4l2a6h2m`, `kxrd7g` → `kxrt1l2l2d7h2m`）。kxreus の `kxr-project-file-name` と同じ対応。
- 使っている API（kxreus `rcb4interface.l` / `rcb4machine.l` / `rcb4file.l`）:
  - `(instance rcb4-interface :init robot :create-viewer nil)` → `:setup` → `:set-project-file`
    （`rcb4-project-file` が .h4p のモーションのバイトコードを逆アセンブルし、RCB4 の ROM 表に入れる）。
  - `(send ri :emulate-motion-code mc :loopmax 3000)`（= `rcb4-machine :emulate-motion-code`）。ジャンプ・コール・
    サーボ命令を実行し、サーボ命令ごとに `(send robot :angle-vector (send ri :servo-vector-to-angle-vector sv))`、
    `(get robot :ode-ci)` があれば `(send robot :send-ode (* 速度 10))` を呼ぶ（kxrdyna.l が ODE を動かすのと同じ口）。
    export-motions.l は `:send-ode` でキーフレーム（角度, 時間 ms）を記録する。エミュレータは実時間で `unix:usleep`
    するので、その間は usleep を空にしている（タイマー待ちの usleep は「静止」として記録）。
  - RCB4 はサーボを前の位置から新しい位置まで「速度 × 10 ms」で直線補間するので、キーフレームを直線補間して
    50 fps でサンプルする。最初のフレームはホームポジション（`…ホームポジション` モーションの最後の姿勢）。
- エミュレータの直したところ（kxreus は変更せず、読み込んだコードをメモリ上で書き換える）:
  - サーボ命令の ID に入っていないサーボは今の位置のまま（逆アセンブラは 7500 = 0° で埋めているので「保持」に変える）。
    `#x7fff` 以上（フリー / ホールド）も今の位置のまま。
  - タイマー待ちのループ（`(:sub (:lit 0 128) (:ram (:timer ..)) t)` + `:jump`）はエミュレータではタイマーが減らず
    終わらないので、ジャンプを消す（待ち時間はタイマーに入れた値を ms として静止にする。単位は要確認）。
  - ボタンや電圧を見て繰り返すモーション（`電圧低下` など）は 30 秒で打ち切り（`"truncated": true`）。
- トリム（.h4t, サーボ設定の Trim）は使わない。RCB4 がサーボに送るときに足す値なので、関節角には入らない。
- 関節角は eus2json と同じ `joints` の順（`joint-list` のうち回転 / 直動関節）。0.1° に丸める。
  実行ログに各モーションの「最大 |角度| > 20° の関節」を出す（例: `挨拶` は `crotch-p` が 34°）。

### 書き出したもの（2026-10-05, ~/jskeus（GLU テッセレーション入り）+ kxreus 8623701）

`robots/kxr/` の 36 体（1 体 0.16〜2.5 MB, 計約 30 MB）。プロジェクト 40 のうち 33 + ロボット名で指定した
`kxrl2l2a6h2m`, `kxrmw4a6h2m` + `kxrl2l6a6`（stl2eus を使う部品があり以前は作れなかった）。
プロジェクト → ロボット: 同名のほか `kxrl2l2a6h2g → kxrl4l2a6h2m`, `kxrl2l5a6h2g → kxrl2l5a6h2m0`,
`kxrd7g / kxre7g / kxrw7g → kxrt1l2l2{d,e,w}7h2m`。`kxrl2l2a6h2m` と `kxrmw4a6h2m` は `kxra6g` のプロジェクト。
最新の kxreus で作り直したので、以前（Homebrew jskeus + 古い kxreus）と比べて全員の形と質量が少し変わった
（三角形数 −3〜−8 %, 質量 −0.1 % 程度。kxra6g は部品が増えて三角形 2 倍, kxrl2l5a3 はリンクが 17 → 18）。
書き出せなかったもの: `kxrr4ll`（設定が nil）, ロボットがない `kxrl2`, `kxrl2w2a4h2`, `kxrl2w2l6a6h2n`, `kxrl4th`, `kxrm7g`。

### KHR（robots/khr/, 43 体）

- `:body` で作る KHR（kxr-robot-names.txt で `khr` が付き `:body` があるもの）42 体 + `khr3`。
  1 体 0.55〜2.1 MB, 計約 37 MB。例: khr20h2 22 リンク / 21 関節, khrl6a3h2 21 / 20, khr22h2 24 / 23,
  khrt1l6a4h2 24 / 23（1.3 MB）, khrnishio 31 / 30（1.7 MB, 5 インチのダクトファンなど STL 部品）, khr3 18 / 17。
- モーション: KHR のプロジェクト（`khr3`, `khr3semi`）は ~/kxreus/projects にないので、~/prog/rcb4eus/projects
  （読むだけ）の Hello_KHR3(V2.3) を使った。`:project-file "khr3semi"` のロボット（`:body` のもの）には
  `Hello_khr3sl5a3h2/Hello_KHR3(V2.3).h4p`（47 モーション）、`khr3`（`:project-file "khr3"`）には
  `Hello_khr3/Hello_KHR3(V2.3).h4p`（46 モーション）。どちらも KHR-3HV の公式サンプル（挨拶, 歩行, 起き上がりなど）。
  `khr3semi` という名前のプロジェクトそのものは見つからなかったので代用（サーボ ID の対応はロボットの設定による）。
- CAD 版（`*-cad`, `khr`, `khrh2`, `khrmain`, `khr3omori`, `khr3rcb4`, `khr3semircb4`, `khr3semi1`, `khrh2fly`,
  `khranzaiflys`, `khranzaifly*-cad`）は `:file "KHR/....l"` / `models/KHRmain.l` が ~/kxreus にもどこにもなく、
  kxr-make-robot は既定の khr-robot（18 リンク, khr3 と同じ形）を返すだけなので書き出していない（khr3 で代表）。
- khrt1l6a4h2 は頭（`:m3deye :3eye-rev 6`）の STL がないので `EUSVIEW_STL_SUBST` で rev3 を代用（上を参照）。
  ```
  EUSVIEW_STL_SUBST="M5Stickhead_3eye_mount_rev6.STL=M5Stickhead_3eye_mount_rev3.STL" \
  EUSVIEW_PROJECTS="~/prog/rcb4eus/projects/Hello_khr3sl5a3h2/Hello_KHR3(V2.3).h4p:khrt1l6a4h2" \
  EUS_TIMEOUT=1200 eusview/run-eus.sh eusview/export-motions.l
  ```

### jskeus のロボット（robots/jsk/, export-jsk.l）

`~/jskeus/eus/models` の `*-robot.l` と `darwin.l` の 37 体（akira, akira2, akira3, ape, ape3, bishamon, chibikaz, darwin,
h3, h3s, h4, h6, h7, hanzou, hanzous, human, igoid, igoid2, igoid3, ikuo-haru, jrob1, kaz, kaz2, kaz3, kuma, macket,
macra, miharu, millennium, patra, penguin, saizo, tama, tamaii, taro, tot, zero）。すべて書き出せた（1 体 0.09〜0.4 MB, 計約 8 MB）。
+ irteus/demo の sample-robot, sample-arm, sample-hand, sample-multidof-arm, sample-robot-walk。

- 各ファイルの `(defun <名前> (&rest args) (instance* <名前>-robot :init args))`（darwin.l は `DARWIN`）で作る。
- 物理: どのモデルもリンクに `:weight` がある（合計 0.6〜151 kg）のでそれを使う。物体は faceset（:volume なし）が多いので、
  衝突形状の箱は面の頂点から作る（eus2physics.l が faceset も扱うようにした）。`:weight` の合計が 100 g 以下のときは
  物体の体積 × 1 g/cm³（仮定）で見積もり、physics に `"estimated": true, "density_g_cm3"` を付ける（今回は該当なし）。
  サーボは KXR の値ではなく odedyna の既定（fmax 500000 = 実質無制限, kp 10）。初期姿勢は :reset-pose がなければ :init-pose。
- 姿勢は `:reset-pose` があるもの（h6, h7, human, igoid*, kaz*, macket, macra, patra, tot, chibikaz, darwin）とないものがある。
  `init-pose`, `zero-pose`, `test-pose` は全員。モーションはない。

## 物理パラメータ（eus2physics.l, JSON の `"physics"`）

`~/prog/rcb4eus/odedyna.l`（`robot2drobot`, `ode-module`, `motor-module`）と kxrdyna.l の `kxr-dyna`
（`dyna-on` → `d-init :max-contacts 1 :cmu 0.1`, `:soft-setting`）の作り方・値に合わせている。
単位は kg, m, kg·m², N·m, rad/s。

```
"physics": {
  "links": [ { "mass": kg, "com": [x,y,z] (m, リンク座標系),
               "inertia": [Ixx,Ixy,Ixz,Iyy,Iyz,Izz] (kg m², 重心まわり, リンク座標系の軸),
               "inertia_from": "boxes" | "link-inertia" | "none",
               "shapes": [ {"type":"box","size":[x,y,z],"pos":[..],"rot":[9 行優先],"mass":kg}
                         | {"type":"cylinder","radius","length","pos","rot","mass"} ] } ],   // links と同じ順
  "joints": [ {"motor":"servo"|"rotation","fmax":N·m,"vmax":rad/s,"kp":1/s,"damping":0} ],   // joints と同じ順
  "odedyna_motor": {"kp":10,"fmax":500000},
  "world":   {"gravity":[0,0,-9.81],"dt":0.01,"erp":0.2,"cfm":0.01,"quickstep":false,"iterations":30},
  "contact": {"mu":0.1,"soft_erp":0.2,"soft_cfm":0.01,"bounce":0.01,"bounce_vel":1,"max_contacts":1,
              "mode":"Bounce|SoftERP|SoftCFM|Approx1"},
  "total_mass": kg,
  "initial": {"pose":"reset-pose","root_pos":[0,0,z],"shapes_min_z":m,"meshes_min_z":m}
}
```

- 質量・重心・慣性: 質量はリンクの `:weight` [g] ×0.001（kxreus では部品（body）の重さの和）。重心は部品の体積重心
  （`body :centroid`, ワールド [mm]）を重さで平均してリンク座標系にしたもの ×0.001。慣性は下の箱を一様な密度の
  直方体とみなし（odedyna が ODE に渡すのと同じ）、平行軸の定理で重心まわりに合成したもの [g·mm²] ×1e-9
  （`inertia_from: "boxes"`）。kxreus のリンクの `:centroid` / `:inertia-tensor` は、リンクを作ったときの座標系の
  ままで最終的なリンク座標系になっていない（例: kxrl2l6a6h2 の head-neck-p の重心が 12 cm ずれる, 左右の腕で
  符号が逆）ので使わない（`(eus2physics r :use-link-inertia t)` で使える）。重心と箱の中心の重み付き平均の差は 2.5 mm 以内。
- 衝突形状（odedyna と同じ）: リンクの物体（body）ごとに 1 つの箱。物体自身の座標系での頂点の外接直方体
  （`make-model-obb-cube body (list body) :thr -1 :grow 0`）。回転体（csg が `:revolution`）は円柱（z 軸）。
  `pos`/`rot` は箱の中心と向き（リンク座標系）。`mass` は物体の重さ（odedyna は箱ごとに一様な箱の質量にし、
  リンクの箱をすべて 1 つの ODE の剛体にまとめる = `d-assoc`）。ロボット自身の中では衝突させない（`d-no-collision`）。
  メッシュ（`"mesh"`）は使っていない。
- 関節（ODE の hinge / slider）: 親 = 親リンク, 子 = 子リンク, 軸 = JSON の joint の axis（子リンク座標系）,
  アンカー = 子リンクの原点。odedyna は ODE の関節を作ったときの姿勢を角度 0 として、目標から初期角を引く。
  可動範囲は目標値を `min`/`max` で切るだけ（LoStop/HiStop は使っていない）。
- `"motor": "rotation"`（車輪）: odedyna は子の物体名に wheel を含む関節を速度制御にする。export-motions.l は
  さらに kxreus の `rcb4-interface :wheel-sids / :rotate-sids`（回転モードのサーボ）の関節も `"rotation"` にする
  （例 kxrl4r の `*-shoulder-w`, `*-crotch-w`）。このとき motions の値は角度ではなくサーボの回転指令を角度の式で
  変換したもの。odedyna では `Vel = 20 * target[rad] / π`（rad/s）, `FMax = 1e6` で回す（`d-joint-rotation`）。
- サーボの制御則（odedyna `motor-module :control` → `d-joint-servo`）: 毎ステップ（dt）
  ```
  target_k = 目標角の列の次の値（rad）
  dJointSetHingeParam(j, dParamVel,  kp * (target_k - dJointGetHingeAngle(j)))   // [rad/s]
  dJointSetHingeParam(j, dParamFMax, fmax)                                     // [N·m]
  ```
  目標角の列は、角度指令（`(send djoint :angle 角度 時間ms)`）ごとに、前の目標から新しい目標まで
  `floor(時間 / (dt×1000))` 個に直線補間して積む（`:linear`, `:min-jerk` も選べる）。モーションの 50 fps の
  フレームを直線補間したものを目標にすれば同じになる。`damping`（dgain）は odedyna では使われていない（0）。
  `vmax` は odedyna にはなく、アプリで `|Vel|` を切る値。
- 値: odedyna の既定は `kp = 10 /s`, `fmax = 500000 N·m`（実質無制限, `odedyna_motor`）。`joints[].fmax/vmax` は
  KXR 標準サーボ KRS-3304R2 ICS の **公称値**（13.9 kgf·cm = 1.363 N·m, 0.13 s/60° = 8.06 rad/s, 11.1 V）で、
  測った値ではない。`kp` は odedyna と同じ 10。
- 世界: 重力 −9.81, `dt = 0.01 s`（`d-init` の既定。dworld 単体の既定は 0.001）, `dWorldStep`（quickstep なし。
  `:quick t` のときは `dWorldQuickStepNumIterations 30`）, ERP 0.2, CFM 0.01（`:soft-setting`）。
- 接触: 地面は平面 z = 0（`dCreatePlane 0 0 1 0`）。mode = Bounce | SoftERP | SoftCFM | Approx1, mu 0.1
  （`d-init :cmu 0.1`; mu2 は使われない）, bounce 0.01, bounce_vel 1.0, soft_erp 0.2, soft_cfm 0.01,
  1 組の形状あたり接触点 1 個（`:max-contacts 1`）。
- 初期位置: `initial.root_pos` は reset-pose で衝突形状（箱）の最も低い点が z = 0 になるルートの位置
  （`shapes_min_z` の符号を変えたもの）。メッシュの最低点は `meshes_min_z`。アプリは箱を使うなら `root_pos`、
  メッシュから自分で計算するなら `meshes_min_z` を使う（odedyna はロボットのモデルの位置のまま始める）。

## iPhone アプリ EusView と, EusLisp からの実時間の表示

- アプリ: `ios/`（SwiftUI + SceneKit）。`robots/<グループ>/*.json`（kxr / khr / jsk）をアプリに入れて表示する。
  ```
  make -C eusview/ios project DEVELOPMENT_TEAM=<チーム ID> XCODEGEN=<xcodegen>
  make -C eusview/ios device DEVICE=<xcrun devicectl list devices の ID>
  ```
  ロボットを選ぶ → 関節のスライダー / 姿勢 / 動作（歩行）/ 接続
- EusLisp から動かす（`live.py` が中継: EusLisp → TCP 8767 → WebSocket 8766 → iPhone）
  ```
  python3 eusview/live.py &
  # iPhone の EusView で sample-robot を開き「接続」→ ws://<Mac の IP>:8766/ → 接続する
  EUS_TIMEOUT=600 eusview/run-eus.sh eusview/live-walk.l     # 歩行を計算しながら送る
  ```
  自分のプログラムからは `(load "eusview/eus2live.l") (live-connect) ... (live-send *robot*)` で、
  `send *irtviewer* :draw-objects` の代わりに `live-send` を呼べばよい（関節角とルートの位置を送る）。

## 物理モード（ODE, eusdyna と同じ考え方）

- `ios/third_party/ODE.xcframework`: ODE 0.16.5（倍精度）。作り直しは `ios/third_party/build-ode.sh`
- `ios/EusView/Physics/odesim.{h,cpp}`: ODE の薄い C の層。`PhysicsSim.swift`: JSON の physics から剛体・箱/円柱の形状・ヒンジとサーボを作る
  - サーボ: 毎ステップ `Vel = kp (目標 − 角度)`, `FMax = fmax`（既定は odedyna_motor: kp 10, 力は実質無制限）。車輪（motor: rotation）は `Vel = 20 目標/π`
  - world: dt 0.01 s, dWorldStep。ただし関節の CFM は 1e-5 以下にしている（JSON の 0.01 は SI 単位では柔らかすぎて、関節が伸びて 2 cm 沈む）
  - 当たり判定はロボットと床（z = 0）だけ。ロボットどうしの当たりは見ない
- Mac での確認: `tools/physicstest.swift`（README の手順: odesim.cpp と一緒に swiftc でビルド）。
  kxrl2l6a6h2 は reset-pose で立ち続け, 「ゆっくり歩行前（5回）」で約 8 cm 前に進む。「前転」「腕立伏せ」のあとは倒れたまま

## Mac で動かす（Mac Catalyst）

同じコードを Mac のアプリとしてビルドできる（Intel Mac でも可。ODE.xcframework に Mac Catalyst 用も入れてある）。
```
make -C eusview/ios project DEVELOPMENT_TEAM=<チーム ID> XCODEGEN=<xcodegen>
make -C eusview/ios mac
open eusview/ios/build/Build/Products/Release-maccatalyst/EusView.app
```

## Ubuntu: kxreus のデモ版 EusView（irteusgl, 2026-10-05）

Ubuntu では iPhone / Mac アプリの代わりに、kxreus のデモ `~/kxreus/eusview.l` で同じことができる
（irtviewer + X パネル。KXR / KHR / JSK の選択, 姿勢, プロジェクトのモーション（RCB4 エミュレーション）,
物理, 関節のスライダー, live）。

```
cd ~/kxreus && irteusgl eusview.l "(eusview)"    # または make eusview
make eusview-desktop     # デスクトップとアプリ一覧に EusView のアイコン（eusview.sh を起動）
```
- 物理: kxrdyna.l（eusdyna）があればそれ、なければ `~/kxreus/eusview-physics.l`。このアプリの
  `ios/EusView/Physics/odesim.{h,cpp}` を `~/kxreus/eusview-ode/` にコピーし、`make eusview-ode` で
  `$ARCHDIR/lib/libeusviewode.so`（Ubuntu は `sudo apt install libode-dev`）にして defforeign で呼ぶ。
  質量・形は eus2physics.l と同じ作り方なので、kxrl2l6a6h2 の立ち姿（腰 z 213 → 208 mm, 3 秒で x +29 mm の
  すべり）はアプリの tools/physicstest.swift と同じ値になる。
- 日本語のモーション名・状態の行は `~/kxreus/eusview-xft.l`（libXft + fontconfig, fonts-noto-cjk など）。
- live ボタンは `~/kxreus/eusview-live.py`（この `live.py` のコピー）へ関節角とルートの座標を送る。
- モーションの再生は export-motions.l と同じ考え方（キーフレームを求めて補間, 命令にないサーボは保持）。
- 使い方の詳細は eusview.l の先頭と kxreus の kxr-document.txt「50. EusView デモ」。
