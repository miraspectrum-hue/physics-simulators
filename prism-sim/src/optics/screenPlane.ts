/**
 * 仮想スクリーン面の生成と、面内 2 次元座標への射影を行う純粋関数群（TASKS 6-3）。
 *
 * DOM / Three.js には一切依存しない（CLAUDE.md の分離規約）。
 * **スクリーンを実体の板として `tracer` に渡す設計は採らない。** 描画都合の平面を
 * 光路追跡へ持ち込むと optics 層が演出を知ることになるため、交点は
 * 「射出レイ × 平面」の幾何計算として上位層が求める。
 *
 * レイと平面の交差そのものは `convexSolid.ts` の `intersectRayPlane()`（t を返す）と
 * `pointOnRay()`（t から点を作る）で既に賄えるので、ここには重複して置かない。
 */

import { cross, dot, length, sub } from './vec3';
import type { PlaneUV, ScreenPlane, Vec3 } from '../types/optics';

/**
 * 単位ベクトル判定の許容差。
 * `normalize()` の結果は丸めにより長さが 1 から 1e-16 程度ずれるため、厳密比較はできない。
 * 既存の `convexSolid.ts` / `tracer.ts` と同じ値・同じ流儀（モジュール内の私的ガード）に倣う。
 */
const UNIT_LENGTH_TOLERANCE = 1e-9;

/** 直交判定の許容差。内積は解析的にゼロだが、正規化を経ると同程度の丸めが残る。 */
const ORTHOGONALITY_TOLERANCE = 1e-9;

/**
 * ベクトルが単位ベクトルであることを検証する。
 *
 * 零ベクトルは長さ 0 なのでこの検査で同時に弾かれる。
 *
 * @param v 検証対象
 * @param label エラーメッセージ用の引数名
 * @throws {RangeError} v が単位ベクトルでない場合
 */
function assertUnitVector(v: Vec3, label: string): void {
  const currentLength = length(v);

  if (Math.abs(currentLength - 1) > UNIT_LENGTH_TOLERANCE) {
    throw new RangeError(`${label} は単位ベクトルである必要があります（長さ: ${currentLength}）`);
  }
}

/**
 * 2 つのベクトルが直交していることを検証する。
 *
 * 面内軸が法線と直交していなければ、uv は面への正射影にならない。
 *
 * @param a 一方のベクトル
 * @param b 他方のベクトル
 * @param label エラーメッセージ用の説明
 * @throws {RangeError} 内積がゼロとみなせない場合
 */
function assertOrthogonal(a: Vec3, b: Vec3, label: string): void {
  const projection = dot(a, b);

  if (Math.abs(projection) > ORTHOGONALITY_TOLERANCE) {
    throw new RangeError(`${label}（内積: ${projection}）`);
  }
}

/**
 * 値が正の有限数であることを検証する。
 *
 * @param value 検証対象
 * @param label エラーメッセージ用の引数名
 * @throws {RangeError} value が正の有限数でない場合
 */
function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label}は正の有限数である必要があります（受け取った値: ${value}）`);
  }
}

/**
 * 仮想スクリーン面を生成する。
 *
 * `axisV` は `normal × axisU` から導出する。呼び出し側に 2 軸を渡させると
 * 直交していない組を受け取りうるが、導出すれば正規直交が構造的に保証される。
 *
 * 検証は生成時にのみ行う（`ray()` / `plane()` と同じ流儀）。`worldToPlaneUV()` のような
 * 計算関数は検証しない。
 *
 * @param origin 面の中心（ワールド座標）
 * @param normal 面の法線（単位ベクトル）
 * @param axisU 面内の第 1 軸（単位ベクトル。`normal` と直交していること）
 * @param halfExtent 中心から縁までの距離。正の有限数
 * @returns スクリーン面
 * @throws {RangeError} 法線・第 1 軸が単位ベクトルでない、両者が直交しない、
 *                      または halfExtent が正の有限数でない場合
 */
export function screenPlane(
  origin: Vec3,
  normal: Vec3,
  axisU: Vec3,
  halfExtent: number
): ScreenPlane {
  assertUnitVector(normal, '法線');
  assertUnitVector(axisU, '面内の第 1 軸');
  assertOrthogonal(normal, axisU, '面内の第 1 軸は法線と直交している必要があります');
  assertPositiveFinite(halfExtent, '半幅');

  // 単位かつ直交な 2 本の外積は、長さ |a||b|sin90° = 1 の単位ベクトルになる。
  // 検証を通した後に導出するので、正規化を挟まずとも単位性が保証される
  const axisV = cross(normal, axisU);

  return { origin, normal, axisU, axisV, halfExtent };
}

/**
 * ワールド座標の点を、スクリーン面内の 2 次元座標へ射影する。
 *
 * u = (point − origin)·axisU、v = (point − origin)·axisV。
 * `axisU` / `axisV` は法線と直交するので、**法線方向のずれは uv に現れない**
 * （面への正射影になる）。
 *
 * 縁からのはみ出し（`|u| > halfExtent` など）は判定しない。有限スクリーンの
 * 切り落としは描画層の責務であり、ここは uv を返すことに徹する。
 *
 * @param screen スクリーン面
 * @param point ワールド座標の点
 * @returns 面内 2 次元座標
 */
export function worldToPlaneUV(screen: ScreenPlane, point: Vec3): PlaneUV {
  const offset = sub(point, screen.origin);

  return { u: dot(offset, screen.axisU), v: dot(offset, screen.axisV) };
}
