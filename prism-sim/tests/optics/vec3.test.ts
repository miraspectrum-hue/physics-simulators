import { describe, expect, it } from 'vitest';

// NOTE: vec3.ts は未実装。TDD の Red フェーズのため、この import は解決しない。
import {
  add,
  addScaled,
  cross,
  dot,
  length,
  lengthSquared,
  negate,
  normalize,
  scale,
  sub,
  vec3,
} from '../../src/optics/vec3';
import type { Vec3 } from '../../src/types/optics';

/**
 * src/optics/vec3.ts の受け入れ条件（3 次元ベクトルの純粋演算）。
 *
 * 設計判断:
 *   - Three.js に依存しない。THREE.Vector3 への変換は scene 層の責務。
 *   - Vec3 は不変（readonly）。すべての演算は新しいオブジェクトを返す。
 *     CLAUDE.md の「毎フレームの new 禁止」は scene 層と描画ホットパスに適用され、
 *     optics 層は純粋性を優先して新規オブジェクトを返してよい。
 *   - 生成時に成分が有限数であることを検証し、不正値は RangeError（発生源で落とす）。
 *   - normalize は零ベクトルに対して RangeError（NaN を返さない）。
 *
 * 期待値は手計算で確かめられる値をハードコードする。
 */

/** 浮動小数の許容差。実装（除算か逆数の乗算か）で最終ビットが揺れるため厳密比較を避ける。 */
const TOLERANCE = 1e-12;

/** ベクトルの各成分を許容差つきで比較する。 */
function expectVec3ToBeClose(actual: Vec3, expected: Vec3): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(actual.z - expected.z)).toBeLessThanOrEqual(TOLERANCE);
}

// ---------------------------------------------------------------------------
// vec3: 生成
// ---------------------------------------------------------------------------

