import { describe, expect, it } from 'vitest';

import {
  CONTINUOUS_SAMPLE_COUNT,
  SEVEN_COLOR_WAVELENGTHS_NM,
  WAVELENGTH_MAX_NM,
  WAVELENGTH_MIN_NM,
} from '../../src/optics/constants';
import { sampleWavelengths, wavelengthToRgb } from '../../src/optics/spectrum';
import type { Rgb } from '../../src/types/optics';

/**
 * src/optics/spectrum.ts の受け入れ条件。
 *
 * 対象:
 *   - wavelengthToRgb(λ)      : Bruton の近似による波長 → sRGB（表示参照・0〜1）
 *   - sampleWavelengths(count): 可視域を両端込みで等分した波長の並び
 *
 * 設計判断（SPEC.md「波長サンプリングと色」に対応）:
 *   - 測色的な正確さは目標としない。単色光は sRGB のガモット外であり、CIE 等色関数を
 *     用いてもガモットクランプという別の近似に帰着するため、根拠を明示できる
 *     区分線形近似（Bruton）を選ぶ。品質バーは「それと分かる七色」。
 *   - 出力は Three 非依存の素の数値。THREE.Color への変換は scene 層の責務。
 *   - 可視域外（380 未満・780 超）は黒を返す。加算ブレンドで不可視になるため、
 *     例外を投げずに済ませられる。
 *   - 可視域上限 750nm は Bruton の減衰域に入るため、赤端は暗い深紅になる（意図した挙動）。
 *
 * 期待値はすべて倍精度で確定した具体値をハードコードする。
 */

/** 色成分の許容差。期待値は 15 桁のハードコード。 */
const COLOR_TOLERANCE = 1e-9;

/** 波長の許容差 [nm]。等間隔性の検証に用いる。 */
const WAVELENGTH_TOLERANCE_NM = 1e-9;

/** 色成分を許容差つきで比較する。 */
function expectRgbToBeClose(actual: Rgb, expected: Rgb): void {
  expect(Math.abs(actual.r - expected.r)).toBeLessThanOrEqual(COLOR_TOLERANCE);
  expect(Math.abs(actual.g - expected.g)).toBeLessThanOrEqual(COLOR_TOLERANCE);
  expect(Math.abs(actual.b - expected.b)).toBeLessThanOrEqual(COLOR_TOLERANCE);
}

/** 添字アクセスが undefined になり得るため、存在を確かめてから返す。 */
function elementAt(items: readonly number[], index: number): number {
  const item = items[index];

  if (item === undefined) {
    throw new Error(`要素[${index}] が存在しません（長さ: ${items.length}）`);
  }

  return item;
}

// ---------------------------------------------------------------------------
// A. wavelengthToRgb: 検算表の既知値
// ---------------------------------------------------------------------------
//
// [波長, R, G, B, 説明] — 倍精度で確認した値。
// 700 / 546 / 436 は CIE RGB の原色波長。区間境界は Bruton の分岐が切り替わる点で、
// いずれかの成分がちょうど 0 か 1 になるため、分岐の実装ミスを最も鋭く検出する。

const COLOR_CASES: readonly [number, number, number, number, string][] = [
  [700, 1, 0, 0, '赤（減衰の始まり）'],
  [546, 0.587440072234084, 1, 0, '緑の原色（黄緑寄りに出る）'],
  [436, 0.114584795172499, 0, 1, '青の原色'],
  [380, 0.381677890961818, 0, 0.381677890961818, '紫端（強度係数 0.3）'],
  [750, 0.631099769313487, 0, 0, '可視域上限（強度係数 0.5625）'],
  [440, 0, 0, 1, '純青'],
  [490, 0, 1, 1, 'シアン'],
  [510, 0, 1, 0, '純緑'],
  [580, 1, 1, 0, '純黄'],
  [645, 1, 0, 0, '純赤'],
];

describe('A. wavelengthToRgb: 検算表の既知値と一致する', () => {
  it.each(COLOR_CASES)('%dnm が %s になる', (wavelengthNm, r, g, b) => {
    // Arrange & Act
    const actual = wavelengthToRgb(wavelengthNm);

    // Assert
    expectRgbToBeClose(actual, { r, g, b });
  });
});

// ---------------------------------------------------------------------------
// B. wavelengthToRgb: 可視域外
// ---------------------------------------------------------------------------

