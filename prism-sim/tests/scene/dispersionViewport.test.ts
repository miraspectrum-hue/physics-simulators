import { describe, expect, it } from 'vitest';

import {
  fitViewport,
  uvToSvg,
  type PixelSize,
  type UvBounds,
} from '../../src/scene/dispersionViewport';

/**
 * src/scene/dispersionViewport.ts の受け入れ条件（uv → SVG のビューポート変換）。
 *
 * 対象:
 *   fitViewport(uvBounds, pixelSize, marginPx) — 等方スケールと中央寄せのオフセット
 *   uvToSvg(uv, transform)                     — 断面座標 → SVG ピクセル座標
 *
 * 設計判断:
 *   - **等方スケール。** 軸ごとに別倍率にすれば枠を隙間なく埋められるが、正三角形が
 *     潰れて頂角 60° が読めなくなる。図の意味を保つには余白ができても等方にする。
 *   - **v を反転する。** uv は v が上向き、SVG は y が下向き。u は反転しない
 *     （左右まで入れ替えると鏡像になり、右へ抜ける光が左へ抜けて見える）。
 *   - 描画（DOM / SVG 要素の生成）はここには無い。持つのは「どこへ描くか」だけ。
 *   - **ガードは数学的前提だけを符号化する。** 不変条件は
 *     「usable = pixelSize − 2·margin > 0（両軸）かつ margin >= 0 かつ全成分が有限」の 1 本。
 *     margin = 0 は幾何的に正当な変換（枠ピッタリの exact fit）なので弾かない。
 *     「余白が欲しい」は呼び出し側の様式であって、ドメインの制約ではない。
 *
 * 期待値の出典:
 *   すべて手計算。枠 320×240・余白 20 なので使える領域は 280×200。
 *   scale = min(280/Δu, 200/Δv)、offsetX = 160 − scale·cu、offsetY = 120 + scale·cv。
 *
 * 非空虚の注意（テストを書くときの前提）:
 *   - 等方の検査は**非正方の枠**で行う。正方枠だと軸ごとに別倍率を掛ける実装でも
 *     倍率が偶然一致して素通りする。
 *   - y 反転の検査は**中心から外れた点**で行う。中心は反転しても動かないため、
 *     中心だけを見ると反転を忘れた実装でも通ってしまう。
 *   - y 反転だけでなく **x が反転していないこと**も見る。両軸を反転する実装は
 *     「v が大きいほど y が小さい」を満たしてしまう。
 */

/** 描画先の枠。**非正方**にすること（等方の検査が空虚にならないため）。 */
const SIZE: PixelSize = { width: 320, height: 240 };

/** 余白 [px]。使える領域は 280×200 になる。 */
const MARGIN = 20;

/** 枠の中心 [px]。 */
const CENTER_X = 160;
const CENTER_Y = 120;

/**
 * 横長の uv（Δu = 4, Δv = 1）。280/4 = 70 < 200/1 = 200 なので **u が制約軸**。
 * 中心は原点にあるので、中心の検査には使わない。
 */
const WIDE_BOUNDS: UvBounds = { minU: -2, maxU: 2, minV: -0.5, maxV: 0.5 };

/** 縦長の uv（Δu = 1, Δv = 4）。280/1 = 280 > 200/4 = 50 なので **v が制約軸**。 */
const TALL_BOUNDS: UvBounds = { minU: -0.5, maxU: 0.5, minV: -2, maxV: 2 };

/**
 * 中心が原点に無い uv（中心は (3, −1)）。Δu = Δv = 4 なので scale = 50。
 * offsetX = 160 − 50·3 = 10、offsetY = 120 + 50·(−1) = 70。
 */
const OFFSET_BOUNDS: UvBounds = { minU: 1, maxU: 5, minV: -3, maxV: 1 };

/** 比較桁。すべて手計算の有理数なので丸めはほとんど出ない。 */
const DECIMALS = 12;

/** `uvBounds` の四隅を返す。 */
function corners(bounds: UvBounds): Array<{ u: number; v: number }> {
  return [
    { u: bounds.minU, v: bounds.minV },
    { u: bounds.maxU, v: bounds.minV },
    { u: bounds.minU, v: bounds.maxV },
    { u: bounds.maxU, v: bounds.maxV },
  ];
}

