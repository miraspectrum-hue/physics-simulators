import { Mesh, MeshStandardMaterial, Object3D } from 'three';

import { createPrismGeometry } from './prismGeometry';

/** プリズムの一辺の長さ。光路計算の平面集合と共有する寸法。 */
export const PRISM_SIDE_LENGTH = 2;

/** プリズムの押し出し長。 */
export const PRISM_DEPTH = 2;

/**
 * プリズムのメッシュと姿勢を保持する。
 *
 * 姿勢の単一の真実は `object.matrix`（Object3D）であり、オイラー角を自前に二重保持しない
 * （CLAUDE.md「やってはいけないこと」）。
 *
 * NOTE: 現状の材質は「立体が見えること」を優先した仮のもの。
 *       transmission / ior を用いたガラス表現と環境マップは 2-2 / 2-6 で入れる。
 */
export default class PrismObject {
  /** シーンに追加するノード。姿勢はこの `matrix` が単一の真実。 */
  readonly object: Object3D;

  private readonly mesh: Mesh;

  constructor(sideLength: number = PRISM_SIDE_LENGTH, depth: number = PRISM_DEPTH) {
    const geometry = createPrismGeometry(sideLength, depth);
    const material = new MeshStandardMaterial({
      color: 0x4a6ea8,
      metalness: 0,
      roughness: 0.15,
      transparent: true,
      opacity: 0.45,
      // 深度を書き込むと、プリズム内部を通る光路（前面より奥）が深度テストで落ちて見えなくなる。
      // 透明体は深度を書かないのが定石で、内部の光が透けて見えるのが物理的にも正しい
      depthWrite: false,
    });

    this.mesh = new Mesh(geometry, material);
    this.object = this.mesh;
  }

  /** ジオメトリとマテリアルを解放する。 */
  dispose(): void {
    this.mesh.geometry.dispose();

    const { material } = this.mesh;
    if (Array.isArray(material)) {
      material.forEach((entry) => entry.dispose());
    } else {
      material.dispose();
    }
  }
}
