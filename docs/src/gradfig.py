import numpy as np, torch, torch.nn.functional as F, re, json
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
import matplotlib.font_manager as fm, glob
for f in glob.glob('/home/mi/.local/share/fonts/bizud/*.ttf'): fm.fontManager.addfont(f)
plt.rcParams['font.family']='BIZ UDPGothic'
exec(open('cnn_analysis.py').read().split("d=np.load")[1].split("P={k")[0].join(["",""]) if False else "")
def parse(fn):
    s=open(fn).read(); out=[]; cur=None
    for m in re.finditer(r"#2f\(\((.*?)\)\)|#f\(([^)]*)\)|nil",s):
        if m.group(0)=='nil': out.append(None); continue
        if m.group(1) is not None: cur=np.array([np.array(r.split(),float) for r in re.split(r'\)\s*\(',m.group(1))])
        else: out.append((cur,np.array(m.group(2).split(),float))); cur=None
    return out
P=parse('params-cnn.l')
d=np.load('datasets.npz'); x=torch.tensor(d['test_images'][0],dtype=torch.float64).view(1,1,28,28); lab=torch.tensor([int(d['test_labels'][0,0])])
T={l:[torch.tensor(P[l][0]),torch.tensor(P[l][1])] for l in [0,3,6,8]}
for l in T:
    for t in T[l]: t.requires_grad_()
def relu0(u): return u*(u>=0).to(u.dtype)
u1=F.conv2d(x,T[0][0].view(20,1,5,5),T[0][1]); u1.retain_grad()
h=F.max_pool2d(relu0(u1),2); u2=F.conv2d(h,T[3][0].view(50,20,5,5),T[3][1]); u2.retain_grad()
h2=F.max_pool2d(relu0(u2),2).permute(0,2,3,1).reshape(1,-1)
o=relu0(h2@T[6][0].T+T[6][1])@T[8][0].T+T[8][1]
loss=F.cross_entropy(o,lab,reduction='sum'); loss.backward()
g=T[0][0].grad.view(20,5,5).numpy(); k=int(np.argmax(np.abs(g).sum((1,2))))
du=u1.grad[0,k].numpy(); fmap=relu0(u1)[0,k].detach().numpy()
fig,axs=plt.subplots(1,5,figsize=(12,2.9),dpi=160,gridspec_kw=dict(width_ratios=[28,24,24,7,7]))
axs[0].imshow(x[0,0],cmap='gray'); axs[0].set_title('入力 x（28×28）',fontsize=10)
axs[1].imshow(fmap,cmap='magma'); axs[1].set_title(f'カーネル {k} の出力 z（24×24）',fontsize=10)
v=np.abs(du).max(); axs[2].imshow(du,cmap='RdBu_r',vmin=-v,vmax=v); axs[2].set_title('戻ってきた誤差 δ = ∂L/∂u（24×24）',fontsize=10)
gk=g[k]; v2=np.abs(gk).max(); axs[3].imshow(gk,cmap='RdBu_r',vmin=-v2,vmax=v2); axs[3].set_title('勾配 ΔW\n（5×5）',fontsize=10)
wk=P[0][0][k].reshape(5,5); v3=np.abs(wk).max(); axs[4].imshow(wk,cmap='RdBu_r',vmin=-v3,vmax=v3); axs[4].set_title('今の重み W\n（5×5）',fontsize=10)
for a in axs: a.set_xticks([]); a.set_yticks([])
plt.tight_layout(); plt.savefig('figc/conv_grad.png'); plt.close()
# check: ΔW = Σ_positions δ(oy,ox) * x[oy:oy+5, ox:ox+5]
X=x[0,0].numpy(); acc=np.zeros((5,5))
for oy in range(24):
    for ox in range(24): acc+=du[oy,ox]*X[oy:oy+5,ox:ox+5]
print('kernel',k,'check |manual - autograd|',np.abs(acc-gk).max(), 'nonzero delta positions', int((np.abs(du)>1e-12).sum()))
json.dump(dict(k=k,nz=int((np.abs(du)>1e-12).sum())),open('gradfig.json','w'))
