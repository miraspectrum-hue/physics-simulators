import { describe, expect, it } from 'vitest';

import { BK7, DIAMOND, SF10, WATER } from '../../src/optics/constants';
import {
  canTransmit,
  criticalAngle,
  reflectance,
  reflectanceP,
  reflectanceS,
} from '../../src/optics/fresnel';

/**
 * src/optics/fresnel.ts の受け入れ条件（臨界角・全反射判定）。
 *
 * 対象:
 *   criticalAngle(nFrom, nTo)                    — 臨界角 θc [deg] を返す
 *   canTransmit(nFrom, nTo, incidenceAngleDeg)   — その入射角で透過するか
 *
 * 設計判断:
 *   - 純粋関数。DOM / Three.js には一切触れない。
 *   - θc = asin(nTo / nFrom)。nFrom < nTo では臨界角が存在しないため RangeError を投げる。
 *     nFrom === nTo は asin(1) = 90° として定義する。
 *   - canTransmit は nFrom <= nTo のとき全反射しえないため、角度によらず常に true を返す
 *     （角度比較へ進まない）。nFrom > nTo のときのみ θ と θc を比較する。
 *   - 境界の規約: θ >= θc を全反射とする（θc ちょうどは false）。
 *     θc では屈折光が界面に沿って進み透過強度が 0 になるため、透過とは扱わない。
 *   - 定義域: 入射角は 0 <= θ <= 90 [deg]、屈折率は 1 以上の有限数。
 *     外れた場合は RangeError を投げる（NaN を光路計算へ伝播させない）。
 *
 * 期待値の出典:
 *   屈折率は constants.ts のカタログ値（SCHOTT / Daimon & Masumura 2007 / Phillip & Taft 1964）。
 *   臨界角は θc = asin(1/n) を倍精度で評価した値であり、SPEC.md の材質定数表
 *   （BK7 41.2° / SF10 35.4° / 水 48.6° / ダイヤモンド 24.4°）と整合する。
 */

/** 真空・空気の屈折率。 */
const N_AIR = 1;

/** 臨界角の許容差 [deg]。解析解を倍精度で評価した値なので極小で足りる。 */
const CRITICAL_ANGLE_TOLERANCE_DEG = 1e-6;

/** 境界テストで臨界角から離す量 [deg]。 */
const BOUNDARY_DELTA_DEG = 0.01;

// ---------------------------------------------------------------------------
// A. 性質: nFrom <= nTo なら全反射しない
// ---------------------------------------------------------------------------

describe('A. 性質: 疎な媒質から密な媒質へ入る場合は全反射しない', () => {
  const INCIDENCE_ANGLES_DEG = [0, 30, 45, 60, 89, 90];

  it.each(INCIDENCE_ANGLES_DEG)(
    '空気→BK7（nFrom < nTo）は入射角 %d° でも透過する',
    (incidenceAngleDeg) => {
      // Arrange
      const nFrom = N_AIR;
      const nTo = BK7.catalogNd;

      // Act
      const transmits = canTransmit(nFrom, nTo, incidenceAngleDeg);

      // Assert
      expect(transmits).toBe(true);
    }
  );

  it.each(INCIDENCE_ANGLES_DEG)(
    '同一屈折率（nFrom === nTo）は入射角 %d° でも透過する',
    (incidenceAngleDeg) => {
      // Arrange
      const nFrom = BK7.catalogNd;
      const nTo = BK7.catalogNd;

      // Act
      const transmits = canTransmit(nFrom, nTo, incidenceAngleDeg);

      // Assert
      expect(transmits).toBe(true);
    }
  );
});

