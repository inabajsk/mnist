import os, numpy as np, torch, torch.nn.functional as F, coremltools as ct, re, sys
sys.path.insert(0,os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),'phone'))
import make_data as md
W=os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
mlp=md.mlp_params(W+'/mlp/mnist-mlp-19.l')
cnn=md.parse_matrices(open(W+'/mlp-cuda/mnist-cnn-9.l').read())
t=lambda a: torch.tensor(a,dtype=torch.float32)
class MLP(torch.nn.Module):
    def __init__(s):
        super().__init__(); s.l=torch.nn.ModuleList([torch.nn.Linear(784,1000),torch.nn.Linear(1000,1000),torch.nn.Linear(1000,10)])
        for l,(Wt,b) in zip(s.l,[(mlp[0],mlp[1]),(mlp[2],mlp[3]),(mlp[4],mlp[5])]): l.weight.data=t(Wt); l.bias.data=t(b)
    def forward(s,x):
        h=x.reshape(1,784); h=torch.relu(s.l[0](h)); h=torch.relu(s.l[1](h)); return torch.softmax(s.l[2](h),1)
class CNN(torch.nn.Module):
    def __init__(s):
        super().__init__(); s.c1=torch.nn.Conv2d(1,20,5); s.c2=torch.nn.Conv2d(20,50,5); s.f1=torch.nn.Linear(800,500); s.f2=torch.nn.Linear(500,10)
        s.c1.weight.data=t(cnn[0].reshape(20,1,5,5)); s.c1.bias.data=t(cnn[1]); s.c2.weight.data=t(cnn[2].reshape(50,20,5,5)); s.c2.bias.data=t(cnn[3])
        s.f1.weight.data=t(cnn[4]); s.f1.bias.data=t(cnn[5]); s.f2.weight.data=t(cnn[6]); s.f2.bias.data=t(cnn[7])
    def forward(s,x):
        h=F.max_pool2d(torch.relu(s.c1(x)),2); h=F.max_pool2d(torch.relu(s.c2(h)),2)
        h=h.permute(0,2,3,1).reshape(1,800)
        return torch.softmax(s.f2(torch.relu(s.f1(h))),1)
for name,M in [('MNISTMLP',MLP()),('MNISTCNN',CNN())]:
    M.eval(); ex=torch.zeros(1,1,28,28)
    tr=torch.jit.trace(M,ex)
    ml=ct.convert(tr,inputs=[ct.TensorType(name='image',shape=(1,1,28,28))],outputs=[ct.TensorType(name='prob')],convert_to='neuralnetwork',minimum_deployment_target=ct.target.iOS14)
    ml.short_description=f'MNIST {name[5:]} (EusLisp で学習した重み)'
    ml.save(f'{name}.mlmodel'); print('saved',name)
