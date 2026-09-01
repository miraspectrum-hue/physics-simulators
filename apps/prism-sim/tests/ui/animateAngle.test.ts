import { describe, expect, it } from 'vitest';

import { animateAngle } from '../../src/ui/animateAngle';

/**
 * src/ui/animateAngle.ts の受け入れ条件（角度のアニメーション遷移）。
 *
 * 対象:
 *   animateAngle(from, to, durationMs, nowMs) — その時刻の角度と done
 *
 * 何を守るためのテストか:
 *   **アニメーションは化粧であり、6-2 段階3 が実測で確かめた「着地する値」を
 *   1 ビットも変えてはならない。** 端点の厳密一致（A 節）がその保証である。
 *   t = 0 で from、t >= durationMs で to が**丸め誤差なしに**返るなら、
 *   最終フレームの store.update に渡る値は段階3 の即時適用とビット同一になる。
 *   線形補間 from + p·(to − from) は p = 1 でも `to` と一致しない場合があるので、
 *   終端は補間を経由してはならない。
 *
 * 設計判断:
 *   - 経過時間の純粋関数。RAF / DOM / Three に触れないので Vitest の対象になる
 *     （CLAUDE.md「使用言語・フレームワーク」の src/ui/store.ts と同じ立場）。
 *   - 経過時間は両端でクランプする。負の時刻でも例外にしないのは、
 *     「返り値は常に閉区間 [min, max] に収まる」（B 節）に穴を空けないため。
 *   - 補間は easeInOutCubic。曲線そのものを D 節で同定する。これが無いと
 *     線形補間へ差し替えても A〜C 節が全部通ってしまう。
 *
 * 期待値の出典:
 *   easeInOutCubic の定義 p < 0.5 → 4p³ / それ以降 → 1 − (2 − 2p)³/2 を
 *   有理数で評価した値。p = 1/4 なら 4·(1/4)³ = 1/16 = 0.0625、
 *   p = 3/4 なら 1 − (1/2)³/2 = 15/16 = 0.9375、p = 1/2 なら 1/2（対称の中点）。
 */

/** 遷移時間 [ms]。1000 なら経過時間 ms がそのまま進捗の 1/1000 になり、期待値を手で書ける。 */
const DURATION_MS = 1000;

/** 増加方向の代表ケース。6-2 の実測で使った「回転 40° から最小偏角へ」に相当する。 */
const FROM_DEG = 49.3;
const TO_DEG = 69.323347736;

/** 減少方向の代表ケース。負の角も跨ぐ（スライダーは −89〜89° を取りうる）。 */
const DOWN_FROM_DEG = 30;
const DOWN_TO_DEG = -0.676652264;

/** 掃引の刻み数。端点を含む。 */
const SWEEP_STEPS = 200;

/** 0 〜 durationMs を等間隔に刻んだ経過時間の列（両端を含む）。 */
function sweepMs(): number[] {
  return Array.from({ length: SWEEP_STEPS + 1 }, (_, i) => (DURATION_MS * i) / SWEEP_STEPS);
}

describe('6-2 段階4 A: 端点の厳密一致（段階3 の着地を壊さない保証）', () => {
  it('t = 0 では from が厳密にそのまま返り、まだ終わっていない', () => {
    // Arrange & Act
    const sample = animateAngle(FROM_DEG, TO_DEG, DURATION_MS, 0);

    // Assert: 補間を経由しない厳密一致。toBeCloseTo では保証にならない
    expect(sample.value).toBe(FROM_DEG);
    expect(sample.done).toBe(false);
  });

  it('t = durationMs ちょうどで to が厳密にそのまま返り、終わっている', () => {
    // Arrange & Act
    const sample = animateAngle(FROM_DEG, TO_DEG, DURATION_MS, DURATION_MS);

    // Assert: ここがビット同一でないと、段階3 の着地とアニメの着地がずれる
    expect(sample.value).toBe(TO_DEG);
    expect(sample.done).toBe(true);
  });

  it('durationMs を過ぎても to にクランプされ、行き過ぎない', () => {
    // Arrange: RAF は必ず durationMs ちょうどでは来ない。超過したフレームが本番の最終フレーム
    // Act
    const sample = animateAngle(FROM_DEG, TO_DEG, DURATION_MS, DURATION_MS * 10);

    // Assert
    expect(sample.value).toBe(TO_DEG);
    expect(sample.done).toBe(true);
  });

  it('durationMs の直前ではまだ終わっておらず、to には達していない', () => {
    // Arrange: done が立つ境界の向きを固定する（>= durationMs で true）
    // Act
    const sample = animateAngle(FROM_DEG, TO_DEG, DURATION_MS, DURATION_MS - 1);

    // Assert
    expect(sample.done).toBe(false);
    expect(sample.value).not.toBe(TO_DEG);
  });

  it('負の経過時間は開始前として from にクランプされる', () => {
    // Arrange & Act
    const sample = animateAngle(FROM_DEG, TO_DEG, DURATION_MS, -1);

    // Assert: 例外にしないのは「返り値は常に閉区間に収まる」に穴を空けないため
    expect(sample.value).toBe(FROM_DEG);
    expect(sample.done).toBe(false);
  });
});

