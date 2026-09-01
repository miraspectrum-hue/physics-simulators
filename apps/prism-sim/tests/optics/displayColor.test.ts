import { describe, expect, it } from 'vitest';

import { CONTINUOUS_SAMPLE_COUNT } from '../../src/optics/constants';
import { displayColorCss, displayColorForWavelength } from '../../src/optics/displayColor';
import { sampleWavelengths, wavelengthToRgb } from '../../src/optics/spectrum';

/**
 * src/optics/displayColor.ts の受け入れ条件（波長 → 表示色。可読性パス 段階1）。
 *
 * 対象:
 *   displayColorForWavelength(nm) — 線形作業色空間の [r, g, b]
 *
 * 何を守るためのテストか:
 *   段階0 の実測で、可視域の端が中央帯に対して極端に暗いことが分かった
 *   （基準色の Y で 380nm = 0.0343、ピーク 576.81nm = 0.9105。**3.77%**）。
 *   端の光線が「出ているのに見えない」状態なので、暗部だけを持ち上げる。
 *
 *   ただし **20% 一律は数学的に不能**である。色相を厳密に保つ限り、飽和した藍青は
 *   sRGB の色域天井に張り付く。Rec.709 で純青の輝度は 0.0722 が絶対の上限で、
 *   435.11nm の基準色 `[34,0,255]` は青成分が既に 1.0 なので 1 ルーメンも上げられない。
 *   全 48 波長が色相を保ったまま満たせる最大のフロアは **0.075658（ピークの 8.31%）**。
 *
 *   採るのは**色相の厳密保持**である（製品決定）。測光量 Y は飽和青の見えを構造的に
 *   過小評価する（Helmholtz-Kohlrausch 効果：等輝度なら彩度が高いほど明るく見える）ため、
 *   「青の Y ≥ 20%」は間違った計器の読みになる。それを満たすために白を混ぜて彩度を壊すと、
 *   七色の純度＝虹そのものの identity を失う。青は暗いまま純度を保つ。
 *
 *   ここで釘打ちするのは持ち上げ方の**性質**である。
 *     - 色域に余地のある波長は 20% フロアに乗る（test1a）
 *     - どの波長も色域正直なフロアを下回らず、色相保持の上限も超えない（test1b）
 *     - ピークは動かない（明るい側を明るくしない＝白飛びを増やさない）
 *     - 単調な変換なので、谷の位置が増えず、既存の谷も深くならない
 *     - 色相は動かない（輝度だけを一様倍する）
 *   ハードクランプ（下端を同値へ潰す）は 3 番目と 1 番目を同時に壊すので、
 *   この 4 つが揃っていれば「端がのっぺりした帯」にはならない。
 *
 * 期待値の出典:
 *   既存の `wavelengthToRgb`（1-4 でテスト済み）を sRGB → 線形へ直して
 *   Rec.709 加重した値。SUT の出力からは作らない。
 */

/** 線形化。three の `SRGBToLinear` と同じ閾値 0.04045 を使う（描画層と揃える）。 */
function srgbToLinear(component: number): number {
  return component <= 0.04045 ? component / 12.92 : ((component + 0.055) / 1.055) ** 2.4;
}

/** Rec.709 の相対輝度。**線形値に対して**適用する。 */
function luminance(rgb: readonly [number, number, number]): number {
  return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
}

/** 持ち上げる前の色（既存の波長 → sRGB を線形へ直したもの）。 */
function originalLinear(wavelengthNm: number): readonly [number, number, number] {
  const rgb = wavelengthToRgb(wavelengthNm);

  return [srgbToLinear(rgb.r), srgbToLinear(rgb.g), srgbToLinear(rgb.b)];
}

/** 実際に描く 48 本の波長。 */
const WAVELENGTHS = sampleWavelengths(CONTINUOUS_SAMPLE_COUNT);

/**
 * 持ち上げる前の中央帯ピーク（576.81nm）の相対輝度。
 * 倍精度で評価した実測値をハードコードする。
 */
const ORIGINAL_PEAK_Y = 0.9105065911786071;

/** 持ち上げる前の最小（380nm）の相対輝度。 */
const ORIGINAL_MIN_Y = 0.03428632770107852;

