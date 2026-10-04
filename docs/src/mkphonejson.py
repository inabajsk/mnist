import json, glob, os
W='.'
dgx=json.load(open('../../phone/dgx_browser.json'))
phones=[]
for f in sorted(glob.glob('../../phone/db/runs/*.json')):
    d=json.load(open(f)); d=d.get('data',d)
    phones.append(d)
phones.sort(key=lambda d:d['when'])
per=lambda r:r['sec']/r['n']
def best(R,task):
    c=[r for r in R if not r.get('skipped') and r['task']==task]
    return min(c,key=per) if c else None
def of(R,m,task):
    for r in R:
        if r.get('method')==m and r.get('task')==task: return r
SHORT={"JavaScript（自作）":"JS 自作","TensorFlow.js WASM":"TF.js WASM","TensorFlow.js WebGL（GPU）":"TF.js WebGL","TensorFlow.js WebGPU（GPU）":"TF.js WebGPU","TensorFlow.js CPU（JS）":"TF.js CPU"}
name=lambda p:p.get('device') or 'スマートフォン'
def fs(s): return f'{s:.0f} 秒' if s>=100 else f'{s:.1f} 秒' if s>=10 else f'{s:.2f} 秒' if s>=1 else f'{s*1000:.0f} ms'
R=dgx['results']
epoch_rows=[["DGX: EusLisp + OpenBLAS（nn.l）",26.1,None],["DGX: C + OpenBLAS（CPU）",4.25,28.97],["DGX: CUDA GPU（FP32）",0.099,0.426]]
def add_env(label,RR):
    m,c=best(RR,'MLP 学習'),best(RR,'CNN 学習')
    epoch_rows.append([f"{label} 最速（{SHORT[m['method']]} / {SHORT[c['method']]}）",per(m)*60000,per(c)*60000])
    j1,j2=of(RR,'JavaScript（自作）','MLP 学習'),of(RR,'JavaScript（自作）','CNN 学習')
    if j1 and j2: epoch_rows.append([f"{label} JS 自作",per(j1)*60000,per(j2)*60000])
add_env('DGX ブラウザ',R)
for p in phones: add_env(name(p),p['results'])
infer_rows=[["DGX: CUDA GPU（FP32, 常駐）",0.004239/10,0.041264/10,None,None],["DGX: ONNX Runtime（ARM CPU 4 スレッド）",0.1956/10,0.3805/10,0.070,0.089]]
def add_inf(label,RR):
    b1,b2=best(RR,'MLP 推論'),best(RR,'CNN 推論'); s1,s2=best(RR,'MLP 推論 1 枚ずつ'),best(RR,'CNN 推論 1 枚ずつ')
    infer_rows.append([f"{label} 最速（{SHORT[b2['method']]}）",per(b1)*1000,per(b2)*1000,per(s1)*1000 if s1 else None,per(s2)*1000 if s2 else None])
    for m in ["TensorFlow.js WASM","TensorFlow.js WebGL（GPU）","TensorFlow.js WebGPU（GPU）","JavaScript（自作）"]:
        a,b=of(RR,m,'MLP 推論'),of(RR,m,'CNN 推論'); c,d=of(RR,m,'MLP 推論 1 枚ずつ'),of(RR,m,'CNN 推論 1 枚ずつ')
        if a and b: infer_rows.append([f"　{label} {SHORT[m]}",per(a)*1000,per(b)*1000,per(c)*1000 if c else None,per(d)*1000 if d else None])
add_inf('DGX ブラウザ',R)
for p in phones: add_inf(name(p),p['results'])
dm,dc=best(R,'MLP 学習'),best(R,'CNN 学習')
P={'dgx_browser':dgx,'phones':phones,'ref':{'cuda_cnn32':0.426,'cuda_mlp32':0.099},'epoch_rows':epoch_rows,'infer_rows':infer_rows,
   'artifact_url':'https://claude.ai/artifact/3373AhmSK4JkSFxqCw6e3S'}
P['dgx_notes']=[f"GPU を使う WebGL・WebGPU が最速。CNN 1 エポックは {SHORT[dc['method']]} で {fs(per(dc)*60000)}（ネイティブの CUDA {fs(0.426)} の約 {per(dc)*60000/0.426:.0f} 倍）",
  "自作 JS は 1 コアの素朴なループで、WebGPU の数百倍遅い。TF.js CPU はさらに遅い（参照用の実装で最適化されていない）",
  "WASM は SIMD 版の単一スレッド（このページは cross-origin isolation がないのでスレッドが使えない）"]
