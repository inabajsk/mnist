import numpy as np, json
d=np.load('datasets.npz')
Xtr,ytr=d['train_images'],d['train_labels'][:,0].astype(int)
Xte,yte=d['test_images'],d['test_labels'][:,0].astype(int)
def fwd(m,X):
    h=X
    for i in range(3):
        u=h@m[f'W{i}'].T+m[f'b{i}']
        if i<2: h=np.maximum(u,0)
        else:
            u=u-u.max(1,keepdims=True); e=np.exp(u); h=e/e.sum(1,keepdims=True)
    return h
res=[]
for e in range(20):
    m=np.load(f'mlp{e}.npz')
    r={'epoch':e}
    for nm,X,y in [('train',Xtr,ytr),('test',Xte,yte)]:
        P=fwd(m,X); pred=P.argmax(1)
        r[nm+'_acc']=float((pred==y).mean()); r[nm+'_err']=int((pred!=y).sum())
        r[nm+'_loss']=float(-np.log(np.clip(P[np.arange(len(y)),y],1e-300,None)).mean())
        if e==19: np.save(f'P19_{nm}.npy',P)
    r['W_norm']=[float(np.linalg.norm(m[f'W{i}'])) for i in range(3)]
    print(r,flush=True); res.append(r)
# init-like: epoch0 weights distribution
json.dump(res,open('eval.json','w'),indent=1)
