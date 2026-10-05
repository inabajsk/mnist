/*
 * cpucnn.h : CUDA/src/cudacnn.cu の CPU 経路を Apple の Accelerate (cblas) + GCD に移植したもの.
 *            Mac (コマンドライン) と iPhone (アプリ) で同じコードを動かして時間を比べる.
 *
 *  spec = [H W C nlayer  type a b  type a b ...]   (cudacnn.cu と同じ)
 *    type 1 FC (a = 出力数)  2 CONV (a = k, b = 出力ch)  3 POOL 2x2  4 RELU
 */
#ifndef CPUCNN_H
#define CPUCNN_H
#include <stdint.h>
#ifdef __cplusplus
extern "C" {
#endif

/* prec: 32 / 64.  threads: 0 = すべてのコア (GCD + Accelerate 任せ), 1 = 1 スレッド,
   2 = 1 スレッドの素朴なループ (Accelerate を使わない. SIMD・行列演算の機能なしの比較用) */
long ccnn_create(const long *spec, long maxb, long prec, long threads);
void ccnn_free(void);
long ccnn_nlayers(void);
/* 層 l の重みの要素数 (出力 x K). 重みのない層は 0 */
long ccnn_wsize(long l);
long ccnn_bsize(long l);
long ccnn_set_param(long l, const float *W, const float *b);
/* slot 0: 学習データ, 1: テストデータ.  X: N x (H*W*C) (0〜1), lab: 0〜9 */
long ccnn_upload(long slot, const float *X, const uint8_t *lab, long N);
/* 1 エポック (slot 0 を先頭から B 枚ずつ). 平均損失を返す */
double ccnn_train_epoch(long B, double lr);
/* slot のデータを B 枚ずつ推論して正解数を返す */
long ccnn_eval(long slot, long B, double *loss_out);
/* 層ごとの時間計測. on=1 で開始. out: [順伝播 x nl, 逆伝播 x nl] */
void ccnn_profile(long on);
long ccnn_get_profile(double *out);
/* 経過時間 [s] */
double ccnn_now(void);

#ifdef __cplusplus
}
#endif
#endif
