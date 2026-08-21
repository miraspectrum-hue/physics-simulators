import { worldToDispersionUV } from '../optics/dispersionPlane';
import { wavelengthToRgb } from '../optics/spectrum';
import type { DispersionPlane, LightPath, PlaneUV, Vec3 } from '../types/optics';

import {
  expandBounds,
  fitViewport,
  uvToSvg,
  type UvBounds,
  type ViewportTransform,
} from './dispersionViewport';

/**
 * 断面 2D ビュー（TASKS 6-1）。主断面を真横から見た図を左上のインセットに描く。
 *
 * **物理は一切再計算しない。** 3D ビューが描いているのとまったく同じ `LightPath[]` を
 * 引数で受け取り、`worldToDispersionUV()` で断面座標へ写して `uvToSvg()` でピクセルに
 * 置くだけである。このモジュールはスネル則も屈折率も臨界角も知らない（import を見れば
 * わかるとおり、optics からは座標変換と波長→色しか引いていない）。独立に追跡すると
 * 「3D と 2D が食い違う」経路ができてしまう。
 *
 * WebGL ではなく SVG を使う。図解に要るのは数十本の折れ線と、いずれ足す角度の弧・
 * ラベルであって、そのすべてが SVG の方が素直に書ける。3D 側のレンダーループとも
 * 完全に独立なので、描いても描かなくても 60fps に影響しない。
 *
 * **ビューポートは構築時に一度だけ決める定数である。** プリズム断面（姿勢に依らず
 * 一定）にフィットさせ、光線のスタブが入るぶんだけ広げて凍結する。光線を含めて毎回
 * フィットし直すと、光線が動くたびに図が拡縮して落ち着かない。はみ出した光線は
 * 外側の `<svg>` が viewBox で切る。
 *
 * **隠れている間は何もしない。** `update()` は先頭で可視性を見て即座に戻る。
 * トグルが off のときに 3D の描画コストが 1 ミリ秒も増えないことを、この 1 行が保証する。
 *
 * 更新は状態が変わったときだけ走るイベント駆動で、毎フレームのホットパスではない。
 * したがって `src/scene/` の「毎フレームの `new` を禁止」は当てはまらず、
 * 文字列や配列をその場で組んでよい（`beamPacker` のような事前確保は要らない）。
 */

/** インセットの一辺 [px]。正方形。 */
export const SECTION_VIEW_SIZE = 320;

/** 図の内側に残す余白 [px]。 */
const SECTION_MARGIN_PX = 12;

/**
 * プリズム断面に対するビューポートの倍率。
 *
 * 1 ならプリズムが枠いっぱいになり、光線が 1 本も見えない。2.6 だとプリズムが枠の
 * 4 割ほどを占め、入射・射出のスタブが枠の縁まで伸びる余地が残る。
 */
const SECTION_ZOOM_OUT = 2.6;

/** SVG 要素を作るための名前空間。`createElement` では SVG 要素にならない。 */
const SVG_NS = 'http://www.w3.org/2000/svg';

/** プリズム断面の輪郭。ガラスらしい淡い青。 */
const PRISM_STROKE = '#7fa8e8';
const PRISM_FILL = 'rgba(74, 110, 168, 0.18)';

/**
 * 入射光の色。
 *
 * **白で 1 本だけ描く。** 48 本の入射区間はすべて同じ線分（屈折は入射面から始まる）で、
 * 3D では加算ブレンドが重なって白く見えている。SVG には加算合成が無いので、同じ線を
 * 48 回塗っても最後の 1 本の色になるだけである。白い 1 本が 3D の見えと一致する。
 */
const INCIDENT_STROKE = '#ffffff';

/** 光路のうち入射区間の添字。ここから先が波長ごとに分かれる。 */
const INCIDENT_SEGMENT_INDEX = 0;

export default class SectionView {
  /** インセットのルート要素。 */
  readonly element: SVGSVGElement;

  private readonly prismOutline: SVGPolygonElement;

  private readonly incidentLine: SVGPolylineElement;

