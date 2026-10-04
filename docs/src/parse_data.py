import numpy as np, re, sys, time
def parse_lists(fn):
    s=open(fn).read()
    out={}
    for m in re.finditer(r"\(setq \*([a-z-]+)\* '\(", s):
        out[m.group(1)]=m.end()
    keys=sorted(out,key=out.get)
    res={}
    for i,k in enumerate(keys):
        end = out[keys[i+1]] if i+1<len(keys) else len(s)
        seg=s[out[k]:end]
        vecs=seg.split('#f(')[1:]
        arr=np.array([np.array(v[:v.index(')')].split(),dtype=np.float64) for v in vecs])
        res[k]=arr; print(fn,k,arr.shape,flush=True)
    return res
t=time.time()
d=parse_lists('/home/mi/mnist/mlp/mnist-datasets.l')
np.savez('datasets.npz', **{k.replace('-','_'):v for k,v in d.items()})
for f in ['mnist-test-images.l','mnist-test-labels.l','mnist-train-images.l','mnist-train-labels.l']:
    r=parse_lists('/home/mi/mnist/mlp/'+f)
    for k,v in r.items():
        print(f,k,'equal to datasets:', v.shape==d[k].shape and np.array_equal(v,d[k]))
print(time.time()-t)
