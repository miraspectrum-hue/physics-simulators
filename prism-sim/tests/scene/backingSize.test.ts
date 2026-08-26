import { describe, expect, it } from 'vitest';

import { computeBackingSize, MAX_PIXEL_RATIO } from '../../src/scene/backingSize';

/**
 * src/scene/backingSize.ts の受け入れ条件（レイアウト箱 → バッキングストア）。
 *
 * 対象:
 *   computeBackingSize(boxWidth, boxHeight, dpr) — 箱 [CSS px] と DPR から
 *   canvas のバッキング寸法 [px] と camera へ渡すアスペクトを導く
 *
 * 何を守るためのテストか:
 *   Phase 2 以来、バッキング寸法とカメラのアスペクトは**構築時に一度測った箱**から
 *   作られていた。操作パネル（320px）が DOM に入る前だったため、バッキング 1522 に対し
 *   表示は 1202 という不整合が固定され、絵が横に 79% へ潰れて出ていた。
 *
 *   ここで釘打ちするのは「**バッキングもアスペクトも、渡された箱からしか作られない**」
 *   という一点である。アスペクトを canvas.width / canvas.height（丸めた後の値）から
 *   作ると、DPR が小数のときに表示の箱と食い違う。箱から作れば構成上一致する。
 *
 * 期待値の出典:
 *   本テストが仕様として定める値。バッキングの丸めは three の
 *   `WebGLRenderer.setSize`（`Math.floor(width * pixelRatio)`）に合わせる。
 */