  /** 波長ごとの折れ線（内部区間 + 射出区間）。本数は構築時に決まり増減しない。 */
  private readonly rayLines: readonly SVGPolylineElement[];

  /** 構築時に凍結したビューポート。以後 `fitViewport` は呼ばない。 */
  private readonly transform: ViewportTransform;

  private visible = false;

  /** 直近に描いた多角形の頂点列。同じ文字列なら DOM を触らない。 */
  private lastPrismPoints = '';

  /**
   * 直近に受け取った光路。**検証用**。
   *
   * 3D ビームへ渡したのとまったく同じ配列を食っていることを、外から参照で確かめられる
   * ようにするために持つ（6-1 段階3c のオラクル①）。描画には使わない。
   */
  private consumed: readonly LightPath[] = [];

  /**
   * @param parent インセットを差し込む親要素（ビューポートの入れ物）
   * @param wavelengths 波長 [nm] の並び。3D ビームと同じ並びであること
   * @param prismUvBounds プリズム断面を囲む範囲（姿勢に依らず一定）
   */
  constructor(parent: HTMLElement, wavelengths: readonly number[], prismUvBounds: UvBounds) {
    this.transform = fitViewport(
      expandBounds(prismUvBounds, SECTION_ZOOM_OUT),
      { width: SECTION_VIEW_SIZE, height: SECTION_VIEW_SIZE },
      SECTION_MARGIN_PX
    );

    this.element = document.createElementNS(SVG_NS, 'svg');
    this.element.setAttribute('class', 'section-view');
    this.element.setAttribute('viewBox', `0 0 ${SECTION_VIEW_SIZE} ${SECTION_VIEW_SIZE}`);
    this.element.setAttribute('role', 'img');
    this.element.setAttribute('aria-label', 'プリズムの主断面図');
    // SVG 要素には `hidden` の IDL 属性が無いので属性で操作する。
    // CSS 側は `.section-view[hidden]` で拾う（UA スタイルに頼らない）
    this.element.setAttribute('hidden', '');

    this.prismOutline = document.createElementNS(SVG_NS, 'polygon');
    this.prismOutline.setAttribute('fill', PRISM_FILL);
    this.prismOutline.setAttribute('stroke', PRISM_STROKE);
    this.prismOutline.setAttribute('stroke-width', '1.5');
    this.prismOutline.setAttribute('stroke-linejoin', 'round');
    this.element.appendChild(this.prismOutline);

    // 波長ごとの色は 3D と同じ源（`wavelengthToRgb`）から引く。BeamRenderer は同じ値を
    // WebGL の作業色空間へ変換して使っており、SVG に要るのは変換前の sRGB そのもの
    this.rayLines = wavelengths.map((wavelengthNm) => {
      const line = document.createElementNS(SVG_NS, 'polyline');

      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', cssColor(wavelengthNm));
      line.setAttribute('stroke-width', '1');
      line.setAttribute('stroke-linejoin', 'round');
      this.element.appendChild(line);

      return line;
    });

    // 入射光は波長で分かれないので最後に 1 本だけ、いちばん上へ
    this.incidentLine = document.createElementNS(SVG_NS, 'polyline');
    this.incidentLine.setAttribute('fill', 'none');
    this.incidentLine.setAttribute('stroke', INCIDENT_STROKE);
    this.incidentLine.setAttribute('stroke-width', '1.5');
    this.element.appendChild(this.incidentLine);

    parent.appendChild(this.element);
  }

  /**
   * インセットの表示・非表示を切り替える。
   *
   * @param visible 表示するなら true
   */
  setVisible(visible: boolean): void {
    this.visible = visible;

    if (visible) {
      this.element.removeAttribute('hidden');
    } else {
      this.element.setAttribute('hidden', '');
    }
  }

  /** 現在表示されているか。 */
  isVisible(): boolean {
    return this.visible;
  }

  /** 直近に受け取った光路。検証用（3D と同じ配列であることを確かめるため）。 */
  consumedPaths(): readonly LightPath[] {
    return this.consumed;
  }

