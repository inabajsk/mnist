/*
 * cudamlp.cu : CUDA (cuBLAS) backend for nn.l
 *
 *  EusLisp から defforeign で呼ぶ C 関数群 (cudalib.l 参照)
 *  行列はすべて EusLisp と同じ行優先 (row-major).
 *
 *  (1) cuda_dgemm_host   : cblas-dgemm の差し替え. 呼び出し毎に host<->device 転送.
 *  (2) cmlp_*            : GPU 常駐 MLP. 重み・学習データを GPU に置いたまま
 *                          順伝播・逆伝播・更新を GPU 上で行う. FP64 / FP32.
 *  (3) cpumlp_*          : (2) と同じ計算を CPU (OpenBLAS) で行う比較用.
 *
 *  計算は nn.l の :train-batch と同じ:
 *    u = z W^T + 1 b^T,  z = ReLU(u) / Softmax(u)
 *    delta_L = y - t,  delta_l = (delta_{l+1} W_{l+1}) .* (u_l >= 0)
 *    W -= lr * delta^T z  (バッチ和),  b -= lr * 1^T delta
 */
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <cmath>
#include <vector>
#include <cuda_runtime.h>
#include <cublas_v2.h>

#define CK(x) do { cudaError_t e_ = (x); if (e_ != cudaSuccess) { \
  fprintf(stderr, "CUDA error %s at %s:%d\n", cudaGetErrorString(e_), __FILE__, __LINE__); return -1; } } while (0)
#define CB(x) do { cublasStatus_t s_ = (x); if (s_ != CUBLAS_STATUS_SUCCESS) { \
  fprintf(stderr, "cuBLAS error %d at %s:%d\n", (int)s_, __FILE__, __LINE__); return -1; } } while (0)

static cublasHandle_t g_handle = 0;

static int ensure_handle()
{
  if (!g_handle) {
    if (cublasCreate(&g_handle) != CUBLAS_STATUS_SUCCESS) {
      fprintf(stderr, "cublasCreate failed\n"); return -1;
    }
  }
  return 0;
}

/* row-major C(m x n) = alpha op(A) op(B) + beta C  を column-major の cuBLAS で計算
   (C^T = op(B)^T op(A)^T).  ta/tb: 0 = そのまま, 1 = 転置.  A,B の行数・列数は op 前の値 */
static cublasStatus_t gemm_rm(int ta, int tb, int m, int n, int k, double alpha,
                              const double *A, int lda, const double *B, int ldb,
                              double beta, double *C, int ldc)
{
  return cublasDgemm(g_handle, tb ? CUBLAS_OP_T : CUBLAS_OP_N, ta ? CUBLAS_OP_T : CUBLAS_OP_N,
                     n, m, k, &alpha, B, ldb, A, lda, &beta, C, ldc);
}
static cublasStatus_t gemm_rm(int ta, int tb, int m, int n, int k, float alpha,
                              const float *A, int lda, const float *B, int ldb,
                              float beta, float *C, int ldc)
{
  return cublasSgemm(g_handle, tb ? CUBLAS_OP_T : CUBLAS_OP_N, ta ? CUBLAS_OP_T : CUBLAS_OP_N,
                     n, m, k, &alpha, B, ldb, A, lda, &beta, C, ldc);
}

/* ------------------------------------------------------------------ */
/* (1) cblas-dgemm の差し替え: C = alpha A B + beta C  (A: m x k, B: k x n) */
/* ------------------------------------------------------------------ */
static double *g_dA = 0, *g_dB = 0, *g_dC = 0;
static size_t g_nA = 0, g_nB = 0, g_nC = 0;

static int grow(double **p, size_t *cap, size_t n)
{
  if (n > *cap) {
    if (*p) cudaFree(*p);
    CK(cudaMalloc((void **)p, n * sizeof(double)));
    *cap = n;
  }
  return 0;
}

