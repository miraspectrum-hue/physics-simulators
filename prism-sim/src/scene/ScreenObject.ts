import { DoubleSide, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, Vector3 } from 'three';

import { screenPlane } from '../optics/screenPlane';
import { addScaled, cross, negate, normalize, vec3 } from '../optics/vec3';
import type { ScreenPlane, Vec3 } from '../types/optics';
import type { ExitAnchor } from './screenProjection';
import { RENDER_ORDER } from './renderOrder';

/** スクリーンの半幅。虹の帯が収まり、かつ既定のカメラ画角に入る大きさ。 */
export const SCREEN_HALF_EXTENT = 2.5;

/** 射出点からスクリーンまでの既定距離。B-2 の距離スライダーの初期値になる。 */
export const SCREEN_DEFAULT_DISTANCE = 4;

/** 板の色。像が読めるだけの明るさに留め、虹より目立たせない。 */
const PANEL_COLOR = 0x141a26;

/**
 * 仮想スクリーンの板（TASKS 6-3）。
 *
 * 姿勢の単一の真実は `plane`（`ScreenPlane`）で、Mesh の行列はそこから組み立てる。
 * `PlaneGeometry` は XY 平面に載って +Z を向くので、基底 (axisU, axisV, normal) を
 * そのまま Mesh の回転に使えば、幾何と描画が一致する。
 *
 * **深度を書かない。** このシーンには深度を書くオブジェクトが 1 つも無く、ここで初めて
 * 書き込みを持ち込むと既存 3 層の合成が変わる（描画順の固定で解決した問題の再燃）。
 * 前後関係は `RENDER_ORDER` で決める。
 */
export default class ScreenObject {
  /** シーンに追加するノード。 */
  readonly object: Mesh;

  /** スクリーン面（姿勢の単一の真実）。 */
  private currentPlane: ScreenPlane;

  private readonly geometry: PlaneGeometry;
  private readonly material: MeshBasicMaterial;

  /** 行列の組み立てに使う作業用インスタンス。毎フレームの経路では使わない。 */
  private readonly workMatrix = new Matrix4();
  private readonly workAxisU = new Vector3();
  private readonly workAxisV = new Vector3();
  private readonly workNormal = new Vector3();

  /**
   * @param plane 初期のスクリーン面
   */
  constructor(plane: ScreenPlane) {
    this.currentPlane = plane;

    this.geometry = new PlaneGeometry(plane.halfExtent * 2, plane.halfExtent * 2);
    this.material = new MeshBasicMaterial({
      color: PANEL_COLOR,
      transparent: true,
      // 板は色としては不透明でよい。transparent にするのは深度を書かせないため
      opacity: 1,
      depthWrite: false,
      side: DoubleSide,
    });

    this.object = new Mesh(this.geometry, this.material);
    this.object.renderOrder = RENDER_ORDER.screenPanel;
    this.applyPlane();
  }

  /** 現在のスクリーン面。投影計算に渡す。 */
  get plane(): ScreenPlane {
    return this.currentPlane;
  }

  /**
   * スクリーン面を差し替え、Mesh の姿勢へ反映する。
   *
   * @param plane 新しいスクリーン面
   */
  setPlane(plane: ScreenPlane): void {
    this.currentPlane = plane;
    this.applyPlane();
  }

  /** ジオメトリとマテリアルを解放する。 */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  /** `currentPlane` から Mesh の行列を組み立てる。 */
  private applyPlane(): void {
    const { origin, normal, axisU, axisV } = this.currentPlane;

    this.workAxisU.set(axisU.x, axisU.y, axisU.z);
    this.workAxisV.set(axisV.x, axisV.y, axisV.z);
    this.workNormal.set(normal.x, normal.y, normal.z);

    // PlaneGeometry の X/Y/Z を、そのまま面内 2 軸と法線に対応させる
    this.workMatrix.makeBasis(this.workAxisU, this.workAxisV, this.workNormal);
    this.workMatrix.setPosition(origin.x, origin.y, origin.z);

    this.object.matrix.copy(this.workMatrix);
    this.object.matrix.decompose(this.object.position, this.object.quaternion, this.object.scale);
    this.object.updateMatrixWorld(true);
  }
}

/**
 * 射出光のアンカーからスクリーン面を組み立てる。
 *
 * 承認済みの方針（③）に従う。
 *   - 法線 = −平均方向（面が光の来る方を向く）
 *   - `axisU` = 平均方向 × Z（分散は主断面内で起きるので、虹はこの向き＝横に並ぶ）
 *   - 中心 = 射出点の平均 + 平均方向 × 距離
 *
 * @param anchor 射出点と射出方向の平均
 * @param distance 射出点からの距離
 * @param halfExtent スクリーンの半幅
 * @returns スクリーン面
 */
export function screenPlaneFromAnchor(
  anchor: ExitAnchor,
  distance: number,
  halfExtent: number
): ScreenPlane {
  const center = addScaled(anchor.origin, anchor.direction, distance);
  const axisU = normalize(cross(anchor.direction, vec3(0, 0, 1)));

  return screenPlane(center, negate(anchor.direction), axisU, halfExtent);
}

/**
 * 射出光が取れないときに使う既定のスクリーン面。
 *
 * 起動直後にビームがプリズムを外している場合でも、板だけは置いて操作の手がかりを残す。
 *
 * @param halfExtent スクリーンの半幅
 * @returns +x 方向を見込む位置に立てたスクリーン面
 */
export function fallbackScreenPlane(halfExtent: number): ScreenPlane {
  const fallbackAnchor: ExitAnchor = { origin: vec3(0, 0, 0), direction: vec3(1, 0, 0) };

  return screenPlaneFromAnchor(fallbackAnchor, SCREEN_DEFAULT_DISTANCE, halfExtent);
}

/** 面内 2 次元座標をワールド座標へ戻す。帯の頂点を作るのに使う。 */
export function planeUVToWorld(plane: ScreenPlane, u: number, v: number): Vec3 {
  return addScaled(addScaled(plane.origin, plane.axisU, u), plane.axisV, v);
}
