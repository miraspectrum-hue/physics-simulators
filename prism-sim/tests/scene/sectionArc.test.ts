import { describe, expect, it } from 'vitest';

import { arcPolyline, normalizeUv, signedAngleDeg } from '../../src/scene/sectionArc';
import type { PlaneUV } from '../../src/types/optics';

/**
 * src/scene/sectionArc.ts の受け入れ条件（断面図の角度弧のジオメトリ）。
 *
 * 対象:
 *   signedAngleDeg(from, to)                            — 符号付き角 [deg]、CCW が正
 *   arcPolyline(center, radius, fromDir, toDir, segments) — 円弧上の点列
 *
 * 設計判断:
 *   - 断面座標 uv の 2 次元。v は上向きなので正の向きは反時計回り（CCW）。
 *     SVG の y 反転は `uvToSvg()` の責任で、ここでは扱わない。
 *   - `atan2(外積, 内積)` なので値域は (-180, 180]。**常に短い方の弧**になり、
 *     「どちら回りか」を呼び出し側が別に指定する必要が無い。
 *   - 物理は再計算しない。角を測る相手は既に求まっている向きである。
 *
 * 期待値の出典:
 *   基準の向きを独立に回して作った既知角（30° / 90° / 180°）と、
 *   円の定義 |P − center| = radius。どちらも SUT を通さずに組める。
 *
 * 非空虚の注意（テストを書くときの前提）:
 *   - 符号の検査は**対称でない向き**で行う。軸に対して対称な組だと符号が消え、
 *     CCW / CW を取り違えた実装でも通ってしまう。
 *   - 「全点が radius」は **center を原点から離して**書く。原点だと
 *     「center を足し忘れた実装」が素通りする。
 *   - radius は **1 以外**にする。1 だと「radius を掛け忘れた実装」が素通りする。
 */

/** 角度の比較桁。既知角は解析的な値なので丸めは 1e-13 程度しか出ない。 */
const DECIMALS = 12;

/** 弧の中心。**原点から離す**（原点相対のバグを素通りさせないため）。 */
const CENTER: PlaneUV = { u: 2.5, v: -1.5 };

/** 弧の半径。**1 以外**にする（スケール忘れを素通りさせないため）。 */
const RADIUS = 3.75;

/** 弧の刻み数。 */
const SEGMENTS = 24;

const RAD_PER_DEG = Math.PI / 180;

/**
 * 向きを反時計回りに回す。**SUT を通さずに期待値を組むための独立な道具**。
 *
 * @param direction 回す前の向き
 * @param angleDeg 回転角 [deg]。CCW が正
 * @returns 回した後の向き
 */
function rotate(direction: PlaneUV, angleDeg: number): PlaneUV {
  const angleRad = angleDeg * RAD_PER_DEG;
  const c = Math.cos(angleRad);
  const s = Math.sin(angleRad);

  return { u: direction.u * c - direction.v * s, v: direction.u * s + direction.v * c };
}

/** 2 次元ベクトルを正規化する。 */
function unit(u: number, v: number): PlaneUV {
  const length = Math.hypot(u, v);

  return { u: u / length, v: v / length };
}

/**
 * 基準の向き。**軸に揃えない**。
 * 軸に揃えると u か v の成分が 0 になり、取り違えた実装でも偶然一致しうる。
 */
const BASE = unit(1, 2);

