import { describe, expect, it } from 'vitest';

import { ALL_MATERIALS, MATERIALS } from '../../src/optics/constants';
import type { MaterialName } from '../../src/types/optics';

/**
 * src/optics/constants.ts の材質レコードの受け入れ条件（TASKS 2-8）。
 *
 * 対象:
 *   MATERIALS      — MaterialName → PrismMaterial のレコード
 *   ALL_MATERIALS  — MATERIALS から導出した並び
 *
 * 設計判断:
 *   - `Record<MaterialName, PrismMaterial>` と型付けることで、材質を足したときの
 *     登録漏れをコンパイラが捕まえる。`PrismMaterial.name` も `MaterialName` なので、
 *     ユニオンへの追記も同時に強制される（1-1-1c で保留した穴を塞ぐ）。
 *   - `ALL_MATERIALS` は手書きの列挙をやめて `Object.values` で導出する。
 *     UI のセレクトはこれを回すので、追記漏れがそのまま「UI に出ない」に直結していた。
 *
 * ここはロジックではなく実データの検証なので、値の出所は既存の材質定数のままである
 * （CLAUDE.md「材質定数を出典・検証なしに書き換えることの禁止」）。
 */

/** 期待する材質名の全て。ユニオンに足したらここも足す必要がある。 */
const EXPECTED_NAMES: readonly MaterialName[] = ['BK7', 'SF10', '水', 'ダイヤモンド'];

// ---------------------------------------------------------------------------
// M-1. レコードの完全性
// ---------------------------------------------------------------------------

describe('M-1. MATERIALS: 全ての MaterialName から材質を引ける', () => {
  it('4 材質すべてが登録されている', () => {
    // Arrange & Act & Assert
    expect(Object.keys(MATERIALS)).toEqual([...EXPECTED_NAMES]);
  });

  it.each(EXPECTED_NAMES)('材質名 %s から材質定数が引ける', (name) => {
    // Act
    const material = MATERIALS[name];

    // Assert
    expect(material).toBeDefined();
    expect(Number.isFinite(material.catalogNd)).toBe(true);
  });

  it('レコードのキーと材質の name が一致する', () => {
    // Arrange: キーと name がずれると、UI の選択値から材質を引けなくなる
    // Act & Assert
    for (const name of EXPECTED_NAMES) {
      expect(MATERIALS[name].name).toBe(name);
    }
  });
});

// ---------------------------------------------------------------------------
// M-2. ALL_MATERIALS の導出
// ---------------------------------------------------------------------------

describe('M-2. ALL_MATERIALS: レコードから導出される', () => {
  it('Object.values(MATERIALS) と一致する', () => {
    // Arrange & Act & Assert: 手書きの列挙ではないことを固定する
    expect(ALL_MATERIALS).toEqual(Object.values(MATERIALS));
  });

  it('材質の本数がレコードのキー数と一致する', () => {
    // Arrange & Act & Assert
    expect(ALL_MATERIALS.length).toBe(Object.keys(MATERIALS).length);
    expect(ALL_MATERIALS.length).toBe(4);
  });

  it('UI のセレクトに出す順序が保たれる', () => {
    // Arrange: 既定 → 分散大 → 分散小 → デモ用（SPEC.md「材質の切替」）
    // Act
    const actual = ALL_MATERIALS.map((material) => material.name);

    // Assert
    expect(actual).toEqual(['BK7', 'SF10', '水', 'ダイヤモンド']);
  });
});
