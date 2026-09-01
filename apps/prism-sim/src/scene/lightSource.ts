import { addScaled, vec3 } from '../optics/vec3';
import type { Ray, Vec3 } from '../types/optics';

/**
 * 光源のレイをワールド空間で組み立てる純粋関数。
 *
 * 光源はプリズムから独立してワールドに存在する。狙点 `aimPoint` を見込む向きに置き、
 * そこから `distance` だけ手前へ下がった点を始点とする。こうするとスライダーで角度を
 * 振っても常に同じ点を狙い続けるので、入射角を掃引してもビームがプリズムを外れない。
 * 逆にプリズム側を動かせばビームから外れる（TASKS 3-8）。
 *
 * 向きは主断面（XY 平面）内の 1 自由度に限る（SPEC.md「F-05」）。角度は +x 軸から
 * 反時計回りに測った進行方向で、z 成分は常に 0 になる。
 *
 * 依存は `Vec3` の値だけで、Three にもシーングラフにも触れない。
 */

const RAD_PER_DEG = Math.PI / 180;
const DEG_PER_RAD = 180 / Math.PI;

/**
 * 入射面の内向き法線が向いている角度をワールドで測る。
 *
 * これが「入射角 0°」の基準になる。プリズムの姿勢が決まれば一意に決まる量なので、
 * 起動時に既定姿勢から 1 度だけ求めて凍結し、以後スライダーの較正に使う。
 *
 * @param inwardNormal 入射面の内向き法線（ワールド座標・単位ベクトル）
 * @returns +x 軸から反時計回りに測った角度 [deg]
 */
export function faceNormalAngleDeg(inwardNormal: Vec3): number {
  return Math.atan2(inwardNormal.y, inwardNormal.x) * DEG_PER_RAD;
}

/**
 * スライダーの入射角を、ワールドでの進行方向角へ較正する。
 *
 * 入射角は面の内向き法線から測るので、法線自身のワールド角を足せば進行方向角になる。
 * 入射角 0° は法線に沿った進行（面に垂直な入射）を意味する。
 *
 * この較正が正しいことは「既定姿勢では実測 θ₁ とスライダー値が一致する」で確かめられる。
 * プリズムを回すと実測 θ₁ は乖離するが、それは物理として正しい挙動であり
 * 較正の誤りではない（光源はワールドに固定されているため）。
 *
 * @param incidenceAngleDeg スライダーの入射角 [deg]。面法線から測る
 * @param entryNormalAngleDeg 入射面の内向き法線のワールド角 [deg]
 * @returns ワールドでの進行方向角 [deg]
 */
export function sourceAngleToWorldDeg(
  incidenceAngleDeg: number,
  entryNormalAngleDeg: number
): number {
  return incidenceAngleDeg + entryNormalAngleDeg;
}

/**
 * 狙点を見込む入射レイを作る。
 *
 * @param aimPoint 狙点（ワールド座標）。レイは必ずこの点を通る
 * @param angleDeg 進行方向の角度 [deg]。+x 軸から反時計回り、XY 平面内
 * @param distance 狙点から光源までの助走距離。正の有限数
 * @returns ワールド空間の入射レイ（direction は単位ベクトル）
 * @throws {RangeError} 角度が有限数でない、または距離が正の有限数でない場合
 */
export function createIncidentRay(aimPoint: Vec3, angleDeg: number, distance: number): Ray {
  if (!Number.isFinite(angleDeg)) {
    throw new RangeError(`入射方向の角度は有限数である必要があります（受け取った値: ${angleDeg}）`);
  }

  if (!Number.isFinite(distance) || distance <= 0) {
    throw new RangeError(`助走距離は正の有限数である必要があります（受け取った値: ${distance}）`);
  }

  const angleRad = angleDeg * RAD_PER_DEG;
  // z は定数 0 にする。主断面（XY 平面）内の 1 自由度に限る（SPEC.md「F-05」）
  const direction = vec3(Math.cos(angleRad), Math.sin(angleRad), 0);

  return { origin: addScaled(aimPoint, direction, -distance), direction };
}
