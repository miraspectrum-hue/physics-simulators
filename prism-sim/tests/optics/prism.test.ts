import { describe, expect, it } from 'vitest';

import { APEX_ANGLE_DEG, BK7, DIAMOND, SF10, WATER } from '../../src/optics/constants';
import { createTriangularPrism, ray } from '../../src/optics/convexSolid';
import { canTransmit, criticalAngle, reflectance } from '../../src/optics/fresnel';
import {
  canTransmitThroughPrism,
  minimumDeviation,
  minimumDeviationDeg,
  minimumDeviationIncidenceDeg,
  prismDeviationDeg,
} from '../../src/optics/prism';
import { refractionAngleDeg } from '../../src/optics/refraction';
import { traceRay } from '../../src/optics/tracer';
import { addScaled, vec3 } from '../../src/optics/vec3';

/**
 * src/optics/prism.ts の受け入れ条件（プリズムの偏角）。
 *
 * 対象:
 *   prismDeviationDeg(apexAngleDeg, incidenceAngleDeg, n) — 総偏角 δ [deg]
 *   minimumDeviationDeg(apexAngleDeg, n)                  — 最小偏角 δ_min [deg]
 *   canTransmitThroughPrism(apexAngleDeg, n)              — 透過し得るか（A < 2·θc）
 *
 * 物理:
 *   入射面で air→glass 屈折 → 幾何関係 r₂ = A - r₁ → 出射面で glass→air 屈折
 *   δ = θ₁ + θ₂ - A
 *   δ_min = 2·asin(n·sin(A/2)) - A（対称通過 r₁ = r₂ = A/2 のとき）
 *   透過条件 A < 2·θc（θc = criticalAngle(n, 空気) = asin(1/n)）
 *
 * 設計判断:
 *   - 純粋関数。DOM / Three.js / convexSolid（3D 幾何）/ dispersion には依存しない。
 *     屈折率は引数で受け取る（波長依存性は呼び出し側の責務）。
 *   - 屈折は refraction.refractionAngleDeg を合成して求める。出射面が全反射域なら
 *     refractionAngleDeg の RangeError がそのまま伝播する（独自の全反射判定を持たない）。
 *   - minimumDeviationDeg は n·sin(A/2) > 1 のとき透過不能として RangeError。
 *   - 定義域: 頂角は 0 < A < 180 [deg]、入射角は 0 <= θ₁ <= 90 [deg]、
 *     屈折率は 1 以上の有限数。外れた場合は RangeError。
 *
 * 期待値の出典:
 *   屈折率は constants.ts のカタログ値（d 線 587.56nm）。
 *   偏角はスネル則の合成を倍精度で評価した値。SPEC.md「δ_min 参考値」
 *   （BK7 38.65° / SF10 59.57° / 水 23.63°、ダイヤモンドは解なし）と ±0.05° で整合する。
 */

/** 真空・空気の屈折率。 */
const N_AIR = 1;

/** 偏角の許容差 [deg]。期待値は解析解を倍精度で評価した 9 桁のハードコード。 */
const ANGLE_TOLERANCE_DEG = 1e-6;

/** 恒等関係（対称性・最小偏角の一致）の許容差 [deg]。実測誤差は 3e-14 度程度。 */
const IDENTITY_TOLERANCE_DEG = 1e-9;

/** SPEC.md の δ_min 参考値に対する許容差 [deg]。SPEC の「検証に使う既知値」で定めた値。 */
const SPEC_TOLERANCE_DEG = 0.05;

/** 境界テストで臨界入射角から離す量 [deg]。 */
const BOUNDARY_DELTA_DEG = 0.01;

// 透過する 3 材質の [表示名, 屈折率, 対称入射角, δ_min]。頂角は APEX_ANGLE_DEG（60°）。
//   θ_sym = asin(n·sin(30°))、δ_min = 2·θ_sym - 60 を倍精度で評価した値
const TRANSMITTING_CASES: readonly [string, number, number, number][] = [
  ['BK7', BK7.catalogNd, 49.323347736, 38.646695472],
  ['SF10', SF10.catalogNd, 59.784649106, 59.569298212],
  ['水', WATER.catalogNd, 41.812877292, 23.625754584],
];

// SPEC.md「δ_min 参考値」の [表示名, 屈折率, 参考値]
const SPEC_REFERENCE_CASES: readonly [string, number, number][] = [
  ['BK7', BK7.catalogNd, 38.65],
  ['SF10', SF10.catalogNd, 59.57],
  ['水', WATER.catalogNd, 23.63],
];

/** prismDeviationDeg が RangeError を投げたかを真偽値で返す（E 観点の突き合わせ用）。 */
function throwsRangeError(apexAngleDeg: number, incidenceAngleDeg: number, n: number): boolean {
  try {
    prismDeviationDeg(apexAngleDeg, incidenceAngleDeg, n);
    return false;
  } catch (error) {
    if (error instanceof RangeError) {
      return true;
    }
    throw error;
  }
}

/** minimumDeviationDeg が RangeError を投げたかを真偽値で返す（E 観点の突き合わせ用）。 */
function minimumDeviationThrows(apexAngleDeg: number, n: number): boolean {
  try {
    minimumDeviationDeg(apexAngleDeg, n);
    return false;
  } catch (error) {
    if (error instanceof RangeError) {
      return true;
    }
    throw error;
  }
}

/** 出射面（glass→air）が透過するかを refraction / fresnel だけで独立に求める。 */
function exitFaceTransmits(apexAngleDeg: number, incidenceAngleDeg: number, n: number): boolean {
  const internalIncidenceDeg = refractionAngleDeg(N_AIR, n, incidenceAngleDeg);
  const exitIncidenceDeg = apexAngleDeg - internalIncidenceDeg;

  return canTransmit(n, N_AIR, exitIncidenceDeg);
}

// ---------------------------------------------------------------------------
// A. 性質: 最小偏角の対称性
// ---------------------------------------------------------------------------

