import { AdditiveBlending, BufferAttribute, BufferGeometry, LineBasicMaterial, LineSegments } from 'three';

import type { LightPath } from '../types/optics';

/** 1 頂点あたりの成分数。 */
const COMPONENTS_PER_VERTEX = 3;

/** 1 区間あたりの端点数。 */
const ENDPOINTS_PER_SEGMENT = 2;

/**
 * `LightPath[]` を線分群として描画する。
 *
 * NOTE: walking skeleton（S-2）の実装。素の `LineSegments` + `LineBasicMaterial` を用いる。
 *       線幅を持つ `LineSegments2` への差し替えと、自前バッファの再利用による
 *       割り当てゼロ更新は 2-4 で行う（`LineMaterial` は resolution の配線が要るため、
 *       初点灯の縦串には載せない）。
 */
export default class BeamRenderer {
  /** シーンに追加するノード。 */
  readonly object: LineSegments;

  private readonly geometry: BufferGeometry;
  private readonly material: LineBasicMaterial;

  constructor() {
    this.geometry = new BufferGeometry();
    this.material = new LineBasicMaterial({
      color: 0xffffff,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    this.object = new LineSegments(this.geometry, this.material);
    this.object.frustumCulled = false;
  }

  /**
   * 光路の折れ線を線分の並びへ展開して反映する。
   *
   * @param paths 描画する光路（ワールド座標）
   */
  update(paths: readonly LightPath[]): void {
    const segments = paths.flatMap((path) => path.segments);
    const positions = new Float32Array(
      segments.length * ENDPOINTS_PER_SEGMENT * COMPONENTS_PER_VERTEX
    );

    let offset = 0;
    for (const segment of segments) {
      positions[offset] = segment.start.x;
      positions[offset + 1] = segment.start.y;
      positions[offset + 2] = segment.start.z;
      positions[offset + 3] = segment.end.x;
      positions[offset + 4] = segment.end.y;
      positions[offset + 5] = segment.end.z;
      offset += ENDPOINTS_PER_SEGMENT * COMPONENTS_PER_VERTEX;
    }

    this.geometry.setAttribute('position', new BufferAttribute(positions, COMPONENTS_PER_VERTEX));
  }

  /** ジオメトリとマテリアルを解放する。 */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
