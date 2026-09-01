import { describe, expect, it } from 'vitest';

import { EXIT_EXTENSION_LENGTH } from '../../src/optics/constants';
import { addScaled, normalize, sub, vec3 } from '../../src/optics/vec3';
import {
  clipPathsToScreen,
  meanExitAnchor,
  projectPathsToScreen,
  splitOnScreenRuns,
  type ScreenHit,
} from '../../src/scene/screenProjection';
import type { LightPath, PathTermination, ScreenPlane, Segment, Vec3 } from '../../src/types/optics';

/**
 * src/scene/screenProjection.ts の受け入れ条件（TASKS 6-3 の幾何部分）。
 *
 * 対象:
 *   projectPathsToScreen(paths, screen) — 射出レイをスクリーンへ投影し、載らない波長は null
 *   clipPathsToScreen(paths, hits)      — 載った波長だけ最終区間を交点までに縮める
 *   splitOnScreenRuns(hits)             — 載った波長が連続する区間へ切り分ける
 *   meanExitAnchor(paths)               — 射出点・射出方向の平均（スクリーン配置の基準）
 *
 * 設計判断:
 *   - 純粋関数。Three.js / DOM に触れないので Vitest の対象（beamPacker.ts と同じ立場）。
 *   - 交差は optics の `intersectRayPlane` + `pointOnRay` の合成に委ね、ここでは
 *     「どの波長を採用するか」という描画側の方針だけを持つ。optics 層は変更しない。
 *   - **射出方向は最終区間（外部区間）から取る。** 内部区間は θ₁ = 0 で長さ 0 に
 *     縮退しうるため、向きの正規化に使ってはならない（I-6 の R 節で確定した規約）。
 *   - 採用条件は exited かつ t > 0 かつ |u| <= halfExtent かつ |v| <= halfExtent。
 *     境界は載っているものとして扱う（矩形を閉集合と見る）。
 *
 * 期待値の出典:
 *   軸に平行な配置は手計算で厳密に決まる値。斜めの配置は解析値を倍精度で評価した確定値。
 *   前者は toBe で厳密比較し、後者は許容差で比較する（どちらかを各テストに明記）。
 *   符号付きゼロ（-0）が `toBe(0)` で不一致になるのを避けるため、ゼロの厳密比較は
 *   `Math.abs()` を通してから行う。
 */

/** 斜め配置の許容差。内積・除算の順序が変わっても吸収できる幅。 */
const UV_TOLERANCE = 1e-12;

/**
 * 試験用のスクリーン。x = 10 の平面に、光が来る -x 側を向いて立つ。
 *
 * `axisU = (0,1,0)` / `axisV = (0,0,-1)` なので **u = y、v = -z** と読める。
 * 光路は z = 0 の主断面に載るので、実機と同じく「分散は u 方向に広がり v は 0」になる。
 */
const SCREEN: ScreenPlane = {
  origin: vec3(10, 0, 0),
  normal: vec3(-1, 0, 0),
  axisU: vec3(0, 1, 0),
  axisV: vec3(0, 0, -1),
  halfExtent: 5,
};

/** 射出点。すべての試験光路で共通にし、方向だけを変える。 */
const EXIT_ORIGIN: Vec3 = vec3(0, 0, 0);

/**
 * 区間を作る。
 *
 * @param start 始点
 * @param end 終点
 * @param insidePrism プリズム内部を通る区間なら true
 * @returns 区間
 */
function segment(start: Vec3, end: Vec3, insidePrism: boolean, intensity = 1): Segment {
  return { start, end, insidePrism, intensity };
}

/**
 * 射出した光路を組み立てる。
 *
 * 実際の tracer の出力と同じ形（入射の外部区間 → 内部区間 → 射出の外部区間）にし、
 * 最終区間は `EXIT_EXTENSION_LENGTH` で打ち切る。
 *
 * @param wavelengthNm 波長 [nm]
 * @param exitDirection 射出方向（単位ベクトル）
 * @param innerDegenerate 内部区間を長さ 0 に縮退させるなら true（I-6 の頂点直撃を模す）
 * @returns 光路
 */
