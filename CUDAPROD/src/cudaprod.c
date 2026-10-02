/*
 * cudaprod.c : MATPROD と同じ形式の EusLisp C 拡張モジュール (load-library で読む)
 *   CUDA の計算本体は ../CUDA/<ARCH>/libcudamlp.so (cudamlp.cu) を使い,
 *   ここでは Lisp オブジェクトの型・大きさの検査と変換だけを行う.
 *
 *   (cudaprod-dgemm a b c [alpha beta])      ; c = alpha a b + beta c   (cblas-dgemm と同じ)
 *   (cudaprod-mlp-create dims maxbatch prec) ; dims: integer-vector  (784 1000 1000 10)
 *   (cudaprod-mlp-set-layer i W b)  (cudaprod-mlp-get-layer i W b)
 *   (cudaprod-mlp-upload slot X labels)      ; X: N x 784 matrix, labels: float-vector
 *   (cudaprod-mlp-train-batch start B lr)    ; => 損失
 *   (cudaprod-mlp-train-epoch B lr)          ; => 平均損失
 *   (cudaprod-mlp-eval slot B)               ; => (正解数 平均損失)
 */
#include <math.h>
#include <eus.h>

#define ismatrix(p) ((isarray(p) && p->c.ary.rank==makeint(2) && elmtypeof(p->c.ary.entity)==ELM_FLOAT))
#define rowsize(p) (intval(p->c.ary.dim[0]))
#define colsize(p) (intval(p->c.ary.dim[1]))
#define matfv(p) (p->c.ary.entity->c.fvec.fv)

/* libcudamlp.so (C ABI) */
extern long cuda_dgemm_host(long m, long n, long k, double alpha, const double *A, const double *B, double beta, double *C);
extern long cmlp_create(long nl, const long *dims, long maxb, long prec);
extern long cmlp_set_layer(long l, const double *W, const double *b);
extern long cmlp_get_layer(long l, double *W, double *b);
extern long cmlp_upload(long slot, const double *X, const double *lab, long n);
extern double cmlp_train_batch(long start, long B, double lr);
extern double cmlp_train_epoch(long B, double lr);
extern long cmlp_eval(long slot, long B, double *loss_out, double *probs_out);
extern long cmlp_sync(void);

#pragma init (register_cudaprod)
extern pointer ___cudaprod();
static int register_cudaprod()
{ add_module_initializer("___cudaprod", ___cudaprod);
  return(0);
}

static double fltarg(pointer p)
{ numunion nu;
  if (isint(p)) return (double)intval(p);
  return fltval(p); }

pointer CUDADGEMM(register context *ctx, int n, register pointer *argv)
{ pointer a, b, c;
  double alpha = 1.0, beta = 1.0;
  ckarg2(3, 5);
  a = argv[0]; b = argv[1]; c = argv[2];
  if (!ismatrix(a) || !ismatrix(b) || !ismatrix(c)) error(E_NOVECTOR);
  if (colsize(a) != rowsize(b) || rowsize(a) != rowsize(c) || colsize(b) != colsize(c)) error(E_VECINDEX);
  if (n > 3) alpha = fltarg(argv[3]);
  if (n > 4) beta = fltarg(argv[4]);
  if (cuda_dgemm_host(rowsize(a), colsize(b), colsize(a), alpha, matfv(a), matfv(b), beta, matfv(c)))
    error(E_USER, (pointer)"cuda_dgemm_host failed");
  return c; }

pointer CUDAMLPCREATE(register context *ctx, int n, register pointer *argv)
{ pointer dims = argv[0];
  ckarg(3);
  if (!isintvector(dims)) error(E_NOVECTOR);
  if (cmlp_create(vecsize(dims) - 1, (long *)dims->c.ivec.iv, ckintval(argv[1]), ckintval(argv[2])))
    error(E_USER, (pointer)"cmlp_create failed");
  return T; }

