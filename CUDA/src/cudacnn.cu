/*
 * cudacnn.cu : CNN (畳み込みニューラルネット) の学習エンジン. EusLisp から defforeign で呼ぶ (cudacnn.l)
 *
 *  ・層の並びを Lisp から整数列で指定する
 *      spec = [H W C nlayer  type a b  type a b ...]
 *      type 1 FC  (a = 出力数)          type 2 CONV (a = カーネル k, b = 出力チャネル, stride 1, padding なし)
 *      type 3 POOL (2x2 max, stride 2)  type 4 RELU
 *    最後の FC の後に softmax + 交差エントロピー.
 *  ・活性は NHWC (n, y, x, c) の行優先. 畳み込みは im2col + gemm.
 *  ・同じコードを GPU (CUDA + cuBLAS) と CPU (OpenMP + OpenBLAS) で動かす (gpu フラグ)
 *  ・学習は nn.l と同じ: SGD, 勾配はバッチ和, ReLU の微分は u >= 0 で 1,
 *    逆伝播は更新前の重みを使う.
 */
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <vector>
#include <chrono>
#include <cuda_runtime.h>
#include <cublas_v2.h>

enum { L_FC = 1, L_CONV = 2, L_POOL = 3, L_RELU = 4 };

/* OpenBLAS (ILP64) */
extern "C" void cblas_dgemm(int, int, int, long, long, long, double, const double *, long,
                            const double *, long, double, double *, long);
extern "C" void cblas_sgemm(int, int, int, long, long, long, float, const float *, long,
                            const float *, long, float, float *, long);

static cublasHandle_t g_h = 0;

template <typename F>
__global__ void kfor(long n, F f)
{
  long i = blockIdx.x * (long)blockDim.x + threadIdx.x;
  if (i < n) f(i);
}
/* n 回の並列ループ. GPU ならカーネル, CPU なら OpenMP */
template <typename F>
static void pfor(bool gpu, long n, F f)
{
  if (n <= 0) return;
  if (gpu) kfor<<<(int)((n + 255) / 256), 256>>>(n, f);
  else {
#pragma omp parallel for schedule(static)
    for (long i = 0; i < n; i++) f(i);
  }
}

/* 行優先 C(m x n) = alpha op(A) op(B) + beta C. A,B の lda,ldb は格納されている行の長さ */
static void gemm(bool gpu, int ta, int tb, long m, long n, long k, double alpha, const double *A, long lda,
                 const double *B, long ldb, double beta, double *C, long ldc)
{
  if (gpu) cublasDgemm(g_h, tb ? CUBLAS_OP_T : CUBLAS_OP_N, ta ? CUBLAS_OP_T : CUBLAS_OP_N,
                       n, m, k, &alpha, B, ldb, A, lda, &beta, C, ldc);
  else cblas_dgemm(101, ta ? 112 : 111, tb ? 112 : 111, m, n, k, alpha, A, lda, B, ldb, beta, C, ldc);
}
static void gemm(bool gpu, int ta, int tb, long m, long n, long k, float alpha, const float *A, long lda,
                 const float *B, long ldb, float beta, float *C, long ldc)
{
  if (gpu) cublasSgemm(g_h, tb ? CUBLAS_OP_T : CUBLAS_OP_N, ta ? CUBLAS_OP_T : CUBLAS_OP_N,
                       n, m, k, &alpha, B, ldb, A, lda, &beta, C, ldc);
  else cblas_sgemm(101, ta ? 112 : 111, tb ? 112 : 111, m, n, k, alpha, A, lda, B, ldb, beta, C, ldc);
}

static void *xalloc(bool gpu, size_t bytes)
{
  void *p = 0;
  if (bytes == 0) bytes = 8;
  if (gpu) { if (cudaMalloc(&p, bytes) != cudaSuccess) { fprintf(stderr, "cudaMalloc %zu failed\n", bytes); return 0; } }
  else p = malloc(bytes);
  return p;
}
static void xfree(bool gpu, void *p) { if (!p) return; if (gpu) cudaFree(p); else free(p); }
static void xcopy(bool gpu, void *dst, const void *src, size_t bytes, bool to_dev)
{
  if (gpu) cudaMemcpy(dst, src, bytes, to_dev ? cudaMemcpyHostToDevice : cudaMemcpyDeviceToHost);
  else memcpy(dst, src, bytes);
}
static void xsync(bool gpu) { if (gpu) cudaDeviceSynchronize(); }

