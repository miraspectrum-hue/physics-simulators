import { describe, expect, it } from 'vitest';

// NOTE: convexSolid.ts / vec3.ts は未実装。TDD の Red フェーズのため、この import は解決しない。
import {
  intersectRayPlane,
  plane,
  pointOnRay,
  ray,
  signedDistanceToPlane,
} from '../../src/optics/convexSolid';
import { normalize, vec3 } from '../../src/optics/vec3';

/**
 * src/optics/convexSolid.ts の受け入れ条件（1-3-3: レイ⇔平面交差）。
 *
 * 対象:
 *   ray(origin, direction)              — 半直線の生成（direction は単位ベクトル）
 *   plane(normal, distance)             — 平面 n·x = d の生成（normal は外向き単位ベクトル）
 *   signedDistanceToPlane(plane, point) — 符号付き距離 n·p - d
 *   pointOnRay(ray, t)                  — origin + t·direction
 *   intersectRayPlane(ray, plane)       — 交点パラメータ t
 *
 * 設計判断:
 *   - 法線は**外向き**（SPEC.md「光路計算」1）。凸多面体の内部は符号付き距離が負の側。
 *   - intersectRayPlane は平行（n·dir === 0 の厳密比較）のとき null を返す。
 *     交点が数学的に存在しないため。イプシロンは入れない。ほぼ平行なレイは t が
 *     巨大な有限値になるだけでスラブ法は正しく扱えるため、許容差は物理的意味を持つ
 *     上位層（tracer）の責務とする。
 *   - t < 0 はそのまま返す（null にしない）。プリズム内部で屈折した後のレイは
 *     始点が立体の内部にあり、後方の面も含めて near/far を分類する必要があるため。
 *     前方だけに絞るのは tracer の方針であり、幾何プリミティブの責務ではない。
 *   - 単位でない方向ベクトル・法線は RangeError（発生源で落とす）。
 *
 * 期待値は手計算できる軸並行ケースをハードコードする。
 */

/** 浮動小数の許容差。 */
const TOLERANCE = 1e-12;

/** 平面 x = 2（外向き法線 +x）。多くのケースで共有する。 */
const PLANE_X2 = { normal: { x: 1, y: 0, z: 0 }, distance: 2 };

// ---------------------------------------------------------------------------
// ray / plane: 生成と検証
// ---------------------------------------------------------------------------

describe('ray: 生成', () => {
  it('原点と単位方向をそのまま保持する', () => {
    // Arrange
    const origin = vec3(1, 2, 3);
    const direction = vec3(0, 0, 1);

    // Act
    const actual = ray(origin, direction);

    // Assert
    expect(actual).toEqual({ origin: { x: 1, y: 2, z: 3 }, direction: { x: 0, y: 0, z: 1 } });
  });

  it('方向が単位ベクトルでなければ RangeError を投げる', () => {
    // Arrange: 長さ 2 の方向ベクトル
    const direction = vec3(2, 0, 0);

    // Act & Assert
    expect(() => ray(vec3(0, 0, 0), direction)).toThrow(RangeError);
  });

  it('方向が零ベクトルなら RangeError を投げる', () => {
    // Arrange
    const direction = vec3(0, 0, 0);

    // Act & Assert
    expect(() => ray(vec3(0, 0, 0), direction)).toThrow(RangeError);
  });
});