pointer CUDAMLPSETLAYER(register context *ctx, int n, register pointer *argv)
{ ckarg(3);
  if (!ismatrix(argv[1]) || !isfltvector(argv[2])) error(E_NOVECTOR);
  if (cmlp_set_layer(ckintval(argv[0]), matfv(argv[1]), argv[2]->c.fvec.fv)) error(E_USER, (pointer)"cmlp_set_layer failed");
  return T; }

pointer CUDAMLPGETLAYER(register context *ctx, int n, register pointer *argv)
{ ckarg(3);
  if (!ismatrix(argv[1]) || !isfltvector(argv[2])) error(E_NOVECTOR);
  if (cmlp_get_layer(ckintval(argv[0]), matfv(argv[1]), argv[2]->c.fvec.fv)) error(E_USER, (pointer)"cmlp_get_layer failed");
  return argv[1]; }

pointer CUDAMLPUPLOAD(register context *ctx, int n, register pointer *argv)
{ ckarg(3);
  if (!ismatrix(argv[1]) || !isfltvector(argv[2])) error(E_NOVECTOR);
  if (rowsize(argv[1]) != vecsize(argv[2])) error(E_VECINDEX);
  if (cmlp_upload(ckintval(argv[0]), matfv(argv[1]), argv[2]->c.fvec.fv, rowsize(argv[1])))
    error(E_USER, (pointer)"cmlp_upload failed");
  return makeint(rowsize(argv[1])); }

pointer CUDAMLPTRAINBATCH(register context *ctx, int n, register pointer *argv)
{ double l;
  numunion nu;
  ckarg(3);
  l = cmlp_train_batch(ckintval(argv[0]), ckintval(argv[1]), fltarg(argv[2]));
  if (l < 0) error(E_USER, (pointer)"cmlp_train_batch failed");
  return makeflt(l); }

pointer CUDAMLPTRAINEPOCH(register context *ctx, int n, register pointer *argv)
{ double l;
  numunion nu;
  ckarg(2);
  l = cmlp_train_epoch(ckintval(argv[0]), fltarg(argv[1]));
  if (l < 0) error(E_USER, (pointer)"cmlp_train_epoch failed");
  cmlp_sync();
  return makeflt(l); }

pointer CUDAMLPEVAL(register context *ctx, int n, register pointer *argv)
{ double loss = 0.0;
  long c;
  pointer r;
  numunion nu;
  ckarg(2);
  c = cmlp_eval(ckintval(argv[0]), ckintval(argv[1]), &loss, 0);
  if (c < 0) error(E_USER, (pointer)"cmlp_eval failed");
  r = cons(ctx, makeflt(loss), NIL);
  vpush(r);
  r = cons(ctx, makeint(c), r);
  vpop();
  return r; }

pointer ___cudaprod(register context *ctx, int n, register pointer *argv)
{ pointer mod = argv[0];
  defun(ctx, "CUDAPROD-DGEMM", mod, CUDADGEMM, NULL);
  defun(ctx, "CUDAPROD-MLP-CREATE", mod, CUDAMLPCREATE, NULL);
  defun(ctx, "CUDAPROD-MLP-SET-LAYER", mod, CUDAMLPSETLAYER, NULL);
  defun(ctx, "CUDAPROD-MLP-GET-LAYER", mod, CUDAMLPGETLAYER, NULL);
  defun(ctx, "CUDAPROD-MLP-UPLOAD", mod, CUDAMLPUPLOAD, NULL);
  defun(ctx, "CUDAPROD-MLP-TRAIN-BATCH", mod, CUDAMLPTRAINBATCH, NULL);
  defun(ctx, "CUDAPROD-MLP-TRAIN-EPOCH", mod, CUDAMLPTRAINEPOCH, NULL);
  defun(ctx, "CUDAPROD-MLP-EVAL", mod, CUDAMLPEVAL, NULL);
  return NIL; }