function exitedPath(wavelengthNm: number, exitDirection: Vec3, innerDegenerate = false): LightPath {
  const innerStart = vec3(-1, 0, 0);
  const innerEnd = innerDegenerate ? innerStart : EXIT_ORIGIN;

  return {
    wavelengthNm,
    refractiveIndex: 1.5,
    segments: [
      segment(vec3(-4, 0, 0), innerStart, false),
      segment(innerStart, innerEnd, true),
      segment(EXIT_ORIGIN, addScaled(EXIT_ORIGIN, exitDirection, EXIT_EXTENSION_LENGTH), false),
    ],
    termination: 'exited',
  };
}

/**
 * 射出しなかった光路を組み立てる。
 *
 * @param wavelengthNm 波長 [nm]
 * @param termination 終了理由
 * @returns 光路
 */
function unexitedPath(wavelengthNm: number, termination: PathTermination): LightPath {
  return {
    wavelengthNm,
    refractiveIndex: 1.5,
    segments: [
      segment(vec3(-4, 0, 0), EXIT_ORIGIN, false),
      segment(EXIT_ORIGIN, addScaled(EXIT_ORIGIN, vec3(1, 0, 0), EXIT_EXTENSION_LENGTH), false),
    ],
    termination,
  };
}

/** 最終区間の長さ。打ち切りが働いたかを見るために使う。 */
function lastSegmentLength(path: LightPath): number {
  const last = path.segments[path.segments.length - 1];

  if (last === undefined) {
    throw new Error('区間がありません');
  }

  const delta = sub(last.end, last.start);

  return Math.hypot(delta.x, delta.y, delta.z);
}

/** 添字アクセスが undefined になりうるため、存在を確かめてから返す。 */
function hitAt(hits: readonly (ScreenHit | null)[], index: number): ScreenHit {
  const hit = hits[index];

  if (hit === null || hit === undefined) {
    throw new Error(`hits[${index}] が null です`);
  }

  return hit;
}

/** 添字アクセスが undefined になりうるため、存在を確かめてから返す。 */
function pathAt(paths: readonly LightPath[], index: number): LightPath {
  const path = paths[index];

  if (path === undefined) {
    throw new Error(`paths[${index}] が存在しません`);
  }

  return path;
}

/** 正面から当たる射出方向。x = 10 の平面と t = 10 で交わる。 */
const DIRECTION_HEAD_ON: Vec3 = vec3(1, 0, 0);

/** 斜めに当たる射出方向。交点は (10, 3, 0)、すなわち u = 3。 */
const DIRECTION_OBLIQUE: Vec3 = normalize(vec3(1, 0.3, 0));

/** 交点がちょうど halfExtent（u = 5）に載る射出方向。 */
const DIRECTION_ON_EDGE: Vec3 = normalize(vec3(1, 0.5, 0));

/** 交点がちょうど halfExtent（v = 5）に載る射出方向。 */
const DIRECTION_ON_EDGE_V: Vec3 = normalize(vec3(1, 0, -0.5));

/** 交点が u = 8 となり、halfExtent = 5 をはみ出す射出方向。 */
const DIRECTION_OUTSIDE_U: Vec3 = normalize(vec3(1, 0.8, 0));

/** 交点が v = -8 となり、halfExtent = 5 をはみ出す射出方向。 */
const DIRECTION_OUTSIDE_V: Vec3 = normalize(vec3(1, 0, 0.8));

// ---------------------------------------------------------------------------
// A. projectPathsToScreen: 採用条件
// ---------------------------------------------------------------------------

