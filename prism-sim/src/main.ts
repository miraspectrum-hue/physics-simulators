/// <reference types="vite/client" />

import { AmbientLight, DirectionalLight, Matrix4, Vector3 } from 'three';
import WebGL from 'three/addons/capabilities/WebGL.js';

import { BK7, CONTINUOUS_SAMPLE_COUNT, LINE_D_NM, MATERIALS } from './optics/constants';
import {
  createTriangularPrism,
  createTriangularPrismVertices,
  intersectRayConvexSolid,
} from './optics/convexSolid';
import { dispersionPlane, worldToDispersionUV } from './optics/dispersionPlane';
import { refractiveIndex } from './optics/dispersion';
import { displayColorCss } from './optics/displayColor';
import { sampleWavelengths, wavelengthToRgb } from './optics/spectrum';
import {
  incidenceAngleDeg,
  traceEntryReflection,
  traceEntryReflectionSpectrum,
  traceSpectrum,
} from './optics/tracer';
import { dot, negate, normalize, sub, vec3 } from './optics/vec3';
import BandRenderer from './scene/BandRenderer';
import { composeCapturePng } from './scene/captureComposite';
import { wavelengthsForMode } from './optics/spectrumMode';
import BeamRenderer from './scene/BeamRenderer';
import FloorObject from './scene/FloorObject';
import InteractionCtl from './scene/InteractionCtl';
import {
  createIncidentRay,
  faceNormalAngleDeg,
  sourceAngleToWorldDeg,
} from './scene/lightSource';
import PrismObject, { PRISM_DEPTH, PRISM_SIDE_LENGTH } from './scene/PrismObject';
import {
  DEFAULT_PRISM_ROTATION_DEG,
  DEFAULT_PRISM_X,
  DEFAULT_PRISM_Y,
} from './scene/prismPose';
import {
  clipPathsToScreen,
  meanExitAnchor,
  projectPathsToScreen,
  type ExitAnchor,
} from './scene/screenProjection';
import SectionView, { type SectionAnnotation } from './scene/SectionView';
import { uvBoundsOf } from './scene/dispersionViewport';
import ScreenObject, {
  FALLBACK_ANCHOR,
  screenPlaneFromAnchor,
  SCREEN_HALF_EXTENT,
} from './scene/ScreenObject';
import { transformLightPath, transformRay } from './scene/rayTransform';
import SceneManager from './scene/SceneManager';
import type {
  ConvexSolid,
  DispersionPlane,
  Plane,
  LightPath,
  MaterialName,
  PrismMaterial,
  Ray,
  SpectrumMode,
  Vec3,
} from './types/optics';
import { animateAngle } from './ui/animateAngle';
import ControlPanel from './ui/ControlPanel';
import { minimumDeviationOf } from './ui/materialOptics';
import type { AppState } from './ui/store';
import InfoOverlay, { formatAngle, type InfoValues } from './ui/InfoOverlay';
import { createStore, SOURCE_ANGLE_MAX_DEG, SOURCE_ANGLE_MIN_DEG } from './ui/store';
import { captureFileName } from './ui/captureFileName';
import { decodeUrl, encodeUrl, type ShareableState } from './ui/shareUrl';
import { renderWebGLFallback } from './ui/webglFallback';

import './styles/main.css';

/**
 * アプリ全体の配線。
 *
 * 姿勢の単一の真実は `PrismObject.object.matrixWorld` で、光路は常にプリズムの局所空間で
 * 追跡してからワールドへ戻す（SPEC.md「光路計算」1）。光路の再計算は dirty フラグで
 * 抑制し、描画ループ自体は常時回す（CLAUDE.md「Three.js 運用」）。
 *
 * NOTE: S-4（world⇔local 変換）と S-5（更新経路がジオメトリを再生成しないこと）の
 *       検証ログは、確認済みのため撤去した。分光の数値検証 `reportSpectrum` のみ残す。
 */

/** 左側面の中点（局所座標）。tracer のテストが入射点として使う実績値。 */
const LEFT_FACE_MIDPOINT: Vec3 = vec3(-0.5, 0.288675134594813, 0);

/** 入射面（左側面）の平面集合における添字。 */
const ENTRY_PLANE_INDEX = 0;

/**
 * 情報バーに出す代表波長 [nm]。赤端と紫端。
 *
 * `reportSpectrum` の参照 3 波長と揃えてあるので、起動時のコンソール出力（m=1 の確定値）と
 * 画面の表示を直接突き合わせられる。
 */
const REPORT_RED_NM = 660;
const REPORT_VIOLET_NM = 410;

/** 狙点までの助走距離。 */
const APPROACH_DISTANCE = 3;

/**
 * 最小偏角へ寄せる遷移にかける時間 [ms]（SPEC.md「F-27 アニメーション遷移」）。
 *
 * 扇が畳まれていく過程が読める程度に長く、操作の待ちにならない程度に短く。
 */
const MIN_DEVIATION_TRANSITION_MS = 450;

/**
 * 最小偏角に合わせられないときの案内（TASKS 6-2）。
 *
 * プリズムを回すと、同じ実測 θ₁ を得るのに必要なスライダー値が回転角のぶんだけずれる。
 * ずれが大きいと目標値が可動域 ±89° を外れる。**黙ってクランプしない** ——
 * クランプすると「押したのに最小偏角にならない」が理由も出ずに起きるため。
 */
const MIN_DEVIATION_OUT_OF_RANGE_NOTICE =
  `この姿勢では最小偏角に届きません（必要な入射角がスライダーの可動域 ` +
  `${SOURCE_ANGLE_MIN_DEG}〜${SOURCE_ANGLE_MAX_DEG}° を外れます）。プリズムを戻してください。`;

/**
 * URL を書き換えるまでの静穏時間 [ms]（TASKS 6-6 段階4）。
 *
 * **URL は「落ち着いた状態」だけを映す。** スライダーのドラッグも最小偏角の遷移
 * （450ms・約 27 フレーム）も、状態が変わるたびに `replaceState` を撃つと
 * 1 操作で数十回書くことになる。最後の変化から静穏時間が経ってから 1 回だけ書く。
 */
const URL_UPDATE_DEBOUNCE_MS = 300;

/**
 * 入射面反射の表示ゲイン。
 *
 * 空気→ガラスの反射率は既定姿勢で 0.06 前後しかなく、そのままでは暗背景に埋もれて
 * 「反射光が出ている」ことすら読み取れない。教材として **「入射角を上げるほど反射が
 * 明るくなる」**という関係が読み取れるよう、見える明るさへ持ち上げる。
 *
 * `PrismObject` の `RIM_GAIN` と同じく**非物理の演出**であり、モデル側の
 * `Segment.intensity`（＝実物理の R）には一切戻さない。情報バーには生の R を出す。
 *
 * 掛け算（min(R×k, 1)）ではなく平方根を採るのは、掛け算だと R > 1/k が 1 に張り付いて
 * **高入射角側の明暗の勾配が潰れる**ため。平方根なら全域で単調増加が保たれる
 * （0.059 → 0.243、0.905 → 0.951）。
 */
const REFLECTION_DISPLAY_EXPONENT = 0.5;

/** 反射光路のうち入射区間の添字。ここは主光路が同じ線を描いているので二重に描かない。 */
const INCIDENT_SEGMENT_INDEX = 0;

/**
 * 反射ビームの表示用強度写像。
 *
 * 入射区間は主光路の 1 本目とまったく同じ線分なので、強度 0 にして描かせない
 * （加算ブレンドなので黒は何も足さない）。二重に描くと入射ビームだけが 2 倍明るくなり、
 * 「主光路は反射の追加前後で不変」という前提が崩れる。
 *
 * @param intensity モデルが持つ相対強度（反射区間なら実物理の R_entry）
 * @param segmentIndex 光路内での区間の添字
 * @returns 描画に使う強度
 */
const shapeReflectionIntensity = (intensity: number, segmentIndex: number): number =>
  segmentIndex === INCIDENT_SEGMENT_INDEX ? 0 : intensity ** REFLECTION_DISPLAY_EXPONENT;

const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;

/** 起動時の座標変換に使う作業用インスタンス。毎フレームの経路では使わない。 */
const workVector = new Vector3();

/**
 * 断面図の基底を matrixWorld から取り出すための作業用インスタンス。
 *
 * 使い回すのは CLAUDE.md の「毎フレームでの `new` を禁止」に従うため。
 * 呼ばれるのは dirty なフレームだけで、しかも断面図が表示されているときに限る。
 */
const sectionOrigin = new Vector3();
const sectionAxisU = new Vector3();
const sectionApexEdge = new Vector3();

/**
 * 点を局所座標からワールドへ移す。
 *
 * @param point 局所座標の点
 * @param localToWorld 局所 → ワールドの変換行列
 * @returns ワールド座標の点
 */
