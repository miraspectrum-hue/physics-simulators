import { BufferAttribute, BufferGeometry } from 'three';

import { createTriangularPrismVertices } from '../optics/convexSolid';
import type { Vec3 } from '../types/optics';

/**
 * 三角形 8 枚を成す頂点の並び。`createTriangularPrismVertices` の返す
 * `[前(+z): 頂点, 左下, 右下, 後(-z): 頂点, 左下, 右下]` に対する添字で表す。
 *
 * 巻き順は外から見て反時計回り（外向き法線）。側面 2 枚ずつ + 底面 2 枚 + 端面 1 枚ずつ。
 */
const TRIANGLE_INDICES: readonly (readonly [number, number, number])[] = [
  [0, 4, 1], // 左側面
  [0, 3, 4],
  [0, 2, 5], // 右側面
  [0, 5, 3],
  [1, 4, 5], // 底面
  [1, 5, 2],
  [0, 1, 2], // 前端面 (+z)
  [3, 5, 4], // 後端面 (-z)
];

/** 1 頂点あたりの成分数。 */
const COMPONENTS_PER_VERTEX = 3;

/**
 * 正三角柱の `BufferGeometry` を組み立てる。
 *
 * 頂点は `optics/convexSolid.ts` の `createTriangularPrismVertices` から取る。
 * 平面集合（`createTriangularPrism`）と同じ引数・同じ関数群から生やすことで、
 * 描画される立体と光路計算の立体が一致することを保証する。
 *
 * 面ごとに法線を分けるため頂点は共有しない（8 三角形 × 3 = 24 頂点）。
 * 共有すると頂点法線が平均化され、平らであるべき面が丸く陰影付けされる。
 * `ExtrudeGeometry` を使わないのは、既定のベベルと原点非対称な押し出しにより
 * 生成頂点が保証できず、平面集合との整合を検証できないためである。
 *
 * @param sideLength 正三角形の一辺の長さ。正の有限数
 * @param depth 押し出し長。正の有限数
 * @returns 位置と法線を持つ非インデックスのジオメトリ（呼び出し側が dispose する）
 * @throws {RangeError} 寸法が正の有限数でない場合（検証は optics 側に委譲する）
 */
export function createPrismGeometry(sideLength: number, depth: number): BufferGeometry {
  const vertices = createTriangularPrismVertices(sideLength, depth);
  const positions = new Float32Array(
    TRIANGLE_INDICES.length * COMPONENTS_PER_VERTEX * COMPONENTS_PER_VERTEX
  );

  let offset = 0;
  for (const triangle of TRIANGLE_INDICES) {
    for (const vertexIndex of triangle) {
      const vertex: Vec3 = vertices[vertexIndex] ?? vertices[0];

      positions[offset] = vertex.x;
      positions[offset + 1] = vertex.y;
      positions[offset + 2] = vertex.z;
      offset += COMPONENTS_PER_VERTEX;
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, COMPONENTS_PER_VERTEX));

  // 頂点を共有していないため、平均化されず面ごとの法線がそのまま得られる
  geometry.computeVertexNormals();

  return geometry;
}