struct Layer {
  int type, k = 0;
  int ih, iw, ic, oh, ow, oc;    /* 入力・出力の形 (NHWC) */
  long isz, osz;                 /* 1 枚あたりの要素数 */
  long K = 0;                    /* CONV: ic*k*k,  FC: isz */
};

template <typename T>
struct Net {
  bool gpu;
  int maxb;
  std::vector<Layer> L;
  std::vector<T *> W, b, act, d, col;
  std::vector<int *> pidx;
  T *dcol = 0, *ones = 0;
  T *X[2] = {0, 0};
  int *Lab[2] = {0, 0};
  long N[2] = {0, 0};
  double *rowloss = 0; int *rowok = 0;
  std::vector<double> hloss; std::vector<int> hok;
  bool prof = false;
  std::vector<double> tf, tb;    /* 層ごとの順伝播・逆伝播の時間 [s] */
};

static Net<double> *n64 = 0;
static Net<float> *n32 = 0;
static int g_prec = 32;

static double now() { return std::chrono::duration<double>(std::chrono::steady_clock::now().time_since_epoch()).count(); }

template <typename T>
static void net_free(Net<T> *&n)
{
  if (!n) return;
  bool g = n->gpu;
  for (auto p : n->W) xfree(g, p);
  for (auto p : n->b) xfree(g, p);
  for (auto p : n->act) xfree(g, p);
  for (auto p : n->d) xfree(g, p);
  for (auto p : n->col) xfree(g, p);
  for (auto p : n->pidx) xfree(g, p);
  xfree(g, n->dcol); xfree(g, n->ones);
  for (int s = 0; s < 2; s++) { xfree(g, n->X[s]); xfree(g, n->Lab[s]); }
  xfree(g, n->rowloss); xfree(g, n->rowok);
  delete n; n = 0;
}

template <typename T>
static int net_create(Net<T> *&n, const long *spec, int maxb, bool gpu)
{
  if (gpu && !g_h && cublasCreate(&g_h) != CUBLAS_STATUS_SUCCESS) { fprintf(stderr, "cublasCreate failed\n"); return -1; }
  net_free(n);
  n = new Net<T>();
  n->gpu = gpu; n->maxb = maxb;
  int h = spec[0], w = spec[1], c = spec[2], nl = spec[3];
  long maxcol = 0, maxrows = maxb;
  for (int i = 0; i < nl; i++) {
    Layer l; l.type = spec[4 + 3 * i];
    int a = spec[5 + 3 * i], bb = spec[6 + 3 * i];
    l.ih = h; l.iw = w; l.ic = c; l.isz = (long)h * w * c;
    if (l.type == L_FC) { l.oh = 1; l.ow = 1; l.oc = a; l.K = l.isz; }
    else if (l.type == L_CONV) { l.k = a; l.oh = h - a + 1; l.ow = w - a + 1; l.oc = bb; l.K = (long)c * a * a; }
    else if (l.type == L_POOL) { l.oh = h / 2; l.ow = w / 2; l.oc = c; }
    else { l.oh = h; l.ow = w; l.oc = c; }
    l.osz = (long)l.oh * l.ow * l.oc;
    h = l.oh; w = l.ow; c = l.oc;
    n->L.push_back(l);
  }
  int nlay = n->L.size();
  n->W.assign(nlay, 0); n->b.assign(nlay, 0); n->act.assign(nlay, 0); n->d.assign(nlay, 0);
  n->col.assign(nlay, 0); n->pidx.assign(nlay, 0);
  for (int i = 0; i < nlay; i++) {
    Layer &l = n->L[i];
    n->act[i] = (T *)xalloc(gpu, sizeof(T) * maxb * l.osz);
    n->d[i] = (T *)xalloc(gpu, sizeof(T) * maxb * l.osz);
    if (l.type == L_FC || l.type == L_CONV) {
      n->W[i] = (T *)xalloc(gpu, sizeof(T) * l.oc * l.K);
      n->b[i] = (T *)xalloc(gpu, sizeof(T) * l.oc);
    }
    if (l.type == L_CONV) {
      long rows = (long)maxb * l.oh * l.ow;
      n->col[i] = (T *)xalloc(gpu, sizeof(T) * rows * l.K);
      if (rows * l.K > maxcol) maxcol = rows * l.K;
      if (rows > maxrows) maxrows = rows;
    }
    if (l.type == L_POOL) n->pidx[i] = (int *)xalloc(gpu, sizeof(int) * maxb * l.osz);
  }
  n->dcol = (T *)xalloc(gpu, sizeof(T) * (maxcol ? maxcol : 1));
  n->ones = (T *)xalloc(gpu, sizeof(T) * maxrows);
  T *ones = n->ones;
  pfor(gpu, maxrows, [=] __host__ __device__ (long i) { ones[i] = (T)1; });
  n->rowloss = (double *)xalloc(gpu, sizeof(double) * maxb);
  n->rowok = (int *)xalloc(gpu, sizeof(int) * maxb);
  n->hloss.resize(maxb); n->hok.resize(maxb);
  n->tf.assign(nlay, 0.0); n->tb.assign(nlay, 0.0);
  xsync(gpu);
  return 0;
}

