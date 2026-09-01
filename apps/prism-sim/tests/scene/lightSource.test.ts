import { describe, expect, it } from 'vitest';

import { createTriangularPrism, ray } from '../../src/optics/convexSolid';
import { incidenceAngleDeg } from '../../src/optics/tracer';
import { length, negate, normalize, sub, vec3 } from '../../src/optics/vec3';
import {
  createIncidentRay,
  faceNormalAngleDeg,
  sourceAngleToWorldDeg,
} from '../../src/scene/lightSource';
import type { Vec3 } from '../../src/types/optics';

/**
 * src/scene/lightSource.ts の受け入れ条件。
 *
 * 対象:
 *   createIncidentRay(aimPoint, angleDeg, distance) — 狙点を見込む入射レイ
 *
 * 設計判断:
 *   - 光源はプリズムから独立してワールドに存在する。狙点を固定して角度だけを振るので、
 *     入射角を掃引してもビームは狙点を外さない。外れるのはプリズム側を動かしたとき
 *     （TASKS 3-8）。
 *   - 向きは主断面（XY 平面）内の 1 自由度（SPEC.md「F-05」）。z 成分は常に 0。
 *   - 角度は進行方向を +x 軸から反時計回りに測る。スライダー値から world 角への
 *     読み替え（面法線の傾き分のオフセット）は呼び出し側の関心事で、ここには持ち込まない。
 *
 * 期待値は三角関数の既知値を独立に置く。0°/±45° は Math.SQRT1_2 など実装と別経路の
 * 定数で書き、±89° は「角度を atan2 で復元する」形にして同語反復を避ける。
 */

/** 座標の許容差。三角関数 1〜2 回ぶんの丸めしか乗らない。 */
const TOLERANCE = 1e-15;

/** 検証に使う狙点。原点を避けて、平行移動が効いていることも同時に見る。 */
const AIM_POINT: Vec3 = vec3(-0.5, 0.25, 0);

/** 検証に使う助走距離。 */
const DISTANCE = 3;

const DEG_PER_RAD = 180 / Math.PI;

/** ベクトルの各成分を許容差つきで比較する。 */
function expectVec3ToBeClose(actual: Vec3, expected: Vec3, tolerance = TOLERANCE): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.z - expected.z)).toBeLessThanOrEqual(tolerance);
}

// ---------------------------------------------------------------------------
// L-1. 既知角の direction
// ---------------------------------------------------------------------------

