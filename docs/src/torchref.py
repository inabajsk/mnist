import numpy as np, torch, time, torch.nn.functional as F
torch.backends.cudnn.benchmark=True
d=np.load('./datasets.npz'); dev='cuda'
X=torch.tensor(d['train_images'],dtype=torch.float32,device=dev).view(-1,1,28,28); Y=torch.tensor(d['train_labels'][:,0],device=dev).long()
def net(kind):
    if kind=='cnn': m=torch.nn.Sequential(torch.nn.Conv2d(1,20,5),torch.nn.ReLU(),torch.nn.MaxPool2d(2),torch.nn.Conv2d(20,50,5),torch.nn.ReLU(),torch.nn.MaxPool2d(2),torch.nn.Flatten(),torch.nn.Linear(800,500),torch.nn.ReLU(),torch.nn.Linear(500,10))
    else: m=torch.nn.Sequential(torch.nn.Flatten(),torch.nn.Linear(784,1000),torch.nn.ReLU(),torch.nn.Linear(1000,1000),torch.nn.ReLU(),torch.nn.Linear(1000,10))
    return m.to(dev)
for kind in ['mlp','cnn']:
    for dt in [torch.float32, torch.float64]:
        m=net(kind).to(dt); opt=torch.optim.SGD(m.parameters(),lr=0.001); Xd=X.to(dt)
        ts=[]
        for ep in range(3):
            torch.cuda.synchronize(); t=time.time()
            for i in range(300):
                loss=F.cross_entropy(m(Xd[i*200:(i+1)*200]),Y[i*200:(i+1)*200],reduction='sum'); opt.zero_grad(); loss.backward(); opt.step()
            torch.cuda.synchronize(); ts.append(time.time()-t)
        print('TORCH',kind,dt,min(ts))
