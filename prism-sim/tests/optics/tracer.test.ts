import { describe, expect, it } from 'vitest';

import {
  incidenceAngleDeg,
  reflectDirection,
  refractDirection,
  traceRay,
  traceSpectrum,
} from '../../src/optics/tracer';
import {
  APEX_ANGLE_DEG,
  BK7,
  DIAMOND,
  EXIT_EXTENSION_LENGTH,
  MAX_BOUNCE_COUNT,
  SF10,
  WATER,
} from '../../src/optics/constants';
import { createTriangularPrism, ray } from '../../src/optics/convexSolid';
import { refractiveIndex } from '../../src/optics/dispersion';
import { canTransmit } from '../../src/optics/fresnel';
import { minimumDeviationDeg, prismDeviationDeg } from '../../src/optics/prism';
import { refractionAngleDeg } from '../../src/optics/refraction';
import { addScaled, cross, dot, length, normalize, sub, vec3 } from '../../src/optics/vec3';
import type {
  LightPath,
  PrismMaterial,
  Ray,
  Segment,
  TriangularPrismPlanes,
  Vec3,
} from '../../src/types/optics';

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

/** ベクトルの各成分を指定の許容差で比較する。 */
function expectVec3ToBeCloseWithin(actual: Vec3, expected: Vec3, tolerance: number): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(tolerance);
  expect(Math.abs(actual.z - expected.z)).toBeLessThanOrEqual(tolerance);
}

