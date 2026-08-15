import { describe, expect, it } from 'vitest';

import { BK7, DIAMOND, SF10, WATER } from '../../src/optics/constants';
import { canTransmit, criticalAngle } from '../../src/optics/fresnel';

/**
 * src/optics/fresnel.ts の受け入れ条件（臨界角・全反射判定）。
 *
 * 対象:
 *   criticalAngle(nFrom, nTo)                    — 臨界角 θc [deg] を返す
 *   canTransmit(nFrom, nTo, incidenceAngleDeg)   — その入射角で透過するか
 *
 * 設計判断:
 *   - 純粋関数。DOM / Three.js には一切触れない。
 *   - θc = asin(nTo / nFrom)。nFrom < nTo では臨界角が存在しないため RangeError を投げる。
 *     nFrom === nTo は asin(1) = 90° として定義する。
 *   - canTransmit は nFrom <= nTo のとき全反射しえないため、角度によらず常に true を返す
 *     （角度比較へ進まない）。nFrom > nTo のときのみ θ と θc を比較する。
 *   - 境界の規約: θ >= θc を全反射とする（θc ちょうどは false）。
 *     θc では屈折光が界面に沿って進み透過強度が 0 になるため、透過とは扱わない。
 *   - 定義域: 入射角は 0 <= θ <= 90 [deg]、屈折率は 1 以上の有限数。
 *     外れた場合は RangeError を投げる（NaN を光路計算へ伝播させない）。
 *
 * 期待値の出典:
 *   屈折率は constants.ts のカタログ値（SCHOTT / Daimon & Masumura 2007 / Phillip & Taft 1964）。
 *   臨界角は θc = asin(1/n) を倍精度で評価した値であり、SPEC.md の材質定数表
 *   （BK7 41.2° / SF10 35.4° / 水 48.6° / ダイヤモンド 24.4°）と整合する。
 */

/** 真空・空気の屈折率。 */
const N_AIR = 1;

/** 臨界角の許容差 [deg]。解析解を倍精度で評価した値なので極小で足りる。 */
const CRITICAL_ANGLE_TOLERANCE_DEG = 1e-6;

/** 境界テストで臨界角から離す量 [deg]。 */
const BOUNDARY_DELTA_DEG = 0.01;

// ---------------------------------------------------------------------------
// A. 性質: nFrom <= nTo なら全反射しない
// ---------------------------------------------------------------------------

describe('A. 性質: 疎な媒質から密な媒質へ入る場合は全反射しない', () => {
  const INCIDENCE_ANGLES_DEG = [0, 30, 45, 60, 89, 90];

  it.each(INCIDENCE_ANGLES_DEG)(
    '空気→BK7（nFrom < nTo）は入射角 %d° でも透過する',
    (incidenceAngleDeg) => {
      // Arrange
      const nFrom = N_AIR;
      const nTo = BK7.catalogNd;

      // Act
      const transmits = canTransmit(nFrom, nTo, incidenceAngleDeg);

      // Assert
      expect(transmits).toBe(true);
    }
  );

  it.each(INCIDENCE_ANGLES_DEG)(
    '同一屈折率（nFrom === nTo）は入射角 %d° でも透過する',
    (incidenceAngleDeg) => {
      // Arrange
      const nFrom = BK7.catalogNd;
      const nTo = BK7.catalogNd;

      // Act
      const transmits = canTransmit(nFrom, nTo, incidenceAngleDeg);

      // Assert
      expect(transmits).toBe(true);
    }
  );
});

// ---------------------------------------------------------------------------
// B. 既知値: ガラス→空気の臨界角
// ---------------------------------------------------------------------------
//
// θc = asin(1 / n) を倍精度で評価した値:
//   BK7          n = 1.51680  →  41.245190370°
//   SF10         n = 1.72828  →  35.352833027°
//   水（20°C）   n = 1.33340  →  48.587129792°
//   ダイヤモンド n = 2.41730  →  24.436512394°
//
// SPEC.md の材質定数表（1 桁表記で 41.2 / 35.4 / 48.6 / 24.4）と整合する。

