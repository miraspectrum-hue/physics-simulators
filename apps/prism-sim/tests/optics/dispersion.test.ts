import { describe, expect, it } from 'vitest';

import {
  ALL_MATERIALS,
  BK7,
  LINE_C_NM,
  LINE_D_NM,
  LINE_F_NM,
} from '../../src/optics/constants';
import type { PrismMaterial } from '../../src/types/optics';
import { exaggerateIndex, refractiveIndex } from '../../src/optics/dispersion';

/**
 * src/optics/dispersion.ts の受け入れ条件。
 *
 * 対象: refractiveIndex(material, wavelengthNm) — Cauchy の 2 項式
 *       n(λ) = A + B/λ²（λ は µm。引数は nm で受け、内部で変換する）
 *
 * 設計判断: refractiveIndex は可視域（WAVELENGTH_MIN/MAX_NM）の検証をしない純粋な数学関数とし、
 *           可視域チェックは上位層（spectrum.ts や呼び出し側）の責務とする。
 *
 * 期待値の出典は SPEC.md「光学モデル（計算仕様）> 屈折率」および
 * 各材質のカタログ（constants.ts のコメント参照）。
 * すべて Sellmeier 式による独立計算で裏取り済みの具体値を用いる。
 */

// テストパラメータ: [表示名, 材質] の形で it.each に渡す。
// 第 1 要素を文字列にしておくと、テスト名の %s で材質名がそのまま出る。
const MATERIAL_CASES: readonly [string, PrismMaterial][] = ALL_MATERIALS.map(
  (m): [string, PrismMaterial] => [m.name, m]
);

// ---------------------------------------------------------------------------
// 受け入れ条件 1: 単調性（正常分散）
// ---------------------------------------------------------------------------

describe('単調性: 短波長ほど屈折率が大きい（正常分散）', () => {
  it.each(MATERIAL_CASES)('%s は n(400nm) > n(700nm) を満たす', (_name, material) => {
    // Arrange
    const shortWavelengthNm = 400;
    const longWavelengthNm = 700;

    // Act
    const nShort = refractiveIndex(material, shortWavelengthNm);
    const nLong = refractiveIndex(material, longWavelengthNm);

    // Assert
    expect(nShort).toBeGreaterThan(nLong);
  });
});

// ---------------------------------------------------------------------------
// 受け入れ条件 2: n_d 一致
// ---------------------------------------------------------------------------
//
// 期待値（カタログ n_d、λ_d = 587.56nm のヘリウム d 線）:
//   BK7          1.51680  — SCHOTT N-BK7 データシート
//   SF10         1.72828  — SCHOTT SF10 データシート
//   水（20°C）   1.33340  — Daimon & Masumura, Appl. Opt. 46 (2007) 20.0°C
//   ダイヤモンド 2.41730  — Phillip & Taft (1964)
//
// 許容差 ±0.001 は SPEC.md「検証に使う既知値」で定めた値。
// NOTE: toBeCloseTo(x, 3) は「小数 3 桁一致」ではなく |差| < 0.5e-3 = 0.0005 を意味し、
//       仕様の ±0.001 より 2 倍厳しい。基準を二重化させないため使わず、絶対差で 1 本に統一する。

const ND_TOLERANCE = 0.001;

describe('n_d 一致: λ_d=587.56nm の屈折率がカタログ値と ±0.001 で一致する', () => {
  it.each(MATERIAL_CASES)(
    '%s の n(587.56nm) はカタログ n_d と一致する',
    (_name, material) => {
      // Arrange
      const expectedNd = material.catalogNd;

      // Act
      const actualNd = refractiveIndex(material, LINE_D_NM);

      // Assert
      expect(Math.abs(actualNd - expectedNd)).toBeLessThanOrEqual(ND_TOLERANCE);
    }
  );
});

// ---------------------------------------------------------------------------
// 受け入れ条件 3: アッベ数
// ---------------------------------------------------------------------------
//
//   v_d = (n_d - 1) / (n_F - n_C)
//   λ_F = 486.13nm（水素 F 線） / λ_C = 656.27nm（水素 C 線）
//
// 期待値（カタログ v_d）:
//   BK7          64.17
//   SF10         28.41
//   水（20°C）   55.7
//   ダイヤモンド 55.3
//
// 許容差 ±1.0 は SPEC.md「検証に使う既知値」で定めた値。
// Cauchy 2 項式は Sellmeier の近似であるため、この程度の差は原理的に残る。

const ABBE_TOLERANCE = 1.0;

describe('アッベ数: (n_d-1)/(n_F-n_C) がカタログ値と ±1.0 で一致する', () => {
  it.each(MATERIAL_CASES)('%s のアッベ数はカタログ v_d と一致する', (_name, material) => {
    // Arrange
    const expectedAbbe = material.catalogAbbe;

    // Act
    const nd = refractiveIndex(material, LINE_D_NM);
    const nF = refractiveIndex(material, LINE_F_NM);
    const nC = refractiveIndex(material, LINE_C_NM);
    const actualAbbe = (nd - 1) / (nF - nC);

    // Assert
    expect(Math.abs(actualAbbe - expectedAbbe)).toBeLessThanOrEqual(ABBE_TOLERANCE);
  });
});

