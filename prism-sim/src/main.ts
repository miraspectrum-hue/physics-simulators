import { AmbientLight, DirectionalLight, Matrix4 } from 'three';

import { BK7, CONTINUOUS_SAMPLE_COUNT, LINE_D_NM } from './optics/constants';
import { createTriangularPrism, ray } from './optics/convexSolid';
import { sampleWavelengths, wavelengthToRgb } from './optics/spectrum';
import { traceRay, traceSpectrum } from './optics/tracer';
import { addScaled, dot, length, normalize, sub, vec3 } from './optics/vec3';
import BeamRenderer from './scene/BeamRenderer';
import PrismObject, { PRISM_DEPTH, PRISM_SIDE_LENGTH } from './scene/PrismObject';
import { transformLightPath, transformRay } from './scene/rayTransform';
import SceneManager from './scene/SceneManager';
import type { ConvexSolid, LightPath, Ray, Vec3 } from './types/optics';

import './styles/main.css';

/**
 * walking skeleton（S-2）の配線。
 *
 * プリズムを Z 軸まわりに回転させ、world⇔local のレイ変換を通す（S-4）。
 * 光源は world 空間で同じ角度だけ回すので、local 空間の光路は S-2 / S-3 と一致するはずである。
 * これにより「物理は回転に不変」「変換だけが姿勢を担う」ことを数値で確かめられる。
 */

/** 左側面の中点（局所座標）。tracer のテストが入射点として使う実績値。 */
const LEFT_FACE_MIDPOINT: Vec3 = vec3(-0.5, 0.288675134594813, 0);

/** 入射角 [deg]。BK7 が対称通過（最小偏角）となる角度。 */
const INCIDENCE_ANGLE_DEG = 49.323347736;

/** プリズムの Z 軸まわりの回転角 [deg]。変換が効いていることを確かめるための固定値。 */
const PRISM_ROTATION_Z_DEG = 20;

/** 入射点までの助走距離。 */
const APPROACH_DISTANCE = 3;

/** 左側面の内向き法線が +x から倒れている角度 [deg]。 */
const LEFT_FACE_NORMAL_TILT_DEG = -30;

const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;

/**
 * 左側面の中点へ、面法線から指定の入射角だけ倒した向きで入射するレイを作る（局所座標）。
 *
 * @param incidenceAngleDeg 入射角 [deg]
 * @returns 局所座標の入射レイ
 */
