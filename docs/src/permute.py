# 画素の並びを固定の乱順に入れ替えたデータで学習: MLP は影響を受けず, CNN は大きく落ちるはず
import ctypes as C, numpy as np, json
lib=C.CDLL('/home/mi/mnist/CUDA/LinuxARM/libcudacnn.so')
dp=np.ctypeslib.ndpointer(np.float64,flags='C'); lp=np.ctypeslib.ndpointer(np.int64,flags='C')
lib.cnn_create.argtypes=[lp,C.c_long,C.c_long,C.c_long]; lib.cnn_set_param.argtypes=[C.c_long,dp,dp]
lib.cnn_upload.argtypes=[C.c_long,dp,dp,C.c_long]; lib.cnn_train_epoch.argtypes=[C.c_long,C.c_double]; lib.cnn_train_epoch.restype=C.c_double
lib.cnn_eval.argtypes=[C.c_long,C.c_long,dp]
d=np.load('datasets.npz'); Xtr=d['train_images']; ytr=d['train_labels'][:,0].astype(float); Xte=d['test_images']; yte=d['test_labels'][:,0].astype(float)
perm=np.random.default_rng(1).permutation(784)
NETS={'mlp':([28,28,1,5, 1,1000,0, 4,0,0, 1,1000,0, 4,0,0, 1,10,0],{0:(1000,784),2:(1000,1000),4:(10,1000)}),
      'cnn':([28,28,1,9, 2,5,20, 4,0,0, 3,2,0, 2,5,50, 4,0,0, 3,2,0, 1,500,0, 4,0,0, 1,10,0],{0:(20,25),3:(50,500),6:(500,800),8:(10,500)})}
R={}
for name,(spec,shapes) in NETS.items():
    for pm in [False,True]:
        rng=np.random.default_rng(0)
        lib.cnn_create(np.array(spec,dtype=np.int64),1000,32,1)
        for l,s in shapes.items(): lib.cnn_set_param(l,np.ascontiguousarray(rng.random(s)*0.16-0.08),np.zeros(s[0]))
        A=Xtr[:,perm] if pm else Xtr; B=Xte[:,perm] if pm else Xte
        lib.cnn_upload(0,np.ascontiguousarray(A),ytr,60000); lib.cnn_upload(1,np.ascontiguousarray(B),yte,10000)
        accs=[]
        for e in range(20):
            lib.cnn_train_epoch(200,0.001); accs.append(lib.cnn_eval(1,1000,np.zeros(1))/100)
        R[f'{name}_{"perm" if pm else "orig"}']=accs; print(name,pm,accs[-1],flush=True)
json.dump(R,open('permute.json','w'))
# 入れ替えた画像の例
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
plt.rcParams['font.family']='Noto Sans CJK JP'
fig,axs=plt.subplots(2,4,figsize=(6,3.2),dpi=150)
for j in range(4):
    axs[0,j].imshow(Xte[j].reshape(28,28),cmap='gray'); axs[1,j].imshow(Xte[j,perm].reshape(28,28),cmap='gray')
    axs[0,j].axis('off'); axs[1,j].axis('off')
axs[0,0].set_title('元の画像',fontsize=10,loc='left'); axs[1,0].set_title('画素を入れ替えた画像',fontsize=10,loc='left')
plt.tight_layout(); plt.savefig('figc/permuted.png')