template <typename T>
static int to_net(bool gpu, T *dst, const double *src, long cnt)
{
  if (sizeof(T) == sizeof(double)) { xcopy(gpu, dst, src, sizeof(double) * cnt, true); return 0; }
  std::vector<T> tmp(cnt);
  for (long i = 0; i < cnt; i++) tmp[i] = (T)src[i];
  xcopy(gpu, dst, tmp.data(), sizeof(T) * cnt, true);
  return 0;
}
template <typename T>
static int from_net(bool gpu, double *dst, const T *src, long cnt)
{
  xsync(gpu);
  if (sizeof(T) == sizeof(double)) { xcopy(gpu, dst, src, sizeof(double) * cnt, false); return 0; }
  std::vector<T> tmp(cnt);
  xcopy(gpu, tmp.data(), src, sizeof(T) * cnt, false);
  for (long i = 0; i < cnt; i++) dst[i] = (double)tmp[i];
  return 0;
}

/* 順伝播. x: B 枚 (NHWC). 最後の層の出力 act に確率. rowloss/rowok に 1 行ごとの損失・正解 */
template <typename T>
static void forward(Net<T> *n, const T *x, const int *lab, int B)
{
  bool g = n->gpu;
  const T *in = x;
  int nl = n->L.size();
  for (int i = 0; i < nl; i++) {
    double t0 = n->prof ? (xsync(g), now()) : 0;
    Layer &l = n->L[i];
    T *out = n->act[i];
    if (l.type == L_FC) {
      gemm(g, 0, 1, B, l.oc, l.K, (T)1, in, l.K, n->W[i], l.K, (T)0, out, l.oc);
      const T *bb = n->b[i]; int oc = l.oc;
      pfor(g, (long)B * oc, [=] __host__ __device__ (long j) { out[j] += bb[j % oc]; });
    } else if (l.type == L_CONV) {
      T *col = n->col[i];
      int k = l.k, ih = l.ih, iw = l.iw, ic = l.ic, oh = l.oh, ow = l.ow; long K = l.K;
      /* im2col: col[(nb,oy,ox)][(c,ky,kx)] = in[nb][oy+ky][ox+kx][c] */
      pfor(g, (long)B * oh * ow * K, [=] __host__ __device__ (long j) {
        long r = j / K; int q = (int)(j % K);
        int c = q / (k * k), ky = (q / k) % k, kx = q % k;
        int ox = (int)(r % ow), oy = (int)((r / ow) % oh); long nb = r / ((long)ow * oh);
        col[j] = in[((nb * ih + oy + ky) * iw + ox + kx) * ic + c];
      });
      gemm(g, 0, 1, (long)B * oh * ow, l.oc, K, (T)1, col, K, n->W[i], K, (T)0, out, l.oc);
      const T *bb = n->b[i]; int oc = l.oc;
      pfor(g, (long)B * l.osz, [=] __host__ __device__ (long j) { out[j] += bb[j % oc]; });
    } else if (l.type == L_RELU) {
      pfor(g, (long)B * l.osz, [=] __host__ __device__ (long j) { T v = in[j]; out[j] = v >= (T)0 ? v : (T)0; });
    } else if (l.type == L_POOL) {
      int *idx = n->pidx[i];
      int ih = l.ih, iw = l.iw, c = l.ic, oh = l.oh, ow = l.ow;
      pfor(g, (long)B * l.osz, [=] __host__ __device__ (long j) {
        int ch = (int)(j % c); long r = j / c;
        int ox = (int)(r % ow), oy = (int)((r / ow) % oh); long nb = r / ((long)ow * oh);
        long base = ((nb * ih + 2 * oy) * iw + 2 * ox) * c + ch;
        long best = base; T bv = in[base];
        long cand[3] = {base + c, base + (long)iw * c, base + (long)iw * c + c};
        for (int t = 0; t < 3; t++) if (in[cand[t]] > bv) { bv = in[cand[t]]; best = cand[t]; }
        out[j] = bv; idx[j] = (int)(best - nb * (long)ih * iw * c);
      });
    }
    if (i == nl - 1) {
      /* softmax + 損失 */
      int oc = l.oc; double *rl = n->rowloss; int *ro = n->rowok;
      pfor(g, B, [=] __host__ __device__ (long r) {
        T *y = out + r * oc;
        T mx = y[0]; int am = 0;
        for (int j = 1; j < oc; j++) if (y[j] > mx) { mx = y[j]; am = j; }
        T s = 0;
        for (int j = 0; j < oc; j++) { T e = exp(y[j] - mx); y[j] = e; s += e; }
        for (int j = 0; j < oc; j++) y[j] /= s;
        if (lab) { rl[r] = -log((double)y[lab[r]]); ro[r] = (am == lab[r]); }
      });
    }
    if (n->prof) { xsync(g); n->tf[i] += now() - t0; }
    in = out;
  }
}

