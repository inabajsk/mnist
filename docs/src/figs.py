import numpy as np, json
from PIL import Image, ImageDraw, ImageFont
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
plt.rcParams['font.family']='Noto Sans CJK JP'
d=np.load('datasets.npz')
Xtr,ytr=d['train_images'],d['train_labels'][:,0].astype(int)
Xte,yte=d['test_images'],d['test_labels'][:,0].astype(int)
INK=(1-1)  # keep native: white ink on black
def sheet(X, start, n, cols=100, fn=None):
    rows=int(np.ceil(n/cols))
    img=np.zeros((rows*28,cols*28),np.uint8)
    for k in range(n):
        r,c=divmod(k,cols)
        img[r*28:(r+1)*28,c*28:(c+1)*28]=np.round(X[start+k].reshape(28,28)*255)
    Image.fromarray(img).save(fn,optimize=True)
sheets=[]
for s in range(12):
    fn=f'fig/train_{s:02d}.png'; sheet(Xtr,s*5000,5000,fn=fn); sheets.append(fn)
for s in range(2):
    fn=f'fig/test_{s:02d}.png'; sheet(Xte,s*5000,5000,fn=fn)
# per-class samples: 20 per class from train
cls=np.zeros((10*28+9*4,20*28+19*4),np.uint8)+40
for c in range(10):
    idx=np.where(ytr==c)[0][:20]
    for k,i in enumerate(idx):
        cls[c*32:c*32+28,k*32:k*32+28]=np.round(Xtr[i].reshape(28,28)*255)
Image.fromarray(cls).resize((cls.shape[1]*3,cls.shape[0]*3),Image.NEAREST).save('fig/class_samples.png')
# a single digit zoom with pixel grid
fig,ax=plt.subplots(figsize=(4,4),dpi=150)
ax.imshow(Xte[0].reshape(28,28),cmap='gray',vmin=0,vmax=1)
ax.set_xticks(np.arange(-.5,28,1),minor=True); ax.set_yticks(np.arange(-.5,28,1),minor=True)
ax.grid(which='minor',color='#555',lw=0.3); ax.set_xticks([0,27]); ax.set_yticks([0,27]); ax.tick_params(which='minor',length=0)
plt.tight_layout(); plt.savefig('fig/digit_zoom.png',transparent=False); plt.close()
print('test[0] label',yte[0])
# misclassified
for nm,X,y in [('test',Xte,yte),('train',Xtr,ytr)]:
    P=np.load(f'P19_{nm}.npy'); pred=P.argmax(1); wrong=np.where(pred!=y)[0]
    np.save(f'wrong_{nm}.npy',wrong)
    cols=22 if nm=='test' else 10
    rows=int(np.ceil(len(wrong)/cols))
    cell=60
    W=Image.new('RGB',(cols*cell,rows*(cell+16)),(255,255,255)); dr=ImageDraw.Draw(W)
    f=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',13) if True else None
    for k,i in enumerate(wrong):
        r,c=divmod(k,cols)
        im=Image.fromarray(np.round(255-X[i].reshape(28,28)*255).astype(np.uint8)).resize((52,52),Image.NEAREST)
        W.paste(im,(c*cell+4,r*(cell+16)+2))
        dr.text((c*cell+6,r*(cell+16)+54),f'{y[i]}→{pred[i]}',fill=(200,30,30),font=f)
    W.save(f'fig/wrong_{nm}.png')
    print(nm,'wrong',len(wrong))
    if nm=='test':
        C=np.zeros((10,10),int)
        for a,b in zip(y,pred): C[a,b]+=1
        np.save('confusion.npy',C); print(C)
        # top confusions
        off=[(C[a,b],a,b) for a in range(10) for b in range(10) if a!=b]; off.sort(reverse=True); print(off[:8])
        print('per-class acc',[round(C[c,c]/C[c].sum()*100,2) for c in range(10)])
        # confidence of wrong
        print('wrong max-prob median',np.median(P[wrong].max(1)), 'right median',np.median(P[pred==y].max(1)))
        # list wrong details incl eus index and original index
        det=[dict(i=int(i),orig=int(9999-i),label=int(y[i]),pred=int(pred[i]),p=float(P[i].max()),p_true=float(P[i,y[i]])) for i in wrong]
        json.dump(det,open('wrong_test.json','w'))
    else:
        det=[dict(i=int(i),orig=int(59999-i),label=int(y[i]),pred=int(pred[i]),p=float(P[i].max())) for i in wrong]
        json.dump(det,open('wrong_train.json','w'))
# confusion heatmap
C=np.load('confusion.npy')
fig,ax=plt.subplots(figsize=(6,5.4),dpi=160)
Cl=C.astype(float).copy(); np.fill_diagonal(Cl,np.nan)
ax.imshow(np.log1p(C*(1-np.eye(10))),cmap='Reds')
for a in range(10):
    for b in range(10):
        v=C[a,b]
        ax.text(b,a,str(v),ha='center',va='center',fontsize=9,color=('#1a3a5c' if a==b else ('white' if v>=8 else '#333')),fontweight=('bold' if a==b else 'normal'))
ax.set_xticks(range(10)); ax.set_yticks(range(10)); ax.set_xlabel('予測ラベル'); ax.set_ylabel('正解ラベル')
ax.set_title('混同行列（テスト10,000枚, epoch 19）',fontsize=11)
plt.tight_layout(); plt.savefig('fig/confusion.png'); plt.close()
# first-layer weights: 100 hidden units
m=np.load('mlp19.npz'); W0=m['W0']; m0=np.load('mlp0.npz')
order=np.argsort(-np.linalg.norm(W0-np.load('mlp0.npz')['W0'],axis=1))[:100]
fig,axs=plt.subplots(10,10,figsize=(6,6),dpi=150)
for a,k in zip(axs.flat,order):
    w=W0[k].reshape(28,28); v=np.abs(w).max(); a.imshow(w,cmap='RdBu_r',vmin=-v,vmax=v); a.axis('off')
plt.subplots_adjust(0.01,0.01,0.99,0.99,0.05,0.05); plt.savefig('fig/w1_filters.png'); plt.close()
# weight histograms epoch0 vs 19 + init uniform
fig,axs=plt.subplots(1,3,figsize=(10,2.8),dpi=150)
for i,a in enumerate(axs):
    a.hist(m[f'W{i}'].ravel(),bins=120,color='#2a6f97',alpha=.85,label='epoch 19')
    a.set_title(f'層{i+1} W {m[f"W{i}"].shape[0]}×{m[f"W{i}"].shape[1]}',fontsize=10); a.set_yticks([])
    a.axvline(-0.08,color='#c44',ls='--',lw=.8); a.axvline(0.08,color='#c44',ls='--',lw=.8)
plt.tight_layout(); plt.savefig('fig/w_hist.png'); plt.close()
# hidden activation sparsity
X=Xte
h1=np.maximum(X@m['W0'].T+m['b0'],0); h2=np.maximum(h1@m['W1'].T+m['b1'],0)
print('active ratio h1',(h1>0).mean(),'h2',(h2>0).mean(), 'dead h1',(h1.max(0)==0).sum(),'dead h2',(h2.max(0)==0).sum())
