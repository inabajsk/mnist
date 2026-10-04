import numpy as np, torch, time, sys
d=np.load('datasets.npz'); dev='cuda'
Xtr=torch.tensor(d['train_images'],dtype=torch.float32,device=dev).view(-1,1,28,28); ytr=torch.tensor(d['train_labels'][:,0],device=dev).long()
Xte=torch.tensor(d['test_images'],dtype=torch.float32,device=dev).view(-1,1,28,28); yte=torch.tensor(d['test_labels'][:,0],device=dev).long()
def run(init, lr, ep=5, seed=0):
    g=torch.Generator(device='cpu').manual_seed(seed)
    shapes=[(20,1,5,5),(50,20,5,5),(500,800),(10,500)]
    P=[]
    for s in shapes:
        fan=int(np.prod(s[1:])); a=init(fan)
        P.append(((torch.rand(s,generator=g)*2-1)*a).to(dev).requires_grad_()); P.append(torch.zeros(s[0],device=dev,requires_grad=True))
    for e in range(ep):
        for i in range(300):
            x=Xtr[i*200:(i+1)*200]; y=ytr[i*200:(i+1)*200]
            h=torch.nn.functional.max_pool2d(torch.relu(torch.nn.functional.conv2d(x,P[0],P[1])),2)
            h=torch.nn.functional.max_pool2d(torch.relu(torch.nn.functional.conv2d(h,P[2],P[3])),2)
            h=torch.relu(h.flatten(1)@P[4].T+P[5]); o=h@P[6].T+P[7]
            loss=torch.nn.functional.cross_entropy(o,y,reduction='sum')
            for p in P: p.grad=None
            loss.backward()
            with torch.no_grad():
                for p in P: p-=lr*p.grad
        with torch.no_grad():
            h=torch.nn.functional.max_pool2d(torch.relu(torch.nn.functional.conv2d(Xte,P[0],P[1])),2)
            h=torch.nn.functional.max_pool2d(torch.relu(torch.nn.functional.conv2d(h,P[2],P[3])),2)
            o=torch.relu(h.flatten(1)@P[4].T+P[5])@P[6].T+P[7]
            acc=(o.argmax(1)==yte).float().mean().item()
        print(f'  ep{e+1} loss/batch {loss.item()/200:.4f} test {acc*100:.2f}', flush=True)
for name,init in [('U(+-0.08)',lambda f:0.08),('U(+-sqrt(1/fan))',lambda f:np.sqrt(1/f)),('He-uniform sqrt(6/fan)',lambda f:np.sqrt(6/f))]:
    for lr in [0.001,0.0005]:
        print(name,'lr',lr); run(init,lr,4)
