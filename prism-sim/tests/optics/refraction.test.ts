import { describe, expect, it } from 'vitest';

import { BK7, DIAMOND, SF10, WATER } from '../../src/optics/constants';
import { canTransmit, criticalAngle } from '../../src/optics/fresnel';
import { refractionAngleDeg } from '../../src/optics/refraction';

/**
 * src/optics/refraction.ts の受け入れ条件（スネル則による屈折角）。
 *
 * 対象:
 *   refractionAngleDeg(nFrom, nTo, incidenceAngleDeg) — 屈折角 θ₂ [deg] を返す
 *
 * 物理:
 *   スネル則 n_from · sin(θ₁) = n_to · sin(θ₂) より θ₂ = asin(n_from · sin(θ₁) / n_to)
 *
 * 設計判断:
 *   - 純粋関数。DOM / Three.js / 幾何（convexSolid）には一切依存しない。
 *     波長依存性も扱わない（呼び出し側が dispersion で求めた屈折率を渡す）。
 *   - 全反射域では RangeError を投げる。屈折角が存在しないため NaN を返さない。
 *   - 全反射域の判定は **角度比較 θ₁ >= criticalAngle(nFrom, nTo)** で行う。
 *     比 n_from·sin(θ₁)/n_to を 1 と比較する実装は使えない。臨界角ちょうどでは
 *     この比が 1 を超えず（BK7/水/ダイヤは誤差 0 で 1、SF10 は 1 - 1.11e-16）、
 *     SF10 では `>= 1` としても落とせないため、fresnel.canTransmit と境界がずれる。
 *   - 定義域: 入射角は 0 <= θ₁ <= 90 [deg]、屈折率は 1 以上の有限数。
 *     外れた場合は RangeError（fresnel.ts と同一の規約）。
 *
 * 期待値の出典:
 *   屈折率は constants.ts のカタログ値。屈折角はスネル則を倍精度で評価した値。
 */

/** 真空・空気の屈折率。 */
const N_AIR = 1;

/** 屈折角の許容差 [deg]。解析解を倍精度で評価した値なので極小で足りる。 */
const ANGLE_TOLERANCE_DEG = 1e-6;

/** 可逆性テストの許容差 [deg]。往復の丸め誤差は 1e-14 度程度に収まる。 */
const REVERSIBILITY_TOLERANCE_DEG = 1e-9;

/** 境界テストで臨界角から離す量 [deg]。 */
const BOUNDARY_DELTA_DEG = 0.01;

/** 全材質の [表示名, 屈折率] 一覧。E 観点の走査に用いる。 */
const MATERIAL_CASES: readonly [string, number][] = [
  ['BK7', BK7.catalogNd],
  ['SF10', SF10.catalogNd],
  ['水', WATER.catalogNd],
  ['ダイヤモンド', DIAMOND.catalogNd],
];

/**
 * refractionAngleDeg が RangeError を投げたかを真偽値で返す。
 * E 観点で canTransmit の戻り値と直接比較するために用いる。
 */
