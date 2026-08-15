/**
 * 光路追跡の方向ベクトル・プリミティブ。
 *
 * すべてプリズムの局所空間で完結する純粋関数であり、Three.js / DOM には依存しない。
 * 物理そのものは持たない: 全反射の判定は fresnel.canTransmit、屈折角は
 * refraction.refractionAngleDeg に委譲し、本モジュールは
 * 「角度を方向ベクトルへ戻す幾何変換」だけを担う（SPEC.md「光路計算」3）。
 *
 * ベクトル判別式 k = 1 - η²(1 - cos²θᵢ) による独自の全反射判定は使わない。
 * 臨界角ちょうどで canTransmit と境界がずれ、全反射の判定元が二重化するため。
 */

import type { Vec3 } from '../types/optics';

import { refractionAngleDeg } from './refraction';
import { addScaled, dot, length, lengthSquared, negate, normalize, scale, sub } from './vec3';

const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;

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
    throw new RangeError(`${label} は単位ベクトルである必要があります（長さ: ${currentLength}）`);
  }
}

/**
 * 法線を入射レイに正対させる（レイの進行方向と逆側を向かせる）。
 *
 * 面の外向き法線はレイがどちら側から来るかに関わらず一定なので、
 * 内部計算では常に `d · n_face < 0` となる向きへ揃えてから使う。
 *
 * @param direction 入射レイの進行方向（単位ベクトル）
 * @param normal 界面の外向き単位法線
 * @returns 入射レイに正対させた単位法線
 */
function facingNormal(direction: Vec3, normal: Vec3): Vec3 {
  return dot(direction, normal) < 0 ? normal : negate(normal);
}

/**
 * 界面法線から測った入射角を求める。
 *
 * cosθᵢ = |d · n| （法線の符号に依らないよう絶対値を取る）
 *
 * @param direction 入射レイの進行方向（単位ベクトル）
 * @param normal 界面の外向き単位法線。レイと同じ側を向いていてもよい
 * @returns 入射角 [deg]（0〜90）
 * @throws {RangeError} direction または normal が単位ベクトルでない場合
 */
export function incidenceAngleDeg(direction: Vec3, normal: Vec3): number {
  assertUnitVector(direction, 'direction');
  assertUnitVector(normal, 'normal');

  // 丸めで |d · n| が 1 をわずかに超えると acos が NaN になるため頭打ちにする
  const cosIncidence = Math.min(Math.abs(dot(direction, normal)), 1);

  return Math.acos(cosIncidence) * DEG_PER_RAD;
}

/**
 * 界面での鏡面反射の方向を求める。
 *
 * r = d - 2(d · n)n（n の符号に依らない）
 *
 * @param direction 入射レイの進行方向（単位ベクトル）
 * @param normal 界面の外向き単位法線。レイと同じ側を向いていてもよい
 * @returns 反射方向の単位ベクトル
 * @throws {RangeError} direction または normal が単位ベクトルでない場合
 */
export function reflectDirection(direction: Vec3, normal: Vec3): Vec3 {
  assertUnitVector(direction, 'direction');
  assertUnitVector(normal, 'normal');

  return sub(direction, scale(normal, 2 * dot(direction, normal)));
}

/**
 * 界面での屈折の方向を求める。
 *
 * 屈折角 θₜ は refraction.refractionAngleDeg に委譲し、ここでは角度を方向へ戻す。
 *   s = normalize(d + cosθᵢ·n_face)  界面の接線方向（|d + cosθᵢ·n_face| = sinθᵢ）
 *   t = sinθₜ·s - cosθₜ·n_face
 * 接線成分が厳密に 0 になる垂直入射では s が定義できないため、t = d とする。
 *
 * 全反射域では refractionAngleDeg が投げる RangeError をそのまま伝播させる（NaN を返さない）。
 * 屈折率の定義域検証も同関数（内部で canTransmit）に委譲する。
 *
 * @param direction 入射レイの進行方向（単位ベクトル）
 * @param normal 界面の外向き単位法線。レイと同じ側を向いていてもよい
 * @param nFrom 入射側媒質の屈折率（無次元）。1 以上の有限数
 * @param nTo 射出側媒質の屈折率（無次元）。1 以上の有限数
 * @returns 屈折方向の単位ベクトル
 * @throws {RangeError} 引数が定義域外の場合、または全反射域の場合
 */
export function refractDirection(
  direction: Vec3,
  normal: Vec3,
  nFrom: number,
  nTo: number
): Vec3 {
  const incidenceDeg = incidenceAngleDeg(direction, normal);
  const refractionDeg = refractionAngleDeg(nFrom, nTo, incidenceDeg);

  const faceNormal = facingNormal(direction, normal);
  const cosIncidence = Math.min(Math.abs(dot(direction, normal)), 1);

  // 接線ベクトル d + cosθᵢ·n_face。長さは sinθᵢ に等しい
  const tangent = addScaled(direction, faceNormal, cosIncidence);

  // 垂直入射では接線が定義できない。屈折も起きないため方向をそのまま返す
  if (lengthSquared(tangent) === 0) {
    return direction;
  }

  const refractionRad = refractionDeg * RAD_PER_DEG;

  return addScaled(
    scale(normalize(tangent), Math.sin(refractionRad)),
    faceNormal,
    -Math.cos(refractionRad)
  );
}