// ---------------------------------------------------------------------------
// B. 既知値: ガラス→空気の臨界角
// ---------------------------------------------------------------------------
//
// θc = asin(1 / n) を倍精度で評価した値:
//   BK7          n = 1.51680  →  41.245190370°
//   SF10         n = 1.72828  →  35.352833027°
//   水（20°C）   n = 1.33340  →  48.587129792°
//   ダイヤモンド n = 2.41730  →  24.436512394°
//
// SPEC.md の材質定数表（1 桁表記で 41.2 / 35.4 / 48.6 / 24.4）と整合する。

describe('B. 既知値: ガラス→空気の臨界角が文献値と一致する', () => {
  const CRITICAL_ANGLE_CASES: readonly [string, number, number][] = [
    ['BK7', BK7.catalogNd, 41.245190370],
    ['SF10', SF10.catalogNd, 35.352833027],
    ['水', WATER.catalogNd, 48.587129792],
    ['ダイヤモンド', DIAMOND.catalogNd, 24.436512394],
  ];

  it.each(CRITICAL_ANGLE_CASES)(
    '%s → 空気 の臨界角が期待値と一致する',
    (_name, nFrom, expectedCriticalAngleDeg) => {
      // Arrange
      const nTo = N_AIR;

      // Act
      const actualCriticalAngleDeg = criticalAngle(nFrom, nTo);

      // Assert
      expect(Math.abs(actualCriticalAngleDeg - expectedCriticalAngleDeg)).toBeLessThanOrEqual(
        CRITICAL_ANGLE_TOLERANCE_DEG
      );
    }
  );

  it('同一屈折率の界面では臨界角が 90° になる', () => {
    // Arrange
    const nFrom = BK7.catalogNd;
    const nTo = BK7.catalogNd;

    // Act
    const actualCriticalAngleDeg = criticalAngle(nFrom, nTo);

    // Assert
    expect(Math.abs(actualCriticalAngleDeg - 90)).toBeLessThanOrEqual(
      CRITICAL_ANGLE_TOLERANCE_DEG
    );
  });
});

// ---------------------------------------------------------------------------
// C. 境界: 臨界角ちょうどの扱い
// ---------------------------------------------------------------------------
//
// 規約: θ >= θc を全反射とする。臨界角ちょうどは「透過しない」。

