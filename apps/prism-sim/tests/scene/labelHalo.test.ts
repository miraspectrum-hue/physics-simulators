import { describe, expect, it } from 'vitest';

import { haloColorFor } from '../../src/scene/labelHalo';

/**
 * src/scene/labelHalo.ts の受け入れ条件（文字色 → 縁取りの色。可読性パス 段階2）。
 *
 * 対象:
 *   haloColorFor(fillCss) — その文字色を任意の背景の上で読ませるための縁取り色
 *
 * 何を守るためのテストか:
 *   段階0 の実測で、断面図の δ ラベルが背後を通る光線に負けていた
 *   （δ紫 1.135:1、δ赤 1.357:1）。ラベルはパラメータで動く光線をいつでも避けられないので、
 *   **再配置ではなく縁取りで下限を作る**（correct-by-construction）。
 *
 *   縁取りを一律に暗色へ固定すると、暗い文字色が救えない。輝度フロア適用後でも
 *   410nm は `rgb(147,0,255)`（相対輝度 0.1342）で、黒に対して 3.53:1 にしかならない
 *   （4.5:1 に必要な相対輝度は 0.1846）。そこで**文字色に応じて極性を選ぶ**。
 *
 *   黒と白を選択肢に持てば、最悪ケースは両者が釣り合う点で決まる。
 *   (L+0.05)/0.05 = 1.05/(L+0.05) を解くと L = 0.179129…、比は 4.583… で、
 *   **どんな文字色でも 4.5:1 を割らない**。この下限が本モジュールの存在理由である。
 *
 * 期待値の出典:
 *   WCAG 2.x の相対輝度とコントラスト比の定義。テスト側で独立に実装して検算する。
 */

/** WCAG の相対輝度。`rgb(r, g, b)` と `#rrggbb` を解釈する。 */
function relativeLuminance(css: string): number {
  const rgb = /^rgb\((\d+), ?(\d+), ?(\d+)\)$/.exec(css);
  const hex = /^#([0-9a-fA-F]{6})$/.exec(css);

  let channels: number[];

  if (rgb !== null) {
    channels = rgb.slice(1).map(Number);
  } else if (hex !== null) {
    const value = hex[1] as string;
    channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16));
  } else {
    throw new Error(`解釈できない色: ${css}`);
  }

  const linear = channels.map((component) => {
    const c = component / 255;

    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });

  return (
    0.2126 * (linear[0] as number) +
    0.7152 * (linear[1] as number) +
    0.0722 * (linear[2] as number)
  );
}

/** WCAG のコントラスト比。 */
function contrastRatio(a: number, b: number): number {
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe('可読性パス: haloColorFor の縁取り極性', () => {
  it('明るい文字色には暗い縁取りを選ぶ', () => {
    // Arrange: θ₁ ラベル（0.3457）と 550nm の黄緑（0.7931）
    const brights = ['#8fa0bb', 'rgb(163, 255, 0)'];

    // Act & Assert
    for (const fill of brights) {
      const halo = haloColorFor(fill);

      expect(relativeLuminance(halo), fill).toBeLessThan(relativeLuminance(fill));
    }
  });

  it('暗い文字色には明るい縁取りを選ぶ', () => {
    // Arrange: 輝度フロア適用後の 410nm（0.1342）。暗色ハローでは 3.53:1 にしかならない
    const fill = 'rgb(147, 0, 255)';

    expect(contrastRatio(relativeLuminance(fill), relativeLuminance('#000000'))).toBeLessThan(4.5);

    // Act
    const halo = haloColorFor(fill);

    // Assert
    expect(relativeLuminance(halo)).toBeGreaterThan(relativeLuminance(fill));
  });

  it('どんな文字色でもコントラスト比 4.5:1 を下回らない', () => {
    // Arrange: RGB 空間を粗く掃引する（17^3 = 4913 色）
    const steps = [0, 16, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192, 208, 224, 240, 255];
    let worst = Number.POSITIVE_INFINITY;
    let worstFill = '';

    // Act & Assert
    for (const r of steps) {
      for (const g of steps) {
        for (const b of steps) {
          const fill = `rgb(${String(r)}, ${String(g)}, ${String(b)})`;
          const ratio = contrastRatio(
            relativeLuminance(fill),
            relativeLuminance(haloColorFor(fill))
          );

          if (ratio < worst) {
            worst = ratio;
            worstFill = fill;
          }
        }
      }
    }

    expect(worst, `最悪は ${worstFill}`).toBeGreaterThanOrEqual(4.5);
  });

  it('実際に使う 3 ラベルの色で 4.5:1 以上になる', () => {
    // Arrange: θ₁ の注記色と、輝度フロア適用後の 660nm / 410nm
    const fills = ['#8fa0bb', 'rgb(255, 0, 0)', 'rgb(147, 0, 255)'];

    // Act & Assert
    for (const fill of fills) {
      const ratio = contrastRatio(
        relativeLuminance(fill),
        relativeLuminance(haloColorFor(fill))
      );

      expect(ratio, fill).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('解釈できない色には暗い縁取りを返す', () => {
    // Arrange: 将来 currentColor や名前付き色を渡されても落ちない（安全側へ倒す）

    // Act & Assert
    for (const fill of ['currentColor', '', 'tomato']) {
      expect(relativeLuminance(haloColorFor(fill)), fill).toBeLessThan(0.1);
    }
  });
});
