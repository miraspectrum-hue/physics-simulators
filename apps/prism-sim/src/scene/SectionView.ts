import { worldToDispersionUV } from '../optics/dispersionPlane';
import { displayColorCss } from '../optics/displayColor';
import type { DispersionPlane, LightPath, PlaneUV, Vec3 } from '../types/optics';

import { haloColorFor } from './labelHalo';
import {
  expandBounds,
  fitViewport,
  uvToSvg,
  type UvBounds,
  type ViewportTransform,
} from './dispersionViewport';
import { arcPolyline, normalizeUv, signedAngleDeg } from './sectionArc';

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

/** 角度弧を刻む数。320px の図では 24 で十分に滑らか。 */
const ARC_SEGMENTS = 24;

/** θ₁ の弧の半径 [px]。 */
const THETA_ARC_RADIUS_PX = 30;

/**
 * δ の弧の半径 [px]。
 *
 * 赤と紫で大きく変える。2 本の射出点は数 px しか離れていないので、半径が近いと
 * 弧もラベルも重なって読めなくなる。**離すのは見やすさのためだけで、弧が符号化して
 * いる角そのものは半径に依らない**（掃引角はどちらも自分の δ に一致する）。
 */
const RED_ARC_RADIUS_PX = 30;
const VIOLET_ARC_RADIUS_PX = 70;

/** 法線・入射方向の破線を伸ばす長さ [px]。 */
const NORMAL_LENGTH_PX = 46;

/** ラベルを弧の外側へ逃がす量 [px]。 */
const LABEL_OFFSET_PX = 21;

/**
 * ラベルの縁取りの太さ [px]。
 *
 * `paint-order: stroke` なので実際に文字の外へ出るのは半分の 1.5px。font-size 10 の
 * 字画（約 1.5px）に対して同程度の縁が付き、隣接画素まで縁取り色で埋まる。
 */
const LABEL_HALO_WIDTH_PX = 3;

/** θ₁ のラベルを置く位置（掃引の比率）。開けた側なので中点でよい。 */
const THETA_LABEL_FRACTION = 0.5;

/**
 * δ のラベルを置く位置（掃引の比率）。
 *
 * **赤と紫で角度方向にも離す。** 半径だけ変えても、2 本の射出点がほぼ同じ場所にある
 * ため、同じ向きに並んだ文字どうしが重なって読めなくなる。赤は弧の先（扇に近い側）、
 * 紫は破線の根元側へ置くと、径方向と角度方向の両方で離れる。
 */
const RED_LABEL_FRACTION = 0.72;
const VIOLET_LABEL_FRACTION = 0.12;

/** 注記の色。光線と混ざらない中間色。 */
const ANNOTATION_STROKE = '#8fa0bb';

/** 破線のパターン。 */
const DASH_PATTERN = '4 3';

/**
 * 断面図に添える注記（TASKS 6-1 段階4b）。
 *
 * **数値は SectionView が計算しない。** ラベルの文字列は配線側が情報バーとまったく
 * 同じ関数（`InfoOverlay.formatAngle`）で作って渡す。図が 49.3° で情報バーが 49.32°、
 * といった食い違いが起きる余地を残さないためである。
 *
 * 幾何（弧をどちら向きにどれだけ掃くか）は逆に **`paths` の折れ線だけ**から決まる。
 * SectionView はスネル則も屈折率も臨界角も引かない。
 */
export interface SectionAnnotation {
  /** 入口面の外向き法線（ワールド）。ビームが外れていれば null */
  readonly entryNormal: Vec3 | null;
  /** 出射面の外向き法線（ワールド）。射出しなければ null */
  readonly exitNormal: Vec3 | null;
  /** θ₁ のラベル。情報バーの「実測 θ₁」と同じ書式・同じ値 */
  readonly incidenceLabel: string | null;
  /** 赤側の参照光路（描画と同じ誇張）とそのラベル。射出しなければ null */
  readonly red: SectionDeviation | null;
  /** 紫側の参照光路とそのラベル */
  readonly violet: SectionDeviation | null;
}