describe('6-1 段階3a A: 中央寄せ', () => {
  it('uvBounds の中心が枠の中心へ写る', () => {
    // Arrange: 中心が原点でない範囲で見る（原点中心だと offset の誤りが隠れる）
    const transform = fitViewport(OFFSET_BOUNDS, SIZE, MARGIN);
    const centerUv = {
      u: (OFFSET_BOUNDS.minU + OFFSET_BOUNDS.maxU) / 2,
      v: (OFFSET_BOUNDS.minV + OFFSET_BOUNDS.maxV) / 2,
    };

    // Act
    const point = uvToSvg(centerUv, transform);

    // Assert
    expect(point.x).toBeCloseTo(CENTER_X, DECIMALS);
    expect(point.y).toBeCloseTo(CENTER_Y, DECIMALS);
  });
});

describe('6-1 段階3a B: 等方スケール（歪ませない）', () => {
  it('横と縦のピクセル/uv 比が同一である', () => {
    // Arrange: **非正方の枠 320×240 かつ非正方の uv（4×1）**。
    // 軸ごとに別倍率なら 280/4 = 70 と 200/1 = 200 になり、比が食い違う
    const transform = fitViewport(WIDE_BOUNDS, SIZE, MARGIN);

    // Act: u 方向と v 方向の伸び率をそれぞれ実測する
    const left = uvToSvg({ u: WIDE_BOUNDS.minU, v: 0 }, transform);
    const right = uvToSvg({ u: WIDE_BOUNDS.maxU, v: 0 }, transform);
    const bottom = uvToSvg({ u: 0, v: WIDE_BOUNDS.minV }, transform);
    const top = uvToSvg({ u: 0, v: WIDE_BOUNDS.maxV }, transform);

    const scaleAlongU = (right.x - left.x) / (WIDE_BOUNDS.maxU - WIDE_BOUNDS.minU);
    const scaleAlongV = (bottom.y - top.y) / (WIDE_BOUNDS.maxV - WIDE_BOUNDS.minV);

    // Assert
    expect(scaleAlongU).toBeCloseTo(scaleAlongV, DECIMALS);
    expect(scaleAlongU).toBeCloseTo(transform.scale, DECIMALS);
  });
});

describe('6-1 段階3a C: 軸の向き', () => {
  it('v が大きいほど SVG の y は小さい（上下反転）', () => {
    // Arrange: **中心 (3, −1) から外れた、対称でない 3 点**で見る。
    // 中心は反転しても動かないので、中心だけでは反転忘れを捕まえられない
    const transform = fitViewport(OFFSET_BOUNDS, SIZE, MARGIN);

    // Act
    const low = uvToSvg({ u: 2, v: -2.9 }, transform);
    const middle = uvToSvg({ u: 2, v: -0.7 }, transform);
    const high = uvToSvg({ u: 2, v: 0.9 }, transform);

    // Assert: scale = 50, offsetY = 70 なので y = 70 − 50·v
    expect(low.y).toBeCloseTo(215, DECIMALS);
    expect(middle.y).toBeCloseTo(105, DECIMALS);
    expect(high.y).toBeCloseTo(25, DECIMALS);
    expect(high.y).toBeLessThan(middle.y);
    expect(middle.y).toBeLessThan(low.y);
  });

  it('u が大きいほど SVG の x は大きい（左右は反転しない）', () => {
    // Arrange: 両軸を反転する実装は上のテストを満たしてしまう。左右も別に縛る
    const transform = fitViewport(OFFSET_BOUNDS, SIZE, MARGIN);

    // Act
    const nearLeft = uvToSvg({ u: 1.2, v: 0 }, transform);
    const middle = uvToSvg({ u: 3.3, v: 0 }, transform);
    const nearRight = uvToSvg({ u: 4.8, v: 0 }, transform);

    // Assert: scale = 50, offsetX = 10 なので x = 10 + 50·u
    expect(nearLeft.x).toBeCloseTo(70, DECIMALS);
    expect(middle.x).toBeCloseTo(175, DECIMALS);
    expect(nearRight.x).toBeCloseTo(250, DECIMALS);
    expect(nearLeft.x).toBeLessThan(middle.x);
    expect(middle.x).toBeLessThan(nearRight.x);
  });
});

describe('6-1 段階3a D: 余白', () => {
  it('四隅が余白の内側へ写る', () => {
    // Arrange: 制約軸・非制約軸のどちらでも成り立つこと
    for (const bounds of [WIDE_BOUNDS, TALL_BOUNDS, OFFSET_BOUNDS]) {
      const transform = fitViewport(bounds, SIZE, MARGIN);

      // Act & Assert
      for (const uv of corners(bounds)) {
        const point = uvToSvg(uv, transform);

        expect(point.x).toBeGreaterThanOrEqual(MARGIN - 1e-9);
        expect(point.x).toBeLessThanOrEqual(SIZE.width - MARGIN + 1e-9);
        expect(point.y).toBeGreaterThanOrEqual(MARGIN - 1e-9);
        expect(point.y).toBeLessThanOrEqual(SIZE.height - MARGIN + 1e-9);
      }
    }
  });
});

