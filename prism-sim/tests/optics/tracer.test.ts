import { describe, expect, it } from 'vitest';

// NOTE: tracer.ts は未実装。TDD の Red フェーズのため、この import は解決しない。
import {
  incidenceAngleDeg,
  reflectDirection,
  refractDirection,
} from '../../src/optics/tracer';
import { BK7 } from '../../src/optics/constants';
import { canTransmit } from '../../src/optics/fresnel';
import { refractionAngleDeg } from '../../src/optics/refraction';
import { cross, dot, length, normalize, vec3 } from '../../src/optics/vec3';
import type { Vec3 } from '../../src/types/optics';

/**
 * src/optics/tracer.ts の受け入れ条件（サイクル ④a: 方向ベクトルのプリミティブ）。
 *
 * 対象は局所空間の純粋関数 3 つ。Three.js / DOM には依存しない。
 *   - incidenceAngleDeg(direction, normal) : 界面法線から測った入射角 [deg]
 *   - reflectDirection(direction, normal)  : 鏡面反射の方向ベクトル
 *   - refractDirection(direction, normal, nFrom, nTo) : 屈折の方向ベクトル
 *
 * 設計判断（SPEC.md「光路計算」3 に対応）:
 *   - tracer は物理を持たない。全反射判定は fresnel.canTransmit、屈折角は
 *     refraction.refractionAngleDeg に委譲し、角度を方向ベクトルへ戻す幾何変換だけを担う。
 *   - ベクトル判別式 k = 1 - η²(1 - cos²θᵢ) による独自の全反射判定は使わない。
 *     臨界角ちょうどで canTransmit と境界がずれ、判定元が二重化するため。
 *   - normal は Plane.normal と同じ**外向き**単位法線。レイがどちら側から来ても
 *     内部で入射レイに正対させるため、法線の符号は結果に影響しない。
 *   - 全反射域では refractionAngleDeg の RangeError をそのまま伝播させる（NaN を返さない）。
 *
 * 期待値は倍精度で確定した具体値をハードコードする。
 */

/** 浮動小数の許容差。三角関数を経るため厳密比較を避ける。 */
const TOLERANCE = 1e-12;

/** 上向きの外向き法線。多くのケースで界面として用いる。 */
const UP: Vec3 = vec3(0, 1, 0);

/** 下向きの外向き法線。UP と裏表の関係にあり、正対処理の検証に用いる。 */
const DOWN: Vec3 = vec3(0, -1, 0);

/** ベクトルの各成分を許容差つきで比較する。 */
function expectVec3ToBeClose(actual: Vec3, expected: Vec3): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(actual.z - expected.z)).toBeLessThanOrEqual(TOLERANCE);
}

/**
 * 法線 UP に対して指定の入射角で下向きに進む単位ベクトルを作る。
 * XY 平面内で +x 側へ倒れる。
 */
function directionAtIncidence(angleDeg: number): Vec3 {
  const angleRad = (angleDeg * Math.PI) / 180;

  return vec3(Math.sin(angleRad), -Math.cos(angleRad), 0);
}

/** 単位ベクトルでないベクトル（引数検証の入力）。 */
const NON_UNIT: Vec3 = vec3(0, 2, 0);

// ---------------------------------------------------------------------------
// A. incidenceAngleDeg: 界面法線から測った入射角
// ---------------------------------------------------------------------------

