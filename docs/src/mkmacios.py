# Mac と iPhone の計測結果 (phone/native/*.json, logs/mac_eus_*.log) を macios.json にまとめる
#   cd docs/src && python3 mkmacios.py && node build_macios.js
import glob, json, os, re

N = '../../phone/native'
NAIVE = 'C++ 素朴なループ FP32（1 スレッド, SIMD なし）'
GPU = 'GPU（Metal MPSGraph）FP32'
cnn = json.load(open('cnn.json'))


def load(pat):
    runs = [json.load(open(f)) for f in sorted(glob.glob(os.path.join(N, pat)))]
    return [r for r in runs if r['info'].get('quick') == '0']


def per(r): return r['sec'] / r['n']


def best(runs, method, task):
    """同じ方法・内容の中で最も速い 1 枚あたりの時間 [s] (複数回・複数エポックの最小)"""
    v = [per(r) for run in runs for r in run['results'] if r['method'] == method and r['task'] == task]
    return min(v) if v else None


def acc(runs, method, task):
    for run in runs:
        for r in run['results']:
            if r['method'] == method and r['task'] == task and r.get('acc') is not None:
                return r['acc']


def note(runs, method, task):
    for run in runs:
        for r in run['results']:
            if r['method'] == method and r['task'] == task and r.get('note'):
                return r['note']


# EusLisp nn.l (Mac): 1 エポックの実時間. 静かなときの 2 回目のエポックを使う
eus = []
for f in sorted(glob.glob('logs/mac_eus_epoch*.log')) + sorted(glob.glob('logs/mac_eus_veclib*.log')):
    for m in re.finditer(r'EPOCH (\d) wall\s+([\d.]+) s cpu\s+([\d.]+) s', open(f).read()):
        eus.append({'log': os.path.basename(f), 'epoch': int(m.group(1)), 'wall': float(m.group(2)), 'cpu': float(m.group(3))})
# epoch1.log の 1 回目は ios/ のビルドと重なった可能性があるので除く (epoch2*.log は静かなときに計測)
eus_multi = [e for e in eus if e['log'].startswith('mac_eus_epoch2')]
eus_one = [e for e in eus if 'veclib' in e['log']]
eus_test = re.search(r'correct (\d+) / 10000', open('logs/mac_eus_epoch1.log').read())

devices = {}
for key, pat in [('mac', 'mac_*.json'), ('iphone', 'iphone_*.json')]:
    runs = load(pat)
    if not runs:
        continue
    d = {'info': runs[-1]['info'], 'nruns': len(runs)}
    E = {}
    for kind in ['MLP', 'CNN']:
        for m in [NAIVE, 'C++ + Accelerate FP32（1 スレッド）', 'C++ + Accelerate FP32', 'C++ + Accelerate FP64', GPU]:
            v = best(runs, m, f'{kind} 学習')
            if v is not None:
                E[f'{m}|{kind}'] = v * 60000
    d['epoch'] = E
    I = {}
    for kind in ['MLP', 'CNN']:
        for m in [NAIVE, 'C++ + Accelerate FP32', 'C++ + Accelerate FP64', GPU] + [f'Core ML FP16 {u}' for u in ['CPU', 'CPU+GPU', 'CPU+Neural Engine', 'すべて']] + ['Core ML CPU', 'Core ML CPU+GPU', 'Core ML CPU+Neural Engine', 'Core ML すべて']:
            b, o = best(runs, m, f'{kind} 推論'), best(runs, m, f'{kind} 推論 1 枚ずつ')
            med = note(runs, m, f'{kind} 推論 1 枚ずつ')
            if b is not None or o is not None:
                I[f'{m}|{kind}'] = {'batch_ms': b and b * 1000, 'one_ms': o and o * 1000, 'acc': acc(runs, m, f'{kind} 推論'),
                                    'median_ms': float(re.search(r'([\d.]+) ms', med).group(1)) if med else None}
            ld = best(runs, m, f'{kind} 読み込み')
            if ld is not None:
                I[f'{m}|{kind}']['load_ms'] = ld * 1000
                pl = note(runs[::-1], m, f'{kind} 読み込み')  # 層の割り当て (新しい計測から)
                if pl: I[f'{m}|{kind}']['plan'] = pl.replace('層の割り当て: ', '')
    d['infer'] = I
    devices[key] = d