describe('C. 境界: 臨界角ちょうどは全反射として扱う', () => {
  it('臨界角のわずかに下では透過する（BK7 → 空気）', () => {
    // Arrange
    const nFrom = BK7.catalogNd;
    const nTo = N_AIR;
    const justBelowCriticalDeg = criticalAngle(nFrom, nTo) - BOUNDARY_DELTA_DEG;

    // Act
    const transmits = canTransmit(nFrom, nTo, justBelowCriticalDeg);

    // Assert
    expect(transmits).toBe(true);
  });

  it('臨界角ちょうどでは全反射する（BK7 → 空気）', () => {
    // Arrange
    const nFrom = BK7.catalogNd;
    const nTo = N_AIR;
    const exactlyCriticalDeg = criticalAngle(nFrom, nTo);

    // Act
    const transmits = canTransmit(nFrom, nTo, exactlyCriticalDeg);

    // Assert
    expect(transmits).toBe(false);
  });

  it('臨界角のわずかに上では全反射する（BK7 → 空気）', () => {
    // Arrange
    const nFrom = BK7.catalogNd;
    const nTo = N_AIR;
    const justAboveCriticalDeg = criticalAngle(nFrom, nTo) + BOUNDARY_DELTA_DEG;

    // Act
    const transmits = canTransmit(nFrom, nTo, justAboveCriticalDeg);

    // Assert
    expect(transmits).toBe(false);
  });

  it('臨界角の小さいダイヤモンドでも境界の規約が同じである', () => {
    // Arrange
    const nFrom = DIAMOND.catalogNd;
    const nTo = N_AIR;
    const exactlyCriticalDeg = criticalAngle(nFrom, nTo);

    // Act
    const transmits = canTransmit(nFrom, nTo, exactlyCriticalDeg);

    // Assert
    expect(transmits).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// D. 異常系: 定義域を外れた入力は RangeError
// ---------------------------------------------------------------------------

describe('D. 異常系: 入射角が定義域外なら RangeError を投げる', () => {
  const nFrom = BK7.catalogNd;
  const nTo = N_AIR;

  it('負の入射角で RangeError を投げる', () => {
    // Arrange
    const invalidAngleDeg = -1;

    // Act & Assert
    expect(() => canTransmit(nFrom, nTo, invalidAngleDeg)).toThrow(RangeError);
  });

  it('90° を超える入射角で RangeError を投げる', () => {
    // Arrange
    const invalidAngleDeg = 90.1;

    // Act & Assert
    expect(() => canTransmit(nFrom, nTo, invalidAngleDeg)).toThrow(RangeError);
  });

  it('NaN の入射角で RangeError を投げる', () => {
    // Arrange
    const invalidAngleDeg = Number.NaN;

    // Act & Assert
    expect(() => canTransmit(nFrom, nTo, invalidAngleDeg)).toThrow(RangeError);
  });

  it('Infinity の入射角で RangeError を投げる', () => {
    // Arrange
    const invalidAngleDeg = Number.POSITIVE_INFINITY;

    // Act & Assert
    expect(() => canTransmit(nFrom, nTo, invalidAngleDeg)).toThrow(RangeError);
  });

  it('入射角 0° と 90° は定義域内なので例外を投げない', () => {
    // Arrange & Act & Assert
    expect(() => canTransmit(nFrom, nTo, 0)).not.toThrow();
    expect(() => canTransmit(nFrom, nTo, 90)).not.toThrow();
  });
});

describe('D. 異常系: 屈折率が定義域外なら RangeError を投げる', () => {
  const validAngleDeg = 30;

  it('nFrom が 1 未満なら canTransmit が RangeError を投げる', () => {
    // Arrange
    const invalidNFrom = 0.9;

    // Act & Assert
    expect(() => canTransmit(invalidNFrom, N_AIR, validAngleDeg)).toThrow(RangeError);
  });

  it('nTo が 1 未満なら canTransmit が RangeError を投げる', () => {
    // Arrange
    const invalidNTo = 0.5;

    // Act & Assert
    expect(() => canTransmit(BK7.catalogNd, invalidNTo, validAngleDeg)).toThrow(RangeError);
  });

  it('屈折率が NaN なら canTransmit が RangeError を投げる', () => {
    // Arrange
    const invalidN = Number.NaN;

    // Act & Assert
    expect(() => canTransmit(invalidN, N_AIR, validAngleDeg)).toThrow(RangeError);
  });

  it('屈折率が Infinity なら canTransmit が RangeError を投げる', () => {
    // Arrange
    const invalidN = Number.POSITIVE_INFINITY;

    // Act & Assert
    expect(() => canTransmit(invalidN, N_AIR, validAngleDeg)).toThrow(RangeError);
  });

  it('屈折率が 1 未満なら criticalAngle が RangeError を投げる', () => {
    // Arrange
    const invalidNFrom = 0.9;

    // Act & Assert
    expect(() => criticalAngle(invalidNFrom, N_AIR)).toThrow(RangeError);
  });

  it('屈折率が非有限なら criticalAngle が RangeError を投げる', () => {
    // Arrange
    const invalidNFrom = Number.NaN;

    // Act & Assert
    expect(() => criticalAngle(invalidNFrom, N_AIR)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// E. 全反射しえない組合せでの整合性
// ---------------------------------------------------------------------------

describe('E. 全反射しえない組合せでも矛盾なく動く', () => {
  it('nFrom < nTo では臨界角が存在しないため criticalAngle が RangeError を投げる', () => {
    // Arrange
    const nFrom = N_AIR;
    const nTo = BK7.catalogNd;

    // Act & Assert
    expect(() => criticalAngle(nFrom, nTo)).toThrow(RangeError);
  });

  it('criticalAngle が投げる組合せでも canTransmit は例外を投げず true を返す', () => {
    // Arrange
    const nFrom = N_AIR;
    const nTo = BK7.catalogNd;
    const grazingAngleDeg = 90;

    // Act
    const transmits = canTransmit(nFrom, nTo, grazingAngleDeg);

    // Assert
    expect(transmits).toBe(true);
  });

  it('垂直入射（0°）は全反射しえないので密→疎でも透過する', () => {
    // Arrange
    const nFrom = DIAMOND.catalogNd;
    const nTo = N_AIR;
    const normalIncidenceDeg = 0;

    // Act
    const transmits = canTransmit(nFrom, nTo, normalIncidenceDeg);

    // Assert
    expect(transmits).toBe(true);
  });

  it('屈折率差が大きいほど臨界角が小さくなる（ダイヤモンド < BK7 < 水）', () => {
    // Arrange
    const nTo = N_AIR;

    // Act
    const diamondCriticalDeg = criticalAngle(DIAMOND.catalogNd, nTo);
    const bk7CriticalDeg = criticalAngle(BK7.catalogNd, nTo);
    const waterCriticalDeg = criticalAngle(WATER.catalogNd, nTo);

    // Assert
    expect(diamondCriticalDeg).toBeLessThan(bk7CriticalDeg);
    expect(bk7CriticalDeg).toBeLessThan(waterCriticalDeg);
  });
});

// ===========================================================================
// 反射率 R（TASKS 6-4）
// ===========================================================================
//
// 対象:
//   reflectanceS(nFrom, nTo, θ)  — s 偏光の反射率 Rs（0〜1）
//   reflectanceP(nFrom, nTo, θ)  — p 偏光の反射率 Rp（0〜1）
//   reflectance(nFrom, nTo, θ)   — 無偏光の反射率 R = (Rs + Rp) / 2
//
// 設計判断（SPEC.md「フレネル反射（F-28）」に対応）:
//   - フレネルの式（非磁性体）。sinθt = (nFrom / nTo)·sinθi として
//       Rs = |(nFrom·cosθi − nTo·cosθt) / (nFrom·cosθi + nTo·cosθt)|²
//       Rp = |(nFrom·cosθt − nTo·cosθi) / (nFrom·cosθt + nTo·cosθi)|²
//   - **全反射域の判定は canTransmit に委譲し、R = 1 を返す。** 臨界角を再導出したり
//     判別式の符号を自前で見たりしない。判定元を二重化すると refractionAngleDeg との
//     境界がずれる（同じ理由で tracer もベクトル判別式を使っていない）。
//   - 全反射域でも反射率は物理的に定義される（＝1）ので、屈折角と違って例外は投げない。
//     「屈折角は存在しないので投げる、反射率は存在するので返す」という使い分け。
//   - 定義域の検証は既存の assertRefractiveIndex / assertIncidenceAngleDeg に委譲する。
//
// 期待値の出典:
//   すべて上記の解析式を倍精度で評価した確定値。近似値・文献の丸め値は使わない。
//   垂直入射は F0 = ((n−1)/(n+1))² と厳密一致する（式から導かれる帰結）。

/** 反射率の許容差。解析式を倍精度で評価するので、式の並べ替えによる差はこの程度に収まる。 */
const REFLECTANCE_TOLERANCE = 1e-12;

/**
 * ブリュースター角での Rp の上限。
 *
 * 解析的には厳密に 0 だが、atan と asin を往復するため丸めが残る。
 * 実測の残差は 空気→BK7 / SF10 / 水 で 0（厳密）、空気→ダイヤで 3.6e-33、
 * BK7→空気で 1.8e-32。物理的なゼロと区別できる桁ではない。
 */
const BREWSTER_RP_MAX = 1e-30;

/** 度からラジアンへの換算。テスト側でブリュースター角を独立に導くために持つ。 */
const DEG_PER_RADIAN = 180 / Math.PI;

// ---------------------------------------------------------------------------
// F. 垂直入射: R = F0 = ((n−1)/(n+1))²
// ---------------------------------------------------------------------------

describe('F. 垂直入射の反射率が F0 と厳密一致する', () => {
  /** [材質名, 屈折率, F0]。F0 は ((n−1)/(n+1))² を倍精度で評価した確定値。 */
  const NORMAL_INCIDENCE_CASES: readonly [string, number, number][] = [
    ['水', WATER.catalogNd, 0.020415160749659062],
    ['BK7', BK7.catalogNd, 0.04216456259454582],
    ['SF10', SF10.catalogNd, 0.07125558145339843],
    ['ダイヤモンド', DIAMOND.catalogNd, 0.17201145168823703],
  ];

  it.each(NORMAL_INCIDENCE_CASES)('%s: 空気から垂直に入れた光の R が F0 と一致する', (_name, n, f0) => {
    // Arrange
    const normalIncidenceDeg = 0;

    // Act
    const r = reflectance(N_AIR, n, normalIncidenceDeg);

    // Assert
    expect(r).toBe(f0);
  });

  it('垂直入射では s 偏光と p 偏光の区別が無くなる（Rs === Rp）', () => {
    // Arrange
    const normalIncidenceDeg = 0;

    // Act
    const rs = reflectanceS(N_AIR, BK7.catalogNd, normalIncidenceDeg);
    const rp = reflectanceP(N_AIR, BK7.catalogNd, normalIncidenceDeg);

    // Assert
    expect(rs).toBe(rp);
  });
});

// ---------------------------------------------------------------------------
// G. ブリュースター角: θB = atan(nTo / nFrom) で Rp = 0
// ---------------------------------------------------------------------------

describe('G. ブリュースター角で p 偏光の反射が消える', () => {
  /** [表示名, nFrom, nTo]。θB はテスト内で atan から導き、実装と同じ経路を通さない。 */
  const BREWSTER_CASES: readonly [string, number, number][] = [
    ['空気→水', N_AIR, WATER.catalogNd],
    ['空気→BK7', N_AIR, BK7.catalogNd],
    ['空気→SF10', N_AIR, SF10.catalogNd],
    ['空気→ダイヤモンド', N_AIR, DIAMOND.catalogNd],
    ['BK7→空気（密→疎）', BK7.catalogNd, N_AIR],
  ];

  it.each(BREWSTER_CASES)('%s: ブリュースター角で Rp がゼロになる', (_name, nFrom, nTo) => {
    // Arrange
    const brewsterAngleDeg = Math.atan(nTo / nFrom) * DEG_PER_RADIAN;

    // Act
    const rp = reflectanceP(nFrom, nTo, brewsterAngleDeg);

    // Assert
    expect(rp).toBeLessThan(BREWSTER_RP_MAX);
  });

  it('ブリュースター角でも s 偏光は反射する（空気→BK7 で 0.155286959920509）', () => {
    // Arrange
    const brewsterAngleDeg = Math.atan(BK7.catalogNd / N_AIR) * DEG_PER_RADIAN;

    // Act
    const rs = reflectanceS(N_AIR, BK7.catalogNd, brewsterAngleDeg);

    // Assert
    expect(Math.abs(rs - 0.155286959920509)).toBeLessThanOrEqual(REFLECTANCE_TOLERANCE);
  });
});

// ---------------------------------------------------------------------------
// H. 全反射域: R = 1
// ---------------------------------------------------------------------------

describe('H. 全反射域では反射率が 1 になる', () => {
  it('臨界角ちょうどで R = 1（canTransmit の境界規約と一致する）', () => {
    // Arrange
    const criticalDeg = criticalAngle(BK7.catalogNd, N_AIR);

    // Act
    const r = reflectance(BK7.catalogNd, N_AIR, criticalDeg);

    // Assert
    expect(r).toBe(1);
  });

  it('臨界角を超えた入射で R = 1', () => {
    // Arrange
    const beyondCriticalDeg = criticalAngle(BK7.catalogNd, N_AIR) + BOUNDARY_DELTA_DEG;

    // Act
    const r = reflectance(BK7.catalogNd, N_AIR, beyondCriticalDeg);

    // Assert
    expect(r).toBe(1);
  });

  it('全反射域では Rs も Rp も 1 になる', () => {
    // Arrange
    const beyondCriticalDeg = criticalAngle(DIAMOND.catalogNd, N_AIR) + BOUNDARY_DELTA_DEG;

    // Act
    const rs = reflectanceS(DIAMOND.catalogNd, N_AIR, beyondCriticalDeg);
    const rp = reflectanceP(DIAMOND.catalogNd, N_AIR, beyondCriticalDeg);

    // Assert
    expect(rs).toBe(1);
    expect(rp).toBe(1);
  });

  it('臨界角の直下ではまだ 1 に達しない（BK7→空気 41.2 度で 0.785781427804146）', () => {
    // Arrange
    const belowCriticalDeg = 41.2;

    // Act
    const r = reflectance(BK7.catalogNd, N_AIR, belowCriticalDeg);

    // Assert
    expect(r).toBeLessThan(1);
    expect(Math.abs(r - 0.785781427804146)).toBeLessThanOrEqual(REFLECTANCE_TOLERANCE);
  });
});

// ---------------------------------------------------------------------------
// I. 中間角の既知値: 解析解を倍精度で評価した確定値と一致する
// ---------------------------------------------------------------------------

describe('I. 中間角の Rs / Rp が解析解と一致する', () => {
  /** [表示名, nFrom, nTo, 入射角[deg], Rs, Rp]。 */
  const KNOWN_CASES: readonly [string, number, number, number, number, number][] = [
    ['空気→BK7 30度', N_AIR, BK7.catalogNd, 30, 0.060660746025078684, 0.02678270653108244],
    ['空気→BK7 45度', N_AIR, BK7.catalogNd, 45, 0.09597830177720648, 0.00921183441203654],
    ['空気→SF10 60度', N_AIR, SF10.catalogNd, 60, 0.24890987972282044, 5.262415780287002e-7],
    ['BK7→空気 30度', BK7.catalogNd, N_AIR, 30, 0.11338593019322123, 0.004370334902008017],
    ['空気→水 75度', N_AIR, WATER.catalogNd, 75, 0.3142598696877355, 0.11074738436970537],
  ];

  it.each(KNOWN_CASES)('%s: Rs が確定値と一致する', (_name, nFrom, nTo, deg, expectedRs) => {
    // Arrange & Act
    const rs = reflectanceS(nFrom, nTo, deg);

    // Assert
    expect(Math.abs(rs - expectedRs)).toBeLessThanOrEqual(REFLECTANCE_TOLERANCE);
  });

  it.each(KNOWN_CASES)('%s: Rp が確定値と一致する', (_name, nFrom, nTo, deg, _rs, expectedRp) => {
    // Arrange & Act
    const rp = reflectanceP(nFrom, nTo, deg);

    // Assert
    expect(Math.abs(rp - expectedRp)).toBeLessThanOrEqual(REFLECTANCE_TOLERANCE);
  });
});

// ---------------------------------------------------------------------------
// J. 性質: 定義・順序・値域
// ---------------------------------------------------------------------------

describe('J. 反射率の満たすべき性質', () => {
  /** 性質の確認に使う界面。疎→密と密→疎の両方向を含める。 */
  const INTERFACES: readonly [string, number, number][] = [
    ['空気→BK7', N_AIR, BK7.catalogNd],
    ['BK7→空気', BK7.catalogNd, N_AIR],
    ['空気→ダイヤモンド', N_AIR, DIAMOND.catalogNd],
    ['水→空気', WATER.catalogNd, N_AIR],
  ];

  /** 0〜90 度を 1 度刻みで並べた入射角。 */
  const SWEEP_ANGLES_DEG: readonly number[] = Array.from({ length: 91 }, (_unused, i) => i);

  it('R は Rs と Rp の平均である（無偏光の定義そのもの）', () => {
    // Arrange
    const incidenceDeg = 45;

    // Act
    const rs = reflectanceS(N_AIR, SF10.catalogNd, incidenceDeg);
    const rp = reflectanceP(N_AIR, SF10.catalogNd, incidenceDeg);
    const r = reflectance(N_AIR, SF10.catalogNd, incidenceDeg);

    // Assert
    expect(r).toBe((rs + rp) / 2);
  });

  it.each(INTERFACES)('%s: 全角度で Rs >= Rp（s 偏光の方が強く反射する）', (_name, nFrom, nTo) => {
    // Arrange
    const violations: string[] = [];

    // Act
    for (const deg of SWEEP_ANGLES_DEG) {
      const rs = reflectanceS(nFrom, nTo, deg);
      const rp = reflectanceP(nFrom, nTo, deg);

      if (rp > rs) {
        violations.push(`${deg}度: Rs=${rs} < Rp=${rp}`);
      }
    }

    // Assert
    expect(violations).toEqual([]);
  });

  it.each(INTERFACES)('%s: 全角度で R が 0 以上 1 以下に収まる', (_name, nFrom, nTo) => {
    // Arrange
    const violations: string[] = [];

    // Act
    for (const deg of SWEEP_ANGLES_DEG) {
      const r = reflectance(nFrom, nTo, deg);

      if (!(r >= 0 && r <= 1)) {
        violations.push(`${deg}度: R=${r}`);
      }
    }

    // Assert
    expect(violations).toEqual([]);
  });

  it('かすめ入射（89.9 度）では 1 に近づく（空気→BK7 で 0.9899562670485051）', () => {
    // Arrange
    const grazingDeg = 89.9;

    // Act
    const r = reflectance(N_AIR, BK7.catalogNd, grazingDeg);

    // Assert
    expect(Math.abs(r - 0.9899562670485051)).toBeLessThanOrEqual(REFLECTANCE_TOLERANCE);
  });

  it('完全なかすめ入射（90 度）では s 偏光が全反射する', () => {
    // Arrange
    const grazingDeg = 90;

    // Act
    const rs = reflectanceS(N_AIR, BK7.catalogNd, grazingDeg);

    // Assert
    expect(rs).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// K. 異常系: 定義域の検証は既存のガードへ委譲する
// ---------------------------------------------------------------------------

describe('K. 異常系: 定義域外は RangeError を投げる', () => {
  it('屈折率が 1 未満なら RangeError を投げる（3 関数とも）', () => {
    // Arrange
    const invalidIndex = 0.5;

    // Act & Assert
    expect(() => reflectance(invalidIndex, N_AIR, 30)).toThrow(RangeError);
    expect(() => reflectanceS(invalidIndex, N_AIR, 30)).toThrow(RangeError);
    expect(() => reflectanceP(invalidIndex, N_AIR, 30)).toThrow(RangeError);
  });

  it('入射角が 0〜90 度の外なら RangeError を投げる（3 関数とも）', () => {
    // Arrange
    const invalidAngleDeg = 90.1;

    // Act & Assert
    expect(() => reflectance(N_AIR, BK7.catalogNd, invalidAngleDeg)).toThrow(RangeError);
    expect(() => reflectanceS(N_AIR, BK7.catalogNd, invalidAngleDeg)).toThrow(RangeError);
    expect(() => reflectanceP(N_AIR, BK7.catalogNd, invalidAngleDeg)).toThrow(RangeError);
  });
});
