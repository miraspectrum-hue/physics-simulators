import { describe, expect, it } from 'vitest';

import { CONTINUOUS_SAMPLE_COUNT, MAX_BOUNCE_COUNT } from '../../src/optics/constants';
import { vec3 } from '../../src/optics/vec3';
import {
  MAX_SEGMENTS_PER_PATH,
  beamBufferLength,
  packSegmentColors,
  packSegmentPositions,
} from '../../src/scene/beamPacker';
import type { LightPath, Segment } from '../../src/types/optics';

/**
 * src/scene/beamPacker.ts の受け入れ条件。
 *
 * 対象:
 *   beamBufferLength(pathCount)                  — 固定長バッファの要素数
 *   packSegmentPositions(paths, target)          — 光路を位置バッファへ詰める
 *   packSegmentColors(paths, baseColors, target) — 基準色 × 強度を頂点色バッファへ詰める
 *
 * 設計判断:
 *   - 区間数は光路ごとに変わるが、バッファを毎回作り直すと更新のたびに割り当てが起きる。
 *     1 光路あたり最大区間数ぶんの枠を固定で取り、余りは縮退区間（始点＝終点）で埋める。
 *     縮退区間は長さ 0 なので描画されない。
 *   - 縮退の充填座標はその光路の**最終区間の終点**とする。原点はプリズムの内部にあり、
 *     描画側の実装次第では見えるアーティファクトになりうるため使わない。
 *   - 最大区間数は tracer の打ち切り条件から導く（入射 1 + 内部 MAX_BOUNCE_COUNT + 射出 1）。
 *   - Three には依存しない。sRGB → 作業色空間の変換は波長ごとに一定で初期化時に済むため、
 *     ここが受け取るのは変換後の「基準色」であり、掛けるのは強度だけである。
 *   - **色の正しさと強度の正しさを別々に縛る**（6-3 オラクル①-a の分割と同じ方針）。
 *     色は RGB 比（強度に依らない量）で、強度は大きさで検証する。片方が壊れても
 *     もう片方のアサートは生き残るので、どちらが壊れたか切り分けられる。
 *
 * 期待値は Float32 で厳密に表現できる値（整数・0.25・0.5 など）だけを使い、
 * 丸めを介さずに比較できるようにする。
 */

/** 3 区間の光路。射出まで到達した通常の形。 */
const THREE_SEGMENT_PATH: LightPath = {
  wavelengthNm: 660,
  refractiveIndex: 1.5,
  segments: [
    { start: vec3(-3, -0.5, 0), end: vec3(-0.5, 0.25, 0), insidePrism: false, intensity: 1 },
    { start: vec3(-0.5, 0.25, 0), end: vec3(0.5, 0.25, 0), insidePrism: true, intensity: 1 },
    { start: vec3(0.5, 0.25, 0), end: vec3(38, -12.5, 0), insidePrism: false, intensity: 1 },
  ],
  termination: 'exited',
};