describe('B. wavelengthToRgb: 可視域外は黒を返す', () => {
  it.each([379.999, 780.001, 1000])('%dnm は黒 (0,0,0) になる', (wavelengthNm) => {
    // Arrange & Act
    const actual = wavelengthToRgb(wavelengthNm);

    // Assert
    expect(actual).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('NaN も黒 (0,0,0) になる（区間分岐へ流さない）', () => {
    // Arrange & Act
    const actual = wavelengthToRgb(Number.NaN);

    // Assert
    expect(actual).toEqual({ r: 0, g: 0, b: 0 });
  });
});

// ---------------------------------------------------------------------------
// C. wavelengthToRgb: 不変条件
// ---------------------------------------------------------------------------

describe('C. wavelengthToRgb: 定義域全体で不変条件を満たす', () => {
  it('全成分が常に 0〜1 に収まる', () => {
    // Arrange
    const outOfRange: number[] = [];

    // Act: 可視域外も含めて 370〜790nm を 0.5nm 刻みで走査する
    for (let wavelengthNm = 370; wavelengthNm <= 790; wavelengthNm += 0.5) {
      const { r, g, b } = wavelengthToRgb(wavelengthNm);
      outOfRange.push(...[r, g, b].filter((value) => !(value >= 0 && value <= 1)));
    }

    // Assert
    expect(outOfRange).toEqual([]);
  });

  it('区間の境界で不連続にならない', () => {
    // Arrange: Bruton の分岐が切り替わる波長。380 / 780 は可視域外との段差があるため除く
    const boundaries = [420, 440, 490, 510, 580, 645, 700];

    // Act: 境界の ±1e-9 での成分差の最大値
    const maxGap = Math.max(
      ...boundaries.map((boundary) => {
        const below = wavelengthToRgb(boundary - 1e-9);
        const above = wavelengthToRgb(boundary + 1e-9);

        return Math.max(
          Math.abs(below.r - above.r),
          Math.abs(below.g - above.g),
          Math.abs(below.b - above.b)
        );
      })
    );

    // Assert: 1e-8 なのは x^0.8 の傾きが x→0 で発散し、510nm で 5.74e-9 になるため
    expect(maxGap).toBeLessThanOrEqual(1e-8);
  });
});

// ---------------------------------------------------------------------------
// D. sampleWavelengths
// ---------------------------------------------------------------------------

describe('D. sampleWavelengths: 可視域を等間隔に分割する', () => {
  it('連続モードのサンプル数だけ返す', () => {
    // Arrange & Act
    const actual = sampleWavelengths(CONTINUOUS_SAMPLE_COUNT);

    // Assert
    expect(actual.length).toBe(48);
  });

  it('両端に可視域の下限と上限を含む', () => {
    // Arrange & Act
    const actual = sampleWavelengths(CONTINUOUS_SAMPLE_COUNT);

    // Assert
    expect([elementAt(actual, 0), elementAt(actual, actual.length - 1)]).toEqual([
      WAVELENGTH_MIN_NM,
      WAVELENGTH_MAX_NM,
    ]);
  });

  it('隣接する波長の間隔が一定になる', () => {
    // Arrange
    const actual = sampleWavelengths(CONTINUOUS_SAMPLE_COUNT);
    const gaps = actual.slice(1).map((value, index) => value - elementAt(actual, index));

    // Act
    const spread = Math.max(...gaps) - Math.min(...gaps);

    // Assert
    expect(spread).toBeLessThanOrEqual(WAVELENGTH_TOLERANCE_NM);
  });

  it('波長が単調増加する', () => {
    // Arrange
    const actual = sampleWavelengths(CONTINUOUS_SAMPLE_COUNT);

    // Act
    const nonIncreasing = actual
      .slice(1)
      .filter((value, index) => value <= elementAt(actual, index));

    // Assert
    expect(nonIncreasing).toEqual([]);
  });

  it('サンプル数 2 では両端だけを返す', () => {
    // Arrange & Act
    const actual = sampleWavelengths(2);

    // Assert
    expect(actual).toEqual([380, 750]);
  });

  it.each([1, 0])('サンプル数が %d なら RangeError を投げる', (count) => {
    // Arrange & Act & Assert
    expect(() => sampleWavelengths(count)).toThrow(RangeError);
  });

  it.each([2.5, Number.NaN])(
    'サンプル数が %d のように整数でなければ RangeError を投げる',
    (count) => {
      // Arrange & Act & Assert
      // Array.from({ length: 2.5 }) は長さを 2 に切り捨てるため、
      // 弾かないと引数と食い違う本数を黙って返すことになる
      expect(() => sampleWavelengths(count)).toThrow(RangeError);
    }
  );
});

// ---------------------------------------------------------------------------
// E. 7 色モードの代表波長
// ---------------------------------------------------------------------------
//
// NOTE: constants.ts は値だけのモジュールでテストファイルを持たない。
//       この定数は spectrum の設計判断（緑を 510nm にする根拠）と一体なのでここで縛る。

describe('E. SEVEN_COLOR_WAVELENGTHS_NM: SPEC の 7 色代表波長', () => {
  it('SPEC の並びと一致する', () => {
    // Arrange & Act & Assert
    expect(SEVEN_COLOR_WAVELENGTHS_NM).toEqual([660, 610, 580, 510, 480, 450, 410]);
  });

  it('波長の降順（赤 → 紫）に並ぶ', () => {
    // Arrange
    const ascending = SEVEN_COLOR_WAVELENGTHS_NM.slice(1).filter(
      (value, index) => value >= elementAt(SEVEN_COLOR_WAVELENGTHS_NM, index)
    );

    // Act & Assert
    expect(ascending).toEqual([]);
  });
});