describe('6-1 段階3a E: 収まり（制約軸で接し、非制約軸は余る）', () => {
  it('横長の uv では左右が余白ちょうどに接し、上下は内側に余る', () => {
    // Arrange: 280/4 = 70 < 200/1 = 200 なので u が制約軸。scale = 70
    const transform = fitViewport(WIDE_BOUNDS, SIZE, MARGIN);

    // Act
    const left = uvToSvg({ u: WIDE_BOUNDS.minU, v: 0 }, transform);
    const right = uvToSvg({ u: WIDE_BOUNDS.maxU, v: 0 }, transform);
    const top = uvToSvg({ u: 0, v: WIDE_BOUNDS.maxV }, transform);
    const bottom = uvToSvg({ u: 0, v: WIDE_BOUNDS.minV }, transform);

    // Assert: 制約軸は接する（= 余白ちょうど）
    expect(transform.scale).toBeCloseTo(70, DECIMALS);
    expect(left.x).toBeCloseTo(MARGIN, DECIMALS);
    expect(right.x).toBeCloseTo(SIZE.width - MARGIN, DECIMALS);
    // 非制約軸は余る（接しない）。scale·Δv = 70 なので上下に 65px ずつ余る
    expect(top.y).toBeCloseTo(85, DECIMALS);
    expect(bottom.y).toBeCloseTo(155, DECIMALS);
    expect(top.y).toBeGreaterThan(MARGIN);
    expect(bottom.y).toBeLessThan(SIZE.height - MARGIN);
  });

  it('縦長の uv では上下が余白ちょうどに接し、左右は内側に余る', () => {
    // Arrange: 280/1 = 280 > 200/4 = 50 なので v が制約軸。scale = 50
    const transform = fitViewport(TALL_BOUNDS, SIZE, MARGIN);

    // Act
    const top = uvToSvg({ u: 0, v: TALL_BOUNDS.maxV }, transform);
    const bottom = uvToSvg({ u: 0, v: TALL_BOUNDS.minV }, transform);
    const left = uvToSvg({ u: TALL_BOUNDS.minU, v: 0 }, transform);
    const right = uvToSvg({ u: TALL_BOUNDS.maxU, v: 0 }, transform);

    // Assert
    expect(transform.scale).toBeCloseTo(50, DECIMALS);
    expect(top.y).toBeCloseTo(MARGIN, DECIMALS);
    expect(bottom.y).toBeCloseTo(SIZE.height - MARGIN, DECIMALS);
    expect(left.x).toBeCloseTo(135, DECIMALS);
    expect(right.x).toBeCloseTo(185, DECIMALS);
    expect(left.x).toBeGreaterThan(MARGIN);
    expect(right.x).toBeLessThan(SIZE.width - MARGIN);
  });
});

describe('6-1 段階3a E2: 余白 0 は枠ピッタリ（exact fit）', () => {
  it('margin = 0 なら制約軸が枠の縁そのものに接する', () => {
    // Arrange: 余白 0 は壊れた入力ではない。使える領域は枠そのもの 320×240 になり、
    // 横長 uv なら scale = min(320/4, 240/1) = 80、縦長なら min(320/1, 240/4) = 60
    const wide = fitViewport(WIDE_BOUNDS, SIZE, 0);
    const tall = fitViewport(TALL_BOUNDS, SIZE, 0);

    // Act
    const wideLeft = uvToSvg({ u: WIDE_BOUNDS.minU, v: 0 }, wide);
    const wideRight = uvToSvg({ u: WIDE_BOUNDS.maxU, v: 0 }, wide);
    const tallTop = uvToSvg({ u: 0, v: TALL_BOUNDS.maxV }, tall);
    const tallBottom = uvToSvg({ u: 0, v: TALL_BOUNDS.minV }, tall);

    // Assert: 制約軸は枠の縁 0 / size に「ちょうど」触れる
    expect(wide.scale).toBeCloseTo(80, DECIMALS);
    expect(wideLeft.x).toBeCloseTo(0, DECIMALS);
    expect(wideRight.x).toBeCloseTo(SIZE.width, DECIMALS);

    expect(tall.scale).toBeCloseTo(60, DECIMALS);
    expect(tallTop.y).toBeCloseTo(0, DECIMALS);
    expect(tallBottom.y).toBeCloseTo(SIZE.height, DECIMALS);
  });
});

