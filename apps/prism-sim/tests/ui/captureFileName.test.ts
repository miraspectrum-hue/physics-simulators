import { describe, expect, it } from 'vitest';

import { captureFileName } from '../../src/ui/captureFileName';

/**
 * src/ui/captureFileName.ts の受け入れ条件（状態 → 書き出しファイル名。TASKS 6-6 段階5）。
 *
 * 対象:
 *   captureFileName({ material, sourceAngleDeg }) — 保存する PNG のファイル名
 *
 * 何を守るためのテストか:
 *   ファイル名は**書き出しの中で唯一 WebGL に依存しない部分**である。キャプチャ本体は
 *   実 WebGL が要るので Vitest では触れないが、名前だけは純粋関数として切り出せる。
 *   守りたいのは 3 つ。
 *     - 材質名に日本語（`水` / `ダイヤモンド`）がそのまま出ないこと。OS とブラウザを
 *       またぐと文字化けや percent-encoding で読めない名前になる
 *     - 角度が桁あふれしないこと（49.323347736250 をそのまま名前にしない）
 *     - 記号がファイル名に使える集合に収まること（負号・小数点の扱い）
 *
 * 期待値の出典:
 *   仕様として本テストで定める文字列そのもの（オラクルは実装から独立に、
 *   ここへ具体値でハードコードする）。
 */

/** ファイル名に許す文字。英小文字・数字・ハイフン・ピリオドだけ。 */
const SAFE_NAME = /^[a-z0-9.-]+$/;

describe('6-6 段階5: captureFileName の状態 → ファイル名', () => {
  it('材質コードと角度から prism-<材質>-<角度>deg.png を作る', () => {
    // Arrange
    const state = { material: 'SF10', sourceAngleDeg: 70 } as const;

    // Act
    const actual = captureFileName(state);

    // Assert
    expect(actual).toBe('prism-sf10-70deg.png');
  });

  it('BK7 の材質コードは bk7 である', () => {
    // Arrange
    const state = { material: 'BK7', sourceAngleDeg: 70 } as const;

    // Act
    const actual = captureFileName(state);

    // Assert
    expect(actual).toBe('prism-bk7-70deg.png');
  });

  it('日本語の材質名 `水` は英字コード water に置き換わる', () => {
    // Arrange
    const state = { material: '水', sourceAngleDeg: 30 } as const;

    // Act
    const actual = captureFileName(state);

    // Assert
    expect(actual).toBe('prism-water-30deg.png');
  });

  it('日本語の材質名 `ダイヤモンド` は英字コード diamond に置き換わる', () => {
    // Arrange
    const state = { material: 'ダイヤモンド', sourceAngleDeg: 30 } as const;

    // Act
    const actual = captureFileName(state);

    // Assert
    expect(actual).toBe('prism-diamond-30deg.png');
  });

  it('角度は小数第 1 位へ丸める', () => {
    // Arrange: 最小偏角の着地（BK7）は 12 桁ある
    const state = { material: 'BK7', sourceAngleDeg: 49.32334773625 } as const;

    // Act
    const actual = captureFileName(state);

    // Assert
    expect(actual).toBe('prism-bk7-49.3deg.png');
  });

  it('丸めて整数になる角度は小数部を持たない', () => {
    // Arrange
    const state = { material: 'BK7', sourceAngleDeg: 69.98 } as const;

    // Act
    const actual = captureFileName(state);

    // Assert
    expect(actual).toBe('prism-bk7-70deg.png');
  });

  it('負の角度は先頭ハイフンを避けて m を前置する', () => {
    // Arrange
    const state = { material: 'BK7', sourceAngleDeg: -12.5 } as const;

    // Act
    const actual = captureFileName(state);

    // Assert
    expect(actual).toBe('prism-bk7-m12.5deg.png');
  });

  it('-0 は m を付けず 0deg になる', () => {
    // Arrange
    const state = { material: 'BK7', sourceAngleDeg: -0 } as const;

    // Act
    const actual = captureFileName(state);

    // Assert
    expect(actual).toBe('prism-bk7-0deg.png');
  });

  it('丸めて -0 になる負の微小角も 0deg になる', () => {
    // Arrange: -0.01 は小数第 1 位で -0 に丸まる
    const state = { material: 'BK7', sourceAngleDeg: -0.01 } as const;

    // Act
    const actual = captureFileName(state);

    // Assert
    expect(actual).toBe('prism-bk7-0deg.png');
  });

  it('非有限の角度では角度部分を省き、保存自体は成立させる', () => {
    // Arrange: store の clampState を通れば非有限は来ないが、名前作りで投げると
    //          保存という無関係な操作が巻き添えで死ぬ
    const state = { material: 'BK7', sourceAngleDeg: Number.NaN } as const;

    // Act
    const actual = captureFileName(state);

    // Assert
    expect(actual).toBe('prism-bk7.png');
  });

  it('Infinity の角度でも角度部分を省く', () => {
    // Arrange
    const state = { material: 'SF10', sourceAngleDeg: Number.POSITIVE_INFINITY } as const;

    // Act
    const actual = captureFileName(state);

    // Assert
    expect(actual).toBe('prism-sf10.png');
  });

  it('どの材質・角度でもファイル名に使える文字だけで構成される', () => {
    // Arrange
    const states = [
      { material: '水', sourceAngleDeg: -89 },
      { material: 'ダイヤモンド', sourceAngleDeg: 49.32334773625 },
      { material: 'SF10', sourceAngleDeg: Number.NaN },
      { material: 'BK7', sourceAngleDeg: 0 },
    ] as const;

    // Act & Assert
    for (const state of states) {
      const actual = captureFileName(state);

      expect(actual, `${state.material} / ${String(state.sourceAngleDeg)}`).toMatch(SAFE_NAME);
      expect(actual.endsWith('.png'), actual).toBe(true);
    }
  });
});
