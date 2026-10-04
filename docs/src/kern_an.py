import numpy as np, json
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
import matplotlib.font_manager as fm, glob
for f in glob.glob('/home/mi/.local/share/fonts/bizud/*.ttf'): fm.fontManager.addfont(f)
plt.rcParams['font.family']='BIZ UDPGothic'
K={}; B={}
for line in open('kern.log'):
    t=line.split()
    if t[0]=='KERN': K[int(t[1])]=np.array(t[2:],float).reshape(20,25)
    if t[0]=='KBIAS': B[int(t[1])]=np.array(t[2:],float)
W0,W20=K[0],K[20]
R={}
R['norm']={e:float(np.linalg.norm(K[e])) for e in K}
R['change_from_init']={e:float(np.linalg.norm(K[e]-W0)/np.linalg.norm(W0)) for e in K}
R['per_kernel_corr_init_vs_20']=[float(np.corrcoef(W0[i],W20[i])[0,1]) for i in range(20)]
R['absmax']={e:float(np.abs(K[e]).max()) for e in K}
def cos(M):
    Mn=M/np.linalg.norm(M,axis=1,keepdims=True); return Mn@Mn.T
for e in [0,20]:
    Cm=cos(K[e]); off=Cm[~np.eye(20,dtype=bool)]
    R[f'cos{e}']=dict(max=float(off.max()),min=float(off.min()),mean_abs=float(np.abs(off).mean()),n_gt08=int((off>0.8).sum()//2),n_gt09=int((off>0.9).sum()//2),n_lt_m08=int((off<-0.8).sum()//2))
Cm=cos(W20); np.fill_diagonal(Cm,np.nan)
i,j=np.unravel_index(np.nanargmax(Cm),Cm.shape); R['most_similar']=[int(i),int(j),float(Cm[i,j])]
i2,j2=np.unravel_index(np.nanargmin(Cm),Cm.shape); R['most_opposite']=[int(i2),int(j2),float(Cm[i2,j2])]
print(json.dumps(R,indent=1))
json.dump(R,open('kern_an.json','w'))
# fig1: kernels at epochs
eps=[0,1,5,20]
fig,axs=plt.subplots(len(eps),20,figsize=(12,2.9),dpi=160)
v=np.abs(W20).max()
for r,e in enumerate(eps):
    for c in range(20):
        a=axs[r,c]; a.imshow(K[e][c].reshape(5,5),cmap='RdBu_r',vmin=-v,vmax=v); a.set_xticks([]); a.set_yticks([])
    axs[r,0].set_ylabel(f'{e} エポック' if e else '初期値',fontsize=9,rotation=0,ha='right',va='center')
for c in range(20): axs[0,c].set_title(str(c),fontsize=8)
plt.subplots_adjust(0.07,0.01,0.995,0.92,0.06,0.08); plt.savefig('figc/kernels_epochs.png'); plt.close()
# fig2: similarity matrix
fig,axs=plt.subplots(1,2,figsize=(8.4,3.8),dpi=160)
for a,e,t in [(axs[0],0,'初期値（乱数）'),(axs[1],20,'20 エポック後')]:
    M=cos(K[e]); im=a.imshow(M,cmap='RdBu_r',vmin=-1,vmax=1); a.set_title(t,fontsize=11)
    a.set_xticks(range(0,20,2)); a.set_yticks(range(0,20,2)); a.tick_params(labelsize=7)
fig.colorbar(im,ax=axs,shrink=0.8,label='コサイン類似度')
plt.savefig('figc/kernel_similarity.png',bbox_inches='tight'); plt.close()
# fig3: weight value histogram init vs trained
fig,a=plt.subplots(figsize=(4.5,2.8),dpi=160)
a.hist(W0.ravel(),bins=30,alpha=.7,label='初期値 U(−0.08, 0.08)',color='#5B6577'); a.hist(W20.ravel(),bins=30,alpha=.7,label='20 エポック後',color='#3A6EA5')
a.legend(fontsize=8); a.set_xlabel('重みの値',fontsize=9); a.set_yticks([]); plt.tight_layout(); plt.savefig('figc/kernel_hist.png'); plt.close()