describe('A. 性質: 最小偏角は対称通過で起き、偏角はその周りで対称になる', () => {
  it('対称入射角では出射角が入射角に等しく δ = 2·θ_sym - A になる（BK7）', () => {
    // Arrange: θ_sym = asin(n·sin(30°))。対称通過なら θ₂ = θ₁ なので δ = 2θ₁ - A
    const symmetricIncidenceDeg = 49.323347736;
    const expectedDeg = 2 * symmetricIncidenceDeg - APEX_ANGLE_DEG;

    // Act
    const actualDeg = prismDeviationDeg(APEX_ANGLE_DEG, symmetricIncidenceDeg, BK7.catalogNd);

    // Assert
    expect(Math.abs(actualDeg - expectedDeg)).toBeLessThanOrEqual(IDENTITY_TOLERANCE_DEG);
  });

  it.each(TRANSMITTING_CASES)(
    '%s は対称入射角での偏角が minimumDeviationDeg と一致する',
    (_name, n, symmetricIncidenceDeg) => {
      // Arrange
      const expectedDeg = minimumDeviationDeg(APEX_ANGLE_DEG, n);

      // Act
      const actualDeg = prismDeviationDeg(APEX_ANGLE_DEG, symmetricIncidenceDeg, n);

      // Assert
      expect(Math.abs(actualDeg - expectedDeg)).toBeLessThanOrEqual(IDENTITY_TOLERANCE_DEG);
    }
  );

  it('共役な 2 入射角が同じ偏角を与える（BK7、40° と 60.274231135°）', () => {
    // Arrange: 光路の可逆性より、入射角と出射角を入れ替えても偏角は変わらない
    const incidenceAngleDeg = 40;
    const conjugateIncidenceDeg = 60.274231135;

    // Act
    const deviationDeg = prismDeviationDeg(APEX_ANGLE_DEG, incidenceAngleDeg, BK7.catalogNd);
    const conjugateDeviationDeg = prismDeviationDeg(
      APEX_ANGLE_DEG,
      conjugateIncidenceDeg,
      BK7.catalogNd
    );

    // Assert
    expect(Math.abs(conjugateDeviationDeg - deviationDeg)).toBeLessThanOrEqual(
      IDENTITY_TOLERANCE_DEG
    );
  });

  it('共役な 2 入射角が同じ偏角を与える（BK7、70° と 34.145154993°）', () => {
    // Arrange
    const incidenceAngleDeg = 70;
    const conjugateIncidenceDeg = 34.145154993;

    // Act
    const deviationDeg = prismDeviationDeg(APEX_ANGLE_DEG, incidenceAngleDeg, BK7.catalogNd);
    const conjugateDeviationDeg = prismDeviationDeg(
      APEX_ANGLE_DEG,
      conjugateIncidenceDeg,
      BK7.catalogNd
    );

    // Assert
    expect(Math.abs(conjugateDeviationDeg - deviationDeg)).toBeLessThanOrEqual(
      IDENTITY_TOLERANCE_DEG
    );
  });
});

// ---------------------------------------------------------------------------
// B. 既知値: 頂角 60°・d 線での最小偏角
// ---------------------------------------------------------------------------
//
// δ_min = 2·asin(n·sin(30°)) - 60 を倍精度で評価した値:
//   BK7   n = 1.51680  →  38.646695472°（SPEC 参考値 38.65 との差 -0.0033）
//   SF10  n = 1.72828  →  59.569298212°（SPEC 参考値 59.57 との差 -0.0007）
//   水    n = 1.33340  →  23.625754584°（SPEC 参考値 23.63 との差 -0.0042）

describe('B. 既知値: 最小偏角が確定値および SPEC 参考値と一致する', () => {
  it.each(TRANSMITTING_CASES)(
    '%s の minimumDeviationDeg が確定値と一致する',
    (_name, n, _symmetricIncidenceDeg, expectedDeg) => {
      // Arrange & Act
      const actualDeg = minimumDeviationDeg(APEX_ANGLE_DEG, n);

      // Assert
      expect(Math.abs(actualDeg - expectedDeg)).toBeLessThanOrEqual(ANGLE_TOLERANCE_DEG);
    }
  );

  it.each(SPEC_REFERENCE_CASES)(
    '%s の minimumDeviationDeg が SPEC 参考値と ±0.05° で一致する',
    (_name, n, specValueDeg) => {
      // Arrange & Act
      const actualDeg = minimumDeviationDeg(APEX_ANGLE_DEG, n);

      // Assert
      expect(Math.abs(actualDeg - specValueDeg)).toBeLessThanOrEqual(SPEC_TOLERANCE_DEG);
    }
  );

  it('BK7 の対称入射角 49.323347736° での偏角が 38.646695472° になる', () => {
    // Arrange
    const symmetricIncidenceDeg = 49.323347736;
    const expectedDeg = 38.646695472;

    // Act
    const actualDeg = prismDeviationDeg(APEX_ANGLE_DEG, symmetricIncidenceDeg, BK7.catalogNd);

    // Assert
    expect(Math.abs(actualDeg - expectedDeg)).toBeLessThanOrEqual(ANGLE_TOLERANCE_DEG);
  });

  it('BK7 の入射 40° での偏角が 40.274231135° になる', () => {
    // Arrange
    const incidenceAngleDeg = 40;
    const expectedDeg = 40.274231135;

    // Act
    const actualDeg = prismDeviationDeg(APEX_ANGLE_DEG, incidenceAngleDeg, BK7.catalogNd);

    // Assert
    expect(Math.abs(actualDeg - expectedDeg)).toBeLessThanOrEqual(ANGLE_TOLERANCE_DEG);
  });
});

// ---------------------------------------------------------------------------
// C. 境界: ダイヤモンドの全反射と最小性
// ---------------------------------------------------------------------------
//
// ダイヤモンド（n = 2.41730）は n·sin(30°) = 1.208650 > 1 のため、頂角 60° では
// 最小偏角の解が存在せず、どの入射角でも出射面で全反射する（SPEC.md の警告ブロック）。

describe('C. 境界: ダイヤモンドは頂角 60° で透過しない', () => {
  it('minimumDeviationDeg が RangeError を投げる（n·sin(30°) = 1.208650 > 1）', () => {
    // Arrange & Act & Assert
    expect(() => minimumDeviationDeg(APEX_ANGLE_DEG, DIAMOND.catalogNd)).toThrow(RangeError);
  });

  it.each([0, 30, 45, 60, 89])(
    'prismDeviationDeg が入射角 %d° で RangeError を投げる（出射面で全反射）',
    (incidenceAngleDeg) => {
      // Arrange & Act & Assert
      expect(() =>
        prismDeviationDeg(APEX_ANGLE_DEG, incidenceAngleDeg, DIAMOND.catalogNd)
      ).toThrow(RangeError);
    }
  );
});

