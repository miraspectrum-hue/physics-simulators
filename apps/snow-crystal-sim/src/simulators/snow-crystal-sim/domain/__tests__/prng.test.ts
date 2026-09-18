import { describe, expect, it } from 'vitest';
import { nextXoshiro128ss, uint32ToNoise } from '../index';
import type { Seed128, Xoshiro128ssResult } from '../index';

const seed: Seed128 = [1, 2, 3, 4];
const vectors: readonly [Seed128, number, Seed128][] = [
  [[1, 2, 3, 4], 11520, [7, 0, 1026, 12288]],
  [[7, 0, 1026, 12288], 0, [12295, 1029, 1029, 25165824]],
  [[12295, 1029, 1029, 25165824], 5927040, [25179138, 12295, 540162, 2107404]],
  [[25179138, 12295, 540162, 2107404], 70819200, [27274249, 25704967, 31982592, 12605441]],
  [[27274249, 25704967, 31982592, 12605441], 2031721883, [15224335, 29364750, 272377353, 1125134346]],
];
const outputs19 = [11520, 0, 5927040, 70819200, 2031721883, 1637235492, 1287239034, 3734860849, 3729100597, 4258142804, 337829053, 2142557243, 3576906021, 2006103318, 3870238204, 1001584594, 3804789018, 2299676403, 3571406116];
const resultTypeSentinel: Xoshiro128ssResult = { output: 11520, state: [7, 0, 1026, 12288] };
const replaceAt = (index: number, value: unknown): Seed128 => [0, 0, 0, 1].map((item, current) => current === index ? value : item) as unknown as Seed128;
const binary64Bits = (value: number) => {
  const buffer = new ArrayBuffer(8);
  const view = new DataView(buffer);
  view.setFloat64(0, value, false);
  return view.getBigUint64(0, false);
};

describe('TC-RNG-001: xoshiro128** v1.1', () => {
  it('uses the five published literal vectors without mutating input tuples', () => {
    for (const [input, output, state] of vectors) {
      const frozen = Object.freeze([...input]) as unknown as Seed128;
      expect(nextXoshiro128ss(frozen)).toEqual({ output, state });
      expect(frozen).toEqual(input);
    }
  });

  it('consumes exactly nineteen literal outputs and reaches the sentinel state', () => {
    let current: Seed128 = seed;
    const actual: number[] = [];
    for (let index = 0; index < 19; index += 1) {
      const result = nextXoshiro128ss(current);
      actual.push(result.output);
      current = result.state;
    }
    expect(actual).toEqual(outputs19);
    expect(current).toEqual([2456999277, 4279822836, 334074982, 4097125698]);
  });

  it('maps uint32 literals to exact binary64 noise values', () => {
    expect(uint32ToNoise(0)).toBe(-1);
    expect(uint32ToNoise(11520)).toBe(-0.9999946355819702);
    expect(Object.is(uint32ToNoise(2147483648), +0)).toBe(true);
    expect(uint32ToNoise(4294967295)).toBe(0.9999999995343387);
  });

  it('rejects invalid seed shape, members, and all-zero state with the specified class', () => {
    for (const value of [[], [1, 2, 3], [1, 2, 3, 4, 5], new Uint32Array([1, 2, 3, 4])]) expect(() => nextXoshiro128ss(value as unknown as Seed128)).toThrow(TypeError);
    for (const value of [[0, 0, 0, 0], [-1, 0, 0, 1], [0.5, 0, 0, 1], [4294967296, 0, 0, 1]]) expect(() => nextXoshiro128ss(value as unknown as Seed128)).toThrow(RangeError);
    for (let index = 0; index < 4; index += 1) {
      for (const value of [NaN, Infinity, -Infinity, '1']) expect(() => nextXoshiro128ss(replaceAt(index, value))).toThrow(TypeError);
      for (const value of [-1, 0.5, 4294967296]) expect(() => nextXoshiro128ss(replaceAt(index, value))).toThrow(RangeError);
    }
    expect(() => nextXoshiro128ss([-1, NaN, 0, 1])).toThrow(RangeError);
    expect(() => nextXoshiro128ss([1, -1, NaN, 1])).toThrow(RangeError);
    expect(() => nextXoshiro128ss([1, 2, -1, NaN])).toThrow(RangeError);
    const zeroSeed: Seed128 = [0, 0, 0, 1];
    const minusZero: Seed128 = [-0, 0, 0, 1];
    const zeroResult = nextXoshiro128ss(zeroSeed);
    const normalized = nextXoshiro128ss(minusZero);
    expect(zeroResult).toEqual({ output: 0, state: [1, 0, 0, 2048] });
    expect(normalized).toEqual({ output: 0, state: [1, 0, 0, 2048] });
    expect(Object.is(minusZero[0], -0)).toBe(true);
    const maxSeedResult = nextXoshiro128ss([4294967295, 4294967295, 4294967295, 4294967295]);
    for (const uint32 of [maxSeedResult.output, ...maxSeedResult.state]) {
      expect(Number.isInteger(uint32) && uint32 >= 0 && uint32 <= 4294967295).toBe(true);
    }
    expect(resultTypeSentinel).toEqual({ output: 11520, state: [7, 0, 1026, 12288] });
  });

  it('rejects invalid uint32 values and remains pure', () => {
    for (const value of [NaN, Infinity, -Infinity, '1' as unknown as number]) expect(() => uint32ToNoise(value)).toThrow(TypeError);
    for (const value of [-1, 0.5, 4294967296]) expect(() => uint32ToNoise(value)).toThrow(RangeError);
    const expectedNoise = 0.6630655694752932;
    const expectedNoiseBits = 0x3fe537d549000000n;
    const firstNoise = uint32ToNoise(3571406116);
    const secondNoise = uint32ToNoise(3571406116);
    expect(Object.is(firstNoise, expectedNoise)).toBe(true);
    expect(Object.is(secondNoise, expectedNoise)).toBe(true);
    expect(binary64Bits(firstNoise)).toBe(expectedNoiseBits);
    expect(binary64Bits(secondNoise)).toBe(expectedNoiseBits);
    const frozen = Object.freeze([1, 2, 3, 4]) as unknown as Seed128;
    expect(nextXoshiro128ss(frozen)).toEqual(nextXoshiro128ss(frozen));
    expect(frozen).toEqual([1, 2, 3, 4]);
  });
});
