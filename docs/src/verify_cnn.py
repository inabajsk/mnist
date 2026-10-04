import ctypes as C, numpy as np, torch, torch.nn.functional as F
lib=C.CDLL('/home/mi/mnist/CUDA/LinuxARM/libcudacnn.so')
dp=np.ctypeslib.ndpointer(np.float64,flags='C'); lp=np.ctypeslib.ndpointer(np.int64,flags='C')
lib.cnn_create.argtypes=[lp,C.c_long,C.c_long,C.c_long]; lib.cnn_set_param.argtypes=[C.c_long,dp,dp]; lib.cnn_get_param.argtypes=[C.c_long,dp,dp]
lib.cnn_upload.argtypes=[C.c_long,dp,dp,C.c_long]; lib.cnn_train_batch.argtypes=[C.c_long,C.c_long,C.c_double]; lib.cnn_train_batch.restype=C.c_double
d=np.load('datasets.npz'); X=d['train_images'][:2000].copy(); y=d['train_labels'][:2000,0].copy()
spec=np.array([28,28,1,9, 2,5,20, 4,0,0, 3,2,0, 2,5,50, 4,0,0, 3,2,0, 1,500,0, 4,0,0, 1,10,0],dtype=np.int64)
rng=np.random.default_rng(0)
shapes={0:(20,25),3:(50,500),6:(500,800),8:(10,500)}
P={l:((rng.random(s)*0.16-0.08), np.zeros(s[0])) for l,s in shapes.items()}
lr=0.001
# torch reference (NCHW, weights in (cout, c, k, k); FC after conv flattens NHWC)
T={l:(torch.tensor(W.copy(),dtype=torch.float64,device='cuda'),torch.tensor(b.copy(),dtype=torch.float64,device='cuda')) for l,(W,b) in P.items()}
def relu0(u): return u*(u>=0).to(u.dtype)
def tstep(x,lab):
    Ws=[t.requires_grad_() for l in sorted(T) for t in T[l]]
    h=F.conv2d(x,T[0][0].view(20,1,5,5),T[0][1]); h=F.max_pool2d(relu0(h),2)
    h=F.conv2d(h,T[3][0].view(50,20,5,5),T[3][1]); h=F.max_pool2d(relu0(h),2)
    h=h.permute(0,2,3,1).reshape(len(x),-1)
    h=relu0(h@T[6][0].T+T[6][1]); o=h@T[8][0].T+T[8][1]
    loss=F.cross_entropy(o,lab,reduction='sum'); loss.backward()
    with torch.no_grad():
        for l in T:
            for t in T[l]: t-=lr*t.grad; t.grad=None
    return loss.item()/len(x)
for gpu in [1,0]:
    assert lib.cnn_create(spec,200,64,gpu)==0
    for l,(W,b) in P.items(): lib.cnn_set_param(l,np.ascontiguousarray(W),np.ascontiguousarray(b))
    lib.cnn_upload(0,X,y.astype(np.float64),len(X))
    T={l:(torch.tensor(W.copy(),dtype=torch.float64,device='cuda'),torch.tensor(b.copy(),dtype=torch.float64,device='cuda')) for l,(W,b) in P.items()}
    for i in range(10):
        a=lib.cnn_train_batch(i*200,200,lr)
        xb=torch.tensor(X[i*200:(i+1)*200],device='cuda').view(-1,1,28,28); lb=torch.tensor(y[i*200:(i+1)*200],device='cuda').long()
        r=tstep(xb,lb)
        if i<3 or i==9: print('gpu' if gpu else 'cpu','batch',i,'engine',a,'torch',r)
    for l,(W,b) in P.items():
        W2=np.zeros_like(W); b2=np.zeros_like(b); lib.cnn_get_param(l,W2,b2)
        print('  layer',l,'|dW|',np.linalg.norm(W2-T[l][0].detach().cpu().numpy()),'|db|',np.linalg.norm(b2-T[l][1].detach().cpu().numpy()),'|W|',np.linalg.norm(W2))