describe('plane: 生成', () => {
  it('法線と距離をそのまま保持する', () => {
    // Arrange
    const normal = vec3(0, 1, 0);

    // Act
    const actual = plane(normal, -3);

    // Assert
    expect(actual).toEqual({ normal: { x: 0, y: 1, z: 0 }, distance: -3 });
  });

  it('法線が単位ベクトルでなければ RangeError を投げる', () => {
    // Arrange: 長さ 2 の法線
    const normal = vec3(0, 2, 0);

    // Act & Assert
    expect(() => plane(normal, 0)).toThrow(RangeError);
  });

  it('法線が零ベクトルなら RangeError を投げる', () => {
    // Arrange
    const normal = vec3(0, 0, 0);

    // Act & Assert
    expect(() => plane(normal, 0)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// pointOnRay
// ---------------------------------------------------------------------------

describe('pointOnRay: レイ上の点', () => {
  it('t = 0 では原点そのものを返す', () => {
    // Arrange
    const r = ray(vec3(1, 2, 3), vec3(0, 0, 1));

    // Act
    const actual = pointOnRay(r, 0);

    // Assert
    expect(actual).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('t = 2 では origin + 2·direction を返す', () => {
    // Arrange
    const r = ray(vec3(1, 2, 3), vec3(0, 0, 1));

    // Act
    const actual = pointOnRay(r, 2);

    // Assert
    expect(actual).toEqual({ x: 1, y: 2, z: 5 });
  });

  it('負の t ではレイの後方の点を返す', () => {
    // Arrange
    const r = ray(vec3(1, 2, 3), vec3(0, 0, 1));

    // Act
    const actual = pointOnRay(r, -4);

    // Assert
    expect(actual).toEqual({ x: 1, y: 2, z: -1 });
  });
});

// ---------------------------------------------------------------------------
// signedDistanceToPlane
// ---------------------------------------------------------------------------
//
// 外向き法線なので、負なら平面の内側（凸多面体の内部側）、正なら外側。

describe('signedDistanceToPlane: 符号付き距離', () => {
  it('平面の内側（法線と逆側）では負になる', () => {
    // Arrange: 平面 x = 2、点は原点
    const point = vec3(0, 0, 0);

    // Act
    const actual = signedDistanceToPlane(PLANE_X2, point);

    // Assert
    expect(actual).toBe(-2);
  });

  it('平面の外側（法線側）では正になる', () => {
    // Arrange: 平面 x = 2、点は x = 5
    const point = vec3(5, 0, 0);

    // Act
    const actual = signedDistanceToPlane(PLANE_X2, point);

    // Assert
    expect(actual).toBe(3);
  });

  it('平面上の点では 0 になる', () => {
    // Arrange
    const point = vec3(2, 100, -100);

    // Act
    const actual = signedDistanceToPlane(PLANE_X2, point);

    // Assert
    expect(actual).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// intersectRayPlane: 既知の幾何（軸並行ケース）
// ---------------------------------------------------------------------------

describe('intersectRayPlane: 正面から当たる基本形', () => {
  it('原点から +x へ進むと平面 x = 2 に t = 2 で当たる', () => {
    // Arrange
    const r = ray(vec3(0, 0, 0), vec3(1, 0, 0));

    // Act
    const actual = intersectRayPlane(r, PLANE_X2);

    // Assert
    expect(actual).toBe(2);
  });

  it('原点を通る平面 z = 0 に対し (0,0,5) から -z へ進むと t = 5 で当たる', () => {
    // Arrange
    const r = ray(vec3(0, 0, 5), vec3(0, 0, -1));
    const planeZ0 = plane(vec3(0, 0, 1), 0);

    // Act
    const actual = intersectRayPlane(r, planeZ0);

    // Assert
    expect(actual).toBe(5);
  });
});

describe('intersectRayPlane: 後方の交点は符号付きで返す', () => {
  it('原点から -x へ進むと平面 x = 2 に対し t = -2 を返す（null にしない）', () => {
    // Arrange
    const r = ray(vec3(0, 0, 0), vec3(-1, 0, 0));

    // Act
    const actual = intersectRayPlane(r, PLANE_X2);

    // Assert
    expect(actual).toBe(-2);
  });
});

describe('intersectRayPlane: 始点が平面上にある場合', () => {
  it('t = 0 を返す', () => {
    // Arrange
    const r = ray(vec3(2, 5, -3), vec3(1, 0, 0));

    // Act
    const actual = intersectRayPlane(r, PLANE_X2);

    // Assert
    expect(actual).toBe(0);
  });
});

describe('intersectRayPlane: 平行なレイ', () => {
  it('平面の内側を平行に進む場合は null を返す', () => {
    // Arrange: 平面 x = 2 に対し原点から +y へ進む（内側）
    const r = ray(vec3(0, 0, 0), vec3(0, 1, 0));

    // Act
    const actual = intersectRayPlane(r, PLANE_X2);

    // Assert
    expect(actual).toBeNull();
  });

  it('平面の外側を平行に進む場合も null を返す', () => {
    // Arrange: 平面 x = 2 に対し (5,0,0) から +y へ進む（外側）
    const r = ray(vec3(5, 0, 0), vec3(0, 1, 0));

    // Act
    const actual = intersectRayPlane(r, PLANE_X2);

    // Assert
    expect(actual).toBeNull();
  });

  it('平行なレイの内外は signedDistanceToPlane で判別できる', () => {
    // Arrange: 上の 2 ケースは交差結果が同じ null なので、側の判別は別関数が担う
    const insideOrigin = vec3(0, 0, 0);
    const outsideOrigin = vec3(5, 0, 0);

    // Act
    const insideDistance = signedDistanceToPlane(PLANE_X2, insideOrigin);
    const outsideDistance = signedDistanceToPlane(PLANE_X2, outsideOrigin);

    // Assert
    expect([insideDistance < 0, outsideDistance > 0]).toEqual([true, true]);
  });
});

describe('intersectRayPlane: 斜め入射', () => {
  it('45° で進むと t が交点までの距離 2√2 = 2.8284271247461903 になる', () => {
    // Arrange: 方向が単位ベクトルなので t は距離と一致する
    const r = ray(vec3(0, 0, 0), normalize(vec3(1, 1, 0)));
    const expectedT = 2.8284271247461903;

    // Act
    const actual = intersectRayPlane(r, PLANE_X2);

    // Assert
    expect(actual).not.toBeNull();
    expect(Math.abs((actual ?? Number.NaN) - expectedT)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('交点が平面上にある（符号付き距離が 0）', () => {
    // Arrange
    const r = ray(vec3(0, 0, 0), normalize(vec3(1, 1, 0)));

    // Act
    const t = intersectRayPlane(r, PLANE_X2);
    const intersection = pointOnRay(r, t ?? Number.NaN);

    // Assert
    expect(Math.abs(signedDistanceToPlane(PLANE_X2, intersection))).toBeLessThanOrEqual(TOLERANCE);
  });
});