/** ベクトルの各成分を既定の許容差で比較する。 */
function expectVec3ToBeClose(actual: Vec3, expected: Vec3): void {
  expectVec3ToBeCloseWithin(actual, expected, TOLERANCE);
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

  it('座標軸に平行でない面への垂直入射でも出力が単位ベクトルである', () => {
    // Arrange: 左側面の外向き法線。(√3/2)² が 0.7499999999999999 になるため、
    //          d を厳密な逆向きにしても d·n は -1 にならず、接線に丸め誤差が残る。
    //          正規化の前に直交化しないと、その誤差が法線方向へ拡大して |t| が 1 からずれる
    const tiltedNormal = vec3(-Math.sqrt(3) / 2, 0.5, 0);
    const direction = vec3(Math.sqrt(3) / 2, -0.5, 0);

    // Act
    const actual = refractDirection(direction, tiltedNormal, 1, BK7.catalogNd);

    // Assert
    expect(Math.abs(length(actual) - 1)).toBeLessThanOrEqual(1e-15);
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

// ===========================================================================
// traceRay（サイクル ④b: 光路追跡の本体）
// ===========================================================================
//
// 検証は「既に単体テスト済みのスカラー層（prism.ts）と一致するか」を最強のオラクルとする。
// 3D 幾何を通した結果が 2D の解析解に戻ってくれば、幾何・屈折・全反射のすべてが正しい。
//
// 用いるプリズムは一辺 2・押し出し長 2 の正三角柱（SPEC「プリズムの標準配置」）。
//   内接円半径 r = 1/√3 = 0.577350269189626
//   頂点は (0, 1.154700538379252) と (±1, -0.577350269189626)
//   左側面の中点 (-0.5, 0.288675134594813) / 右側面の中点 (0.5, 0.288675134594813)
// 入射レイは常に左側面へ向け、面法線から θ₁ だけ倒した向きで作る（主断面 XY 内）。

/** 座標の許容差。3 単位の助走と asin/sin の往復で 1e-12 程度の丸めが乗る。 */
const POINT_TOLERANCE = 1e-9;

/** 方向ベクトルの許容差。垂直入射では接線が丸めで 1e-16 程度残り、方向に 5e-10 効く。 */
const DIRECTION_TOLERANCE = 1e-8;

/** 偏角の許容差 [deg]。スカラー層との一致は 9 桁で揃う。 */
const DEVIATION_TOLERANCE_DEG = 1e-6;

/** SPEC 参考値との許容差 [deg]（SPEC.md「検証に使う既知値」）。 */
const SPEC_TOLERANCE_DEG = 0.05;

const PRISM: TriangularPrismPlanes = createTriangularPrism(2, 2);

/** 左側面の中点。対称通過ではここが入射点になる。 */
const LEFT_FACE_MIDPOINT: Vec3 = vec3(-0.5, 0.288675134594813, 0);

/** 右側面の中点。対称通過の出射点（入射点の鏡像）。 */
const RIGHT_FACE_MIDPOINT: Vec3 = vec3(0.5, 0.288675134594813, 0);

/** 左側面の内向き単位法線。垂直入射の向きであり、+x から -30° に倒れている。 */
const LEFT_FACE_INWARD_NORMAL: Vec3 = vec3(0.866025403784439, -0.5, 0);

/** 入射点までの助走距離。プリズムの外から入射させるためのもので、結果には影響しない。 */
const APPROACH_DISTANCE = 3;

/** テストで用いる代表波長 [nm]（結果に記録されるだけで追跡計算には効かない）。 */
const TEST_WAVELENGTH_NM = 587.56;

/** [表示名, 屈折率, 対称通過となる入射角, SPEC の δ_min 参考値]。入射角は prism.test.ts と同値。 */
const SYMMETRIC_CASES: readonly [string, number, number, number][] = [
  ['BK7', BK7.catalogNd, 49.323347736, 38.65],
  ['SF10', SF10.catalogNd, 59.784649106, 59.57],
  ['水', WATER.catalogNd, 41.812877292, 23.63],
];

/**
 * 指定した点へ、左側面の法線から incidenceAngleDeg だけ倒した向きで入射するレイを作る。
 * 内向き法線が +x から -30° の向きなので、入射方向は +x から (θ₁ - 30)° の向きになる。
 */
function incidentRayAt(target: Vec3, incidenceAngleDeg: number): Ray {
  const directionRad = ((incidenceAngleDeg - 30) * Math.PI) / 180;
  const direction = vec3(Math.cos(directionRad), Math.sin(directionRad), 0);

  return ray(addScaled(target, direction, -APPROACH_DISTANCE), direction);
}

/** 左側面の中点へ入射角 θ₁ で入射するレイを作る。 */
function incidentRayOnLeftFace(incidenceAngleDeg: number): Ray {
  return incidentRayAt(LEFT_FACE_MIDPOINT, incidenceAngleDeg);
}

/** 区間の進行方向（単位ベクトル）。 */
function segmentDirection(segment: Segment): Vec3 {
  return normalize(sub(segment.end, segment.start));
}

/** 添字アクセスが undefined になり得るため、存在を確かめてから返す。 */
function segmentAt(path: LightPath, index: number): Segment {
  const segment = path.segments[index];

  if (segment === undefined) {
    throw new Error(`segments[${index}] が存在しません（長さ: ${path.segments.length}）`);
  }

  return segment;
}

/** プリズム内部を通る区間だけを取り出す。 */
function innerSegments(path: LightPath): readonly Segment[] {
  return path.segments.filter((segment) => segment.insidePrism);
}

/** 内部区間のうち index 番目。存在しなければ失敗させる。 */
function innerSegmentAt(path: LightPath, index: number): Segment {
  const inner = innerSegments(path);
  const segment = inner[index];

  if (segment === undefined) {
    throw new Error(`内部区間[${index}] が存在しません（本数: ${inner.length}）`);
  }

  return segment;
}

/** 最後の区間（射出区間、または打ち切られた区間）。 */
function lastSegment(path: LightPath): Segment {
  return segmentAt(path, path.segments.length - 1);
}

/** 2 つの方向ベクトルのなす角 [deg]。 */
function angleBetweenDeg(a: Vec3, b: Vec3): number {
  return (Math.acos(Math.min(Math.max(dot(a, b), -1), 1)) * 180) / Math.PI;
}

/** 入射方向と最終射出方向のなす角＝総偏角 [deg]。 */
function deviationDeg(path: LightPath): number {
  return angleBetweenDeg(segmentDirection(segmentAt(path, 0)), segmentDirection(lastSegment(path)));
}

/** BK7 で θ₁ 入射したときの光路。 */
function traceThroughBk7(incidenceAngleDeg: number): LightPath {
  return traceRay(
    incidentRayOnLeftFace(incidenceAngleDeg),
    PRISM,
    BK7.catalogNd,
    TEST_WAVELENGTH_NM
  );
}

// ---------------------------------------------------------------------------
// E. δ_min オラクル: 対称通過の 3 段縛り
// ---------------------------------------------------------------------------
//
// 対称通過（r₁ = r₂ = 30°）では内部の光線が底辺と平行になり、入射点と出射点が
// y 軸に関して鏡像になる。この 3 つが同時に成り立てば、幾何と屈折の両方が正しい。

describe('E. traceRay: 対称通過で最小偏角の関係が成り立つ', () => {
  it.each(SYMMETRIC_CASES)(
    '%s: 対称入射では内部の光線が底辺と平行 (1,0,0) になる',
    (_name, n, symmetricIncidenceDeg) => {
      // Arrange
      const incident = incidentRayOnLeftFace(symmetricIncidenceDeg);

      // Act
      const path = traceRay(incident, PRISM, n, TEST_WAVELENGTH_NM);
      const actual = segmentDirection(innerSegmentAt(path, 0));

      // Assert
      expectVec3ToBeCloseWithin(actual, vec3(1, 0, 0), POINT_TOLERANCE);
    }
  );

  it.each(SYMMETRIC_CASES)(
    '%s: 対称入射の偏角が minimumDeviationDeg と一致する',
    (_name, n, symmetricIncidenceDeg) => {
      // Arrange
      const incident = incidentRayOnLeftFace(symmetricIncidenceDeg);
      const expectedDeg = minimumDeviationDeg(APEX_ANGLE_DEG, n);

      // Act
      const actualDeg = deviationDeg(traceRay(incident, PRISM, n, TEST_WAVELENGTH_NM));

      // Assert
      expect(Math.abs(actualDeg - expectedDeg)).toBeLessThanOrEqual(DEVIATION_TOLERANCE_DEG);
    }
  );

  it.each(SYMMETRIC_CASES)(
    '%s: 出射点が入射点の鏡像 (0.5, 0.288675134594813, 0) になる',
    (_name, n, symmetricIncidenceDeg) => {
      // Arrange
      const incident = incidentRayOnLeftFace(symmetricIncidenceDeg);

      // Act
      const path = traceRay(incident, PRISM, n, TEST_WAVELENGTH_NM);
      const actual = innerSegmentAt(path, innerSegments(path).length - 1).end;

      // Assert
      expectVec3ToBeCloseWithin(actual, RIGHT_FACE_MIDPOINT, POINT_TOLERANCE);
    }
  );
});

// ---------------------------------------------------------------------------
// F. SPEC 参考値との一致
// ---------------------------------------------------------------------------

describe('F. traceRay: 最小偏角が SPEC の参考値と一致する', () => {
  it.each(SYMMETRIC_CASES)(
    '%s の最小偏角が SPEC 参考値と ±0.05° で一致する',
    (_name, n, symmetricIncidenceDeg, specReferenceDeg) => {
      // Arrange
      const incident = incidentRayOnLeftFace(symmetricIncidenceDeg);

      // Act
      const actualDeg = deviationDeg(traceRay(incident, PRISM, n, TEST_WAVELENGTH_NM));

      // Assert
      expect(Math.abs(actualDeg - specReferenceDeg)).toBeLessThanOrEqual(SPEC_TOLERANCE_DEG);
    }
  );
});

// ---------------------------------------------------------------------------
// G. スカラー整合性: 任意の入射角で prismDeviationDeg と一致する
// ---------------------------------------------------------------------------
//
// 倍精度で確認した偏角 [deg]（BK7, n = 1.51680）:
//   θ₁=35 → 43.319497491   θ₁=40 → 40.274231135   θ₁=45 → 38.955650936
//   θ₁=55 → 39.105362368   θ₁=60 → 40.196984697   θ₁=70 → 44.145154993

describe('G. traceRay: 偏角がスカラー層 prismDeviationDeg と一致する', () => {
  it.each([35, 40, 45, 55, 60, 70])('入射角 %d 度で両者の偏角が一致する', (incidenceDeg) => {
    // Arrange
    const expectedDeg = prismDeviationDeg(APEX_ANGLE_DEG, incidenceDeg, BK7.catalogNd);

    // Act
    const actualDeg = deviationDeg(traceThroughBk7(incidenceDeg));

    // Assert
    expect(Math.abs(actualDeg - expectedDeg)).toBeLessThanOrEqual(DEVIATION_TOLERANCE_DEG);
  });
});

// ---------------------------------------------------------------------------
// H. 垂直入射
// ---------------------------------------------------------------------------

describe('H. traceRay: 垂直入射では第一面で偏向しない', () => {
  it('入射面の法線に沿って入れた光は内部でも同じ向きに進む', () => {
    // Arrange
    const incident = ray(
      addScaled(LEFT_FACE_MIDPOINT, LEFT_FACE_INWARD_NORMAL, -APPROACH_DISTANCE),
      LEFT_FACE_INWARD_NORMAL
    );

    // Act
    const path = traceRay(incident, PRISM, BK7.catalogNd, TEST_WAVELENGTH_NM);
    const actual = segmentDirection(innerSegmentAt(path, 0));

    // Assert
    expectVec3ToBeCloseWithin(actual, LEFT_FACE_INWARD_NORMAL, DIRECTION_TOLERANCE);
  });
});

// ---------------------------------------------------------------------------
// I. 分散: 同じ入射でも波長ごとに偏角が変わる
// ---------------------------------------------------------------------------
//
// BK7 の Cauchy 屈折率と、対称入射角 49.323347736° での偏角（倍精度で確認）:
//   660nm（赤）  n = 1.514241873278237  → 38.422269936°
//   410nm（紫）  n = 1.529585127900059  → 39.782181108°

describe('I. traceRay: 波長ごとに偏角が変わる（分散）', () => {
  const RED_NM = 660;
  const VIOLET_NM = 410;

  /** 同一の入射レイを、波長 λ の BK7 屈折率で追跡したときの偏角。 */
  function deviationAtWavelengthDeg(wavelengthNm: number): number {
    const incident = incidentRayOnLeftFace(49.323347736);

    return deviationDeg(
      traceRay(incident, PRISM, refractiveIndex(BK7, wavelengthNm), wavelengthNm)
    );
  }

  it('赤（660nm）の偏角が確定値と一致する', () => {
    // Arrange & Act
    const actualDeg = deviationAtWavelengthDeg(RED_NM);

    // Assert
    expect(Math.abs(actualDeg - 38.422269936)).toBeLessThanOrEqual(DEVIATION_TOLERANCE_DEG);
  });

  it('紫（410nm）の偏角が確定値と一致する', () => {
    // Arrange & Act
    const actualDeg = deviationAtWavelengthDeg(VIOLET_NM);

    // Assert
    expect(Math.abs(actualDeg - 39.782181108)).toBeLessThanOrEqual(DEVIATION_TOLERANCE_DEG);
  });

  it('同一の入射で赤の偏角が紫より小さい（赤が最小偏角側）', () => {
    // Arrange & Act
    const redDeg = deviationAtWavelengthDeg(RED_NM);
    const violetDeg = deviationAtWavelengthDeg(VIOLET_NM);

    // Assert
    expect(redDeg).toBeLessThan(violetDeg);
  });
});

// ---------------------------------------------------------------------------
// J. 全反射: 出射面で全反射した光を追跡し続ける
// ---------------------------------------------------------------------------
//
// BK7 の臨界角は 41.2463°。入射角が小さいほど第二面の入射角 r₂ = 60 - r₁ が大きくなる。
// θ₁ = 10° では r₁ = 6.578°, r₂ = 53.42° > θc となり、出射面で全反射する。

describe('J. traceRay: 出射面で全反射した光路が破綻しない', () => {
  it('全反射する入射角では内部の区間が 2 本以上になる', () => {
    // Arrange & Act
    const actual = innerSegments(traceThroughBk7(10));

    // Assert
    expect(actual.length).toBeGreaterThanOrEqual(2);
  });

  it('全反射しても最終的に exited か bounceLimit で終わる', () => {
    // Arrange & Act
    const actual = traceThroughBk7(10).termination;

    // Assert
    expect(['exited', 'bounceLimit']).toContain(actual);
  });
});

// ---------------------------------------------------------------------------
// K. ダイヤモンド: 頂角 60° では入射面 → 出射面の直接透過が起きない
// ---------------------------------------------------------------------------
//
// n = 2.4173 では θc = 24.44° であり、A = 60° は透過条件 A < 2·θc を満たさない。
// したがって第二面（右側面）へ直接抜ける経路は存在せず、内部区間は必ず 2 本以上になる。

describe('K. traceRay: ダイヤモンドは入射面から出射面へ直接透過しない', () => {
  it('入射角 45 度で内部の区間が 2 本以上になる（直接透過しない）', () => {
    // Arrange
    const incident = incidentRayOnLeftFace(45);

    // Act
    const actual = innerSegments(traceRay(incident, PRISM, DIAMOND.catalogNd, TEST_WAVELENGTH_NM));

    // Assert
    expect(actual.length).toBeGreaterThanOrEqual(2);
  });

  it('入射角 -89〜89 度の全域で内部区間 1 本の透過が 1 件も起きない', () => {
    // Arrange
    const directTransmissionAngles: number[] = [];

    for (let incidenceDeg = -89; incidenceDeg <= 89; incidenceDeg += 1) {
      const incident = incidentRayOnLeftFace(incidenceDeg);
      const path = traceRay(incident, PRISM, DIAMOND.catalogNd, TEST_WAVELENGTH_NM);

      // Act
      if (path.termination === 'exited' && innerSegments(path).length === 1) {
        directTransmissionAngles.push(incidenceDeg);
      }
    }

    // Assert
    expect(directTransmissionAngles).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// L. プリズムを外れた光
// ---------------------------------------------------------------------------

describe('L. traceRay: プリズムと交差しない光は直進する', () => {
  /** プリズムの上方を横切り、交差しないレイ。 */
  const missingRay: Ray = ray(vec3(-5, 5, 0), vec3(1, 0, 0));

  it('termination が missed になる', () => {
    // Arrange & Act
    const actual = traceRay(missingRay, PRISM, BK7.catalogNd, TEST_WAVELENGTH_NM).termination;

    // Assert
    expect(actual).toBe('missed');
  });

  it('区間が 1 本だけで、プリズム内部を通らない', () => {
    // Arrange & Act
    const actual = traceRay(missingRay, PRISM, BK7.catalogNd, TEST_WAVELENGTH_NM).segments;

    // Assert
    expect(actual.length).toBe(1);
    expect(actual.map((segment) => segment.insidePrism)).toEqual([false]);
  });

  it('始点から EXIT_EXTENSION_LENGTH（40 単位）先で打ち切られる', () => {
    // Arrange & Act
    const actual = segmentAt(traceRay(missingRay, PRISM, BK7.catalogNd, TEST_WAVELENGTH_NM), 0);

    // Assert
    expect(actual.start).toEqual({ x: -5, y: 5, z: 0 });
    expect(actual.end).toEqual({ x: 35, y: 5, z: 0 });
  });
});

// ---------------------------------------------------------------------------
// M. 全体不変条件: 有限性・射出長・追跡の打ち切り
// ---------------------------------------------------------------------------

describe('M. traceRay: 入射角の全域で不変条件を満たす', () => {
  /** -89〜89 度を 1 度刻みで追跡した光路（全反射・かすめ入射・射出をすべて含む）。 */
  function sweepIncidenceAngles(): readonly LightPath[] {
    return Array.from({ length: 179 }, (_unused, index) => traceThroughBk7(index - 89));
  }

  it('すべての区間の座標が有限数である（NaN が混入しない）', () => {
    // Arrange
    const nonFinite: number[] = [];

    // Act
    for (const path of sweepIncidenceAngles()) {
      for (const segment of path.segments) {
        const components = [
          segment.start.x, segment.start.y, segment.start.z,
          segment.end.x, segment.end.y, segment.end.z,
        ];
        nonFinite.push(...components.filter((value) => !Number.isFinite(value)));
      }
    }

    // Assert
    expect(nonFinite).toEqual([]);
  });

  it('内部の区間数が MAX_BOUNCE_COUNT を超えない', () => {
    // Arrange & Act
    const maxInnerCount = Math.max(
      ...sweepIncidenceAngles().map((path) => innerSegments(path).length)
    );

    // Assert
    expect(maxInnerCount).toBeLessThanOrEqual(MAX_BOUNCE_COUNT);
  });

  it('射出した光路の最終区間の長さが EXIT_EXTENSION_LENGTH と一致する', () => {
    // Arrange
    const exitedPaths = sweepIncidenceAngles().filter((path) => path.termination === 'exited');

    // Act
    const maxDeviation = Math.max(
      ...exitedPaths.map((path) => {
        const exitSegment = lastSegment(path);

        return Math.abs(length(sub(exitSegment.end, exitSegment.start)) - EXIT_EXTENSION_LENGTH);
      })
    );

    // Assert
    expect(maxDeviation).toBeLessThanOrEqual(POINT_TOLERANCE);
  });
});

// ---------------------------------------------------------------------------
// N. 引数の記録
// ---------------------------------------------------------------------------

describe('N. traceRay: 追跡に使った波長と屈折率を記録する', () => {
  it('引数の波長と屈折率をそのまま返す', () => {
    // Arrange
    const incident = incidentRayOnLeftFace(45);

    // Act
    const actual = traceRay(incident, PRISM, SF10.catalogNd, 486.13);

    // Assert
    expect([actual.wavelengthNm, actual.refractiveIndex]).toEqual([486.13, SF10.catalogNd]);
  });
});

// ===========================================================================
// traceSpectrum（サイクル ④c: 波長ごとの一括追跡＝分光そのもの）
// ===========================================================================
//
// 依存は dispersion（λ → n）と traceRay のみ。色（λ → sRGB）は描画層の関心事なので
// ここでは扱わず、波長リストは呼び出し側から受け取る。
//
// 入射角は BK7 の対称通過となる 49.323347736° に固定し、波長だけを変える。
// 倍精度で確認した BK7 の屈折率と偏角:
//   660nm（赤）  n = 1.514241873278237  → 38.422269936°
//   550nm（緑）  n = 1.518484297520661  → 38.794950228°
//   410nm（紫）  n = 1.529585127900059  → 39.782181108°
// 同じ入射・同じ波長 587.56nm での材質差:
//   BK7   n = 1.516765916911719  → 38.643699466°
//   SF10  n = 1.728273001179825  → 64.278502828°

describe('O. traceSpectrum: 白色光が波長ごとに分かれる（分光）', () => {
  const RED_NM = 660;
  const GREEN_NM = 550;
  const VIOLET_NM = 410;

  /** 分光に用いる共通の入射レイ（BK7 の対称通過となる角度）。 */
  function spectrumIncidentRay(): Ray {
    return incidentRayOnLeftFace(49.323347736);
  }

  /** 添字アクセスが undefined になり得るため、存在を確かめてから返す。 */
  function elementAt<T>(items: readonly T[], index: number): T {
    const item = items[index];

    if (item === undefined) {
      throw new Error(`要素[${index}] が存在しません（長さ: ${items.length}）`);
    }

    return item;
  }

  /** 波長ごとの偏角 [deg]。 */
  function deviationsDeg(material: PrismMaterial, wavelengths: readonly number[]): number[] {
    return traceSpectrum(spectrumIncidentRay(), PRISM, material, wavelengths).map(deviationDeg);
  }

  it('赤・緑・紫の偏角が確定値と一致する', () => {
    // Arrange & Act
    const actualDegs = deviationsDeg(BK7, [RED_NM, GREEN_NM, VIOLET_NM]);

    // Assert
    expect(Math.abs(elementAt(actualDegs, 0) - 38.422269936))
      .toBeLessThanOrEqual(DEVIATION_TOLERANCE_DEG);
    expect(Math.abs(elementAt(actualDegs, 1) - 38.794950228))
      .toBeLessThanOrEqual(DEVIATION_TOLERANCE_DEG);
    expect(Math.abs(elementAt(actualDegs, 2) - 39.782181108))
      .toBeLessThanOrEqual(DEVIATION_TOLERANCE_DEG);
  });

  it('偏角が 赤 < 緑 < 紫 の順に大きくなる（波長が短いほど強く曲がる）', () => {
    // Arrange & Act
    const actualDegs = deviationsDeg(BK7, [RED_NM, GREEN_NM, VIOLET_NM]);

    // Assert
    expect(elementAt(actualDegs, 0)).toBeLessThan(elementAt(actualDegs, 1));
    expect(elementAt(actualDegs, 1)).toBeLessThan(elementAt(actualDegs, 2));
  });

  it('各要素が同じ屈折率で traceRay を呼んだ結果と全フィールド一致する', () => {
    // Arrange
    const wavelengths = [RED_NM, GREEN_NM, VIOLET_NM];
    const incident = spectrumIncidentRay();
    const expected = wavelengths.map((wavelengthNm) =>
      traceRay(incident, PRISM, refractiveIndex(BK7, wavelengthNm), wavelengthNm)
    );

    // Act
    const actual = traceSpectrum(incident, PRISM, BK7, wavelengths);

    // Assert
    expect(actual).toEqual(expected);
  });

  it('出力の本数が波長リストの長さと一致する', () => {
    // Arrange
    const wavelengths = [380, 450, 520, 590, 660, 730];

    // Act
    const actual = traceSpectrum(spectrumIncidentRay(), PRISM, BK7, wavelengths);

    // Assert
    expect(actual.length).toBe(wavelengths.length);
  });

  it('波長リストが空なら空配列を返す（例外を投げない）', () => {
    // Arrange & Act
    const actual = traceSpectrum(spectrumIncidentRay(), PRISM, BK7, []);

    // Assert
    expect(actual).toEqual([]);
  });

  it('同じ波長でも材質が違えば偏角が変わる（分散の大きい SF10 の方が曲がる）', () => {
    // Arrange & Act
    const bk7Deg = elementAt(deviationsDeg(BK7, [587.56]), 0);
    const sf10Deg = elementAt(deviationsDeg(SF10, [587.56]), 0);

    // Assert
    expect(Math.abs(bk7Deg - 38.643699466)).toBeLessThanOrEqual(DEVIATION_TOLERANCE_DEG);
    expect(Math.abs(sf10Deg - 64.278502828)).toBeLessThanOrEqual(DEVIATION_TOLERANCE_DEG);
  });
});
