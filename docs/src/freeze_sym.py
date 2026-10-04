import ctypes as C, numpy as np, json
lib=C.CDLL('/home/mi/mnist/CUDA/LinuxARM/libcudacnn.so')
dp=np.ctypeslib.ndpointer(np.float64,flags='C'); lp=np.ctypeslib.ndpointer(np.int64,flags='C')
lib.cnn_create.argtypes=[lp,C.c_long,C.c_long,C.c_long]; lib.cnn_set_param.argtypes=[C.c_long,dp,dp]; lib.cnn_get_param.argtypes=[C.c_long,dp,dp]
lib.cnn_upload.argtypes=[C.c_long,dp,dp,C.c_long]; lib.cnn_train_batch.argtypes=[C.c_long,C.c_long,C.c_double]; lib.cnn_train_batch.restype=C.c_double
lib.cnn_eval.argtypes=[C.c_long,C.c_long,dp]
d=np.load('datasets.npz'); Xtr=d['train_images']; ytr=d['train_labels'][:,0].astype(float); Xte=d['test_images']; yte=d['test_labels'][:,0].astype(float)
spec=np.array([28,28,1,9, 2,5,20, 4,0,0, 3,2,0, 2,5,50, 4,0,0, 3,2,0, 1,500,0, 4,0,0, 1,10,0],dtype=np.int64)
shapes={0:(20,25),3:(50,500),6:(500,800),8:(10,500)}
def init(seed=0, same_conv1=False):
    rng=np.random.default_rng(seed); P={l:(rng.random(s)*0.16-0.08, np.zeros(s[0])) for l,s in shapes.items()}
    if same_conv1: P[0]=(np.tile(P[0][0][0],(20,1)), np.zeros(20))
    return P
def run(P, freeze=(), epochs=20, snap=()):
    lib.cnn_create(spec,1000,32,1)
    for l,(W,b) in P.items(): lib.cnn_set_param(l,np.ascontiguousarray(W),np.ascontiguousarray(b))
    lib.cnn_upload(0,Xtr,ytr,60000); lib.cnn_upload(1,Xte,yte,10000)
    accs=[]; snaps={}
    for e in range(epochs):
        for i in range(300):
            lib.cnn_train_batch(i*200,200,0.001)
            for l in freeze: lib.cnn_set_param(l,np.ascontiguousarray(P[l][0]),np.ascontiguousarray(P[l][1]))
        accs.append(lib.cnn_eval(1,1000,np.zeros(1))/100)
        if e+1 in snap:
            W=np.zeros(shapes[0]); b=np.zeros(20); lib.cnn_get_param(0,W,b); snaps[e+1]=W.copy()
    return accs, snaps
R={}
P=init(0)
R['normal'],_=run(P); print('normal',R['normal'][-1],flush=True)
R['freeze_conv1'],_=run(P,freeze=(0,)); print('freeze conv1',R['freeze_conv1'][-1],flush=True)
R['freeze_conv12'],_=run(P,freeze=(0,3)); print('freeze conv1+2',R['freeze_conv12'][-1],flush=True)
Ps=init(0,same_conv1=True)
R['same_init'],sn=run(Ps,snap=(1,20)); print('same init',R['same_init'][-1],flush=True)
W=sn[20]; Wn=W/np.linalg.norm(W,axis=1,keepdims=True); Cm=Wn@Wn.T
R['same_init_cos_min']=float(Cm.min()); R['same_init_maxdiff']=float(np.abs(W-W[0]).max())
print('same init: min cos among 20 kernels',Cm.min(),'max |W_i - W_0|',np.abs(W-W[0]).max())
np.save('same_init_W20.npy',W)
json.dump(R,open('freeze_sym.json','w'))
