import { describe, expect, it } from 'vitest';

import { APEX_ANGLE_DEG, BK7, DIAMOND, SF10, WATER } from '../../src/optics/constants';
import { canTransmit } from '../../src/optics/fresnel';
// NOTE: prism.ts は未実装。TDD の Red フェーズのため、この import は解決しない。
import { minimumDeviationDeg, prismDeviationDeg } from '../../src/optics/prism';
import { refractionAngleDeg } from '../../src/optics/refraction';

/**
 * src/optics/prism.ts の受け入れ条件（プリズムの偏角）。
 *
 * 対象:
 *   prismDeviationDeg(apexAngleDeg, incidenceAngleDeg, n) — 総偏角 δ [deg]
 *   minimumDeviationDeg(apexAngleDeg, n)                  — 最小偏角 δ_min [deg]
 *
 * 物理:
 *   入射面で air→glass 屈折 → 幾何関係 r₂ = A - r₁ → 出射面で glass→air 屈折
 *   δ = θ₁ + θ₂ - A
 *   δ_min = 2·asin(n·sin(A/2)) - A（対称通過 r₁ = r₂ = A/2 のとき）
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
