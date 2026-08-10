/**
 * 界面での臨界角・全反射判定を行う純粋関数群。
 *
 * DOM / Three.js には一切依存しない（CLAUDE.md の分離規約）。
 * 波長依存性はここでは扱わない。呼び出し側が dispersion.refractiveIndex() で
 * 求めた屈折率を渡す責務を持つ。
 */

const DEG_PER_RAD = 180 / Math.PI;

/** 入射角の定義域 [deg]。界面法線からの角なので 0〜90°。 */
const INCIDENCE_ANGLE_MIN_DEG = 0;
const INCIDENCE_ANGLE_MAX_DEG = 90;

/** 屈折率の下限。真空の 1 を下回る値は本アプリでは扱わない。 */
const REFRACTIVE_INDEX_MIN = 1;

/**
 * 屈折率が定義域（1 以上の有限数）に収まっているか検証する。
 *
 * @param n 屈折率（無次元）
 * @param label エラーメッセージ用の引数名
 * @throws {RangeError} n が 1 以上の有限数でない場合
 */
function assertRefractiveIndex(n: number, label: string): void {
  if (!Number.isFinite(n) || n < REFRACTIVE_INDEX_MIN) {
    throw new RangeError(`${label} は 1 以上の有限数である必要があります（受け取った値: ${n}）`);
  }
}

/**
 * 入射角が定義域（0〜90 度の有限数）に収まっているか検証する。
 *
 * @param incidenceAngleDeg 界面法線から測った入射角 [deg]
 * @throws {RangeError} incidenceAngleDeg が 0〜90 度の有限数でない場合
 */
function assertIncidenceAngleDeg(incidenceAngleDeg: number): void {
  if (
    !Number.isFinite(incidenceAngleDeg) ||
    incidenceAngleDeg < INCIDENCE_ANGLE_MIN_DEG ||
    incidenceAngleDeg > INCIDENCE_ANGLE_MAX_DEG
  ) {
    throw new RangeError(
      `入射角は ${INCIDENCE_ANGLE_MIN_DEG}〜${INCIDENCE_ANGLE_MAX_DEG} 度の有限数である必要が` +
        `あります（受け取った値: ${incidenceAngleDeg}）`
    );
  }
}

/**
 * 界面の臨界角を求める。
 *
 * θc = asin(nTo / nFrom)（スネル則で屈折角が 90° になる入射角）
 *
 * 臨界角は密→疎（nFrom >= nTo）の界面にのみ存在する。nFrom < nTo では
 * asin の引数が 1 を超えて解が無いため、NaN を返さず RangeError を投げる。
 * nFrom === nTo は asin(1) = 90° として定義する。
 *
 * @param nFrom 入射側媒質の屈折率（無次元）。1 以上の有限数
 * @param nTo 射出側媒質の屈折率（無次元）。1 以上の有限数
 * @returns 臨界角 [deg]（界面法線から測った角）
 * @throws {RangeError} 屈折率が定義域外、または nFrom < nTo で臨界角が存在しない場合
 */
export function criticalAngle(nFrom: number, nTo: number): number {
  assertRefractiveIndex(nFrom, 'nFrom');
  assertRefractiveIndex(nTo, 'nTo');

  if (nFrom < nTo) {
    throw new RangeError(
      `nFrom < nTo（疎→密）の界面には臨界角が存在しません（nFrom: ${nFrom}, nTo: ${nTo}）`
    );
  }

  return Math.asin(nTo / nFrom) * DEG_PER_RAD;
}

/**
 * その入射角で光が透過するか（全反射しないか）を判定する。
 *
 * nFrom <= nTo（疎→密、または同一媒質）では全反射が原理的に起こらないため、
 * 入射角によらず true を返す（臨界角の計算へ進まない）。
 * nFrom > nTo のときのみ θ と θc を比較し、θ >= θc を全反射とみなす。
 * θc ちょうどでは屈折光が界面に沿って進み透過強度が 0 になるため、透過とは扱わない。
 *
 * @param nFrom 入射側媒質の屈折率（無次元）。1 以上の有限数
 * @param nTo 射出側媒質の屈折率（無次元）。1 以上の有限数
 * @param incidenceAngleDeg 界面法線から測った入射角 [deg]。0〜90 度
 * @returns 透過するなら true、全反射するなら false
 * @throws {RangeError} 屈折率または入射角が定義域外の場合
 */
export function canTransmit(nFrom: number, nTo: number, incidenceAngleDeg: number): boolean {
  assertRefractiveIndex(nFrom, 'nFrom');
  assertRefractiveIndex(nTo, 'nTo');
  assertIncidenceAngleDeg(incidenceAngleDeg);

  if (nFrom <= nTo) {
    return true;
  }

  return incidenceAngleDeg < criticalAngle(nFrom, nTo);
}
