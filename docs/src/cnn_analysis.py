import re, json, ctypes as C, numpy as np
from scipy import ndimage
from PIL import Image, ImageDraw, ImageFont
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
plt.rcParams['font.family']='Noto Sans CJK JP'
lib=C.CDLL('/home/mi/mnist/CUDA/LinuxARM/libcudacnn.so')
dp=np.ctypeslib.ndpointer(np.float64,flags='C'); lp=np.ctypeslib.ndpointer(np.int64,flags='C')
lib.cnn_create.argtypes=[lp,C.c_long,C.c_long,C.c_long]; lib.cnn_set_param.argtypes=[C.c_long,dp,dp]
lib.cnn_upload.argtypes=[C.c_long,dp,dp,C.c_long]; lib.cnn_predict.argtypes=[C.c_long,C.c_long,C.c_long,dp]
NETS={'mlp':[(1,1000),(4,),(1,1000),(4,),(1,10)],
      'lenet5':[(2,5,6),(4,),(3,),(2,5,16),(4,),(3,),(1,120),(4,),(1,84),(4,),(1,10)],
      'cnn':[(2,5,20),(4,),(3,),(2,5,50),(4,),(3,),(1,500),(4,),(1,10)]}
def spec(net):
    s=[28,28,1,len(net)]
    for l in net: s+= [l[0], l[1] if len(l)>1 else (2 if l[0]==3 else 0), l[2] if len(l)>2 else 0]
    return np.array(s,dtype=np.int64)
def parse(fn):
    s=open(fn).read(); out=[]; pos=0
    toks=re.finditer(r"#2f\(\((.*?)\)\)|#f\(([^)]*)\)|nil",s)
    cur=None
    for m in toks:
        if m.group(0)=='nil': out.append(None); continue
        if m.group(1) is not None:
            cur=np.array([np.array(r.split(),float) for r in re.split(r'\)\s*\(',m.group(1))])
        else:
            out.append((cur,np.array(m.group(2).split(),float))); cur=None
    return out
d=np.load('datasets.npz'); Xte=d['test_images']; yte=d['test_labels'][:,0].astype(int)
P={k:parse(f'params-{k}.l') for k in NETS}
for k in P: print(k,[None if p is None else p[0].shape for p in P[k]])
def predict(k, X):
    net=NETS[k]; lib.cnn_create(spec(net),1000,32,1)
    for i,p in enumerate(P[k]):
        if p is not None: lib.cnn_set_param(i,np.ascontiguousarray(p[0]),np.ascontiguousarray(p[1]))
    X=np.ascontiguousarray(X,dtype=np.float64)
    lib.cnn_upload(1,X,np.zeros(len(X)),len(X))
    out=np.zeros((len(X),10))
    for s in range(0,len(X),1000):
        b=min(1000,len(X)-s); buf=np.zeros(b*10); lib.cnn_predict(1,s,b,buf); out[s:s+b]=buf.reshape(b,10)
    return out
R={}
pred={k:predict(k,Xte).argmax(1) for k in NETS}
for k in NETS: R[k+'_acc']=float((pred[k]==yte).mean()); print(k,R[k+'_acc'])
wm=set(np.where(pred['mlp']!=yte)[0]); wc=set(np.where(pred['cnn']!=yte)[0])
R['overlap']=dict(mlp_only=len(wm-wc),cnn_only=len(wc-wm),both=len(wm&wc)); print(R['overlap'])
# confusion cnn
Cm=np.zeros((10,10),int)
for a,b in zip(yte,pred['cnn']): Cm[a,b]+=1
R['cnn_perclass']=[round(Cm[c,c]/Cm[c].sum()*100,2) for c in range(10)]
Cmlp=np.zeros((10,10),int)
for a,b in zip(yte,pred['mlp']): Cmlp[a,b]+=1
R['mlp_perclass']=[round(Cmlp[c,c]/Cmlp[c].sum()*100,2) for c in range(10)]
# shift robustness
imgs=Xte.reshape(-1,28,28)
R['shift']={}
for k in NETS: R['shift'][k]=[]
shifts=[-4,-3,-2,-1,0,1,2,3,4]
for s in shifts:
    Xs=np.roll(imgs,s,axis=2); 
    if s>0: Xs[:,:,:s]=0
    if s<0: Xs[:,:,s:]=0
    Xs=Xs.reshape(-1,784)
    for k in NETS: R['shift'][k].append(float((predict(k,Xs).argmax(1)==yte).mean()))
R['shifts']=shifts
R['rot']={k:[] for k in NETS}; R['rots']=[-30,-20,-10,0,10,20,30]
for a in R['rots']:
    Xr=np.stack([ndimage.rotate(im,a,reshape=False,order=1) for im in imgs]).clip(0,1).reshape(-1,784)
    for k in NETS: R['rot'][k].append(float((predict(k,Xr).argmax(1)==yte).mean()))