P = {
    'dgx': {
        'eus': 26.1,
        'cpu32': cnn['epoch']['mlp']['cpu32'], 'cpu32_cnn': cnn['epoch']['cnn']['cpu32'],
        'cpu64': cnn['epoch']['mlp']['cpu64'], 'cpu64_cnn': cnn['epoch']['cnn']['cpu64'],
        'gpu32': cnn['epoch']['mlp']['gpu32'], 'gpu32_cnn': cnn['epoch']['cnn']['gpu32'],
        'infer_cpu_ms': {'MLP': cnn['infer']['mlp']['cpu'][0] / 10, 'CNN': cnn['infer']['cnn']['cpu'][0] / 10},
        'infer_gpu_ms': {'MLP': cnn['infer']['mlp']['gpu'][0] / 10, 'CNN': cnn['infer']['cnn']['gpu'][0] / 10},
        'onnx_one_ms': {'MLP': 0.070, 'CNN': 0.089},
    },
    'eus_mac': {'runs': eus, 'best_wall': min(e['wall'] for e in eus_multi), 'max_wall': max(e['wall'] for e in eus_multi),
                'one_thread': eus_one[0]['wall'] if eus_one else None, 'test_correct': int(eus_test.group(1)) if eus_test else None},
    'devices': devices,
}
json.dump(P, open('macios.json', 'w'), ensure_ascii=False, indent=1)
for k, d in devices.items():
    print(k, d['nruns'], {a: round(b, 2) for a, b in d['epoch'].items()})
print('eus', P['eus_mac']['best_wall'], P['eus_mac']['max_wall'], P['eus_mac']['one_thread'])

# ---------- スライドの文章 (計測値から作る) ----------
def fs(s): return f'{s:.0f} 秒' if s >= 100 else f'{s:.1f} 秒' if s >= 10 else f'{s:.2f} 秒' if s >= 1 else f'{s*1000:.0f} ms'
def fms(ms): return f'{ms:.2f} ms' if ms >= 1 else f'{ms*1000:.0f} µs' if ms >= 0.01 else f'{ms*1000:.1f} µs'
def x(a, b): r = a / b; return f'{r:.0f} 倍' if r >= 10 else f'{r:.1f} 倍'
M, I = devices['mac'], devices['iphone']
e = lambda d, m, k: d['epoch'].get(f'{m}|{k}')
f = lambda d, m, k, key='batch_ms': (d['infer'].get(f'{m}|{k}') or {}).get(key)
F32, F1, F64 = 'C++ + Accelerate FP32', 'C++ + Accelerate FP32（1 スレッド）', 'C++ + Accelerate FP64'
CF = lambda u: f'Core ML FP16 {u}'
G = P['dgx']
IPN = I['info']['name']
ane = f(I, CF('CPU+Neural Engine'), 'CNN'); icpu = f(I, CF('CPU'), 'CNN'); igpu = f(I, CF('CPU+GPU'), 'CNN')
P['summary'] = (f"{IPN} の CPU（Accelerate）は MLP・CNN の学習とも Mac と DGX Spark の CPU より速い（CNN 1 エポック {fs(e(I, F32, 'CNN'))}、DGX の CPU {fs(G['cpu32_cnn'])}）。"
                f"推論は Neural Engine が最速で CNN 1 枚 {fms(ane)}（CPU の {x(icpu, ane)}）。ハードウェアを使わない素朴なループと比べると学習で {x(e(I, NAIVE, 'CNN'), e(I, F32, 'CNN'))}（CNN）〜{x(e(I, NAIVE, 'MLP'), e(I, F32, 'MLP'))}（MLP）速い。")
P['epoch_notes'] = [
    f"{IPN} の C++ + Accelerate は MLP {fs(e(I, F32, 'MLP'))}・CNN {fs(e(I, F32, 'CNN'))}。Mac（{fs(e(M, F32, 'MLP'))}・{fs(e(M, F32, 'CNN'))}）や DGX Spark の CPU（{fs(G['cpu32'])}・{fs(G['cpu32_cnn'])}）より速い",
    f"iPhone の GPU（MPSGraph）は CNN {fs(e(I, GPU, 'CNN'))} で CPU と同じくらい。Mac の内蔵 GPU は {fs(e(M, GPU, 'CNN'))} で CPU より遅い",
    f"EusLisp の nn.l（Mac {P['eus_mac']['best_wall']:.0f} 秒）は、同じ計算の C++ の約 {P['eus_mac']['best_wall']/e(M, F32, 'MLP'):.0f} 倍の時間。DGX の CUDA（CNN {fs(G['gpu32_cnn'])}）が最速",
]
P['train_notes'] = [
    f"FP64 は FP32 の Mac で 1.4〜1.7 倍、iPhone で 1.4〜2.4 倍の時間。iPhone の行列ユニットは FP32 が得意",
    "GPU（MPSGraph）は FP32 のみ。最初の 1 バッチはグラフの準備（コンパイル）に使い、時間に含めない。値は 2 回の計測・2 エポックの速い方",
]
P['infer_notes'] = ["Core ML（旧）= 1 枚ずつ受け取る NeuralNetwork 形式（FP32）。Core ML（新）= ML Program 形式（FP16）を 100 枚ずつ渡す。「すべて」は Neural Engine と同じ値なので省いた",
                    "1 枚ずつ呼ぶと、どの方法も 1 回の呼び出しの手間（数十 µs〜1 ms）が目立つ"]