describe('A. projectPathsToScreen: スクリーンに載る波長を選び出す', () => {
  it('正面から当たる波長は交差パラメータと交点を返す', () => {
    // Arrange
    const paths = [exitedPath(550, DIRECTION_HEAD_ON)];

    // Act
    const hit = hitAt(projectPathsToScreen(paths, SCREEN), 0);

    // Assert（方向が軸に平行なので厳密に決まる）
    expect(hit.t).toBe(10);
    expect(hit.point).toEqual(vec3(10, 0, 0));
  });

  it('正面から当たる波長の uv が面の中心になる', () => {
    // Arrange
    const paths = [exitedPath(550, DIRECTION_HEAD_ON)];

    // Act
    const hit = hitAt(projectPathsToScreen(paths, SCREEN), 0);

    // Assert（符号付きゼロを避けるため絶対値を経由した厳密比較）
    expect(Math.abs(hit.uv.u)).toBe(0);
    expect(Math.abs(hit.uv.v)).toBe(0);
  });

  it('斜めに当たる波長の uv が確定値と一致する（u = 3）', () => {
    // Arrange
    const paths = [exitedPath(550, DIRECTION_OBLIQUE)];

    // Act
    const hit = hitAt(projectPathsToScreen(paths, SCREEN), 0);

    // Assert（除算と内積を経るため許容差で見る）
    expect(Math.abs(hit.uv.u - 3)).toBeLessThanOrEqual(UV_TOLERANCE);
    expect(Math.abs(hit.uv.v)).toBeLessThanOrEqual(UV_TOLERANCE);
  });

  it('u が halfExtent ちょうどの波長は採用する（採用条件は < ではなく <=）', () => {
    // Arrange
    const paths = [exitedPath(550, DIRECTION_ON_EDGE)];

    // Act
    const hits = projectPathsToScreen(paths, SCREEN);

    // Assert（境界そのものを縛る。canTransmit の θ === θc と同じく境界の規約を固定する）
    expect(hits[0]).not.toBeNull();
    expect(Math.abs(hitAt(hits, 0).uv.u - 5)).toBeLessThanOrEqual(UV_TOLERANCE);
  });

  it('v が halfExtent ちょうどの波長も採用する（v 側の境界も <=）', () => {
    // Arrange
    const paths = [exitedPath(550, DIRECTION_ON_EDGE_V)];

    // Act
    const hits = projectPathsToScreen(paths, SCREEN);

    // Assert
    expect(hits[0]).not.toBeNull();
    expect(Math.abs(hitAt(hits, 0).uv.v - 5)).toBeLessThanOrEqual(UV_TOLERANCE);
  });

  it('u が halfExtent を超える波長は null になる（案 Q: 切り詰めない）', () => {
    // Arrange
    const paths = [exitedPath(550, DIRECTION_OUTSIDE_U)];

    // Act
    const hits = projectPathsToScreen(paths, SCREEN);

    // Assert
    expect(hits[0]).toBeNull();
  });

  it('v が halfExtent を超える波長は null になる', () => {
    // Arrange
    const paths = [exitedPath(550, DIRECTION_OUTSIDE_V)];

    // Act
    const hits = projectPathsToScreen(paths, SCREEN);

    // Assert
    expect(hits[0]).toBeNull();
  });

  it('termination が missed の波長は null になる', () => {
    // Arrange
    const paths = [unexitedPath(550, 'missed')];

    // Act
    const hits = projectPathsToScreen(paths, SCREEN);

    // Assert
    expect(hits[0]).toBeNull();
  });

  it('termination が bounceLimit の波長は null になる', () => {
    // Arrange
    const paths = [unexitedPath(550, 'bounceLimit')];

    // Act
    const hits = projectPathsToScreen(paths, SCREEN);

    // Assert
    expect(hits[0]).toBeNull();
  });

  it('termination が reflected の波長は null になる（入射面反射は投影しない）', () => {
    // Arrange: この光路は幾何としてはスクリーンに当たる向きに進んでいる。
    // それでも落ちるのは「透過して射出した光だけを映す」という採用条件のためであり、
    // 向きの偶然ではなく termination で弾いていることをここで縛る（TASKS 6-5b）
    const paths = [unexitedPath(550, 'reflected')];

    // Act
    const hits = projectPathsToScreen(paths, SCREEN);

    // Assert
    expect(hits[0]).toBeNull();
    // 同じ形の光路でも exited なら載る＝差は termination だけであることの対照
    expect(projectPathsToScreen([unexitedPath(550, 'exited')], SCREEN)[0]).not.toBeNull();
  });

  it('スクリーンが射出方向の後方にある波長は null になる（t < 0）', () => {
    // Arrange（-x へ射出するのでスクリーン x = 10 は後方）
    const paths = [exitedPath(550, vec3(-1, 0, 0))];

    // Act
    const hits = projectPathsToScreen(paths, SCREEN);

    // Assert
    expect(hits[0]).toBeNull();
  });

  it('内部区間が縮退していても最終区間から射出方向を取る（I-6 の規約）', () => {
    // Arrange（θ₁ = 0 の頂点直撃を模し、内部区間を長さ 0 にする）
    const paths = [exitedPath(550, DIRECTION_HEAD_ON, true)];

    // Act
    const hit = hitAt(projectPathsToScreen(paths, SCREEN), 0);

    // Assert（内部区間を使う実装なら NaN になり、この比較が落ちる）
    expect(hit.t).toBe(10);
  });

  it('出力の本数と並びが入力と一致する', () => {
    // Arrange
    const paths = [
      exitedPath(660, DIRECTION_HEAD_ON),
      exitedPath(550, DIRECTION_OUTSIDE_U),
      exitedPath(410, DIRECTION_OBLIQUE),
    ];

    // Act
    const hits = projectPathsToScreen(paths, SCREEN);

    // Assert
    expect(hits.length).toBe(3);
    expect(hits[1]).toBeNull();
    expect(Math.abs(hitAt(hits, 2).uv.u - 3)).toBeLessThanOrEqual(UV_TOLERANCE);
  });
});

