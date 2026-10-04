#!/usr/bin/env python3
"""
make_data.py : スマートフォン用の計測ページ (phone/site) のデータと ONNX モデルを作る

  入力 (EusLisp の出力)
    mlp/mnist-datasets.l       学習・テストデータ
    mlp/mnist-mlp-19.l         nn.l で学習した MLP (784-1000-1000-10)
    mlp-cuda/mnist-cnn-9.l     nn-cnn.l で学習した CNN の重み
                               ( roseus nn-cnn.l して (test-mnist-cnn *cnn-net* :save t) )
  出力
    phone/site/mnist_test.gz.txt      テスト 10,000 枚 (uint8, gzip + Base64)
    phone/site/mnist_train6k.gz.txt   学習データの先頭 6,000 枚
    phone/site/mlp_w.gz.txt, cnn_w.gz.txt   重み (float32, gzip + Base64)
    phone/onnx/mnist_mlp.onnx, mnist_cnn.onnx  アプリ用 (ONNX Runtime Mobile など)

  $ python3 phone/make_data.py        (リポジトリの一番上で実行)
"""
import base64, gzip, os, re, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = os.path.join(ROOT, "phone", "site")
ONNX = os.path.join(ROOT, "phone", "onnx")


def float_vectors(text):
    """#f(...) を順に numpy 配列で返す"""
    return [np.array(m.group(1).split(), dtype=np.float64) for m in re.finditer(r"#f\(([^)]*)\)", text)]


def parse_datasets(fn):
    s = open(fn).read()
    out = {}
    pos = {m.group(1): m.end() for m in re.finditer(r"\(setq \*([a-z-]+)\* '\(", s)}
    keys = sorted(pos, key=pos.get)
    for i, k in enumerate(keys):
        seg = s[pos[k]:(pos[keys[i + 1]] if i + 1 < len(keys) else len(s))]
        out[k] = np.array(float_vectors(seg))
    return out


def parse_matrices(text):
    """#2f((..)(..)) と #f(..) を出てくる順に返す (nil は飛ばす)"""
    res = []
    for m in re.finditer(r"#2f\(\((.*?)\)\)|#f\(([^)]*)\)", text, re.S):
        if m.group(1) is not None:
            res.append(np.array([np.array(r.split(), dtype=np.float64) for r in re.split(r"\)\s*\(", m.group(1))]))
        else:
            res.append(np.array(m.group(2).split(), dtype=np.float64))
    return res


def mlp_params(fn):
    """mnist-mlp-19.l の perceptron ごとに w と b を取り出す"""
    s = open(fn).read()
    params = []
    for m in re.finditer(r"#s\(perceptron plist nil w (#2f\(\(.*?\)\)) wt #2f\(\(.*?\)\) b (#f\([^)]*\))", s, re.S):
        W = parse_matrices(m.group(1))[0]
        b = parse_matrices(m.group(2))[0]
        params += [W, b]
    return params


def write_gz_b64(path, raw):
    open(path, "w").write(base64.b64encode(gzip.compress(raw, 9)).decode())
    print("wrote", os.path.relpath(path, ROOT), len(raw), "bytes (raw)")


def main():
    os.makedirs(SITE, exist_ok=True)
    os.makedirs(ONNX, exist_ok=True)
    d = parse_datasets(os.path.join(ROOT, "mlp", "mnist-datasets.l"))
    u8 = lambda X: np.round(X * 255).astype(np.uint8)
    te, tl = u8(d["test-images"]), d["test-labels"][:, 0].astype(np.uint8)
    tr, trl = u8(d["train-images"][:6000]), d["train-labels"][:6000, 0].astype(np.uint8)
    write_gz_b64(os.path.join(SITE, "mnist_test.gz.txt"), te.tobytes() + tl.tobytes())
    write_gz_b64(os.path.join(SITE, "mnist_train6k.gz.txt"), tr.tobytes() + trl.tobytes())

    mlp = mlp_params(os.path.join(ROOT, "mlp", "mnist-mlp-19.l"))
    cnn = parse_matrices(open(os.path.join(ROOT, "mlp-cuda", "mnist-cnn-9.l")).read())
    assert [p.shape for p in mlp] == [(1000, 784), (1000,), (1000, 1000), (1000,), (10, 1000), (10,)]
    assert [p.shape for p in cnn] == [(20, 25), (20,), (50, 500), (50,), (500, 800), (500,), (10, 500), (10,)]
    for name, ps in [("mlp", mlp), ("cnn", cnn)]:
        write_gz_b64(os.path.join(SITE, f"{name}_w.gz.txt"), np.concatenate([p.astype(np.float32).ravel() for p in ps]).tobytes())

    try:
        import torch
        import torch.nn.functional as F
    except ImportError:
        print("torch がないので ONNX は作りません")
        return

    t = lambda a: torch.tensor(a, dtype=torch.float32)

    class MLP(torch.nn.Module):
        def forward(self, x):
            h = x.reshape(x.shape[0], 784)
            h = torch.relu(h @ t(mlp[0]).T + t(mlp[1]))
            h = torch.relu(h @ t(mlp[2]).T + t(mlp[3]))
            return torch.softmax(h @ t(mlp[4]).T + t(mlp[5]), 1)

    class CNN(torch.nn.Module):
        def forward(self, x):
            h = F.max_pool2d(torch.relu(F.conv2d(x, t(cnn[0]).reshape(20, 1, 5, 5), t(cnn[1]))), 2)
            h = F.max_pool2d(torch.relu(F.conv2d(h, t(cnn[2]).reshape(50, 20, 5, 5), t(cnn[3]))), 2)
            h = h.permute(0, 2, 3, 1).reshape(x.shape[0], 800)  # EusLisp 版と同じ NHWC の順で平らにする
            h = torch.relu(h @ t(cnn[4]).T + t(cnn[5]))
            return torch.softmax(h @ t(cnn[6]).T + t(cnn[7]), 1)

    X = torch.tensor(te.reshape(-1, 1, 28, 28) / 255.0, dtype=torch.float32)
    y = torch.tensor(tl.astype(np.int64))
    for name, M in [("mlp", MLP()), ("cnn", CNN())]:
        with torch.no_grad():
            acc = (M(X).argmax(1) == y).float().mean().item()
        out = os.path.join(ONNX, f"mnist_{name}.onnx")
        torch.onnx.export(M, X[:1], out, input_names=["image"], output_names=["prob"],
                          dynamic_axes={"image": {0: "n"}, "prob": {0: "n"}}, opset_version=17, dynamo=False)
        print("wrote", os.path.relpath(out, ROOT), f"test accuracy {acc * 100:.2f}%")


if __name__ == "__main__":
    sys.exit(main())
