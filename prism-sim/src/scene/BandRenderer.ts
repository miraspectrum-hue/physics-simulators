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
 * 四角形 1 枚の 6 頂点が「奥側の波長」に属するかどうか。
 *
 * `writeQuad` が書く頂点順（near, near, far / near, far, far）と 1 対 1 に対応する。
 * 座標・基準色・強度がこの 1 つの並びを共有するので、三者の順序が食い違う経路が無い。
 */
const QUAD_VERTEX_IS_FAR: readonly boolean[] = [false, false, true, false, true, true];

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
 *
 * **頂点色も毎フレーム書き換える（TASKS 6-5a）。** 「枠 i には波長 i と i+1 の色」という
 * 対応は動かないが、実際に描く色は「基準色 × スクリーンへ届いた強度」であり、強度は
 * 入射角や材質で変わる。基準色だけを構築時に作り、明暗は毎フレーム掛け直す。
 * 表示ゲインは掛けない（絵の明暗はそのまま実物理の相対強度）。
 */
export default class BandRenderer {
  /** シーンに追加するノード。 */
  readonly object: Mesh;

  private readonly geometry: BufferGeometry;
  private readonly material: MeshBasicMaterial;

  /** 四角形の枠数。波長数 − 1。 */
  private readonly quadCount: number;

  /** 位置バッファの実体。 */
  private readonly positions: Float32Array;

  private readonly positionAttribute: BufferAttribute;

  /** 枠ごとの基準色（作業色空間）。強度を掛ける前の値で、構築後は変わらない。 */
  private readonly baseColors: Float32Array;

  /** 頂点色バッファの実体。毎フレーム「基準色 × 強度」で書き換える。 */
  private readonly colors: Float32Array;

  private readonly colorAttribute: BufferAttribute;

  /**
   * @param wavelengths 描画する波長の並び [nm]。色はここから構築時に一度だけ決まる
   */
  constructor(wavelengths: readonly number[]) {
    this.quadCount = Math.max(wavelengths.length - 1, 0);

    const vertexCount = this.quadCount * VERTICES_PER_QUAD;
    this.positions = new Float32Array(vertexCount * COMPONENTS_PER_VERTEX);
    this.positionAttribute = new BufferAttribute(this.positions, COMPONENTS_PER_VERTEX);

    this.baseColors = createBandColorBuffer(wavelengths);
    this.colors = new Float32Array(this.baseColors.length);
    this.colorAttribute = new BufferAttribute(this.colors, COMPONENTS_PER_VERTEX);

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', this.positionAttribute);
    this.geometry.setAttribute('color', this.colorAttribute);

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
   * 位置は `hit.uv`、明るさは `hit.intensity` から決まる。どちらも同じ `ScreenHit` から
   * 取るので、「位置は今フレームのもの・明るさは前フレームのもの」というずれが起きない。
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
    this.colorAttribute.needsUpdate = true;
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

    this.writeQuadColors(quadIndex, near.intensity, far.intensity);
  }

  /**
   * 四角形 1 枚ぶんの頂点色を「基準色 × 強度」で書き込む。
   *
   * 頂点の並びは `QUAD_VERTEX_IS_FAR` に従うので、`writeQuad` の座標・
   * `createBandColorBuffer` の基準色と必ず同じ順序になる。
   *
   * @param quadIndex 四角形の枠の添字
   * @param nearIntensity 手前側の波長がスクリーンへ届けた強度
   * @param farIntensity 奥側の波長がスクリーンへ届けた強度
   */
  private writeQuadColors(
    quadIndex: number,
    nearIntensity: number,
    farIntensity: number
  ): void {
    let offset = quadIndex * VERTICES_PER_QUAD * COMPONENTS_PER_VERTEX;

    for (let vertex = 0; vertex < VERTICES_PER_QUAD; vertex += 1) {
      const intensity = QUAD_VERTEX_IS_FAR[vertex] === true ? farIntensity : nearIntensity;

      this.colors[offset] = (this.baseColors[offset] ?? 0) * intensity;
      this.colors[offset + 1] = (this.baseColors[offset + 1] ?? 0) * intensity;
      this.colors[offset + 2] = (this.baseColors[offset + 2] ?? 0) * intensity;
      offset += COMPONENTS_PER_VERTEX;
    }
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

    // 光が届いていない枠なので強度 0。面積ゼロで描かれないが、
    // 残骸の色を残さないことで「消えている」ことがバッファ上でも読み取れる
    this.writeQuadColors(quadIndex, 0, 0);
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
 * 枠ごとの基準色を作る。
 *
 * 枠 i は波長 i と i+1 を結ぶので、6 頂点の色は `QUAD_VERTEX_IS_FAR` の順に並ぶ。
 * 隣り合う色は GPU が線形補間するので、48 サンプルでも連続した虹に見える。
 *
 * `wavelengthToRgb` の戻り値は sRGB なので、`Color.setRGB` に色空間を伝えて
 * 作業色空間へ変換してから書く（`BeamRenderer` と同じ扱い）。
 *
 * 強度は掛けない。ここで決まるのは「その波長の色そのもの」で、明暗は
 * `writeQuadColors` が毎フレーム掛ける。
 *
 * @param wavelengths 波長の並び [nm]
 * @returns 基準色バッファ
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

    let offset = quadIndex * VERTICES_PER_QUAD * COMPONENTS_PER_VERTEX;
    for (const isFar of QUAD_VERTEX_IS_FAR) {
      const color = isFar ? farColor : nearColor;

      colors[offset] = color[0];
      colors[offset + 1] = color[1];
      colors[offset + 2] = color[2];
      offset += COMPONENTS_PER_VERTEX;
    }
  }

  return colors;
}
