import { AdditiveBlending, Color, InterleavedBufferAttribute, SRGBColorSpace } from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

import { wavelengthToRgb } from '../optics/spectrum';
import { beamBufferLength, packSegmentPositions } from './beamPacker';
import type { LightPath } from '../types/optics';

/** 光線の太さ [px]。画面空間で一定にし、ズームしても線が痩せないようにする。 */
const LINE_WIDTH_PX = 3.5;

/**
 * `LightPath[]` を波長ごとの色付き線分群として描画する。
 *
 * 太さを持つ線が要るので `LineSegments2` + `LineMaterial` を使う。加算ブレンドで
 * 重なるほど明るくなり、`prizm.png` のような発光する扇になる。
 *
 * 色は `optics/spectrum.ts` の `wavelengthToRgb` から取る。返り値は 0〜1 の
 * sRGB（表示参照）値なので、`Color.setRGB` の第 4 引数に `SRGBColorSpace` を渡して
 * 作業色空間へ変換してから頂点色バッファへ書く。省略すると sRGB 値が線形として
 * 扱われ、色が白っぽく浮く（SPEC.md「波長サンプリングと色」）。
 * **色は波長ごとに一定なので、この変換は構築時に一度だけ行う。**
 *
 * 更新時の割り当てをゼロにするため、位置バッファは自前で保持して書き換える。
 * `setPositions()` / `setColors()` は呼ぶたびに `InstancedInterleavedBuffer` と
 * 属性を作り直すので、**属性を確立する構築時の一度だけ**呼ぶ
 * （CLAUDE.md「Three.js 運用」）。以降は `needsUpdate` を立てるのみ。
 * この方法ではバウンディングが更新されないため `frustumCulled = false` とする。
 */
export default class BeamRenderer {
  /** シーンに追加するノード。 */
  readonly object: LineSegments2;

  private readonly geometry: LineSegmentsGeometry;
  private readonly material: LineMaterial;

  /** 追跡する波長の本数。`update` に渡す光路の本数と一致していなければならない。 */
  private readonly pathCount: number;

  /** 位置バッファの実体。`setPositions` が Float32Array をそのまま包むので、これが GPU 側の中身になる。 */
  private readonly positions: Float32Array;

  /** 位置属性が載るインターリーブバッファ。更新の合図はここへ立てる。 */
  private readonly positionBuffer: InterleavedBufferAttribute['data'];

  /**
   * @param wavelengths 描画する波長の並び [nm]。色はここから構築時に一度だけ決まる
   */
  constructor(wavelengths: readonly number[]) {
    this.pathCount = wavelengths.length;

    const bufferLength = beamBufferLength(this.pathCount);
    this.positions = new Float32Array(bufferLength);

    this.geometry = new LineSegmentsGeometry();
    // 属性の確立。位置は初期値ゼロで枠だけ作り、中身は最初の update() が書く
    this.geometry.setPositions(this.positions);
    this.geometry.setColors(createColorBuffer(wavelengths, bufferLength));

    this.positionBuffer = extractInterleavedBuffer(this.geometry);

    this.material = new LineMaterial({
      vertexColors: true,
      linewidth: LINE_WIDTH_PX,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    this.object = new LineSegments2(this.geometry, this.material);
    // 自前でバッファを書き換えるとバウンディングが古いままになるため、カリングを切る
    this.object.frustumCulled = false;
  }

  /**
   * 光路の座標を反映する。ジオメトリも属性も作り直さない。
   *
   * @param paths 描画する光路（ワールド座標）。並びは構築時の波長と同順
   * @throws {RangeError} 本数が構築時の波長数と一致しない場合
   */
  update(paths: readonly LightPath[]): void {
    if (paths.length !== this.pathCount) {
      throw new RangeError(
        `光路の本数が一致しません（期待 ${this.pathCount} / 実際 ${paths.length}）`
      );
    }

    packSegmentPositions(paths, this.positions);
    this.positionBuffer.needsUpdate = true;
  }

  /**
   * 線幅の計算に使う描画面の大きさを反映する。
   *
   * `LineSegments2.onBeforeRender` も毎フレーム同じ値を入れるが、レイキャストは
   * 描画の外で走るため、リサイズ時にもここで揃えておく。
   *
   * @param width 描画面の幅 [px]
   * @param height 描画面の高さ [px]
   */
  setResolution(width: number, height: number): void {
    this.material.resolution.set(width, height);
  }

  /** ジオメトリとマテリアルを解放する。 */
  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * 波長ごとの色を、位置バッファと同じ並びの頂点色バッファへ展開する。
 *
 * 1 光路が占める枠は一定なので、その枠すべてを同じ色で埋めればよい。
 *
 * @param wavelengths 波長の並び [nm]
 * @param bufferLength 位置バッファと同じ要素数
 * @returns 頂点色バッファ
 */
function createColorBuffer(wavelengths: readonly number[], bufferLength: number): Float32Array {
  const colors = new Float32Array(bufferLength);
  const floatsPerPath = bufferLength / wavelengths.length;
  const workColor = new Color();

  wavelengths.forEach((wavelengthNm, pathIndex) => {
    const rgb = wavelengthToRgb(wavelengthNm);
    // sRGB として解釈させたうえで作業色空間の値を読み出す
    workColor.setRGB(rgb.r, rgb.g, rgb.b, SRGBColorSpace);

    const pathOffset = pathIndex * floatsPerPath;
    for (let offset = 0; offset < floatsPerPath; offset += 3) {
      colors[pathOffset + offset] = workColor.r;
      colors[pathOffset + offset + 1] = workColor.g;
      colors[pathOffset + offset + 2] = workColor.b;
    }
  });

  return colors;
}

/**
 * `setPositions` が張った位置属性から、更新の合図を立てる先のバッファを取り出す。
 *
 * `instanceof` で絞り込むのは、`geometry.attributes` の型が複数の属性型の合併であり、
 * キャストを使わずに `data` へ辿るため（CLAUDE.md「`any` は禁止」）。
 *
 * @param geometry 属性を確立済みのジオメトリ
 * @returns 位置が載るインターリーブバッファ
 */
function extractInterleavedBuffer(
  geometry: LineSegmentsGeometry
): InterleavedBufferAttribute['data'] {
  const attribute = geometry.attributes['instanceStart'];

  if (!(attribute instanceof InterleavedBufferAttribute)) {
    throw new Error('instanceStart 属性が確立されていません');
  }

  return attribute.data;
}
