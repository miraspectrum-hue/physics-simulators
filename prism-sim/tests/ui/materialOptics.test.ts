import { describe, expect, it } from 'vitest';

import type { MaterialName } from '../../src/types/optics';
import { isNoDispersionMaterial, minimumDeviationOf } from '../../src/ui/materialOptics';

/**
 * src/ui/materialOptics.ts の受け入れ条件（材質名 → 最小偏角の写像）。
 *
 * 対象:
 *   minimumDeviationOf(material)   — 材質名 → { θ₁_min, δ_min }、透過不能なら null
 *   isNoDispersionMaterial(material) — 材質名 → 直接透過しないか
 *
 * 何を守るためのテストか:
 *   この写像は「表示される δ_min」と「ボタンが飛ばす入射角」の**唯一の入口**である。
 *   途中で使う屈折率をカタログ値 catalogNd から別のもの（たとえば Cauchy 式の n(λ_d)）へ
 *   差し替えると、値がわずかに動くだけでコンパイルも既存テストも通ってしまう。
 *   ここで材質 → n → (θ₁_min, δ_min, 判定) の対応を数値で釘打ちし、
 *   入口の屈折率に手が入った瞬間に落ちるようにする。
 *
 * 期待値の出典:
 *   解析式 θ₁_min = asin(n_d·sin(A/2))、δ_min = 2·θ₁_min − A を頂角 60° と
 *   constants.ts のカタログ n_d で倍精度評価した値（12 桁でハードコード）。
 *   6-2 段階2 で prism.ts 側の A 節・B 節が独立に裏取り済みの数値と同一である。
 *   ダイヤモンドは n_d·sin(30°) = 1.20865 >= 1 なので解なし（SPEC.md「ダイヤの全反射」）。
 */

/** 許容差 [deg]。期待値は 12 桁のハードコードなので、丸めの余地は 1e-12 程度しかない。 */
const ANGLE_TOLERANCE_DEG = 1e-9;

/** 材質 → (θ₁_min, δ_min)。解なしの材質は null。 */
const EXPECTED: ReadonlyArray<
  readonly [MaterialName, { readonly incidenceAngleDeg: number; readonly deviationDeg: number } | null]
> = [
  ['BK7', { incidenceAngleDeg: 49.323347736250, deviationDeg: 38.646695472500 }],
  ['SF10', { incidenceAngleDeg: 59.784649106188, deviationDeg: 59.569298212376 }],
  ['ダイヤモンド', null],
];

describe('6-2 単一入口: minimumDeviationOf の材質 → 最小偏角の写像', () => {
  it('材質ごとに θ₁_min・δ_min・無分散判定が確定値どおりである', () => {
    // Arrange: 期待値は上の表（頂角 60° とカタログ n_d からの解析解）

    // Act & Assert
    for (const [material, expected] of EXPECTED) {
      const actual = minimumDeviationOf(material);

      if (expected === null) {
        expect(actual, `${material} は解なし`).toBeNull();
        expect(isNoDispersionMaterial(material), `${material} は無分散`).toBe(true);
        continue;
      }

      expect(actual, `${material} は解あり`).not.toBeNull();
      expect(actual?.incidenceAngleDeg, `${material} の θ₁_min`).toBeCloseTo(
        expected.incidenceAngleDeg,
        -Math.log10(ANGLE_TOLERANCE_DEG)
      );
      expect(actual?.deviationDeg, `${material} の δ_min`).toBeCloseTo(
        expected.deviationDeg,
        -Math.log10(ANGLE_TOLERANCE_DEG)
      );
      // 解が出る材質では警告もボタンの無効化も出ない。判定元がひとつであることの表れ
      expect(isNoDispersionMaterial(material), `${material} は無分散でない`).toBe(false);
    }
  });
});