describe('C. 境界: 対称入射から外れた角では偏角が δ_min より大きい', () => {
  it('対称入射角より小さい 40° では偏角が δ_min を上回る（BK7）', () => {
    // Arrange
    const incidenceAngleDeg = 40;
    const minimumDeg = 38.646695472;

    // Act
    const actualDeg = prismDeviationDeg(APEX_ANGLE_DEG, incidenceAngleDeg, BK7.catalogNd);

    // Assert
    expect(actualDeg).toBeGreaterThan(minimumDeg);
  });

  it('対称入射角より大きい 55° では偏角が δ_min を上回る（BK7）', () => {
    // Arrange
    const incidenceAngleDeg = 55;
    const minimumDeg = 38.646695472;

    // Act
    const actualDeg = prismDeviationDeg(APEX_ANGLE_DEG, incidenceAngleDeg, BK7.catalogNd);

    // Assert
    expect(actualDeg).toBeGreaterThan(minimumDeg);
  });

  it('垂直入射（0°）は BK7 でも出射面で全反射する（r₂ = A = 60° > θc）', () => {
    // Arrange & Act & Assert
    expect(() => prismDeviationDeg(APEX_ANGLE_DEG, 0, BK7.catalogNd)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// D. 異常系: 定義域を外れた入力は RangeError
// ---------------------------------------------------------------------------

describe('D. 異常系: 頂角が定義域外なら RangeError を投げる', () => {
  const validIncidenceDeg = 49.323347736;
  const n = BK7.catalogNd;

  it.each([0, -30, 180, 180.1, Number.NaN, Number.POSITIVE_INFINITY])(
    'prismDeviationDeg は頂角 %s で RangeError を投げる',
    (invalidApexDeg) => {
      // Arrange & Act & Assert
      expect(() => prismDeviationDeg(invalidApexDeg, validIncidenceDeg, n)).toThrow(RangeError);
    }
  );

  it.each([0, -30, 180.1, Number.NaN])(
    'minimumDeviationDeg は頂角 %s で RangeError を投げる',
    (invalidApexDeg) => {
      // Arrange & Act & Assert
      expect(() => minimumDeviationDeg(invalidApexDeg, n)).toThrow(RangeError);
    }
  );
});

describe('D. 異常系: 入射角が定義域外なら RangeError を投げる', () => {
  const n = BK7.catalogNd;

  it.each([-1, 90.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'prismDeviationDeg は入射角 %s で RangeError を投げる',
    (invalidIncidenceDeg) => {
      // Arrange & Act & Assert
      expect(() => prismDeviationDeg(APEX_ANGLE_DEG, invalidIncidenceDeg, n)).toThrow(RangeError);
    }
  );
});

describe('D. 異常系: 屈折率が定義域外なら RangeError を投げる', () => {
  const validIncidenceDeg = 49.323347736;

  it.each([0.9, Number.NaN, Number.POSITIVE_INFINITY])(
    'prismDeviationDeg は屈折率 %s で RangeError を投げる',
    (invalidN) => {
      // Arrange & Act & Assert
      expect(() => prismDeviationDeg(APEX_ANGLE_DEG, validIncidenceDeg, invalidN)).toThrow(
        RangeError
      );
    }
  );

  it.each([0.9, Number.NaN, Number.POSITIVE_INFINITY])(
    'minimumDeviationDeg は屈折率 %s で RangeError を投げる',
    (invalidN) => {
      // Arrange & Act & Assert
      expect(() => minimumDeviationDeg(APEX_ANGLE_DEG, invalidN)).toThrow(RangeError);
    }
  );
});

// ---------------------------------------------------------------------------
// E. 整合性: 出射面の全反射境界と一致する（モジュール間）
// ---------------------------------------------------------------------------
//
// prismDeviationDeg が例外を投げる条件は「出射面で全反射すること」でなければならない。
// 独自の判定を持つとずれる。BK7 の透過下限は θ₁ = 29.188205032°
// （このとき r₂ = A - r₁ が臨界角 41.245190370° にちょうど一致する）。
// r₂ は θ₁ に対して単調減少するため、θ₁ がこれ**未満**で全反射する点に注意。

describe('E. 整合性: 例外の境界が出射面の全反射境界と一致する', () => {
  const bk7CutoffDeg = 29.188205032;

  it('透過下限ちょうどでは出射面の判定と例外の有無が逆転関係になる', () => {
    // Arrange
    const n = BK7.catalogNd;

    // Act
    const transmits = exitFaceTransmits(APEX_ANGLE_DEG, bk7CutoffDeg, n);
    const throws = throwsRangeError(APEX_ANGLE_DEG, bk7CutoffDeg, n);

    // Assert: 真の下限を 9 桁に丸めたため r₂ が θc のどちら側に落ちるかは丸め任せ。
    //         どちら側でも「透過するなら例外なし／全反射なら例外」が成り立てばよい
    expect(transmits).not.toEqual(throws);
  });

  it('透過下限のわずか下では出射面が全反射し、prismDeviationDeg も RangeError になる', () => {
    // Arrange
    const n = BK7.catalogNd;
    const belowCutoffDeg = bk7CutoffDeg - BOUNDARY_DELTA_DEG;

    // Act
    const transmits = exitFaceTransmits(APEX_ANGLE_DEG, belowCutoffDeg, n);
    const throws = throwsRangeError(APEX_ANGLE_DEG, belowCutoffDeg, n);

    // Assert
    expect([transmits, throws]).toEqual([false, true]);
  });

  it('透過下限のわずか上では出射面が透過し、prismDeviationDeg も例外にならない', () => {
    // Arrange
    const n = BK7.catalogNd;
    const aboveCutoffDeg = bk7CutoffDeg + BOUNDARY_DELTA_DEG;

    // Act
    const transmits = exitFaceTransmits(APEX_ANGLE_DEG, aboveCutoffDeg, n);
    const throws = throwsRangeError(APEX_ANGLE_DEG, aboveCutoffDeg, n);

    // Assert
    expect([transmits, throws]).toEqual([true, false]);
  });

  it.each(TRANSMITTING_CASES)(
    '%s を 0〜90° まで 0.5° 刻みで走査しても例外の有無が出射面の判定と矛盾しない',
    (_name, n) => {
      // Arrange
      const stepDeg = 0.5;
      const mismatchedAnglesDeg: number[] = [];

      // Act
      for (let angleDeg = 0; angleDeg <= 90; angleDeg += stepDeg) {
        const transmits = exitFaceTransmits(APEX_ANGLE_DEG, angleDeg, n);
        if (transmits === throwsRangeError(APEX_ANGLE_DEG, angleDeg, n)) {
          mismatchedAnglesDeg.push(angleDeg);
        }
      }

      // Assert: 透過する角度では例外にならず、全反射する角度では必ず例外になる
      expect(mismatchedAnglesDeg).toEqual([]);
    }
  );

  it('ダイヤモンドは 0〜90° の全域で出射面が全反射し、全域で RangeError になる', () => {
    // Arrange
    const n = DIAMOND.catalogNd;
    const stepDeg = 0.5;
    const transmittingAnglesDeg: number[] = [];

    // Act
    for (let angleDeg = 0; angleDeg <= 90; angleDeg += stepDeg) {
      const transmits = exitFaceTransmits(APEX_ANGLE_DEG, angleDeg, n);
      if (transmits || !throwsRangeError(APEX_ANGLE_DEG, angleDeg, n)) {
        transmittingAnglesDeg.push(angleDeg);
      }
    }

    // Assert
    expect(transmittingAnglesDeg).toEqual([]);
  });
});

// ===========================================================================
// canTransmitThroughPrism（プリズム単位の透過可否）の受け入れ条件
// ===========================================================================
//
// 透過条件は A < 2·θc。第一面での屈折角の上限が θc であり、r₁ + r₂ = A かつ
// r₂ < θc を同時に満たす必要があることから導かれる。
// 境界 A = 2·θc は false（prism.ts / fresnel の「θ >= θc は全反射」規約と一致）。

// 全 4 材質の [表示名, 屈折率, 2·θc]。θc = asin(1/n) を倍精度で評価した値:
//   BK7          n = 1.51680  →  θc = 41.245190370°  →  2·θc = 82.490380739°
//   SF10         n = 1.72828  →  θc = 35.352833027°  →  2·θc = 70.705666054°
//   水（20°C）   n = 1.33340  →  θc = 48.587129792°  →  2·θc = 97.174259584°
//   ダイヤモンド n = 2.41730  →  θc = 24.436512394°  →  2·θc = 48.873024788°
const DOUBLE_CRITICAL_ANGLE_CASES: readonly [string, number, number][] = [
  ['BK7', BK7.catalogNd, 82.490380739],
  ['SF10', SF10.catalogNd, 70.705666054],
  ['水', WATER.catalogNd, 97.174259584],
  ['ダイヤモンド', DIAMOND.catalogNd, 48.873024788],
];

// ---------------------------------------------------------------------------
// A. 性質: θc が小さい材質ほど頂角の上限が厳しい
// ---------------------------------------------------------------------------
//
// 透過できる頂角の上限は 2·θc であり、屈折率が高いほど θc が小さくなるため
// ダイヤモンド(48.87°) < SF10(70.71°) < BK7(82.49°) < 水(97.17°) の順に厳しい。
// 各しきい値の間に頂角を置き、隣り合う材質で可否が分かれることで順序を示す。

describe('A. 性質: 屈折率が高い材質ほど透過できる頂角の上限が厳しい', () => {
  it('頂角 60° はダイヤモンドの上限を超えるが SF10 の上限内である', () => {
    // Arrange
    const apexAngleDeg = 60;

    // Act
    const diamondTransmits = canTransmitThroughPrism(apexAngleDeg, DIAMOND.catalogNd);
    const sf10Transmits = canTransmitThroughPrism(apexAngleDeg, SF10.catalogNd);

    // Assert
    expect([diamondTransmits, sf10Transmits]).toEqual([false, true]);
  });

  it('頂角 75° は SF10 の上限を超えるが BK7 の上限内である', () => {
    // Arrange
    const apexAngleDeg = 75;

    // Act
    const sf10Transmits = canTransmitThroughPrism(apexAngleDeg, SF10.catalogNd);
    const bk7Transmits = canTransmitThroughPrism(apexAngleDeg, BK7.catalogNd);

    // Assert
    expect([sf10Transmits, bk7Transmits]).toEqual([false, true]);
  });

  it('頂角 90° は BK7 の上限を超えるが水の上限内である', () => {
    // Arrange
    const apexAngleDeg = 90;

    // Act
    const bk7Transmits = canTransmitThroughPrism(apexAngleDeg, BK7.catalogNd);
    const waterTransmits = canTransmitThroughPrism(apexAngleDeg, WATER.catalogNd);

    // Assert
    expect([bk7Transmits, waterTransmits]).toEqual([false, true]);
  });
});

// ---------------------------------------------------------------------------
// B. 既知値: 頂角 60°（本アプリの APEX_ANGLE_DEG）での可否
// ---------------------------------------------------------------------------
//
// 60° と 2·θc の比較:
//   BK7          60° < 82.490380739°  →  透過する
//   SF10         60° < 70.705666054°  →  透過する
//   水（20°C）   60° < 97.174259584°  →  透過する
//   ダイヤモンド 60° > 48.873024788°  →  透過しない（SPEC.md の警告ブロック）

describe('B. 既知値: 頂角 60° ではダイヤモンドだけが透過しない', () => {
  const EXPECTED_AT_60_DEG: readonly [string, number, boolean][] = [
    ['BK7', BK7.catalogNd, true],
    ['SF10', SF10.catalogNd, true],
    ['水', WATER.catalogNd, true],
    ['ダイヤモンド', DIAMOND.catalogNd, false],
  ];

  it.each(EXPECTED_AT_60_DEG)('%s の判定が期待どおりになる', (_name, n, expected) => {
    // Arrange & Act
    const actual = canTransmitThroughPrism(APEX_ANGLE_DEG, n);

    // Assert
    expect(actual).toBe(expected);
  });
});

// ---------------------------------------------------------------------------
// C. 境界: 2·θc の近傍
// ---------------------------------------------------------------------------
//
// 等号ちょうど（A = 2·θc）は 9 桁に丸めた値がどちら側に落ちるか丸め任せになるため、
// 決め打ちのテストは作らない。±0.01° 離した 2 点で切り替わりを確認する。

describe('C. 境界: 2·θc のわずか下では透過し、わずか上では透過しない', () => {
  it.each(DOUBLE_CRITICAL_ANGLE_CASES)(
    '%s は 2·θc のわずか下（-0.01°）で透過する',
    (_name, n, doubleCriticalAngleDeg) => {
      // Arrange
      const apexAngleDeg = doubleCriticalAngleDeg - BOUNDARY_DELTA_DEG;

      // Act
      const actual = canTransmitThroughPrism(apexAngleDeg, n);

      // Assert
      expect(actual).toBe(true);
    }
  );

  it.each(DOUBLE_CRITICAL_ANGLE_CASES)(
    '%s は 2·θc のわずか上（+0.01°）で透過しない',
    (_name, n, doubleCriticalAngleDeg) => {
      // Arrange
      const apexAngleDeg = doubleCriticalAngleDeg + BOUNDARY_DELTA_DEG;

      // Act
      const actual = canTransmitThroughPrism(apexAngleDeg, n);

      // Assert
      expect(actual).toBe(false);
    }
  );
});

// ---------------------------------------------------------------------------
// D. 異常系: 定義域を外れた入力は RangeError
// ---------------------------------------------------------------------------

describe('D. 異常系: canTransmitThroughPrism は頂角が定義域外なら RangeError を投げる', () => {
  const n = BK7.catalogNd;

  it.each([0, -30, 180, 180.1, Number.NaN, Number.POSITIVE_INFINITY])(
    '頂角 %s で RangeError を投げる',
    (invalidApexDeg) => {
      // Arrange & Act & Assert
      expect(() => canTransmitThroughPrism(invalidApexDeg, n)).toThrow(RangeError);
    }
  );
});

describe('D. 異常系: canTransmitThroughPrism は屈折率が定義域外なら RangeError を投げる', () => {
  it.each([0.9, Number.NaN, Number.POSITIVE_INFINITY])(
    '屈折率 %s で RangeError を投げる',
    (invalidN) => {
      // Arrange & Act & Assert
      expect(() => canTransmitThroughPrism(APEX_ANGLE_DEG, invalidN)).toThrow(RangeError);
    }
  );
});

// ---------------------------------------------------------------------------
// E. 整合性: minimumDeviationDeg の可解性と一致する（同一モジュール内の 2 関数）
// ---------------------------------------------------------------------------
//
// 透過条件 A < 2·θc は n·sin(A/2) < 1 と同値である。
//   A < 2·asin(1/n)  ⇔  A/2 < asin(1/n)  ⇔  sin(A/2) < 1/n  ⇔  n·sin(A/2) < 1
// したがって canTransmitThroughPrism が true を返す条件と、
// minimumDeviationDeg が解を返す（例外を投げない）条件は完全に一致しなければならない。

describe('E. 整合性: 透過可否が minimumDeviationDeg の可解性と一致する', () => {
  it.each(DOUBLE_CRITICAL_ANGLE_CASES)(
    '%s は頂角 1〜179° の全域で両者の判定が矛盾しない',
    (_name, n) => {
      // Arrange
      const stepDeg = 0.5;
      const mismatchedApexAnglesDeg: number[] = [];

      // Act
      for (let apexAngleDeg = 1; apexAngleDeg <= 179; apexAngleDeg += stepDeg) {
        const transmits = canTransmitThroughPrism(apexAngleDeg, n);
        if (transmits === minimumDeviationThrows(apexAngleDeg, n)) {
          mismatchedApexAnglesDeg.push(apexAngleDeg);
        }
      }

      // Assert: 透過する頂角では解が求まり、透過しない頂角では必ず例外になる
      expect(mismatchedApexAnglesDeg).toEqual([]);
    }
  );
});

// ===========================================================================
// 6-2. 最小偏角の自動探索（TASKS 6-2・段階1）
// ===========================================================================
//
// 本番は解析式（案X）。黄金分割探索は**このファイルの中だけ**に置き、解析式と
// 突き合わせる独立オラクルとして使う。src に死にコードを置かず、かつ
// 「δ(θ₁) が単峰でその最小が解析式と一致する」ことを数値的にも縛れる。
//
// 期待値の出どころ:
//   θ₁_min = asin(n·sin(A/2))、δ_min = 2·asin(n·sin(A/2)) − A を倍精度で評価した値。
//   θ₁_min の 3 値は tracer.test.ts の SYMMETRIC_CASES（3D 追跡から独立に得た実績値）と
//   桁まで一致する。同じ値へ 2 つの独立な経路から到達することが最大の裏付けなので、
//   その一致自体も A 節で縛る。
//
// 交差検証（E 節）だけは 3D 層（traceRay）と fresnel を参照する。最小偏角という主題は
// prism.ts のものなのでこのファイルに置くが、import が広がるのはそのためである。

/** 角度の許容差 [deg]。asin/sin の往復で下位 1〜2 桁に丸めが残る。 */
const ANGLE_TOLERANCE = 1e-12;

/**
 * 黄金分割探索の許容差 [deg]。
 *
 * **1e-9 度には原理的に届かない。** 最小点の近傍で δ ≈ δ_min + c(θ − θ*)² と平坦なので、
 * 2 点の δ の差が倍精度の分解能（δ_min ≈ 38.6 に対し約 8.6e-15）を下回った時点で
 * 大小比較が丸めに支配され、区間は θ* の周り約 sqrt(eps·δ/c) ≈ 4e-7 度で頭打ちになる。
 * 実測は BK7 3.7e-7 / SF10 3.6e-7 / 水 1.3e-6 度。反復を増やしても改善しない。
 */
const SEARCH_ANGLE_TOLERANCE = 5e-6;

/**
 * 探索で得た δ の許容差 [deg]。
 *
 * θ が 4e-7 度ずれても δ は 2 次でしか動かないため、こちらは 7 桁厳しく縛れる。
 * この 2 つの許容差の差そのものが「最小点の近傍が平坦である」ことの現れである。
 */
const SEARCH_DEVIATION_TOLERANCE = 1e-13;

/** 強度の許容差。フレネルの式を倍精度で評価するだけなので下位 1 桁に収まる。 */
const INTENSITY_TOLERANCE = 1e-12;

/** [材質名, 屈折率, θ₁_min, δ_min]。tracer.test.ts の SYMMETRIC_CASES と同じ入射角。 */
const MINIMUM_DEVIATION_CASES: readonly [string, number, number, number][] = [
  ['水', WATER.catalogNd, 41.812877292, 23.625754584],
  ['BK7', BK7.catalogNd, 49.323347736, 38.646695472],
  ['SF10', SF10.catalogNd, 59.784649106, 59.569298212],
];

/** 9 桁に丸めた期待値と比べるための許容差 [deg]。 */
const NINE_DIGIT_TOLERANCE = 5e-10;

/**
 * プリズムを透過できる入射角の下端 θ_lo。
 *
 * 出射面の内部入射角 r₂ = A − r₁ が臨界角に達する入射角。これより下では
 * どの波長も出射面で全反射するので、δ(θ₁) はそもそも定義されない。
 * θ_lo = asin(n·sin(A − θc))。探索区間の下端の根拠であり、F 節が固定する。
 */
function transmissionLowerBoundDeg(n: number): number {
  return (
    Math.asin(n * Math.sin((APEX_ANGLE_DEG - criticalAngle(n, 1)) * (Math.PI / 180))) *
    (180 / Math.PI)
  );
}

/**
 * 黄金分割探索で δ(θ₁) の最小点を求める（テスト内の独立オラクル）。
 *
 * 本番は解析式なので、これは「探索しても同じ答えになる」ことを確かめるためだけに在る。
 *
 * @param n 屈折率
 * @param iterations 反復回数
 * @returns 最小点の入射角 [deg]
 */
function goldenSectionMinimum(n: number, iterations: number): number {
  const invPhi = (Math.sqrt(5) - 1) / 2;
  // 下端ちょうどは全反射域なので、わずかに内側から始める
  let a = transmissionLowerBoundDeg(n) + 1e-6;
  let b = 89.999999;

  for (let index = 0; index < iterations; index += 1) {
    const c = b - (b - a) * invPhi;
    const d = a + (b - a) * invPhi;

    if (prismDeviationDeg(APEX_ANGLE_DEG, c, n) < prismDeviationDeg(APEX_ANGLE_DEG, d, n)) {
      b = d;
    } else {
      a = c;
    }
  }

  return (a + b) / 2;
}

/** スカラー層で組み立てた透過率 T = (1 − R_entry)(1 − R_exit)。 */
function transmittance(incidenceDeg: number, n: number): number {
  const firstRefractionDeg = refractionAngleDeg(1, n, incidenceDeg);
  const secondIncidenceDeg = APEX_ANGLE_DEG - firstRefractionDeg;

  return (
    (1 - reflectance(1, n, incidenceDeg)) * (1 - reflectance(n, 1, secondIncidenceDeg))
  );
}

/** 3D 追跡（traceRay）で得た射出区間の強度。射出しなければ NaN。 */
function tracedExitIntensity(incidenceDeg: number, n: number): number {
  const directionRad = ((incidenceDeg - 30) * Math.PI) / 180;
  const direction = vec3(Math.cos(directionRad), Math.sin(directionRad), 0);
  const entry = vec3(-0.5, 0.288675134594813, 0);
  const path = traceRay(
    ray(addScaled(entry, direction, -3), direction),
    createTriangularPrism(2, 2),
    n,
    587.56
  );
  const last = path.segments[path.segments.length - 1];

  return path.termination === 'exited' ? (last?.intensity ?? Number.NaN) : Number.NaN;
}

// ---------------------------------------------------------------------------
// 6-2 A. minimumDeviationIncidenceDeg: θ₁_min
// ---------------------------------------------------------------------------

describe('6-2 A. minimumDeviationIncidenceDeg: 最小偏角となる入射角', () => {
  it.each(MINIMUM_DEVIATION_CASES)(
    '%s: θ₁_min が確定値と一致し、3D 追跡側の対称入射角と同じ値になる',
    (_name, n, expectedIncidenceDeg) => {
      // Arrange & Act
      const actual = minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, n);

      // Assert: この 9 桁値は tracer.test.ts の SYMMETRIC_CASES と同一。
      // スカラー層の解析式と 3D 追跡が独立に同じ角へ到達することがこの節の主張
      expect(Math.abs(actual - expectedIncidenceDeg)).toBeLessThanOrEqual(NINE_DIGIT_TOLERANCE);
    }
  );

  it.each(MINIMUM_DEVIATION_CASES)(
    '%s: θ₁_min では第一面の屈折角がちょうど A/2 になる（対称通過）',
    (_name, n) => {
      // Arrange
      const incidenceDeg = minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, n);

      // Act: r₁ = A/2 なら幾何関係 r₂ = A − r₁ から r₂ も A/2 になる
      const firstRefractionDeg = refractionAngleDeg(1, n, incidenceDeg);

      // Assert
      expect(Math.abs(firstRefractionDeg - APEX_ANGLE_DEG / 2)).toBeLessThanOrEqual(
        ANGLE_TOLERANCE
      );
    }
  );

  it.each(MINIMUM_DEVIATION_CASES)(
    '%s: θ₁_min での偏角が minimumDeviationDeg と一致する',
    (_name, n) => {
      // Arrange
      const incidenceDeg = minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, n);

      // Act
      const actual = prismDeviationDeg(APEX_ANGLE_DEG, incidenceDeg, n);

      // Assert（2 つの関数が同じ配置を指していること）
      expect(Math.abs(actual - minimumDeviationDeg(APEX_ANGLE_DEG, n))).toBeLessThanOrEqual(
        ANGLE_TOLERANCE
      );
    }
  );

  it('ダイヤモンドは頂角 60° で解が無く RangeError を投げる', () => {
    // Arrange: n·sin(A/2) = 1.2086 >= 1。minimumDeviationDeg と同じ流儀で落とす
    // Act & Assert
    expect(() => minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, DIAMOND.catalogNd)).toThrow(
      RangeError
    );
  });

  it('頂角が定義域外なら RangeError を投げる', () => {
    // Arrange & Act & Assert
    expect(() => minimumDeviationIncidenceDeg(0, BK7.catalogNd)).toThrow(RangeError);
    expect(() => minimumDeviationIncidenceDeg(180, BK7.catalogNd)).toThrow(RangeError);
  });

  it('屈折率が定義域外なら RangeError を投げる', () => {
    // Arrange & Act & Assert
    expect(() => minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, 0.9)).toThrow(RangeError);
    expect(() => minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, Number.NaN)).toThrow(RangeError);
  });
});