/** 1 区間の光路。プリズムを外れて直進した形。 */
const ONE_SEGMENT_PATH: LightPath = {
  wavelengthNm: 410,
  refractiveIndex: 1.53,
  segments: [{ start: vec3(-5, 5, 0), end: vec3(35, 5, 0), insidePrism: false, intensity: 1 }],
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
      () => ({ start: vec3(0, 0, 0), end: vec3(1, 0, 0), insidePrism: false, intensity: 1 })
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

// ---------------------------------------------------------------------------
// P-6. packSegmentColors: 基準色 × 区間の強度
//
//   期待値は Float32 で厳密に表現できる値だけを使う。基準色 (0.5, 0.25, 0.125) と
//   強度 0.75 / 0.25 の積はいずれも 2 の負冪の和なので、丸めが入らず toBe で比較できる。
// ---------------------------------------------------------------------------

/** 基準色 1 波長ぶん。3 チャンネルが相異なるので、比の検証で取り違えを検出できる。 */
const BASE_RGB = [0.5, 0.25, 0.125] as const;

/**
 * 区間ごとに強度が違う光路。入射 0.75 → 内部 0.75 → 射出 0.25 を模す。
 *
 * 実際の tracer も入射面で (1 − R) を掛け、射出面でもう一度掛けるので、
 * 「外部区間と射出区間で強度が違う」のがふつうの形になる。
 */
const VARYING_INTENSITY_PATH: LightPath = {
  wavelengthNm: 660,
  refractiveIndex: 1.5,
  segments: [
    { start: vec3(-3, 0, 0), end: vec3(-0.5, 0, 0), insidePrism: false, intensity: 0.75 },
    { start: vec3(-0.5, 0, 0), end: vec3(0.5, 0, 0), insidePrism: true, intensity: 0.75 },
    { start: vec3(0.5, 0, 0), end: vec3(38, 0, 0), insidePrism: false, intensity: 0.25 },
  ],
  termination: 'exited',
};

/** 基準色バッファを波長の並びぶん作る。 */
function createBase(...rgbList: readonly (readonly number[])[]): Float32Array {
  return new Float32Array(rgbList.flat());
}

/** 指定した光路・区間の枠から 6 要素（始点 rgb・終点 rgb）を取り出す。 */
function readColorFrame(
  buffer: Float32Array,
  pathIndex: number,
  segmentIndex: number
): number[] {
  const offset = pathIndex * FLOATS_PER_PATH + segmentIndex * 6;

  return [...buffer.slice(offset, offset + 6)];
}

describe('P-6-1. packSegmentColors: 色の正しさ（RGB 比・強度に依らない）', () => {
  it('頂点色の RGB 比が基準色の比と一致し、強度の違う区間どうしでも同じ比になる', () => {
    // Arrange: 割り算を使わずたすき掛けで比を比べる。強度が式から消えるので色だけを縛れる
    const target = createTarget(1);
    const [baseR, baseG, baseB] = BASE_RGB;

    // Act
    packSegmentColors([VARYING_INTENSITY_PATH], createBase(BASE_RGB), target);

    // Assert: 強度 0.75 の区間と 0.25 の区間の両方で r:g:b = 基準色の比
    for (const segmentIndex of [0, 2]) {
      const [r, g, b] = readColorFrame(target, 0, segmentIndex);

      expect((r ?? 0) * baseG).toBe((g ?? 0) * baseR);
      expect((g ?? 0) * baseB).toBe((b ?? 0) * baseG);
      expect((r ?? 0) * baseB).toBe((b ?? 0) * baseR);
    }
  });
});

describe('P-6-2. packSegmentColors: 強度の正しさ（大きさ）', () => {
  it('頂点色の大きさが「基準色 × その区間の intensity」と一致する', () => {
    // Arrange
    const target = createTarget(1);

    // Act
    packSegmentColors([VARYING_INTENSITY_PATH], createBase(BASE_RGB), target);

    // Assert: 0.5·0.75 = 0.375 / 0.25·0.75 = 0.1875 / 0.125·0.75 = 0.09375
    expect(readColorFrame(target, 0, 0)).toEqual([
      0.375, 0.1875, 0.09375, 0.375, 0.1875, 0.09375,
    ]);
    // 射出区間は 0.25 倍。0.5·0.25 = 0.125 / 0.25·0.25 = 0.0625 / 0.125·0.25 = 0.03125
    expect(readColorFrame(target, 0, 2)).toEqual([
      0.125, 0.0625, 0.03125, 0.125, 0.0625, 0.03125,
    ]);
  });
});

describe('P-6-3. packSegmentColors: 枠割り', () => {
  it('余った枠は最終区間の強度で埋める（位置側が最終点で縮退させるのと対になる）', () => {
    // Arrange
    const target = createTarget(1);

    // Act
    packSegmentColors([VARYING_INTENSITY_PATH], createBase(BASE_RGB), target);

    // Assert: 3 区間なので枠 3〜7 が余る。すべて射出区間（0.25 倍）と同じ値
    for (let segmentIndex = 3; segmentIndex < MAX_SEGMENTS_PER_PATH; segmentIndex += 1) {
      expect(readColorFrame(target, 0, segmentIndex)).toEqual([
        0.125, 0.0625, 0.03125, 0.125, 0.0625, 0.03125,
      ]);
    }
  });

  it('光路ごとに自分の基準色を使い、隣の光路へはみ出さない', () => {
    // Arrange: 2 本目は白（1, 1, 1）で強度 1 なので、混線すれば必ず値がずれる
    const target = createTarget(2);

    // Act
    packSegmentColors(
      [VARYING_INTENSITY_PATH, ONE_SEGMENT_PATH],
      createBase(BASE_RGB, [1, 1, 1]),
      target
    );

    // Assert: 1 本目の最後の枠と 2 本目の最初の枠が別の内容であること
    expect(readColorFrame(target, 0, 7)).toEqual([
      0.125, 0.0625, 0.03125, 0.125, 0.0625, 0.03125,
    ]);
    expect(readColorFrame(target, 1, 0)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('位置バッファと同じ枠に同じ区間が載る', () => {
    // Arrange: 位置と色を同じ入力で詰め、枠 2 が射出区間であることを両方で確かめる
    const positions = createTarget(1);
    const colors = createTarget(1);

    // Act
    packSegmentPositions([VARYING_INTENSITY_PATH], positions);
    packSegmentColors([VARYING_INTENSITY_PATH], createBase(BASE_RGB), colors);

    // Assert: 枠 2 は座標も色も射出区間のもの
    expect(readSegment(positions, 0, 2)).toEqual([0.5, 0, 0, 38, 0, 0]);
    expect(readColorFrame(colors, 0, 2)).toEqual([
      0.125, 0.0625, 0.03125, 0.125, 0.0625, 0.03125,
    ]);
  });
});

describe('P-6-4. packSegmentColors: 強度 0', () => {
  it('強度 0 の区間は黒になる（描かれないことがバッファ上でも読める）', () => {
    // Arrange
    const darkPath: LightPath = {
      wavelengthNm: 500,
      refractiveIndex: 1.5,
      segments: [
        { start: vec3(0, 0, 0), end: vec3(1, 0, 0), insidePrism: false, intensity: 0 },
      ],
      termination: 'missed',
    };
    const target = createTarget(1);

    // Act
    packSegmentColors([darkPath], createBase(BASE_RGB), target);

    // Assert
    expect(readColorFrame(target, 0, 0)).toEqual([0, 0, 0, 0, 0, 0]);
  });
});

describe('P-6-5. packSegmentColors: 契約を満たさない入力を弾く', () => {
  it('頂点色バッファの長さが合わなければ RangeError を投げる', () => {
    // Arrange
    const tooShort = createTarget(1);

    // Act & Assert
    expect(() =>
      packSegmentColors(
        [VARYING_INTENSITY_PATH, ONE_SEGMENT_PATH],
        createBase(BASE_RGB, [1, 1, 1]),
        tooShort
      )
    ).toThrow(RangeError);
  });

  it('基準色の本数が光路の本数と合わなければ RangeError を投げる', () => {
    // Arrange: 黙って 1 波長ぶんを使い回すと、全部が同じ色になる嘘の絵になる
    const target = createTarget(2);

    // Act & Assert
    expect(() =>
      packSegmentColors([VARYING_INTENSITY_PATH, ONE_SEGMENT_PATH], createBase(BASE_RGB), target)
    ).toThrow(RangeError);
  });

  it('区間を持たない光路があれば RangeError を投げる', () => {
    // Arrange: 充填に使う強度を決められないため、黙って 0 で埋めずに落とす
    const emptyPath: LightPath = {
      wavelengthNm: 500,
      refractiveIndex: 1.5,
      segments: [],
      termination: 'missed',
    };

    // Act & Assert
    expect(() => packSegmentColors([emptyPath], createBase(BASE_RGB), createTarget(1))).toThrow(
      RangeError
    );
  });

  it('区間数が上限を超える光路があれば RangeError を投げる', () => {
    // Arrange
    const tooManySegments: Segment[] = Array.from(
      { length: MAX_SEGMENTS_PER_PATH + 1 },
      () => ({ start: vec3(0, 0, 0), end: vec3(1, 0, 0), insidePrism: false, intensity: 1 })
    );
    const overflowPath: LightPath = {
      wavelengthNm: 500,
      refractiveIndex: 1.5,
      segments: tooManySegments,
      termination: 'bounceLimit',
    };

    // Act & Assert
    expect(() =>
      packSegmentColors([overflowPath], createBase(BASE_RGB), createTarget(1))
    ).toThrow(RangeError);
  });
});
