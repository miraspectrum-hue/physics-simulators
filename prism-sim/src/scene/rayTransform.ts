import { Vector3 } from 'three';
import type { Matrix4 } from 'three';

import { vec3 } from '../optics/vec3';
import type { LightPath, Ray, Segment, Vec3 } from '../types/optics';

/**
 * レイと光路を任意の剛体変換で移す純粋関数。
 *
 * optics は姿勢を知らず、プリズムの局所空間で追跡する（SPEC.md「光路計算」1）。
 * 「ジオメトリを変換せず、レイを変換する」定石に従い、この層が
 * 入射レイを局所へ引き込み、得られた光路をワールドへ戻す責務を持つ。
 * どちら向きの変換になるかは渡す行列が決めるため、関数は向きを名前に持たない。
 *
 * 依存するのは Three の数学（`Matrix4`）だけで、シーングラフにも DOM にも触れない。
 * 引数を変更せず新しいオブジェクトを返す（`src/optics/` と同じ流儀）。
 * 扱うのは剛体変換（回転・平行移動）のみ。スケールは扱わない。
 */

/**
 * 変換の作業用インスタンス。呼び出しのたびに生成しない
 * （CLAUDE.md「毎フレームでの `new` を禁止」）。返り値は不変の `Vec3` として作り直す。
 */
const workVector = new Vector3();

/**
 * レイを指定の行列で移す。
 *
 * 始点は点として（平行移動が効く）、方向はベクトルとして（平行移動が効かない）変換する。
 * ワールド → 局所なら `matrixWorld` の逆行列を、局所 → ワールドなら `matrixWorld` を渡す。
 *
 * @param ray 移す前のレイ（direction は単位ベクトル）
 * @param matrix 剛体変換の行列
 * @returns 移した後のレイ（direction は単位ベクトル）
 */
export function transformRay(ray: Ray, matrix: Matrix4): Ray {
  const origin = transformPoint(ray.origin, matrix);

  // transformDirection は上 3×3 だけを適用し、結果を正規化して返す。
  // 剛体変換なら数学的には長さが保たれるが、行列の丸めが積もると
  // convexSolid.ray() の単位長検証（許容差 1e-9）に掛かるため、この正規化が効く
  const transformed = workVector.set(ray.direction.x, ray.direction.y, ray.direction.z)
    .transformDirection(matrix);

  return { origin, direction: vec3(transformed.x, transformed.y, transformed.z) };
}

/**
 * 光路を指定の行列で移す。
 *
 * 区間の端点だけを点として変換し、波長・屈折率・内外の別・終わり方は素通しする。
 *
 * @param path 移す前の光路
 * @param matrix 剛体変換の行列
 * @returns 移した後の光路
 */
export function transformLightPath(path: LightPath, matrix: Matrix4): LightPath {
  const segments: Segment[] = path.segments.map((segment) => ({
    start: transformPoint(segment.start, matrix),
    end: transformPoint(segment.end, matrix),
    insidePrism: segment.insidePrism,
  }));

  return {
    wavelengthNm: path.wavelengthNm,
    refractiveIndex: path.refractiveIndex,
    segments,
    termination: path.termination,
  };
}

/**
 * 点を行列で移す（w = 1 として扱うので平行移動が効く）。
 *
 * @param point 移す前の点
 * @param matrix 剛体変換の行列
 * @returns 移した後の点
 */
function transformPoint(point: Vec3, matrix: Matrix4): Vec3 {
  const transformed = workVector.set(point.x, point.y, point.z).applyMatrix4(matrix);

  return vec3(transformed.x, transformed.y, transformed.z);
}