extern "C" long cuda_dgemm_host(long m, long n, long k, double alpha,
                                const double *A, const double *B, double beta, double *C)
{
  if (ensure_handle()) return -1;
  if (grow(&g_dA, &g_nA, m * k) || grow(&g_dB, &g_nB, k * n) || grow(&g_dC, &g_nC, m * n)) return -1;
  CK(cudaMemcpy(g_dA, A, sizeof(double) * m * k, cudaMemcpyHostToDevice));
  CK(cudaMemcpy(g_dB, B, sizeof(double) * k * n, cudaMemcpyHostToDevice));
  if (beta != 0.0) CK(cudaMemcpy(g_dC, C, sizeof(double) * m * n, cudaMemcpyHostToDevice));
  CB(gemm_rm(0, 0, m, n, k, alpha, g_dA, k, g_dB, n, beta, g_dC, n));
  CK(cudaMemcpy(C, g_dC, sizeof(double) * m * n, cudaMemcpyDeviceToHost));
  return 0;
}

/* ------------------------------------------------------------------ */
/* kernels                                                             */
/* ------------------------------------------------------------------ */
template <typename T>
__global__ void k_bias_relu(T *u, T *z, const T *b, int rows, int cols, int relu)
{
  long i = blockIdx.x * (long)blockDim.x + threadIdx.x;
  if (i >= (long)rows * cols) return;
  T v = u[i] + b[i % cols];
  u[i] = v;
  if (relu) z[i] = v >= (T)0 ? v : (T)0;
}

/* 行ごとの softmax (cols=10 程度なので 1 スレッド 1 行) と損失・正解判定 */
template <typename T>
__global__ void k_softmax_loss(const T *u, T *y, const int *label, int rows, int cols,
                               double *loss, int *correct)
{
  int r = blockIdx.x * blockDim.x + threadIdx.x;
  if (r >= rows) return;
  const T *ur = u + (long)r * cols;
  T *yr = y + (long)r * cols;
  T mx = ur[0];
  int am = 0;
  for (int j = 1; j < cols; j++) if (ur[j] > mx) { mx = ur[j]; am = j; }
  T s = 0;
  for (int j = 0; j < cols; j++) { T e = exp(ur[j] - mx); yr[j] = e; s += e; }
  for (int j = 0; j < cols; j++) yr[j] /= s;
  if (loss) atomicAdd(loss, -log((double)yr[label[r]]));
  if (correct && am == label[r]) atomicAdd(correct, 1);
}

/* delta = y - t (one-hot) */
template <typename T>
__global__ void k_out_delta(const T *y, T *d, const int *label, int rows, int cols)
{
  long i = blockIdx.x * (long)blockDim.x + threadIdx.x;
  if (i >= (long)rows * cols) return;
  int r = i / cols, c = i % cols;
  d[i] = y[i] - (c == label[r] ? (T)1 : (T)0);
}

/* d *= (u >= 0) */
template <typename T>
__global__ void k_relu_diff(T *d, const T *u, long n)
{
  long i = blockIdx.x * (long)blockDim.x + threadIdx.x;
  if (i < n && !(u[i] >= (T)0)) d[i] = 0;
}

template <typename T>
__global__ void k_fill(T *p, T v, long n)
{
  long i = blockIdx.x * (long)blockDim.x + threadIdx.x;
  if (i < n) p[i] = v;
}

static inline int nblk(long n, int t = 256) { return (int)((n + t - 1) / t); }

/* ------------------------------------------------------------------ */
/* (2) GPU 常駐 MLP                                                    */
/* ------------------------------------------------------------------ */
template <typename T>
struct Mlp {
  int nl = 0, maxb = 0;
  std::vector<int> dim;            /* dim[0]=784, dim[1]=1000, ... dim[nl]=10 */
  std::vector<T *> W, b, u, z, d;  /* device */
  T *ones = 0;
  T *X[2] = {0, 0};                /* dataset slot 0: train, 1: test */
  int *L[2] = {0, 0};
  long N[2] = {0, 0};
  double *dloss = 0;
  int *dcorrect = 0;
};
static Mlp<double> *g64 = 0;
static Mlp<float> *g32 = 0;
static int g_prec = 64;