P['coreml_notes'] = [
    f"旧形式（1 枚ずつ, FP32）では、Neural Engine を選んでも MLP は全層が CPU。CNN は Neural Engine に載るが {fms(f(I, 'Core ML CPU+Neural Engine', 'CNN'))} で CPU（{fms(f(I, 'Core ML CPU', 'CNN'))}）より遅い",
    f"新形式（ML Program, FP16, 100 枚ずつ）にすると全層が Neural Engine に載り、CNN {fms(ane)}・MLP {fms(f(I, CF('CPU+Neural Engine'), 'MLP'))}。CPU の {x(icpu, ane)}、GPU の {x(igpu, ane)} 速い",
    "Neural Engine の力を出すには、FP16 の新形式にして、まとめて渡すことが必要",
]
P['hw_train_notes'] = [f"iPhone の CPU は 1 スレッドでも行列ユニットで速い。素朴なループとの差は MLP で {x(e(I, NAIVE, 'MLP'), e(I, F1, 'MLP'))}",
                       "Neural Engine は学習には使えない（Core ML は推論用）"]
P['hw_infer_notes'] = [
    f"iPhone: 素朴なループ {fms(f(I, NAIVE, 'CNN'))} → Accelerate {fms(f(I, F32, 'CNN'))} → GPU {fms(f(I, GPU, 'CNN'))}（MPSGraph）→ Neural Engine {fms(ane)}",
    f"素朴なループから Neural Engine まで約 {f(I, NAIVE, 'CNN')/ane:.0f} 倍",
    f"Mac: 素朴なループ {fms(f(M, NAIVE, 'CNN'))} → Accelerate {fms(f(M, F32, 'CNN'))} → GPU {fms(f(M, GPU, 'CNN'))}。Neural Engine はないので CPU と同じ",
    "Core ML は新形式（FP16, 100 枚ずつ）の値",
]
P['discussion'] = [
    ["CPU の SIMD・行列ユニットが土台", f"素朴なループ → Accelerate（1 スレッド）で MLP の学習が Mac {x(e(M, NAIVE, 'MLP'), e(M, F1, 'MLP'))}、iPhone {x(e(I, NAIVE, 'MLP'), e(I, F1, 'MLP'))}。iPhone は行列ユニットの効果が大きい"],
    ["iPhone の CPU は DGX の CPU より速い", f"CNN の学習 {fs(e(I, F32, 'CNN'))} 対 {fs(G['cpu32_cnn'])}。小さな行列積は、コア数より 1 コアの速さと行列ユニットが効く"],
    ["Neural Engine は推論で最速", f"新形式（FP16）でまとめて渡すと CNN 1 枚 {fms(ane)}。旧形式・1 枚ずつでは CPU より遅いこともある"],
    ["GPU は大きさと種類しだい", f"iPhone の GPU は学習で CPU と同じくらい、推論のまとめ処理で CPU より速い。Intel Mac の GPU は CPU より遅い。DGX の GB10 は桁違い"],
    ["EusLisp は行列積以外が重い", f"nn.l は Mac でも DGX でも約 30 秒。同じ計算の C++ は Mac で {fs(e(M, F32, 'MLP'))}"],
    ["精度と認識数", "10,000 枚で測った方法は FP64・FP32・FP16 のどれでも認識数 MLP 9824・CNN 9917（iPhone の FP16 の CPU だけ CNN 9916）。EusLisp の結果と同じ"],
]
P['conclusion'] = [
    f"元の EusLisp（nn.l）を Mac で動かした。1 エポック約 {P['eus_mac']['best_wall']:.0f} 秒で DGX Spark（26.1 秒）とほぼ同じ",
    "DGX の CUDA 版を C++ + Accelerate と MPSGraph（GPU）に移植し、Mac と iPhone 16 Pro で同じコードを動かした",
    f"iPhone の CPU は CNN 1 エポック {fs(e(I, F32, 'CNN'))} で、Mac（{fs(e(M, F32, 'CNN'))}）や DGX の CPU（{fs(G['cpu32_cnn'])}）より速い",
    f"ハードウェアを使う・使わないの差は大きい: 素朴なループ → 行列ユニット → Neural Engine で CNN の推論が {fms(f(I, NAIVE, 'CNN'))} → {fms(ane)}（約 {f(I, NAIVE, 'CNN')/ane:.0f} 倍）",
    "Neural Engine は推論専用。FP16 の新形式にし、まとめて渡すと力が出る",
    "ブラウザ（Safari）は手軽だがネイティブより 1〜2 桁遅く、iPhone では WebGL の CNN の学習が止まった",
]
json.dump(P, open('macios.json', 'w'), ensure_ascii=False, indent=1)
print(P['summary'])