// ---------------------------------------------------------------------------
// 6-2 B. minimumDeviation: UI の入口
// ---------------------------------------------------------------------------

describe('6-2 B. minimumDeviation: 解が無ければ null を返す入口', () => {
  it.each(MINIMUM_DEVIATION_CASES)(
    '%s: 2 つの値が個別の関数の結果と厳密に一致する',
    (_name, n) => {
      // Arrange & Act
      const actual = minimumDeviation(APEX_ANGLE_DEG, n);

      // Assert（束ねるだけで、独自の計算を持たないこと）
      expect(actual).not.toBeNull();
      expect(actual?.incidenceAngleDeg).toBe(minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, n));
      expect(actual?.deviationDeg).toBe(minimumDeviationDeg(APEX_ANGLE_DEG, n));
    }
  );

  it('ダイヤモンドでは null を返す（例外を投げない）', () => {
    // Arrange: 材質セレクトで選べる以上、解が無いのは規約違反ではなくふつうの状態
    // Act
    const actual = minimumDeviation(APEX_ANGLE_DEG, DIAMOND.catalogNd);

    // Assert
    expect(actual).toBeNull();
  });

  it('定義域違反は null ではなく RangeError で落とす', () => {
    // Arrange: 「解が無い」と「呼び方が間違っている」を同じ返り値に潰さない
    // Act & Assert
    expect(() => minimumDeviation(0, BK7.catalogNd)).toThrow(RangeError);
    expect(() => minimumDeviation(APEX_ANGLE_DEG, 0.9)).toThrow(RangeError);
  });

  it('null になる条件が canTransmitThroughPrism の否定と全点で一致する', () => {
    // Arrange: 判定元が二重化していれば、どこかで食い違う
    const mismatches: string[] = [];

    // Act: 1.0 から 4.0 まで 0.001 刻み（境界 2·θc = 60° は n = 2 の近傍にある）
    for (let index = 0; index <= 3000; index += 1) {
      const n = 1 + index * 0.001;
      const hasSolution = minimumDeviation(APEX_ANGLE_DEG, n) !== null;

      if (hasSolution !== canTransmitThroughPrism(APEX_ANGLE_DEG, n)) {
        mismatches.push(`n=${n}: minimumDeviation=${hasSolution}`);
      }
    }

    // Assert
    expect(mismatches).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 6-2 C. 黄金分割探索との突き合わせ
// ---------------------------------------------------------------------------

describe('6-2 C. 数値探索が解析式と同じ最小点に到達する', () => {
  it.each(MINIMUM_DEVIATION_CASES)(
    '%s: 黄金分割探索の解が θ₁_min と一致する',
    (_name, n) => {
      // Arrange & Act
      const found = goldenSectionMinimum(n, 200);

      // Assert（許容差 5e-6 度の根拠は SEARCH_ANGLE_TOLERANCE の注記）
      expect(
        Math.abs(found - minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, n))
      ).toBeLessThanOrEqual(SEARCH_ANGLE_TOLERANCE);
    }
  );

  it.each(MINIMUM_DEVIATION_CASES)(
    '%s: 探索点での偏角が δ_min と 7 桁厳しく一致する（最小点が平坦だから）',
    (_name, n) => {
      // Arrange
      const found = goldenSectionMinimum(n, 200);

      // Act
      const foundDeviationDeg = prismDeviationDeg(APEX_ANGLE_DEG, found, n);

      // Assert: 比較先は UI が受け取る値そのもの（minimumDeviation の返り値）
      expect(
        Math.abs(foundDeviationDeg - (minimumDeviation(APEX_ANGLE_DEG, n)?.deviationDeg ?? Number.NaN))
      ).toBeLessThanOrEqual(SEARCH_DEVIATION_TOLERANCE);
    }
  );

  it.each(MINIMUM_DEVIATION_CASES)('%s: δ は θ₁_min の左で単調減少する', (_name, n) => {
    // Arrange: 単峰であることが黄金分割探索の前提。前提そのものを縛る
    const incidenceDeg = minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, n);
    const lower = transmissionLowerBoundDeg(n) + 0.01;
    const violations: string[] = [];
    let previous = Number.POSITIVE_INFINITY;

    // Act
    for (let index = 0; index <= 100; index += 1) {
      const deg = lower + ((incidenceDeg - lower) * index) / 100;
      const current = prismDeviationDeg(APEX_ANGLE_DEG, deg, n);

      if (!(current <= previous)) {
        violations.push(`${deg}度: ${current} > ${previous}`);
      }
      previous = current;
    }

    // Assert
    expect(violations).toEqual([]);
  });

  it.each(MINIMUM_DEVIATION_CASES)('%s: δ は θ₁_min の右で単調増加する', (_name, n) => {
    // Arrange
    const incidenceDeg = minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, n);
    const violations: string[] = [];
    let previous = Number.NEGATIVE_INFINITY;

    // Act
    for (let index = 0; index <= 100; index += 1) {
      const deg = incidenceDeg + ((89.9 - incidenceDeg) * index) / 100;
      const current = prismDeviationDeg(APEX_ANGLE_DEG, deg, n);

      if (!(current >= previous)) {
        violations.push(`${deg}度: ${current} < ${previous}`);
      }
      previous = current;
    }

    // Assert
    expect(violations).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 6-2 D. 逆算オラクル
// ---------------------------------------------------------------------------

describe('6-2 D. δ_min から屈折率を逆算すると材質定数に戻る', () => {
  it.each(MINIMUM_DEVIATION_CASES)('%s: n = sin((A+δ_min)/2)/sin(A/2)', (_name, n) => {
    // Arrange: 教科書の最小偏角法そのもの。δ_min を測れば n が求まる
    const result = minimumDeviation(APEX_ANGLE_DEG, n);
    const radPerDeg = Math.PI / 180;

    // Act
    const recovered =
      Math.sin(((APEX_ANGLE_DEG + (result?.deviationDeg ?? Number.NaN)) / 2) * radPerDeg) /
      Math.sin((APEX_ANGLE_DEG / 2) * radPerDeg);

    // Assert
    expect(Math.abs(recovered - n)).toBeLessThanOrEqual(ANGLE_TOLERANCE);
  });
});

// ---------------------------------------------------------------------------
// 6-2 E-1. 交差検証: 対称通過では両界面の反射率が等しい
// ---------------------------------------------------------------------------

describe('6-2 E-1. θ₁_min では射出強度が入射面透過率の 2 乗になる', () => {
  it.each(MINIMUM_DEVIATION_CASES)(
    '%s: スカラー層で R_exit が R_entry と一致する',
    (_name, n) => {
      // Arrange: 対称通過では θ₁ = θ₂ かつ r₁ = r₂ なので、可逆性から両界面の R が等しい
      const incidenceDeg = minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, n);
      const secondIncidenceDeg =
        APEX_ANGLE_DEG - refractionAngleDeg(1, n, incidenceDeg);

      // Act
      const entryReflectance = reflectance(1, n, incidenceDeg);
      const exitReflectance = reflectance(n, 1, secondIncidenceDeg);

      // Assert
      expect(Math.abs(exitReflectance - entryReflectance)).toBeLessThanOrEqual(
        INTENSITY_TOLERANCE
      );
    }
  );

  it.each(MINIMUM_DEVIATION_CASES)(
    '%s: 3D 追跡の射出強度が (1 − R_entry)² と一致する（6-5a / 6-5b と交差）',
    (_name, n) => {
      // Arrange: 対称通過でしか成り立たない。6-2 の θ₁_min・6-5a の透過減衰・
      // 6-5b の R_entry が同時に正しいときだけ通る
      const incidenceDeg = minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, n);
      const entryReflectance = reflectance(1, n, incidenceDeg);

      // Act
      const exitIntensity = tracedExitIntensity(incidenceDeg, n);

      // Assert
      expect(Math.abs(exitIntensity - (1 - entryReflectance) ** 2)).toBeLessThanOrEqual(
        INTENSITY_TOLERANCE
      );
    }
  );
});

// ---------------------------------------------------------------------------
// 6-2 E-2. 交差検証: 透過率は θ₁_min で停留する
// ---------------------------------------------------------------------------
//
// δ = θ₁ + θ₂ − A なので最小偏角では dθ₂/dθ₁ = −1。可逆性から出射面の反射率も
// 同じ関数 R で書けるので、T = (1−R(θ₁))(1−R(θ₂)) を微分すると
//   dT/dθ₁ = −R'(θ₁)(1−R(θ₂)) + (1−R(θ₁))R'(θ₂)
// となり、θ₁ = θ₂ で 2 項が打ち消して厳密に 0 になる。
// **透過率の極大は最小偏角と厳密に一致する。**

describe('6-2 E-2. 透過率の極大が最小偏角と一致する', () => {
  /** 中心差分の刻み [deg]。打ち切り誤差 O(h²) と丸めの釣り合いから選んだ。 */
  const DERIVATIVE_STEP_DEG = 1e-4;

  /** 数値微分の許容差。実測は 3 材質とも 5.6e-13（倍精度の丸め床）。 */
  const DERIVATIVE_TOLERANCE = 1e-12;

  it.each(MINIMUM_DEVIATION_CASES)('%s: θ₁_min で dT/dθ₁ が 0 になる', (_name, n) => {
    // Arrange
    const incidenceDeg = minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, n);

    // Act: 中心差分
    const derivative =
      (transmittance(incidenceDeg + DERIVATIVE_STEP_DEG, n) -
        transmittance(incidenceDeg - DERIVATIVE_STEP_DEG, n)) /
      (2 * DERIVATIVE_STEP_DEG);

    // Assert
    expect(Math.abs(derivative)).toBeLessThanOrEqual(DERIVATIVE_TOLERANCE);
  });

  it('BK7 の細かい掃引で透過率が最大になる点が θ₁_min そのものになる', () => {
    // Arrange: θ₁_min ± 0.6 度を 0.001 度刻み（1201 点）。停留するだけでなく
    // 極大であること（極小や鞍点でないこと）をここで押さえる
    const n = BK7.catalogNd;
    const incidenceDeg = minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, n);
    let best = Number.NEGATIVE_INFINITY;
    let bestAt = Number.NaN;

    // Act
    for (let step = -600; step <= 600; step += 1) {
      const deg = incidenceDeg + step * 0.001;
      const current = transmittance(deg, n);

      if (current > best) {
        best = current;
        bestAt = deg;
      }
    }

    // Assert（格子点のひとつが θ₁_min そのものなので厳密比較でよい）
    expect(bestAt).toBe(incidenceDeg);
  });
});

