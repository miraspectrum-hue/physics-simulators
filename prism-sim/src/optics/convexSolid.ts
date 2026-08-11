/**
 * 凸多面体の幾何プリミティブ。
 *
 * 本ファイルは幾何のみを扱い、全反射や前方への絞り込みといった光学的な
 * ポリシーは一切持たない（それらは tracer の責務）。
 * Three.js には依存しない。
 */

import type { ConvexSolid, ConvexSolidHit, Plane, Ray, Vec3 } from '../types/optics';

import { addScaled, dot, length } from './vec3';

/** 3 次元で有界な凸多面体を構成するのに必要な半空間の最小枚数（四面体）。 */
const MIN_PLANE_COUNT = 4;

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

/**
 * レイと凸多面体の交差区間をスラブ法で求める。
 *
 * 凸多面体を半空間の共通部分とみなし、各平面が区間 [tEnter, tExit] を削っていく。
 * 外向き法線なので、n·dir < 0 の面は入口側（区間の下限を押し上げる）、
 * n·dir > 0 の面は出口側（上限を押し下げる）に働く。
 *
 * tEnter は負のまま返す。屈折後のレイは始点が立体の内部にあり、そこを 0 に
 * 丸めると「始点が内部だった」情報が失われて入口面と出口面を取り違えるため。
 * 前方への絞り込みは tracer の責務とする。
 *
 * 平行な面（n·dir === 0）は区間を削れないので、始点がその半空間の外側にあれば
 * レイ全体が立体と交わらず null、内側または面上なら制約なしとして読み飛ばす。
 * 面上（符号付き距離 0）を内側に含めるのは、凸多面体を閉集合として扱うため。
 *
 * @param targetRay レイ
 * @param solid 凸多面体（外向き法線つき平面の集合）
 * @returns 交差区間と入口・出口の面。交差しない場合は null
 * @throws {RangeError} 平面が 4 枚未満の場合（有界な立体を構成できない）
 */
export function intersectRayConvexSolid(
  targetRay: Ray,
  solid: ConvexSolid
): ConvexSolidHit | null {
  if (solid.length < MIN_PLANE_COUNT) {
    throw new RangeError(
      `凸多面体には平面が ${MIN_PLANE_COUNT} 枚以上必要です（受け取った枚数: ${solid.length}）`
    );
  }

  let tEnter = Number.NEGATIVE_INFINITY;
  let tExit = Number.POSITIVE_INFINITY;
  let enterPlane: Plane | null = null;
  let exitPlane: Plane | null = null;

  for (const currentPlane of solid) {
    const denominator = dot(currentPlane.normal, targetRay.direction);

    if (denominator === 0) {
      // 平行。始点が半空間の外側ならレイ全体が交わらない。内側・面上なら制約にならない
      if (signedDistanceToPlane(currentPlane, targetRay.origin) > 0) {
        return null;
      }
      continue;
    }

    const t = intersectRayPlane(targetRay, currentPlane);

    if (t === null) {
      continue;
    }

    if (denominator < 0) {
      if (t > tEnter) {
        tEnter = t;
        enterPlane = currentPlane;
      }
    } else if (t < tExit) {
      tExit = t;
      exitPlane = currentPlane;
    }

    if (tEnter > tExit) {
      return null;
    }
  }

  // 非有界な平面集合では入口・出口が確定しない（例: z 方向に開いた無限角柱）
  if (enterPlane === null || exitPlane === null) {
    return null;
  }

  return { tEnter, tExit, enterPlane, exitPlane };
}
