/**
 * 分散平面（プリズムの主断面）の生成と、面内 2 次元座標への射影（TASKS 6-1）。
 *
 * DOM / Three.js には一切依存しない（CLAUDE.md の分離規約）。`screenPlane.ts` と同じ形で、
 * 「原点と正規直交基底を作る」ことと「そこへ射影する」ことだけを担う。
 *
 * **物理は一切再計算しない。** 断面 2D ビューは、3D ビューが既に描いている光路を
 * 別の視点から見せ直す図であって、独立した光路計算ではない。ここが持つのは
 * 「ワールドの点をプリズム断面の座標へ写す」という座標変換だけである。
 *
 * **基底はプリズムの姿勢から取る。** `axisU` / `axisV` はプリズムのワールド基底の
 * x / y 列、`normal` は頂角エッジの向き（z 列）を渡す。ワールド固定の基底にすると
 * プリズムを回したときに断面図の中でプリズムが回ってしまい、「プリズムを正面から
 * 見た図」という断面図の意味が失われる。
 *
 * これが情報を失わないのは、プリズムの回転が頂角エッジに平行な軸へ拘束され
 * （`InteractionCtl.applyAxisConstraint` が rotate で Z 軸のみ、E / XYZE を出さない）、
 * 移動も XY 面内に限られ、光源の向きも主断面内の 1 自由度に固定されている
 * （`lightSource.createIncidentRay` が z 成分を定数 0 にする）ためである。
 * 結果として全光路が 1 枚の平面に載る（実測でも全区間端点の |z| は厳密に 0）。
 */

import { worldToPlaneUV } from './screenPlane';
import { cross, dot, length } from './vec3';
import type { DispersionPlane, PlaneUV, Vec3 } from '../types/optics';

/**
 * 単位ベクトル判定の許容差。
 * `normalize()` の結果は丸めにより長さが 1 から 1e-16 程度ずれるため、厳密比較はできない。
 * 既存の `convexSolid.ts` / `screenPlane.ts` と同じ値・同じ流儀（モジュール内の私的ガード）に倣う。
 */
const UNIT_LENGTH_TOLERANCE = 1e-9;

/** 直交判定の許容差。内積は解析的にゼロだが、姿勢の回転を経ると同程度の丸めが残る。 */
const ORTHOGONALITY_TOLERANCE = 1e-9;

/**
 * ベクトルの成分がすべて有限数であることを検証する。
 *
 * **`assertUnitVector` では代用できない。** 長さの比較 `|NaN - 1| > tol` は NaN では
 * 常に false になるので、NaN 成分は単位ベクトル検査を**素通りする**。通常は `vec3()` が
 * 発生源で弾くが、`Vec3` は素のインターフェースなので、行列の列をオブジェクトリテラルで
 * 直に組めば型検査は通ってしまう（scene 層が `Matrix4` から基底を取り出す経路がこれに当たる）。
 *
 * @param v 検証対象
 * @param label エラーメッセージ用の引数名
 * @throws {RangeError} いずれかの成分が有限数でない場合
 */
function assertFiniteVector(v: Vec3, label: string): void {
  if (!Number.isFinite(v.x) || !Number.isFinite(v.y) || !Number.isFinite(v.z)) {
    throw new RangeError(
      `${label}の成分は有限数である必要があります（受け取った値: ${v.x}, ${v.y}, ${v.z}）`
    );
  }
}

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
    throw new RangeError(`${label}は単位ベクトルである必要があります（長さ: ${currentLength}）`);
  }
}

/**
 * 2 つのベクトルが直交していることを検証する。
 *
 * 面内軸が法線と直交していなければ、uv は面への正射影にならない。
 * 平行な場合（`axisU` が頂角エッジと同じ向き）は内積が ±1 になるのでここで弾かれるが、
 * **弾く理由は平行だからではなく直交でないから**である。斜めの軸も同じくここで落ちる。
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
 * 分散平面を生成する。
 *
 * `axisV` は `normal × axisU` から導出する。`screenPlane()` とまったく同じ流儀で、
 * 呼び出し側に 2 軸を渡させない。導出すれば正規直交が構造的に保証され、
 * 「向きだけ違う基底」という表現できてしまう不正な状態が消える。
 *
 * 検証は生成時にのみ行う（`ray()` / `plane()` / `screenPlane()` と同じ流儀）。
 * `worldToDispersionUV()` は検証しない。
 *
 * @param origin 断面の原点（ワールド座標）。プリズムの原点を渡す
 * @param axisU 面内の第 1 軸（単位ベクトル）。プリズム局所 x 軸のワールド向き
 * @param apexEdgeNormal 頂角エッジの向き（単位ベクトル）。プリズム局所 z 軸のワールド向き
 * @returns 分散平面
 * @throws {RangeError} 引数に非有限成分がある、単位ベクトルでない、
 *                      または `axisU` と `apexEdgeNormal` が直交しない場合
 */
export function dispersionPlane(
  origin: Vec3,
  axisU: Vec3,
  apexEdgeNormal: Vec3
): DispersionPlane {
  assertFiniteVector(origin, '断面の原点');
  assertFiniteVector(axisU, '面内の第 1 軸');
  assertFiniteVector(apexEdgeNormal, '頂角エッジの向き');
  assertUnitVector(apexEdgeNormal, '頂角エッジの向き');
  assertUnitVector(axisU, '面内の第 1 軸');
  assertOrthogonal(
    apexEdgeNormal,
    axisU,
    '面内の第 1 軸は頂角エッジと直交している必要があります'
  );

  // 単位かつ直交な 2 本の外積は、長さ |a||b|sin90° = 1 の単位ベクトルになる。
  // 検証を通した後に導出するので、正規化を挟まずとも単位性が保証される
  return { origin, normal: apexEdgeNormal, axisU, axisV: cross(apexEdgeNormal, axisU) };
}

/**
 * ワールド座標の点を、分散平面内の 2 次元座標へ写す。
 *
 * u = (point − origin)·axisU、v = (point − origin)·axisV。基底がプリズムの姿勢から
 * 取られているので、返る uv は**プリズム断面のローカル座標**そのものになる。
 * したがってプリズムを回しても、プリズム自身の頂点の uv は動かない。
 *
 * 法線（頂角エッジ）方向のずれは uv に現れない（面への正射影になる）。
 *
 * **射影の算術は `screenPlane.worldToPlaneUV()` に委ねる。** 同じ内積射影を 2 つ目
 * 実装しない（単一の真実）。両者が受け取る `OrientedPlaneBasis` は、射影に必要な
 * 情報を過不足なく持っている。名前を分けているのは「何の平面へ写しているのか」を
 * 呼び出し側の語彙で読ませるためで、算術に違いはない。
 *
 * @param plane 分散平面
 * @param point ワールド座標の点
 * @returns 断面内の 2 次元座標
 */
export function worldToDispersionUV(plane: DispersionPlane, point: Vec3): PlaneUV {
  return worldToPlaneUV(plane, point);
}