template <typename T>
static int mlp_create(Mlp<T> *&m, int nl, const long *dims, int maxb)
{
  if (ensure_handle()) return -1;
  m = new Mlp<T>();
  m->nl = nl; m->maxb = maxb;
  for (int i = 0; i <= nl; i++) m->dim.push_back((int)dims[i]);
  m->W.resize(nl); m->b.resize(nl); m->u.resize(nl); m->z.resize(nl); m->d.resize(nl);
  for (int l = 0; l < nl; l++) {
    int in = m->dim[l], out = m->dim[l + 1];
    CK(cudaMalloc((void **)&m->W[l], sizeof(T) * out * in));
    CK(cudaMalloc((void **)&m->b[l], sizeof(T) * out));
    CK(cudaMalloc((void **)&m->u[l], sizeof(T) * (long)maxb * out));
    CK(cudaMalloc((void **)&m->z[l], sizeof(T) * (long)maxb * out));
    CK(cudaMalloc((void **)&m->d[l], sizeof(T) * (long)maxb * out));
  }
  CK(cudaMalloc((void **)&m->ones, sizeof(T) * maxb));
  k_fill<T><<<nblk(maxb), 256>>>(m->ones, (T)1, maxb);
  CK(cudaMalloc((void **)&m->dloss, sizeof(double)));
  CK(cudaMalloc((void **)&m->dcorrect, sizeof(int)));
  return 0;
}

template <typename T>
static void mlp_free(Mlp<T> *&m)
{
  if (!m) return;
  for (int l = 0; l < m->nl; l++) { cudaFree(m->W[l]); cudaFree(m->b[l]); cudaFree(m->u[l]); cudaFree(m->z[l]); cudaFree(m->d[l]); }
  for (int s = 0; s < 2; s++) { cudaFree(m->X[s]); cudaFree(m->L[s]); }
  cudaFree(m->ones); cudaFree(m->dloss); cudaFree(m->dcorrect);
  delete m; m = 0;
}

/* host double -> device T */
template <typename T>
static int to_dev(T *dst, const double *src, long n)
{
  if (sizeof(T) == sizeof(double)) { CK(cudaMemcpy(dst, src, sizeof(double) * n, cudaMemcpyHostToDevice)); return 0; }
  std::vector<T> tmp(n);
  for (long i = 0; i < n; i++) tmp[i] = (T)src[i];
  CK(cudaMemcpy(dst, tmp.data(), sizeof(T) * n, cudaMemcpyHostToDevice));
  return 0;
}
template <typename T>
static int to_host(double *dst, const T *src, long n)
{
  if (sizeof(T) == sizeof(double)) { CK(cudaMemcpy(dst, src, sizeof(double) * n, cudaMemcpyDeviceToHost)); return 0; }
  std::vector<T> tmp(n);
  CK(cudaMemcpy(tmp.data(), src, sizeof(T) * n, cudaMemcpyDeviceToHost));
  for (long i = 0; i < n; i++) dst[i] = (double)tmp[i];
  return 0;
}

template <typename T>
static int mlp_set_layer(Mlp<T> *m, int l, const double *W, const double *b)
{
  int in = m->dim[l], out = m->dim[l + 1];
  if (to_dev(m->W[l], W, (long)out * in)) return -1;
  return to_dev(m->b[l], b, out);
}
template <typename T>
static int mlp_get_layer(Mlp<T> *m, int l, double *W, double *b)
{
  int in = m->dim[l], out = m->dim[l + 1];
  CK(cudaDeviceSynchronize());
  if (to_host(W, m->W[l], (long)out * in)) return -1;
  return to_host(b, m->b[l], out);
}

template <typename T>
static int mlp_upload(Mlp<T> *m, int slot, const double *X, const double *lab, long n)
{
  int in = m->dim[0];
  cudaFree(m->X[slot]); cudaFree(m->L[slot]);
  CK(cudaMalloc((void **)&m->X[slot], sizeof(T) * n * in));
  CK(cudaMalloc((void **)&m->L[slot], sizeof(int) * n));
  if (to_dev(m->X[slot], X, n * in)) return -1;
  std::vector<int> li(n);
  for (long i = 0; i < n; i++) li[i] = (int)lrint(lab[i]);
  CK(cudaMemcpy(m->L[slot], li.data(), sizeof(int) * n, cudaMemcpyHostToDevice));
  m->N[slot] = n;
  return 0;
}

