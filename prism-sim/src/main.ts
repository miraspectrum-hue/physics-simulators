import { AmbientLight, DirectionalLight, Matrix4, Vector3 } from 'three';

import { BK7, CONTINUOUS_SAMPLE_COUNT, MATERIALS } from './optics/constants';
import { createTriangularPrism, intersectRayConvexSolid } from './optics/convexSolid';
import { sampleWavelengths, wavelengthToRgb } from './optics/spectrum';
import { incidenceAngleDeg, traceSpectrum } from './optics/tracer';
import { dot, negate, normalize, sub, vec3 } from './optics/vec3';
import BeamRenderer from './scene/BeamRenderer';
import InteractionCtl from './scene/InteractionCtl';
import {
  createIncidentRay,
  faceNormalAngleDeg,
  sourceAngleToWorldDeg,
} from './scene/lightSource';
import PrismObject, { PRISM_DEPTH, PRISM_SIDE_LENGTH } from './scene/PrismObject';
import { transformLightPath, transformRay } from './scene/rayTransform';
import SceneManager from './scene/SceneManager';
import type { ConvexSolid, LightPath, Ray, Vec3 } from './types/optics';
import ControlPanel from './ui/ControlPanel';
import { createStore } from './ui/store';

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

/**
 * 意図した既定姿勢：プリズムの Z 軸まわりの回転角 [deg]。
 *
 * リセット（3-7）の戻り先であり、光源の狙点と入射角の較正もこの姿勢を基準に凍結する。
 * 以後プリズムを回してもこの値は動かない（姿勢の現在値は matrixWorld が持つ）。
 */
const PRISM_ROTATION_Z_DEG = 20;

/** 入射面（左側面）の平面集合における添字。 */
const ENTRY_PLANE_INDEX = 0;

/** 狙点までの助走距離。 */
const APPROACH_DISTANCE = 3;

const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;

/** 起動時の座標変換に使う作業用インスタンス。毎フレームの経路では使わない。 */
const workVector = new Vector3();

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

  const sceneManager = new SceneManager(container);

  const prism = new PrismObject();
  prism.object.rotation.z = PRISM_ROTATION_Z_DEG * RAD_PER_DEG;
  prism.object.updateMatrixWorld(true);
  sceneManager.scene.add(prism.object);

  sceneManager.scene.add(new AmbientLight(0xffffff, 1.2));
  const keyLight = new DirectionalLight(0xffffff, 2);
  keyLight.position.set(3, 4, 5);
  sceneManager.scene.add(keyLight);

  // 姿勢の単一の真実は matrixWorld。平面集合は標準配置のまま固定し、レイの方を変換する
  const localToWorld = prism.object.matrixWorld;
  const worldToLocal = new Matrix4().copy(localToWorld).invert();

  const solid = createTriangularPrism(PRISM_SIDE_LENGTH, PRISM_DEPTH);
  const wavelengths = sampleWavelengths(CONTINUOUS_SAMPLE_COUNT);

  // 光源はプリズムから独立してワールドに存在する。狙点と入射角の基準は「意図した既定姿勢」から
  // 起動時に一度だけ導出して凍結する。以後プリズムを動かしても、この 2 つは追従しない
  // （追従させると、プリズムを動かしてもビームが外れなくなり 3-8 が成立しない）
  const aimPoint = toWorldPoint(LEFT_FACE_MIDPOINT, localToWorld);
  const entryPlane = solid[ENTRY_PLANE_INDEX];
  const entryNormalAngleDeg =
    entryPlane === undefined
      ? 0
      : faceNormalAngleDeg(toWorldDirection(negate(entryPlane.normal), localToWorld));

  const store = createStore();
  const panel = new ControlPanel(document.body, store);

  // 色は波長ごとに一定なので、ここで一度だけ決まる
  const beams = new BeamRenderer(wavelengths);
  sceneManager.scene.add(beams.object);
  sceneManager.onResize((width, height) => {
    beams.setResolution(width, height);
  });

  // 光路の再計算は姿勢や入射角が変わったフレームだけ行う（CLAUDE.md「Three.js 運用」）
  let dirty = true;

  const markDirty = (): void => {
    dirty = true;
  };

  /** 直前に出力した termination の内訳。変化した時だけログを出すために持つ。 */
  let lastTerminationSummary = '';

  const refreshBeams = (): void => {
    if (!dirty) {
      return;
    }
    dirty = false;

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
    const localPaths = traceSpectrum(localRay, solid, material, wavelengths, state.exaggeration);

    // 更新はバッファの書き換えのみ。ジオメトリも属性も作り直さない
    beams.update(localPaths.map((path) => transformLightPath(path, localToWorld)));

    // スライダーは既定姿勢での入射角。プリズムを回すとここが乖離する（案 A の肝）
    panel.setMeasuredIncidenceDeg(measuredIncidenceDeg(localRay, solid));

    // 材質・誇張・姿勢のいずれかで変わる。変化した瞬間だけ出す
    const summary =
      `${state.material} / m=${state.exaggeration} / ${summarizeTerminations(localPaths)}`;

    if (summary !== lastTerminationSummary) {
      lastTerminationSummary = summary;
      const measured = measuredIncidenceDeg(localRay, solid);
      console.log(
        `[追跡] ${summary}` +
          ` / 扇の広がり = ${spreadDeg(localPaths).toFixed(6)}度` +
          ` / 実測 θ₁ = ${measured === null ? '—' : `${measured.toFixed(6)}度`}`
      );
    }
  };

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

  panel.onReset(() => {
    store.reset();
    prism.object.position.set(0, 0, 0);
    prism.object.rotation.set(0, 0, PRISM_ROTATION_Z_DEG * RAD_PER_DEG);
    prism.object.updateMatrixWorld(true);
    panel.setRotationDeg(currentRotationDeg());
    markDirty();
    console.log(`[操作] リセット → 姿勢 ${currentRotationDeg().toFixed(1)}度`);
  });

  panel.setRotationDeg(currentRotationDeg());
  refreshBeams();

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

  sceneManager.start((deltaSeconds) => {
    interaction.update(deltaSeconds);
    refreshBeams();
  });
}

main();