/** 20% フロア。中央帯ピークの 20%（= 0.18210131823572143）。 */
const FLOOR_Y = 0.2 * ORIGINAL_PEAK_Y;

/**
 * 色域正直なフロア。全 48 波長が**色相を保ったまま**満たせる最大値。
 * 435.11nm（基準色 `[34,0,255]`）の色相保持上限そのもの。
 */
const ACHIEVABLE_FLOOR_Y = 0.07565783573903248;

/**
 * その波長が色相を保ったまま到達できる輝度の上限。
 *
 * RGB を一様倍しても比は変わらないので、最大成分が 1 になるまで伸ばした時の Y が上限。
 * 一様倍では Y も同じ倍率で動くため `Y / 最大成分` で求まる。
 */
function hueLockedCeiling(wavelengthNm: number): number {
  const linear = originalLinear(wavelengthNm);
  const maxComponent = Math.max(linear[0], linear[1], linear[2]);

  return maxComponent <= 0 ? 0 : luminance(linear) / maxComponent;
}

/** 局所極小になっている添字を返す（両隣より低い点）。 */
function valleyIndices(series: readonly number[]): number[] {
  const found: number[] = [];

  for (let index = 1; index < series.length - 1; index += 1) {
    const value = series[index] as number;

    if (value < (series[index - 1] as number) && value < (series[index + 1] as number)) {
      found.push(index);
    }
  }

  return found;
}

/** 谷の相対的な深さ。1 に近いほど深い。 */
function valleyDepth(series: readonly number[], index: number): number {
  const shallower = Math.min(series[index - 1] as number, series[index + 1] as number);

  return 1 - (series[index] as number) / shallower;
}