function toWorldPoint(point: Vec3, localToWorld: Matrix4): Vec3 {
  const moved = workVector.set(point.x, point.y, point.z).applyMatrix4(localToWorld);

  return vec3(moved.x, moved.y, moved.z);
}

/**
 * 方向を局所座標からワールドへ移す（平行移動は効かない）。
 *
 * @param direction 局所座標の方向（単位ベクトル）
 * @param localToWorld 局所 → ワールドの変換行列
 * @returns ワールド座標の方向（単位ベクトル）
 */
function toWorldDirection(direction: Vec3, localToWorld: Matrix4): Vec3 {
  const moved = workVector
    .set(direction.x, direction.y, direction.z)
    .transformDirection(localToWorld);

  return vec3(moved.x, moved.y, moved.z);
}

/**
 * 進行中の入射角の遷移（TASKS 6-2 段階4）。
 *
 * `material` を控えるのは、遷移の目標が**その材質の** θ₁_min だからである。
 * 途中で材質が変われば目標は無効になり、古い値へ着地させてはならない。
 */
interface AngleTransition {
  /** 押した時点の入射角 [deg]。 */
  readonly from: number;
  /** 着地させる入射角 [deg]。段階3 の即時適用と同じ値。 */
  readonly to: number;
  /** 開始時刻 [ms]（`performance.now()`）。 */
  readonly startMs: number;
  /** 開始時点の材質。変わったら遷移を取り消す。 */
  readonly material: MaterialName;
}

/**
 * OS の「視差効果を減らす」設定を見る。
 *
 * 押すたびに見るので、設定を変えたあと再読み込みしなくても効く。
 *
 * @returns 動きを減らす設定なら true
 */