describe('L-1. createIncidentRay: 既知角の進行方向', () => {
  it('0 度では +x 方向になる', () => {
    // Arrange & Act
    const actual = createIncidentRay(AIM_POINT, 0, DISTANCE);

    // Assert
    expectVec3ToBeClose(actual.direction, vec3(1, 0, 0));
  });

  it('45 度では (√2/2, √2/2, 0) になる', () => {
    // Arrange: Math.SQRT1_2 は cos/sin を経由しない独立の定数
    // Act
    const actual = createIncidentRay(AIM_POINT, 45, DISTANCE);

    // Assert
    expectVec3ToBeClose(actual.direction, vec3(Math.SQRT1_2, Math.SQRT1_2, 0));
  });

  it('-45 度では (√2/2, -√2/2, 0) になる', () => {
    // Arrange & Act
    const actual = createIncidentRay(AIM_POINT, -45, DISTANCE);

    // Assert
    expectVec3ToBeClose(actual.direction, vec3(Math.SQRT1_2, -Math.SQRT1_2, 0));
  });

  it('89 度では atan2 で 89 度が復元される（ほぼ +y 向き）', () => {
    // Arrange: 端の角度は逆算で確かめ、cos/sin の書き写しになるのを避ける
    // Act
    const actual = createIncidentRay(AIM_POINT, 89, DISTANCE);
    const recoveredDeg = Math.atan2(actual.direction.y, actual.direction.x) * DEG_PER_RAD;

    // Assert
    expect(Math.abs(recoveredDeg - 89)).toBeLessThanOrEqual(1e-13);
    expect(actual.direction.y).toBeGreaterThan(0);
  });

  it('-89 度では atan2 で -89 度が復元される（ほぼ -y 向き）', () => {
    // Arrange & Act
    const actual = createIncidentRay(AIM_POINT, -89, DISTANCE);
    const recoveredDeg = Math.atan2(actual.direction.y, actual.direction.x) * DEG_PER_RAD;

    // Assert
    expect(Math.abs(recoveredDeg + 89)).toBeLessThanOrEqual(1e-13);
    expect(actual.direction.y).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
// L-2. 既知角の origin
// ---------------------------------------------------------------------------

describe('L-2. createIncidentRay: 既知角の始点', () => {
  it('0 度では狙点から -x 側へ助走距離だけ下がる', () => {
    // Arrange & Act
    const actual = createIncidentRay(AIM_POINT, 0, DISTANCE);

    // Assert: (-0.5 - 3, 0.25, 0)
    expectVec3ToBeClose(actual.origin, vec3(-3.5, 0.25, 0));
  });

  it('45 度では狙点から斜め手前へ下がる', () => {
    // Arrange: 3 × √2/2 = 2.1213203435596424
    const offset = DISTANCE * Math.SQRT1_2;

    // Act
    const actual = createIncidentRay(AIM_POINT, 45, DISTANCE);

    // Assert
    expectVec3ToBeClose(actual.origin, vec3(-0.5 - offset, 0.25 - offset, 0));
  });

  it('助走距離を変えると狙点からの隔たりがその値になる', () => {
    // Arrange & Act
    const near = createIncidentRay(AIM_POINT, 30, 1);
    const far = createIncidentRay(AIM_POINT, 30, 10);

    // Assert
    expect(Math.abs(length(sub(AIM_POINT, near.origin)) - 1)).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(length(sub(AIM_POINT, far.origin)) - 10)).toBeLessThanOrEqual(1e-14);
  });
});

// ---------------------------------------------------------------------------
// L-3. 方向が単位ベクトル
// ---------------------------------------------------------------------------

describe('L-3. createIncidentRay: 進行方向が単位ベクトルである', () => {
  it('代表的な角度すべてで長さが 1 になる', () => {
    // Arrange
    const angles = [-89, -45, -12.5, 0, 30, 45, 89];

    // Act & Assert
    for (const angleDeg of angles) {
      const actual = createIncidentRay(AIM_POINT, angleDeg, DISTANCE);
      expect(Math.abs(length(actual.direction) - 1)).toBeLessThanOrEqual(TOLERANCE);
    }
  });

  it('optics の ray() が受け付ける精度で単位ベクトルである', () => {
    // Arrange: convexSolid.ray は許容差 1e-9 で単位長を検証し、外れると RangeError を投げる
    const actual = createIncidentRay(AIM_POINT, 37.5, DISTANCE);

    // Act & Assert
    expect(() => ray(actual.origin, actual.direction)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// L-4. レイが狙点を通る
// ---------------------------------------------------------------------------

describe('L-4. createIncidentRay: レイが必ず狙点を通る', () => {
  it('始点から助走距離ぶん進むと狙点に一致する', () => {
    // Arrange
    const angleDeg = 63.5;

    // Act
    const actual = createIncidentRay(AIM_POINT, angleDeg, DISTANCE);
    const arrival = vec3(
      actual.origin.x + actual.direction.x * DISTANCE,
      actual.origin.y + actual.direction.y * DISTANCE,
      actual.origin.z + actual.direction.z * DISTANCE
    );

    // Assert
    expectVec3ToBeClose(arrival, AIM_POINT, 1e-14);
  });

  it('角度を変えても同じ狙点を通り続ける（掃引しても外さない）', () => {
    // Arrange & Act & Assert
    for (const angleDeg of [-89, -30, 0, 30, 89]) {
      const actual = createIncidentRay(AIM_POINT, angleDeg, DISTANCE);
      const arrival = vec3(
        actual.origin.x + actual.direction.x * DISTANCE,
        actual.origin.y + actual.direction.y * DISTANCE,
        actual.origin.z + actual.direction.z * DISTANCE
      );
      expectVec3ToBeClose(arrival, AIM_POINT, 1e-14);
    }
  });
});

// ---------------------------------------------------------------------------
// L-5. 主断面内（z 成分が 0）
// ---------------------------------------------------------------------------

describe('L-5. createIncidentRay: 主断面（XY 平面）内に収まる', () => {
  it('進行方向の z 成分が厳密に 0 である', () => {
    // Arrange & Act & Assert
    for (const angleDeg of [-89, -45, 0, 45, 89]) {
      expect(createIncidentRay(AIM_POINT, angleDeg, DISTANCE).direction.z).toBe(0);
    }
  });

  it('狙点の z がそのまま始点の z になる（面外へ動かさない）', () => {
    // Arrange: z を持つ狙点でも、方向が XY 内なので z は変わらない
    const offPlaneAim = vec3(-0.5, 0.25, 1.5);

    // Act
    const actual = createIncidentRay(offPlaneAim, 45, DISTANCE);

    // Assert
    expect(actual.origin.z).toBe(1.5);
  });
});

// ---------------------------------------------------------------------------
// L-6. 異常系
// ---------------------------------------------------------------------------

describe('L-6. createIncidentRay: 定義域外の入力を弾く', () => {
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    '助走距離 %p で RangeError を投げる',
    (invalidDistance) => {
      // Act & Assert
      expect(() => createIncidentRay(AIM_POINT, 45, invalidDistance)).toThrow(RangeError);
    }
  );

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    '角度 %p で RangeError を投げる',
    (invalidAngleDeg) => {
      // Act & Assert
      expect(() => createIncidentRay(AIM_POINT, invalidAngleDeg, DISTANCE)).toThrow(RangeError);
    }
  );
});

// ---------------------------------------------------------------------------
// L-7. スライダー角の較正
// ---------------------------------------------------------------------------

describe('L-7. sourceAngleToWorldDeg: スライダーの入射角をワールド角へ較正する', () => {
  /** 基準姿勢の左側面の内向き法線。外向き (-√3/2, 1/2, 0) の逆。 */
  const LEFT_FACE_INWARD_NORMAL = negate(createTriangularPrism(2, 2)[0].normal);

  it('基準姿勢の左側面の内向き法線は -30 度を向く', () => {
    // Arrange & Act
    const actual = faceNormalAngleDeg(LEFT_FACE_INWARD_NORMAL);

    // Assert: 外向き法線 (-√3/2, 1/2, 0) の逆向きなので atan2(-1/2, √3/2) = -30°
    expect(Math.abs(actual - -30)).toBeLessThanOrEqual(1e-13);
  });

  it('入射角 0 度は法線に沿った進行になる', () => {
    // Arrange & Act & Assert
    expect(sourceAngleToWorldDeg(0, -30)).toBe(-30);
  });

  it('入射角ぶんだけ法線から傾く', () => {
    // Arrange & Act & Assert
    expect(sourceAngleToWorldDeg(45, -30)).toBe(15);
    expect(sourceAngleToWorldDeg(-45, -30)).toBe(-75);
  });

  it('較正したレイの実測入射角がスライダー値と一致する（較正の正しさ）', () => {
    // Arrange: 較正 → レイ生成 → 面法線からの実測、と一周させて突き合わせる。
    //   optics 側の incidenceAngleDeg は外向き法線を取るので、内向き法線を反転して渡す
    const outwardNormal = createTriangularPrism(2, 2)[0].normal;
    const normalAngleDeg = faceNormalAngleDeg(negate(outwardNormal));

    // Act & Assert
    for (const sliderDeg of [-89, -45, 0, 30, 49.323347736, 89]) {
      const worldAngleDeg = sourceAngleToWorldDeg(sliderDeg, normalAngleDeg);
      const incidentRay = createIncidentRay(vec3(-0.5, 0.288675134594813, 0), worldAngleDeg, 3);
      const measured = incidenceAngleDeg(normalize(incidentRay.direction), outwardNormal);

      expect(Math.abs(measured - Math.abs(sliderDeg))).toBeLessThanOrEqual(1e-12);
    }
  });
});