function throwsRangeError(nFrom: number, nTo: number, incidenceAngleDeg: number): boolean {
  try {
    refractionAngleDeg(nFrom, nTo, incidenceAngleDeg);
    return false;
  } catch (error) {
    if (error instanceof RangeError) {
      return true;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// A. 性質: 曲がる向き
// ---------------------------------------------------------------------------

describe('A. 性質: 屈折の向きがスネル則どおりである', () => {
  it('密な媒質へ入ると法線側へ曲がる（屈折角 < 入射角）', () => {
    // Arrange
    const nFrom = N_AIR;
    const nTo = BK7.catalogNd;
    const incidenceAngleDeg = 40;

    // Act
    const actualDeg = refractionAngleDeg(nFrom, nTo, incidenceAngleDeg);

    // Assert
    expect(actualDeg).toBeLessThan(incidenceAngleDeg);
  });

  it('疎な媒質へ抜けると法線から離れる（屈折角 > 入射角）', () => {
    // Arrange: 30° は BK7 の臨界角 41.245° 未満なので透過する
    const nFrom = BK7.catalogNd;
    const nTo = N_AIR;
    const incidenceAngleDeg = 30;

    // Act
    const actualDeg = refractionAngleDeg(nFrom, nTo, incidenceAngleDeg);

    // Assert
    expect(actualDeg).toBeGreaterThan(incidenceAngleDeg);
  });

  it('垂直入射（0°）は密な媒質へ入っても直進する', () => {
    // Arrange
    const nFrom = N_AIR;
    const nTo = BK7.catalogNd;
    const normalIncidenceDeg = 0;

    // Act
    const actualDeg = refractionAngleDeg(nFrom, nTo, normalIncidenceDeg);

    // Assert
    expect(actualDeg).toBe(0);
  });

  it('垂直入射（0°）は疎な媒質へ抜けても直進する', () => {
    // Arrange
    const nFrom = BK7.catalogNd;
    const nTo = N_AIR;
    const normalIncidenceDeg = 0;

    // Act
    const actualDeg = refractionAngleDeg(nFrom, nTo, normalIncidenceDeg);

    // Assert
    expect(actualDeg).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// B. 既知値: 空気 → BK7
// ---------------------------------------------------------------------------
//
// θ₂ = asin(sin(θ₁) / n)、n = 1.51680（BK7 のカタログ n_d）を倍精度で評価した値:
//   θ₁ = 30°  →  asin(0.5       / 1.51680) = 19.247008362°
//   θ₁ = 60°  →  asin(0.8660254 / 1.51680) = 34.816887249°

describe('B. 既知値: 空気→BK7 の屈折角が手計算と一致する', () => {
  it('入射角 30° の屈折角が 19.247008362° になる', () => {
    // Arrange
    const incidenceAngleDeg = 30;
    const expectedDeg = 19.247008362;

    // Act
    const actualDeg = refractionAngleDeg(N_AIR, BK7.catalogNd, incidenceAngleDeg);

    // Assert
    expect(Math.abs(actualDeg - expectedDeg)).toBeLessThanOrEqual(ANGLE_TOLERANCE_DEG);
  });

  it('入射角 60° の屈折角が 34.816887249° になる', () => {
    // Arrange
    const incidenceAngleDeg = 60;
    const expectedDeg = 34.816887249;

    // Act
    const actualDeg = refractionAngleDeg(N_AIR, BK7.catalogNd, incidenceAngleDeg);

    // Assert
    expect(Math.abs(actualDeg - expectedDeg)).toBeLessThanOrEqual(ANGLE_TOLERANCE_DEG);
  });

  it('可逆性: 空気→BK7 の 30° を BK7→空気 に戻すと 30° に一致する', () => {
    // Arrange
    const originalDeg = 30;

    // Act
    const insideDeg = refractionAngleDeg(N_AIR, BK7.catalogNd, originalDeg);
    const roundTripDeg = refractionAngleDeg(BK7.catalogNd, N_AIR, insideDeg);

    // Assert
    expect(Math.abs(roundTripDeg - originalDeg)).toBeLessThanOrEqual(REVERSIBILITY_TOLERANCE_DEG);
  });

  it('可逆性: 空気→BK7 の 60° を BK7→空気 に戻すと 60° に一致する', () => {
    // Arrange
    const originalDeg = 60;

    // Act
    const insideDeg = refractionAngleDeg(N_AIR, BK7.catalogNd, originalDeg);
    const roundTripDeg = refractionAngleDeg(BK7.catalogNd, N_AIR, insideDeg);

    // Assert
    expect(Math.abs(roundTripDeg - originalDeg)).toBeLessThanOrEqual(REVERSIBILITY_TOLERANCE_DEG);
  });
});

// ---------------------------------------------------------------------------
// C. 境界: 臨界角の近傍とかすめ入射
// ---------------------------------------------------------------------------

describe('C. 境界: 臨界角の近傍で屈折角が 90° に迫り、以降は全反射域になる', () => {
  it('臨界角のわずか下では屈折角が 90° に迫る（BK7→空気で 88.856745459°）', () => {
    // Arrange
    const nFrom = BK7.catalogNd;
    const nTo = N_AIR;
    const justBelowCriticalDeg = criticalAngle(nFrom, nTo) - BOUNDARY_DELTA_DEG;
    const expectedDeg = 88.856745459;

    // Act
    const actualDeg = refractionAngleDeg(nFrom, nTo, justBelowCriticalDeg);

    // Assert
    expect(Math.abs(actualDeg - expectedDeg)).toBeLessThanOrEqual(ANGLE_TOLERANCE_DEG);
  });

  it('臨界角ちょうどは全反射域なので RangeError を投げる（BK7→空気）', () => {
    // Arrange
    const nFrom = BK7.catalogNd;
    const nTo = N_AIR;
    const exactlyCriticalDeg = criticalAngle(nFrom, nTo);

    // Act & Assert
    expect(() => refractionAngleDeg(nFrom, nTo, exactlyCriticalDeg)).toThrow(RangeError);
  });

  it('臨界角ちょうどは SF10 でも RangeError を投げる（比 n·sinθ が 1 を下回る材質）', () => {
    // Arrange: SF10 は θc で n·sin(θc) = 1 - 1.11e-16 となり、比較による判定でしか落とせない
    const nFrom = SF10.catalogNd;
    const nTo = N_AIR;
    const exactlyCriticalDeg = criticalAngle(nFrom, nTo);

    // Act & Assert
    expect(() => refractionAngleDeg(nFrom, nTo, exactlyCriticalDeg)).toThrow(RangeError);
  });

  it('臨界角を超えると RangeError を投げる（BK7→空気）', () => {
    // Arrange
    const nFrom = BK7.catalogNd;
    const nTo = N_AIR;
    const aboveCriticalDeg = criticalAngle(nFrom, nTo) + BOUNDARY_DELTA_DEG;

    // Act & Assert
    expect(() => refractionAngleDeg(nFrom, nTo, aboveCriticalDeg)).toThrow(RangeError);
  });

  it('密な媒質へのかすめ入射（90°）の屈折角が asin(1/n) に一致する（空気→BK7）', () => {
    // Arrange: sin(90°) = 1 なので θ₂ = asin(1/n) となり、BK7→空気の臨界角と同値になる
    const grazingAngleDeg = 90;
    const expectedDeg = 41.245190370;

    // Act
    const actualDeg = refractionAngleDeg(N_AIR, BK7.catalogNd, grazingAngleDeg);

    // Assert
    expect(Math.abs(actualDeg - expectedDeg)).toBeLessThanOrEqual(ANGLE_TOLERANCE_DEG);
  });

  it('密な媒質へのかすめ入射（90°）の屈折角が asin(1/n) に一致する（空気→ダイヤモンド）', () => {
    // Arrange
    const grazingAngleDeg = 90;
    const expectedDeg = 24.436512394;

    // Act
    const actualDeg = refractionAngleDeg(N_AIR, DIAMOND.catalogNd, grazingAngleDeg);

    // Assert
    expect(Math.abs(actualDeg - expectedDeg)).toBeLessThanOrEqual(ANGLE_TOLERANCE_DEG);
  });
});

// ---------------------------------------------------------------------------
// D. 異常系: 定義域を外れた入力は RangeError
// ---------------------------------------------------------------------------

describe('D. 異常系: 入射角が定義域外なら RangeError を投げる', () => {
  const nFrom = N_AIR;
  const nTo = BK7.catalogNd;

  it('負の入射角で RangeError を投げる', () => {
    // Arrange
    const invalidAngleDeg = -1;

    // Act & Assert
    expect(() => refractionAngleDeg(nFrom, nTo, invalidAngleDeg)).toThrow(RangeError);
  });

  it('90° を超える入射角で RangeError を投げる', () => {
    // Arrange
    const invalidAngleDeg = 90.1;

    // Act & Assert
    expect(() => refractionAngleDeg(nFrom, nTo, invalidAngleDeg)).toThrow(RangeError);
  });

  it('NaN の入射角で RangeError を投げる', () => {
    // Arrange
    const invalidAngleDeg = Number.NaN;

    // Act & Assert
    expect(() => refractionAngleDeg(nFrom, nTo, invalidAngleDeg)).toThrow(RangeError);
  });

  it('Infinity の入射角で RangeError を投げる', () => {
    // Arrange
    const invalidAngleDeg = Number.POSITIVE_INFINITY;

    // Act & Assert
    expect(() => refractionAngleDeg(nFrom, nTo, invalidAngleDeg)).toThrow(RangeError);
  });

  it('-Infinity の入射角で RangeError を投げる', () => {
    // Arrange
    const invalidAngleDeg = Number.NEGATIVE_INFINITY;

    // Act & Assert
    expect(() => refractionAngleDeg(nFrom, nTo, invalidAngleDeg)).toThrow(RangeError);
  });

  it('入射角 0° と 90° は定義域内なので例外を投げない（疎→密）', () => {
    // Arrange & Act & Assert
    expect(() => refractionAngleDeg(nFrom, nTo, 0)).not.toThrow();
    expect(() => refractionAngleDeg(nFrom, nTo, 90)).not.toThrow();
  });
});

describe('D. 異常系: 屈折率が定義域外なら RangeError を投げる', () => {
  const validAngleDeg = 30;

  it('nFrom が 1 未満なら RangeError を投げる', () => {
    // Arrange
    const invalidNFrom = 0.9;

    // Act & Assert
    expect(() => refractionAngleDeg(invalidNFrom, N_AIR, validAngleDeg)).toThrow(RangeError);
  });

  it('nTo が 1 未満なら RangeError を投げる', () => {
    // Arrange
    const invalidNTo = 0.5;

    // Act & Assert
    expect(() => refractionAngleDeg(BK7.catalogNd, invalidNTo, validAngleDeg)).toThrow(RangeError);
  });

  it('屈折率が NaN なら RangeError を投げる', () => {
    // Arrange
    const invalidN = Number.NaN;

    // Act & Assert
    expect(() => refractionAngleDeg(invalidN, N_AIR, validAngleDeg)).toThrow(RangeError);
  });

  it('屈折率が Infinity なら RangeError を投げる', () => {
    // Arrange
    const invalidN = Number.POSITIVE_INFINITY;

    // Act & Assert
    expect(() => refractionAngleDeg(invalidN, N_AIR, validAngleDeg)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// E. 整合性: fresnel.canTransmit との境界一致（モジュール間）
// ---------------------------------------------------------------------------
//
// refraction.ts と fresnel.ts は別モジュールだが、全反射域の境界は同一でなければならない。
// ずれると tracer が「canTransmit は true なのに屈折角が例外」という状態に陥る。

describe('E. 整合性: 全反射域の境界が canTransmit と完全に一致する', () => {
  it.each(MATERIAL_CASES)(
    '%s → 空気 の臨界角ちょうどで、canTransmit が false かつ屈折角が RangeError になる',
    (_name, nFrom) => {
      // Arrange
      const nTo = N_AIR;
      const exactlyCriticalDeg = criticalAngle(nFrom, nTo);

      // Act
      const transmits = canTransmit(nFrom, nTo, exactlyCriticalDeg);
      const throws = throwsRangeError(nFrom, nTo, exactlyCriticalDeg);

      // Assert
      expect([transmits, throws]).toEqual([false, true]);
    }
  );

  it.each(MATERIAL_CASES)(
    '%s → 空気 の臨界角のわずか下で、canTransmit が true かつ屈折角が例外にならない',
    (_name, nFrom) => {
      // Arrange
      const nTo = N_AIR;
      const justBelowCriticalDeg = criticalAngle(nFrom, nTo) - BOUNDARY_DELTA_DEG;

      // Act
      const transmits = canTransmit(nFrom, nTo, justBelowCriticalDeg);
      const throws = throwsRangeError(nFrom, nTo, justBelowCriticalDeg);

      // Assert
      expect([transmits, throws]).toEqual([true, false]);
    }
  );

  it('BK7→空気 を 0〜90° まで 0.5° 刻みで走査しても両者の判定が矛盾しない', () => {
    // Arrange
    const nFrom = BK7.catalogNd;
    const nTo = N_AIR;
    const stepDeg = 0.5;
    const mismatchedAnglesDeg: number[] = [];

    // Act
    for (let angleDeg = 0; angleDeg <= 90; angleDeg += stepDeg) {
      if (canTransmit(nFrom, nTo, angleDeg) === throwsRangeError(nFrom, nTo, angleDeg)) {
        mismatchedAnglesDeg.push(angleDeg);
      }
    }

    // Assert: canTransmit が true の角度では例外にならず、false の角度では必ず例外になる
    expect(mismatchedAnglesDeg).toEqual([]);
  });

  it('空気→BK7（疎→密）は全角度で canTransmit が true かつ屈折角が例外にならない', () => {
    // Arrange
    const nFrom = N_AIR;
    const nTo = BK7.catalogNd;
    const stepDeg = 0.5;
    const mismatchedAnglesDeg: number[] = [];

    // Act
    for (let angleDeg = 0; angleDeg <= 90; angleDeg += stepDeg) {
      if (!canTransmit(nFrom, nTo, angleDeg) || throwsRangeError(nFrom, nTo, angleDeg)) {
        mismatchedAnglesDeg.push(angleDeg);
      }
    }

    // Assert
    expect(mismatchedAnglesDeg).toEqual([]);
  });
});
