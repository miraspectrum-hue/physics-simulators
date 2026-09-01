/**
 * 3 次元ベクトルの純粋演算。
 *
 * Three.js には依存しない（`THREE.Vector3` への変換は scene 層の責務）。
 * すべての関数は引数を変更せず、新しい不変オブジェクトを返す。
 * CLAUDE.md の「毎フレームの `new` 禁止」は scene 層と描画ホットパスに適用され、
 * optics 層は純粋性を優先して新規オブジェクトを返してよい。
 */

import type { Vec3 } from '../types/optics';

/**
 * 3 次元ベクトルを生成する。
 *
 * 成分が有限数でない場合は RangeError を投げ、NaN が光路計算へ伝播するのを発生源で防ぐ。
 * 以降のすべての演算はこのファクトリを通して結果を組み立てるため、
 * 途中で NaN が生じた場合もその場で落ちる。
 *
 * @param x x 成分
 * @param y y 成分
 * @param z z 成分
 * @returns 生成されたベクトル
 * @throws {RangeError} いずれかの成分が有限数でない場合
 */
export function vec3(x: number, y: number, z: number): Vec3 {
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    throw new RangeError(
      `ベクトルの成分は有限数である必要があります（受け取った値: ${x}, ${y}, ${z}）`
    );
  }

  return { x, y, z };
}

/**
 * ベクトルの和を返す。
 *
 * @param a 左辺
 * @param b 右辺
 * @returns a + b
 */
export function add(a: Vec3, b: Vec3): Vec3 {
  return vec3(a.x + b.x, a.y + b.y, a.z + b.z);
}

/**
 * ベクトルの差を返す。
 *
 * @param a 引かれる側
 * @param b 引く側
 * @returns a - b
 */
export function sub(a: Vec3, b: Vec3): Vec3 {
  return vec3(a.x - b.x, a.y - b.y, a.z - b.z);
}

/**
 * ベクトルのスカラー倍を返す。
 *
 * @param v ベクトル
 * @param s スカラー
 * @returns s·v
 */
export function scale(v: Vec3, s: number): Vec3 {
  return vec3(v.x * s, v.y * s, v.z * s);
}

/**
 * ベクトルの符号を反転した値を返す。
 *
 * @param v ベクトル
 * @returns -v
 */
export function negate(v: Vec3): Vec3 {
  return vec3(-v.x, -v.y, -v.z);
}

/**
 * 内積を返す。
 *
 * @param a 左辺
 * @param b 右辺
 * @returns a · b（無次元のスカラー）
 */
export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

/**
 * 外積を返す。右手系（x × y = z）。
 *
 * @param a 左辺
 * @param b 右辺
 * @returns a × b（両者に直交するベクトル）
 */
export function cross(a: Vec3, b: Vec3): Vec3 {
  return vec3(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
}

/**
 * 長さの 2 乗を返す。平方根を経ないため、比較用途では length より正確かつ高速。
 *
 * @param v ベクトル
 * @returns |v|²
 */
export function lengthSquared(v: Vec3): number {
  return v.x * v.x + v.y * v.y + v.z * v.z;
}

/**
 * 長さを返す。
 *
 * @param v ベクトル
 * @returns |v|
 */
export function length(v: Vec3): number {
  return Math.sqrt(lengthSquared(v));
}

/**
 * 単位ベクトルに正規化する。
 *
 * 零ベクトルは向きが定義できないため RangeError を投げる（NaN を返さない）。
 *
 * @param v ベクトル
 * @returns v と同じ向きの単位ベクトル
 * @throws {RangeError} v が零ベクトルの場合
 */
export function normalize(v: Vec3): Vec3 {
  const currentLength = length(v);

  if (currentLength === 0) {
    throw new RangeError('零ベクトルは正規化できません（向きが定義されないため）');
  }

  return scale(v, 1 / currentLength);
}

/**
 * a に b の s 倍を加えた値を返す。
 *
 * `add(a, scale(b, s))` と同値だが、中間オブジェクトを作らない。
 * レイ上の点 `origin + t·direction` や屈折ベクトルの算出で多用する。
 *
 * @param a 基点
 * @param b 加えるベクトル
 * @param s b に掛けるスカラー
 * @returns a + s·b
 */
export function addScaled(a: Vec3, b: Vec3, s: number): Vec3 {
  return vec3(a.x + b.x * s, a.y + b.y * s, a.z + b.z * s);
}
