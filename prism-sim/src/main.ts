import { AmbientLight, DirectionalLight } from 'three';

import { BK7, LINE_D_NM } from './optics/constants';
import { createTriangularPrism, ray } from './optics/convexSolid';
import { traceRay } from './optics/tracer';
import { addScaled, dot, normalize, sub, vec3 } from './optics/vec3';
import BeamRenderer from './scene/BeamRenderer';
import PrismObject, { PRISM_DEPTH, PRISM_SIDE_LENGTH } from './scene/PrismObject';
import SceneManager from './scene/SceneManager';
import type { LightPath, Ray, Vec3 } from './types/optics';

import './styles/main.css';

/**
 * walking skeleton（S-2）の配線。
 *
 * プリズムの姿勢は恒等（回転・平行移動なし）なので world 座標と local 座標が一致する。
 * したがって world⇔local のレイ変換は通していない。変換は S-4 で単独に投入する。
 */

/** 左側面の中点。tracer のテストが入射点として使う実績値。 */
const LEFT_FACE_MIDPOINT: Vec3 = vec3(-0.5, 0.288675134594813, 0);

/** 入射角 [deg]。BK7 が対称通過（最小偏角）となる角度。 */
const INCIDENCE_ANGLE_DEG = 49.323347736;

/** 入射点までの助走距離。 */
const APPROACH_DISTANCE = 3;

/** 左側面の内向き法線が +x から倒れている角度 [deg]。 */
const LEFT_FACE_NORMAL_TILT_DEG = -30;

const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;

/**
 * 左側面の中点へ、面法線から指定の入射角だけ倒した向きで入射するレイを作る。
 *
 * @param incidenceAngleDeg 入射角 [deg]
 * @returns 入射レイ（プリズムが恒等姿勢なので world = local）
 */
function createIncidentRay(incidenceAngleDeg: number): Ray {
  const directionRad = (incidenceAngleDeg + LEFT_FACE_NORMAL_TILT_DEG) * RAD_PER_DEG;
  const direction = vec3(Math.cos(directionRad), Math.sin(directionRad), 0);

  return ray(addScaled(LEFT_FACE_MIDPOINT, direction, -APPROACH_DISTANCE), direction);
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

/** 追跡結果を既知オラクルと照合できる形でコンソールへ出す（S-2 の主たる検証手段）。 */
function reportLightPath(path: LightPath): void {
  const format = (v: Vec3): string =>
    `(${v.x.toFixed(9)}, ${v.y.toFixed(9)}, ${v.z.toFixed(9)})`;

  console.log('=== S-2 光路の数値（恒等姿勢・world = local）===');
  console.log(`波長 = ${path.wavelengthNm} nm / 屈折率 = ${path.refractiveIndex}`);
  console.log(`termination = ${path.termination} / 区間数 = ${path.segments.length}`);

  path.segments.forEach((segment, index) => {
    const label = segment.insidePrism ? '内部' : '外部';
    console.log(`  [${index}] ${label} ${format(segment.start)} -> ${format(segment.end)}`);
  });

  console.log(`偏角 = ${deviationDeg(path).toFixed(9)} 度`);
}

function main(): void {
  const container = document.querySelector<HTMLDivElement>('#app');

  if (container === null) {
    throw new Error('#app が見つかりません');
  }

  const sceneManager = new SceneManager(container);

  const prism = new PrismObject();
  sceneManager.scene.add(prism.object);

  sceneManager.scene.add(new AmbientLight(0xffffff, 1.2));
  const keyLight = new DirectionalLight(0xffffff, 2);
  keyLight.position.set(3, 4, 5);
  sceneManager.scene.add(keyLight);

  // プリズムは恒等姿勢なので、world のレイをそのまま local として追跡できる
  const solid = createTriangularPrism(PRISM_SIDE_LENGTH, PRISM_DEPTH);
  const incidentRay = createIncidentRay(INCIDENCE_ANGLE_DEG);
  const path = traceRay(incidentRay, solid, BK7.catalogNd, LINE_D_NM);

  reportLightPath(path);

  const beams = new BeamRenderer();
  beams.update([path]);
  sceneManager.scene.add(beams.object);

  sceneManager.start();
}

main();
