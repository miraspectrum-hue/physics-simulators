import { worldToDispersionUV } from '../optics/dispersionPlane';
import type { DispersionPlane, PlaneUV, Vec3 } from '../types/optics';

import { fitViewport, uvToSvg, type UvBounds } from './dispersionViewport';

/**
 * 断面 2D ビュー（TASKS 6-1）。主断面を真横から見た図を左上のインセットに描く。
 *
 * **物理は一切再計算しない。** 3D ビューが既に持っているワールド座標の点を
 * `worldToDispersionUV()` で断面座標へ写し、`uvToSvg()` でピクセルへ置くだけである。
 * 独立に光路を追跡すると「3D と 2D が食い違う」経路ができてしまう。
 *
 * WebGL ではなく SVG を使う。図解に要るのは数十本の直線と、いずれ足す角度の弧・
 * ラベルであって、そのすべてが SVG の方が素直に書ける。3D 側のレンダーループとも
 * 完全に独立なので、描いても描かなくても 60fps に影響しない。
 *
 * **隠れている間は何もしない。** `update()` は先頭で可視性を見て即座に戻る。
 * トグルが off のときに 3D の描画コストが 1 ミリ秒も増えないことを、この 1 行が保証する。
 */

/** インセットの一辺 [px]。正方形。 */
export const SECTION_VIEW_SIZE = 320;

/** 図の内側に残す余白 [px]。プリズムが縁に貼り付かない程度。 */
const SECTION_MARGIN_PX = 24;

/** SVG 要素を作るための名前空間。`createElement` では SVG 要素にならない。 */
const SVG_NS = 'http://www.w3.org/2000/svg';

/** プリズム断面の輪郭の色。ガラスらしい淡い青。 */
const PRISM_STROKE = '#7fa8e8';
const PRISM_FILL = 'rgba(74, 110, 168, 0.18)';

export default class SectionView {
  /** インセットのルート要素。 */
  readonly element: SVGSVGElement;

  private readonly prismOutline: SVGPolygonElement;

  private visible = false;

  /**
   * 直近に描いた多角形の頂点列。同じ文字列なら DOM を触らない。
   *
   * 断面図はプリズムを回しても変わらない（基底がプリズムに属するため）ので、
   * 実際にはほとんどの更新でここが一致し、属性の書き込みごと省かれる。
   */
  private lastPoints = '';

  /**
   * @param parent インセットを差し込む親要素（ビューポートの入れ物）
   */
  constructor(parent: HTMLElement) {
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

  /**
   * 断面図を描き直す。
   *
   * @param plane 分散平面（プリズムの姿勢から作った基底）
   * @param prismWorldVertices プリズム断面の頂点（ワールド座標）。前面の 3 点でよい
   */
  update(plane: DispersionPlane, prismWorldVertices: readonly Vec3[]): void {
    // 隠れているなら何もしない。トグル off のときのコストをゼロにする
    if (!this.visible || prismWorldVertices.length === 0) {
      return;
    }

    const uv = prismWorldVertices.map((vertex) => worldToDispersionUV(plane, vertex));
    const transform = fitViewport(
      boundsOf(uv),
      { width: SECTION_VIEW_SIZE, height: SECTION_VIEW_SIZE },
      SECTION_MARGIN_PX
    );

    const points = uv
      .map((coord) => {
        const point = uvToSvg(coord, transform);

        return `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
      })
      .join(' ');

    // プリズムを回しても断面図は変わらないので、ここはほぼ毎回一致して DOM を触らない
    if (points === this.lastPoints) {
      return;
    }

    this.lastPoints = points;
    this.prismOutline.setAttribute('points', points);
  }

  /** 要素を親から外す。 */
  dispose(): void {
    this.element.remove();
  }
}

/**
 * 断面座標の集まりを囲む軸並行の矩形を求める。
 *
 * @param uv 断面座標の並び。1 点以上
 * @returns 囲む矩形
 */
function boundsOf(uv: readonly PlaneUV[]): UvBounds {
  const us = uv.map((coord) => coord.u);
  const vs = uv.map((coord) => coord.v);

  return {
    minU: Math.min(...us),
    maxU: Math.max(...us),
    minV: Math.min(...vs),
    maxV: Math.max(...vs),
  };
}
