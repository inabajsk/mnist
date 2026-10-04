import numpy as np, gzip
def idx(fn):
    b=gzip.open(fn).read()
    nd=b[3]; dims=[int.from_bytes(b[4+4*i:8+4*i],'big') for i in range(nd)]
    return np.frombuffer(b,dtype=np.uint8,offset=4+4*nd).reshape(dims)
d=np.load('datasets.npz')
for split,pre in [('train','train'),('test','t10k')]:
    X=idx(f'{pre}-images-idx3-ubyte.gz').reshape(-1,784).astype(np.float64); y=idx(f'{pre}-labels-idx1-ubyte.gz')
    Xe=d[f'{split}_images']; ye=d[f'{split}_labels'][:,0].astype(int)
    print(split, 'eus range', Xe.min(), Xe.max(), 'first labels', ye[:10], 'orig', y[:10], 'orig last', y[-10:][::-1])
    print(' max*255 diff vs orig  same order:', np.abs(Xe*255-X).max(), ' reversed:', np.abs(Xe*255-X[::-1]).max(), np.array_equal(ye,y[::-1]))
    # quantization
    print(' unique levels', len(np.unique(Xe)), 'decimals sample', np.unique(Xe)[:6])
    print(' label counts', np.bincount(ye))
    np.save(f'orig_{split}_X.npy',X.astype(np.uint8)); np.save(f'orig_{split}_y.npy',y)
