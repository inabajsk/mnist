import re, json
def plog(s): return [[int(a),float(b),float(c),int(d)] for a,b,c,d in re.findall(r'\((\d+) ([\d.e-]+) ([\d.e-]+) (\d+)\)',s)]
key={'((:fc 1000) (:relu) (:fc 1000) (:relu) (:fc 10))':'mlp',
 '((:conv 5 6) (:relu) (:pool) (:conv 5 16) (:relu) (:pool) (:fc 120) (:relu) (:fc 84) (:relu) (:fc 10))':'lenet5',
 '((:conv 5 20) (:relu) (:pool) (:conv 5 50) (:relu) (:pool) (:fc 500) (:relu) (:fc 10))':'cnn'}
b=open('cnnbench.log').read()
K={'gpu':'NVIDIA GB10 (sm_121, 48 SMs)','nets':{},'train':{},'trainacc':{},'epoch':{},'sweep':{},'infer':{}}
for net,k in key.items():
    e=re.escape(net)
    m=re.search(r'RESULT net '+e+r' params (\d+) flops (\d+)',b); K['nets'][k]=dict(params=int(m.group(1)),flops=int(m.group(2)))
    K['train'][k]=plog(re.search(r'RESULT train '+e+r' (.*)',b).group(1))
    K['trainacc'][k]=int(re.search(r'RESULT trainacc '+e+r' \((\d+)',b).group(1))
    K['epoch'][k]={dv:float(re.search(r'RESULT epoch '+e+' '+dv+r' +([\d.]+)',b).group(1)) for dv in ['gpu32','gpu64','cpu32','cpu64']}
    K['infer'][k]={dv:[float(x) for x in re.search(r'RESULT infer '+e+' :'+dv+r' \(([\d.]+) (\d+)\)',b).groups()] for dv in ['gpu','cpu']}
for bs in ['50','100','200','500','1000']:
    K['sweep'][bs]={k:float(re.search(r'RESULT sweep '+bs+' '+re.escape(n)+r' +([\d.]+)',b).group(1)) for n,k in key.items() if k!='lenet5'}
K['layerprof']={}
for dv in ['gpu','cpu']:
    rows=[[n,float(f),float(bb)] for n,f,bb in re.findall(r'\(\((:\w+[^)]*)\) ([\d.e-]+) ([\d.e-]+)\)',re.search(r'RESULT layerprof :'+dv+r' (.*)',b).group(1))]
    c={}; out=[]
    for n,f,bb in rows:
        p=n.split()
        if p[0]==':conv': nm=f'conv {p[1]}×{p[1]} {p[2]}ch'
        elif p[0]==':fc': nm=f'全結合 {p[1]}'
        else:
            c[p[0]]=c.get(p[0],0)+1; nm=f'{p[0][1:]} {c[p[0]]}'
        out.append([nm,f,bb])
    K['layerprof'][dv]=out
K['torch']=dict(mlp32=0.4328,mlp64=1.5092,cnn32=0.6106,cnn64=2.6128)
K['base']=26.095
K['analysis']=json.load(open('cnn_analysis.json'))
K['permute']=json.load(open('permute.json'))
a=open('ablate.log').read()
def desc(net):
    out=[]
    for n,p in re.findall(r'\(:(\w+)([^)]*)\)',net):
        p=p.split()
        if n=='conv': out.append(f'conv{p[0]}×{p[0]}·{p[1]}')
        elif n=='pool': out.append('pool')
        elif n=='fc': out.append(f'fc{p[0]}')
    return ' '.join(out)
K['ablate']=[]
for m in re.finditer(r'ABL "([^"]+)" (\(\(.*?\)\)) (\d+) (\d+) (\(\(.*?\)\)) \((\d+)',a):
    K['ablate'].append(dict(label=m.group(1),desc=desc(m.group(2)),params=int(m.group(3)),flops=int(m.group(4)),log=plog(m.group(5)),train=int(m.group(6)),base=m.group(1)=='ch 20/50'))
l=open('lr.log').read()
K['lr']={m.group(1):plog(m.group(2)) for m in re.finditer(r'LR2 ([\d.]+) (.*)',l)}
K['bs']={'50':plog(re.search(r'^BS 50 (.*)',a,re.M).group(1)),'500':plog(re.search(r'^BS 500 (.*)',a,re.M).group(1)),
         '1000':plog(re.search(r'BS2 1000 (.*)',l).group(1)),'500lr':plog(re.search(r'BS2 500lr0.0004 (.*)',l).group(1))}
json.dump(K,open('cnn.json','w'),ensure_ascii=False,indent=1)
print(len(K['ablate']),[ (x['label'],x['log'][-1][3]) for x in K['ablate']])
print({k:v[-1][3] for k,v in K['lr'].items()},{k:v[-1][3] for k,v in K['bs'].items()})
print(K['layerprof']['gpu'])