if phones:
    p=phones[-1]; RR=p['results']; m,c=best(RR,'MLP 学習'),best(RR,'CNN 学習'); ci=best(RR,'CNN 推論')
    P['summary']=f"{name(p)} のブラウザでは、CNN の 1 エポックが {fs(per(c)*60000)}（{SHORT[c['method']]}）、MLP が {fs(per(m)*60000)}（{SHORT[m['method']]}）。DGX Spark の CUDA より CNN で約 {per(c)*60000/0.426:.0f} 倍、元の EusLisp（MLP 26.1 秒）と比べると MLP で {26.1/(per(m)*60000):.1f} 倍{'速い' if per(m)*60000<26.1 else '遅い'}。推論は 1 枚 {per(ci)*1000:.2f} ms（まとめて処理）。"
    for p in phones:
        RR=p['results']; m,c=best(RR,'MLP 学習'),best(RR,'CNN 学習'); j=of(RR,'JavaScript（自作）','CNN 学習')
        dmg=per(c)/per(dc)
        p['notes']=[f"最速は {SHORT[m['method']]}（MLP 学習）と {SHORT[c['method']]}（CNN 学習）。CNN 1 エポック {fs(per(c)*60000)} は DGX Spark のブラウザ（{fs(per(dc)*60000)}）の {dmg:.1f} 倍",
                    f"自作 JS の CNN 学習は 1 エポック換算 {fs(per(j)*60000)}" if j else "",
                    "スキップした方法: "+("、".join(p.get('skipped',[])) or "なし")]
        p['notes']=[x for x in p['notes'] if x]
else:
    P['summary']="スマートフォンでの計測はまだです（計測ページで実行すると入ります）。DGX Spark のブラウザでは WebGPU / WebGL が速く、CNN の 1 エポックが約 11〜14 秒、MLP が 1.4 秒だった。"
P['epoch_notes']=["ネイティブの CUDA（DGX）が最速。ブラウザの GPU（WebGL / WebGPU）はその数倍〜数十倍",
                  "同じ JS でも CPU だけの方法は GPU の方法より 2〜3 桁遅い",
                  "スマートフォンの値は短い計測からの換算。長く動かすと熱で遅くなることがある"]
P['infer_notes']=["まとめて処理するなら GPU（WebGPU / WebGL）が速い",
                  "1 枚だけの応答は、GPU に仕事を渡す手間（数 ms）が目立ち、WASM（CPU）の方が速いことが多い",
                  "WASM の 1 枚の時間はブラウザのタイマーの細かさ（0.1〜0.5 ms 程度）で丸められている",
                  "ネイティブの ONNX Runtime は 1 枚 0.07〜0.09 ms。アプリにすればブラウザより速くできる"]
P['discussion']=[["GPU は「まとめて」で効く","1,000 枚ずつまとめると WebGL / WebGPU が CPU より 1〜2 桁速い。1 枚ずつでは GPU を呼ぶ手間が勝つ"],
  ["ブラウザの CPU は 1 コア","JS も WASM も、このページでは 1 スレッド。WASM の SIMD で JS より数十倍速い"],
  ["NPU はブラウザから使えない","Neural Engine や Hexagon を使うには Core ML・LiteRT などのアプリが必要。WebNN が広まれば変わる"],
  ["精度と速さ","ブラウザの GPU は FP32（端末によっては FP16）。今回の重みで認識数は EusLisp と同じだった"],
  ["熱と電池","スマートフォンは長く全力で動かすと遅くなる。学習は DGX Spark、推論はスマートフォン、という分担が現実的"],
  ["同じ ARM の仲間","DGX Spark もスマートフォンも ARM CPU + GPU + 統合メモリ。規模の違いが速さの違いになる"]]
P['conclusion']=["スマートフォンで NN を動かすには、ブラウザ・アプリ（Core ML / LiteRT / ONNX Runtime）・OS の AI 機能・Termux・サーバーの方法がある",
  "EusLisp で学習した MNIST の MLP と CNN を、ブラウザで動く計測ページにした（自作 JS と TensorFlow.js の 5 方式、推論と学習）",
  P['summary'],
  "速く動かすなら GPU をまとめて使う。NPU まで使うならアプリにする（ONNX モデルを用意済み）"]
from PIL import Image
im=Image.open(W+'/figp/page.png'); P['page_w'],P['page_h']=im.size
json.dump(P,open(W+'/phone.json','w'),ensure_ascii=False,indent=1)
print('phones',len(phones)); print(P['summary'])
for r in epoch_rows: print(r)
