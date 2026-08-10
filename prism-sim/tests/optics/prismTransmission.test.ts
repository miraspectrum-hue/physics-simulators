import { describe, expect, it } from 'vitest';

import { APEX_ANGLE_DEG, BK7, DIAMOND, SF10, WATER } from '../../src/optics/constants';
// NOTE: canTransmitThroughPrism は未実装。TDD の Red フェーズのため、この import は解決しない。
import { canTransmitThroughPrism, minimumDeviationDeg } from '../../src/optics/prism';

/**
 * src/optics/prism.ts の受け入れ条件（プリズム単位の透過可否）。
 *
 * 対象:
 *   canTransmitThroughPrism(apexAngleDeg, n) — 頂角 A のプリズムが透過し得るか
 *
 * 物理:
 *   第一面での屈折角の上限が θc であり、r₁ + r₂ = A かつ r₂ < θc を満たす必要があるため、
 *   透過条件は A < 2·θc（θc = criticalAngle(n, 空気) = asin(1/n)）。
 *
 * 設計判断:
 *   - 純粋関数。θc は fresnel.criticalAngle を使い、境界を自前で持たない。
 *   - 境界 A = 2·θc は false。prism.ts / fresnel の「θ >= θc は全反射」規約と一致する。
 *   - 定義域: 頂角は 0 < A < 180 [deg]、屈折率は 1 以上の有限数。外れたら RangeError。
 *
 * 期待値の出典:
 *   屈折率は constants.ts のカタログ値（d 線 587.56nm）。
 *   θc = asin(1/n) を倍精度で評価した値であり、SPEC.md の材質定数表および
 *   「ダイヤモンドは頂角 60° を透過できない」の警告ブロックと整合する。
 */

/** 境界テストで 2·θc から離す量 [deg]。等号ちょうどは丸め任せになるため踏まない。 */
const BOUNDARY_DELTA_DEG = 0.01;

// 全 4 材質の [表示名, 屈折率, 2·θc]。θc = asin(1/n) を倍精度で評価した値:
//   BK7          n = 1.51680  →  θc = 41.245190370°  →  2·θc = 82.490380739°
//   SF10         n = 1.72828  →  θc = 35.352833027°  →  2·θc = 70.705666054°
//   水（20°C）   n = 1.33340  →  θc = 48.587129792°  →  2·θc = 97.174259584°
//   ダイヤモンド n = 2.41730  →  θc = 24.436512394°  →  2·θc = 48.873024788°
const MATERIAL_CASES: readonly [string, number, number][] = [
  ['BK7', BK7.catalogNd, 82.490380739],
  ['SF10', SF10.catalogNd, 70.705666054],
  ['水', WATER.catalogNd, 97.174259584],
  ['ダイヤモンド', DIAMOND.catalogNd, 48.873024788],
];

