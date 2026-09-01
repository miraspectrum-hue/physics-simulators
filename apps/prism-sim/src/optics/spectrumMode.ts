import type { SpectrumMode } from '../types/optics';

import { CONTINUOUS_SAMPLE_COUNT, SEVEN_COLOR_WAVELENGTHS_NM } from './constants';
import { sampleWavelengths } from './spectrum';

/**
 * 表示モード → 描画に使う波長の並び（SPEC.md「F-24」・TASKS 4-3）。
 * DOM にも Three にも触らない純粋関数。
 *
 * 4-3 で切り替わるのは**波長サンプル列だけ**である。レンダラの種別は変わらず、
 * 両モードとも同じ `LightPath[]` パイプラインを通る。だからモード切替の分岐は
 * この 1 か所に閉じ、下流は「渡された波長列を描く」ままでいられる。
 *
 * **7 色は連続 48 の部分集合ではない。** 660/610/580/510/480/450/410 は等間隔
 * サンプルの格子に乗らない独立した代表値なので、切替は間引きではなく差し替えになる。
 */

/**
 * モードに対応する波長の並びを返す。
 *
 * @param mode 表示モード
 * @returns 波長の並び [nm]。連続は昇順 48 本、7 色は降順 7 本
 */
export function wavelengthsForMode(mode: SpectrumMode): readonly number[] {
  return mode === 'sevenColor'
    ? SEVEN_COLOR_WAVELENGTHS_NM
    : sampleWavelengths(CONTINUOUS_SAMPLE_COUNT);
}