// ---------------------------------------------------------------------------
// 6-2 F. 定義域: 探索区間の下端
// ---------------------------------------------------------------------------

describe('6-2 F. θ_lo より下では偏角が定義されない', () => {
  it.each(MINIMUM_DEVIATION_CASES)(
    '%s: θ_lo ちょうどでは出射面が全反射して RangeError になる',
    (_name, n) => {
      // Arrange: r₂ が臨界角ちょうど。fresnel の「θ >= θc は全反射」規約に従う
      const lowerBoundDeg = transmissionLowerBoundDeg(n);

      // Act & Assert: 下端は定義域の外、θ₁_min は内。探索区間の両側を 1 つの観点で押さえる
      expect(() => prismDeviationDeg(APEX_ANGLE_DEG, lowerBoundDeg, n)).toThrow(RangeError);
      expect(() =>
        prismDeviationDeg(APEX_ANGLE_DEG, minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, n), n)
      ).not.toThrow();
    }
  );

  it.each(MINIMUM_DEVIATION_CASES)('%s: θ_lo のわずか上では偏角が求まる', (_name, n) => {
    // Arrange
    const lowerBoundDeg = transmissionLowerBoundDeg(n);

    // Act
    const actual = prismDeviationDeg(APEX_ANGLE_DEG, lowerBoundDeg + 1e-6, n);

    // Assert（探索区間 [θ_lo + ε, 90°] の下端がここで確定する）。
    // 下端の δ が δ_min より大きいことまで言えて初めて「区間の内部に最小がある」と言える
    expect(Number.isFinite(actual)).toBe(true);
    expect(actual).toBeGreaterThan(minimumDeviationDeg(APEX_ANGLE_DEG, n));
    expect(lowerBoundDeg).toBeLessThan(minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, n));
  });

  it.each(MINIMUM_DEVIATION_CASES)('%s: θ_lo は θ₁_min より小さい', (_name, n) => {
    // Arrange & Act & Assert（最小点が探索区間の内部にあること）
    expect(transmissionLowerBoundDeg(n)).toBeLessThan(
      minimumDeviationIncidenceDeg(APEX_ANGLE_DEG, n)
    );
  });
});
