/**
 * スネル則による屈折角を求める純粋関数。
 *
 * スカラー（角度のみ）の屈折プリミティブであり、幾何（convexSolid）にも
 * 波長（dispersion）にも依存しない。DOM / Three.js には一切触れない。
 * 呼び出し側が屈折率を引数で渡す。
 */

import { canTransmit } from './fresnel';

const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;

/**
 * スネル則から屈折角を求める。
 *
 * n_from · sin(θ₁) = n_to · sin(θ₂)  →  θ₂ = asin(n_from · sin(θ₁) / n_to)
 *
 * 全反射域では屈折角が存在しないため RangeError を投げる（NaN を返さない）。
 * 全反射の判定は fresnel.canTransmit に委譲する。canTransmit は
 * 「nFrom <= nTo なら常に透過、それ以外は θ₁ >= θc を全反射」という角度比較の規約であり、
 * これを唯一の判定元とすることで fresnel との境界を構造的に一致させる。
 *
 * 比 n_from·sin(θ₁)/n_to を 1 と比較する判定は使わない。臨界角ちょうどでこの比が
 * 1 を超えず（SF10 では 1 - 1.11e-16 になる）、canTransmit と境界がずれるため。
 *
 * @param nFrom 入射側媒質の屈折率（無次元）。1 以上の有限数
 * @param nTo 射出側媒質の屈折率（無次元）。1 以上の有限数
 * @param incidenceAngleDeg 界面法線から測った入射角 [deg]。0〜90 度
 * @returns 屈折角 [deg]（界面法線から測った角）
 * @throws {RangeError} 屈折率・入射角が定義域外、または全反射域の場合
 */
export function refractionAngleDeg(
  nFrom: number,
  nTo: number,
  incidenceAngleDeg: number
): number {
  // 引数の定義域検証も canTransmit が行う（屈折率・入射角ともに不正なら RangeError）
  if (!canTransmit(nFrom, nTo, incidenceAngleDeg)) {
    throw new RangeError(
      `全反射域のため屈折角が存在しません（nFrom: ${nFrom}, nTo: ${nTo}, ` +
        `入射角: ${incidenceAngleDeg}°）`
    );
  }

  const sinRefraction = (nFrom * Math.sin(incidenceAngleDeg * RAD_PER_DEG)) / nTo;

  // 透過が確定した後なので比は 1 以下。臨界角の直下では丸めで 1 をわずかに超えうるため、
  // asin が NaN を返さないよう 1 で頭打ちにする（この場合の屈折角は 90° が正しい）
  return Math.asin(Math.min(sinRefraction, 1)) * DEG_PER_RAD;
}