function createLocalIncidentRay(incidenceAngleDeg: number): Ray {
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

/**
 * 分光の結果を既知オラクルと照合できる形でコンソールへ出す（S-3 の主たる検証手段）。
 *
 * @param incidentRay 入射レイ
 * @param solid プリズムの平面集合
 */
function reportSpectrum(incidentRay: Ray, solid: ConvexSolid): void {
  const format = (v: Vec3): string =>
    `(${v.x.toFixed(9)}, ${v.y.toFixed(9)}, ${v.z.toFixed(9)})`;

  // 代表 3 波長。spectrum / tracer のテストが持つ確定値と直接照合できる
  console.log('=== 代表波長の偏角（局所空間）===');
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

  // 実際に描画する連続スペクトル
  const paths = traceSpectrum(incidentRay, solid, BK7, sampleWavelengths(CONTINUOUS_SAMPLE_COUNT));
  const first = paths[0];
  const last = paths[paths.length - 1];

  console.log(`=== 連続スペクトル（${paths.length} 波長）===`);
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
 * 局所空間の光路と、ワールドへ戻した光路を突き合わせて出す（S-4 の主たる検証手段）。
 *
 * @param localPaths 局所空間の光路
 * @param worldPaths ワールドへ移した光路
 * @param localToWorld 局所 → ワールドの変換行列
 */
function reportTransform(
  localPath: LightPath,
  worldPath: LightPath,
  localToWorld: Matrix4
): void {
  const format = (v: Vec3): string =>
    `(${v.x.toFixed(9)}, ${v.y.toFixed(9)}, ${v.z.toFixed(9)})`;

  console.log(`=== S-4 変換の検証（プリズム rotation.z = ${PRISM_ROTATION_Z_DEG}°）===`);
  console.log(
    `  検証に使う波長 = ${localPath.wavelengthNm} nm / 屈折率 = ${localPath.refractiveIndex}` +
      '（S-2 と同一条件）'
  );

  const localEntry = localPath.segments[0]?.end ?? vec3(0, 0, 0);
  const worldEntry = worldPath.segments[0]?.end ?? vec3(0, 0, 0);

  // R_z(20°)·(-0.5, 0.288675134594813, 0) を独立に計算した期待値
  const rotationRad = PRISM_ROTATION_Z_DEG * RAD_PER_DEG;
  const expectedWorldEntry = vec3(
    LEFT_FACE_MIDPOINT.x * Math.cos(rotationRad) - LEFT_FACE_MIDPOINT.y * Math.sin(rotationRad),
    LEFT_FACE_MIDPOINT.x * Math.sin(rotationRad) + LEFT_FACE_MIDPOINT.y * Math.cos(rotationRad),
    0
  );

  console.log(`  local 入射点 ${format(localEntry)}（S-2 と同一なら回転不変）`);
  console.log(`  world 入射点 ${format(worldEntry)}`);
  console.log(`  期待値 R_z(20°)·局所入射点 ${format(expectedWorldEntry)}`);
  console.log(`  差 = ${length(sub(worldEntry, expectedWorldEntry)).toExponential(3)}`);
  console.log(`  local 偏角 = ${deviationDeg(localPath).toFixed(9)} 度（S-2 の 38.646695472 と一致するか）`);
  console.log(`  world 偏角 = ${deviationDeg(worldPath).toFixed(9)} 度（回転で偏角は変わらない）`);

  // 往復が恒等であることを実データで確認する
  const worldToLocal = new Matrix4().copy(localToWorld).invert();
  const roundTrip = transformLightPath(worldPath, worldToLocal);
  const roundTripEntry = roundTrip.segments[0]?.end ?? vec3(0, 0, 0);
  console.log(`  往復後の入射点 ${format(roundTripEntry)}`);
  console.log(`  往復誤差 = ${length(sub(roundTripEntry, localEntry)).toExponential(3)}`);
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

  // 光源も world 空間で同じだけ回すので、局所空間では S-2 / S-3 と同一のレイになる
  const localReferenceRay = createLocalIncidentRay(INCIDENCE_ANGLE_DEG);
  const worldIncidentRay = transformRay(localReferenceRay, localToWorld);
  const localIncidentRay = transformRay(worldIncidentRay, worldToLocal);

  const localPaths = traceSpectrum(
    localIncidentRay,
    solid,
    BK7,
    sampleWavelengths(CONTINUOUS_SAMPLE_COUNT)
  );
  const worldPaths = localPaths.map((path) => transformLightPath(path, localToWorld));

  // 変換の検証には d 線を使う。屈折率は S-2 と同じカタログ値 n_d を直接渡し、
  // 偏角 38.646695472 度と厳密に突き合わせられるようにする
  // （描画側の 48 波長は Cauchy 式の n(λ) を使う。n_d と n(587.56) は 3.4e-5 ずれ、
  //   偏角にすると 0.003 度の差になるため、条件を揃えないと照合にならない）
  const localDLinePath = traceRay(localIncidentRay, solid, BK7.catalogNd, LINE_D_NM);

  reportSpectrum(localIncidentRay, solid);
  reportTransform(
    localDLinePath,
    transformLightPath(localDLinePath, localToWorld),
    localToWorld
  );

  const beams = new BeamRenderer();
  beams.update(worldPaths);
  sceneManager.scene.add(beams.object);

  sceneManager.start();
}

main();
