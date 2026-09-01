import { describe, expect, it } from 'vitest';

import { wavelengthsForMode } from '../../src/optics/spectrumMode';

/**
 * src/optics/spectrumMode.ts の受け入れ条件（TASKS 4-3 段階1・スライスA）。
 *
 * 対象:
 *   wavelengthsForMode(mode) — 表示モード → 描画に使う波長の並び [nm]
 *
 * 何を守るためのテストか:
 *   4-3 で切り替わるのは**波長サンプル列だけ**である（レンダラの種別は変わらない）。
 *   その唯一の分岐点をここへ閉じ込め、モード → 波長列の写像を固定する。
 *
 *   7 色は連続 48 の**部分集合ではない**。660/610/580/510/480/450/410 は等間隔
 *   サンプルの格子に乗らない独立した代表値なので、「48 本から間引く」実装に
 *   なっていないことをここで縛る。
 *
 * 期待値の出典:
 *   SPEC.md「波長サンプリングと色」——
 *     可視域 380〜750nm / 連続モード 48 サンプル（両端を含む等間隔） /
 *     7 色モード 660 / 610 / 580 / 510 / 480 / 450 / 410 nm（赤・橙・黄・緑・青・藍・紫）。
 *   SUT の出力からは作らず、SPEC の数値をそのまま書き下す。
 */

/** SPEC の 7 色。**降順（赤 → 紫）**であることまで含めて期待値である。 */
const SEVEN_COLORS_NM = [660, 610, 580, 510, 480, 450, 410];

/** SPEC の可視域 [nm]。 */
const VISIBLE_MIN_NM = 380;
const VISIBLE_MAX_NM = 750;

describe('4-3: wavelengthsForMode のモード → 波長列', () => {
  it('連続モードは 48 本で、両端に可視域の上下限を含む', () => {
    // Arrange

    // Act
    const actual = wavelengthsForMode('continuous');

    // Assert
    expect(actual).toHaveLength(48);
    expect(actual[0]).toBe(VISIBLE_MIN_NM);
    expect(actual[47]).toBe(VISIBLE_MAX_NM);
  });

  it('7 色モードは SPEC の 7 波長と厳密に一致する', () => {
    // Arrange: 順序も期待値のうち。降順（赤 → 紫）で描画順と対応する

    // Act
    const actual = wavelengthsForMode('sevenColor');

    // Assert
    expect(actual).toEqual(SEVEN_COLORS_NM);
  });

  it('どちらのモードも可視域内の有限な値だけを返す', () => {
    // Arrange

    // Act
    const modes = [wavelengthsForMode('continuous'), wavelengthsForMode('sevenColor')];

    // Assert
    for (const wavelengths of modes) {
      for (const wavelengthNm of wavelengths) {
        expect(Number.isFinite(wavelengthNm)).toBe(true);
        expect(wavelengthNm).toBeGreaterThanOrEqual(VISIBLE_MIN_NM);
        expect(wavelengthNm).toBeLessThanOrEqual(VISIBLE_MAX_NM);
      }
    }
  });

  it('2 つのモードは本数も値も一致しない', () => {
    // Arrange: モードを無視して片方だけ返す実装は、上の 3 件だけでは
    //          「連続を返す」「7 色を返す」のどちらかで半分通ってしまう。
    //          ここが空虚さの見張りになる

    // Act
    const continuous = wavelengthsForMode('continuous');
    const sevenColor = wavelengthsForMode('sevenColor');

    // Assert
    expect(continuous).not.toHaveLength(sevenColor.length);
    expect(continuous).not.toEqual(sevenColor);
    // 7 色は連続サンプルの部分集合でもない（間引き実装への見張り）
    expect(sevenColor.every((wavelengthNm) => continuous.includes(wavelengthNm))).toBe(false);
  });
});
