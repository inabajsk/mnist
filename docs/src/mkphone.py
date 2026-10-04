import numpy as np, re, json, torch, torch.nn.functional as F
W='.'
d=np.load(W+'/datasets.npz')
def u8(X): return np.round(X*255).astype(np.uint8)
te=u8(d['test_images']); tl=d['test_labels'][:,0].astype(np.uint8)
tr=u8(d['train_images'][:6000]); trl=d['train_labels'][:6000,0].astype(np.uint8)
assert np.abs(te/255.0-d['test_images']).max()<1e-5
open(W+'/phone/site/mnist_test.bin','wb').write(te.tobytes()+tl.tobytes())
open(W+'/phone/site/mnist_train6k.bin','wb').write(tr.tobytes()+trl.tobytes())
m=np.load(W+'/mlp19.npz')
mlp=[m['W0'],m['b0'],m['W1'],m['b1'],m['W2'],m['b2']]
def parse(fn):
    s=open(fn).read(); out=[]; cur=None
    for mm in re.finditer(r"#2f\(\((.*?)\)\)|#f\(([^)]*)\)|nil",s):
        if mm.group(0)=='nil': continue
        if mm.group(1) is not None: cur=np.array([np.array(r.split(),float) for r in re.split(r'\)\s*\(',mm.group(1))])
        else: out+= [cur,np.array(mm.group(2).split(),float)]
    return out
cnn=parse(W+'/params-cnn.l')
for name,ps in [('mlp',mlp),('cnn',cnn)]:
    buf=np.concatenate([p.astype(np.float32).ravel() for p in ps])
    open(W+f'/phone/site/{name}_w.bin','wb').write(buf.tobytes())
    print(name,[p.shape for p in ps],buf.nbytes)
# ONNX export (NCHW input 1x28x28, output softmax probs)
class MLP(torch.nn.Module):
    def __init__(s):
        super().__init__(); s.l=torch.nn.ModuleList([torch.nn.Linear(784,1000),torch.nn.Linear(1000,1000),torch.nn.Linear(1000,10)])
        for l,(Wt,b) in zip(s.l,[(mlp[0],mlp[1]),(mlp[2],mlp[3]),(mlp[4],mlp[5])]): l.weight.data=torch.tensor(Wt,dtype=torch.float32); l.bias.data=torch.tensor(b,dtype=torch.float32)
    def forward(s,x):
        h=x.reshape(x.shape[0],784); h=torch.relu(s.l[0](h)); h=torch.relu(s.l[1](h)); return torch.softmax(s.l[2](h),1)
class CNN(torch.nn.Module):
    def __init__(s):
        super().__init__(); s.c1=torch.nn.Conv2d(1,20,5); s.c2=torch.nn.Conv2d(20,50,5); s.f1=torch.nn.Linear(800,500); s.f2=torch.nn.Linear(500,10)
        s.c1.weight.data=torch.tensor(cnn[0].reshape(20,1,5,5),dtype=torch.float32); s.c1.bias.data=torch.tensor(cnn[1],dtype=torch.float32)
        s.c2.weight.data=torch.tensor(cnn[2].reshape(50,20,5,5),dtype=torch.float32); s.c2.bias.data=torch.tensor(cnn[3],dtype=torch.float32)
        s.f1.weight.data=torch.tensor(cnn[4],dtype=torch.float32); s.f1.bias.data=torch.tensor(cnn[5],dtype=torch.float32)
        s.f2.weight.data=torch.tensor(cnn[6],dtype=torch.float32); s.f2.bias.data=torch.tensor(cnn[7],dtype=torch.float32)
    def forward(s,x):
        h=F.max_pool2d(torch.relu(s.c1(x)),2); h=F.max_pool2d(torch.relu(s.c2(h)),2)
        h=h.permute(0,2,3,1).reshape(x.shape[0],800)   # NHWC の並びで平らにする (EusLisp 版と同じ)
        return torch.softmax(s.f2(torch.relu(s.f1(h))),1)
X=torch.tensor(te.reshape(-1,1,28,28)/255.0,dtype=torch.float32); y=torch.tensor(tl.astype(np.int64))
for name,M in [('mlp',MLP()),('cnn',CNN())]:
    M.eval()
    with torch.no_grad(): acc=(M(X).argmax(1)==y).sum().item()
    torch.onnx.export(M,X[:1],W+f'/phone/mnist_{name}.onnx',input_names=['image'],output_names=['prob'],dynamic_axes={'image':{0:'n'},'prob':{0:'n'}},opset_version=17,dynamo=False)
    print(name,'torch acc',acc)