describe('6-1 段階4a A: 符号付き角', () => {
  it('既知の 30 度・90 度・180 度をそのまま返す', () => {
    // Arrange: 基準の向きを独立に回して、答えの分かっている組を作る
    // Act & Assert
    expect(signedAngleDeg(BASE, rotate(BASE, 30))).toBeCloseTo(30, DECIMALS);
    expect(signedAngleDeg(BASE, rotate(BASE, 90))).toBeCloseTo(90, DECIMALS);
    expect(signedAngleDeg(BASE, rotate(BASE, 180))).toBeCloseTo(180, DECIMALS);
  });

  it('反時計回りが正、時計回りが負である', () => {
    // Arrange: **軸に対して対称でない組**で見る。対称だと符号が消えて取り違えが隠れる
    const ccw = rotate(BASE, 40);
    const cw = rotate(BASE, -40);

    // Act & Assert
    expect(signedAngleDeg(BASE, ccw)).toBeCloseTo(40, DECIMALS);
    expect(signedAngleDeg(BASE, cw)).toBeCloseTo(-40, DECIMALS);
    expect(signedAngleDeg(BASE, ccw)).toBeGreaterThan(0);
    expect(signedAngleDeg(BASE, cw)).toBeLessThan(0);
  });

  it('引数を入れ替えると符号が反転する（反対称）', () => {
    // Arrange: 対称な組では 0 や 180 になって反対称性が見えないので、斜めの組で見る
    const other = unit(-1, 3);

    // Act
    const forward = signedAngleDeg(BASE, other);
    const backward = signedAngleDeg(other, BASE);

    // Assert: 180 ちょうどは反転しても 180 のままなので、そうでない組であることも確かめる
    expect(Math.abs(forward)).toBeLessThan(180);
    expect(backward).toBeCloseTo(-forward, DECIMALS);
  });

  it('同じ向きは 0、真逆は 180 を返す', () => {
    // Arrange & Act & Assert: 真逆は −180 ではなく +180（値域は (-180, 180]）
    expect(signedAngleDeg(BASE, BASE)).toBeCloseTo(0, DECIMALS);
    expect(signedAngleDeg(BASE, { u: -BASE.u, v: -BASE.v })).toBeCloseTo(180, DECIMALS);
  });

  it('非有限な成分があれば RangeError', () => {
    // Arrange & Act & Assert
    expect(() => signedAngleDeg({ u: Number.NaN, v: 0 }, BASE)).toThrow(RangeError);
    expect(() => signedAngleDeg(BASE, { u: 0, v: Number.POSITIVE_INFINITY })).toThrow(RangeError);
  });

  it('単位ベクトルでなければ RangeError（零ベクトルを含む）', () => {
    // Arrange: **零ベクトルを黙って通さないことが要点。**
    // atan2(0, 0) は例外を投げずに 0 を返すので、長さを見なければ
    // 「向きが定まらない入力」が角 0 として静かに通ってしまう
    // Act & Assert
    expect(Math.atan2(0, 0)).toBe(0);

    expect(() => signedAngleDeg({ u: 0, v: 0 }, BASE)).toThrow(RangeError);
    expect(() => signedAngleDeg(BASE, { u: 2, v: 0 })).toThrow(RangeError);
  });

  it('同じ入力に対して同じ結果を返し、引数を変更しない', () => {
    // Arrange
    const from = unit(1, 2);
    const to = unit(-1, 3);
    const fromSnapshot = { ...from };
    const toSnapshot = { ...to };

    // Act
    const first = signedAngleDeg(from, to);
    const second = signedAngleDeg(from, to);

    // Assert
    expect(second).toBe(first);
    expect(from).toEqual(fromSnapshot);
    expect(to).toEqual(toSnapshot);
  });
});

describe('6-1 段階4b C: 正規化', () => {
  it('向きを保ったまま長さ 1 にする', () => {
    // Arrange: **長さが 1 でない斜めのベクトル**で見る。単位ベクトルを渡すと恒等になり、
    // 「何もしない実装」でも通ってしまう
    const source: PlaneUV = { u: 3, v: -4 };

    // Act
    const result = normalizeUv(source);

    // Assert: 長さ 5 なので (0.6, −0.8)。向き（比）は保たれる
    expect(Math.hypot(result.u, result.v)).toBeCloseTo(1, DECIMALS);
    expect(result.u).toBeCloseTo(0.6, DECIMALS);
    expect(result.v).toBeCloseTo(-0.8, DECIMALS);
    expect(result.v / result.u).toBeCloseTo(source.v / source.u, DECIMALS);
  });

  it('長さ 0 または非有限なら RangeError', () => {
    // Arrange & Act & Assert: 0 除算で NaN を返して静かに壊れるのを防ぐ
    expect(() => normalizeUv({ u: 0, v: 0 })).toThrow(RangeError);
    expect(() => normalizeUv({ u: Number.NaN, v: 1 })).toThrow(RangeError);
  });
});

