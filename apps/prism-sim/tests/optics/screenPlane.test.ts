import { describe, expect, it } from 'vitest';

import { screenPlane, worldToPlaneUV } from '../../src/optics/screenPlane';
import { normalize, vec3 } from '../../src/optics/vec3';
import type { ScreenPlane, Vec3 } from '../../src/types/optics';

/**
 * src/optics/screenPlane.ts の受け入れ条件（TASKS 6-3 の幾何部分）。
 *
 * 対象:
 *   screenPlane(origin, normal, axisU, halfExtent) — スクリーン面を生成し検証する
 *   worldToPlaneUV(screen, point)                  — 世界点を面内 2 次元座標へ射影する
 *
 * 設計判断:
 *   - 純粋関数。DOM / Three.js には一切触れない。
 *   - **レイと平面の交差はここに置かない。** `convexSolid.ts` の `intersectRayPlane()`
 *     （交差パラメータ t を返す）と `pointOnRay()`（t から点を作る）で既に賄えており、
 *     同じ幾何を 2 か所に置くと検証されていない式が増える。
 *   - 検証は生成時（`screenPlane`）にのみ行う。`worldToPlaneUV` は計算に徹する。
 *     これは `ray()` / `plane()` が検証し、`signedDistanceToPlane()` /
 *     `intersectRayPlane()` が検証しない既存の流儀に倣ったもの。
 *   - `axisV` は呼び出し側に渡させず `normal × axisU` から導出する。
 *     正規直交性を構造的に保証し、崩れた基底を受け取る経路を塞ぐため。
 *   - 縁のはみ出し判定（|u| > halfExtent）はここでは行わない。描画層の責務。
 *
 * 期待値の出典:
 *   軸に平行な配置は手計算で厳密に決まる値。斜めの配置は解析値を倍精度で評価した確定値。
 *   前者は toBe で厳密比較し、後者は演算順序の違いを吸収する許容差で比較する
 *   （どちらを選んだかは各テストのコメントに記す）。
 */

/** 斜め配置の許容差。内積の加算順序が変わっても吸収できる幅。 */
const UV_TOLERANCE = 1e-12;

/** 軸に平行な基本のスクリーン。原点中心、法線 +z、u 軸 +x（したがって v 軸は +y）。 */
const SCREEN_XY: ScreenPlane = {
  origin: vec3(0, 0, 0),
  normal: vec3(0, 0, 1),
  axisU: vec3(1, 0, 0),
  axisV: vec3(0, 1, 0),
  halfExtent: 5,
};

/** 面内で 45° 回した u 軸を持つスクリーン。法線は +z のまま。 */
const SCREEN_ROTATED: ScreenPlane = {
  origin: vec3(0, 0, 0),
  normal: vec3(0, 0, 1),
  axisU: vec3(0.7071067811865475, 0.7071067811865475, 0),
  axisV: vec3(-0.7071067811865475, 0.7071067811865475, 0),
  halfExtent: 5,
};

/** 法線も面内軸も斜めなスクリーン。中心が原点から離れている。 */
const SCREEN_OBLIQUE: ScreenPlane = {
  origin: vec3(1, 2, 3),
  normal: vec3(0.5773502691896258, 0.5773502691896258, 0.5773502691896258),
  axisU: vec3(0.7071067811865475, -0.7071067811865475, 0),
  axisV: vec3(0.408248290463863, 0.408248290463863, -0.816496580927726),
  halfExtent: 4,
};

/** 単位ベクトルでないベクトル（法線の検証に使う入力）。 */
const NON_UNIT: Vec3 = vec3(0, 0, 2);

/**
 * 単位ベクトルではないが、法線 +z とは直交している面内向きのベクトル。
 *
 * 第 1 軸の単位性を検証するテストには**これを使わなければならない**。法線と平行な
 * `NON_UNIT` を渡すと直交検証にも引っかかり、単位ベクトル検証を外しても
 * RangeError が出てしまう（変異テストで実際に生き残った）。
 */
const NON_UNIT_IN_PLANE: Vec3 = vec3(2, 0, 0);

// ---------------------------------------------------------------------------
// A. screenPlane: 生成と検証
// ---------------------------------------------------------------------------