function prefersReducedMotion(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * 角度を (-180, 180] へ折り返す。
 *
 * 入射面法線のワールド角は `atan2` 由来なので、プリズムを ±180° 付近まで回すと
 * 凍結した基準との差が 360° 跳ねうる。折り返しておけば「最短の回し量」として読める。
 *
 * @param angleDeg 折り返す角度 [deg]
 * @returns (-180, 180] に収めた角度 [deg]
 */
function normalizeAngleDeg(angleDeg: number): number {
  return ((((angleDeg + 180) % 360) + 360) % 360) - 180;
}

/** 点が面の上に載っているとみなす許容差。追跡が返す交点なので丸めしか乗らない。 */
const ON_PLANE_TOLERANCE = 1e-9;

/**
 * 点が載っている面の外向き法線を平面集合から探す（TASKS 6-1 段階4b）。
 *
 * 断面図の「面の法線を破線で描く」ためだけに使う**純粋に幾何の**手続きで、
 * 屈折率にも臨界角にも触れない。追跡が返した交点をそのまま渡す。
 *
 * @param point 面の上にあるはずの点（局所座標）
 * @param solid プリズムの平面集合
 * @returns 外向き法線（局所座標）。どの面にも載っていなければ null
 */
function faceNormalAt(point: Vec3, solid: ConvexSolid): Vec3 | null {
  const found = solid.find(
    (face: Plane) => Math.abs(dot(face.normal, point) - face.distance) < ON_PLANE_TOLERANCE
  );

  return found?.normal ?? null;
}

/**
 * 入口面の外向き法線を求める。
 *
 * `measuredIncidenceDeg` と同じ `intersectRayConvexSolid` から取る。情報バーの θ₁ と
 * 断面図の θ₁ の弧が、同じ面を基準にしていることがこれで保証される。
 *
 * @param localRay 局所空間の入射レイ
 * @param solid プリズムの平面集合
 * @returns 外向き法線（局所座標）。ビームが外れていれば null
 */
function entryFaceNormal(localRay: Ray, solid: ConvexSolid): Vec3 | null {
  const hit = intersectRayConvexSolid(localRay, solid);

  if (hit === null || hit.tExit <= 0) {
    return null;
  }

  return hit.enterPlane.normal;
}

/**
 * 光路の総偏角（入射方向と最終射出方向のなす角）を求める。
 *
 * @param path 光路
 * @returns 偏角 [deg]
 */
function deviationDeg(path: LightPath): number {
  const first = path.segments[0];
  const last = path.segments[path.segments.length - 1];

  if (first === undefined || last === undefined) {
    return Number.NaN;
  }

  const incident = normalize(sub(first.end, first.start));
  const exit = normalize(sub(last.end, last.start));

  return Math.acos(Math.min(Math.max(dot(incident, exit), -1), 1)) * DEG_PER_RAD;
}

/**
 * 射出した光路の偏角。情報バーに出す δ の唯一の源。
 *
 * `deviationDeg` は外部区間（入射・射出）だけを見るので、θ₁ = 0 で内部区間が長さ 0 に
 * 縮退しても影響を受けない。射出しなかった光路（全反射で打ち切られた・外れた）には
 * 偏角が定義できないため null を返す。NaN は返さない。
 *
 * @param path 光路。存在しなければ undefined でよい
 * @returns 偏角 [deg]。定義できなければ null
 */
function exitedDeviationDeg(path: LightPath | undefined): number | null {
  if (path === undefined || path.termination !== 'exited') {
    return null;
  }

  const value = deviationDeg(path);

  return Number.isFinite(value) ? value : null;
}

/**
 * 分光の結果を既知オラクルと照合できる形でコンソールへ出す（S-3 の主たる検証手段）。
 *
 * @param incidentRay 入射レイ
 * @param solid プリズムの平面集合
 * @param exaggeration 描画に用いる分散誇張倍率（参照 3 波長は物理検証のため常に m=1 で出す）
 */
function reportSpectrum(incidentRay: Ray, solid: ConvexSolid, exaggeration: number): void {
  const format = (v: Vec3): string =>
    `(${v.x.toFixed(9)}, ${v.y.toFixed(9)}, ${v.z.toFixed(9)})`;

  // 代表 3 波長は m=1 の実物理。spectrum / tracer のテストが持つ確定値と直接照合できる
  console.log('=== 代表波長の偏角（局所空間・m=1 実物理）===');
  const referencePaths = traceSpectrum(incidentRay, solid, BK7, [660, 550, 410]);
  referencePaths.forEach((path) => {
    const rgb = wavelengthToRgb(path.wavelengthNm);
    console.log(
      `  λ=${path.wavelengthNm}nm  n=${path.refractiveIndex.toFixed(15)}` +
        `  偏角=${deviationDeg(path).toFixed(9)}度` +
        `  rgb=(${rgb.r.toFixed(6)}, ${rgb.g.toFixed(6)}, ${rgb.b.toFixed(6)})`
    );
  });

  const red = referencePaths[0];
  const violet = referencePaths[2];
  if (red !== undefined && violet !== undefined) {
    const separationDeg = deviationDeg(violet) - deviationDeg(red);
    console.log(`  分離幅（紫 - 赤） = ${separationDeg.toFixed(9)} 度`);
  }

  // 実際に描画する連続スペクトル（分散誇張を適用）
  const paths = traceSpectrum(
    incidentRay,
    solid,
    BK7,
    sampleWavelengths(CONTINUOUS_SAMPLE_COUNT),
    exaggeration
  );
  const first = paths[0];
  const last = paths[paths.length - 1];

  console.log(`=== 連続スペクトル（${paths.length} 波長・分散誇張 m=${exaggeration}）===`);
  if (first !== undefined && last !== undefined) {
    console.log(
      `  λ=${first.wavelengthNm}nm 偏角=${deviationDeg(first).toFixed(9)}度` +
        ` / λ=${last.wavelengthNm}nm 偏角=${deviationDeg(last).toFixed(9)}度` +
        ` / 扇の広がり=${(deviationDeg(first) - deviationDeg(last)).toFixed(9)}度`
    );
    console.log(`  入射点 ${format(first.segments[0]?.end ?? vec3(0, 0, 0))}`);
  }
  console.log(`  termination の内訳 = ${summarizeTerminations(paths)}`);
}

/**
 * 入射面での実測の入射角を求める。
 *
 * スライダーは「既定姿勢での入射角」を指すので、プリズムを回すとこの実測値は乖離する。
 * それが案 A（光源はワールド固定）の帰結であり、乖離そのものを見せることに意味がある。
 *
 * @param localRay 局所空間の入射レイ
 * @param solid プリズムの平面集合
 * @returns 入射角 [deg]。ビームがプリズムを外れていれば null（NaN を返さない）
 */
function measuredIncidenceDeg(localRay: Ray, solid: ConvexSolid): number | null {
  const hit = intersectRayConvexSolid(localRay, solid);

  if (hit === null || hit.tExit <= 0) {
    return null;
  }

  return incidenceAngleDeg(localRay.direction, hit.enterPlane.normal);
}

/**
 * 入射面の反射率を求める。情報バーに出す**生の R**の唯一の源。
 *
 * 表示ゲイン（`REFLECTION_DISPLAY_EXPONENT`）は掛けない。絵の明るさは演出で持ち上げるが、
 * 数値は物理の事実を出す（I-6 で確定した「実物理を主役にする」方針と同じ）。
 *
 * 基準波長は d 線（CLAUDE.md「基準波長は He の d 線 587.56nm に統一する」）で、
 * 誇張倍率も掛けない。反射率は波長でわずかに変わるが、情報バーが示すのは代表値である。
 *
 * @param localRay 局所空間の入射レイ
 * @param solid プリズムの平面集合
 * @param material プリズムの材質
 * @returns 入射面の反射率（0〜1）。ビームがプリズムを外れていれば null
 */
function entryReflectanceAt(
  localRay: Ray,
  solid: ConvexSolid,
  material: PrismMaterial
): number | null {
  const path = traceEntryReflection(
    localRay,
    solid,
    refractiveIndex(material, LINE_D_NM),
    LINE_D_NM
  );

  if (path === null) {
    return null;
  }

  // 反射区間（2 本目）の強度が R_entry そのもの
  return path.segments[1]?.intensity ?? null;
}

/**
 * スライダー角の較正が正しいことをコンソールへ出す（I-3 の主たる検証手段）。
 *
 * 既定姿勢では「スライダー値 == 実測 θ₁」が成り立つ。成り立たなければ較正がずれている。
 *
 * @param sliderAngleDeg スライダーの入射角 [deg]
 * @param aimPoint 凍結した狙点（ワールド座標）
 * @param entryNormalAngleDeg 凍結した入射面法線のワールド角 [deg]
 * @param worldToLocal ワールド → 局所の変換行列
 * @param solid プリズムの平面集合
 */
function reportCalibration(
  sliderAngleDeg: number,
  aimPoint: Vec3,
  entryNormalAngleDeg: number,
  worldToLocal: Matrix4,
  solid: ConvexSolid
): void {
  console.log('=== I-3 スライダー角の較正 ===');
  console.log(`  入射面法線のワールド角 = ${entryNormalAngleDeg.toFixed(9)} 度`);
  console.log(
    `  狙点（ワールド） = (${aimPoint.x.toFixed(9)}, ${aimPoint.y.toFixed(9)}, ` +
      `${aimPoint.z.toFixed(9)})`
  );

  for (const angleDeg of [0, 30, sliderAngleDeg, 89]) {
    const worldRay = createIncidentRay(
      aimPoint,
      sourceAngleToWorldDeg(angleDeg, entryNormalAngleDeg),
      APPROACH_DISTANCE
    );
    const measured = measuredIncidenceDeg(transformRay(worldRay, worldToLocal), solid);

    console.log(
      `  スライダー ${angleDeg.toFixed(6)}度 → 実測 ` +
        `${measured === null ? '—' : `${measured.toFixed(9)}度`}`
    );
  }
}

/**
 * 扇の広がり（両端の波長の偏角差）を求める。材質・誇張倍率の効きを数値で見るための指標。
 *
 * ダイヤモンドのように「左面で入射 → 右面で全反射 → 底面から射出」する経路では、
 * 正三角形の幾何から r₃ = r₁ となり θ₃ = θ₁ が導かれるため、偏角が屈折率に依存しない
 * （定偏角プリズムと同じ原理）。この場合の 0 は不具合ではなく物理的に正しい値である。
 *
 * NaN を 0 に潰さないのは、それが診断値であり、異常を隠すと切り分けができなくなるため。
 *
 * @param paths 波長順に並んだ光路
 * @returns 広がり [deg]。光路が空なら NaN
 */
function spreadDeg(paths: readonly LightPath[]): number {
  const first = paths[0];
  const last = paths[paths.length - 1];

  if (first === undefined || last === undefined) {
    return Number.NaN;
  }

  return deviationDeg(first) - deviationDeg(last);
}

/**
 * 全反射を経た光路の本数を数える。
 *
 * 内部区間が 2 本以上あることが「途中の面で全反射した」ことと同値になる
 * （1 本なら入射面から出射面へ直接抜けている）。区間の向きは使わないので、
 * θ₁ = 0 の縮退区間があっても数え方は壊れない。
 *
 * @param paths 光路の束
 * @returns 全反射を経た本数
 */
function countTotalReflectionPaths(paths: readonly LightPath[]): number {
  return paths.filter(
    (path) => path.segments.filter((segment) => segment.insidePrism).length >= 2
  ).length;
}

/** termination ごとの本数を数える（全反射で欠ける波長がないかの確認）。 */
function summarizeTerminations(paths: readonly LightPath[]): string {
  const counts = new Map<string, number>();

  for (const path of paths) {
    counts.set(path.termination, (counts.get(path.termination) ?? 0) + 1);
  }

  return [...counts].map(([key, value]) => `${key}: ${value}`).join(', ');
}

function main(): void {
  const container = document.querySelector<HTMLDivElement>('#app');

  if (container === null) {
    throw new Error('#app が見つかりません');
  }

  // 検出（TASKS 5-3）。SceneManager を構築する前に確かめる。ここで弾けば
  // WebGLRenderer は一度も投げず、無地画面のまま固まることがなくなる
  if (!WebGL.isWebGL2Available()) {
    renderWebGLFallback(container);

    return;
  }

  // WebGL2 が「使える」と報告されていても、GPU ブロックリストやドライバの都合で
  // 実際のコンテキスト生成が失敗することがある。ここだけをスコープ限定で囲み、
  // 以降の無関係なバグまで飲み込まないようにする（main() 全体は囲わない）
  let sceneManager: SceneManager;

  try {
    sceneManager = new SceneManager(container);
  } catch (error) {
    // UX は救うが原因は握り潰さない
    console.error(error);
    renderWebGLFallback(container);

    return;
  }

  const prism = new PrismObject();
  prism.object.rotation.z = DEFAULT_PRISM_ROTATION_DEG * RAD_PER_DEG;
  prism.object.updateMatrixWorld(true);
  sceneManager.scene.add(prism.object);

  // 床と背景はシミュレーションに関与しない演出（TASKS 2-6）。光路計算はこれらを知らない
  const floor = new FloorObject();
  sceneManager.scene.add(floor.object);

  sceneManager.scene.add(new AmbientLight(0xffffff, 1.2));
  const keyLight = new DirectionalLight(0xffffff, 2);
  keyLight.position.set(3, 4, 5);
  sceneManager.scene.add(keyLight);

  // 姿勢の単一の真実は matrixWorld。平面集合は標準配置のまま固定し、レイの方を変換する
  const localToWorld = prism.object.matrixWorld;
  const worldToLocal = new Matrix4().copy(localToWorld).invert();

  const solid = createTriangularPrism(PRISM_SIDE_LENGTH, PRISM_DEPTH);

  // 光源はプリズムから独立してワールドに存在する。狙点と入射角の基準は「意図した既定姿勢」から
  // 起動時に一度だけ導出して凍結する。以後プリズムを動かしても、この 2 つは追従しない
  // （追従させると、プリズムを動かしてもビームが外れなくなり 3-8 が成立しない）
  const aimPoint = toWorldPoint(LEFT_FACE_MIDPOINT, localToWorld);
  const entryPlane = solid[ENTRY_PLANE_INDEX];

  /**
   * 現在の入射面法線のワールド角 [deg]。プリズムを回すとこの値は動く。
   * 下で凍結する `entryNormalAngleDeg` との差が、そのまま「回した量」になる。
   */
  const currentEntryNormalAngleDeg = (): number =>
    entryPlane === undefined
      ? 0
      : faceNormalAngleDeg(toWorldDirection(negate(entryPlane.normal), localToWorld));

  const entryNormalAngleDeg = currentEntryNormalAngleDeg();

  const store = createStore();

  // 描画に使う波長列は表示モードが決める（TASKS 4-3）。切替のたびに貼り替わるので
  // const にはできない。`traceWorldPaths` などはこの束縛を閉じ込めて読む
  let wavelengths = wavelengthsForMode(store.getState().spectrumMode);

  const panel = new ControlPanel(document.body, store);
  const overlay = new InfoOverlay(container);

  // 波長ごとの基準色はここで一度だけ決まる。実際に描く明るさは
  // 「基準色 × 区間の強度」で毎フレーム決まる（TASKS 6-5a）
  const beams = new BeamRenderer(wavelengths);
  sceneManager.scene.add(beams.object);

  // 入射面で跳ね返った光（TASKS 6-5b）。主光路と同じ 48 スロット機構をそのまま使う。
  // 描画は表示ゲイン付きだが、モデルの強度は実物理のまま
  const reflectionBeams = new BeamRenderer(wavelengths, shapeReflectionIntensity);
  sceneManager.scene.add(reflectionBeams.object);

  /**
   * 現在の状態でワールド座標の光路を求める。
   *
   * スクリーンの初期配置と毎フレームの更新で同じ経路を通すために切り出す。
   *
   * @param state 現在の状態
   * @returns ワールド座標の光路
   */
  const traceWorldPaths = (state: AppState): readonly LightPath[] => {
    const worldIncidentRay = createIncidentRay(
      aimPoint,
      sourceAngleToWorldDeg(state.sourceAngleDeg, entryNormalAngleDeg),
      APPROACH_DISTANCE
    );
    const localRay = transformRay(worldIncidentRay, worldToLocal);
    const localPaths = traceSpectrum(
      localRay,
      solid,
      MATERIALS[state.material],
      wavelengths,
      state.exaggeration
    );

    return localPaths.map((path) => transformLightPath(path, localToWorld));
  };

  // スクリーンの向きは凍結したアンカーが決める。材質を変えてもプリズムを回しても追従しない
  // （追従させると「自分で動かして虹を捕まえる」体験が失われる。案 C）。
  // 更新されるのは「光路に合わせる」を押したときだけで、距離スライダーはこの上を滑るだけ。
  let screenAnchor: ExitAnchor = meanExitAnchor(traceWorldPaths(store.getState())) ?? FALLBACK_ANCHOR;
  const screen = new ScreenObject(
    screenPlaneFromAnchor(screenAnchor, store.getState().screenDistance, SCREEN_HALF_EXTENT)
  );
  sceneManager.scene.add(screen.object);

  /**
   * 現在のアンカーと距離からスクリーンの姿勢を組み直す。
   *
   * @param distance 射出点からの距離
   */
  const applyScreenPose = (distance: number): void => {
    screen.setPlane(screenPlaneFromAnchor(screenAnchor, distance, SCREEN_HALF_EXTENT));
  };

  /**
   * 凍結アンカーを差し替えて板を置き直す（TASKS 6-6 段階3）。
   *
   * **「光路に合わせる」と同じ適用口を通す。** 共有 URL から復元するときも
   * ここを通るので、「押したとき」と「復元したとき」で経路が分かれない。
   * アンカーは導出値ではなく**凍結された状態**なので、復元時に再導出してはならない
   * （再導出すると、共有者がボタンを押していないのに受け取り側では光路にぴったり
   * 合う、という別の絵になる）。
   *
   * @param anchor 置き直すアンカー
   */
  const setScreenAnchor = (anchor: ExitAnchor): void => {
    screenAnchor = anchor;
    applyScreenPose(store.getState().screenDistance);
    markDirty();
  };

  const band = new BandRenderer(wavelengths);
  sceneManager.scene.add(band.object);

  /** プリズム断面の頂点（局所座標）。前面の 3 点。奥行き方向は uv に出ないので前面だけでよい */
  const sectionLocalVertices = createTriangularPrismVertices(
    PRISM_SIDE_LENGTH,
    PRISM_DEPTH
  ).slice(0, 3);

  /**
   * 現在の姿勢から分散平面を組む。
   *
   * 基底は **matrixWorld の列**から取る。列 0 がプリズム局所 x 軸、列 2 が頂角エッジの
   * 向き（局所 z 軸）で、どちらもワールドでの向きになっている。ここをワールド固定の
   * 基底にすると断面図の中でプリズムが回ってしまう（6-1 D 節が縛っている性質）。
   *
   * @returns 分散平面
   */
  const currentDispersionPlane = (): DispersionPlane => {
    sectionOrigin.setFromMatrixPosition(localToWorld);
    sectionAxisU.setFromMatrixColumn(localToWorld, 0).normalize();
    sectionApexEdge.setFromMatrixColumn(localToWorld, 2).normalize();

    return dispersionPlane(
      vec3(sectionOrigin.x, sectionOrigin.y, sectionOrigin.z),
      vec3(sectionAxisU.x, sectionAxisU.y, sectionAxisU.z),
      vec3(sectionApexEdge.x, sectionApexEdge.y, sectionApexEdge.z)
    );
  };

  /** プリズム断面の頂点（ワールド座標）。姿勢が変わるたびに取り直す。 */
  const sectionWorldVertices = (): readonly Vec3[] =>
    sectionLocalVertices.map((vertex) => toWorldPoint(vertex, localToWorld));

  // 断面 2D ビュー（TASKS 6-1）。既定は非表示で、隠れている間は update が即座に戻る。
  // **ビューポートはここで一度だけ決まる。** プリズム断面は姿勢に依らず一定なので、
  // 起動時の範囲を凍結してよく、以後は光線がどれだけ動いても図が拡縮しない
  const sectionView = new SectionView(
    container,
    wavelengths,
    uvBoundsOf(
      sectionWorldVertices().map((vertex) =>
        worldToDispersionUV(currentDispersionPlane(), vertex)
      )
    )
  );
  sceneManager.onResize((width, height) => {
    beams.setResolution(width, height);
    reflectionBeams.setResolution(width, height);
  });

  // 光路の再計算は姿勢や入射角が変わったフレームだけ行う（CLAUDE.md「Three.js 運用」）
  let dirty = true;

  const markDirty = (): void => {
    dirty = true;
  };

  /**
   * `refreshBeams` が実際に再計算まで進んだ回数。**検証用**（TASKS 4-7）。
   *
   * `dirty` ガードで早期 return したときは増えない。グロー・数値表示のトグルが
   * `markDirty` を経由しないこと（＝再計算を誘発しないこと）を外から数えて確かめる。
   */
  let refreshBeamsRunCount = 0;

  /**
   * `interaction.onCameraChange` の購読者が呼ばれた回数。**検証用**（カメラ共有）。
   *
   * `OrbitControls` の `'change'` が実際に中継されているかを外から数えて確かめる。
   */
  let cameraChangeRunCount = 0;

  /** 直前に出力した termination の内訳。変化した時だけログを出すために持つ。 */
  let lastTerminationSummary = '';

  /**
   * 光路を引き直したあとに呼ぶフック（TASKS 6-6 段階4 の URL 追従）。
   *
   * `refreshBeams` は dirty なフレームでしか走らないので、ここへ挿すだけで
   * 「状態が変わったとき」をひとつ残らず拾える。配線が済むまでは何もしない。
   */
  let onBeamsRefreshed: () => void = () => {};

  /**
   * 直近に 3D ビームへ渡した光路。**検証用**（6-1 オラクル①）。
   *
   * 断面図へ渡すのと同じ参照であることを外から `===` で確かめられるようにする。
   */
  let lastBeamPaths: readonly LightPath[] = [];

  /** 直前にスクリーン姿勢へ反映した距離。変化した時だけ組み直す。 */
  let appliedScreenDistance = store.getState().screenDistance;

  const refreshBeams = (): void => {
    if (!dirty) {
      return;
    }
    dirty = false;
    refreshBeamsRunCount += 1;

    const state = store.getState();

    prism.object.updateMatrixWorld(true);
    worldToLocal.copy(localToWorld).invert();

    const worldIncidentRay = createIncidentRay(
      aimPoint,
      sourceAngleToWorldDeg(state.sourceAngleDeg, entryNormalAngleDeg),
      APPROACH_DISTANCE
    );
    const localRay = transformRay(worldIncidentRay, worldToLocal);
    const material = MATERIALS[state.material];

    // 見た目だけの反映（TASKS 4-2c）。光路計算はこの下で material から独立に屈折率を引く
    prism.setRefractiveIndex(material.catalogNd);

    const localPaths = traceSpectrum(localRay, solid, material, wavelengths, state.exaggeration);

    const worldPaths = localPaths.map((path) => transformLightPath(path, localToWorld));

    // 距離スライダーはアンカー上を滑らせるだけ。向きも原点も変えない
    if (state.screenDistance !== appliedScreenDistance) {
      appliedScreenDistance = state.screenDistance;
      applyScreenPose(appliedScreenDistance);
    }

    // スクリーンに載る波長を選び、載ったものだけビームを交点までに縮める（(あ)）。
    // 射影の計算に EXIT_EXTENSION_LENGTH は関与しない
    const hits = projectPathsToScreen(worldPaths, screen.plane);

    // 更新はバッファの書き換えのみ。ジオメトリも属性も作り直さない。
    // **この配列が 3D ビームと断面図の唯一の真実**で、両者へ同じ参照を渡す（6-1 オラクル①）
    const sharedPaths = clipPathsToScreen(worldPaths, hits);

    lastBeamPaths = sharedPaths;
    beams.update(sharedPaths);
    band.update(hits, screen.plane);

    // 反射光はスクリーンとは逆（光源側）へ後退するので、投影経路には乗せない
    // （projectPathsToScreen は 'exited' だけを拾う）。固定長 48 なので分岐は要らない
    const localReflections = traceEntryReflectionSpectrum(
      localRay,
      solid,
      material,
      wavelengths,
      state.exaggeration
    );
    reflectionBeams.update(localReflections.map((path) => transformLightPath(path, localToWorld)));

    // スライダーは既定姿勢での入射角。プリズムを回すとここが乖離する（案 A の肝）
    const measured = measuredIncidenceDeg(localRay, solid);

    // 情報バーの主役は「物理の事実」なので、n と δ は誇張を掛けない m=1 で別に追跡する。
    // **描画の波長列とは独立**なので、スペクトル表示モードを切り替えても
    // n・δ・分離幅は 1 ビットも動かない（全反射の本数だけが実本数に追従する）
    const referenceWavelengths = [REPORT_RED_NM, REPORT_VIOLET_NM];
    const physicalPaths = traceSpectrum(localRay, solid, material, referenceWavelengths);

    // 描画側の分離幅も同じ 2 波長で測る。サンプル列の両端（連続なら 380/750nm）で測ると
    // 実物理の値と波長範囲が食い違い、括弧内の比較が成り立たなくなる
    const drawnPaths =
      state.exaggeration === 1
        ? physicalPaths
        : traceSpectrum(localRay, solid, material, referenceWavelengths, state.exaggeration);
    const drawnRed = exitedDeviationDeg(drawnPaths[0]);
    const drawnViolet = exitedDeviationDeg(drawnPaths[1]);

    const info: InfoValues = {
      measuredIncidenceDeg: measured,
      redWavelengthNm: REPORT_RED_NM,
      violetWavelengthNm: REPORT_VIOLET_NM,
      redIndex: refractiveIndex(material, REPORT_RED_NM),
      violetIndex: refractiveIndex(material, REPORT_VIOLET_NM),
      redDeviationDeg: exitedDeviationDeg(physicalPaths[0]),
      violetDeviationDeg: exitedDeviationDeg(physicalPaths[1]),
      drawnSpreadDeg: drawnViolet === null || drawnRed === null ? null : drawnViolet - drawnRed,
      exaggeration: state.exaggeration,
      totalReflectionCount: countTotalReflectionPaths(localPaths),
      entryReflectance: entryReflectanceAt(localRay, solid, material),
      trappedCount: localPaths.filter((path) => path.termination === 'bounceLimit').length,
      pathCount: localPaths.length,
      missed: measured === null,
    };

    overlay.update(info);

    // 断面図（TASKS 6-1）。3D が求めた点をワールド座標のまま渡すだけで、物理は再計算しない。
    // 非表示のときは update が先頭で戻るので、ここのコストはほぼゼロになる
    // 断面図の注記（TASKS 6-1 段階4b）。
    // **弧の幾何は光路と面法線から、ラベルの数値は情報バーと同じ源から。**
    // δ の弧は 660/410nm の参照光路に載せる。誇張中はその誇張後の光路なので、
    // 弧が示す角とラベルの数値は必ず一致し、m=1 では情報バーの 赤/紫 δ と厳密に一致する
    const exitPointOf = (path: LightPath | undefined): Vec3 | null => {
      const last = path?.segments[path.segments.length - 1];

      return path?.termination === 'exited' && last !== undefined ? last.start : null;
    };
    const localExitPoint = exitPointOf(drawnPaths[0]) ?? exitPointOf(drawnPaths[1]);
    const localEntryNormal = entryFaceNormal(localRay, solid);
    const localExitNormal =
      localExitPoint === null ? null : faceNormalAt(localExitPoint, solid);

    // 誇張中の断りは情報バーの分離幅とまったく同じ条件（m ≠ 1）で、同じ `×m` の表記で添える。
    // 弧が示すのは**実際に描かれている**角なので、m > 1 では値も誇張後になる。
    // その事実を隠さないための断りであって、値そのものは弧と厳密に一致したままである
    const exaggerationNote = state.exaggeration === 1 ? '' : ` ×${state.exaggeration}`;

    const deviationOf = (
      index: number,
      deviationDeg: number | null,
      wavelengthNm: number,
      caption: string
    ): SectionAnnotation['red'] => {
      const localPath = drawnPaths[index];

      if (localPath === undefined || localPath.termination !== 'exited' || deviationDeg === null) {
        return null;
      }

      return {
        path: transformLightPath(localPath, localToWorld),
        label: `${caption} ${formatAngle(deviationDeg)}${exaggerationNote}`,
        // ラベルの色も光線と同じ入口から引く（輝度フロアの恩恵をそのまま受ける）
        color: displayColorCss(wavelengthNm),
      };
    };

    const annotation: SectionAnnotation = {
      entryNormal:
        localEntryNormal === null ? null : toWorldDirection(localEntryNormal, localToWorld),
      exitNormal:
        localExitNormal === null ? null : toWorldDirection(localExitNormal, localToWorld),
      incidenceLabel: measured === null ? null : formatAngle(measured),
      red: deviationOf(0, drawnRed, REPORT_RED_NM, 'δ赤'),
      violet: deviationOf(1, drawnViolet, REPORT_VIOLET_NM, 'δ紫'),
    };

    sectionView.update(
      currentDispersionPlane(),
      sectionWorldVertices(),
      sharedPaths,
      annotation
    );

    // 材質・誇張・姿勢のいずれかで変わる。変化した瞬間だけ出す
    const summary =
      `${state.material} / m=${state.exaggeration} / ${summarizeTerminations(localPaths)}`;

    if (summary !== lastTerminationSummary) {
      lastTerminationSummary = summary;
      console.log(
        `[追跡] ${summary}` +
          ` / 扇の広がり = ${spreadDeg(localPaths).toFixed(6)}度` +
          ` / 実測 θ₁ = ${measured === null ? '—' : `${measured.toFixed(6)}度`}`
      );
    }

    onBeamsRefreshed();
  };

  /**
   * 直近に各レンダラへ渡した表示モード（TASKS 4-3・裁定④）。
   *
   * **貼り替えは遷移のときだけ行う。** モード → 波長列は関数なので、モードが同じなら
   * 波長列も同じである。ここを毎 dirty フレームで撃つと、切替と無関係な操作の
   * たびにジオメトリを捨てて作り直すことになる（`SceneManager.applyBox` の
   * 冪等ガードと同じ作法）。
   */
  let appliedSpectrumMode = store.getState().spectrumMode;

  /**
   * 表示モードの遷移を 4 つのレンダラへ反映する。
   *
   * 貼り替えるのは本数に依存するジオメトリだけで、`object` もマテリアルも
   * シーンへの所属も `SceneManager.onResize` の購読も、断面図の DOM と凍結した
   * ビューポートもそのまま残る。だから再追加も再購読も再フィットも要らない。
   *
   * @param mode 新しい表示モード
   */
  const applySpectrumMode = (mode: SpectrumMode): void => {
    if (mode === appliedSpectrumMode) {
      return;
    }

    appliedSpectrumMode = mode;
    wavelengths = wavelengthsForMode(mode);

    beams.setWavelengths(wavelengths);
    reflectionBeams.setWavelengths(wavelengths);
    band.setWavelengths(wavelengths);
    sectionView.setWavelengths(wavelengths);

    markDirty();
  };

  store.subscribe((state) => {
    applySpectrumMode(state.spectrumMode);
  });
  store.subscribe(markDirty);

  // ギズモはプリズムの matrixWorld を直接動かす。姿勢の変化を dirty に流すだけでよい
  const interaction = new InteractionCtl(
    sceneManager.camera,
    sceneManager.domElement,
    sceneManager.scene
  );
  interaction.attachTarget(prism.object);
  interaction.onPoseChange(markDirty);
  interaction.onModeChange((mode) => {
    console.log(`[操作] モード = ${mode}`);
  });
  // 切替は R（回転）/ G（移動）/ Esc（カメラ）
  interaction.setMode('rotate');

  /** 現在の姿勢（Z 軸回転）[deg]。単一の真実である Object3D から読む。 */
  const currentRotationDeg = (): number => prism.object.rotation.z * DEG_PER_RAD;

  /**
   * 姿勢を設定して再計算を予約する。
   *
   * @param angleDeg Z 軸回転角 [deg]
   */
  const applyRotationDeg = (angleDeg: number): void => {
    prism.object.rotation.z = angleDeg * RAD_PER_DEG;
    prism.object.updateMatrixWorld(true);
    markDirty();
  };

  // スライダー → 姿勢。ギズモのヘルパーはプリズムを見ているので自動で追従する
  panel.onRotationInput(applyRotationDeg);

  // ギズモ → スライダー。表示だけ書き換えるので input が再発火せず、エコーにならない
  interaction.onPoseChange(() => {
    panel.setRotationDeg(currentRotationDeg());
  });

  /**
   * 現在の位置（ワールド） [world unit]（TASKS 4-8）。単一の真実である Object3D から読む。
   * `currentRotationDeg` と同じ形——別変数に二重保持しない。
   */
  const currentPositionX = (): number => prism.object.position.x;
  const currentPositionY = (): number => prism.object.position.y;

  /**
   * 現在のカメラ視点（カメラ共有）。単一の真実は `camera.position` と
   * `OrbitControls.target`（`InteractionCtl.cameraTarget()` 経由）——`currentRotationDeg`
   * と同じ形で、別変数に二重保持しない。
   */
  const currentCameraPosition = (): { x: number; y: number; z: number } => ({
    x: sceneManager.camera.position.x,
    y: sceneManager.camera.position.y,
    z: sceneManager.camera.position.z,
  });

  const currentCameraTarget = (): { x: number; y: number; z: number } => {
    const target = interaction.cameraTarget();

    return { x: target.x, y: target.y, z: target.z };
  };

  /**
   * X/Y 位置を設定して再計算を予約する（TASKS 4-8）。
   *
   * `applyRotationDeg` と同じ形。位置は世界座標の並進成分そのもの＝幾何入力なので、
   * グロー/数値表示（4-7）とは逆に `markDirty` を呼ぶのが正しい（光路が実際に動くため）。
   *
   * @param x 新しい X 位置
   */
  const applyPositionX = (x: number): void => {
    prism.object.position.x = x;
    prism.object.updateMatrixWorld(true);
    markDirty();
  };

  /** @param y 新しい Y 位置 */
  const applyPositionY = (y: number): void => {
    prism.object.position.y = y;
    prism.object.updateMatrixWorld(true);
    markDirty();
  };

  // スライダー → 位置
  panel.onPositionXInput(applyPositionX);
  panel.onPositionYInput(applyPositionY);

  // ギズモ（移動モード）→ スライダー。表示だけ書き換えるのでエコーにならない
  interaction.onPoseChange(() => {
    panel.setPositionX(currentPositionX());
    panel.setPositionY(currentPositionY());
  });

  // 「光路に合わせる」。今の光路からアンカーを取り直し、現在の距離で置き直す
  panel.onFocusScreen(() => {
    const anchor = meanExitAnchor(traceWorldPaths(store.getState()));

    if (anchor === null) {
      console.log('[操作] 射出光が無いためスクリーンを合わせられません');

      return;
    }

    screenAnchor = anchor;
    applyScreenPose(store.getState().screenDistance);
    markDirty();
    console.log('[操作] スクリーンを光路に合わせた');
  });

  /** 進行中の遷移。無ければ null。 */
  let transition: AngleTransition | null = null;

  const cancelTransition = (): void => {
    transition = null;
  };

  /**
   * 遷移を 1 フレームぶん進める。レンダーループから毎フレーム呼ぶ。
   *
   * **アニメーションは化粧であり、着地する値を変えない。** 終端では `animateAngle` が
   * 補間を経由せず目標をそのまま返すので、最後に store へ入る値は
   * 段階3 の即時適用とビット同一になる。
   *
   * @param nowMs 現在時刻 [ms]（`performance.now()`）
   */
  const advanceTransition = (nowMs: number): void => {
    if (transition === null) {
      return;
    }

    // 材質が変われば θ₁_min そのものが別の値になる。古い目標へは決して着地させない。
    // ここで弾くので、store へは 1 フレームも古い値が入らない
    if (store.getState().material !== transition.material) {
      cancelTransition();

      return;
    }

    const sample = animateAngle(
      transition.from,
      transition.to,
      MIN_DEVIATION_TRANSITION_MS,
      nowMs - transition.startMs
    );

    if (sample.done) {
      cancelTransition();
    }

    store.update({ sourceAngleDeg: sample.value });
  };

  // 人の操作はアニメーションより優先する。スライダーを掴んだ／プリズムを回した瞬間に取り消す。
  // どれも `input` / ギズモ由来なので、遷移自身が store を書いても発火しない
  // 断面図のトグル。3D の描画には一切触らない（dirty を立てて図だけ描き直す）
  panel.onToggleSection((visible) => {
    sectionView.setVisible(visible);
    markDirty();
    console.log(`[操作] 断面図 = ${visible ? '表示' : '非表示'}`);
  });

  panel.onSourceAngleInput(cancelTransition);
  panel.onRotationInput(cancelTransition);
  interaction.onPoseChange(cancelTransition);

  // 「最小偏角に合わせる」（TASKS 6-2）。**プリズムの姿勢は動かさない** ——
  // 動かすのは光源のスライダーだけで、姿勢の単一の真実（matrixWorld）は読むだけである。
  // 姿勢を動かして合わせると、ユーザーが自分で決めた向きを勝手に捨てることになる
  /**
   * 現在の材質と姿勢で、実測 θ₁ を θ₁_min にするスライダー値を求める。
   *
   * **着地する値を決めるのはここだけ。** 即時適用もアニメーションもこの 1 つの値へ向かう
   * ので、化粧を足しても着地は動かない（段階4 の検証①がこれを跨いで確かめる）。
   *
   * スライダーは「凍結した基準法線から測った角」なので、実測 θ₁ を θ₁_min にするには
   * プリズムを回したぶんだけ足す（案 A の帰結。光源はワールドに固定されている）。
   *
   * @returns スライダーへ入れる角 [deg]。透過しない材質なら null（可動域の判定はしない）
   */
  const minimumDeviationTargetDeg = (): number | null => {
    const minimum = minimumDeviationOf(store.getState().material);

    if (minimum === null) {
      return null;
    }

    prism.object.updateMatrixWorld(true);

    return (
      minimum.incidenceAngleDeg +
      normalizeAngleDeg(currentEntryNormalAngleDeg() - entryNormalAngleDeg)
    );
  };

  panel.onApplyMinimumDeviation(() => {
    const minimum = minimumDeviationOf(store.getState().material);
    const targetAngleDeg = minimumDeviationTargetDeg();

    if (minimum === null || targetAngleDeg === null) {
      // ボタンは disabled なので通常ここへは来ない。判定元が同じなので黙って戻る
      return;
    }

    const turnedDeg = targetAngleDeg - minimum.incidenceAngleDeg;

    if (targetAngleDeg < SOURCE_ANGLE_MIN_DEG || targetAngleDeg > SOURCE_ANGLE_MAX_DEG) {
      // store.update に渡すとクランプされて黙って別の角に着地する。渡す前に弾く
      panel.setSourceAngleNotice(MIN_DEVIATION_OUT_OF_RANGE_NOTICE);
      console.log(
        `[操作] 最小偏角の目標 ${targetAngleDeg.toFixed(6)}度 は可動域外` +
          `（プリズムの回し量 ${turnedDeg.toFixed(6)}度）`
      );

      return;
    }

    // 届いたので、前回「届きません」を出していたなら下ろす
    panel.setSourceAngleNotice(null);

    if (prefersReducedMotion()) {
      // 動きを減らす設定では化粧を省き、段階3 の即時適用そのものに落とす
      cancelTransition();
      store.update({ sourceAngleDeg: targetAngleDeg });
    } else {
      // 押し直しは前の遷移を捨てて今の値から引き直す（重ねがけしない）
      transition = {
        from: store.getState().sourceAngleDeg,
        to: targetAngleDeg,
        startMs: performance.now(),
        material: store.getState().material,
      };
    }

    console.log(
      `[操作] 最小偏角へ → θ₁_min = ${minimum.incidenceAngleDeg.toFixed(9)}度` +
        ` / δ_min = ${minimum.deviationDeg.toFixed(9)}度` +
        ` / スライダー = ${targetAngleDeg.toFixed(9)}度`
    );
  });

  panel.onReset(() => {
    // 姿勢が初期へ戻るので「この姿勢では届きません」は事実でなくなる
    panel.setSourceAngleNotice(null);
    cancelTransition();
    store.reset();
    prism.object.position.set(DEFAULT_PRISM_X, DEFAULT_PRISM_Y, 0);
    prism.object.rotation.set(0, 0, DEFAULT_PRISM_ROTATION_DEG * RAD_PER_DEG);
    prism.object.updateMatrixWorld(true);
    panel.setRotationDeg(currentRotationDeg());
    panel.setPositionX(currentPositionX());
    panel.setPositionY(currentPositionY());
    markDirty();
    console.log(`[操作] リセット → 姿勢 ${currentRotationDeg().toFixed(1)}度`);
  });

  /**
   * 4 つの住処から共有できる状態を 1 つに集める（TASKS 6-6 段階3）。
   *
   * **所有権は動かさない。** 姿勢の単一の真実は `Object3D.matrix` のまま、断面図の
   * 状態は `aria-pressed` のまま、アンカーはこのクロージャのままである。集約は
   * シリアライズの境界でだけ行う（store を源にすると `TransformControls` が
   * ドラッグ中に直書きする quaternion と競合し、3-5b のエコー問題が再発する）。
   *
   * @returns 集めた状態
   */
  const collectShareableState = (): ShareableState => {
    prism.object.updateMatrixWorld(true);

    return {
      app: store.getState(),
      prismRotationDeg: currentRotationDeg(),
      prismX: prism.object.position.x,
      prismY: prism.object.position.y,
      // 全光路が主断面に載るので、アンカーは x・y・方向角の 3 数値で尽きる
      screenAnchor: {
        x: screenAnchor.origin.x,
        y: screenAnchor.origin.y,
        directionDeg:
          Math.atan2(screenAnchor.direction.y, screenAnchor.direction.x) * DEG_PER_RAD,
      },
      sectionVisible: panel.isSectionPressed(),
      glowEnabled: panel.isGlowPressed(),
      numbersVisible: panel.isNumbersPressed(),
      cameraPosition: currentCameraPosition(),
      cameraTarget: currentCameraTarget(),
      // beams/reflectionBeams は常に同じ幅で揃えて配るので、片方（beams）を読めば足りる
      // （`currentRotationDeg` と同じ流儀。別変数に二重保持しない）
      beamWidthPx: beams.lineWidth,
    };
  };

  /**
   * 集めた状態をアプリへ配り直す（TASKS 6-6 段階3）。
   *
   * **必ず既存のユーザー操作経路を通す。** 状態を直接突かず、`store.update` /
   * `applyRotationDeg` / `setScreenAnchor` / 表示専用 setter を呼ぶ。こうしておけば
   * クランプも通知も dirty も、人が操作したときとまったく同じ順に走る。
   *
   * **呼ぶのは初回の凍結と `refreshBeams()` が済んだ後でなければならない。**
   * `aimPoint` と `entryNormalAngleDeg` は既定姿勢（`DEFAULT_PRISM_ROTATION_DEG`）から
   * 起動時に一度だけ凍結される。共有者も同じ角度で凍結してから動かしたので、
   * 受け取り側も凍結を済ませてから動かすのが唯一の忠実な再現になる。凍結前に
   * 姿勢を復元すると較正の基準が変わり、同じ回転角でも実測 θ₁ がずれる。
   *
   * @param state 配り直す状態
   */
  const applyShareableState = (state: ShareableState): void => {
    // 進行中のアニメーションは復元と競合する。人が操作したときと同じ扱いで捨てる
    cancelTransition();
    panel.setSourceAngleNotice(null);

    // 1〜4: store。クランプも通知も既存のまま
    store.update(state.app);

    // 5, 6: 姿勢。スライダーを動かしたときと同じ経路を通し、表示だけ別に合わせる
    //       （`setRotationDeg` は input を発火しないのでエコーにならない）
    applyRotationDeg(state.prismRotationDeg);
    panel.setRotationDeg(currentRotationDeg());
    prism.object.position.set(state.prismX, state.prismY, 0);
    prism.object.updateMatrixWorld(true);
    panel.setPositionX(currentPositionX());
    panel.setPositionY(currentPositionY());
    markDirty();

    // 7: 凍結アンカー。**再導出しない。** null は「URL が指定していない」なので、
    //    起動時に導出したものをそのまま残す
    const anchor = state.screenAnchor;

    if (anchor !== null) {
      const directionRad = anchor.directionDeg * RAD_PER_DEG;

      setScreenAnchor({
        origin: vec3(anchor.x, anchor.y, 0),
        direction: vec3(Math.cos(directionRad), Math.sin(directionRad), 0),
      });
    }

    // 8: 断面図。表示専用 setter で属性を合わせ、実体の表示も合わせる
    panel.setSectionPressed(state.sectionVisible);
    sectionView.setVisible(state.sectionVisible);
    markDirty();

    // 9, 10: グロー・数値表示（TASKS 4-7）。表示専用 setter + 実体の反映のみ。
    // **sec と違い、ここでは markDirty を呼ばない。** どちらも光路の計算に無関係なので、
    // このためだけに再計算を誘発しない（4-7 裁定②のガード）。復元は起動時／hashchange
    // でしか起きないので、直前の断面図の markDirty につられて結果的に 1 回だけ
    // 再計算が走ることはあるが、それは sec 側の既存 debt であり、ここが新たに増やす分ではない
    panel.setGlowPressed(state.glowEnabled);
    sceneManager.setGlowEnabled(state.glowEnabled);
    panel.setNumbersPressed(state.numbersVisible);
    overlay.setVisible(state.numbersVisible);

    // 11: カメラ視点（カメラ共有）。表示専用・独立ブロック——グロー/数値表示と同じ理由で
    // markDirty は呼ばない（視点は光路計算に無関係）。freeze/refreshBeams/姿勢の復元とは
    // 接点が無いので、どこに置いても良い独立ブロックである（偵察で確認済み）
    interaction.setCameraView(state.cameraPosition, state.cameraTarget);

    // 12: ビーム幅（TASKS 4-5）。グロー/数値表示と同じ理由で markDirty は呼ばない
    // （traceSpectrum の入力にならない表示専用値。4-5 裁定）
    panel.setBeamWidth(state.beamWidthPx);
    beams.setLineWidth(state.beamWidthPx);
    reflectionBeams.setLineWidth(state.beamWidthPx);
  };

  /** URL を書き換えるのを待っているタイマー。待機中でなければ undefined。 */
  let urlUpdateTimer: number | undefined;

  /** `replaceState` を撃った回数。**検証用**（1 操作で何回書いたかを外から数える）。 */
  let urlWriteCount = 0;

  /**
   * いま集めた状態を URL へ映す。
   *
   * `pushState` ではなく `replaceState` を使う。スライダーを 1 目盛り動かすたびに
   * 履歴が積もると、戻るボタンが「前のページ」ではなく「1 つ前のスライダー位置」へ
   * 戻るようになり、履歴が使い物にならなくなる。
   */
  const writeUrlNow = (): void => {
    if (urlUpdateTimer !== undefined) {
      window.clearTimeout(urlUpdateTimer);
      urlUpdateTimer = undefined;
    }

    const next = `${location.pathname}${location.search}#${encodeUrl(collectShareableState())}`;

    if (next === `${location.pathname}${location.search}${location.hash}`) {
      return;
    }

    history.replaceState(null, '', next);
    urlWriteCount += 1;
  };

  /** 状態が落ち着いてから URL を 1 回だけ書く。 */
  const scheduleUrlUpdate = (): void => {
    if (urlUpdateTimer !== undefined) {
      window.clearTimeout(urlUpdateTimer);
    }

    urlUpdateTimer = window.setTimeout(() => {
      urlUpdateTimer = undefined;
      writeUrlNow();
    }, URL_UPDATE_DEBOUNCE_MS);
  };

  // 状態が変わったフレームでだけ予約する。dirty の源（store・姿勢・トグル・アンカー）が
  // すべて refreshBeams を通るので、ここ 1 か所で全部の変化を拾える。
  // **例外は次のグロー・数値表示（TASKS 4-7）。** どちらも表示専用で光路の計算に
  // 無関係なので、refreshBeams を経由させない（裁定②）。その代わり、それぞれの
  // 購読者から scheduleUrlUpdate を直接呼ぶ
  onBeamsRefreshed = scheduleUrlUpdate;

  panel.onToggleGlow((enabled) => {
    sceneManager.setGlowEnabled(enabled);
    scheduleUrlUpdate();
    console.log(`[操作] グロー = ${enabled ? 'ON' : 'OFF'}`);
  });

  panel.onToggleNumbers((visible) => {
    overlay.setVisible(visible);
    scheduleUrlUpdate();
    console.log(`[操作] 数値表示 = ${visible ? 'ON' : 'OFF'}`);
  });

  // ビーム幅（TASKS 4-5）。グロー/数値表示と同じ表示専用の独立経路——
  // markDirty は呼ばず、scheduleUrlUpdate へ直行する（4-5 裁定）
  panel.onBeamWidthInput((widthPx) => {
    beams.setLineWidth(widthPx);
    reflectionBeams.setLineWidth(widthPx);
    scheduleUrlUpdate();
    console.log(`[操作] ビーム幅 = ${widthPx}px`);
  });

  // カメラのドラッグ → URL（カメラ共有）。表示専用で光路計算に無関係なので markDirty は
  // 呼ばない（グロー/数値表示=4-7と同じガード。位置スライダー=4-8とは逆）。
  // ドラッグ中は 'change' が毎フレーム飛ぶが、scheduleUrlUpdate の 300ms 静穏デバウンスに
  // 乗せるので書き込みは 1 回に畳まれる（姿勢の replaceState と同じ仕組み）
  interaction.onCameraChange(() => {
    cameraChangeRunCount += 1;
    scheduleUrlUpdate();
  });

  panel.onCopyShareUrl(() => {
    // **「今見ているものを、そのままコピー」を保証する。** `location.href` をそのまま読むと、
    // 静穏時間が明ける前に押されたときアドレスバーはまだ古く、300ms 前の絵を配ってしまう。
    // ここで保留を flush（`writeUrlNow` が clearTimeout してから collect し直す）ことで、
    // 次行の `location.href` は必ず押下時点の状態になる
    writeUrlNow();

    navigator.clipboard.writeText(location.href).then(
      () => {
        panel.setShareStatus('URL をコピーしました。');
      },
      () => {
        panel.setShareStatus('コピーできませんでした。アドレスバーから手動でコピーしてください。');
      }
    );
  });

  /**
   * 画面に見えているとおりの PNG を作る（TASKS 6-6 段階5, PNG-1 + PNG-2）。
   *
   * **先頭の `captureDataUrl()` までに await を挟まない。** async 関数の本体は
   * 最初の await までクリックと同じ同期タスクで走るので、3D はそこで撮り切れる。
   * 描画バッファはブラウザが canvas を合成した時点で破棄されるため、
   * 順序を入れ替えると空の画像になる。
   *
   * 撮り終えた文字列はもう描画バッファに依存しないので、そこから先の
   * SVG のラスタ化は非同期でよい。断面図が消えていれば合成自体を行わず、
   * 撮った文字列がそのまま出る（PNG-1 とビット同一）。
   *
   * @returns 書き出す data URL とファイル名
   */
  const buildCapturePng = async (): Promise<{ dataUrl: string; fileName: string }> => {
    const snapshotDataUrl = sceneManager.captureDataUrl();
    const state = store.getState();
    const fileName = captureFileName({
      material: state.material,
      sourceAngleDeg: state.sourceAngleDeg,
    });

    const dataUrl = await composeCapturePng({
      snapshotDataUrl,
      canvas: sceneManager.domElement,
      // ライブの要素を渡すが、合成側が複製してから触る（画面の図は変わらない）
      inset: sectionView.isVisible() ? sectionView.element : null,
    });

    return { dataUrl, fileName };
  };

  panel.onSavePng(() => {
    void buildCapturePng().then(
      ({ dataUrl, fileName }) => {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = fileName;
        // Firefox は文書に繋がっていない要素の click を無視する。付けて押して外す
        document.body.appendChild(link);
        link.click();
        link.remove();

        panel.setShareStatus(`${fileName} を保存しました。`);
      },
      () => {
        panel.setShareStatus('画像を書き出せませんでした。');
      }
    );
  });

  panel.setRotationDeg(currentRotationDeg());
  panel.setPositionX(currentPositionX());
  panel.setPositionY(currentPositionY());

  // ★ここまでが初期化。`aimPoint` / `entryNormalAngleDeg` は既定姿勢で凍結済みで、
  //   最初の光路もこの後の refreshBeams() で引かれる。
  //   **共有 URL の復元はこの行より後**でなければならない（凍結の基準が共有者とずれる）。
  refreshBeams();

  // 共有 URL からの復元（TASKS 6-6 段階4）。壊れた断片でも decodeUrl は投げないので、
  // 何が入っていてもここで起動が止まることはない
  applyShareableState(decodeUrl(location.hash));

  // 復元後の状態を URL へ映す。以後は状態が変わるたびに静穏時間つきで追従する
  scheduleUrlUpdate();

  // 同じタブで hash だけ差し替えられたときも復元する。
  // **同一ドキュメント内の hash 変更はリロードを起こさない**ので、これが無いと
  // 「アドレスバーに共有 URL を貼って Enter」が何も起こさないように見える。
  // 自分の `replaceState` は hashchange を発火しないので、書き戻しの輪にはならない
  window.addEventListener('hashchange', () => {
    applyShareableState(decodeUrl(location.hash));
  });

  // 起動時の検証。既定姿勢では実測 θ₁ とスライダー値が一致するはず（較正の正しさ）
  reportCalibration(store.getState().sourceAngleDeg, aimPoint, entryNormalAngleDeg, worldToLocal, solid);
  reportSpectrum(
    transformRay(
      createIncidentRay(
        aimPoint,
        sourceAngleToWorldDeg(store.getState().sourceAngleDeg, entryNormalAngleDeg),
        APPROACH_DISTANCE
      ),
      worldToLocal
    ),
    solid,
    store.getState().exaggeration
  );

  // 開発時のみの診断フック。ビルド時は import.meta.env.DEV が false になり、この塊ごと落ちる
  if (import.meta.env.DEV) {
    (window as unknown as { __debug: unknown }).__debug = {
      camera: sceneManager.camera,
      screen: screen.object,
      screenPlane: screen.plane,
      band: band.object,
      beams: beams.object,
      reflectionBeams: reflectionBeams.object,
      // モード切替で貼り替わるので値の写しではなくゲッターにする（TASKS 4-3）
      get wavelengths(): readonly number[] {
        return wavelengths;
      },
      spectrumMode: (): SpectrumMode => store.getState().spectrumMode,
      setSpectrumMode: (mode: SpectrumMode): void => {
        store.update({ spectrumMode: mode });
      },
      memoryInfo: (): { geometries: number; textures: number; programs: number } =>
        sceneManager.memoryInfo,
      // 4-3 段階2b の検証用。3 系統が同じ本数へ貼り替わったことを外から数える
      rendererCounts: (): { beam: number; reflection: number; band: number; section: number } => ({
        beam: beams.pathCount,
        reflection: reflectionBeams.pathCount,
        band: band.quadCount,
        section: sectionView.rayLineCount(),
      }),
      // オラクル①-a 用。描画バッファとは独立に traceSpectrum を回して強度を取り直せる
      tracePaths: (): readonly LightPath[] => traceWorldPaths(store.getState()),
      // 6-2 段階4 の検証用。着地の値と、遷移が生きているかを外から読む
      sourceAngleDeg: (): number => store.getState().sourceAngleDeg,
      minimumDeviationTargetDeg,
      transitionActive: (): boolean => transition !== null,
      // 6-1 段階3b の検証用。SVG の実際の頂点列と、断面座標をそのまま読む
      sectionView: sectionView.element,
      sectionVisible: (): boolean => sectionView.isVisible(),
      sectionConsumedPaths: (): readonly LightPath[] => sectionView.consumedPaths(),
      sectionTransform: () => sectionView.viewportTransform(),
      beamsDrawnPaths: (): readonly LightPath[] => lastBeamPaths,
      // 6-6 段階3 の検証用。実配線（hash 読み・replaceState）は段階4
      collectShareableState,
      applyShareableState,
      // 6-6 段階4 の検証用。1 操作で replaceState を何回撃ったかを数える
      urlWriteCount: (): number => urlWriteCount,
      writeUrlNow,
      // 6-6 段階5 の検証用。同一同期タスクでの書き出しと、撃った描画回数
      capturePng: (): string => sceneManager.captureDataUrl(),
      // PNG-2 の検証用。保存ボタンが通るのとまったく同じ経路（合成込み）
      capturePngComposed: (): Promise<string> =>
        buildCapturePng().then(({ dataUrl }) => dataUrl),
      renderCount: (): number => sceneManager.renderCount,
      resizeCount: (): number => sceneManager.resizeCount,
      // TASKS 4-7 の検証用。グロー/数値表示トグルが refreshBeams を誘発しないことを数える
      refreshBeamsRunCount: (): number => refreshBeamsRunCount,
      cameraChangeRunCount: (): number => cameraChangeRunCount,
      glowEnabled: (): boolean => sceneManager.glowEnabled,
      numbersVisible: (): boolean => panel.isNumbersPressed(),
      // カメラ共有の検証用。position は既存の camera（Object3D）からそのまま読める
      cameraTarget: (): Vector3 => interaction.cameraTarget(),
      // 精度実測用。URL往復を介さず直接視点を設定できるので、丸め誤差だけを
      // タイミングのズレ（慣性の残り）と混同せずに切り分けられる
      setCameraView: (
        position: { x: number; y: number; z: number },
        target: { x: number; y: number; z: number }
      ): void => interaction.setCameraView(position, target),
      canvas: sceneManager.domElement,
      sectionUv: (): readonly { u: number; v: number }[] => {
        const plane = currentDispersionPlane();

        return sectionLocalVertices.map((vertex) =>
          worldToDispersionUV(plane, toWorldPoint(vertex, localToWorld))
        );
      },
      prism: prism.object,
      floor: floor.object,
      scene: sceneManager.scene,
      renderOrder: {
        floor: floor.object.renderOrder,
        screenPanel: screen.object.renderOrder,
        screenBand: band.object.renderOrder,
        prism: prism.object.renderOrder,
        beams: beams.object.renderOrder,
      },
    };
  }

  sceneManager.start((deltaSeconds) => {
    interaction.update(deltaSeconds);
    // 遷移は refreshBeams の前に進める。同じフレームのうちに store が更新され、
    // その値で光路が引き直される（スライダーを掴んで動かしたときと同じ経路）
    advanceTransition(performance.now());
    refreshBeams();
  });
}

main();