  /** 凍結したビューポート。検証用（拡縮していないことを確かめるため）。 */
  viewportTransform(): ViewportTransform {
    return this.transform;
  }

  /**
   * 断面図を描き直す。
   *
   * @param plane 分散平面（プリズムの姿勢から作った基底）
   * @param prismWorldVertices プリズム断面の頂点（ワールド座標）。前面の 3 点でよい
   * @param paths 描く光路（ワールド座標）。**3D ビームへ渡すのと同じ配列**
   */
  update(
    plane: DispersionPlane,
    prismWorldVertices: readonly Vec3[],
    paths: readonly LightPath[]
  ): void {
    this.consumed = paths;

    // 隠れているなら何もしない。トグル off のときのコストをゼロにする
    if (!this.visible || prismWorldVertices.length === 0) {
      return;
    }

    const prismPoints = this.toPoints(prismWorldVertices.map((v) => worldToDispersionUV(plane, v)));

    // プリズムを回しても断面図は変わらないので、ここはほぼ毎回一致して DOM を触らない
    if (prismPoints !== this.lastPrismPoints) {
      this.lastPrismPoints = prismPoints;
      this.prismOutline.setAttribute('points', prismPoints);
    }

    this.drawRays(plane, paths);
  }

  /** 要素を親から外す。 */
  dispose(): void {
    this.element.remove();
  }

  /**
   * 光路を折れ線として描く。
   *
   * 入射区間は 48 本とも同じ線分なので 1 本だけ白で描き、波長ごとの折れ線は
   * 内部区間から始める。こうしないと入射部分が最後の波長の色に染まる。
   *
   * @param plane 分散平面
   * @param paths 光路（ワールド座標）
   */
  private drawRays(plane: DispersionPlane, paths: readonly LightPath[]): void {
    const first = paths[0];
    const incidentSegment = first?.segments[INCIDENT_SEGMENT_INDEX];

    this.incidentLine.setAttribute(
      'points',
      incidentSegment === undefined
        ? ''
        : this.toPoints([
            worldToDispersionUV(plane, incidentSegment.start),
            worldToDispersionUV(plane, incidentSegment.end),
          ])
    );

    this.rayLines.forEach((line, index) => {
      const path = paths[index];

      if (path === undefined) {
        line.setAttribute('points', '');

        return;
      }

      // 入射区間の次から。区間は繋がっているので、始点 1 つと以降の終点を並べれば折れ線になる
      const tail = path.segments.slice(INCIDENT_SEGMENT_INDEX + 1);
      const head = tail[0];

      if (head === undefined) {
        // 区間が 1 本だけ（プリズムを外れて直進）。色を付けるものが無い
        line.setAttribute('points', '');

        return;
      }

      const uv = [head.start, ...tail.map((segment) => segment.end)].map((point) =>
        worldToDispersionUV(plane, point)
      );

      line.setAttribute('points', this.toPoints(uv));
    });
  }

  /**
   * 断面座標の並びを SVG の `points` 属性の文字列にする。
   *
   * @param uv 断面座標の並び
   * @returns 例 `160.000,42.221 24.000,277.779`
   */
  private toPoints(uv: readonly PlaneUV[]): string {
    return uv
      .map((coord) => {
        const point = uvToSvg(coord, this.transform);

        return `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
      })
      .join(' ');
  }
}

/**
 * 波長を CSS の色にする。
 *
 * 3D の基準色とまったく同じ `wavelengthToRgb()` から引く。`BeamRenderer` はこの値を
 * さらに WebGL の作業色空間へ変換して使うが、SVG に要るのは変換前の sRGB そのもの
 * なので、変換を挟まないここが 3D と同じ「元の色」になる。
 *
 * @param wavelengthNm 波長 [nm]
 * @returns 例 `rgb(255, 0, 0)`
 */
function cssColor(wavelengthNm: number): string {
  const rgb = wavelengthToRgb(wavelengthNm);
  const channel = (value: number): number => Math.round(Math.min(Math.max(value, 0), 1) * 255);

  return `rgb(${channel(rgb.r)}, ${channel(rgb.g)}, ${channel(rgb.b)})`;
}