describe('A. screenPlane: 与えた値を保持し、第 2 軸を導出する', () => {
  it('原点・法線・第 1 軸・半幅をそのまま保持する', () => {
    // Arrange
    const origin = vec3(1, 2, 3);
    const normal = vec3(0, 0, 1);
    const axisU = vec3(1, 0, 0);

    // Act
    const screen = screenPlane(origin, normal, axisU, 4);

    // Assert（入力をそのまま持つので厳密比較でよい）
    expect(screen.origin).toEqual(origin);
    expect(screen.normal).toEqual(normal);
    expect(screen.axisU).toEqual(axisU);
    expect(screen.halfExtent).toBe(4);
  });

  it('第 2 軸を normal × axisU として導出する（+z × +x = +y）', () => {
    // Arrange
    const normal = vec3(0, 0, 1);
    const axisU = vec3(1, 0, 0);

    // Act
    const screen = screenPlane(vec3(0, 0, 0), normal, axisU, 1);

    // Assert（外積が軸に平行なので厳密に一致する）
    expect(screen.axisV).toEqual(vec3(0, 1, 0));
  });

  it('斜めの基底でも第 2 軸が法線・第 1 軸の双方と直交する', () => {
    // Arrange
    const normal = normalize(vec3(1, 1, 1));
    const axisU = normalize(vec3(1, -1, 0));

    // Act
    const screen = screenPlane(vec3(0, 0, 0), normal, axisU, 1);
    const dotNormal =
      screen.axisV.x * normal.x + screen.axisV.y * normal.y + screen.axisV.z * normal.z;
    const dotAxisU =
      screen.axisV.x * axisU.x + screen.axisV.y * axisU.y + screen.axisV.z * axisU.z;

    // Assert（直交は解析的にゼロ。丸めが乗るため許容差で見る）
    expect(Math.abs(dotNormal)).toBeLessThanOrEqual(UV_TOLERANCE);
    expect(Math.abs(dotAxisU)).toBeLessThanOrEqual(UV_TOLERANCE);
  });

  it('導出した第 2 軸が単位ベクトルになる', () => {
    // Arrange
    const normal = normalize(vec3(1, 1, 1));
    const axisU = normalize(vec3(1, -1, 0));

    // Act
    const screen = screenPlane(vec3(0, 0, 0), normal, axisU, 1);
    const lengthV = Math.hypot(screen.axisV.x, screen.axisV.y, screen.axisV.z);

    // Assert
    expect(Math.abs(lengthV - 1)).toBeLessThanOrEqual(UV_TOLERANCE);
  });

  it('法線が単位ベクトルでなければ RangeError を投げる', () => {
    // Act & Assert
    expect(() => screenPlane(vec3(0, 0, 0), NON_UNIT, vec3(1, 0, 0), 1)).toThrow(RangeError);
  });

  it('第 1 軸が単位ベクトルでなければ RangeError を投げる', () => {
    // Act & Assert（法線と直交する非単位ベクトル。単位性の検証だけが弾ける入力）
    expect(() => screenPlane(vec3(0, 0, 0), vec3(0, 0, 1), NON_UNIT_IN_PLANE, 1)).toThrow(
      RangeError
    );
  });

  it('第 1 軸が法線と直交していなければ RangeError を投げる', () => {
    // Arrange（法線と同じ向きなので面内軸になりえない）
    const parallelAxis = vec3(0, 0, 1);

    // Act & Assert
    expect(() => screenPlane(vec3(0, 0, 0), vec3(0, 0, 1), parallelAxis, 1)).toThrow(RangeError);
  });

  it('半幅が正の有限数でなければ RangeError を投げる', () => {
    // Act & Assert
    expect(() => screenPlane(vec3(0, 0, 0), vec3(0, 0, 1), vec3(1, 0, 0), 0)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// B. worldToPlaneUV: 軸に平行な配置（厳密値）
// ---------------------------------------------------------------------------

describe('B. worldToPlaneUV: 軸に平行なスクリーンでの射影', () => {
  it('面の中心は (0, 0) になる', () => {
    // Act
    const uv = worldToPlaneUV(SCREEN_XY, vec3(0, 0, 0));

    // Assert（軸に平行なので厳密に決まる）
    expect(uv.u).toBe(0);
    expect(uv.v).toBe(0);
  });

  it('u 軸方向へ 3 進んだ点は (3, 0) になる', () => {
    // Act
    const uv = worldToPlaneUV(SCREEN_XY, vec3(3, 0, 0));

    // Assert
    expect(uv.u).toBe(3);
    expect(uv.v).toBe(0);
  });

  it('v 軸方向へ 4 進んだ点は (0, 4) になる', () => {
    // Act
    const uv = worldToPlaneUV(SCREEN_XY, vec3(0, 4, 0));

    // Assert
    expect(uv.u).toBe(0);
    expect(uv.v).toBe(4);
  });

  it('軸の負の側では uv も負になる', () => {
    // Act
    const uv = worldToPlaneUV(SCREEN_XY, vec3(-2, -6, 0));

    // Assert
    expect(uv.u).toBe(-2);
    expect(uv.v).toBe(-6);
  });

  it('法線方向へずらしても uv は変わらない（面への正射影である）', () => {
    // Arrange
    const onPlane = vec3(3, 4, 0);
    const offPlane = vec3(3, 4, 17);

    // Act
    const uvOnPlane = worldToPlaneUV(SCREEN_XY, onPlane);
    const uvOffPlane = worldToPlaneUV(SCREEN_XY, offPlane);

    // Assert
    expect(uvOffPlane).toEqual(uvOnPlane);
  });

  it('半幅を超えた点でも切り落とさずに uv を返す（縁の判定は描画層の責務）', () => {
    // Arrange（halfExtent = 5 の外側）
    const outside = vec3(12, 0, 0);

    // Act
    const uv = worldToPlaneUV(SCREEN_XY, outside);

    // Assert
    expect(uv.u).toBe(12);
    expect(uv.v).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// C. worldToPlaneUV: 面内で回転した軸（斜めの確定値）
// ---------------------------------------------------------------------------

describe('C. worldToPlaneUV: 面内で 45° 回した軸での射影', () => {
  it('u 軸に沿う点 (2, 2, 0) は u = 2.82842712474619 / v = 0 になる', () => {
    // Act
    const uv = worldToPlaneUV(SCREEN_ROTATED, vec3(2, 2, 0));

    // Assert（内積の加算順序で下位桁が動きうるため許容差で見る）
    expect(Math.abs(uv.u - 2.82842712474619)).toBeLessThanOrEqual(UV_TOLERANCE);
    expect(Math.abs(uv.v)).toBeLessThanOrEqual(UV_TOLERANCE);
  });

  it('v 軸に沿う点 (1, -1, 0) は u = 0 / v = -1.414213562373095 になる', () => {
    // Act
    const uv = worldToPlaneUV(SCREEN_ROTATED, vec3(1, -1, 0));

    // Assert
    expect(Math.abs(uv.u)).toBeLessThanOrEqual(UV_TOLERANCE);
    expect(Math.abs(uv.v - -1.414213562373095)).toBeLessThanOrEqual(UV_TOLERANCE);
  });

  it('法線方向に大きくずれた点 (3, 1, 9) でも面内成分だけが残る', () => {
    // Act
    const uv = worldToPlaneUV(SCREEN_ROTATED, vec3(3, 1, 9));

    // Assert
    expect(Math.abs(uv.u - 2.82842712474619)).toBeLessThanOrEqual(UV_TOLERANCE);
    expect(Math.abs(uv.v - -1.414213562373095)).toBeLessThanOrEqual(UV_TOLERANCE);
  });
});

// ---------------------------------------------------------------------------
// D. worldToPlaneUV: 法線も面内軸も斜め（中心が原点から離れている）
// ---------------------------------------------------------------------------

describe('D. worldToPlaneUV: 斜めのスクリーンでの射影', () => {
  it('面の中心 (1, 2, 3) は (0, 0) になる', () => {
    // Act
    const uv = worldToPlaneUV(SCREEN_OBLIQUE, vec3(1, 2, 3));

    // Assert（差がゼロベクトルになるので厳密に 0）
    expect(uv.u).toBe(0);
    expect(uv.v).toBe(0);
  });

  it('u 軸に沿う点 (4, -1, 3) は u = 4.242640687119285 / v = 0 になる', () => {
    // Act
    const uv = worldToPlaneUV(SCREEN_OBLIQUE, vec3(4, -1, 3));

    // Assert
    expect(Math.abs(uv.u - 4.242640687119285)).toBeLessThanOrEqual(UV_TOLERANCE);
    expect(Math.abs(uv.v)).toBeLessThanOrEqual(UV_TOLERANCE);
  });

  it('中心から法線方向にだけずらした点 (2.5, 3.5, 4.5) は (0, 0) のままである', () => {
    // Act
    const uv = worldToPlaneUV(SCREEN_OBLIQUE, vec3(2.5, 3.5, 4.5));

    // Assert
    expect(Math.abs(uv.u)).toBeLessThanOrEqual(UV_TOLERANCE);
    expect(Math.abs(uv.v)).toBeLessThanOrEqual(UV_TOLERANCE);
  });
});
