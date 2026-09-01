/**
 * 波長依存の屈折率（分散）を求める純粋関数群。
 *
 * DOM / Three.js には一切依存しない（CLAUDE.md の分離規約）。
 * 可視域（WAVELENGTH_MIN/MAX_NM）の検証はここでは行わず、上位層
 * （spectrum.ts や呼び出し側）の責務とする。
 */

import type { PrismMaterial } from '../types/optics';

/** nm → µm 変換の除数。Cauchy 式は λ を µm で扱うため必要。 */
const NM_PER_UM = 1000;

/**
 * Cauchy の分散式から屈折率を求める。
 *
 * n(λ) = A + B / λ²（λ は µm）
 *
 * 引数は nm で受け取り、関数内で µm へ変換する。材質定数 B の単位が µm² であるため、
 * この変換を省くと屈折率が桁違いの値になる。
 *
 * @param material 材質定数（Cauchy 係数 A, B を含む）
 * @param wavelengthNm 波長 [nm]。正の有限数であること
 * @returns 屈折率（無次元）
 * @throws {RangeError} wavelengthNm が正の有限数でない場合
 */
export function refractiveIndex(material: PrismMaterial, wavelengthNm: number): number {
  if (!Number.isFinite(wavelengthNm) || wavelengthNm <= 0) {
    throw new RangeError(
      `波長は正の有限数である必要があります（受け取った値: ${wavelengthNm}）`
    );
  }

  const wavelengthUm = wavelengthNm / NM_PER_UM;

  return material.cauchyA + material.cauchyB / (wavelengthUm * wavelengthUm);
}

/**
 * 分散を教育用に誇張した屈折率を求める（SPEC.md「分散誇張（F-23）」）。
 *
 * n'(λ) = n_d + factor × (n(λ) - n_d)
 *
 * カタログ n_d をピボットとして、そこからの隔たりを factor 倍する。
 * factor=1 で厳密に n(λ) と一致する（物理的に正しい値）ため、丸めを混入させないよう
 * factor=1 は nLambda をそのまま返す。factor>1 では分散が拡大し、赤と紫の屈折率差は
 * ちょうど factor 倍になる（ピボットが相殺するため差は n_d に依らない）。
 *
 * 実在ガラスは factor を負や 0 にする意味を持たない。誇張倍率は 1 以上であること
 * （SPEC の m∈[1,10]。上限 10 は UI スライダーの制約で、本関数は 1 以上の有限数を受け付ける）。
 *
 * @param nLambda 波長 λ での実屈折率 n(λ)（無次元）
 * @param nD カタログ屈折率 n_d（無次元）。誇張のピボット
 * @param factor 誇張倍率 m。1 以上の有限数
 * @returns 誇張後の屈折率（無次元）
 * @throws {RangeError} factor が 1 以上の有限数でない場合
 */
export function exaggerateIndex(nLambda: number, nD: number, factor: number): number {
  if (!Number.isFinite(factor) || factor < 1) {
    throw new RangeError(
      `誇張倍率は 1 以上の有限数である必要があります（受け取った値: ${factor}）`
    );
  }

  // factor=1 は物理そのもの。nD + 1·(nLambda - nD) は丸めで nLambda から 1 ULP ずれ得るため、
  // 実屈折率と厳密一致させるよう nLambda をそのまま返す
  if (factor === 1) {
    return nLambda;
  }

  return nD + factor * (nLambda - nD);
}