// ---------------------------------------------------------------------------
// 受け入れ条件 4: 不正入力
// ---------------------------------------------------------------------------
//
// 振る舞いの定義:
//   波長が「正の有限数」でない場合、refractiveIndex は RangeError を投げる。
//   （黙って NaN / Infinity を返さない。NaN は光路計算まで伝播すると
//     原因追跡が困難になるため、発生源で落とす）

describe('不正入力: 波長が正の有限数でなければ RangeError を投げる', () => {
  // 不正入力の扱いは材質に依存しないため、代表として BK7 で検証する
  const material = BK7;

  it('波長 0 で RangeError を投げる', () => {
    // Arrange
    const invalidWavelengthNm = 0;

    // Act & Assert
    expect(() => refractiveIndex(material, invalidWavelengthNm)).toThrow(RangeError);
  });

  it('負の波長で RangeError を投げる', () => {
    // Arrange
    const invalidWavelengthNm = -550;

    // Act & Assert
    expect(() => refractiveIndex(material, invalidWavelengthNm)).toThrow(RangeError);
  });

  it('NaN で RangeError を投げる', () => {
    // Arrange
    const invalidWavelengthNm = Number.NaN;

    // Act & Assert
    expect(() => refractiveIndex(material, invalidWavelengthNm)).toThrow(RangeError);
  });

  it('Infinity で RangeError を投げる', () => {
    // Arrange
    const invalidWavelengthNm = Number.POSITIVE_INFINITY;

    // Act & Assert
    expect(() => refractiveIndex(material, invalidWavelengthNm)).toThrow(RangeError);
  });

  it('-Infinity で RangeError を投げる', () => {
    // Arrange
    const invalidWavelengthNm = Number.NEGATIVE_INFINITY;

    // Act & Assert
    expect(() => refractiveIndex(material, invalidWavelengthNm)).toThrow(RangeError);
  });

  it('正の有限な波長では例外を投げない', () => {
    // Arrange
    const validWavelengthNm = LINE_D_NM;

    // Act & Assert
    expect(() => refractiveIndex(material, validWavelengthNm)).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// 受け入れ条件 5: 分散誇張 exaggerateIndex（1-2-1b / F-23）
// ---------------------------------------------------------------------------
//
// n'(λ) = n_d + factor × (n(λ) - n_d)
//
// 期待値は Float32/丸めの議論を避けるため、2 進で厳密に表現できる値
// （整数・0.25・0.125 など）だけを使う。実屈折率での恒等性は Cauchy 値で確認する。

describe('exaggerateIndex: factor=1 は実屈折率を厳密にそのまま返す', () => {
  it('任意の n_d に対して nLambda を返す（丸めを混入させない）', () => {
    // Arrange: 実在しうる Cauchy 屈折率（BK7 の n(587.56)）
    const nLambda = 1.516765916911719;
    const nD = 1.5168;

    // Act
    const actual = exaggerateIndex(nLambda, nD, 1);

    // Assert: closeTo ではなく厳密一致。factor=1 は物理そのものなので丸めが乗ってはならない
    expect(actual).toBe(nLambda);
  });

  it('ピボット n_d と異なる値でも nLambda をそのまま返す', () => {
    // Arrange
    const nLambda = 1.72827;
    const nD = 1.5;

    // Act & Assert
    expect(exaggerateIndex(nLambda, nD, 1)).toBe(nLambda);
  });
});

describe('exaggerateIndex: factor>1 は n_d からの隔たりを factor 倍する', () => {
  it('ピボットより上の屈折率を既知の値へ広げる', () => {
    // Arrange: 1.25 + 2×(1.5 - 1.25) = 1.75（すべて 2 進で厳密）
    // Act & Assert
    expect(exaggerateIndex(1.5, 1.25, 2)).toBe(1.75);
  });

  it('ピボットより下の屈折率も対称に広げる', () => {
    // Arrange: 1.5 + 2×(1.25 - 1.5) = 1.0
    // Act & Assert
    expect(exaggerateIndex(1.25, 1.5, 2)).toBe(1.0);
  });

  it('2 波長の屈折率差はちょうど factor 倍になる（ピボットに依らない）', () => {
    // Arrange: (a-nD)·f - (b-nD)·f = f·(a-b)。nD を変えても差は不変
    const a = 1.5;
    const b = 1.25;
    const factor = 4;

    // Act
    const gap = exaggerateIndex(a, 1.375, factor) - exaggerateIndex(b, 1.375, factor);

    // Assert: 4 × (1.5 - 1.25) = 1.0
    expect(gap).toBe(1.0);
  });
});

describe('exaggerateIndex: 誇張倍率が 1 以上の有限数でなければ RangeError を投げる', () => {
  // 誇張倍率は「隔たりを広げる」意味しか持たないため、1 未満（圧縮・反転）は弾く。
  // 実屈折率はこの関数内では信頼できる入力（refractiveIndex が検証済み）なので factor のみ検証する。
  it.each([0.5, 0, -1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    '誇張倍率 %p で RangeError を投げる',
    (invalidFactor) => {
      // Act & Assert
      expect(() => exaggerateIndex(1.52, 1.5, invalidFactor)).toThrow(RangeError);
    }
  );

  it('誇張倍率 1（下限）では例外を投げない', () => {
    // Act & Assert
    expect(() => exaggerateIndex(1.52, 1.5, 1)).not.toThrow();
  });

  it('誇張倍率 10（UI 上限）でも例外を投げない', () => {
    // Act & Assert
    expect(() => exaggerateIndex(1.52, 1.5, 10)).not.toThrow();
  });
});