describe('可読性パス: displayColorForWavelength の輝度フロア', () => {
  it('色域に余地のある波長は中央帯ピークの 20% 以上まで持ち上がる', () => {
    // Arrange: 色相を保ったまま 20% に届きうる波長だけを対象にする。
    //          380nm は上限 0.2848 に対し元が 0.0343 しかない＝持ち上げないと通らない
    const withHeadroom = WAVELENGTHS.filter((nm) => hueLockedCeiling(nm) >= FLOOR_Y);

    expect(withHeadroom).toHaveLength(41);
    expect(withHeadroom).toContain(380);
    expect(ORIGINAL_MIN_Y).toBeLessThan(FLOOR_Y);

    // Act
    const luminances = withHeadroom.map((nm) => luminance(displayColorForWavelength(nm)));

    // Assert: 0.2 × 0.9105065911786071 = 0.18210131823572143
    for (const [index, value] of luminances.entries()) {
      expect(value, `${String(withHeadroom[index])}nm`).toBeGreaterThanOrEqual(
        0.18210131823572143
      );
    }
  });

  it('全波長が色域正直なフロアに乗り、色相保持の上限を超えない', () => {
    // Arrange: 上限に張り付く藍青が 7 本あり、その最小が達成可能フロアそのもの
    const stuck = WAVELENGTHS.filter((nm) => hueLockedCeiling(nm) < FLOOR_Y);

    expect(stuck).toHaveLength(7);
    expect(Math.min(...WAVELENGTHS.map(hueLockedCeiling))).toBeCloseTo(ACHIEVABLE_FLOOR_Y, 12);

    // Act
    const luminances = WAVELENGTHS.map((nm) => luminance(displayColorForWavelength(nm)));

    // Assert
    for (const [index, value] of luminances.entries()) {
      const nm = WAVELENGTHS[index] as number;

      expect(value, `${String(nm)}nm が色域正直なフロアを下回る`).toBeGreaterThanOrEqual(
        0.07565783573903248
      );
      expect(value, `${String(nm)}nm が色相保持の上限を超える`).toBeLessThanOrEqual(
        hueLockedCeiling(nm) + 1e-12
      );
    }
  });

  it('中央帯ピークの輝度は持ち上げる前と変わらない', () => {
    // Arrange: 持ち上げる前に最大だった波長（576.81nm）
    const peakNm = WAVELENGTHS.reduce((best, nm) =>
      luminance(originalLinear(nm)) > luminance(originalLinear(best)) ? nm : best
    );

    // Act
    const luminances = WAVELENGTHS.map((nm) => luminance(displayColorForWavelength(nm)));
    const peakY = luminance(displayColorForWavelength(peakNm));

    // Assert: ピークの値そのものも、系列の最大も動かない
    expect(peakY).toBeCloseTo(ORIGINAL_PEAK_Y, 9);
    expect(Math.max(...luminances)).toBeCloseTo(ORIGINAL_PEAK_Y, 9);
  });

  it('谷を新しく作らず、既存の谷を深くもしない', () => {
    // Arrange: 持ち上げる前の谷は 435.11nm と 513.83nm の 2 つ（実測）
    const before = WAVELENGTHS.map((nm) => luminance(originalLinear(nm)));
    const beforeValleys = valleyIndices(before);

    expect(beforeValleys).toEqual([7, 17]);

    // Act
    const after = WAVELENGTHS.map((nm) => luminance(displayColorForWavelength(nm)));
    const afterValleys = valleyIndices(after);

    // Assert: 谷の位置は増えず、深さも増えない
    for (const index of afterValleys) {
      expect(beforeValleys, `新しい谷が ${String(WAVELENGTHS[index])}nm にできている`).toContain(
        index
      );
    }

    for (const index of afterValleys) {
      expect(
        valleyDepth(after, index),
        `${String(WAVELENGTHS[index])}nm の谷が深くなっている`
      ).toBeLessThanOrEqual(valleyDepth(before, index) + 1e-12);
    }
  });

  it('色相は変えず、RGB の比を保ったまま輝度だけを倍する', () => {
    // Arrange & Act & Assert
    for (const nm of WAVELENGTHS) {
      const before = originalLinear(nm);
      const after = displayColorForWavelength(nm);

      // 比の保存を外積で独立に検算する（SUT の出力から期待値を作らない）
      expect(before[0] * after[1] - before[1] * after[0], `${String(nm)}nm の R:G`).toBeCloseTo(
        0,
        9
      );
      expect(before[1] * after[2] - before[2] * after[1], `${String(nm)}nm の G:B`).toBeCloseTo(
        0,
        9
      );
      expect(before[2] * after[0] - before[0] * after[2], `${String(nm)}nm の B:R`).toBeCloseTo(
        0,
        9
      );
    }
  });

  it('CSS 文字列は線形の出力と同じ色を指す', () => {
    // Arrange: 3D（線形）と SVG（sRGB）で違う色になる余地を残さないことの検査。
    //          8bit 量子化ぶんの差だけが許される
    const tolerance = 1 / 255;

    // Act & Assert
    for (const nm of WAVELENGTHS) {
      const css = displayColorCss(nm);
      const parsed = /^rgb\((\d+), (\d+), (\d+)\)$/.exec(css);

      expect(parsed, `${String(nm)}nm の書式: ${css}`).not.toBeNull();

      const roundTripped = (parsed as RegExpExecArray)
        .slice(1)
        .map((value) => srgbToLinear(Number(value) / 255));
      const direct = displayColorForWavelength(nm);

      for (let index = 0; index < 3; index += 1) {
        expect(roundTripped[index] as number, `${String(nm)}nm の成分 ${String(index)}`).toBeCloseTo(
          direct[index] as number,
          2
        );
      }

      expect(
        Math.abs(luminance(roundTripped as [number, number, number]) - luminance(direct)),
        `${String(nm)}nm の輝度`
      ).toBeLessThan(tolerance);
    }
  });

  it('可視域外は黒の CSS を返す', () => {
    // Arrange: `wavelengthToRgb` が黒を返す領域（1-4 でテスト済みの規約）に従う

    // Act & Assert
    for (const nm of [379, 781, Number.NaN]) {
      expect(displayColorCss(nm), `${String(nm)}nm`).toBe('rgb(0, 0, 0)');
    }
  });

  it('可視域の端でも有限で 0〜1 に収まる', () => {
    // Arrange
    const edges = [380, 750];

    // Act & Assert
    for (const nm of edges) {
      const rgb = displayColorForWavelength(nm);

      expect(rgb).toHaveLength(3);

      for (const component of rgb) {
        expect(Number.isFinite(component), `${String(nm)}nm の成分が有限でない`).toBe(true);
        expect(component).toBeGreaterThanOrEqual(0);
        expect(component).toBeLessThanOrEqual(1);
      }
    }
  });
});
