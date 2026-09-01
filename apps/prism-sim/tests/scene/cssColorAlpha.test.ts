import { describe, expect, it } from 'vitest';

import { splitCssColorAlpha } from '../../src/scene/cssColorAlpha';

/**
 * src/scene/cssColorAlpha.ts の受け入れ条件（PNG-2 段階2）。
 *
 * 対象:
 *   splitCssColorAlpha(css) — `rgba(r, g, b, a)` を色と不透明度に割る
 *
 * 何を守るためのテストか:
 *   `augmentSvgForRaster` が受け取る `RasterStyle` は背景を `bgFill`（不透明な色）と
 *   `bgAlpha`（0〜1）に分けて持つ。SVG の `fill` 属性へ `rgba(...)` を丸ごと入れる手も
 *   あるが、`fill` + `fill-opacity` に割った方が古い実装でも確実に効く。
 *   割るのは `getComputedStyle().backgroundColor` の文字列で、その形は
 *   **ブラウザのシリアライズ規則に握られている**。Chrome は今は `rgba(5, 7, 13, 0.72)`
 *   を返すが、CSS Color 4 の `rgb(5 7 13 / 0.72)` 形へ動く可能性がある。両方を
 *   受けられることをここへ固定する。
 *
 * 期待値の出典:
 *   `.section-view` の CSS `background: rgba(5, 7, 13, 0.72)` と、
 *   段階0 スパイクで実測した Chrome の計算済み値。
 */

describe('PNG-2: splitCssColorAlpha の色と不透明度の分離', () => {
  it('rgba() を不透明な色と不透明度に割る', () => {
    // Arrange: Chrome が .section-view の背景に対して返す実測値

    // Act
    const actual = splitCssColorAlpha('rgba(5, 7, 13, 0.72)');

    // Assert
    expect(actual).toEqual({ color: 'rgb(5, 7, 13)', alpha: 0.72 });
  });

  it('rgb() は不透明度 1 になる', () => {
    // Arrange

    // Act
    const actual = splitCssColorAlpha('rgb(30, 42, 61)');

    // Assert
    expect(actual).toEqual({ color: 'rgb(30, 42, 61)', alpha: 1 });
  });

  it('CSS Color 4 のスラッシュ記法も割れる', () => {
    // Arrange: 将来 Chrome のシリアライズがこちらへ動いても壊れないこと

    // Act
    const actual = splitCssColorAlpha('rgb(5 7 13 / 0.72)');

    // Assert
    expect(actual).toEqual({ color: 'rgb(5, 7, 13)', alpha: 0.72 });
  });

  it('完全な透明は不透明度 0 になる', () => {
    // Arrange: `transparent` の計算済み値。0 と 1 を取り違えると背景が真っ黒に潰れる

    // Act
    const actual = splitCssColorAlpha('rgba(0, 0, 0, 0)');

    // Assert
    expect(actual).toEqual({ color: 'rgb(0, 0, 0)', alpha: 0 });
  });

  it('解釈できない表記はそのまま返し、不透明度 1 とする', () => {
    // Arrange: 16 進や色名。SVG の fill はどちらも解釈できるので手を加えない

    // Act
    const actual = splitCssColorAlpha('#05070d');

    // Assert
    expect(actual).toEqual({ color: '#05070d', alpha: 1 });
  });
});