template <typename T>
static double batch_stats(Net<T> *n, int B, int *correct)
{
  xcopy(n->gpu, n->hloss.data(), n->rowloss, sizeof(double) * B, false);
  xcopy(n->gpu, n->hok.data(), n->rowok, sizeof(int) * B, false);
  double s = 0; int c = 0;
  for (int i = 0; i < B; i++) { s += n->hloss[i]; c += n->hok[i]; }
  if (correct) *correct = c;
  return s;
}

/* 1 バッチ学習 (損失の和を返す. stats=false なら損失を集計しない) */
template <typename T>
static double train_batch(Net<T> *n, long start, int B, double lr, bool stats)
{
  if (B > n->maxb || start + B > n->N[0]) return -1.0;
  bool g = n->gpu;
  const T *x = n->X[0] + start * n->L[0].isz;
  const int *lab = n->Lab[0] + start;
  int nl = n->L.size();
  forward(n, x, lab, B);
  /* 出力層: d = y - t */
  {
    Layer &l = n->L[nl - 1];
    T *dd = n->d[nl - 1]; const T *y = n->act[nl - 1]; int oc = l.oc;
    pfor(g, (long)B * oc, [=] __host__ __device__ (long j) { dd[j] = y[j] - ((int)(j % oc) == lab[j / oc] ? (T)1 : (T)0); });
  }
  T a = (T)(-lr);
  for (int i = nl - 1; i >= 0; i--) {
    double t0 = n->prof ? (xsync(g), now()) : 0;
    Layer &l = n->L[i];
    const T *in = i > 0 ? n->act[i - 1] : x;
    T *din = i > 0 ? n->d[i - 1] : 0;
    T *dout = n->d[i];
    if (l.type == L_FC) {
      if (din) gemm(g, 0, 0, B, l.K, l.oc, (T)1, dout, l.oc, n->W[i], l.K, (T)0, din, l.K);
      gemm(g, 1, 0, l.oc, l.K, B, a, dout, l.oc, in, l.K, (T)1, n->W[i], l.K);
      gemm(g, 0, 0, 1, l.oc, B, a, n->ones, B, dout, l.oc, (T)1, n->b[i], l.oc);
    } else if (l.type == L_CONV) {
      long rows = (long)B * l.oh * l.ow; long K = l.K;
      if (din) {
        T *dcol = n->dcol;
        gemm(g, 0, 0, rows, K, l.oc, (T)1, dout, l.oc, n->W[i], K, (T)0, dcol, K);
        /* col2im (集める形にして atomic を使わない) */
        int k = l.k, ih = l.ih, iw = l.iw, ic = l.ic, oh = l.oh, ow = l.ow;
        pfor(g, (long)B * l.isz, [=] __host__ __device__ (long j) {
          int c = (int)(j % ic); long r = j / ic;
          int xx = (int)(r % iw), yy = (int)((r / iw) % ih); long nb = r / ((long)iw * ih);
          T s = 0;
          for (int ky = 0; ky < k; ky++) {
            int oy = yy - ky; if (oy < 0 || oy >= oh) continue;
            for (int kx = 0; kx < k; kx++) {
              int ox = xx - kx; if (ox < 0 || ox >= ow) continue;
              s += dcol[((nb * oh + oy) * ow + ox) * K + (c * k + ky) * k + kx];
            }
          }
          din[j] = s;
        });
      }
      gemm(g, 1, 0, l.oc, K, rows, a, dout, l.oc, n->col[i], K, (T)1, n->W[i], K);
      gemm(g, 0, 0, 1, l.oc, rows, a, n->ones, rows, dout, l.oc, (T)1, n->b[i], l.oc);
    } else if (l.type == L_RELU) {
      if (din) pfor(g, (long)B * l.osz, [=] __host__ __device__ (long j) { din[j] = in[j] >= (T)0 ? dout[j] : (T)0; });
    } else if (l.type == L_POOL) {
      if (din) {
        const int *idx = n->pidx[i]; long isz = l.isz, osz = l.osz;
        pfor(g, (long)B * isz, [=] __host__ __device__ (long j) { din[j] = 0; });
        pfor(g, (long)B * osz, [=] __host__ __device__ (long j) { din[(j / osz) * isz + idx[j]] = dout[j]; });
      }
    }
    if (n->prof) { xsync(g); n->tb[i] += now() - t0; }
  }
  return stats ? batch_stats(n, B, 0) : 0.0;
}