describe('vec3: 生成', () => {
  it('与えた成分をそのまま保持する', () => {
    // Arrange & Act
    const actual = vec3(1, -2, 3.5);

    // Assert
    expect(actual).toEqual({ x: 1, y: -2, z: 3.5 });
  });

  it('x が NaN なら RangeError を投げる', () => {
    // Arrange & Act & Assert
    expect(() => vec3(Number.NaN, 0, 0)).toThrow(RangeError);
  });

  it('y が Infinity なら RangeError を投げる', () => {
    // Arrange & Act & Assert
    expect(() => vec3(0, Number.POSITIVE_INFINITY, 0)).toThrow(RangeError);
  });

  it('z が -Infinity なら RangeError を投げる', () => {
    // Arrange & Act & Assert
    expect(() => vec3(0, 0, Number.NEGATIVE_INFINITY)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// add / sub
// ---------------------------------------------------------------------------

describe('add: 加算', () => {
  it('成分ごとに加算する', () => {
    // Arrange
    const a = vec3(1, 2, 3);
    const b = vec3(4, -5, 6);

    // Act
    const actual = add(a, b);

    // Assert
    expect(actual).toEqual({ x: 5, y: -3, z: 9 });
  });

  it('交換法則が成り立つ（a + b = b + a）', () => {
    // Arrange
    const a = vec3(1, 2, 3);
    const b = vec3(4, -5, 6);

    // Act & Assert
    expect(add(a, b)).toEqual(add(b, a));
  });
});

describe('sub: 減算', () => {
  it('成分ごとに減算する', () => {
    // Arrange
    const a = vec3(1, 2, 3);
    const b = vec3(4, -5, 6);

    // Act
    const actual = sub(a, b);

    // Assert
    expect(actual).toEqual({ x: -3, y: 7, z: -3 });
  });

  it('同じベクトルどうしの差は零ベクトルになる', () => {
    // Arrange
    const a = vec3(1, 2, 3);

    // Act
    const actual = sub(a, a);

    // Assert
    expect(actual).toEqual({ x: 0, y: 0, z: 0 });
  });
});

// ---------------------------------------------------------------------------
// scale / negate
// ---------------------------------------------------------------------------

describe('scale: スカラー倍', () => {
  it('各成分を定数倍する', () => {
    // Arrange
    const v = vec3(1, -2, 3);

    // Act
    const actual = scale(v, 2.5);

    // Assert
    expect(actual).toEqual({ x: 2.5, y: -5, z: 7.5 });
  });

  it('負のスカラーで向きが反転する', () => {
    // Arrange
    const v = vec3(1, -2, 3);

    // Act
    const actual = scale(v, -1);

    // Assert
    expect(actual).toEqual({ x: -1, y: 2, z: -3 });
  });
});

describe('negate: 符号反転', () => {
  it('全成分の符号が反転する', () => {
    // Arrange
    const v = vec3(1, -2, 3);

    // Act
    const actual = negate(v);

    // Assert
    expect(actual).toEqual({ x: -1, y: 2, z: -3 });
  });
});

// ---------------------------------------------------------------------------
// dot
// ---------------------------------------------------------------------------

describe('dot: 内積', () => {
  it('既知値と一致する（1·4 + 2·(-5) + 3·6 = 12）', () => {
    // Arrange
    const a = vec3(1, 2, 3);
    const b = vec3(4, -5, 6);

    // Act
    const actual = dot(a, b);

    // Assert
    expect(actual).toBe(12);
  });

  it('直交するベクトルの内積は 0 になる', () => {
    // Arrange
    const a = vec3(1, 0, 0);
    const b = vec3(0, 1, 0);

    // Act
    const actual = dot(a, b);

    // Assert
    expect(actual).toBe(0);
  });

  it('交換法則が成り立つ（a·b = b·a）', () => {
    // Arrange
    const a = vec3(1, 2, 3);
    const b = vec3(4, -5, 6);

    // Act & Assert
    expect(dot(a, b)).toBe(dot(b, a));
  });
});

// ---------------------------------------------------------------------------
// cross
// ---------------------------------------------------------------------------

describe('cross: 外積', () => {
  it('右手系である（x × y = z）', () => {
    // Arrange
    const x = vec3(1, 0, 0);
    const y = vec3(0, 1, 0);

    // Act
    const actual = cross(x, y);

    // Assert
    expect(actual).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('既知値と一致する（(1,2,3) × (4,5,6) = (-3,6,-3)）', () => {
    // Arrange
    const a = vec3(1, 2, 3);
    const b = vec3(4, 5, 6);

    // Act
    const actual = cross(a, b);

    // Assert
    expect(actual).toEqual({ x: -3, y: 6, z: -3 });
  });

  it('反交換律が成り立つ（a × b = -(b × a)）', () => {
    // Arrange
    const a = vec3(1, 2, 3);
    const b = vec3(4, 5, 6);

    // Act & Assert
    expect(cross(a, b)).toEqual(negate(cross(b, a)));
  });

  it('平行なベクトルどうしの外積は零ベクトルになる', () => {
    // Arrange
    const a = vec3(1, 2, 3);
    const b = vec3(2, 4, 6);

    // Act
    const actual = cross(a, b);

    // Assert
    expect(actual).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('結果は元の 2 ベクトルの両方に直交する', () => {
    // Arrange
    const a = vec3(1, 2, 3);
    const b = vec3(4, 5, 6);

    // Act
    const actual = cross(a, b);

    // Assert
    expect([dot(actual, a), dot(actual, b)]).toEqual([0, 0]);
  });
});

// ---------------------------------------------------------------------------
// length / lengthSquared
// ---------------------------------------------------------------------------

describe('length: 長さ', () => {
  it('3-4-5 の直角三角形で 5 になる', () => {
    // Arrange
    const v = vec3(3, 4, 0);

    // Act
    const actual = length(v);

    // Assert
    expect(actual).toBe(5);
  });

  it('(1,2,2) の長さが 3 になる', () => {
    // Arrange
    const v = vec3(1, 2, 2);

    // Act
    const actual = length(v);

    // Assert
    expect(actual).toBe(3);
  });

  it('零ベクトルの長さは 0 になる', () => {
    // Arrange
    const v = vec3(0, 0, 0);

    // Act
    const actual = length(v);

    // Assert
    expect(actual).toBe(0);
  });
});

describe('lengthSquared: 長さの 2 乗', () => {
  it('既知値と一致する（1² + 2² + 3² = 14）', () => {
    // Arrange
    const v = vec3(1, 2, 3);

    // Act
    const actual = lengthSquared(v);

    // Assert
    expect(actual).toBe(14);
  });

  it('平方根を経ないため length の 2 乗と厳密に一致する', () => {
    // Arrange
    const v = vec3(3, 4, 0);

    // Act
    const actual = lengthSquared(v);

    // Assert
    expect(actual).toBe(25);
  });
});

// ---------------------------------------------------------------------------
// normalize
// ---------------------------------------------------------------------------

describe('normalize: 正規化', () => {
  it('長さが 1 になる', () => {
    // Arrange
    const v = vec3(1, 2, 3);

    // Act
    const actual = normalize(v);

    // Assert
    expect(Math.abs(length(actual) - 1)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('軸方向のベクトルは向きを保ったまま単位化される', () => {
    // Arrange
    const v = vec3(0, 0, 5);

    // Act
    const actual = normalize(v);

    // Assert
    expectVec3ToBeClose(actual, { x: 0, y: 0, z: 1 });
  });

  it('(1,1,0) は各成分が 1/√2 = 0.707106781186547 になる', () => {
    // Arrange
    const v = vec3(1, 1, 0);
    const expectedComponent = 0.707106781186547;

    // Act
    const actual = normalize(v);

    // Assert
    expectVec3ToBeClose(actual, { x: expectedComponent, y: expectedComponent, z: 0 });
  });

  it('元のベクトルと同じ向きを保つ（負の成分でも反転しない）', () => {
    // Arrange
    const v = vec3(-3, 0, 4);

    // Act
    const actual = normalize(v);

    // Assert
    expectVec3ToBeClose(actual, { x: -0.6, y: 0, z: 0.8 });
  });

  it('零ベクトルでは RangeError を投げる', () => {
    // Arrange
    const v = vec3(0, 0, 0);

    // Act & Assert
    expect(() => normalize(v)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// addScaled
// ---------------------------------------------------------------------------

describe('addScaled: a + s·b', () => {
  it('既知値と一致する（(1,2,3) + 2·(4,-5,6) = (9,-8,15)）', () => {
    // Arrange
    const a = vec3(1, 2, 3);
    const b = vec3(4, -5, 6);

    // Act
    const actual = addScaled(a, b, 2);

    // Assert
    expect(actual).toEqual({ x: 9, y: -8, z: 15 });
  });

  it('スカラーが 0 なら a と等しくなる', () => {
    // Arrange
    const a = vec3(1, 2, 3);
    const b = vec3(4, -5, 6);

    // Act
    const actual = addScaled(a, b, 0);

    // Assert
    expect(actual).toEqual({ x: 1, y: 2, z: 3 });
  });

  it('add(a, scale(b, s)) と同じ結果になる', () => {
    // Arrange
    const a = vec3(1, 2, 3);
    const b = vec3(4, -5, 6);
    const s = 2.5;

    // Act
    const actual = addScaled(a, b, s);

    // Assert
    expectVec3ToBeClose(actual, add(a, scale(b, s)));
  });
});
