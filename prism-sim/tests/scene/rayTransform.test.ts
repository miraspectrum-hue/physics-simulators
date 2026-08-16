import { Matrix4 } from 'three';
import { describe, expect, it } from 'vitest';

import { ray } from '../../src/optics/convexSolid';
import { length, normalize, vec3 } from '../../src/optics/vec3';
import { transformLightPath, transformRay } from '../../src/scene/rayTransform';
import type { LightPath, Ray, Vec3 } from '../../src/types/optics';

/**
 * src/scene/rayTransform.ts の受け入れ条件。
 *
 * 対象:
 *   transformRay(worldRay, worldToLocal)       — レイを指定の行列で移す
 *   transformLightPath(localPath, localToWorld) — 光路を指定の行列で移す
 *
 * 設計判断:
 *   - optics は姿勢を知らず局所空間で追跡する。ワールド⇔局所の変換は scene 層の責務
 *     （SPEC.md「光路計算」1 の「ジオメトリを変換せず、レイを変換する」）。
 *   - 始点は点として（平行移動が効く）、方向はベクトルとして（効かない）変換する。
 *   - 扱うのは剛体変換（回転・平行移動）のみ。スケールは扱わない。
 *   - 依存は Three の数学（Matrix4）だけ。シーングラフにも DOM にも触れないため
 *     Vitest の対象に含まれる（CLAUDE.md「使用言語・フレームワーク」）。
 *   - transformRay は「与えた行列でレイを移す」関数なので、逆行列を渡せばワールドへ戻る。
 *     往復の検証はこの性質を使う。
 *
 * 期待値は手計算で確かめられる既知の変換をハードコードする。
 */

/** 座標の許容差。行列の積で数回ぶんの丸めしか乗らない。 */
const TOLERANCE = 1e-12;

/** ベクトルの各成分を許容差つきで比較する。 */
function expectVec3ToBeClose(actual: Vec3, expected: Vec3): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(TOLERANCE);
  expect(Math.abs(actual.z - expected.z)).toBeLessThanOrEqual(TOLERANCE);
}

/** Z 軸まわり 90 度の回転。(1,0,0) を (0,1,0) へ移す。 */
function rotationZ90(): Matrix4 {
  return new Matrix4().makeRotationZ(Math.PI / 2);
}

/** 平行移動のみの行列。 */
function translation(x: number, y: number, z: number): Matrix4 {
  return new Matrix4().makeTranslation(x, y, z);
}

/** 回転と平行移動を合成した剛体変換。 */
function rigidTransform(): Matrix4 {
  return new Matrix4()
    .makeRotationY(Math.PI / 3)
    .premultiply(new Matrix4().makeRotationX(-0.4))
    .premultiply(translation(2.5, -1.25, 0.75));
}

/** 検証に使う代表的なレイ（direction は単位ベクトル）。 */
function sampleRay(): Ray {
  return ray(vec3(1.5, -2, 0.5), normalize(vec3(2, -3, 1)));
}

/** 検証に使う代表的な光路。座標以外のフィールドが素通しされることの確認に用いる。 */
function sampleLightPath(): LightPath {
  return {
    wavelengthNm: 587.56,
    refractiveIndex: 1.5168,
    segments: [
      { start: vec3(-3, 0.5, 0), end: vec3(-0.5, 0.288675134594813, 0), insidePrism: false },
      { start: vec3(-0.5, 0.288675134594813, 0), end: vec3(0.5, 0.288675134594813, 0), insidePrism: true },
      { start: vec3(0.5, 0.288675134594813, 0), end: vec3(38, -12.9, 0), insidePrism: false },
    ],
    termination: 'exited',
  };
}

// ---------------------------------------------------------------------------
// T-1. 往復が恒等
// ---------------------------------------------------------------------------

describe('T-1. transformRay: 往復すると元のレイに戻る', () => {
  it('剛体変換とその逆行列を続けて適用すると元に戻る', () => {
    // Arrange
    const worldRay = sampleRay();
    const localToWorld = rigidTransform();
    const worldToLocal = localToWorld.clone().invert();

    // Act
    const localRay = transformRay(worldRay, worldToLocal);
    const actual = transformRay(localRay, localToWorld);

    // Assert
    expectVec3ToBeClose(actual.origin, worldRay.origin);
    expectVec3ToBeClose(actual.direction, worldRay.direction);
  });
});

// ---------------------------------------------------------------------------
// T-2. 既知の回転
// ---------------------------------------------------------------------------

describe('T-2. transformRay: Z 軸 90 度回転が既知の値に写る', () => {
  it('始点 (1,0,0) が (0,1,0) へ移る', () => {
    // Arrange
    const worldRay = ray(vec3(1, 0, 0), vec3(0, 0, 1));

    // Act
    const actual = transformRay(worldRay, rotationZ90());

    // Assert
    expectVec3ToBeClose(actual.origin, vec3(0, 1, 0));
  });

  it('方向 (1,0,0) が (0,1,0) へ移る', () => {
    // Arrange
    const worldRay = ray(vec3(0, 0, 0), vec3(1, 0, 0));

    // Act
    const actual = transformRay(worldRay, rotationZ90());

    // Assert
    expectVec3ToBeClose(actual.direction, vec3(0, 1, 0));
  });
});