template <typename T>
static double train_epoch(Net<T> *n, int B, double lr)
{
  long nb = n->N[0] / B;
  double loss = 0, cnt = 0;
  for (long i = 0; i < nb; i++) {
    double l = train_batch(n, i * B, B, lr, true) / B;
    if (l < 0) return -1;
    double ratio = cnt / (cnt + B);
    loss = ratio * loss + (1 - ratio) * l;
    cnt += B;
  }
  xsync(n->gpu);
  return loss;
}

template <typename T>
static long evaluate(Net<T> *n, int slot, int B, double *loss_out)
{
  long N = n->N[slot]; double ls = 0; long ok = 0;
  for (long s = 0; s < N; s += B) {
    int b = (int)((N - s) < B ? (N - s) : B);
    if (b > n->maxb) return -1;
    forward(n, n->X[slot] + s * n->L[0].isz, n->Lab[slot] + s, b);
    int c; ls += batch_stats(n, b, &c); ok += c;
  }
  if (loss_out) loss_out[0] = ls / N;
  return ok;
}

template <typename T>
static int upload(Net<T> *n, int slot, const double *X, const double *lab, long N)
{
  bool g = n->gpu;
  xfree(g, n->X[slot]); xfree(g, n->Lab[slot]);
  long isz = n->L[0].isz;
  n->X[slot] = (T *)xalloc(g, sizeof(T) * N * isz);
  n->Lab[slot] = (int *)xalloc(g, sizeof(int) * N);
  if (!n->X[slot] || !n->Lab[slot]) return -1;
  to_net(g, n->X[slot], X, N * isz);
  std::vector<int> li(N);
  for (long i = 0; i < N; i++) li[i] = (int)lrint(lab[i]);
  xcopy(g, n->Lab[slot], li.data(), sizeof(int) * N, true);
  n->N[slot] = N;
  xsync(g);
  return 0;
}