/** 偏角の弧 1 本ぶん。 */
export interface SectionDeviation {
  /** 弧の向きを決める光路（ワールド座標）。 */
  readonly path: LightPath;
  /** ラベル。情報バーと同じ書式 */
  readonly label: string;
  /** 線の色 */
  readonly color: string;
}

export default class SectionView {
  /** インセットのルート要素。 */
  readonly element: SVGSVGElement;

  private readonly prismOutline: SVGPolygonElement;

  private readonly incidentLine: SVGPolylineElement;

  /**
   * 波長ごとの折れ線（内部区間 + 射出区間）。
   *
   * **本数はスペクトル表示モードで変わる**（TASKS 4-3）。貼り替えるのはこの並びだけで、
   * `element`・凍結した `transform`・三角形・弧・δ ラベルはそのまま持ち回る。
   * 特に `transform` を作り直すと、現在の姿勢で再フィットして**モードを切り替えた
   * だけで断面図の枠が動く**という回帰になる。
   */
  private rayLines: readonly SVGPolylineElement[];

  /** 構築時に凍結したビューポート。以後 `fitViewport` は呼ばない。 */
  private readonly transform: ViewportTransform;

  /** 注記の要素。作るのは構築時だけで、以後は属性を書き換える。 */
  private readonly entryNormalLine: SVGPolylineElement;
  private readonly exitNormalLine: SVGPolylineElement;
  private readonly theta1Arc: SVGPolylineElement;
  private readonly theta1Label: SVGTextElement;
  private readonly redLeg: SVGPolylineElement;
  private readonly redArc: SVGPolylineElement;
  private readonly redLabel: SVGTextElement;
  private readonly violetLeg: SVGPolylineElement;
  private readonly violetArc: SVGPolylineElement;
  private readonly violetLabel: SVGTextElement;

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
      const line = createRayLine(wavelengthNm);

      this.element.appendChild(line);

