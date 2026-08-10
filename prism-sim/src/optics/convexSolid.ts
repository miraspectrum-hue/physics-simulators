/**
 * 凸多面体の幾何プリミティブ。
 *
 * 本ファイルは幾何のみを扱い、全反射や前方への絞り込みといった光学的な
 * ポリシーは一切持たない（それらは tracer の責務）。
 * Three.js には依存しない。
 */

import type { Plane, Ray, Vec3 } from '../types/optics';

import { addScaled, dot, length } from './vec3';

/**
 * 単位ベクトル判定の許容差。
 * normalize() の結果は丸めにより長さが 1 から 1e-16 程度ずれるため、厳密比較はできない。
 */
const UNIT_LENGTH_TOLERANCE = 1e-9;

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
    throw new RangeError(
      `${label} は単位ベクトルである必要があります（長さ: ${currentLength}）`
    );
  }
}

/**
 * 半直線を生成する。
 *
 * direction を単位ベクトルに限定することで、交差パラメータ t が
 * そのまま原点からの距離になることを保証する。
 *
 * @param origin 始点
 * @param direction 進行方向（単位ベクトル）
 * @returns 生成されたレイ
 * @throws {RangeError} direction が単位ベクトルでない場合
 */
export function ray(origin: Vec3, direction: Vec3): Ray {
  assertUnitVector(direction, 'direction');

  return { origin, direction };
}

/**
 * 平面 n·x = d を生成する。
 *
 * @param normal 外向き単位法線
 * @param distance 原点から平面までの符号付き距離 d
 * @returns 生成された平面
 * @throws {RangeError} normal が単位ベクトルでない、または distance が有限数でない場合
 */
export function plane(normal: Vec3, distance: number): Plane {
  assertUnitVector(normal, 'normal');

  if (!Number.isFinite(distance)) {
    throw new RangeError(`平面の距離は有限数である必要があります（受け取った値: ${distance}）`);
  }

  return { normal, distance };
}

/**
 * レイ上のパラメータ t に対応する点を返す。
 *
 * @param targetRay レイ
 * @param t 交差パラメータ。direction が単位ベクトルなので始点からの符号付き距離に等しい
 * @returns origin + t·direction
 */
export function pointOnRay(targetRay: Ray, t: number): Vec3 {
  return addScaled(targetRay.origin, targetRay.direction, t);
}

/**
 * 点の平面に対する符号付き距離を返す。
 *
 * 法線が外向きであるため、負なら平面の内側（凸多面体の内部側）、正なら外側、0 なら面上。
 *
 * @param targetPlane 平面
 * @param point 点
 * @returns n·p - d
 */
export function signedDistanceToPlane(targetPlane: Plane, point: Vec3): number {
  return dot(targetPlane.normal, point) - targetPlane.distance;
}

/**
 * レイと平面の交差パラメータ t を返す。
 *
 * n·(o + t·d) = D を解いて t = (D - n·o) / (n·d)。
 *
 * 平行（n·d === 0）のときは交点が数学的に存在しないため null を返す。判定は厳密比較とし、
 * イプシロンを入れない。ほぼ平行なレイは t が巨大な有限値になるだけでスラブ法は正しく扱え、
 * 許容差は物理的な意味を持つ上位層（tracer）で決めるべきものだからである。
 *
 * t < 0 はそのまま返す。プリズム内部で屈折した後のレイは始点が立体の内部にあり、
 * 後方の面も含めて near / far を分類する必要があるため、前方への絞り込みは行わない。
 *
 * @param targetRay レイ
 * @param targetPlane 平面
 * @returns 交差パラメータ t（符号付き）。平行なら null
 */
export function intersectRayPlane(targetRay: Ray, targetPlane: Plane): number | null {
  const denominator = dot(targetPlane.normal, targetRay.direction);

  if (denominator === 0) {
    return null;
  }

  // -signedDistanceToPlane() ではなく引き算の順序で分子を作る。
  // 始点が面上のとき前者は -0 を返し、t === 0 の比較が成立しなくなるため
  const numerator = targetPlane.distance - dot(targetPlane.normal, targetRay.origin);

  return numerator / denominator;
}