// ---------------------------------------------------------------------------
// B. clipPathsToScreen: 描画用の打ち切り
// ---------------------------------------------------------------------------

describe('B. clipPathsToScreen: 載った波長だけ最終区間を交点まで縮める', () => {
  it('載った波長の最終区間が交点で終わる', () => {
    // Arrange
    const paths = [exitedPath(550, DIRECTION_HEAD_ON)];
    const hits = projectPathsToScreen(paths, SCREEN);

    // Act
    const clipped = clipPathsToScreen(paths, hits);
    const last = pathAt(clipped, 0).segments[2];

    // Assert（軸に平行なので厳密に決まる）
    expect(last?.end).toEqual(vec3(10, 0, 0));
    expect(lastSegmentLength(pathAt(clipped, 0))).toBe(10);
  });

  it('載った波長でも最終区間より前の区間は変えない', () => {
    // Arrange
    const paths = [exitedPath(550, DIRECTION_HEAD_ON)];
    const hits = projectPathsToScreen(paths, SCREEN);

    // Act
    const clipped = clipPathsToScreen(paths, hits);

    // Assert
    expect(pathAt(clipped, 0).segments[0]).toEqual(pathAt(paths, 0).segments[0]);
    expect(pathAt(clipped, 0).segments[1]).toEqual(pathAt(paths, 0).segments[1]);
  });

  it('はみ出した波長は打ち切らず 40 のままにする', () => {
    // Arrange（平面には当たるが |u| > halfExtent）
    const paths = [exitedPath(550, DIRECTION_OUTSIDE_U)];
    const hits = projectPathsToScreen(paths, SCREEN);

    // Act
    const clipped = clipPathsToScreen(paths, hits);

    // Assert
    expect(lastSegmentLength(pathAt(clipped, 0))).toBe(EXIT_EXTENSION_LENGTH);
  });

  it('射出しなかった波長は打ち切らず 40 のままにする', () => {
    // Arrange
    const paths = [unexitedPath(550, 'missed')];
    const hits = projectPathsToScreen(paths, SCREEN);

    // Act
    const clipped = clipPathsToScreen(paths, hits);

    // Assert
    expect(lastSegmentLength(pathAt(clipped, 0))).toBe(EXIT_EXTENSION_LENGTH);
  });

  it('入力の光路を書き換えない', () => {
    // Arrange
    const paths = [exitedPath(550, DIRECTION_HEAD_ON)];
    const hits = projectPathsToScreen(paths, SCREEN);

    // Act
    clipPathsToScreen(paths, hits);

    // Assert
    expect(lastSegmentLength(pathAt(paths, 0))).toBe(EXIT_EXTENSION_LENGTH);
  });

  it('波長・屈折率・終了理由をそのまま引き継ぐ', () => {
    // Arrange
    const paths = [exitedPath(410, DIRECTION_HEAD_ON)];
    const hits = projectPathsToScreen(paths, SCREEN);

    // Act
    const clipped = pathAt(clipPathsToScreen(paths, hits), 0);

    // Assert
    expect(clipped.wavelengthNm).toBe(410);
    expect(clipped.refractiveIndex).toBe(1.5);
    expect(clipped.termination).toBe('exited');
  });
});

