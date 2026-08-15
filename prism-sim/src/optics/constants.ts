/**
 * 光学計算に用いる定数（データのみ／計算ロジックを含まない）。
 *
 * 値はすべて SPEC.md「光学モデル（計算仕様）> 屈折率」の確定表からの転記。
 * 変更する場合は SPEC.md 側と必ず同時に更新し、n_d とアッベ数の検算を通すこと。
 */

import type { PrismMaterial } from '../types/optics';

// ---------------------------------------------------------------------------
// 基準スペクトル線
// ---------------------------------------------------------------------------

/**
 * ヘリウム d 線 [nm]。n_d とアッベ数 v_d の定義波長。
 * ナトリウム D 線 589.3nm とは別物なので混同しないこと。
 */
export const LINE_D_NM = 587.56;

/** 水素 F 線 [nm]。アッベ数の算出に用いる。 */
export const LINE_F_NM = 486.13;

/** 水素 C 線 [nm]。アッベ数の算出に用いる。 */
export const LINE_C_NM = 656.27;

// ---------------------------------------------------------------------------
// 可視域・プリズム形状
// ---------------------------------------------------------------------------

/** 可視域の下限 [nm] */
export const WAVELENGTH_MIN_NM = 380;

/** 可視域の上限 [nm] */
export const WAVELENGTH_MAX_NM = 750;

/** プリズムの頂角 [deg]。正三角形なので 60。 */
export const APEX_ANGLE_DEG = 60;

/** 光路追跡の最大反射・屈折回数 */
export const MAX_BOUNCE_COUNT = 6;

/**
 * 射出後の光路を延長して打ち切る長さ [プリズムと同じ長さ単位]。
 * SPEC.md「光路計算」4 の既定値 40。プリズムと交差しなかった光線にも同じ長さを用いる。
 */
export const EXIT_EXTENSION_LENGTH = 40;

// ---------------------------------------------------------------------------
// 材質定数
// ---------------------------------------------------------------------------
//
// Cauchy 係数の決定手順（SPEC.md より）:
//   1. B は各材質のアッベ数 v_d が実測値と一致するよう決める
//      B = ((n_d - 1) / v_d) / (1/λ_F² - 1/λ_C²)
//   2. A は n(λ_d) がカタログ n_d と一致するよう逆算する
//      A = n_d - B / λ_d²
//
// 出典（カタログ値）:
//   BK7        : SCHOTT N-BK7 データシート           n_d = 1.51680, v_d = 64.17
//   SF10       : SCHOTT SF10 データシート            n_d = 1.72828, v_d = 28.41
//   水（20°C） : Daimon & Masumura, Appl. Opt. 46 (2007)  n_d = 1.33340, v_d = 55.7
//   ダイヤモンド: Phillip & Taft (1964)               n_d = 2.41730, v_d = 55.3
//
// 上記 Cauchy 係数は Sellmeier 式による独立計算で裏取り済み
// （n_d 差 ≤ 0.0004 / アッベ数 差 ≤ 0.12）。

/** BK7（ホウケイ酸クラウンガラス）。既定材質。 */
export const BK7: PrismMaterial = {
  name: 'BK7',
  cauchyA: 1.5046,
  cauchyB: 0.004200,
  catalogNd: 1.51680,
  catalogAbbe: 64.17,
};

/** SF10（重フリントガラス）。4 材質中で分散が最大。 */
export const SF10: PrismMaterial = {
  name: 'SF10',
  cauchyA: 1.6894,
  cauchyB: 0.013420,
  catalogNd: 1.72828,
  catalogAbbe: 28.41,
};

/** 水（20°C）。4 材質中で分散が最小。 */
export const WATER: PrismMaterial = {
  name: '水',
  cauchyA: 1.3243,
  cauchyB: 0.003134,
  catalogNd: 1.33340,
  catalogAbbe: 55.7,
};

/**
 * ダイヤモンド。
 * 頂角 60° のプリズムでは `A < 2·θc` を満たさず常に全反射するため、
 * 全反射のデモンストレーション専用（SPEC.md 参照）。
 */
export const DIAMOND: PrismMaterial = {
  name: 'ダイヤモンド',
  cauchyA: 2.3784,
  cauchyB: 0.013420,
  catalogNd: 2.41730,
  catalogAbbe: 55.3,
};

/** UI の材質セレクトに並べる順（分散の小さい順ではなく既定→分散大→分散小→デモ用）。 */
export const ALL_MATERIALS: readonly PrismMaterial[] = [BK7, SF10, WATER, DIAMOND];
