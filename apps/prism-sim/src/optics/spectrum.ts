/**
 * 波長のサンプリングと、波長 → RGB の変換。
 *
 * DOM / Three.js には依存しない純粋関数のみ（`THREE.Color` への変換は scene 層の責務）。
 * 色の近似は Bruton の区分線形式を用いる。測色的な正確さは目標としない
 * （SPEC.md「波長サンプリングと色」）。
 */

import type { Rgb } from '../types/optics';

import { WAVELENGTH_MAX_NM, WAVELENGTH_MIN_NM } from './constants';

/** 等間隔サンプリングに必要な最小の点数。両端の 2 点が無いと間隔が定義できない。 */
const MIN_SAMPLE_COUNT = 2;

/** Bruton の近似が色を定義する下限 [nm]。これ未満は黒。 */
const COLOR_MIN_NM = 380;

/** Bruton の近似が色を定義する上限 [nm]。これを超えると黒。 */
const COLOR_MAX_NM = 780;

/** 強度が減衰しはじめる短波長側の境界 [nm]。 */
const FADE_LOW_END_NM = 420;

/** 強度が減衰しはじめる長波長側の境界 [nm]。 */
const FADE_HIGH_START_NM = 700;

/** 可視域の端で残る最小の強度。Bruton の定義値。 */
const MIN_INTENSITY = 0.3;

/** 見かけの明るさを整えるためのガンマ。Bruton の定義値。 */
const DISPLAY_GAMMA = 0.8;

/**
 * 可視域を両端も含めて等間隔に分割した波長の並びを返す。
 *
 * i 番目の波長は `min + (max - min)·i/(count-1)` とする。加算の反復ではなく
 * 各点を独立に求めることで、丸め誤差が末尾に蓄積して上限からずれるのを防ぐ。
 *
 * **count は 2 以上の整数であること。それ以外（2 未満・非整数・NaN）は RangeError を投げる。**
 * 非整数を弾くのは、`Array.from({ length })` が長さを切り捨てるため、
 * 通してしまうと引数と食い違う本数を黙って返すことになるからである。
 *
 * @param count サンプル数。2 以上の整数
 * @returns 昇順に並んだ波長の並び [nm]
 * @throws {RangeError} count が 2 以上の整数でない場合
 */
export function sampleWavelengths(count: number): readonly number[] {
  if (!Number.isInteger(count) || count < MIN_SAMPLE_COUNT) {
    throw new RangeError(
      `サンプル数は ${MIN_SAMPLE_COUNT} 以上の整数である必要があります（受け取った値: ${count}）`
    );
  }

  const span = WAVELENGTH_MAX_NM - WAVELENGTH_MIN_NM;

  return Array.from(
    { length: count },
    (_unused, index) => WAVELENGTH_MIN_NM + (span * index) / (count - 1)
  );
}

/**
 * 波長を表示用の RGB へ変換する。
 *
 * Bruton の区分線形近似（SPEC.md「波長サンプリングと色」の区間表）で raw な RGB を求め、
 * 可視域の端では視感度に応じた強度係数を掛け、最後に γ = 0.8 を適用する。
 *
 * **[380, 780] の外（域外・NaN）は黒 (0,0,0) を返す。** 例外は投げない。
 * 加算ブレンドで描くため黒がそのまま不可視を意味し、任意の波長を渡せる呼び出し側の
 * 自由度を保てるからである。
 *
 * @param wavelengthNm 波長 [nm]
 * @returns 各成分 0〜1 の sRGB（表示参照）値。[380, 780] の外は黒
 */
export function wavelengthToRgb(wavelengthNm: number): Rgb {
  // 否定形で書くのは NaN を域外に含めるため（NaN < 380 は false になり、素直に
  // 書くと NaN が下の区間分岐へ流れてしまう）
  if (!(wavelengthNm >= COLOR_MIN_NM) || wavelengthNm > COLOR_MAX_NM) {
    return { r: 0, g: 0, b: 0 };
  }

  const [rawR, rawG, rawB] = rawComponents(wavelengthNm);
  const factor = intensityFactor(wavelengthNm);

  return {
    r: toDisplay(rawR, factor),
    g: toDisplay(rawG, factor),
    b: toDisplay(rawB, factor),
  };
}

/**
 * Bruton の区間表から強度を掛ける前の RGB を求める。
 *
 * 呼び出し側が定義域（380〜780nm）を保証する。
 *
 * @param wavelengthNm 波長 [nm]
 * @returns [R, G, B]（各成分 0〜1）
 */
function rawComponents(wavelengthNm: number): readonly [number, number, number] {
  if (wavelengthNm < 440) {
    return [-(wavelengthNm - 440) / 60, 0, 1];
  }

  if (wavelengthNm < 490) {
    return [0, (wavelengthNm - 440) / 50, 1];
  }

  if (wavelengthNm < 510) {
    return [0, 1, -(wavelengthNm - 510) / 20];
  }

  if (wavelengthNm < 580) {
    return [(wavelengthNm - 510) / 70, 1, 0];
  }

  if (wavelengthNm < 645) {
    return [1, -(wavelengthNm - 645) / 65, 0];
  }

  return [1, 0, 0];
}

/**
 * 可視域の端での強度減衰係数を求める。
 *
 * 端では視感度が落ちるため、単に色相を返すだけでは端の光が不自然に明るく見える。
 *
 * @param wavelengthNm 波長 [nm]
 * @returns 強度係数（0.3〜1）
 */
function intensityFactor(wavelengthNm: number): number {
  if (wavelengthNm < FADE_LOW_END_NM) {
    return (
      MIN_INTENSITY +
      ((1 - MIN_INTENSITY) * (wavelengthNm - COLOR_MIN_NM)) / (FADE_LOW_END_NM - COLOR_MIN_NM)
    );
  }

  if (wavelengthNm > FADE_HIGH_START_NM) {
    return (
      MIN_INTENSITY +
      ((1 - MIN_INTENSITY) * (COLOR_MAX_NM - wavelengthNm)) / (COLOR_MAX_NM - FADE_HIGH_START_NM)
    );
  }

  return 1;
}

/**
 * 成分に強度係数とガンマを適用し、表示値へ変換する。
 *
 * @param component 強度を掛ける前の成分（0〜1）
 * @param factor 強度係数
 * @returns 0〜1 に収めた表示値
 */
function toDisplay(component: number, factor: number): number {
  const scaled = component * factor;

  if (scaled <= 0) {
    return 0;
  }

  return Math.min(Math.pow(scaled, DISPLAY_GAMMA), 1);
}
