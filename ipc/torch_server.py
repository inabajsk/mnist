#!/usr/bin/env python3
"""
torch_server.py : EusLisp から piped-fork で起動し, 標準入出力のバイナリで CUDA 計算を引き受ける.
  (cuda-ipc.l から使う)

  要求: int64 x 8 のヘッダ [op, a1 .. a7] に続いて double の配列
  op 1  dgemm      : [1, m, n, k, beta!=0]  A(m*k) B(k*n) [C(m*n)] , alpha/beta は double 2個  -> C
  op 2  create     : [2, nl, prec(64|32), dims(nl+1)個を後に int64 で]                         -> 0
  op 3  set-layer  : [3, l]  W(out*in) b(out)                                                 -> 0
  op 4  get-layer  : [4, l]                                                                   -> W b
  op 5  upload     : [5, slot, n]  X(n*784) labels(n)                                         -> 0
  op 6  train-epoch: [6, B]  lr(double)                                                        -> loss
  op 7  eval       : [7, slot, B]                                                              -> correct loss
  op 0  quit
  計算は nn.l の :train-batch と同じ (勾配はバッチ和, 更新は SGD).
"""
import sys
import struct
import numpy as np
import torch

inp = sys.stdin.buffer
out = sys.stdout.buffer
dev = torch.device("cuda")


def read_exact(n):
    buf = bytearray(n)
    view = memoryview(buf)
    got = 0
    while got < n:
        r = inp.readinto(view[got:])
        if not r:
            raise EOFError
        got += r
    return buf


def read_doubles(n):
    return np.frombuffer(read_exact(8 * n), dtype=np.float64)


def write_doubles(a):
    out.write(np.ascontiguousarray(a, dtype=np.float64).tobytes())


class Mlp:
    def __init__(self, dims, prec):
        self.dt = torch.float64 if prec == 64 else torch.float32
        self.dims = dims
        self.W = [torch.zeros(dims[l + 1], dims[l], dtype=self.dt, device=dev) for l in range(len(dims) - 1)]
        self.b = [torch.zeros(dims[l + 1], dtype=self.dt, device=dev) for l in range(len(dims) - 1)]
        self.X = [None, None]
        self.L = [None, None]

    def forward(self, x):
        us, zs = [], []
        h = x
        for l in range(len(self.W)):
            u = h @ self.W[l].T + self.b[l]
            us.append(u)
            h = torch.relu(u) if l < len(self.W) - 1 else torch.softmax(u, dim=1)
            zs.append(h)
        return us, zs

    @torch.no_grad()
    def train_batch(self, x, lab, lr):
        us, zs = self.forward(x)
        y = zs[-1]
        loss = -torch.log(y[torch.arange(len(lab), device=dev), lab]).mean()
        d = y.clone()
        d[torch.arange(len(lab), device=dev), lab] -= 1
        ds = [None] * len(self.W)
        ds[-1] = d
        for l in range(len(self.W) - 2, -1, -1):
            ds[l] = (ds[l + 1] @ self.W[l + 1]) * (us[l] >= 0)
        for l in range(len(self.W)):
            zp = x if l == 0 else zs[l - 1]
            self.W[l] -= lr * (ds[l].T @ zp)
            self.b[l] -= lr * ds[l].sum(0)
        return loss

    def train_epoch(self, B, lr):
        X, L = self.X[0], self.L[0]
        loss, n = 0.0, 0
        losses = []
        for i in range(X.shape[0] // B):
            losses.append(self.train_batch(X[i * B:(i + 1) * B], L[i * B:(i + 1) * B], lr))
        for l in torch.stack(losses).double().cpu().numpy():
            ratio = n / (n + B)
            loss = ratio * loss + (1 - ratio) * l
            n += B
        return loss

    @torch.no_grad()
    def evaluate(self, slot, B):
        X, L = self.X[slot], self.L[slot]
        c, ls = 0, 0.0
        for s in range(0, X.shape[0], B):
            y = self.forward(X[s:s + B])[1][-1]
            lab = L[s:s + B]
            c += int((y.argmax(1) == lab).sum())
            ls += float(-torch.log(y[torch.arange(len(lab), device=dev), lab]).sum())
        return c, ls / X.shape[0]


mlp = None
while True:
    try:
        h = struct.unpack("<8q", read_exact(64))
    except EOFError:
        break
    op = h[0]
    if op == 0:
        break
    elif op == 1:
        m, n, k, hasc = h[1:5]
        alpha, beta = read_doubles(2)
        A = torch.from_numpy(read_doubles(m * k).reshape(m, k)).to(dev)
        Bm = torch.from_numpy(read_doubles(k * n).reshape(k, n)).to(dev)
        C = alpha * (A @ Bm)
        if hasc:
            C += beta * torch.from_numpy(read_doubles(m * n).reshape(m, n)).to(dev)
        write_doubles(C.cpu().numpy())
    elif op == 2:
        nl, prec = h[1], h[2]
        dims = list(struct.unpack(f"<{nl + 1}q", read_exact(8 * (nl + 1))))
        mlp = Mlp(dims, prec)
        write_doubles([0])
    elif op == 3:
        l = h[1]
        o, i = mlp.dims[l + 1], mlp.dims[l]
        mlp.W[l] = torch.from_numpy(read_doubles(o * i).reshape(o, i).copy()).to(dev, mlp.dt)
        mlp.b[l] = torch.from_numpy(read_doubles(o).copy()).to(dev, mlp.dt)
        write_doubles([0])
    elif op == 4:
        l = h[1]
        write_doubles(mlp.W[l].double().cpu().numpy())
        write_doubles(mlp.b[l].double().cpu().numpy())
    elif op == 5:
        slot, n = h[1], h[2]
        mlp.X[slot] = torch.from_numpy(read_doubles(n * mlp.dims[0]).reshape(n, -1).copy()).to(dev, mlp.dt)
        mlp.L[slot] = torch.from_numpy(np.rint(read_doubles(n)).astype(np.int64)).to(dev)
        write_doubles([0])
    elif op == 6:
        B = h[1]
        lr = read_doubles(1)[0]
        loss = mlp.train_epoch(B, lr)
        torch.cuda.synchronize()
        write_doubles([loss])
    elif op == 7:
        c, ls = mlp.evaluate(h[1], h[2])
        write_doubles([c, ls])
    out.flush()