describe('6-1 段階4a B: 円弧の点列', () => {
  it('すべての点が center から radius の距離にある', () => {
    // Arrange: **center は原点から離し、radius は 1 以外**にする。
    // 原点中心・半径 1 だと「center を足し忘れた」「radius を掛け忘れた」実装が素通りする
    const toDir = rotate(BASE, 75);

    // Act
    const points = arcPolyline(CENTER, RADIUS, BASE, toDir, SEGMENTS);

    // Assert
    for (const point of points) {
      expect(Math.hypot(point.u - CENTER.u, point.v - CENTER.v)).toBeCloseTo(RADIUS, DECIMALS);
    }
  });

  it('端点が fromDir・toDir の上にある', () => {
    // Arrange
    const toDir = rotate(BASE, -110);

    // Act
    const points = arcPolyline(CENTER, RADIUS, BASE, toDir, SEGMENTS);
    const first = points[0] as PlaneUV;
    const last = points[points.length - 1] as PlaneUV;

    // Assert: center + radius·dir と一致すること
    expect(first.u).toBeCloseTo(CENTER.u + RADIUS * BASE.u, DECIMALS);
    expect(first.v).toBeCloseTo(CENTER.v + RADIUS * BASE.v, DECIMALS);
    expect(last.u).toBeCloseTo(CENTER.u + RADIUS * toDir.u, DECIMALS);
    expect(last.v).toBeCloseTo(CENTER.v + RADIUS * toDir.v, DECIMALS);
  });

  it('掃引が単調である（行きつ戻りつしない）', () => {
    // Arrange: 正の向き（CCW）と負の向き（CW）の両方で見る
    for (const sweepDeg of [75, -110]) {
      const toDir = rotate(BASE, sweepDeg);
      const points = arcPolyline(CENTER, RADIUS, BASE, toDir, SEGMENTS);

      // Act: 各点の「BASE から測った角」を並べる。SUT を通さず atan2 で直に測る
      const angles = points.map((point) => {
        const du = point.u - CENTER.u;
        const dv = point.v - CENTER.v;

        return Math.atan2(BASE.u * dv - BASE.v * du, BASE.u * du + BASE.v * dv);
      });

      // Assert
      for (let i = 1; i < angles.length; i += 1) {
        const previous = angles[i - 1] as number;
        const current = angles[i] as number;

        if (sweepDeg > 0) {
          expect(current).toBeGreaterThan(previous);
        } else {
          expect(current).toBeLessThan(previous);
        }
      }
    }
  });

  it('点の数が segments + 1 である（両端を含む）', () => {
    // Arrange & Act & Assert
    expect(arcPolyline(CENTER, RADIUS, BASE, rotate(BASE, 60), 1)).toHaveLength(2);
    expect(arcPolyline(CENTER, RADIUS, BASE, rotate(BASE, 60), SEGMENTS)).toHaveLength(
      SEGMENTS + 1
    );
  });

  it('radius が正の有限数でなければ RangeError', () => {
    // Arrange & Act & Assert: 0 では弧が点に潰れ、負では裏返る
    expect(() => arcPolyline(CENTER, 0, BASE, rotate(BASE, 60), SEGMENTS)).toThrow(RangeError);
    expect(() => arcPolyline(CENTER, -1, BASE, rotate(BASE, 60), SEGMENTS)).toThrow(RangeError);
    expect(() => arcPolyline(CENTER, Number.NaN, BASE, rotate(BASE, 60), SEGMENTS)).toThrow(
      RangeError
    );
  });

  it('segments が 1 以上の整数でなければ RangeError', () => {
    // Arrange & Act & Assert: 0 だと刻み幅が 0 除算になり、小数だと点列の長さが定まらない
    expect(() => arcPolyline(CENTER, RADIUS, BASE, rotate(BASE, 60), 0)).toThrow(RangeError);
    expect(() => arcPolyline(CENTER, RADIUS, BASE, rotate(BASE, 60), -3)).toThrow(RangeError);
    expect(() => arcPolyline(CENTER, RADIUS, BASE, rotate(BASE, 60), 2.5)).toThrow(RangeError);
  });

  it('center が非有限、または向きが単位ベクトルでなければ RangeError', () => {
    // Arrange & Act & Assert
    expect(() =>
      arcPolyline({ u: Number.NaN, v: 0 }, RADIUS, BASE, rotate(BASE, 60), SEGMENTS)
    ).toThrow(RangeError);
    expect(() => arcPolyline(CENTER, RADIUS, { u: 0, v: 0 }, BASE, SEGMENTS)).toThrow(RangeError);
    expect(() => arcPolyline(CENTER, RADIUS, BASE, { u: 3, v: 0 }, SEGMENTS)).toThrow(RangeError);
  });
});
