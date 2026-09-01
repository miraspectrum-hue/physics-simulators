/**
 * 頂角 A のプリズムのスカラー計算（偏角・最小偏角・透過条件）。
 *
 * 空気中に置かれたプリズムを、主断面内の 2 次元問題として扱う。
 * DOM / Three.js / convexSolid（3D 幾何）/ dispersion には依存しない。
 * 屈折率は引数で受け取る（波長依存性は呼び出し側の責務）。
 */

import type { MinimumDeviation } from '../types/optics';

import { criticalAngle } from './fresnel';
import { refractionAngleDeg } from './refraction';

const DEG_PER_RAD = 180 / Math.PI;
const RAD_PER_DEG = Math.PI / 180;

/** 空気（周囲媒質）の屈折率。 */
const N_AIR = 1;

/** 頂角の定義域 [deg]。両端は退化するため含まない。 */
const APEX_ANGLE_MIN_DEG = 0;
const APEX_ANGLE_MAX_DEG = 180;

/** 屈折率の下限。 */
const REFRACTIVE_INDEX_MIN = 1;

/**
 * 頂角が定義域（0 < A < 180 度の有限数）に収まっているか検証する。
 *
 * @param apexAngleDeg 頂角 A [deg]
 * @throws {RangeError} apexAngleDeg が定義域外の場合
 */
function assertApexAngleDeg(apexAngleDeg: number): void {
  if (
    !Number.isFinite(apexAngleDeg) ||
    apexAngleDeg <= APEX_ANGLE_MIN_DEG ||
    apexAngleDeg >= APEX_ANGLE_MAX_DEG
  ) {
    throw new RangeError(
      `頂角は ${APEX_ANGLE_MIN_DEG}〜${APEX_ANGLE_MAX_DEG} 度（両端を除く）の有限数である` +
        `必要があります（受け取った値: ${apexAngleDeg}）`
    );
  }
}

/**
 * 屈折率が定義域（1 以上の有限数）に収まっているか検証する。
 *
 * @param n 屈折率（無次元）
 * @throws {RangeError} n が 1 以上の有限数でない場合
 */
function assertRefractiveIndex(n: number): void {
  if (!Number.isFinite(n) || n < REFRACTIVE_INDEX_MIN) {
    throw new RangeError(`屈折率は 1 以上の有限数である必要があります（受け取った値: ${n}）`);
  }
}

/**
 * プリズムを通過した光の総偏角を求める。
 *
 * 入射面で air→glass 屈折（θ₁ → r₁）、頂角の幾何関係 r₂ = A - r₁、
 * 出射面で glass→air 屈折（r₂ → θ₂）を経て、総偏角は δ = θ₁ + θ₂ - A となる。
 *
 * 出射面が全反射域の場合は独自判定を持たず、refractionAngleDeg が投げる
 * RangeError をそのまま伝播させる（全反射の境界を fresnel と一元化するため）。
 * 入射角の定義域検証も入射面の refractionAngleDeg に委ねる。
 *
 * @param apexAngleDeg 頂角 A [deg]。0 < A < 180
 * @param incidenceAngleDeg 入射面での入射角 θ₁ [deg]。0 <= θ₁ <= 90
 * @param n プリズム材質の屈折率（無次元）。1 以上の有限数
 * @returns 総偏角 δ [deg]（入射方向からの振れ角）
 * @throws {RangeError} 引数が定義域外、または出射面が全反射域の場合
 */
export function prismDeviationDeg(
  apexAngleDeg: number,
  incidenceAngleDeg: number,
  n: number
): number {
  assertApexAngleDeg(apexAngleDeg);
  assertRefractiveIndex(n);

  // 入射面: 空気 → プリズム。疎→密なので全反射はしない
  const firstRefractionDeg = refractionAngleDeg(N_AIR, n, incidenceAngleDeg);

  // 頂角の幾何関係。入射面・出射面の法線がなす角が A であることから r₁ + r₂ = A
  const secondIncidenceDeg = apexAngleDeg - firstRefractionDeg;

  // 出射面: プリズム → 空気。全反射域なら RangeError がここから伝播する
  const exitAngleDeg = refractionAngleDeg(n, N_AIR, secondIncidenceDeg);

  return incidenceAngleDeg + exitAngleDeg - apexAngleDeg;
}

/**
 * 最小偏角を求める。
 *
 * 対称通過（r₁ = r₂ = A/2）のとき偏角が最小となり、
 * δ_min = 2·asin(n·sin(A/2)) - A が成り立つ。
 *
 * n·sin(A/2) >= 1 のときは対称通過の解が存在せず、プリズムを透過できない
 * （透過条件 A < 2·θc を満たさない）。この場合は RangeError を投げる。
 * 等号を含めるのは、A = 2·θc では対称通過の r₂ が臨界角ちょうどとなり、
 * fresnel の「θ >= θc は全反射」という唯一の規約に従えば透過しないため。
 * prismDeviationDeg を対称入射角で評価したときの挙動とも一致する。
 *
 * @param apexAngleDeg 頂角 A [deg]。0 < A < 180
 * @param n プリズム材質の屈折率（無次元）。1 以上の有限数
 * @returns 最小偏角 δ_min [deg]
 * @throws {RangeError} 引数が定義域外、または透過条件を満たさない場合
 */
