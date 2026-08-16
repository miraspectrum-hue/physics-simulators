import { describe, expect, it } from 'vitest';

import { CONTINUOUS_SAMPLE_COUNT, MAX_BOUNCE_COUNT } from '../../src/optics/constants';
import { vec3 } from '../../src/optics/vec3';
import {
  MAX_SEGMENTS_PER_PATH,
  beamBufferLength,
  packSegmentPositions,
} from '../../src/scene/beamPacker';
import type { LightPath, Segment } from '../../src/types/optics';

/**
 * src/scene/beamPacker.ts の受け入れ条件。
 *
 * 対象:
 *   beamBufferLength(pathCount)          — 固定長バッファの要素数
 *   packSegmentPositions(paths, target)  — 光路を位置バッファへ詰める
 *
 * 設計判断:
 *   - 区間数は光路ごとに変わるが、バッファを毎回作り直すと更新のたびに割り当てが起きる。
 *     1 光路あたり最大区間数ぶんの枠を固定で取り、余りは縮退区間（始点＝終点）で埋める。
 *     縮退区間は長さ 0 なので描画されない。
 *   - 縮退の充填座標はその光路の**最終区間の終点**とする。原点はプリズムの内部にあり、
 *     描画側の実装次第では見えるアーティファクトになりうるため使わない。
 *   - 最大区間数は tracer の打ち切り条件から導く（入射 1 + 内部 MAX_BOUNCE_COUNT + 射出 1）。
 *   - Three には依存しない。色の変換は波長ごとに一定で初期化時に済むため、ここでは扱わない。
 *
 * 期待値は Float32 で厳密に表現できる値（整数・0.25・0.5 など）だけを使い、
 * 丸めを介さずに比較できるようにする。
 */

/** 3 区間の光路。射出まで到達した通常の形。 */
const THREE_SEGMENT_PATH: LightPath = {
  wavelengthNm: 660,
  refractiveIndex: 1.5,
  segments: [
    { start: vec3(-3, -0.5, 0), end: vec3(-0.5, 0.25, 0), insidePrism: false },
    { start: vec3(-0.5, 0.25, 0), end: vec3(0.5, 0.25, 0), insidePrism: true },
    { start: vec3(0.5, 0.25, 0), end: vec3(38, -12.5, 0), insidePrism: false },
  ],
  termination: 'exited',
};

/** 1 区間の光路。プリズムを外れて直進した形。 */
const ONE_SEGMENT_PATH: LightPath = {
  wavelengthNm: 410,
  refractiveIndex: 1.53,
  segments: [{ start: vec3(-5, 5, 0), end: vec3(35, 5, 0), insidePrism: false }],
  termination: 'missed',
};

/** 光路 1 本が占める要素数。 */
const FLOATS_PER_PATH = MAX_SEGMENTS_PER_PATH * 2 * 3;

/** 検証用のバッファを確保する。 */
function createTarget(pathCount: number): Float32Array {
  return new Float32Array(FLOATS_PER_PATH * pathCount);
}

/** 指定した光路・区間の枠から 6 要素（始点 xyz・終点 xyz）を取り出す。 */
function readSegment(
  buffer: Float32Array,
  pathIndex: number,
  segmentIndex: number
): number[] {
  const offset = pathIndex * FLOATS_PER_PATH + segmentIndex * 6;

  return [...buffer.slice(offset, offset + 6)];
}

// ---------------------------------------------------------------------------
// P-1. 固定長
// ---------------------------------------------------------------------------

describe('P-1. beamBufferLength: 固定長を返す', () => {
  it('1 光路あたり最大区間数は 入射1 + 内部MAX_BOUNCE_COUNT + 射出1 になる', () => {
    // Arrange & Act & Assert
    expect(MAX_SEGMENTS_PER_PATH).toBe(MAX_BOUNCE_COUNT + 2);
    expect(MAX_SEGMENTS_PER_PATH).toBe(8);
  });

  it('連続スペクトル 48 波長では 2304 要素になる', () => {
    // Arrange & Act
    const actual = beamBufferLength(CONTINUOUS_SAMPLE_COUNT);

    // Assert: 48 × 8 区間 × 2 端点 × 3 成分
    expect(actual).toBe(2304);
  });

  it('本数に比例する', () => {
    // Arrange & Act & Assert
    expect(beamBufferLength(1)).toBe(48);
    expect(beamBufferLength(2)).toBe(96);
  });
});

// ---------------------------------------------------------------------------
// P-2. 既知の詰め込み内容
// ---------------------------------------------------------------------------

describe('P-2. packSegmentPositions: 実区間が既知の座標で詰まる', () => {
  it('3 区間の光路が先頭 3 枠へ順に入る', () => {
    // Arrange
    const target = createTarget(1);

    // Act
    const actual = packSegmentPositions([THREE_SEGMENT_PATH], target);

    // Assert
    expect(readSegment(actual, 0, 0)).toEqual([-3, -0.5, 0, -0.5, 0.25, 0]);
    expect(readSegment(actual, 0, 1)).toEqual([-0.5, 0.25, 0, 0.5, 0.25, 0]);
    expect(readSegment(actual, 0, 2)).toEqual([0.5, 0.25, 0, 38, -12.5, 0]);
  });

  it('書き込んだバッファそのものを返す', () => {
    // Arrange
    const target = createTarget(1);

    // Act
    const actual = packSegmentPositions([THREE_SEGMENT_PATH], target);

    // Assert
    expect(actual).toBe(target);
  });
});

