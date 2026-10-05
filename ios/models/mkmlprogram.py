# Core ML の新しい形式 (ML Program, FP16) のモデルを, 計測ページと同じ重み (phone/site/*_w.gz.txt) から作る
#   Neural Engine は FP16 の ML Program が得意. 1 回に B 枚まとめて渡せるモデル (B = 1, 100) を作る
#   pip install coremltools numpy  (torch はいらない. MIL Builder で層を直接書く)
#   python3 ios/models/mkmlprogram.py      -> ios/models/MNIST{MLP,CNN}_P{1,100}.mlpackage
import base64, gzip, os
import numpy as np
import coremltools as ct
from coremltools.converters.mil import Builder as mb

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'ios', 'models')


def weights(name, sizes):
    raw = gzip.decompress(base64.b64decode(open(os.path.join(ROOT, 'phone', 'site', f'{name}_w.gz.txt')).read()))
    f = np.frombuffer(raw, dtype=np.float32)
    out, o = [], 0
    for s in sizes:
        n = int(np.prod(s)); out.append(f[o:o + n].reshape(s).copy()); o += n
    return out


mlp = weights('mlp', [(1000, 784), (1000,), (1000, 1000), (1000,), (10, 1000), (10,)])
cnn = weights('cnn', [(20, 1, 5, 5), (20,), (50, 20, 5, 5), (50,), (500, 800), (500,), (10, 500), (10,)])


def build(kind, B):
    @mb.program(input_specs=[mb.TensorSpec(shape=(B, 1, 28, 28))], opset_version=ct.target.iOS17)
    def prog(image):
        if kind == 'mlp':
            h = mb.reshape(x=image, shape=[B, 784])
            h = mb.relu(x=mb.linear(x=h, weight=mlp[0], bias=mlp[1]))
            h = mb.relu(x=mb.linear(x=h, weight=mlp[2], bias=mlp[3]))
            h = mb.linear(x=h, weight=mlp[4], bias=mlp[5])
        else:
            h = mb.conv(x=image, weight=cnn[0], bias=cnn[1], pad_type='valid')
            h = mb.max_pool(x=mb.relu(x=h), kernel_sizes=[2, 2], strides=[2, 2], pad_type='valid')
            h = mb.conv(x=h, weight=cnn[2], bias=cnn[3], pad_type='valid')
            h = mb.max_pool(x=mb.relu(x=h), kernel_sizes=[2, 2], strides=[2, 2], pad_type='valid')
            h = mb.transpose(x=h, perm=[0, 2, 3, 1])          # EusLisp 版と同じ NHWC の順で平らにする
            h = mb.reshape(x=h, shape=[B, 800])
            h = mb.relu(x=mb.linear(x=h, weight=cnn[4], bias=cnn[5]))
            h = mb.linear(x=h, weight=cnn[6], bias=cnn[7])
        return mb.softmax(x=h, axis=-1, name='prob')

    m = ct.convert(prog, convert_to='mlprogram', minimum_deployment_target=ct.target.iOS17,
                   compute_precision=ct.precision.FLOAT16)
    m.short_description = f'MNIST {kind.upper()} (EusLisp で学習した重み, ML Program FP16, {B} 枚ずつ)'
    path = os.path.join(OUT, f'MNIST{kind.upper()}_P{B}.mlpackage')
    m.save(path)
    print('saved', os.path.relpath(path, ROOT))
    return m


if __name__ == '__main__':
    for kind in ['mlp', 'cnn']:
        for B in [1, 100]:
            build(kind, B)