describe('6-x アスペクト是正: computeBackingSize の箱 → バッキング', () => {
  it('DPR 1 では箱の寸法がそのままバッキングになる', () => {
    // Arrange: 実測で問題が出た箱（1522 の window から操作パネル 320 を引いた 1202）
    const boxWidth = 1202;
    const boxHeight = 700;

    // Act
    const actual = computeBackingSize(boxWidth, boxHeight, 1);

    // Assert
    expect(actual.width).toBe(1202);
    expect(actual.height).toBe(700);
  });

  it('アスペクトは丸めたバッキングではなく箱から導かれる', () => {
    // Arrange: DPR 1.5 だと floor で 1801/1051 になり、箱の比 1201/701 とは一致しない
    const boxWidth = 1201;
    const boxHeight = 701;

    // Act
    const actual = computeBackingSize(boxWidth, boxHeight, 1.5);

    // Assert: 箱の比（1201/701 を倍精度で評価した値）であること
    expect(actual.aspect).toBe(1.7132667617689015);
    // 丸めたバッキングの比（1801/1051 = 1.7136060894386298）ではないこと
    expect(actual.width / actual.height).toBe(1.7136060894386298);
    expect(actual.aspect).not.toBe(actual.width / actual.height);
  });

  it('DPR 1.5 の別の箱でも、真実は箱比でバッキングは floor されうる', () => {
    // Arrange: 上のテストの姉妹。**耐荷重の表明は camera.aspect === 箱比の一本**であり、
    //          canvas.width / canvas.height との一致は DPR=1 でたまたま成り立つだけの情報にすぎない
    const boxWidth = 1203;
    const boxHeight = 701;

    // Act
    const actual = computeBackingSize(boxWidth, boxHeight, 1.5);

    // Assert: floor(1804.5) = 1804、floor(1051.5) = 1051
    expect(actual.width).toBe(1804);
    expect(actual.height).toBe(1051);
    // 箱比（1203/701 を倍精度で評価した値）
    expect(actual.aspect).toBe(1.7161198288159771);
    // 丸めたバッキングの比（1804/1051）とは一致しない
    expect(actual.width / actual.height).toBe(1.7164605137963844);
    expect(actual.aspect).not.toBe(actual.width / actual.height);
  });

  it('バッキングの丸めは three の setSize と同じ floor である', () => {
    // Arrange
    const boxWidth = 1201;
    const boxHeight = 701;

    // Act
    const actual = computeBackingSize(boxWidth, boxHeight, 1.5);

    // Assert: floor(1801.5) = 1801、floor(1051.5) = 1051
    expect(actual.width).toBe(1801);
    expect(actual.height).toBe(1051);
  });

  it('DPR 2 ではバッキングが 2 倍になるがアスペクトは変わらない', () => {
    // Arrange
    const boxWidth = 1202;
    const boxHeight = 700;

    // Act
    const one = computeBackingSize(boxWidth, boxHeight, 1);
    const two = computeBackingSize(boxWidth, boxHeight, 2);

    // Assert
    expect(two.width).toBe(2404);
    expect(two.height).toBe(1400);
    expect(two.aspect).toBe(one.aspect);
  });

  it('DPR は MAX_PIXEL_RATIO で頭打ちになる', () => {
    // Arrange: 高 DPI 環境での過剰な描画負荷を抑える（既存の方針を移設）
    const boxWidth = 1202;
    const boxHeight = 700;

    // Act
    const actual = computeBackingSize(boxWidth, boxHeight, 4);

    // Assert
    expect(MAX_PIXEL_RATIO).toBe(2);
    expect(actual.width).toBe(1202 * MAX_PIXEL_RATIO);
    expect(actual.height).toBe(700 * MAX_PIXEL_RATIO);
  });

  it('DPR が 0 や非有限なら 1 として扱う', () => {
    // Arrange
    const boxWidth = 1202;
    const boxHeight = 700;

    // Act
    const zero = computeBackingSize(boxWidth, boxHeight, 0);
    const nan = computeBackingSize(boxWidth, boxHeight, Number.NaN);

    // Assert: 箱は正しいのに DPR だけが壊れているとき、絵を捨てる理由は無い
    expect(zero).toEqual({ width: 1202, height: 700, aspect: 1202 / 700 });
    expect(nan).toEqual({ width: 1202, height: 700, aspect: 1202 / 700 });
  });

  it('バッキングは最低 1 画素を保ち、アスペクトは箱の比のまま残る', () => {
    // Arrange: 箱は正だが floor すると 0 になる大きさ
    const boxWidth = 0.4;
    const boxHeight = 0.8;

    // Act
    const actual = computeBackingSize(boxWidth, boxHeight, 1);

    // Assert: 0 幅のバッキングは WebGL が受け付けない。アスペクトは箱の 0.5 のまま
    expect(actual.width).toBe(1);
    expect(actual.height).toBe(1);
    expect(actual.aspect).toBe(0.5);
  });

  it('箱の幅が 0 なら縮退した 1x1・アスペクト 1 を返す', () => {
    // Arrange: display:none の要素などで ResizeObserver は 0 を通知する
    const boxWidth = 0;
    const boxHeight = 700;

    // Act
    const actual = computeBackingSize(boxWidth, boxHeight, 1);

    // Assert: 0 除算で aspect を NaN にしない
    expect(actual).toEqual({ width: 1, height: 1, aspect: 1 });
  });

  it('箱の高さが 0 なら縮退した 1x1・アスペクト 1 を返す', () => {
    // Arrange
    const boxWidth = 1202;
    const boxHeight = 0;

    // Act
    const actual = computeBackingSize(boxWidth, boxHeight, 1);

    // Assert
    expect(actual).toEqual({ width: 1, height: 1, aspect: 1 });
  });

  it('箱が負なら縮退した 1x1・アスペクト 1 を返す', () => {
    // Arrange
    const boxWidth = -1202;
    const boxHeight = 700;

    // Act
    const actual = computeBackingSize(boxWidth, boxHeight, 1);

    // Assert
    expect(actual).toEqual({ width: 1, height: 1, aspect: 1 });
  });

  it('箱が非有限なら縮退した 1x1・アスペクト 1 を返す', () => {
    // Arrange
    const cases = [
      [Number.NaN, 700],
      [1202, Number.NaN],
      [Number.POSITIVE_INFINITY, 700],
      [1202, Number.POSITIVE_INFINITY],
    ] as const;

    // Act & Assert
    for (const [boxWidth, boxHeight] of cases) {
      expect(computeBackingSize(boxWidth, boxHeight, 1), `${boxWidth}x${boxHeight}`).toEqual({
        width: 1,
        height: 1,
        aspect: 1,
      });
    }
  });

  it('同じ箱からは常に同じ寸法が出る（副作用を持たない）', () => {
    // Arrange
    const boxWidth = 1202;
    const boxHeight = 700;

    // Act
    const first = computeBackingSize(boxWidth, boxHeight, 1);
    const second = computeBackingSize(boxWidth, boxHeight, 1);

    // Assert
    expect(first).toEqual(second);
  });
});