export function minimumDeviationDeg(apexAngleDeg: number, n: number): number {
  // 対称通過では θ₂ = θ₁ なので δ = θ₁ + θ₂ - A = 2·θ₁_min - A。
  // n·sin(A/2) の評価と透過不能の判定は minimumDeviationIncidenceDeg に委ねる
  // （同じ式と同じ例外を 2 か所に持たない）。2 倍は 2 の冪なので丸めを増やさない
  return 2 * minimumDeviationIncidenceDeg(apexAngleDeg, n) - apexAngleDeg;
}

/**
 * 頂角 A のプリズムが、その材質で光を透過し得るかを判定する。
 *
 * 透過条件は A < 2·θc。第一面での屈折角の上限が θc であり、r₁ + r₂ = A かつ
 * r₂ < θc を同時に満たす必要があることから導かれる。この条件を満たさない場合、
 * 入射角をどう変えても第二面で必ず全反射する（ダイヤモンドの頂角 60° がこれに当たる）。
 *
 * 境界 A = 2·θc は false。θc ちょうどでの全反射は fresnel の「θ >= θc」規約に従う。
 * θc は fresnel.criticalAngle に委ね、全反射の境界を自前で持たない。
 *
 * @param apexAngleDeg 頂角 A [deg]。0 < A < 180
 * @param n プリズム材質の屈折率（無次元）。1 以上の有限数
 * @returns 透過し得るなら true、どの入射角でも全反射するなら false
 * @throws {RangeError} 引数が定義域外の場合
 */
export function canTransmitThroughPrism(apexAngleDeg: number, n: number): boolean {
  assertApexAngleDeg(apexAngleDeg);
  assertRefractiveIndex(n);

  return apexAngleDeg < 2 * criticalAngle(n, N_AIR);
}

/**
 * 最小偏角となる入射角 θ₁_min を求める。
 *
 * 対称通過（r₁ = r₂ = A/2）のとき偏角が最小になるので、スネル則 sin θ₁ = n·sin r₁ に
 * r₁ = A/2 を入れて θ₁_min = asin(n·sin(A/2))。
 *
 * **探索しない。** δ(θ₁) は下に凸な単峰関数だが、その最小点には上の閉形式がある。
 * 数値探索を本番経路に置くと、収束の許容差が表示値に混ざり込む。黄金分割探索は
 * 独立オラクルとしてテスト側に置き、この式と突き合わせる（TASKS 6-2・案X）。
 *
 * 透過条件を満たさない場合は minimumDeviationDeg と同じ流儀で RangeError を投げる。
 * 判定式も同じ n·sin(A/2) >= 1 を使う（canTransmitThroughPrism の A < 2·θc と厳密に同値）。
 *
 * @param apexAngleDeg 頂角 A [deg]。0 < A < 180
 * @param n プリズム材質の屈折率（無次元）。1 以上の有限数
 * @returns 最小偏角となる入射角 θ₁_min [deg]
 * @throws {RangeError} 引数が定義域外、または透過条件を満たさない場合
 */
export function minimumDeviationIncidenceDeg(apexAngleDeg: number, n: number): number {
  assertApexAngleDeg(apexAngleDeg);
  assertRefractiveIndex(n);

  // スネル則 sin θ₁ = n·sin r₁ に対称通過の r₁ = A/2 を入れる
  const sinIncidence = n * Math.sin((apexAngleDeg / 2) * RAD_PER_DEG);

  if (sinIncidence >= 1) {
    throw new RangeError(
      `頂角 ${apexAngleDeg}° のプリズムは屈折率 ${n} では透過できません` +
        `（n·sin(A/2) = ${sinIncidence} >= 1。透過条件 A < 2·θc を満たさない）`
    );
  }

  return Math.asin(sinIncidence) * DEG_PER_RAD;
}

/**
 * 最小偏角の配置を求める。UI の入口。
 *
 * **透過できない材質では例外ではなく null を返す。** 材質セレクトで選べる以上、
 * 「解が無い」はふつうに起きる状態であり、呼び出し規約の違反ではない
 * （`screenProjection.meanExitAnchor` が射出光の無いときに null を返すのと同じ流儀）。
 * 定義域違反（頂角・屈折率が範囲外）は従来どおり RangeError で落とす。
 *
 * null になる条件は `canTransmitThroughPrism` の否定と厳密に一致する。
 * 判定元を二重化しないよう、可否の判断はそちらへ委ねる。
 *
 * @param apexAngleDeg 頂角 A [deg]。0 < A < 180
 * @param n プリズム材質の屈折率（無次元）。1 以上の有限数
 * @returns 最小偏角の配置。どの入射角でも全反射する材質なら null
 * @throws {RangeError} 引数が定義域外の場合
 */
export function minimumDeviation(apexAngleDeg: number, n: number): MinimumDeviation | null {
  // 可否の判断はここに書かず canTransmitThroughPrism に委ねる。判定元を一元化しておけば、
  // 「解が無いのに null にならない」組み合わせが原理的に作れない
  if (!canTransmitThroughPrism(apexAngleDeg, n)) {
    return null;
  }

  return {
    incidenceAngleDeg: minimumDeviationIncidenceDeg(apexAngleDeg, n),
    deviationDeg: minimumDeviationDeg(apexAngleDeg, n),
  };
}