describe('6-2 段階4 B: 区間外に出ない', () => {
  it('増加方向のどの時刻でも from 以上 to 以下に収まる', () => {
    // Arrange
    const times = sweepMs();

    // Act
    const values = times.map((t) => animateAngle(FROM_DEG, TO_DEG, DURATION_MS, t).value);

    // Assert
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(FROM_DEG);
      expect(value).toBeLessThanOrEqual(TO_DEG);
    }
  });

  it('減少方向のどの時刻でも to 以上 from 以下に収まる', () => {
    // Arrange
    const times = sweepMs();

    // Act
    const values = times.map(
      (t) => animateAngle(DOWN_FROM_DEG, DOWN_TO_DEG, DURATION_MS, t).value
    );

    // Assert
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(DOWN_TO_DEG);
      expect(value).toBeLessThanOrEqual(DOWN_FROM_DEG);
    }
  });
});

describe('6-2 段階4 C: 進行方向へ単調（後退しない）', () => {
  it('増加方向では時刻が進むほど値が減らない', () => {
    // Arrange
    const times = sweepMs();

    // Act
    const values = times.map((t) => animateAngle(FROM_DEG, TO_DEG, DURATION_MS, t).value);

    // Assert: 絵が行きつ戻りつしないことの保証
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeGreaterThanOrEqual(values[i - 1] as number);
    }
  });

  it('減少方向では時刻が進むほど値が増えない', () => {
    // Arrange
    const times = sweepMs();

    // Act
    const values = times.map(
      (t) => animateAngle(DOWN_FROM_DEG, DOWN_TO_DEG, DURATION_MS, t).value
    );

    // Assert
    for (let i = 1; i < values.length; i += 1) {
      expect(values[i]).toBeLessThanOrEqual(values[i - 1] as number);
    }
  });
});

describe('6-2 段階4 D: 補間曲線が easeInOutCubic である', () => {
  it('中点 t = durationMs/2 でちょうど半分まで進む', () => {
    // Arrange: easeInOutCubic は p = 1/2 で 1/2 を返す対称な曲線
    const expected = FROM_DEG + 0.5 * (TO_DEG - FROM_DEG);

    // Act
    const sample = animateAngle(FROM_DEG, TO_DEG, DURATION_MS, DURATION_MS / 2);

    // Assert
    expect(sample.value).toBeCloseTo(expected, 12);
  });

  it('p = 1/4 で 1/16、p = 3/4 で 15/16 まで進む（線形補間と区別する）', () => {
    // Arrange: 4·(1/4)³ = 1/16、1 − (1/2)³/2 = 15/16。線形なら 1/4 と 3/4 になるはず
    const quarter = FROM_DEG + (1 / 16) * (TO_DEG - FROM_DEG);
    const threeQuarters = FROM_DEG + (15 / 16) * (TO_DEG - FROM_DEG);

    // Act
    const early = animateAngle(FROM_DEG, TO_DEG, DURATION_MS, DURATION_MS / 4);
    const late = animateAngle(FROM_DEG, TO_DEG, DURATION_MS, (DURATION_MS * 3) / 4);

    // Assert
    expect(early.value).toBeCloseTo(quarter, 12);
    expect(late.value).toBeCloseTo(threeQuarters, 12);
  });
});

describe('6-2 段階4 E: 定義域', () => {
  it('durationMs が 0 以下なら RangeError（0 除算で NaN を作らない）', () => {
    // Arrange & Act & Assert
    expect(() => animateAngle(FROM_DEG, TO_DEG, 0, 0)).toThrow(RangeError);
    expect(() => animateAngle(FROM_DEG, TO_DEG, -1, 0)).toThrow(RangeError);
  });

  it('from / to / durationMs / nowMs が有限数でなければ RangeError', () => {
    // Arrange & Act & Assert
    expect(() => animateAngle(Number.NaN, TO_DEG, DURATION_MS, 0)).toThrow(RangeError);
    expect(() => animateAngle(FROM_DEG, Number.POSITIVE_INFINITY, DURATION_MS, 0)).toThrow(
      RangeError
    );
    expect(() => animateAngle(FROM_DEG, TO_DEG, Number.NaN, 0)).toThrow(RangeError);
    expect(() => animateAngle(FROM_DEG, TO_DEG, DURATION_MS, Number.NaN)).toThrow(RangeError);
  });
});

describe('6-2 段階4 F: 退化（from と to が同じ）', () => {
  it('from === to ならどの時刻でもその値を返し、durationMs で終わる', () => {
    // Arrange: 既定姿勢で押したときがこれに当たる（すでに θ₁_min にいる）
    const times = sweepMs();

    // Act
    const samples = times.map((t) => animateAngle(FROM_DEG, FROM_DEG, DURATION_MS, t));

    // Assert
    for (const sample of samples) {
      expect(sample.value).toBe(FROM_DEG);
    }
    expect(samples[samples.length - 1]?.done).toBe(true);
  });
});