# ---------- ブラウザ (同じ計測ページ phone/site) ----------
def brun(fn):
    d = json.load(open(fn)); R = d.get('results', d)
    return [r for r in R if not r.get('skipped') and 'sec' in r]
BR = {'DGX Spark（Chromium）': brun('../../phone/dgx_browser.json')}
for label, pat in [('Mac（Safari）', 'browser_MacBook*.json'), ('iPhone（Safari）', 'browser_iPhone*.json')]:
    fs_ = sorted(glob.glob(os.path.join(N, pat)))
    if fs_: BR[label] = brun(fs_[-1])
BMETH = ['JavaScript（自作）', 'TensorFlow.js WASM', 'TensorFlow.js WebGL（GPU）', 'TensorFlow.js WebGPU（GPU）', 'TensorFlow.js CPU（JS）']
browser = {}
for env, R in BR.items():
    t = {}
    for r in R:
        per1 = r['sec'] / r['n']
        key = f"{r['method']}|{r['task']}"
        if 'acc' in r and r.get('acc') is not None and r['task'].endswith('推論'):
            pass
        t[key] = per1 * 60000 if r['task'].endswith('学習') else per1 * 1000  # 学習: 1 エポック [s], 推論: 1 枚 [ms]
    browser[env] = t
P['browser'] = browser
P['browser_methods'] = BMETH
json.dump(P, open('macios.json', 'w'), ensure_ascii=False, indent=1)
print('browser envs', list(browser))

# ブラウザの文章
def bget(env, m, t): return browser.get(env, {}).get(f'{m}|{t}')
def bbest(env, t):
    c = [(bget(env, m, t), m) for m in BMETH if bget(env, m, t) is not None]
    return min(c) if c else (None, None)
SH = {'JavaScript（自作）': 'JS 自作', 'TensorFlow.js WASM': 'TF.js WASM', 'TensorFlow.js WebGL（GPU）': 'TF.js WebGL', 'TensorFlow.js WebGPU（GPU）': 'TF.js WebGPU', 'TensorFlow.js CPU（JS）': 'TF.js CPU'}
EI = 'iPhone（Safari）' if 'iPhone（Safari）' in browser else None
EM = 'Mac（Safari）'
lines = []
for env, nm in [('DGX Spark（Chromium）', 'DGX'), (EM, 'Mac'), (EI, 'iPhone')]:
    if not env: continue
    v, m = bbest(env, 'CNN 学習')
    lines.append(f"{nm}: CNN 1 エポック最速は {SH[m]} の {fs(v)}" + (f"（同じ機器のネイティブ C++ {fs(e(devices['mac' if nm == 'Mac' else 'iphone'], F32, 'CNN'))}）" if nm != 'DGX' else f"（ネイティブ CUDA {fs(G['gpu32_cnn'])}）"))
P['browser_train_notes'] = lines + [
    "WebGPU は Mac の Safari（macOS 15）では使えず、iPhone では LAN の http で開いたため使えなかった（WebGPU は https などの安全なページでだけ使える）。WASM の TF.js は CNN の学習に未対応",
    "iPhone の Safari では TF.js WebGL の CNN の学習が途中で止まって進まなかったので、その項目だけ飛ばして測った。そのため iPhone の CNN の学習は GPU なしの値",
    "ブラウザの JS 自作・WASM は 1 スレッド。ネイティブの Accelerate（複数コア・行列ユニット）とは大きな差がある",
] + ([] if EI else ["iPhone の Safari は計測中（結果が届きしだい入れる）"])
il = []
for env, nm in [('DGX Spark（Chromium）', 'DGX'), (EM, 'Mac'), (EI, 'iPhone')]:
    if not env: continue
    v, m = bbest(env, 'CNN 推論')
    il.append(f"{nm}: CNN まとめての最速は {SH[m]} で 1 枚 {fms(v)}")
P['browser_infer_notes'] = il + ["1 枚ずつは GPU を呼ぶ手間（数 ms）が目立ち、WASM（CPU）が速い。ネイティブアプリ（Core ML）はブラウザより 1〜2 桁速い"]
json.dump(P, open('macios.json', 'w'), ensure_ascii=False, indent=1)