/* ---------------- extern "C" ---------------- */
#define DISPATCH(expr64, expr32) (g_prec == 64 ? (expr64) : (expr32))

extern "C" long cnn_create(const long *spec, long maxb, long prec, long gpu)
{
  g_prec = (int)prec;
  if (prec == 64) return net_create(n64, spec, maxb, gpu != 0);
  return net_create(n32, spec, maxb, gpu != 0);
}
extern "C" long cnn_free() { net_free(n64); net_free(n32); return 0; }
/* 層 l の重みの要素数 (out x K). 重みがない層は 0 */
extern "C" long cnn_wsize(long l)
{
  Layer &L = g_prec == 64 ? n64->L[l] : n32->L[l];
  return (L.type == L_FC || L.type == L_CONV) ? (long)L.oc * L.K : 0;
}
extern "C" long cnn_set_param(long l, const double *W, const double *b)
{
  if (g_prec == 64) { Layer &L = n64->L[l]; to_net(n64->gpu, n64->W[l], W, (long)L.oc * L.K); return to_net(n64->gpu, n64->b[l], b, L.oc); }
  Layer &L = n32->L[l]; to_net(n32->gpu, n32->W[l], W, (long)L.oc * L.K); return to_net(n32->gpu, n32->b[l], b, L.oc);
}
extern "C" long cnn_get_param(long l, double *W, double *b)
{
  if (g_prec == 64) { Layer &L = n64->L[l]; from_net(n64->gpu, W, n64->W[l], (long)L.oc * L.K); return from_net(n64->gpu, b, n64->b[l], L.oc); }
  Layer &L = n32->L[l]; from_net(n32->gpu, W, n32->W[l], (long)L.oc * L.K); return from_net(n32->gpu, b, n32->b[l], L.oc);
}
extern "C" long cnn_upload(long slot, const double *X, const double *lab, long N)
{ return DISPATCH(upload(n64, slot, X, lab, N), upload(n32, slot, X, lab, N)); }
extern "C" double cnn_train_batch(long start, long B, double lr)
{ return DISPATCH(train_batch(n64, start, B, lr, true), train_batch(n32, start, B, lr, true)) / B; }
extern "C" double cnn_train_epoch(long B, double lr)
{ return DISPATCH(train_epoch(n64, B, lr), train_epoch(n32, B, lr)); }
extern "C" long cnn_eval(long slot, long B, double *loss_out)
{ return DISPATCH(evaluate(n64, slot, B, loss_out), evaluate(n32, slot, B, loss_out)); }
extern "C" long cnn_sync() { if (g_prec == 64 ? n64->gpu : n32->gpu) cudaDeviceSynchronize(); return 0; }
/* 層ごとの時間計測. on=1 で開始 (値は 0 に戻す). out: [順伝播 x nl, 逆伝播 x nl] */
extern "C" long cnn_profile(long on)
{
  if (g_prec == 64) { n64->prof = on; n64->tf.assign(n64->L.size(), 0); n64->tb.assign(n64->L.size(), 0); }
  else { n32->prof = on; n32->tf.assign(n32->L.size(), 0); n32->tb.assign(n32->L.size(), 0); }
  return 0;
}
extern "C" long cnn_get_profile(double *out)
{
  auto &tf = g_prec == 64 ? n64->tf : n32->tf;
  auto &tb = g_prec == 64 ? n64->tb : n32->tb;
  long nl = tf.size();
  for (long i = 0; i < nl; i++) { out[i] = tf[i]; out[nl + i] = tb[i]; }
  return nl;
}
/* 出力の確率を取り出す (推論の例用). slot のデータの start から B 枚 */
extern "C" long cnn_predict(long slot, long start, long B, double *probs)
{
  if (g_prec == 64) { forward(n64, n64->X[slot] + start * n64->L[0].isz, n64->Lab[slot] + start, B);
    return from_net(n64->gpu, probs, n64->act.back(), B * n64->L.back().oc); }
  forward(n32, n32->X[slot] + start * n32->L[0].isz, n32->Lab[slot] + start, B);
  return from_net(n32->gpu, probs, n32->act.back(), B * n32->L.back().oc);
}
