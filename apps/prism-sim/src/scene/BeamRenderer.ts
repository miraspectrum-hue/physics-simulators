import { AdditiveBlending, InterleavedBufferAttribute } from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

import { displayColorForWavelength } from '../optics/displayColor';
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

  /**
   * マテリアルは**貼り替えても持ち回る**。`setResolution` が書き込む先がここなので、
   * 作り直すと `SceneManager.onResize` の購読が古いマテリアルを指したまま残り、
   * リサイズで線幅が崩れる（4-3 の罠 (a)）。
   */
  private readonly material: LineMaterial;

  /** 波長の本数に依存する持ち物。モードを切り替えるとまとめて貼り替わる。 */
  private slots: BeamSlots;

  /** 表示用の強度写像。既定は恒等＝実物理そのまま。 */
  private readonly shapeIntensity: IntensityShaping | undefined;

  /**
   * @param wavelengths 描画する波長の並び [nm]。色はここから構築時に一度だけ決まる
   * @param shapeIntensity 表示用の強度写像（非物理の演出）。省略すると実物理の強度で描く
   */
  constructor(wavelengths: readonly number[], shapeIntensity?: IntensityShaping) {
    this.shapeIntensity = shapeIntensity;
    this.slots = createSlots(wavelengths);

    this.material = new LineMaterial({
      vertexColors: true,
      linewidth: LINE_WIDTH_PX,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
    });

    this.object = new LineSegments2(this.slots.geometry, this.material);
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
    const slots = this.slots;

    if (paths.length !== slots.pathCount) {
      throw new RangeError(
        `光路の本数が一致しません（期待 ${slots.pathCount} / 実際 ${paths.length}）`
      );
    }

    packSegmentPositions(paths, slots.positions);
    packSegmentColors(paths, slots.baseColors, slots.colors, this.shapeIntensity);
    slots.positionBuffer.needsUpdate = true;
    slots.colorBuffer.needsUpdate = true;
  }

  /**
   * 波長の並びを差し替える（TASKS 4-3）。
   *
   * **作り直すのは本数に依存するジオメトリだけである。** `object`・`material`・
   * シーンへの所属・`renderOrder`・`frustumCulled` はそのまま持ち回るので、
   * 呼び出し側は再追加も再購読も要らない。全部作り直す方式だと
   * `SceneManager.onResize` の購読口が無く、リサイズで線幅が崩れる。
   *
   * 7 色は連続 48 の部分集合ではないので、基準色も含めて計算し直す。
   * 旧ジオメトリはここで `dispose()` する（貼り替えのたびに GPU バッファが残らない）。
   *
   * @param wavelengths 新しい波長の並び [nm]
   */
  setWavelengths(wavelengths: readonly number[]): void {
    const previous = this.slots;

    this.slots = createSlots(wavelengths);
    this.object.geometry = this.slots.geometry;
    previous.geometry.dispose();
  }

  /** 現在の波長の本数。**検証用**（貼り替えが効いたかを外から数える）。 */
  get pathCount(): number {
    return this.slots.pathCount;
  }

  /**
   * 現在のビーム幅 [px]（TASKS 4-5）。
   *
   * `material.linewidth` が単一の真実。`prism.object.position` と同じ流儀で、
   * 呼び出し側（`main.ts` の `collectShareableState`）は別変数に二重保持しない。
   */
  get lineWidth(): number {
    return this.material.linewidth;
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

  /**
   * ビーム幅を反映する（TASKS 4-5）。
   *
   * `setResolution` と同型の uniform 書き換えのみ。`linewidth` はシェーダの `#define` では
   * なく uniform なので再コンパイルを伴わず、ジオメトリ（`geometry.attributes.instanceStart`）
   * にも触れない。表示専用（4-5 偵察で確定）——呼び出し側は `update()`/`refreshBeams()` を
   * 誘発する必要がない。
   *
   * @param widthPx 線幅 [px]
   */
  setLineWidth(widthPx: number): void {
    this.material.linewidth = widthPx;
  }

  /** ジオメトリとマテリアルを解放する。 */
  dispose(): void {
    this.slots.geometry.dispose();
    this.material.dispose();
  }
}

/**
 * 波長の本数に依存する持ち物。**まとめて差し替わる**ので 1 つの塊にしてある
 * （どれか 1 つだけ貼り替えると本数が食い違い、`update` の検査をすり抜けて壊れる）。
 */
interface BeamSlots {
  /** 追跡する波長の本数。`update` に渡す光路の本数と一致していなければならない。 */
  readonly pathCount: number;
  /** 位置バッファの実体。`setPositions` が Float32Array をそのまま包むので、これが GPU 側の中身になる。 */
  readonly positions: Float32Array;
  /** 位置属性が載るインターリーブバッファ。更新の合図はここへ立てる。 */
  readonly positionBuffer: InterleavedBufferAttribute['data'];
  /** 波長ごとの基準色（作業色空間）。強度を掛ける前の値。 */
  readonly baseColors: Float32Array;
  /** 頂点色バッファの実体。毎フレーム「基準色 × 強度」で書き換える。 */
  readonly colors: Float32Array;
  /** 頂点色属性が載るインターリーブバッファ。 */
  readonly colorBuffer: InterleavedBufferAttribute['data'];
  /** 上のバッファを載せたジオメトリ。 */
  readonly geometry: LineSegmentsGeometry;
}

/**
 * 波長の並びから、本数に依存する持ち物一式を作る。
 *
 * @param wavelengths 波長の並び [nm]
 * @returns 貼り替え単位の持ち物
 */
function createSlots(wavelengths: readonly number[]): BeamSlots {
  const pathCount = wavelengths.length;
  const bufferLength = beamBufferLength(pathCount);
  const positions = new Float32Array(bufferLength);
  const colors = new Float32Array(bufferLength);
  const geometry = new LineSegmentsGeometry();

  // 属性の確立。位置も色も初期値ゼロで枠だけ作り、中身は最初の update() が書く
  geometry.setPositions(positions);
  geometry.setColors(colors);

  return {
    pathCount,
    positions,
    positionBuffer: extractInterleavedBuffer(geometry, 'instanceStart'),
    baseColors: createBaseColors(wavelengths),
    colors,
    colorBuffer: extractInterleavedBuffer(geometry, 'instanceColorStart'),
    geometry,
  };
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

  wavelengths.forEach((wavelengthNm, pathIndex) => {
    // `displayColorForWavelength` は輝度フロアを適用済みの**線形作業色空間**の値を返す。
    // sRGB → 線形の変換も向こうで済んでいるので、ここで色空間を触る必要はない
    const [r, g, b] = displayColorForWavelength(wavelengthNm);

    const offset = pathIndex * 3;
    colors[offset] = r;
    colors[offset + 1] = g;
    colors[offset + 2] = b;
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
