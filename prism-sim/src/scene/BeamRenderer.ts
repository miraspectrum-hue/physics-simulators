import { AdditiveBlending, Color, InterleavedBufferAttribute, SRGBColorSpace } from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

import { wavelengthToRgb } from '../optics/spectrum';
import {
  beamBufferLength,
  packSegmentColors,
  packSegmentPositions,
  type IntensityShaping,
} from './beamPacker';
import { RENDER_ORDER } from './renderOrder';
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
 * **色空間変換は波長ごとに一定なので構築時に一度だけ行い、その結果を基準色として保持する。**
 *
 * **頂点色は毎フレーム書き換える（TASKS 6-5a）。** 実際に描く色は
 * 「基準色 × その区間の強度」であり、強度は界面を通るたびに透過率 (1 − R) が掛かって
 * 落ちるため、1 本の光路の中でも区間ごとに違う（`Segment.intensity`）。
 * 構築時に一度決めた色をそのまま使い続けると、入射前と射出後が同じ明るさになってしまう。
 * 表示ゲインは掛けないので、絵の明暗はそのまま実物理の相対強度である。
 *
 * 更新時の割り当てをゼロにするため、位置・頂点色とも自前で保持したバッファを書き換える。
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

  /** 波長ごとの基準色（作業色空間）。強度を掛ける前の値で、構築後は変わらない。 */
  private readonly baseColors: Float32Array;

  /** 頂点色バッファの実体。毎フレーム「基準色 × 強度」で書き換える。 */
  private readonly colors: Float32Array;

  /** 頂点色属性が載るインターリーブバッファ。 */
  private readonly colorBuffer: InterleavedBufferAttribute['data'];

  /** 表示用の強度写像。既定は恒等＝実物理そのまま。 */
  private readonly shapeIntensity: IntensityShaping | undefined;

  /**
   * @param wavelengths 描画する波長の並び [nm]。色はここから構築時に一度だけ決まる
   * @param shapeIntensity 表示用の強度写像（非物理の演出）。省略すると実物理の強度で描く
   */
  constructor(wavelengths: readonly number[], shapeIntensity?: IntensityShaping) {
    this.pathCount = wavelengths.length;
    this.shapeIntensity = shapeIntensity;

    const bufferLength = beamBufferLength(this.pathCount);
    this.positions = new Float32Array(bufferLength);
    this.baseColors = createBaseColors(wavelengths);
    this.colors = new Float32Array(bufferLength);

    this.geometry = new LineSegmentsGeometry();
    // 属性の確立。位置も色も初期値ゼロで枠だけ作り、中身は最初の update() が書く
    this.geometry.setPositions(this.positions);
    this.geometry.setColors(this.colors);

    this.positionBuffer = extractInterleavedBuffer(this.geometry, 'instanceStart');
    this.colorBuffer = extractInterleavedBuffer(this.geometry, 'instanceColorStart');

    this.material = new LineMaterial({
      vertexColors: true,
      linewidth: LINE_WIDTH_PX,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    this.object = new LineSegments2(this.geometry, this.material);
    // ガラスより後に加算する。前に描くとガラスの通常ブレンドに減光される
    this.object.renderOrder = RENDER_ORDER.beam;
    // 自前でバッファを書き換えるとバウンディングが古いままになるため、カリングを切る
    this.object.frustumCulled = false;
  }

  /**
   * 光路の座標と強度を反映する。ジオメトリも属性も作り直さない。
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
    packSegmentColors(paths, this.baseColors, this.colors, this.shapeIntensity);
    this.positionBuffer.needsUpdate = true;
    this.colorBuffer.needsUpdate = true;
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
 * 波長ごとの基準色（作業色空間の rgb）を並べた配列を作る。
 *
 * 強度は掛けない。ここで作るのは「その波長の色そのもの」であり、明暗は
 * `packSegmentColors` が区間ごとに掛ける（色の正しさと強度の正しさを分けて保つ）。
 *
 * @param wavelengths 波長の並び [nm]
 * @returns 長さ `wavelengths.length * 3` の基準色バッファ
 */
function createBaseColors(wavelengths: readonly number[]): Float32Array {
  const colors = new Float32Array(wavelengths.length * 3);
  const workColor = new Color();

  wavelengths.forEach((wavelengthNm, pathIndex) => {
    const rgb = wavelengthToRgb(wavelengthNm);
    // sRGB として解釈させたうえで作業色空間の値を読み出す
    workColor.setRGB(rgb.r, rgb.g, rgb.b, SRGBColorSpace);

    const offset = pathIndex * 3;
    colors[offset] = workColor.r;
    colors[offset + 1] = workColor.g;
    colors[offset + 2] = workColor.b;
  });

  return colors;
}

/**
 * `setPositions` / `setColors` が張った属性から、更新の合図を立てる先のバッファを取り出す。
 *
 * `instanceof` で絞り込むのは、`geometry.attributes` の型が複数の属性型の合併であり、
 * キャストを使わずに `data` へ辿るため（CLAUDE.md「`any` は禁止」）。
 *
 * @param geometry 属性を確立済みのジオメトリ
 * @param name 属性名
 * @returns その属性が載るインターリーブバッファ
 */
function extractInterleavedBuffer(
  geometry: LineSegmentsGeometry,
  name: string
): InterleavedBufferAttribute['data'] {
  const attribute = geometry.attributes[name];

  if (!(attribute instanceof InterleavedBufferAttribute)) {
    throw new Error(`${name} 属性が確立されていません`);
  }

  return attribute.data;
}