describe('B. 既知値: ガラス→空気の臨界角が文献値と一致する', () => {
  const CRITICAL_ANGLE_CASES: readonly [string, number, number][] = [
    ['BK7', BK7.catalogNd, 41.245190370],
    ['SF10', SF10.catalogNd, 35.352833027],
    ['水', WATER.catalogNd, 48.587129792],
    ['ダイヤモンド', DIAMOND.catalogNd, 24.436512394],
  ];

  it.each(CRITICAL_ANGLE_CASES)(
    '%s → 空気 の臨界角が期待値と一致する',
    (_name, nFrom, expectedCriticalAngleDeg) => {
      // Arrange
      const nTo = N_AIR;

      // Act
      const actualCriticalAngleDeg = criticalAngle(nFrom, nTo);

      // Assert
      expect(Math.abs(actualCriticalAngleDeg - expectedCriticalAngleDeg)).toBeLessThanOrEqual(
        CRITICAL_ANGLE_TOLERANCE_DEG
      );
    }
  );

  it('同一屈折率の界面では臨界角が 90° になる', () => {
    // Arrange
    const nFrom = BK7.catalogNd;
    const nTo = BK7.catalogNd;

    // Act
    const actualCriticalAngleDeg = criticalAngle(nFrom, nTo);

    // Assert
    expect(Math.abs(actualCriticalAngleDeg - 90)).toBeLessThanOrEqual(
      CRITICAL_ANGLE_TOLERANCE_DEG
    );
  });
});

// ---------------------------------------------------------------------------
// C. 境界: 臨界角ちょうどの扱い
// ---------------------------------------------------------------------------
//
// 規約: θ >= θc を全反射とする。臨界角ちょうどは「透過しない」。