      return line;
    });

    // 入射光は波長で分かれないので 1 本だけ、光線群の上へ
    this.incidentLine = document.createElementNS(SVG_NS, 'polyline');
    this.incidentLine.setAttribute('fill', 'none');
    this.incidentLine.setAttribute('stroke', INCIDENT_STROKE);
    this.incidentLine.setAttribute('stroke-width', '1.5');
    this.element.appendChild(this.incidentLine);

    // 注記はいちばん上。破線の法線 → 弧 → ラベル の順に重ねる
    this.entryNormalLine = this.appendLine(ANNOTATION_STROKE, '1', DASH_PATTERN);
    this.exitNormalLine = this.appendLine(ANNOTATION_STROKE, '1', DASH_PATTERN);
    this.redLeg = this.appendLine(ANNOTATION_STROKE, '1', DASH_PATTERN);
    this.violetLeg = this.appendLine(ANNOTATION_STROKE, '1', DASH_PATTERN);
    this.theta1Arc = this.appendLine(ANNOTATION_STROKE, '1.2');
    this.redArc = this.appendLine(ANNOTATION_STROKE, '1.2');
    this.violetArc = this.appendLine(ANNOTATION_STROKE, '1.2');
    this.theta1Label = this.appendLabel(ANNOTATION_STROKE);
    this.redLabel = this.appendLabel(ANNOTATION_STROKE);
    this.violetLabel = this.appendLabel(ANNOTATION_STROKE);

    parent.appendChild(this.element);
  }

  /**
   * 折れ線を 1 本作って図に足す。
   *
   * @param stroke 線の色
   * @param width 線の太さ [px]
   * @param dash 破線のパターン。実線なら省略
   * @returns 作った要素
   */
  private appendLine(stroke: string, width: string, dash?: string): SVGPolylineElement {
    const line = document.createElementNS(SVG_NS, 'polyline');

    line.setAttribute('fill', 'none');
    line.setAttribute('stroke', stroke);
    line.setAttribute('stroke-width', width);
    line.setAttribute('stroke-linejoin', 'round');

    if (dash !== undefined) {
      line.setAttribute('stroke-dasharray', dash);
    }

    this.element.appendChild(line);

    return line;
  }

  /**
   * ラベルを 1 つ作って図に足す。
   *
   * @param fill 文字の色
   * @returns 作った要素
   */
  private appendLabel(fill: string): SVGTextElement {
    const label = document.createElementNS(SVG_NS, 'text');

    label.setAttribute('font-size', '10');
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'middle');
    applyLabelColor(label, fill);
    this.element.appendChild(label);

    return label;
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
    paths: readonly LightPath[],
    annotation: SectionAnnotation
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
    this.drawAnnotation(plane, paths, annotation);
  }

  /**
   * 波長の並びを差し替える（TASKS 4-3）。
   *
   * 入れ替えるのは光線の折れ線だけである。新しい線は**入射光より前**に差し込む。
   * 末尾へ足すと注記の上に光線が乗り、可読性パスで作った重なり順が壊れる。
   *
   * @param wavelengths 新しい波長の並び [nm]
   */
  setWavelengths(wavelengths: readonly number[]): void {
    for (const line of this.rayLines) {
      line.remove();
    }

    this.rayLines = wavelengths.map((wavelengthNm) => {
      const line = createRayLine(wavelengthNm);

      this.element.insertBefore(line, this.incidentLine);

      return line;
    });
  }

  /** 現在の折れ線の本数。**検証用**（貼り替えが効いたかを外から数える）。 */
  rayLineCount(): number {
    return this.rayLines.length;
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
   * 角度弧・ラベル・法線を描く。
   *
   * **幾何は光路の折れ線と面法線だけから決まる。** 角度を測り直す（asin する）ことは
   * しないし、ラベルの数値も自分では作らない。ここがやるのは「述べられている角を
   * 弧として符号化する」ことである。
   *
   * @param plane 分散平面
   * @param paths 光路（ワールド座標）
   * @param annotation 注記の材料
   */
  private drawAnnotation(
    plane: DispersionPlane,
    paths: readonly LightPath[],
    annotation: SectionAnnotation
  ): void {
    const toUv = (point: Vec3): PlaneUV => worldToDispersionUV(plane, point);
    // 向きは「原点 + 向き」を写して原点を引く。worldToDispersionUV は原点を引くので、
    // 原点にその向きを足した点を渡せば、返る uv がそのまま向きになる
    const dirToUv = (direction: Vec3): PlaneUV =>
      toUv({
        x: plane.origin.x + direction.x,
        y: plane.origin.y + direction.y,
        z: plane.origin.z + direction.z,
      });

    const incidentSegment = paths[0]?.segments[INCIDENT_SEGMENT_INDEX];

    // --- θ₁：入口点で「光源側へ戻る向き」と「面の外向き法線」のあいだ ---
    if (incidentSegment === undefined || annotation.entryNormal === null) {
      this.clearAnnotationGroup(this.entryNormalLine, this.theta1Arc, this.theta1Label);
    } else {
      const entry = toUv(incidentSegment.end);
      const back = normalizeUv(subUv(toUv(incidentSegment.start), entry));
      const normal = normalizeUv(dirToUv(annotation.entryNormal));

      this.drawDashedRay(this.entryNormalLine, entry, normal, NORMAL_LENGTH_PX);
      this.drawArc(
        this.theta1Arc,
        this.theta1Label,
        entry,
        back,
        normal,
        THETA_ARC_RADIUS_PX,
        annotation.incidenceLabel === null ? null : `θ₁ ${annotation.incidenceLabel}`,
        THETA_LABEL_FRACTION
      );
    }

    // --- δ：射出点で「入射の向き」と「射出の向き」のあいだ ---
    const incidentDir =
      incidentSegment === undefined
        ? null
        : normalizeUv(subUv(toUv(incidentSegment.end), toUv(incidentSegment.start)));

    this.drawDeviation(
      { leg: this.redLeg, arc: this.redArc, label: this.redLabel },
      toUv,
      incidentDir,
      annotation.red,
      RED_ARC_RADIUS_PX,
      RED_LABEL_FRACTION
    );
    this.drawDeviation(
      { leg: this.violetLeg, arc: this.violetArc, label: this.violetLabel },
      toUv,
      incidentDir,
      annotation.violet,
      VIOLET_ARC_RADIUS_PX,
      VIOLET_LABEL_FRACTION
    );

    // --- 射出面の法線 ---
    const exitPath = annotation.red ?? annotation.violet;
    const exitSegment = exitPath?.path.segments[exitPath.path.segments.length - 1];

    if (exitSegment === undefined || annotation.exitNormal === null) {
      this.exitNormalLine.setAttribute('points', '');
    } else {
      this.drawDashedRay(
        this.exitNormalLine,
        toUv(exitSegment.start),
        normalizeUv(dirToUv(annotation.exitNormal)),
        NORMAL_LENGTH_PX
      );
    }
  }

  /**
   * 偏角の弧を 1 本描く。
   *
   * 射出点に「入射と同じ向き」の破線を伸ばし、そこから射出方向までを弧で結ぶ。
   * 2 本の弧（赤・紫）の隙間がそのまま分離幅＝分散になる。
   *
   * @param target 書き込む要素の組
   * @param toUv ワールド点 → 断面座標
   * @param incidentDir 入射の向き（断面座標）。定まらなければ null
   * @param deviation 弧の材料。射出しなければ null
   * @param radiusPx 弧の半径 [px]
   */
  private drawDeviation(
    target: { leg: SVGPolylineElement; arc: SVGPolylineElement; label: SVGTextElement },
    toUv: (point: Vec3) => PlaneUV,
    incidentDir: PlaneUV | null,
    deviation: SectionDeviation | null,
    radiusPx: number,
    labelFraction: number
  ): void {
    if (incidentDir === null || deviation === null) {
      this.clearAnnotationGroup(target.leg, target.arc, target.label);

      return;
    }

    const segments = deviation.path.segments;
    const exitSegment = segments[segments.length - 1];

    if (exitSegment === undefined) {
      this.clearAnnotationGroup(target.leg, target.arc, target.label);

      return;
    }

    const exitPoint = toUv(exitSegment.start);
    const exitDir = normalizeUv(subUv(toUv(exitSegment.end), exitPoint));

    target.leg.setAttribute('stroke', deviation.color);
    target.arc.setAttribute('stroke', deviation.color);
    applyLabelColor(target.label, deviation.color);

    this.drawDashedRay(target.leg, exitPoint, incidentDir, radiusPx * 1.35);
    this.drawArc(
      target.arc,
      target.label,
      exitPoint,
      incidentDir,
      exitDir,
      radiusPx,
      deviation.label,
      labelFraction
    );
  }

  /**
   * 弧とそのラベルを描く。
   *
   * @param arc 弧を書き込む要素
   * @param label ラベルを書き込む要素
   * @param center 弧の中心（断面座標）
   * @param fromDir 掃引の始まりの向き（単位）
   * @param toDir 掃引の終わりの向き（単位）
   * @param radiusPx 半径 [px]
   * @param text ラベルの文字列。null なら出さない
   */
  private drawArc(
    arc: SVGPolylineElement,
    label: SVGTextElement,
    center: PlaneUV,
    fromDir: PlaneUV,
    toDir: PlaneUV,
    radiusPx: number,
    text: string | null,
    labelFraction: number
  ): void {
    // 弧は uv 空間で組むので、ピクセルの半径を uv の長さへ直す
    const radiusUv = radiusPx / this.transform.scale;

    arc.setAttribute(
      'points',
      this.toPoints(arcPolyline(center, radiusUv, fromDir, toDir, ARC_SEGMENTS))
    );

    if (text === null) {
      label.textContent = '';

      return;
    }

    // ラベルは弧の外側へ。どれだけ掃いた向きに置くかは呼び出し側が決める。
    // δ は扇のすぐ内側に弧が来るので、中点（0.5）に置くと文字が光線の上に乗る。
    // 破線側（小さい比率）へ寄せると、扇を避けたまま弧のそばに置ける
    const towardDeg = signedAngleDeg(fromDir, toDir) * labelFraction;
    const mid = rotateUv(fromDir, towardDeg);
    const labelUv = radiusUv + LABEL_OFFSET_PX / this.transform.scale;
    const point = uvToSvg(
      { u: center.u + labelUv * mid.u, v: center.v + labelUv * mid.v },
      this.transform
    );

    label.textContent = text;
    label.setAttribute('x', point.x.toFixed(2));
    label.setAttribute('y', point.y.toFixed(2));
  }

  /**
   * 点から向きへ伸びる破線を描く。
   *
   * @param line 書き込む要素
   * @param from 始点（断面座標）
   * @param direction 伸ばす向き（単位）
   * @param lengthPx 長さ [px]
   */
  private drawDashedRay(
    line: SVGPolylineElement,
    from: PlaneUV,
    direction: PlaneUV,
    lengthPx: number
  ): void {
    const lengthUv = lengthPx / this.transform.scale;

    line.setAttribute(
      'points',
      this.toPoints([
        from,
        { u: from.u + lengthUv * direction.u, v: from.v + lengthUv * direction.v },
      ])
    );
  }

  /** 注記の 1 組を消す（描けない状態で前回の絵を残さない）。 */
  private clearAnnotationGroup(
    line: SVGPolylineElement,
    arc: SVGPolylineElement,
    label: SVGTextElement
  ): void {
    line.setAttribute('points', '');
    arc.setAttribute('points', '');
    label.textContent = '';
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

/** 断面座標の差。向きを作るのに使う。 */
function subUv(a: PlaneUV, b: PlaneUV): PlaneUV {
  return { u: a.u - b.u, v: a.v - b.v };
}

/** 断面座標の向きを反時計回りに回す。ラベルの置き場所を弧の中ほどに取るために使う。 */
function rotateUv(direction: PlaneUV, angleDeg: number): PlaneUV {
  const angleRad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);

  return {
    u: direction.u * cos - direction.v * sin,
    v: direction.u * sin + direction.v * cos,
  };
}

/**
 * ラベルへ文字色と縁取りを当てる。
 *
 * 縁取りは**文字の下**へ塗る（`paint-order: stroke`）。上に塗ると線幅の半分が
 * 文字を食って細くなる。`stroke-linejoin: round` は角の尖りを丸めるためで、
 * 小さな文字では尖りが点に見える。
 *
 * 背後の光線は入射角や材質で動くので、ラベル位置での背景を事前に知ることはできない。
 * 縁取りが glyph を囲めば、文字の隣にあるのは常に縁取りの色になり、
 * 背景が何であってもコントラストの下限が決まる（`labelHalo.ts` 参照）。
 *
 * @param label 対象のテキスト要素
 * @param fill 文字の色
 */
function applyLabelColor(label: SVGTextElement, fill: string): void {
  label.setAttribute('fill', fill);
  label.setAttribute('stroke', haloColorFor(fill));
  label.setAttribute('stroke-width', String(LABEL_HALO_WIDTH_PX));
  label.setAttribute('stroke-linejoin', 'round');
  label.setAttribute('paint-order', 'stroke');
}

/**
 * 波長 1 つぶんの折れ線を作る（親には入れない）。
 *
 * 波長ごとの色は 3D と同じ源から引く。`BeamRenderer` は同じ値を WebGL の作業色空間へ
 * 変換して使っており、SVG に要るのは変換前の sRGB そのものである。
 *
 * @param wavelengthNm 波長 [nm]
 * @returns 折れ線の要素
 */
function createRayLine(wavelengthNm: number): SVGPolylineElement {
  const line = document.createElementNS(SVG_NS, 'polyline');

  line.setAttribute('fill', 'none');
  line.setAttribute('stroke', cssColor(wavelengthNm));
  line.setAttribute('stroke-width', '1');
  line.setAttribute('stroke-linejoin', 'round');

  return line;
}

/**
 * 波長を CSS の色にする。
 *
 * 3D のビームとまったく同じ入口（`displayColorCss`）から引く。輝度フロアの適用も
 * 線形 → sRGB の変換も向こうで済んでいるので、ここに色の判断は残さない。
 *
 * @param wavelengthNm 波長 [nm]
 * @returns 例 `rgb(255, 0, 0)`
 */
function cssColor(wavelengthNm: number): string {
  return displayColorCss(wavelengthNm);
}