// ---------------------------------------------------------------------------
// C. splitOnScreenRuns: 連続区間への切り分け
// ---------------------------------------------------------------------------

describe('C. splitOnScreenRuns: 脱落波長を跨がない', () => {
  /** 試験用の擬似ヒット。値は使われないので中身は問わない。 */
  const HIT: ScreenHit = { t: 1, point: vec3(0, 0, 0), uv: { u: 0, v: 0 }, intensity: 1 };

  it('途中の脱落で run が分かれる', () => {
    // Arrange
    const hits = [HIT, HIT, null, HIT];

    // Act
    const runs = splitOnScreenRuns(hits);

    // Assert
    expect(runs).toEqual([[0, 1], [3]]);
  });

  it('すべて載っていれば単一の run になる', () => {
    // Arrange
    const hits = [HIT, HIT, HIT, HIT];

    // Act
    const runs = splitOnScreenRuns(hits);

    // Assert
    expect(runs).toEqual([[0, 1, 2, 3]]);
  });

  it('ひとつも載っていなければ空になる', () => {
    // Arrange
    const hits = [null, null, null];

    // Act
    const runs = splitOnScreenRuns(hits);

    // Assert
    expect(runs).toEqual([]);
  });

  it('要素数 1 の run も返す（四角形にできるかは描画側の判断）', () => {
    // Arrange
    const hits = [null, HIT, null];

    // Act
    const runs = splitOnScreenRuns(hits);

    // Assert
    expect(runs).toEqual([[1]]);
  });

  it('先頭と末尾が脱落していても正しく切り分ける', () => {
    // Arrange
    const hits = [null, HIT, HIT, null, HIT, null];

    // Act
    const runs = splitOnScreenRuns(hits);

    // Assert
    expect(runs).toEqual([[1, 2], [4]]);
  });

  it('空の入力なら空を返す', () => {
    // Act
    const runs = splitOnScreenRuns([]);

    // Assert
    expect(runs).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// D. meanExitAnchor: スクリーン配置の基準
// ---------------------------------------------------------------------------

describe('D. meanExitAnchor: 射出点と射出方向の平均', () => {
  /** 射出点をずらした光路を作る。 */
  function exitedPathFrom(origin: Vec3, direction: Vec3): LightPath {
    return {
      wavelengthNm: 550,
      refractiveIndex: 1.5,
      segments: [
        segment(vec3(-4, 0, 0), origin, false),
        segment(origin, addScaled(origin, direction, EXIT_EXTENSION_LENGTH), false),
      ],
      termination: 'exited',
    };
  }

  it('射出点の平均を返す', () => {
    // Arrange
    const paths = [
      exitedPathFrom(vec3(0, 0, 0), DIRECTION_HEAD_ON),
      exitedPathFrom(vec3(0, 2, 0), DIRECTION_HEAD_ON),
    ];

    // Act
    const anchor = meanExitAnchor(paths);

    // Assert（軸に平行なので厳密に決まる）
    expect(anchor?.origin).toEqual(vec3(0, 1, 0));
  });

  it('射出方向の平均を正規化して返す', () => {
    // Arrange（(1,0,0) と (0,1,0) の平均 (0.5,0.5,0) を正規化する）
    const paths = [
      exitedPathFrom(vec3(0, 0, 0), vec3(1, 0, 0)),
      exitedPathFrom(vec3(0, 0, 0), vec3(0, 1, 0)),
    ];

    // Act
    const anchor = meanExitAnchor(paths);

    // Assert（平方根を経るため許容差で見る）
    expect(Math.abs((anchor?.direction.x ?? 0) - 0.7071067811865475)).toBeLessThanOrEqual(
      UV_TOLERANCE
    );
    expect(Math.abs((anchor?.direction.y ?? 0) - 0.7071067811865475)).toBeLessThanOrEqual(
      UV_TOLERANCE
    );
  });

  it('射出していない光路は平均に含めない', () => {
    // Arrange（射出したのは (0,2,0) の 1 本だけ）
    const paths = [
      unexitedPath(660, 'missed'),
      exitedPathFrom(vec3(0, 2, 0), DIRECTION_HEAD_ON),
      unexitedPath(410, 'bounceLimit'),
    ];

    // Act
    const anchor = meanExitAnchor(paths);

    // Assert
    expect(anchor?.origin).toEqual(vec3(0, 2, 0));
  });

  it('射出した光路が 1 本も無ければ null を返す', () => {
    // Arrange
    const paths = [unexitedPath(660, 'missed'), unexitedPath(410, 'bounceLimit')];

    // Act
    const anchor = meanExitAnchor(paths);

    // Assert
    expect(anchor).toBeNull();
  });

  it('空の入力なら null を返す', () => {
    // Act
    const anchor = meanExitAnchor([]);

    // Assert
    expect(anchor).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// E. 強度の透過保存（TASKS 6-5a）
// ---------------------------------------------------------------------------

describe('E. clipPathsToScreen: 強度は打ち切りで変わらない', () => {
  it('打ち切った最終区間の intensity が元の値のままである', () => {
    // Arrange: 区間を短くするのは描画の都合であって、光の強さには関与しない
    const attenuated = 0.42;
    const path: LightPath = {
      wavelengthNm: 550,
      refractiveIndex: 1.5,
      segments: [
        segment(vec3(-4, 0, 0), EXIT_ORIGIN, false, 1),
        segment(
          EXIT_ORIGIN,
          addScaled(EXIT_ORIGIN, DIRECTION_HEAD_ON, EXIT_EXTENSION_LENGTH),
          false,
          attenuated
        ),
      ],
      termination: 'exited',
    };
    const hits = projectPathsToScreen([path], SCREEN);

    // Act
    const clipped = pathAt(clipPathsToScreen([path], hits), 0);

    // Assert
    expect(clipped.segments[1]?.intensity).toBe(attenuated);
  });

  it('打ち切らない区間の intensity も変わらない', () => {
    // Arrange
    const path: LightPath = {
      wavelengthNm: 550,
      refractiveIndex: 1.5,
      segments: [
        segment(vec3(-4, 0, 0), EXIT_ORIGIN, false, 0.9),
        segment(
          EXIT_ORIGIN,
          addScaled(EXIT_ORIGIN, DIRECTION_HEAD_ON, EXIT_EXTENSION_LENGTH),
          false,
          0.42
        ),
      ],
      termination: 'exited',
    };
    const hits = projectPathsToScreen([path], SCREEN);

    // Act
    const clipped = pathAt(clipPathsToScreen([path], hits), 0);

    // Assert
    expect(clipped.segments[0]?.intensity).toBe(0.9);
  });
});