describe('incidenceAngleDeg: 界面法線から測った入射角', () => {
  it('面に垂直に入射すると 0 度になる', () => {
    // Arrange
    const direction = vec3(0, -1, 0);

    // Act
    const actual = incidenceAngleDeg(direction, UP);

    // Assert
    expect(actual).toBe(0);
  });

  it('法線から 45 度傾いた入射で 45 度になる', () => {
    // Arrange
    const direction = vec3(Math.SQRT1_2, -Math.SQRT1_2, 0);

    // Act
    const actual = incidenceAngleDeg(direction, UP);

    // Assert
    expect(Math.abs(actual - 45)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('法線から 60 度傾いた入射で 60 度になる', () => {
    // Arrange
    const direction = vec3(0.866025403784439, -0.5, 0);

    // Act
    const actual = incidenceAngleDeg(direction, UP);

    // Assert
    expect(Math.abs(actual - 60)).toBeLessThanOrEqual(1e-9);
  });

  it('面に平行なかすめ入射で 90 度になる', () => {
    // Arrange
    const direction = vec3(1, 0, 0);

    // Act
    const actual = incidenceAngleDeg(direction, UP);

    // Assert
    expect(Math.abs(actual - 90)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('法線が裏向き（レイと同じ側）でも同じ入射角を返す', () => {
    // Arrange
    const direction = vec3(Math.SQRT1_2, -Math.SQRT1_2, 0);

    // Act
    const actual = incidenceAngleDeg(direction, DOWN);

    // Assert
    expect(Math.abs(actual - 45)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('主断面から外れた 3 次元の斜め入射でも正しい角を返す', () => {
    // Arrange
    const direction = normalize(vec3(1, -1, 1));

    // Act
    const actual = incidenceAngleDeg(direction, UP);

    // Assert
    expect(Math.abs(actual - 54.735610317245346)).toBeLessThanOrEqual(1e-9);
  });

  it('direction が単位ベクトルでなければ RangeError を投げる', () => {
    // Arrange & Act & Assert
    expect(() => incidenceAngleDeg(NON_UNIT, UP)).toThrow(RangeError);
  });

  it('normal が単位ベクトルでなければ RangeError を投げる', () => {
    // Arrange & Act & Assert
    expect(() => incidenceAngleDeg(vec3(0, -1, 0), NON_UNIT)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// B. reflectDirection: 鏡面反射
// ---------------------------------------------------------------------------

describe('reflectDirection: 鏡面反射', () => {
  it('45 度で入射した光を法線対称な向きへ反射する', () => {
    // Arrange
    const direction = vec3(Math.SQRT1_2, -Math.SQRT1_2, 0);

    // Act
    const actual = reflectDirection(direction, UP);

    // Assert
    expectVec3ToBeClose(actual, vec3(0.707106781186547, 0.707106781186547, 0));
  });

  it('垂直入射では真後ろへ返る', () => {
    // Arrange
    const direction = vec3(0, -1, 0);

    // Act
    const actual = reflectDirection(direction, UP);

    // Assert
    expectVec3ToBeClose(actual, vec3(0, 1, 0));
  });

  it('接線成分を保ち法線成分だけを反転する', () => {
    // Arrange
    const direction = normalize(vec3(1, -1, 1));

    // Act
    const actual = reflectDirection(direction, UP);

    // Assert
    expectVec3ToBeClose(
      actual,
      vec3(0.577350269189626, 0.577350269189626, 0.577350269189626)
    );
  });

  it('法線が裏向きでも同じ結果を返す（d - 2(d·n)n は n の符号に不変）', () => {
    // Arrange
    const direction = vec3(Math.SQRT1_2, -Math.SQRT1_2, 0);

    // Act
    const actual = reflectDirection(direction, DOWN);

    // Assert
    expectVec3ToBeClose(actual, vec3(0.707106781186547, 0.707106781186547, 0));
  });

  it('反射後も単位ベクトルである', () => {
    // Arrange
    const direction = normalize(vec3(2, -3, 1));

    // Act
    const actual = reflectDirection(direction, UP);

    // Assert
    expect(Math.abs(length(actual) - 1)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('direction が単位ベクトルでなければ RangeError を投げる', () => {
    // Arrange & Act & Assert
    expect(() => reflectDirection(NON_UNIT, UP)).toThrow(RangeError);
  });

  it('normal が単位ベクトルでなければ RangeError を投げる', () => {
    // Arrange & Act & Assert
    expect(() => reflectDirection(vec3(0, -1, 0), NON_UNIT)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// C. refractDirection: 屈折方向
// ---------------------------------------------------------------------------

describe('refractDirection: 屈折方向', () => {
  it('垂直入射では方向が変わらない', () => {
    // Arrange
    const direction = vec3(0, -1, 0);

    // Act
    const actual = refractDirection(direction, UP, 1, 1.5);

    // Assert
    expect(actual).toEqual({ x: 0, y: -1, z: 0 });
  });

  it('空気から n=1.5 の媒質へ 45 度で入射すると法線側へ曲がる', () => {
    // Arrange
    const direction = vec3(Math.SQRT1_2, -Math.SQRT1_2, 0);

    // Act
    const actual = refractDirection(direction, UP, 1, 1.5);

    // Assert
    expectVec3ToBeClose(actual, vec3(0.471404520791032, -0.881917103688197, 0));
  });

  it('屈折後も単位ベクトルである', () => {
    // Arrange
    const direction = vec3(Math.SQRT1_2, -Math.SQRT1_2, 0);

    // Act
    const actual = refractDirection(direction, UP, 1, 1.5);

    // Assert
    expect(Math.abs(length(actual) - 1)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('出力方向が法線となす角が refractionAngleDeg と一致する', () => {
    // Arrange
    const direction = vec3(Math.SQRT1_2, -Math.SQRT1_2, 0);
    const expected = refractionAngleDeg(1, 1.5, incidenceAngleDeg(direction, UP));

    // Act
    const actual = incidenceAngleDeg(refractDirection(direction, UP, 1, 1.5), UP);

    // Assert
    expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-9);
  });

  it('外向き法線がレイの進行方向側にある出射面でも正しく屈折する', () => {
    // Arrange: n=1.5 の内部から下向きに進み、外向き法線 (0,-1,0) の面から 30 度で射出する
    const direction = vec3(0.5, -0.866025403784439, 0);

    // Act
    const actual = refractDirection(direction, DOWN, 1.5, 1);

    // Assert
    expectVec3ToBeClose(actual, vec3(0.75, -0.661437827766148, 0));
  });

  it('主断面から外れた 3 次元の斜め入射でも正しく屈折する', () => {
    // Arrange
    const direction = normalize(vec3(1, -1, 1));

    // Act
    const actual = refractDirection(direction, UP, 1, 1.5);

    // Assert
    expectVec3ToBeClose(
      actual,
      vec3(0.384900179459750, -0.838870492807861, 0.384900179459750)
    );
  });

  it('屈折方向は入射面内にある（入射方向と法線の張る平面から外れない）', () => {
    // Arrange
    const direction = normalize(vec3(1, -1, 1));
    const planeNormalOfIncidencePlane = normalize(cross(direction, UP));

    // Act
    const actual = refractDirection(direction, UP, 1, 1.5);

    // Assert
    expect(Math.abs(dot(actual, planeNormalOfIncidencePlane))).toBeLessThanOrEqual(TOLERANCE);
  });

  it('法線が裏向きでも同じ結果を返す（内部で入射レイに正対させるため）', () => {
    // Arrange
    const direction = vec3(Math.SQRT1_2, -Math.SQRT1_2, 0);

    // Act
    const actual = refractDirection(direction, DOWN, 1, 1.5);

    // Assert
    expectVec3ToBeClose(actual, vec3(0.471404520791032, -0.881917103688197, 0));
  });

  it('任意の入射角で出力方向の角が refractionAngleDeg と一致する（角度経由の担保）', () => {
    // Arrange
    const incidenceAnglesDeg = [5, 15, 25, 35, 45, 55, 65, 75, 85];

    for (const angleDeg of incidenceAnglesDeg) {
      const direction = directionAtIncidence(angleDeg);
      const measuredIncidenceDeg = incidenceAngleDeg(direction, UP);
      const expected = refractionAngleDeg(1, 1.5, measuredIncidenceDeg);

      // Act
      const actual = incidenceAngleDeg(refractDirection(direction, UP, 1, 1.5), UP);

      // Assert
      expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-9);
    }
  });

  it('direction が単位ベクトルでなければ RangeError を投げる', () => {
    // Arrange & Act & Assert
    expect(() => refractDirection(NON_UNIT, UP, 1, 1.5)).toThrow(RangeError);
  });

  it('normal が単位ベクトルでなければ RangeError を投げる', () => {
    // Arrange & Act & Assert
    expect(() => refractDirection(vec3(0, -1, 0), NON_UNIT, 1, 1.5)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// D. 全反射境界の一致（単一の真実の源）
// ---------------------------------------------------------------------------

describe('refractDirection: 全反射境界が fresnel.canTransmit と一致する', () => {
  /** BK7 の n_d（λ = 587.56nm）。臨界角は空気に対して約 41.2463 度。 */
  const N_BK7 = BK7.catalogNd;

  it('臨界角のわずか下（41.24 度）では屈折方向が得られる', () => {
    // Arrange
    const direction = directionAtIncidence(41.24);

    // Act & Assert
    expect(() => refractDirection(direction, UP, N_BK7, 1)).not.toThrow();
  });

  it('臨界角のわずか上（41.26 度）では RangeError を投げる', () => {
    // Arrange
    const direction = directionAtIncidence(41.26);

    // Act & Assert
    expect(() => refractDirection(direction, UP, N_BK7, 1)).toThrow(RangeError);
  });

  it('密→疎で投げる／投げないの境界が canTransmit の判定と完全に一致する', () => {
    // Arrange: 0〜89 度を 0.25 度刻みで走査する
    for (let angleDeg = 0; angleDeg <= 89; angleDeg += 0.25) {
      const direction = directionAtIncidence(angleDeg);
      const measuredIncidenceDeg = incidenceAngleDeg(direction, UP);
      const expectedTransmits = canTransmit(N_BK7, 1, measuredIncidenceDeg);

      // Act
      let actualTransmits = true;
      try {
        refractDirection(direction, UP, N_BK7, 1);
      } catch {
        actualTransmits = false;
      }

      // Assert
      expect(actualTransmits).toBe(expectedTransmits);
    }
  });

  it('疎→密ではどの入射角でも屈折方向が得られる', () => {
    // Arrange
    for (let angleDeg = 0; angleDeg <= 89; angleDeg += 1) {
      const direction = directionAtIncidence(angleDeg);

      // Act & Assert
      expect(() => refractDirection(direction, UP, 1, N_BK7)).not.toThrow();
    }
  });

  it('屈折率が定義域外なら RangeError を伝播する（検証も canTransmit に委譲する）', () => {
    // Arrange
    const direction = vec3(0, -1, 0);

    // Act & Assert
    expect(() => refractDirection(direction, UP, 0.5, 1)).toThrow(RangeError);
  });
});