// ---------------------------------------------------------------------------
// P-3. 余りの縮退
// ---------------------------------------------------------------------------

describe('P-3. packSegmentPositions: 余った枠を縮退区間で埋める', () => {
  it('残り 5 枠すべてが始点＝終点になる', () => {
    // Arrange
    const target = createTarget(1);

    // Act
    const actual = packSegmentPositions([THREE_SEGMENT_PATH], target);

    // Assert
    for (let segmentIndex = 3; segmentIndex < MAX_SEGMENTS_PER_PATH; segmentIndex += 1) {
      const [sx, sy, sz, ex, ey, ez] = readSegment(actual, 0, segmentIndex);
      expect([sx, sy, sz]).toEqual([ex, ey, ez]);
    }
  });

  it('縮退の座標が光路の最終点であり、原点ではない', () => {
    // Arrange: 原点はプリズム内部にあり、見えるアーティファクトになりうるので使わない
    const target = createTarget(1);

    // Act
    const actual = packSegmentPositions([THREE_SEGMENT_PATH], target);

    // Assert
    expect(readSegment(actual, 0, 7)).toEqual([38, -12.5, 0, 38, -12.5, 0]);
  });

  it('区間が 1 本しかない光路では残り 7 枠がその終点で埋まる', () => {
    // Arrange
    const target = createTarget(1);

    // Act
    const actual = packSegmentPositions([ONE_SEGMENT_PATH], target);

    // Assert
    expect(readSegment(actual, 0, 0)).toEqual([-5, 5, 0, 35, 5, 0]);
    expect(readSegment(actual, 0, 1)).toEqual([35, 5, 0, 35, 5, 0]);
    expect(readSegment(actual, 0, 7)).toEqual([35, 5, 0, 35, 5, 0]);
  });
});

// ---------------------------------------------------------------------------
// P-4. 順序の保存
// ---------------------------------------------------------------------------

describe('P-4. packSegmentPositions: 光路の順序が保たれる', () => {
  it('渡した順に枠が割り当てられる', () => {
    // Arrange: 波長順に渡せば、バッファ上の並びも波長順になる
    const target = createTarget(2);

    // Act
    const actual = packSegmentPositions([THREE_SEGMENT_PATH, ONE_SEGMENT_PATH], target);

    // Assert
    expect(readSegment(actual, 0, 0)).toEqual([-3, -0.5, 0, -0.5, 0.25, 0]);
    expect(readSegment(actual, 1, 0)).toEqual([-5, 5, 0, 35, 5, 0]);
  });

  it('順序を入れ替えると枠の内容も入れ替わる', () => {
    // Arrange
    const target = createTarget(2);

    // Act
    const actual = packSegmentPositions([ONE_SEGMENT_PATH, THREE_SEGMENT_PATH], target);

    // Assert
    expect(readSegment(actual, 0, 0)).toEqual([-5, 5, 0, 35, 5, 0]);
    expect(readSegment(actual, 1, 0)).toEqual([-3, -0.5, 0, -0.5, 0.25, 0]);
  });

  it('先の光路の縮退が次の光路の枠を侵さない', () => {
    // Arrange
    const target = createTarget(2);

    // Act
    const actual = packSegmentPositions([THREE_SEGMENT_PATH, ONE_SEGMENT_PATH], target);

    // Assert: 1 本目の最後の枠と 2 本目の最初の枠が別の内容であること
    expect(readSegment(actual, 0, 7)).toEqual([38, -12.5, 0, 38, -12.5, 0]);
    expect(readSegment(actual, 1, 0)).toEqual([-5, 5, 0, 35, 5, 0]);
  });
});

// ---------------------------------------------------------------------------
// P-5. 異常系
// ---------------------------------------------------------------------------

describe('P-5. packSegmentPositions: 契約を満たさない入力を弾く', () => {
  it('バッファが短すぎれば RangeError を投げる', () => {
    // Arrange
    const tooShort = createTarget(1);

    // Act & Assert
    expect(() => packSegmentPositions([THREE_SEGMENT_PATH, ONE_SEGMENT_PATH], tooShort)).toThrow(
      RangeError
    );
  });

  it('バッファが長すぎても RangeError を投げる', () => {
    // Arrange
    const tooLong = createTarget(2);

    // Act & Assert
    expect(() => packSegmentPositions([THREE_SEGMENT_PATH], tooLong)).toThrow(RangeError);
  });

  it('区間を持たない光路があれば RangeError を投げる', () => {
    // Arrange: 縮退の充填座標を決められないため、黙って原点で埋めずに落とす
    const emptyPath: LightPath = {
      wavelengthNm: 500,
      refractiveIndex: 1.5,
      segments: [],
      termination: 'missed',
    };

    // Act & Assert
    expect(() => packSegmentPositions([emptyPath], createTarget(1))).toThrow(RangeError);
  });

  it('区間数が上限を超える光路があれば RangeError を投げる', () => {
    // Arrange: tracer は上限内に収めるが、詰め込み側でも黙って切り捨てない
    const tooManySegments: Segment[] = Array.from(
      { length: MAX_SEGMENTS_PER_PATH + 1 },
      () => ({ start: vec3(0, 0, 0), end: vec3(1, 0, 0), insidePrism: false })
    );
    const overflowPath: LightPath = {
      wavelengthNm: 500,
      refractiveIndex: 1.5,
      segments: tooManySegments,
      termination: 'bounceLimit',
    };

    // Act & Assert
    expect(() => packSegmentPositions([overflowPath], createTarget(1))).toThrow(RangeError);
  });
});