/* 順伝播 (x: device, B 行) -> 出力 z[nl-1] に確率. loss/correct を加算 */
template <typename T>
static int mlp_forward(Mlp<T> *m, const T *x, const int *lab, int B, int with_stats)
{
  const T *in = x;
  for (int l = 0; l < m->nl; l++) {
    int ni = m->dim[l], no = m->dim[l + 1];
    /* u = in (B x ni) * W^T (ni x no) */
    CB(gemm_rm(0, 1, B, no, ni, (T)1, in, ni, m->W[l], ni, (T)0, m->u[l], no));
    int last = (l == m->nl - 1);
    k_bias_relu<T><<<nblk((long)B * no), 256>>>(m->u[l], m->z[l], m->b[l], B, no, !last);
    if (last)
      k_softmax_loss<T><<<nblk(B, 128), 128>>>(m->u[l], m->z[l], lab, B, no,
                                               with_stats ? m->dloss : 0, with_stats ? m->dcorrect : 0);
    in = m->z[l];
  }
  return 0;
}

template <typename T>
static double mlp_train_batch(Mlp<T> *m, long start, int B, double lr)
{
  if (B > m->maxb || start + B > m->N[0]) return -1.0;
  const T *x = m->X[0] + start * m->dim[0];
  const int *lab = m->L[0] + start;
  int nl = m->nl;
  if (cudaMemset(m->dloss, 0, sizeof(double)) != cudaSuccess) return -1.0;
  if (mlp_forward(m, x, lab, B, 1)) return -1.0;
  /* 出力層の誤差 */
  int no = m->dim[nl];
  k_out_delta<T><<<nblk((long)B * no), 256>>>(m->z[nl - 1], m->d[nl - 1], lab, B, no);
  /* 誤差逆伝播 (更新前の W を使う) */
  for (int l = nl - 2; l >= 0; l--) {
    int o = m->dim[l + 1], o2 = m->dim[l + 2];
    /* d_l (B x o) = d_{l+1} (B x o2) * W_{l+1} (o2 x o) */
    if (gemm_rm(0, 0, B, o, o2, (T)1, m->d[l + 1], o2, m->W[l + 1], o, (T)0, m->d[l], o) != CUBLAS_STATUS_SUCCESS) return -1.0;
    k_relu_diff<T><<<nblk((long)B * o), 256>>>(m->d[l], m->u[l], (long)B * o);
  }
  /* 更新: W -= lr d^T z_prev,  b -= lr 1^T d */
  for (int l = 0; l < nl; l++) {
    int ni = m->dim[l], o = m->dim[l + 1];
    const T *zp = l == 0 ? x : m->z[l - 1];
    if (gemm_rm(1, 0, o, ni, B, (T)(-lr), m->d[l], o, zp, ni, (T)1, m->W[l], ni) != CUBLAS_STATUS_SUCCESS) return -1.0;
    if (gemm_rm(0, 0, 1, o, B, (T)(-lr), m->ones, B, m->d[l], o, (T)1, m->b[l], o) != CUBLAS_STATUS_SUCCESS) return -1.0;
  }
  double loss;
  if (cudaMemcpy(&loss, m->dloss, sizeof(double), cudaMemcpyDeviceToHost) != cudaSuccess) return -1.0;
  return loss / B;
}

/* 1エポック分を GPU 内でまとめて回す (Lisp との往復を省く). 戻り値: 平均損失 (nn.l と同じ移動平均) */
template <typename T>
static double mlp_train_epoch(Mlp<T> *m, int B, double lr)
{
  long nb = m->N[0] / B;
  double loss = 0.0, n = 0.0;
  for (long i = 0; i < nb; i++) {
    double l = mlp_train_batch(m, i * B, B, lr);
    if (l < 0) return -1.0;
    double ratio = n / (n + B);
    loss = ratio * loss + (1.0 - ratio) * l;
    n += B;
  }
  return loss;
}

/* slot のデータを B 行ずつ順伝播. 戻り値: 正解数. loss_out[0] に平均損失 */
template <typename T>
static long mlp_eval(Mlp<T> *m, int slot, int B, double *loss_out, double *probs_out)
{
  long n = m->N[slot];
  if (cudaMemset(m->dloss, 0, sizeof(double)) != cudaSuccess) return -1;
  if (cudaMemset(m->dcorrect, 0, sizeof(int)) != cudaSuccess) return -1;
  int no = m->dim[m->nl];
  for (long s = 0; s < n; s += B) {
    int b = (int)((n - s) < B ? (n - s) : B);
    if (b > m->maxb) return -1;
    if (mlp_forward(m, m->X[slot] + s * m->dim[0], m->L[slot] + s, b, 1)) return -1;
    if (probs_out && to_host(probs_out + s * no, m->z[m->nl - 1], (long)b * no)) return -1;
  }
  double loss; int corr;
  if (cudaMemcpy(&loss, m->dloss, sizeof(double), cudaMemcpyDeviceToHost) != cudaSuccess) return -1;
  if (cudaMemcpy(&corr, m->dcorrect, sizeof(int), cudaMemcpyDeviceToHost) != cudaSuccess) return -1;
  if (loss_out) loss_out[0] = loss / n;
  return corr;
}