describe('6-1 段階3a F: 定義域', () => {
  it('uvBounds が退化していれば RangeError', () => {
    // Arrange & Act & Assert: 幅 0・高さ 0・上下逆転のいずれも等方スケールが定まらない
    expect(() => fitViewport({ minU: 1, maxU: 1, minV: -1, maxV: 1 }, SIZE, MARGIN)).toThrow(
      RangeError
    );
    expect(() => fitViewport({ minU: -1, maxU: 1, minV: 2, maxV: 2 }, SIZE, MARGIN)).toThrow(
      RangeError
    );
    expect(() => fitViewport({ minU: 3, maxU: -3, minV: -1, maxV: 1 }, SIZE, MARGIN)).toThrow(
      RangeError
    );
  });

  it('pixelSize の幅・高さが正の有限数でなければ RangeError', () => {
    // Arrange & Act & Assert
    expect(() => fitViewport(WIDE_BOUNDS, { width: 0, height: 240 }, MARGIN)).toThrow(RangeError);
    expect(() => fitViewport(WIDE_BOUNDS, { width: 320, height: -240 }, MARGIN)).toThrow(
      RangeError
    );
    expect(() =>
      fitViewport(WIDE_BOUNDS, { width: Number.POSITIVE_INFINITY, height: 240 }, MARGIN)
    ).toThrow(RangeError);
  });

  it('marginPx が負または非有限なら RangeError', () => {
    // Arrange: **0 は弾かない。** 余白 0 は幾何的に完全に正当な変換（枠ピッタリの exact fit）
    // であり、「余白が欲しい」は様式の願望であってドメインの制約ではない。
    // ガードが符号化すべきは数学的前提だけ（E-3 が 0 の正常系を押さえる）
    // Act & Assert
    expect(() => fitViewport(WIDE_BOUNDS, SIZE, -10)).toThrow(RangeError);
    expect(() => fitViewport(WIDE_BOUNDS, SIZE, Number.NaN)).toThrow(RangeError);
    expect(() => fitViewport(WIDE_BOUNDS, SIZE, Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it('使える領域が残らなければ RangeError（usable = pixelSize − 2·margin > 0）', () => {
    // Arrange: 引数はどれも単体では正当なのに、組み合わせると描ける領域が消える。
    // 検査しないと scale が 0 や負になり、図が点に潰れるか裏返る。
    // F-2 の「枠が正でない」もこの 1 条件に含まれる（margin >= 0 なら
    // usable > 0 は pixelSize > 0 を含意する）
    // Act & Assert
    expect(() => fitViewport(WIDE_BOUNDS, SIZE, 120)).toThrow(RangeError); // 高さ 240 を使い切る
    expect(() => fitViewport(WIDE_BOUNDS, SIZE, 200)).toThrow(RangeError); // 幅 320 を超える
  });

  it('uvBounds に非有限成分があれば RangeError（大小比較は NaN を素通りさせる）', () => {
    // Arrange: maxU <= minU という退化の検査は NaN では常に false になるので、
    // 順序の検査だけでは NaN が抜ける。有限性は別に見る必要がある
    // Act & Assert
    expect(Number.NaN <= 1).toBe(false);

    expect(() =>
      fitViewport({ minU: Number.NaN, maxU: 2, minV: -1, maxV: 1 }, SIZE, MARGIN)
    ).toThrow(RangeError);
    expect(() =>
      fitViewport({ minU: -2, maxU: 2, minV: -1, maxV: Number.POSITIVE_INFINITY }, SIZE, MARGIN)
    ).toThrow(RangeError);
  });
});

describe('6-1 段階3a G: 純粋性', () => {
  it('同じ入力に対して同じ結果を返し、引数を変更しない', () => {
    // Arrange
    const bounds: UvBounds = { minU: 1, maxU: 5, minV: -3, maxV: 1 };
    const size: PixelSize = { width: 320, height: 240 };
    const boundsSnapshot = { ...bounds };
    const sizeSnapshot = { ...size };
    const uv = { u: 2.4, v: -0.6 };

    // Act
    const first = fitViewport(bounds, size, MARGIN);
    const second = fitViewport(bounds, size, MARGIN);

    // Assert
    expect(second).toEqual(first);
    expect(uvToSvg(uv, second)).toEqual(uvToSvg(uv, first));
    expect(bounds).toEqual(boundsSnapshot);
    expect(size).toEqual(sizeSnapshot);
  });
});
