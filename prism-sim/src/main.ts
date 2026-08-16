import { AmbientLight, DirectionalLight, Matrix4 } from 'three';

import { BK7, CONTINUOUS_SAMPLE_COUNT } from './optics/constants';
import { createTriangularPrism, ray } from './optics/convexSolid';
import { sampleWavelengths, wavelengthToRgb } from './optics/spectrum';
import { traceSpectrum } from './optics/tracer';
import { addScaled, dot, normalize, sub, vec3 } from './optics/vec3';
import BeamRenderer from './scene/BeamRenderer';
import PrismObject, { PRISM_DEPTH, PRISM_SIDE_LENGTH } from './scene/PrismObject';
import { transformLightPath, transformRay } from './scene/rayTransform';
import SceneManager from './scene/SceneManager';
import type { ConvexSolid, LightPath, Ray, Vec3 } from './types/optics';

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

/** 入射角 [deg]。BK7 が対称通過（最小偏角）となる角度。 */
const INCIDENCE_ANGLE_DEG = 49.323347736;

/** プリズムの Z 軸まわりの回転角 [deg]。変換が効いていることを確かめるための固定値。 */
const PRISM_ROTATION_Z_DEG = 20;

/**
 * 描画に用いる分散誇張倍率 m（1-2-1b / F-23）。
 *
 * BK7 の実分散は約 1.36° と狭く、m=1 では既定カメラで七色が白く飽和して見えないため、
 * 既定表示は誇張する（"Dark Side らしさ" 優先の方針）。m=1 に戻せば実物理になる。
 *
 * 値は実機の絵を見て 6 に決めた。扇の広がりは 1.92° → 12.29°。m=8 以上にすると更に広がるが、
 * 48 サンプルが個別の線に分離して縞に見え始め、連続スペクトルとしての見えを損なう
 * （偏角が λ に対し非線形なので、紫側ほど間隔が開く）。
 *
 * TODO(4-4): この固定値は暫定。UI スライダー（×1〜×10）で可変にする。
 */
const DISPERSION_EXAGGERATION = 6;

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

  // 光源も world 空間で同じだけ回すので、局所空間では S-2 / S-3 と同一のレイになる
  const localReferenceRay = createLocalIncidentRay(INCIDENCE_ANGLE_DEG);
  // 光源はワールドに固定する。プリズムを回すと局所空間での入射角が変わる
  const worldIncidentRay = transformRay(localReferenceRay, localToWorld);
  const localIncidentRay = transformRay(worldIncidentRay, worldToLocal);

  // 色は波長ごとに一定なので、ここで一度だけ決まる
  const beams = new BeamRenderer(wavelengths);
  sceneManager.scene.add(beams.object);
  sceneManager.onResize((width, height) => {
    beams.setResolution(width, height);
  });

  // 光路の再計算は姿勢や入射角が変わったフレームだけ行う（CLAUDE.md「Three.js 運用」）
  let dirty = true;

  const refreshBeams = (): void => {
    if (!dirty) {
      return;
    }
    dirty = false;

    prism.object.updateMatrixWorld(true);
    worldToLocal.copy(localToWorld).invert();

    const localRay = transformRay(worldIncidentRay, worldToLocal);
    const localPaths = traceSpectrum(localRay, solid, BK7, wavelengths, DISPERSION_EXAGGERATION);

    // 更新はバッファの書き換えのみ。ジオメトリも属性も作り直さない
    beams.update(localPaths.map((path) => transformLightPath(path, localToWorld)));
  };

  refreshBeams();

  reportSpectrum(localIncidentRay, solid, DISPERSION_EXAGGERATION);

  sceneManager.start(refreshBeams);
}

main();