// ---------------------------------------------------------------------------
// T-3. 平行移動は方向に効かない
// ---------------------------------------------------------------------------

describe('T-3. transformRay: 平行移動は始点だけを動かす', () => {
  it('始点に平行移動量が加わる', () => {
    // Arrange
    const worldRay = ray(vec3(1, 2, 3), vec3(0, 0, 1));

    // Act
    const actual = transformRay(worldRay, translation(10, -5, 0.5));

    // Assert
    expectVec3ToBeClose(actual.origin, vec3(11, -3, 3.5));
  });

  it('方向は平行移動で変わらない', () => {
    // Arrange
    const worldRay = ray(vec3(1, 2, 3), normalize(vec3(1, -1, 2)));

    // Act
    const actual = transformRay(worldRay, translation(10, -5, 0.5));

    // Assert
    expectVec3ToBeClose(actual.direction, normalize(vec3(1, -1, 2)));
  });
});

// ---------------------------------------------------------------------------
// T-4. 出力の direction が単位長
// ---------------------------------------------------------------------------

describe('T-4. transformRay: 出力の方向が単位ベクトルである', () => {
  it('剛体変換の後も長さが 1 のままである', () => {
    // Arrange
    const worldRay = sampleRay();

    // Act
    const actual = transformRay(worldRay, rigidTransform());

    // Assert
    expect(Math.abs(length(actual.direction) - 1)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('optics の ray() が受け付ける精度で単位ベクトルである', () => {
    // Arrange: convexSolid.ray は許容差 1e-9 で単位長を検証し、外れると RangeError を投げる
    const worldRay = sampleRay();

    // Act
    const actual = transformRay(worldRay, rigidTransform());

    // Assert
    expect(() => ray(actual.origin, actual.direction)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// T-5. 恒等行列
// ---------------------------------------------------------------------------

describe('T-5. transformRay: 恒等行列では値が変わらない', () => {
  it('始点と方向がそのまま返る', () => {
    // Arrange
    const worldRay = sampleRay();

    // Act
    const actual = transformRay(worldRay, new Matrix4());

    // Assert
    expectVec3ToBeClose(actual.origin, worldRay.origin);
    expectVec3ToBeClose(actual.direction, worldRay.direction);
  });
});

// ---------------------------------------------------------------------------
// T-6. transformLightPath
// ---------------------------------------------------------------------------

describe('T-6. transformLightPath: 座標だけを移し、他のフィールドは保存する', () => {
  it('波長・屈折率・内外の別・終わり方が保存される', () => {
    // Arrange
    const localPath = sampleLightPath();

    // Act
    const actual = transformLightPath(localPath, rigidTransform());

    // Assert
    expect(actual.wavelengthNm).toBe(587.56);
    expect(actual.refractiveIndex).toBe(1.5168);
    expect(actual.termination).toBe('exited');
    expect(actual.segments.map((segment) => segment.insidePrism)).toEqual([false, true, false]);
  });

  it('区間の本数が変わらない', () => {
    // Arrange
    const localPath = sampleLightPath();

    // Act
    const actual = transformLightPath(localPath, rigidTransform());

    // Assert
    expect(actual.segments.length).toBe(localPath.segments.length);
  });

  it('端点が点として変換される（平行移動が効く）', () => {
    // Arrange
    const localPath = sampleLightPath();

    // Act
    const actual = transformLightPath(localPath, translation(1, 2, 3));
    const first = actual.segments[0];

    // Assert
    expect(first).toBeDefined();
    expectVec3ToBeClose(first?.start ?? vec3(0, 0, 0), vec3(-2, 2.5, 3));
    expectVec3ToBeClose(first?.end ?? vec3(0, 0, 0), vec3(0.5, 2.288675134594813, 3));
  });

  it('Z 軸 90 度回転で端点が既知の位置へ移る', () => {
    // Arrange: 内部区間 (-0.5, 0.288675134594813, 0) -> (0.5, 0.288675134594813, 0)
    const localPath = sampleLightPath();

    // Act
    const actual = transformLightPath(localPath, rotationZ90());
    const inner = actual.segments[1];

    // Assert
    expect(inner).toBeDefined();
    expectVec3ToBeClose(inner?.start ?? vec3(0, 0, 0), vec3(-0.288675134594813, -0.5, 0));
    expectVec3ToBeClose(inner?.end ?? vec3(0, 0, 0), vec3(-0.288675134594813, 0.5, 0));
  });

  it('恒等行列では座標が変わらない', () => {
    // Arrange
    const localPath = sampleLightPath();

    // Act
    const actual = transformLightPath(localPath, new Matrix4());
    const inner = actual.segments[1];

    // Assert
    expect(inner).toBeDefined();
    expectVec3ToBeClose(inner?.start ?? vec3(0, 0, 0), vec3(-0.5, 0.288675134594813, 0));
    expectVec3ToBeClose(inner?.end ?? vec3(0, 0, 0), vec3(0.5, 0.288675134594813, 0));
  });
});
