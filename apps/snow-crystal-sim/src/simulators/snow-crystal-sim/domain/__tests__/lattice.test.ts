import { describe, expect, it } from 'vitest';
import { MODEL_VERSION, createLattice } from '../index';
import type { CreateLatticeInput, LatticeState, ModelVersion, Seed128 } from '../index';

const input: CreateLatticeInput = { radius: 2, seed: [1, 2, 3, 4], beta: 0.2, noiseAmplitude: 0.3 };
const expectedNoise = [
  -0.9999946355819702, -1, -0.9972400069236755, -0.9670222401618958, -0.053905772510915995,
  -0.23760281316936016, -0.40058261435478926, 0.739180110860616, 0.736497784499079, 0.9828522596508265,
  -0.8426860882900655, -0.0022940360940992832, 0.6656266623176634, -0.06583534646779299, 0.8022201042622328,
  -0.5336008286103606, 0.7717429520562291, 0.07087027421221137, 0.6630655694752932,
];

const bitSnapshot = (values: Float64Array) => Array.from(values, (value) => {
  const data = new DataView(new ArrayBuffer(8)); data.setFloat64(0, value); return data.getBigUint64(0);
});
const snapshot = (state: ReturnType<typeof createLattice>) => ({
  waterMass: bitSnapshot(state.waterMass), ice: Array.from(state.ice), noise: bitSnapshot(state.noise),
  radius: state.radius, stepIndex: state.stepIndex, elapsedCa: state.elapsedCa, stopped: state.stopped,
  beta: state.beta, noiseAmplitude: state.noiseAmplitude, seed: [...state.seed], modelVersion: state.modelVersion,
});
const modelVersionTypeSentinel: ModelVersion = 'reiter-alpha1-xoshiro128ss-1.1-v1';
const latticeTypeSentinel: LatticeState = {
  radius: 2, waterMass: new Float64Array(19), ice: new Uint8Array(19), noise: new Float64Array(19),
  stepIndex: 0, elapsedCa: 0, stopped: false, beta: 0.2, noiseAmplitude: 0.3,
  seed: [1, 2, 3, 4], modelVersion: modelVersionTypeSentinel,
};
const seedWith = (index: number, value: unknown): Seed128 => [0, 0, 0, 1].map((item, current) => current === index ? value : item) as unknown as Seed128;