print(R['shift'],R['rot'])
json.dump(R,open('cnn_analysis.json','w'),indent=1)
# figures: shifted examples
ex=imgs[0]
fig,axs=plt.subplots(1,5,figsize=(7,1.6),dpi=150)
for a,s in zip(axs,[-4,-2,0,2,4]):
    im=np.roll(ex,s,axis=1); 
    if s>0: im[:,:s]=0
    if s<0: im[:,s:]=0
    a.imshow(im,cmap='gray'); a.set_title(f'{s:+d} 画素',fontsize=10); a.axis('off')
plt.tight_layout(); plt.savefig('figc/shift_examples.png'); plt.close()
# conv1 filters
W1=P['cnn'][0][0].reshape(20,5,5)
fig,axs=plt.subplots(2,10,figsize=(8,1.8),dpi=160)
for a,w in zip(axs.flat,W1):
    v=np.abs(w).max(); a.imshow(w,cmap='RdBu_r',vmin=-v,vmax=v); a.axis('off')
plt.subplots_adjust(0.01,0.01,0.99,0.99,0.08,0.08); plt.savefig('figc/conv1_filters.png'); plt.close()
# feature maps of a digit (numpy forward, NHWC)
def conv(x,W,b,k):
    H,Wd,Cc=x.shape; co=W.shape[0]; oh=H-k+1; ow=Wd-k+1
    col=np.zeros((oh*ow,Cc*k*k))
    for oy in range(oh):
        for ox in range(ow):
            col[oy*ow+ox]=x[oy:oy+k,ox:ox+k,:].transpose(2,0,1).ravel()
    return (col@W.T+b).reshape(oh,ow,co)
def pool(x): H,Wd,Cc=x.shape; return x[:H//2*2,:Wd//2*2].reshape(H//2,2,Wd//2,2,Cc).max((1,3))
x=imgs[0][:,:,None]
c1=np.maximum(conv(x,P['cnn'][0][0],P['cnn'][0][1],5),0); p1=pool(c1)
c2=np.maximum(conv(p1,P['cnn'][3][0],P['cnn'][3][1],5),0); p2=pool(c2)
fig,axs=plt.subplots(2,10,figsize=(8,1.8),dpi=160)
for i,a in enumerate(axs.flat): a.imshow(c1[:,:,i],cmap='magma'); a.axis('off')
plt.subplots_adjust(0.01,0.01,0.99,0.99,0.08,0.08); plt.savefig('figc/fmap1.png'); plt.close()
fig,axs=plt.subplots(2,10,figsize=(8,1.8),dpi=160)
for i,a in enumerate(axs.flat): a.imshow(c2[:,:,i],cmap='magma'); a.axis('off')
plt.subplots_adjust(0.01,0.01,0.99,0.99,0.08,0.08); plt.savefig('figc/fmap2.png'); plt.close()
Image.fromarray((imgs[0]*255).astype(np.uint8)).resize((224,224),Image.NEAREST).save('figc/input0.png')
# cnn wrong grid
wrong=np.where(pred['cnn']!=yte)[0]; cols=21; cell=60
rows=int(np.ceil(len(wrong)/cols))
G=Image.new('RGB',(cols*cell,rows*(cell+16)),(255,255,255)); dr=ImageDraw.Draw(G)
f=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',13)
for j,i in enumerate(wrong):
    r,c=divmod(j,cols)
    im=Image.fromarray(np.round(255-imgs[i]*255).astype(np.uint8)).resize((52,52),Image.NEAREST)
    G.paste(im,(c*cell+4,r*(cell+16)+2)); dr.text((c*cell+6,r*(cell+16)+54),f'{yte[i]}→{pred["cnn"][i]}',fill=(200,30,30),font=f)
G.save('figc/wrong_cnn.png'); print('wrong cnn',len(wrong),G.size)
# examples MLP wrong but CNN right
mo=sorted(wm-wc)[:24]
G=Image.new('RGB',(12*cell,2*(cell+16)),(255,255,255)); dr=ImageDraw.Draw(G)
for j,i in enumerate(mo):
    r,c=divmod(j,12)
    im=Image.fromarray(np.round(255-imgs[i]*255).astype(np.uint8)).resize((52,52),Image.NEAREST)
    G.paste(im,(c*cell+4,r*(cell+16)+2)); dr.text((c*cell+4,r*(cell+16)+54),f'MLP {pred["mlp"][i]} CNN {pred["cnn"][i]}',fill=(30,90,160),font=ImageFont.truetype('/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc',10))
G.save('figc/mlp_wrong_cnn_right.png'); print(G.size)