/** minimumDeviationDeg が RangeError を投げたかを真偽値で返す（E 観点の突き合わせ用）。 */
function minimumDeviationThrows(apexAngleDeg: number, n: number): boolean {
  try {
    minimumDeviationDeg(apexAngleDeg, n);
    return false;
  } catch (error) {
    if (error instanceof RangeError) {
      return true;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// A. 性質: θc が小さい材質ほど頂角の上限が厳しい
// ---------------------------------------------------------------------------
//
// 透過できる頂角の上限は 2·θc であり、屈折率が高いほど θc が小さくなるため
// ダイヤモンド(48.87°) < SF10(70.71°) < BK7(82.49°) < 水(97.17°) の順に厳しい。
// 各しきい値の間に頂角を置き、隣り合う材質で可否が分かれることで順序を示す。

describe('A. 性質: 屈折率が高い材質ほど透過できる頂角の上限が厳しい', () => {
  it('頂角 60° はダイヤモンドの上限を超えるが SF10 の上限内である', () => {
    // Arrange
    const apexAngleDeg = 60;

    // Act
    const diamondTransmits = canTransmitThroughPrism(apexAngleDeg, DIAMOND.catalogNd);
    const sf10Transmits = canTransmitThroughPrism(apexAngleDeg, SF10.catalogNd);

    // Assert
    expect([diamondTransmits, sf10Transmits]).toEqual([false, true]);
  });

  it('頂角 75° は SF10 の上限を超えるが BK7 の上限内である', () => {
    // Arrange
    const apexAngleDeg = 75;

    // Act
    const sf10Transmits = canTransmitThroughPrism(apexAngleDeg, SF10.catalogNd);
    const bk7Transmits = canTransmitThroughPrism(apexAngleDeg, BK7.catalogNd);

    // Assert
    expect([sf10Transmits, bk7Transmits]).toEqual([false, true]);
  });

  it('頂角 90° は BK7 の上限を超えるが水の上限内である', () => {
    // Arrange
    const apexAngleDeg = 90;

    // Act
    const bk7Transmits = canTransmitThroughPrism(apexAngleDeg, BK7.catalogNd);
    const waterTransmits = canTransmitThroughPrism(apexAngleDeg, WATER.catalogNd);

    // Assert
    expect([bk7Transmits, waterTransmits]).toEqual([false, true]);
  });
});

// ---------------------------------------------------------------------------
// B. 既知値: 頂角 60°（本アプリの APEX_ANGLE_DEG）での可否
// ---------------------------------------------------------------------------
//
// 60° と 2·θc の比較:
//   BK7          60° < 82.490380739°  →  透過する
//   SF10         60° < 70.705666054°  →  透過する
//   水（20°C）   60° < 97.174259584°  →  透過する
//   ダイヤモンド 60° > 48.873024788°  →  透過しない（SPEC.md の警告ブロック）

describe('B. 既知値: 頂角 60° ではダイヤモンドだけが透過しない', () => {
  const EXPECTED_AT_60_DEG: readonly [string, number, boolean][] = [
    ['BK7', BK7.catalogNd, true],
    ['SF10', SF10.catalogNd, true],
    ['水', WATER.catalogNd, true],
    ['ダイヤモンド', DIAMOND.catalogNd, false],
  ];

  it.each(EXPECTED_AT_60_DEG)('%s の判定が期待どおりになる', (_name, n, expected) => {
    // Arrange & Act
    const actual = canTransmitThroughPrism(APEX_ANGLE_DEG, n);

    // Assert
    expect(actual).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// C. 境界: 2·θc の近傍
// ---------------------------------------------------------------------------
//
// 等号ちょうど（A = 2·θc）は 9 桁に丸めた値がどちら側に落ちるか丸め任せになるため、
// 決め打ちのテストは作らない。±0.01° 離した 2 点で切り替わりを確認する。

describe('C. 境界: 2·θc のわずか下では透過し、わずか上では透過しない', () => {
  it.each(MATERIAL_CASES)(
    '%s は 2·θc のわずか下（-0.01°）で透過する',
    (_name, n, doubleCriticalAngleDeg) => {
      // Arrange
      const apexAngleDeg = doubleCriticalAngleDeg - BOUNDARY_DELTA_DEG;

      // Act
      const actual = canTransmitThroughPrism(apexAngleDeg, n);

      // Assert
      expect(actual).toBe(true);
    }
  );

  it.each(MATERIAL_CASES)(
    '%s は 2·θc のわずか上（+0.01°）で透過しない',
    (_name, n, doubleCriticalAngleDeg) => {
      // Arrange
      const apexAngleDeg = doubleCriticalAngleDeg + BOUNDARY_DELTA_DEG;

      // Act
      const actual = canTransmitThroughPrism(apexAngleDeg, n);

      // Assert
      expect(actual).toBe(false);
    }
  );
});

// ---------------------------------------------------------------------------
// D. 異常系: 定義域を外れた入力は RangeError
// ---------------------------------------------------------------------------

describe('D. 異常系: 頂角が定義域外なら RangeError を投げる', () => {
  const n = BK7.catalogNd;

  it.each([0, -30, 180, 180.1, Number.NaN, Number.POSITIVE_INFINITY])(
    '頂角 %s で RangeError を投げる',
    (invalidApexDeg) => {
      // Arrange & Act & Assert
      expect(() => canTransmitThroughPrism(invalidApexDeg, n)).toThrow(RangeError);
    }
  );
});

describe('D. 異常系: 屈折率が定義域外なら RangeError を投げる', () => {
  it.each([0.9, Number.NaN, Number.POSITIVE_INFINITY])(
    '屈折率 %s で RangeError を投げる',
    (invalidN) => {
      // Arrange & Act & Assert
      expect(() => canTransmitThroughPrism(APEX_ANGLE_DEG, invalidN)).toThrow(RangeError);
    }
  );
});

// ---------------------------------------------------------------------------
// E. 整合性: minimumDeviationDeg の可解性と一致する（同一モジュール内の 2 関数）
// ---------------------------------------------------------------------------
//
// 透過条件 A < 2·θc は n·sin(A/2) < 1 と同値である。
//   A < 2·asin(1/n)  ⇔  A/2 < asin(1/n)  ⇔  sin(A/2) < 1/n  ⇔  n·sin(A/2) < 1
// したがって canTransmitThroughPrism が true を返す条件と、
// minimumDeviationDeg が解を返す（例外を投げない）条件は完全に一致しなければならない。

describe('E. 整合性: 透過可否が minimumDeviationDeg の可解性と一致する', () => {
  it.each(MATERIAL_CASES)(
    '%s は頂角 1〜179° の全域で両者の判定が矛盾しない',
    (_name, n) => {
      // Arrange
      const stepDeg = 0.5;
      const mismatchedApexAnglesDeg: number[] = [];

      // Act
      for (let apexAngleDeg = 1; apexAngleDeg <= 179; apexAngleDeg += stepDeg) {
        const transmits = canTransmitThroughPrism(apexAngleDeg, n);
        if (transmits === minimumDeviationThrows(apexAngleDeg, n)) {
          mismatchedApexAnglesDeg.push(apexAngleDeg);
        }
      }

      // Assert: 透過する頂角では解が求まり、透過しない頂角では必ず例外になる
      expect(mismatchedApexAnglesDeg).toEqual([]);
    }
  );
});
