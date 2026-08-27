import { describe, expect, it } from 'vitest';

import { computeInsetPlacement } from '../../src/scene/insetPlacement';

/**
 * src/scene/insetPlacement.ts の受け入れ条件（CSS 矩形 → バッキング画素の配置。PNG-2 段階1）。
 *
 * 対象:
 *   computeInsetPlacement(cssRect, devicePixelRatio, backing) — 断面図インセットを
 *   書き出し画像のどこへ、どの大きさで重ねるか
 *
 * 何を守るためのテストか:
 *   PNG-2 は 3D の書き出し（バッキング画素）の上へ、DOM で測ったインセット（CSS 画素）を
 *   重ねる。**2 つの座標系が混ざる唯一の場所**がここで、取り違えても DPR=1 の環境では
 *   何も起きずに通ってしまう。段階0 のスパイクで実測した写像（CSS 座標 × DPR）を
 *   ここへ固定し、DPR が 1 でない環境で崩れないようにする。
 *
 *   併せて、はみ出しを許さない。`drawImage` は枠外へ描いても黙って切り捨てるので、
 *   位置を取り違えたときに「絵が一部欠ける」という分かりにくい壊れ方をする。
 *
 * 期待値の出典:
 *   段階0 スパイクの実測（canvas 1202×700 / DPR 1 / インセット CSS (16,16,320,320) →
 *   バッキング (16,16,320,320)）と、そこから DPR 倍した値。
 */

/** 実測どおりの既定配置。 */
const INSET: { x: number; y: number; width: number; height: number } = {
  x: 16,
  y: 16,
  width: 320,
  height: 320,
};

/** 実測どおりの既定バッキング。 */
const BACKING = { width: 1202, height: 700 };

describe('PNG-2: computeInsetPlacement の CSS → バッキング写像', () => {
  it('DPR 1 では CSS の矩形がそのまま配置になる', () => {
    // Arrange: 段階0 スパイクの実測値

    // Act
    const actual = computeInsetPlacement(INSET, 1, BACKING);

    // Assert
    expect(actual).toEqual({ x: 16, y: 16, width: 320, height: 320 });
  });

  it('DPR 2 では位置も大きさも 2 倍になる', () => {
    // Arrange

    // Act
    const actual = computeInsetPlacement(INSET, 2, { width: 2404, height: 1400 });

    // Assert
    expect(actual).toEqual({ x: 32, y: 32, width: 640, height: 640 });
  });

  it('DPR 1.5 では 1.5 倍になり、端数は丸めない', () => {
    // Arrange: 1.5 倍して整数にならない矩形を選ぶ（丸めが混じれば落ちる）
    const rect = { x: 17, y: 17, width: 321, height: 321 };

    // Act
    const actual = computeInsetPlacement(rect, 1.5, { width: 1803, height: 1050 });

    // Assert
    expect(actual).toEqual({ x: 25.5, y: 25.5, width: 481.5, height: 481.5 });
  });

  it('DPR が 1 でなければ出力は入力の CSS 矩形と一致しない', () => {
    // Arrange: ×DPR を忘れても DPR=1 の環境では気付けない。ここで気付けるようにする

    // Act
    const doubled = computeInsetPlacement(INSET, 2, { width: 2404, height: 1400 });
    const oneAndHalf = computeInsetPlacement(INSET, 1.5, { width: 1803, height: 1050 });

    // Assert
    expect(doubled).not.toEqual(INSET);
    expect(oneAndHalf).not.toEqual(INSET);
  });

  it('正当な配置はバッキングの右下端を越えない', () => {
    // Arrange: 右下ぎりぎりに置いた場合
    const rect = { x: 882, y: 380, width: 320, height: 320 };

    // Act
    const actual = computeInsetPlacement(rect, 1, BACKING);

    // Assert
    expect(actual.x + actual.width).toBeLessThanOrEqual(BACKING.width);
    expect(actual.y + actual.height).toBeLessThanOrEqual(BACKING.height);
  });

  it('バッキングをはみ出す配置は RangeError になる', () => {
    // Arrange: `drawImage` は枠外を黙って切り捨てるので、ここで止める。
    //          右へ 1px、下へ 1px、原点が負、の 3 通り
    const cases = [
      { rect: { x: 883, y: 380, width: 320, height: 320 }, dpr: 1, backing: BACKING },
      { rect: { x: 882, y: 381, width: 320, height: 320 }, dpr: 1, backing: BACKING },
      { rect: { x: -1, y: 16, width: 320, height: 320 }, dpr: 1, backing: BACKING },
      // DPR を掛けると初めてはみ出す場合（写像を忘れると見逃す）
      { rect: { x: 700, y: 16, width: 320, height: 320 }, dpr: 2, backing: BACKING },
    ];

    // Act & Assert
    for (const { rect, dpr, backing } of cases) {
      expect(
        () => computeInsetPlacement(rect, dpr, backing),
        `${JSON.stringify(rect)} / DPR ${String(dpr)}`
      ).toThrow(RangeError);
    }
  });
});