/* ---- extern "C" (precision: 64 or 32) ---- */
extern "C" long cmlp_create(long nl, const long *dims, long maxb, long prec)
{
  g_prec = (int)prec;
  if (prec == 32) { mlp_free(g32); return mlp_create(g32, nl, dims, maxb); }
  mlp_free(g64); return mlp_create(g64, nl, dims, maxb);
}
extern "C" long cmlp_free() { mlp_free(g32); mlp_free(g64); return 0; }
extern "C" long cmlp_set_layer(long l, const double *W, const double *b)
{ return g_prec == 32 ? mlp_set_layer(g32, l, W, b) : mlp_set_layer(g64, l, W, b); }
extern "C" long cmlp_get_layer(long l, double *W, double *b)
{ return g_prec == 32 ? mlp_get_layer(g32, l, W, b) : mlp_get_layer(g64, l, W, b); }
extern "C" long cmlp_upload(long slot, const double *X, const double *lab, long n)
{ return g_prec == 32 ? mlp_upload(g32, slot, X, lab, n) : mlp_upload(g64, slot, X, lab, n); }
extern "C" double cmlp_train_batch(long start, long B, double lr)
{ return g_prec == 32 ? mlp_train_batch(g32, start, B, lr) : mlp_train_batch(g64, start, B, lr); }
extern "C" double cmlp_train_epoch(long B, double lr)
{ return g_prec == 32 ? mlp_train_epoch(g32, B, lr) : mlp_train_epoch(g64, B, lr); }
extern "C" long cmlp_eval(long slot, long B, double *loss_out, double *probs_out)
{ return g_prec == 32 ? mlp_eval(g32, slot, B, loss_out, probs_out) : mlp_eval(g64, slot, B, loss_out, probs_out); }
extern "C" long cmlp_sync() { CK(cudaDeviceSynchronize()); return 0; }
extern "C" long cmlp_device_name(char *buf, long len)
{
  cudaDeviceProp p;
  CK(cudaGetDeviceProperties(&p, 0));
  snprintf(buf, len, "%s (sm_%d%d, %d SMs)", p.name, p.major, p.minor, p.multiProcessorCount);
  return 0;
}

/* ------------------------------------------------------------------ */
/* (3) 同じ計算を CPU (OpenBLAS cblas_dgemm) で行う比較用              */
/*     OpenBLAS64 (ILP64) の cblas_dgemm: 整数引数は 64bit             */
/* ------------------------------------------------------------------ */
extern "C" void cblas_dgemm(int layout, int ta, int tb, long m, long n, long k, double alpha,
                            const double *A, long lda, const double *B, long ldb,
                            double beta, double *C, long ldc);
enum { RowMajor = 101, NoTrans = 111, Trans = 112 };

struct CpuMlp {
  int nl = 0, maxb = 0;
  std::vector<int> dim;
  std::vector<std::vector<double>> W, b, u, z, d;
  std::vector<double> ones, X;
  std::vector<int> L;
  long N = 0;
};
static CpuMlp *gc = 0;

