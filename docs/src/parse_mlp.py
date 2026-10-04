import numpy as np, re, sys
def parse_obj(s, pos):
    # parse #2f((..)(..)) or #f(..) at pos; return array, newpos
    if s.startswith('#2f(',pos):
        end=s.index('))',pos)
        rows=re.split(r'\)\s*\(', s[pos+5:end])
        return np.array([np.array(r.split(),dtype=np.float64) for r in rows]), end+2
    if s.startswith('#f(',pos):
        end=s.index(')',pos)
        return np.array(s[pos+3:end].split(),dtype=np.float64), end+1
    if s.startswith('nil',pos): return None,pos+3
    raise ValueError(s[pos:pos+30])
def parse(fn):
    s=open(fn).read()
    layers=[]
    for m in re.finditer(r'#s\(perceptron plist nil ', s):
        pos=m.end(); L={}
        for slot in ['w','wt','b','delta','activation','p','mask','pre-dw','pre-db','u','z','in-dim','out-dim']:
            assert s.startswith(slot+' ',pos), (slot,s[pos:pos+40])
            pos+=len(slot)+1
            if slot=='activation':
                e=s.index(' ',pos); L[slot]=s[pos:e]; pos=e+1; continue
            if slot in('in-dim','out-dim'):
                e=re.match(r'\d+',s[pos:]).end(); L[slot]=int(s[pos:pos+e]); pos+=e+1; continue
            v,pos=parse_obj(s,pos); L[slot]=v; pos+=1
        layers.append(L)
    return layers
if __name__=='__main__':
    for e in range(20):
        Ls=parse(f'/home/mi/mnist/mlp/mnist-mlp-{e}.l')
        np.savez(f'mlp{e}.npz', **{f'{k}{i}':v for i,L in enumerate(Ls) for k,v in [('W',L['w']),('b',L['b']),('u',L['u']),('z',L['z']),('delta',L['delta'])]})
        print(e,[(L['w'].shape,L['b'].shape,L['activation'],None if L['u'] is None else L['u'].shape) for L in Ls],flush=True)