describe('C. 境界: 臨界角ちょうどは全反射として扱う', () => {
  it('臨界角のわずかに下では透過する（BK7 → 空気）', () => {
    // Arrange
    const nFrom = BK7.catalogNd;
    const nTo = N_AIR;
    const justBelowCriticalDeg = criticalAngle(nFrom, nTo) - BOUNDARY_DELTA_DEG;

    // Act
    const transmits = canTransmit(nFrom, nTo, justBelowCriticalDeg);

    // Assert
    expect(transmits).toBe(true);
  });

  it('臨界角ちょうどでは全反射する（BK7 → 空気）', () => {
    // Arrange
    const nFrom = BK7.catalogNd;
    const nTo = N_AIR;
    const exactlyCriticalDeg = criticalAngle(nFrom, nTo);

    // Act
    const transmits = canTransmit(nFrom, nTo, exactlyCriticalDeg);

    // Assert
    expect(transmits).toBe(false);
  });

  it('臨界角のわずかに上では全反射する（BK7 → 空気）', () => {
    // Arrange
    const nFrom = BK7.catalogNd;
    const nTo = N_AIR;
    const justAboveCriticalDeg = criticalAngle(nFrom, nTo) + BOUNDARY_DELTA_DEG;

    // Act
    const transmits = canTransmit(nFrom, nTo, justAboveCriticalDeg);

    // Assert
    expect(transmits).toBe(false);
  });

  it('臨界角の小さいダイヤモンドでも境界の規約が同じである', () => {
    // Arrange
    const nFrom = DIAMOND.catalogNd;
    const nTo = N_AIR;
    const exactlyCriticalDeg = criticalAngle(nFrom, nTo);

    // Act
    const transmits = canTransmit(nFrom, nTo, exactlyCriticalDeg);

    // Assert
    expect(transmits).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// D. 異常系: 定義域を外れた入力は RangeError
// ---------------------------------------------------------------------------

describe('D. 異常系: 入射角が定義域外なら RangeError を投げる', () => {
  const nFrom = BK7.catalogNd;
  const nTo = N_AIR;

  it('負の入射角で RangeError を投げる', () => {
    // Arrange
    const invalidAngleDeg = -1;

    // Act & Assert
    expect(() => canTransmit(nFrom, nTo, invalidAngleDeg)).toThrow(RangeError);
  });

  it('90° を超える入射角で RangeError を投げる', () => {
    // Arrange
    const invalidAngleDeg = 90.1;

    // Act & Assert
    expect(() => canTransmit(nFrom, nTo, invalidAngleDeg)).toThrow(RangeError);
  });

  it('NaN の入射角で RangeError を投げる', () => {
    // Arrange
    const invalidAngleDeg = Number.NaN;

    // Act & Assert
    expect(() => canTransmit(nFrom, nTo, invalidAngleDeg)).toThrow(RangeError);
  });

  it('Infinity の入射角で RangeError を投げる', () => {
    // Arrange
    const invalidAngleDeg = Number.POSITIVE_INFINITY;

    // Act & Assert
    expect(() => canTransmit(nFrom, nTo, invalidAngleDeg)).toThrow(RangeError);
  });

  it('入射角 0° と 90° は定義域内なので例外を投げない', () => {
    // Arrange & Act & Assert
    expect(() => canTransmit(nFrom, nTo, 0)).not.toThrow();
    expect(() => canTransmit(nFrom, nTo, 90)).not.toThrow();
  });
});

describe('D. 異常系: 屈折率が定義域外なら RangeError を投げる', () => {
  const validAngleDeg = 30;

  it('nFrom が 1 未満なら canTransmit が RangeError を投げる', () => {
    // Arrange
    const invalidNFrom = 0.9;

    // Act & Assert
    expect(() => canTransmit(invalidNFrom, N_AIR, validAngleDeg)).toThrow(RangeError);
  });

  it('nTo が 1 未満なら canTransmit が RangeError を投げる', () => {
    // Arrange
    const invalidNTo = 0.5;

    // Act & Assert
    expect(() => canTransmit(BK7.catalogNd, invalidNTo, validAngleDeg)).toThrow(RangeError);
  });

  it('屈折率が NaN なら canTransmit が RangeError を投げる', () => {
    // Arrange
    const invalidN = Number.NaN;

    // Act & Assert
    expect(() => canTransmit(invalidN, N_AIR, validAngleDeg)).toThrow(RangeError);
  });

  it('屈折率が Infinity なら canTransmit が RangeError を投げる', () => {
    // Arrange
    const invalidN = Number.POSITIVE_INFINITY;

    // Act & Assert
    expect(() => canTransmit(invalidN, N_AIR, validAngleDeg)).toThrow(RangeError);
  });

  it('屈折率が 1 未満なら criticalAngle が RangeError を投げる', () => {
    // Arrange
    const invalidNFrom = 0.9;

    // Act & Assert
    expect(() => criticalAngle(invalidNFrom, N_AIR)).toThrow(RangeError);
  });

  it('屈折率が非有限なら criticalAngle が RangeError を投げる', () => {
    // Arrange
    const invalidNFrom = Number.NaN;

    // Act & Assert
    expect(() => criticalAngle(invalidNFrom, N_AIR)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// E. 全反射しえない組合せでの整合性
// ---------------------------------------------------------------------------

describe('E. 全反射しえない組合せでも矛盾なく動く', () => {
  it('nFrom < nTo では臨界角が存在しないため criticalAngle が RangeError を投げる', () => {
    // Arrange
    const nFrom = N_AIR;
    const nTo = BK7.catalogNd;

    // Act & Assert
    expect(() => criticalAngle(nFrom, nTo)).toThrow(RangeError);
  });

  it('criticalAngle が投げる組合せでも canTransmit は例外を投げず true を返す', () => {
    // Arrange
    const nFrom = N_AIR;
    const nTo = BK7.catalogNd;
    const grazingAngleDeg = 90;

    // Act
    const transmits = canTransmit(nFrom, nTo, grazingAngleDeg);

    // Assert
    expect(transmits).toBe(true);
  });

  it('垂直入射（0°）は全反射しえないので密→疎でも透過する', () => {
    // Arrange
    const nFrom = DIAMOND.catalogNd;
    const nTo = N_AIR;
    const normalIncidenceDeg = 0;

    // Act
    const transmits = canTransmit(nFrom, nTo, normalIncidenceDeg);

    // Assert
    expect(transmits).toBe(true);
  });

  it('屈折率差が大きいほど臨界角が小さくなる（ダイヤモンド < BK7 < 水）', () => {
    // Arrange
    const nTo = N_AIR;

    // Act
    const diamondCriticalDeg = criticalAngle(DIAMOND.catalogNd, nTo);
    const bk7CriticalDeg = criticalAngle(BK7.catalogNd, nTo);
    const waterCriticalDeg = criticalAngle(WATER.catalogNd, nTo);

    // Assert
    expect(diamondCriticalDeg).toBeLessThan(bk7CriticalDeg);
    expect(bk7CriticalDeg).toBeLessThan(waterCriticalDeg);
  });
});
