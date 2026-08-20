import {
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  Mesh,
  MeshBasicMaterial,
  NormalBlending,
  SRGBColorSpace,
} from 'three';

import { wavelengthToRgb } from '../optics/spectrum';
import { RENDER_ORDER } from './renderOrder';
import { planeUVToWorld } from './ScreenObject';
import type { ScreenHit } from './screenProjection';
import type { ScreenPlane } from '../types/optics';

/** リボンの半幅。分散が出ない v 方向へ押し出す量。 */
const RIBBON_HALF_WIDTH = 0.32;

/** 四角形 1 枚を三角形 2 枚で作るときの頂点数。 */
const VERTICES_PER_QUAD = 6;

/** 1 頂点あたりの成分数（xyz / rgb）。 */
const COMPONENTS_PER_VERTEX = 3;

/**
 * スクリーンに映るスペクトルの帯（TASKS 6-3）。
 *
 * **ストリップではなく独立した三角形で組む。** 隣り合う 2 波長が「どちらもスクリーンに
 * 載っているとき」だけ四角形を出すので、脱落波長を跨ぐ辺が**そもそも書けない**。
 * run 分割が構造的に保証され、光が届いていない所へ帯が伸びる嘘の絵にならない。
 *
 * **通常ブレンド。** スクリーンは受光面なので、加算にすると板そのものが光っているように
 * 見えて意味が反転する。副次的に、通常ブレンドなら帯の値は 1 を超えないので
 * Bloom の閾値（線形空間で 1.2）にも掛からず、壁が滲まない。
 *
 * 更新時の割り当てをゼロにするため、位置バッファは構築時に確保して書き換えるだけにする
 * （`BeamRenderer` と同じ規律）。使わない枠は面積ゼロの縮退三角形で埋める。
 * 色は「枠 i には波長 i と i+1 の色」と決まっていて動かないので、構築時に一度だけ作る。
 */
export default class BandRenderer {
  /** シーンに追加するノード。 */
  readonly object: Mesh;

  private readonly geometry: BufferGeometry;
  private readonly material: MeshBasicMaterial;

  /** 四角形の枠数。波長数 − 1。 */
  private readonly quadCount: number;

  /** 位置バッファの実体。これを書き換えることが更新のすべて。 */
  private readonly positions: Float32Array;

  private readonly positionAttribute: BufferAttribute;

