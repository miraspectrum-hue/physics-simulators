/**
 * 凸多面体の幾何プリミティブ。
 *
 * 本ファイルは幾何のみを扱い、全反射や前方への絞り込みといった光学的な
 * ポリシーは一切持たない（それらは tracer の責務）。
 * Three.js には依存しない。
 */

import type {
  ConvexSolid,
  ConvexSolidHit,
  Plane,
  Ray,
  TriangularPrismPlanes,
  TriangularPrismVertices,
  Vec3,
} from '../types/optics';

import { addScaled, dot, length, vec3 } from './vec3';

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

/** √3/2。底面法線 (0,-1,0) を ±120° 回転したときの x 成分。 */
const HALF_SQRT3 = Math.sqrt(3) / 2;

/**
 * 寸法が正の有限数であることを検証する。
 *
 * @param value 検証対象の寸法
 * @param label エラーメッセージ用の名称
 * @throws {RangeError} value が正の有限数でない場合
 */
function assertPositiveFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${label}は正の有限数である必要があります（受け取った値: ${value}）`);
  }
}

/**
 * 正三角柱（頂角 60°）の平面集合を生成する。
 *
 * SPEC.md「プリズムの標準配置」に従い、断面を XY 平面、押し出しを Z 軸、頂角を +Y、
 * 原点を重心とする基準姿勢で生成する。任意姿勢への変換は呼び出し側の責務。
 *
 * 正三角形では重心と内心が一致するため、側面 3 枚の距離はいずれも内接円半径
 * `r = a / (2√3)` に揃う。側面の法線は底面法線 (0,-1,0) を ±120° 回転した
 * (±√3/2, 1/2, 0) であり、端面は (0,0,±1)・距離 `L/2`。
 *
 * 頂角は 60° 固定とする（F-01 が正三角形と定めるため。頂角を変えると正三角形でなくなる）。
 *
 * @param sideLength 正三角形の一辺の長さ a。正の有限数
 * @param depth 押し出し長 L。正の有限数
 * @returns [左側面, 右側面, 底面, 前端面(+z), 後端面(-z)] の 5 平面
 * @throws {RangeError} 寸法が正の有限数でない場合
 */
export function createTriangularPrism(
  sideLength: number,
  depth: number
): TriangularPrismPlanes {
  assertPositiveFinite(sideLength, '一辺の長さ');
  assertPositiveFinite(depth, '押し出し長');

  const inradius = sideLength / (2 * Math.sqrt(3));
  const halfDepth = depth / 2;

  return [
    plane(vec3(-HALF_SQRT3, 0.5, 0), inradius),
    plane(vec3(HALF_SQRT3, 0.5, 0), inradius),
    plane(vec3(0, -1, 0), inradius),
    plane(vec3(0, 0, 1), halfDepth),
    plane(vec3(0, 0, -1), halfDepth),
  ];
}

/**
 * 正三角柱の頂点 6 個を返す。`createTriangularPrism` と同じ寸法・同じ基準姿勢の立体を表す。
 *
 * 描画メッシュをこの頂点から組み立てることで、絵のプリズムと光路計算の立体が
 * 同一の引数から生まれることを保証する（scene 層が独自に頂点を組むと両者がズレうる）。
 *
 * 断面の頂点は、頂角が +Y・重心が原点という基準姿勢から
 * 外接円半径 `R = a/√3`（頂角の y 座標）と内接円半径 `r = a/(2√3)`（底辺の y 座標）で決まる。
 *
 * @param sideLength 正三角形の一辺の長さ a。正の有限数
 * @param depth 押し出し長 L。正の有限数
 * @returns `[前(+z) の 頂点・左下・右下, 後(-z) の 頂点・左下・右下]`
 * @throws {RangeError} 寸法が正の有限数でない場合
 */
export function createTriangularPrismVertices(
  sideLength: number,
  depth: number
): TriangularPrismVertices {
  assertPositiveFinite(sideLength, '一辺の長さ');
  assertPositiveFinite(depth, '押し出し長');

  const circumradius = sideLength / Math.sqrt(3);
  const inradius = sideLength / (2 * Math.sqrt(3));
  const halfSide = sideLength / 2;
  const halfDepth = depth / 2;

  return [
    vec3(0, circumradius, halfDepth),
    vec3(-halfSide, -inradius, halfDepth),
    vec3(halfSide, -inradius, halfDepth),
    vec3(0, circumradius, -halfDepth),
    vec3(-halfSide, -inradius, -halfDepth),
    vec3(halfSide, -inradius, -halfDepth),
  ];
}