describe('TC-CREATE and TC-RNG-002A: createLattice', () => {
  it('TC-CREATE-001 creates the literal radius-two initial state and version', () => {
    const state = createLattice(input);
    expect(MODEL_VERSION).toBe('reiter-alpha1-xoshiro128ss-1.1-v1');
    expect(state.modelVersion).toBe('reiter-alpha1-xoshiro128ss-1.1-v1'); expect(state.modelVersion).toBe(MODEL_VERSION);
    expect(state.radius).toBe(2); expect(state.stepIndex).toBe(0); expect(Object.is(state.elapsedCa, +0)).toBe(true);
    expect(state.stopped).toBe(false); expect(state.beta).toBe(0.2); expect(state.noiseAmplitude).toBe(0.3); expect(state.seed).toEqual([1, 2, 3, 4]); expect(state.seed).not.toBe(input.seed);
    expect(state.waterMass).toBeInstanceOf(Float64Array); expect(state.ice).toBeInstanceOf(Uint8Array); expect(state.noise).toBeInstanceOf(Float64Array);
    expect(state.waterMass).toHaveLength(19); expect(state.ice).toHaveLength(19); expect(state.noise).toHaveLength(19);
    state.waterMass.forEach((value, index) => expect(value).toBe(index === 9 ? 1 : 0.2));
    state.ice.forEach((value, index) => expect(value).toBe(index === 9 ? 1 : 0));
    state.noise.forEach((value) => expect(value >= -1 && value < 1).toBe(true));
    expect(latticeTypeSentinel.radius).toBe(2);
  });

  it('TC-RNG-002A consumes one literal output per enumerated cell and is seed deterministic', () => {
    const first = createLattice(input); const second = createLattice(input); const changed = createLattice({ ...input, seed: [1, 2, 3, 5] });
    expect(bitSnapshot(first.noise)).toEqual(bitSnapshot(Float64Array.from(expectedNoise)));
    expect(snapshot(second)).toEqual(snapshot(first));
    expect(Array.from(changed.noise).some((value, index) => !Object.is(value, first.noise[index]))).toBe(true);
    expect(changed.seed).toEqual([1, 2, 3, 5]);
  });

  it('TC-CREATE-002 accepts beta/noise endpoints and changes only the allowed initial water metadata', () => {
    for (const [beta, noiseAmplitude] of [[0, 0], [0.95, 1]] as const) {
      const state = createLattice({ ...input, beta, noiseAmplitude });
      state.waterMass.forEach((value, index) => expect(value).toBe(index === 9 ? 1 : beta));
      expect(state.beta).toBe(beta); expect(state.noiseAmplitude).toBe(noiseAmplitude);
      expect(Array.from(state.noise)).toEqual(expectedNoise);
    }
  });

  it('TC-CREATE-003 validates radius before allocation and propagates impossible allocation RangeError', () => {
    for (const radius of [NaN, Infinity, -Infinity, '2' as unknown as number]) expect(() => createLattice({ ...input, radius })).toThrow(TypeError);
    for (const radius of [1, 2.5, 54794158]) expect(() => createLattice({ ...input, radius })).toThrow(RangeError);
    expect(() => createLattice({ ...input, radius: 54794157 })).toThrow(RangeError);
  });

  it('TC-CREATE-004 accepts valid uint32 seeds, normalizes negative zero, and rejects invalid variants', () => {
    for (const seed of [[0, 0, 0, 1], [4294967295, 4294967295, 4294967295, 4294967295]] as const) {
      const inputSeed: Seed128 = [...seed];
      const state = createLattice({ ...input, seed: inputSeed });
      expect(state.seed).toEqual(seed);
      expect(state.seed).not.toBe(inputSeed);
      expect(inputSeed).toEqual(seed);
    }
    const normalized = createLattice({ ...input, seed: [-0, 0, 0, 1] });
    expect(Object.is(normalized.seed[0], +0)).toBe(true);
    const minusZero: Seed128 = [-0, 0, 0, 1]; createLattice({ ...input, seed: minusZero }); expect(Object.is(minusZero[0], -0)).toBe(true);
    for (const seed of [[0, 0, 0, 0], [-1, 0, 0, 1], [0.5, 0, 0, 1], [4294967296, 0, 0, 1]] as unknown as Seed128[]) expect(() => createLattice({ ...input, seed })).toThrow(RangeError);
    for (const seed of [[], [1, 2, 3], [1, 2, 3, 4, 5], new Uint32Array([1, 2, 3, 4])] as unknown as Seed128[]) expect(() => createLattice({ ...input, seed })).toThrow(TypeError);
    for (let index = 0; index < 4; index += 1) {
      for (const value of [NaN, Infinity, -Infinity, '1']) expect(() => createLattice({ ...input, seed: seedWith(index, value) })).toThrow(TypeError);
      for (const value of [-1, 0.5, 4294967296]) expect(() => createLattice({ ...input, seed: seedWith(index, value) })).toThrow(RangeError);
    }
  });

  it('TC-CREATE-005 accepts interior values and rejects beta/noise values by range or type', () => {
    expect(createLattice({ ...input, beta: 0.5 }).beta).toBe(0.5);
    expect(createLattice({ ...input, noiseAmplitude: 0.5 }).noiseAmplitude).toBe(0.5);
    for (const value of [-1e-12, 0.950000000001]) expect(() => createLattice({ ...input, beta: value })).toThrow(RangeError);
    for (const value of [NaN, Infinity, -Infinity]) expect(() => createLattice({ ...input, beta: value })).toThrow(TypeError);
    expect(() => createLattice({ ...input, beta: '0.2' as unknown as number })).toThrow(TypeError);
    for (const value of [-1e-12, 1.000000000001]) expect(() => createLattice({ ...input, noiseAmplitude: value })).toThrow(RangeError);
    for (const value of [NaN, Infinity, -Infinity]) expect(() => createLattice({ ...input, noiseAmplitude: value })).toThrow(TypeError);
    expect(() => createLattice({ ...input, noiseAmplitude: '0.3' as unknown as number })).toThrow(TypeError);
  });

  it('TC-CREATE-006 preserves the documented validation order', () => {
    expect(() => createLattice({ ...input, radius: NaN, seed: [-1, 0, 0, 1] })).toThrow(TypeError);
    expect(() => createLattice({ ...input, radius: 1, seed: [NaN, 0, 0, 1] })).toThrow(RangeError);
    expect(() => createLattice({ ...input, seed: [-1, NaN, 0, 1] })).toThrow(RangeError);
    expect(() => createLattice({ ...input, seed: [1, -1, NaN, 1] })).toThrow(RangeError);
    expect(() => createLattice({ ...input, seed: [1, 2, -1, NaN] })).toThrow(RangeError);
    expect(() => createLattice({ ...input, seed: [1, 2, 3, -1], beta: NaN })).toThrow(RangeError);
    expect(() => createLattice({ ...input, seed: [0, 0, 0, 0], beta: NaN })).toThrow(RangeError);
    expect(() => createLattice({ ...input, beta: NaN, noiseAmplitude: -1 })).toThrow(TypeError);
    expect(() => createLattice({ ...input, beta: -1, noiseAmplitude: NaN })).toThrow(RangeError);
    expect(() => createLattice({ ...input, noiseAmplitude: NaN })).toThrow(TypeError);
    expect(() => createLattice({ ...input, radius: 54794157, noiseAmplitude: NaN })).toThrow(TypeError);
  });

  it('TC-CREATE-007 does not mutate inputs or share state across calls', () => {
    const frozenSeed = Object.freeze([1, 2, 3, 4]) as unknown as Seed128;
    const frozenInput = Object.freeze({ radius: 2, seed: frozenSeed, beta: 0.2, noiseAmplitude: 0.3 });
    const first = createLattice(frozenInput); const second = createLattice(frozenInput);
    first.waterMass[0] = 123; first.ice[0] = 1; first.noise[0] = 0;
    const third = createLattice(frozenInput);
    expect(frozenInput).toEqual(input); expect(frozenSeed).toEqual([1, 2, 3, 4]);
    for (const [left, right] of [[first, second], [first, third], [second, third]] as const) {
      expect(left.waterMass).not.toBe(right.waterMass);
      expect(left.ice).not.toBe(right.ice);
      expect(left.noise).not.toBe(right.noise);
      expect(left.seed).not.toBe(right.seed);
    }
    expect(snapshot(second)).toEqual(snapshot(third));
    expect(() => createLattice({ ...input, seed: [0, 0, 0, 0] })).toThrow(RangeError);
    expect(snapshot(createLattice(frozenInput))).toEqual(snapshot(third));
  });
});