  /**
   * @param wavelengths 描画する波長の並び [nm]。色はここから構築時に一度だけ決まる
   */
  constructor(wavelengths: readonly number[]) {
    this.quadCount = Math.max(wavelengths.length - 1, 0);

    const vertexCount = this.quadCount * VERTICES_PER_QUAD;
    this.positions = new Float32Array(vertexCount * COMPONENTS_PER_VERTEX);
    this.positionAttribute = new BufferAttribute(this.positions, COMPONENTS_PER_VERTEX);

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute(
      'color',
      new BufferAttribute(createBandColorBuffer(wavelengths), COMPONENTS_PER_VERTEX)
    );

    this.material = new MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      blending: NormalBlending,
      depthWrite: false,
      side: DoubleSide,
    });

    this.object = new Mesh(this.geometry, this.material);
    this.object.renderOrder = RENDER_ORDER.screenBand;
    // 自前でバッファを書き換えるためバウンディングが古くなる。カリングを切る
    this.object.frustumCulled = false;
  }

  /**
   * 投影結果を帯へ反映する。ジオメトリも属性も作り直さない。
   *
   * @param hits 波長ごとの投影結果（載らなかった波長は null）
   * @param screen 投影先のスクリーン面
   * @throws {RangeError} 投影結果の本数が構築時の波長数と一致しない場合
   */
  update(hits: readonly (ScreenHit | null)[], screen: ScreenPlane): void {
    if (hits.length !== this.quadCount + 1) {
      throw new RangeError(
        `投影結果の本数が一致しません（期待 ${this.quadCount + 1} / 実際 ${hits.length}）`
      );
    }

    for (let quadIndex = 0; quadIndex < this.quadCount; quadIndex += 1) {
      const near = hits[quadIndex];
      const far = hits[quadIndex + 1];

      if (near === null || near === undefined || far === null || far === undefined) {
        // 片方でも載っていなければ四角形を作らない。これが run 分割そのもの
        this.writeDegenerate(quadIndex, screen);
        continue;
      }

      this.writeQuad(quadIndex, screen, near, far);
    }

    this.positionAttribute.needsUpdate = true;
  }

  /** ジオメトリとマテリアルを解放する。 */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }

  /**
   * 隣り合う 2 波長を結ぶ四角形（三角形 2 枚）を書き込む。
   *
   * リボンの幅は v 方向へ押し出す。分散は u 方向に出るので、幅が色の並びを汚さない。
   *
   * @param quadIndex 四角形の枠の添字
   * @param screen スクリーン面
   * @param near 手前側の波長の投影結果
   * @param far 奥側の波長の投影結果
   */
  private writeQuad(
    quadIndex: number,
    screen: ScreenPlane,
    near: ScreenHit,
    far: ScreenHit
  ): void {
    const nearLow = planeUVToWorld(screen, near.uv.u, near.uv.v - RIBBON_HALF_WIDTH);
    const nearHigh = planeUVToWorld(screen, near.uv.u, near.uv.v + RIBBON_HALF_WIDTH);
    const farLow = planeUVToWorld(screen, far.uv.u, far.uv.v - RIBBON_HALF_WIDTH);
    const farHigh = planeUVToWorld(screen, far.uv.u, far.uv.v + RIBBON_HALF_WIDTH);

    // 色は枠ごとに固定なので、頂点の並びは色バッファと同じ順序でなければならない
    // （near, near, far / near, far, far）
    let offset = quadIndex * VERTICES_PER_QUAD * COMPONENTS_PER_VERTEX;

    offset = this.writeVertex(offset, nearLow);
    offset = this.writeVertex(offset, nearHigh);
    offset = this.writeVertex(offset, farLow);

    offset = this.writeVertex(offset, nearHigh);
    offset = this.writeVertex(offset, farHigh);
    this.writeVertex(offset, farLow);
  }

  /**
   * 面積ゼロの三角形で枠を埋める。描かれないので帯から消える。
   *
   * @param quadIndex 四角形の枠の添字
   * @param screen スクリーン面
   */
  private writeDegenerate(quadIndex: number, screen: ScreenPlane): void {
    let offset = quadIndex * VERTICES_PER_QUAD * COMPONENTS_PER_VERTEX;

    for (let vertex = 0; vertex < VERTICES_PER_QUAD; vertex += 1) {
      offset = this.writeVertex(offset, screen.origin);
    }
  }

  /**
   * 頂点 1 つを書き込む。
   *
   * @param offset 書き込み開始位置
   * @param point 座標
   * @returns 次の書き込み位置
   */
  private writeVertex(offset: number, point: { x: number; y: number; z: number }): number {
    this.positions[offset] = point.x;
    this.positions[offset + 1] = point.y;
    this.positions[offset + 2] = point.z;

    return offset + COMPONENTS_PER_VERTEX;
  }
}

/**
 * 枠ごとの頂点色を作る。
 *
 * 枠 i は波長 i と i+1 を結ぶので、6 頂点の色は
 * `[i, i, i+1, i, i+1, i+1]` の順に並ぶ（`writeQuad` の頂点順と対応）。
 * 隣り合う色は GPU が線形補間するので、48 サンプルでも連続した虹に見える。
 *
 * `wavelengthToRgb` の戻り値は sRGB なので、`Color.setRGB` に色空間を伝えて
 * 作業色空間へ変換してから書く（`BeamRenderer` と同じ扱い）。
 *
 * @param wavelengths 波長の並び [nm]
 * @returns 頂点色バッファ
 */
function createBandColorBuffer(wavelengths: readonly number[]): Float32Array {
  const quadCount = Math.max(wavelengths.length - 1, 0);
  const colors = new Float32Array(quadCount * VERTICES_PER_QUAD * COMPONENTS_PER_VERTEX);
  const workColor = new Color();

  const workingColorOf = (wavelengthNm: number): [number, number, number] => {
    const rgb = wavelengthToRgb(wavelengthNm);
    workColor.setRGB(rgb.r, rgb.g, rgb.b, SRGBColorSpace);

    return [workColor.r, workColor.g, workColor.b];
  };

  for (let quadIndex = 0; quadIndex < quadCount; quadIndex += 1) {
    const nearColor = workingColorOf(wavelengths[quadIndex] ?? 0);
    const farColor = workingColorOf(wavelengths[quadIndex + 1] ?? 0);
    const order = [nearColor, nearColor, farColor, nearColor, farColor, farColor];

    let offset = quadIndex * VERTICES_PER_QUAD * COMPONENTS_PER_VERTEX;
    for (const color of order) {
      colors[offset] = color[0];
      colors[offset + 1] = color[1];
      colors[offset + 2] = color[2];
      offset += COMPONENTS_PER_VERTEX;
    }
  }

  return colors;
}
