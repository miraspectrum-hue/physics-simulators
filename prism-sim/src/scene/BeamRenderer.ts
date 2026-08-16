import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  LineBasicMaterial,
  LineSegments,
  SRGBColorSpace,
} from 'three';

import { wavelengthToRgb } from '../optics/spectrum';
import type { LightPath } from '../types/optics';

/** 1 頂点あたりの成分数。 */
const COMPONENTS_PER_VERTEX = 3;

/** 1 区間あたりの端点数。 */
const ENDPOINTS_PER_SEGMENT = 2;

/**
 * `LightPath[]` を波長ごとの色付き線分群として描画する。
 *
 * 色は `optics/spectrum.ts` の `wavelengthToRgb` から取る。返り値は 0〜1 の
 * sRGB（表示参照）値なので、`Color.setRGB` の第 4 引数に `SRGBColorSpace` を渡して
 * 作業色空間へ変換してから頂点色バッファへ書く。省略すると sRGB 値が線形として
 * 扱われ、色が白っぽく浮く（SPEC.md「波長サンプリングと色」）。
 *
 * NOTE: walking skeleton（S-3）の実装。素の `LineSegments` + `LineBasicMaterial` を用いる。
 *       線幅を持つ `LineSegments2` への差し替えと、自前バッファの再利用による
 *       割り当てゼロ更新は 2-4 で行う。
 */
export default class BeamRenderer {
  /** シーンに追加するノード。 */
  readonly object: LineSegments;

  private readonly geometry: BufferGeometry;
  private readonly material: LineBasicMaterial;

  /** 色変換の作業用インスタンス。更新のたびに生成しない。 */
  private readonly workColor = new Color();

  constructor() {
    this.geometry = new BufferGeometry();
    this.material = new LineBasicMaterial({
      vertexColors: true,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    this.object = new LineSegments(this.geometry, this.material);
    this.object.frustumCulled = false;
  }

  /**
   * 光路の折れ線を線分の並びへ展開し、波長ごとの色を付けて反映する。
   *
   * @param paths 描画する光路（ワールド座標）
   */
  update(paths: readonly LightPath[]): void {
    const segmentCount = paths.reduce((total, path) => total + path.segments.length, 0);
    const componentCount = segmentCount * ENDPOINTS_PER_SEGMENT * COMPONENTS_PER_VERTEX;
    const positions = new Float32Array(componentCount);
    const colors = new Float32Array(componentCount);

    let offset = 0;
    for (const path of paths) {
      // sRGB として解釈させたうえで作業色空間の値を読み出す
      const rgb = wavelengthToRgb(path.wavelengthNm);
      this.workColor.setRGB(rgb.r, rgb.g, rgb.b, SRGBColorSpace);

      for (const segment of path.segments) {
        positions[offset] = segment.start.x;
        positions[offset + 1] = segment.start.y;
        positions[offset + 2] = segment.start.z;
        positions[offset + 3] = segment.end.x;
        positions[offset + 4] = segment.end.y;
        positions[offset + 5] = segment.end.z;

        colors[offset] = this.workColor.r;
        colors[offset + 1] = this.workColor.g;
        colors[offset + 2] = this.workColor.b;
        colors[offset + 3] = this.workColor.r;
        colors[offset + 4] = this.workColor.g;
        colors[offset + 5] = this.workColor.b;

        offset += ENDPOINTS_PER_SEGMENT * COMPONENTS_PER_VERTEX;
      }
    }

    this.geometry.setAttribute('position', new BufferAttribute(positions, COMPONENTS_PER_VERTEX));
    this.geometry.setAttribute('color', new BufferAttribute(colors, COMPONENTS_PER_VERTEX));
  }

  /** ジオメトリとマテリアルを解放する。 */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