extern "C" long cpumlp_create(long nl, const long *dims, long maxb)
{
  delete gc; gc = new CpuMlp();
  gc->nl = nl; gc->maxb = maxb;
  for (int i = 0; i <= nl; i++) gc->dim.push_back((int)dims[i]);
  gc->W.resize(nl); gc->b.resize(nl); gc->u.resize(nl); gc->z.resize(nl); gc->d.resize(nl);
  for (int l = 0; l < nl; l++) {
    int in = gc->dim[l], out = gc->dim[l + 1];
    gc->W[l].resize((long)out * in); gc->b[l].resize(out);
    gc->u[l].resize((long)maxb * out); gc->z[l].resize((long)maxb * out); gc->d[l].resize((long)maxb * out);
  }
  gc->ones.assign(maxb, 1.0);
  return 0;
}
extern "C" long cpumlp_set_layer(long l, const double *W, const double *b)
{
  memcpy(gc->W[l].data(), W, sizeof(double) * gc->W[l].size());
  memcpy(gc->b[l].data(), b, sizeof(double) * gc->b[l].size());
  return 0;
}
extern "C" long cpumlp_get_layer(long l, double *W, double *b)
{
  memcpy(W, gc->W[l].data(), sizeof(double) * gc->W[l].size());
  memcpy(b, gc->b[l].data(), sizeof(double) * gc->b[l].size());
  return 0;
}
extern "C" long cpumlp_upload(const double *X, const double *lab, long n)
{
  gc->X.assign(X, X + n * gc->dim[0]);
  gc->L.resize(n);
  for (long i = 0; i < n; i++) gc->L[i] = (int)lrint(lab[i]);
  gc->N = n;
  return 0;
}
extern "C" double cpumlp_train_batch(long start, long B, double lr)
{
  CpuMlp *m = gc;
  int nl = m->nl;
  const double *x = m->X.data() + start * m->dim[0];
  const int *lab = m->L.data() + start;
  const double *in = x;
  double loss = 0.0;
  for (int l = 0; l < nl; l++) {
    int ni = m->dim[l], no = m->dim[l + 1];
    double *u = m->u[l].data(), *z = m->z[l].data(), *b = m->b[l].data();
    cblas_dgemm(RowMajor, NoTrans, Trans, B, no, ni, 1.0, in, ni, m->W[l].data(), ni, 0.0, u, no);
    if (l < nl - 1) {
      for (long i = 0; i < (long)B * no; i++) { double v = u[i] + b[i % no]; u[i] = v; z[i] = v >= 0 ? v : 0; }
    } else {
      for (int r = 0; r < B; r++) {
        double *ur = u + (long)r * no, *yr = z + (long)r * no, mx, s = 0;
        for (int j = 0; j < no; j++) ur[j] += b[j];
        mx = ur[0];
        for (int j = 1; j < no; j++) if (ur[j] > mx) mx = ur[j];
        for (int j = 0; j < no; j++) { yr[j] = exp(ur[j] - mx); s += yr[j]; }
        for (int j = 0; j < no; j++) yr[j] /= s;
        loss += -log(yr[lab[r]]);
      }
    }
    in = z;
  }
  int no = m->dim[nl];
  double *y = m->z[nl - 1].data(), *dl = m->d[nl - 1].data();
  for (long i = 0; i < (long)B * no; i++) dl[i] = y[i] - ((i % no) == lab[i / no] ? 1.0 : 0.0);
  for (int l = nl - 2; l >= 0; l--) {
    int o = m->dim[l + 1], o2 = m->dim[l + 2];
    double *d = m->d[l].data(), *u = m->u[l].data();
    cblas_dgemm(RowMajor, NoTrans, NoTrans, B, o, o2, 1.0, m->d[l + 1].data(), o2, m->W[l + 1].data(), o, 0.0, d, o);
    for (long i = 0; i < (long)B * o; i++) if (!(u[i] >= 0)) d[i] = 0;
  }
  for (int l = 0; l < nl; l++) {
    int ni = m->dim[l], o = m->dim[l + 1];
    const double *zp = l == 0 ? x : m->z[l - 1].data();
    cblas_dgemm(RowMajor, Trans, NoTrans, o, ni, B, -lr, m->d[l].data(), o, zp, ni, 1.0, m->W[l].data(), ni);
    cblas_dgemm(RowMajor, NoTrans, NoTrans, 1, o, B, -lr, m->ones.data(), B, m->d[l].data(), o, 1.0, m->b[l].data(), o);
  }
  return loss / B;
}
extern "C" double cpumlp_train_epoch(long B, double lr)
{
  long nb = gc->N / B;
  double loss = 0.0, n = 0.0;
  for (long i = 0; i < nb; i++) {
    double l = cpumlp_train_batch(i * B, B, lr);
    double ratio = n / (n + B);
    loss = ratio * loss + (1.0 - ratio) * l;
    n += B;
  }
  return loss;
}
