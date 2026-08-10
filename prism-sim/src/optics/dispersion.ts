/**
 * 波長依存の屈折率（分散）を求める純粋関数群。
 *
 * DOM / Three.js には一切依存しない（CLAUDE.md の分離規約）。
 * 可視域（WAVELENGTH_MIN/MAX_NM）の検証はここでは行わず、上位層
 * （spectrum.ts や呼び出し側）の責務とする。
 */

import type { PrismMaterial } from './constants';

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
