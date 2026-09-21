import { describe, expect, it } from 'vitest';
import { vaporBudget } from '../index';
import type { LatticeState, Seed128, VaporBudget } from '../index';

const VERSION = 'reiter-alpha1-xoshiro128ss-1.1-v1';
const RADIUS = 2;
const CELL_COUNT = 19;
const CENTER = 9;
const INNER = 10;
const RING_CORNER = 11;
const RING_EDGE = 15;
const EPSILON = Number.EPSILON;
const MAX = Number.MAX_VALUE;
const directions: readonly (readonly [number, number])[] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

type LooseState = Record<string, unknown>;
type TestState = { -readonly [K in keyof LatticeState]: LatticeState[K] };
type Bits = { readonly kind: 'typed'; readonly bytes: readonly number[]; readonly constructor: string; readonly length: number; readonly ref: object };
type Captured = Bits | { readonly kind: 'number'; readonly bits: bigint } | { readonly kind: 'primitive'; readonly type: string; readonly value: unknown } | { readonly kind: 'function'; readonly ref: object } | { readonly kind: 'object' | 'array'; readonly ref: object; readonly ownKeys: readonly string[]; readonly properties: readonly [string, CapturedDescriptor][] };
type CapturedDescriptor = { readonly kind: 'data'; readonly configurable: boolean; readonly enumerable: boolean; readonly writable: boolean; readonly value: Captured } | { readonly kind: 'accessor'; readonly configurable: boolean; readonly enumerable: boolean; readonly get: Captured; readonly set: Captured };

function makeState(): TestState {
  const waterMass = new Float64Array(CELL_COUNT).fill(1 / 8);
  waterMass[CENTER] = 1;
  const ice = new Uint8Array(CELL_COUNT);
  ice[CENTER] = 1;
  return { radius: RADIUS, waterMass, ice, noise: new Float64Array(CELL_COUNT), stepIndex: 0, elapsedCa: 0, stopped: false, beta: 1 / 8, noiseAmplitude: 0, seed: [1, 2, 3, 4], modelVersion: VERSION };
}

function cloneState(state: LatticeState): TestState {
  return { ...state, waterMass: new Float64Array(state.waterMass), ice: new Uint8Array(state.ice), noise: new Float64Array(state.noise), seed: [...state.seed] as Seed128 };
}

function bytes(value: ArrayBufferView): Bits {
  return { kind: 'typed', bytes: Array.from(new Uint8Array(value.buffer, value.byteOffset, value.byteLength)), constructor: value.constructor.name, length: (value as unknown as { length: number }).length, ref: value };
}

function numberBits(value: number): bigint {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, false);
  return view.getBigUint64(0, false);
}

function descriptorSnapshot(descriptor: PropertyDescriptor): CapturedDescriptor {
  if ('value' in descriptor) return { kind: 'data', configurable: descriptor.configurable === true, enumerable: descriptor.enumerable === true, writable: descriptor.writable === true, value: snapshot(descriptor.value) };
  return { kind: 'accessor', configurable: descriptor.configurable === true, enumerable: descriptor.enumerable === true, get: snapshot(descriptor.get), set: snapshot(descriptor.set) };
}
function snapshot(value: unknown): Captured {
  if (typeof value === 'number') return { kind: 'number', bits: numberBits(value) };
  if (value === null || (typeof value !== 'object' && typeof value !== 'function')) return { kind: 'primitive', type: typeof value, value };
  if (typeof value === 'function') return { kind: 'function', ref: value };
  if (ArrayBuffer.isView(value)) return bytes(value);
  const object = value as object; const ownKeys = Object.getOwnPropertyNames(object);
  return { kind: Array.isArray(object) ? 'array' : 'object', ref: object, ownKeys, properties: ownKeys.map((name) => [name, descriptorSnapshot(Object.getOwnPropertyDescriptor(object, name)!)] as [string, CapturedDescriptor]) };
}
function expectReferences(before: Captured, after: Captured): void {
  expect(after.kind).toBe(before.kind);
  if (before.kind === 'typed' && after.kind === 'typed') { expect(after.ref).toBe(before.ref); return; }
  if (before.kind === 'function' && after.kind === 'function') { expect(after.ref).toBe(before.ref); return; }
  if ((before.kind === 'object' || before.kind === 'array') && (after.kind === 'object' || after.kind === 'array')) {
    expect(after.ref).toBe(before.ref); for (let index = 0; index < before.properties.length; index += 1) { const left = before.properties[index]![1]; const right = after.properties[index]![1]; if (left.kind === 'data' && right.kind === 'data') expectReferences(left.value, right.value); else if (left.kind === 'accessor' && right.kind === 'accessor') { expectReferences(left.get, right.get); expectReferences(left.set, right.set); } }
  }
}
function expectUnchanged(value: unknown, before: Captured): void { const after = snapshot(value); expect(after).toEqual(before); expectReferences(before, after); }
function reportedField(error: unknown): string | undefined {
  return String(error).match(/(?:waterMass|ice|noise|seed)\[\d+\]|\b(?:state|radius|waterMass|ice|noise|stepIndex|elapsedCa|stopped|beta|noiseAmplitude|modelVersion|seed)\b/)?.[0];
}
function expectError(value: unknown, expected: new (...args: never[]) => Error, field: string): void {
  const before = snapshot(value);
  let thrown: unknown;
  try { vaporBudget(value as LatticeState); } catch (error) { thrown = error; }
  expect(thrown).toBeInstanceOf(expected); expect(reportedField(thrown)).toBe(field);
  expectUnchanged(value, before);
}
function audit(state: LatticeState): VaporBudget { const before = snapshot(state); const result = vaporBudget(state); expectUnchanged(state, before); return result; }
function expectValid(state: LatticeState): void { audit(state); }
function expectStateError(value: unknown): void { const before = snapshot(value); let thrown: unknown; try { vaporBudget(value as LatticeState); } catch (error) { thrown = error; } expect(thrown).toBeInstanceOf(TypeError); expect(reportedField(thrown)).toBe('state'); expectUnchanged(value, before); }
function tau(expected: number): number { return 32 * EPSILON * Math.max(1, Math.abs(expected)); }
function expectNear(actual: number, expected: number): void { expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tau(expected)); }

function coordinates(radius: number): readonly (readonly [number, number])[] {
  const result: [number, number][] = [];
  for (let r = -radius; r <= radius; r += 1) for (let q = Math.max(-radius, -radius - r); q <= Math.min(radius, radius - r); q += 1) result.push([q, r]);
  return result;
}
function coordinateIndex(radius: number): ReadonlyMap<string, number> { return new Map(coordinates(radius).map(([q, r], index) => [`${q},${r}`, index])); }
function acceptance(state: LatticeState): readonly boolean[] {
  const cells = coordinates(state.radius); const byCoord = coordinateIndex(state.radius);
  const ice = new Set(cells.filter((_, index) => state.ice[index] === 1).map(([q, r]) => `${q},${r}`));
  return cells.map(([q, r]) => ice.has(`${q},${r}`) || directions.some(([dq, dr]) => byCoord.has(`${q + dq},${r + dr}`) && ice.has(`${q + dq},${r + dr}`)));
}
function rationalTotals(state: LatticeState, denominator: bigint): VaporBudget {
  const accepted = acceptance(state); let mobile = 0n; let deposited = 0n; let count = 0;
  for (let index = 0; index < state.waterMass.length; index += 1) { const units = BigInt(Math.round(state.waterMass[index]! * Number(denominator))); if (accepted[index]) deposited += units; else mobile += units; if (state.ice[index] === 1) count += 1; }
  return { mobileVapor: Number(mobile) / Number(denominator), depositedWater: Number(deposited) / Number(denominator), totalWater: Number(mobile + deposited) / Number(denominator), iceCellCount: count };
}
function rotate60(q: number, r: number): readonly [number, number] { return [-r, q + r]; }
function rotated(state: LatticeState): TestState {
  const result = makeState(); result.waterMass.fill(0); result.ice.fill(0); result.noise.fill(0);
  const index = coordinateIndex(state.radius);
  for (const [[q, r], source] of coordinates(state.radius).map((cell, i) => [cell, i] as const)) { const [nq, nr] = rotate60(q, r); const target = index.get(`${nq},${nr}`)!; result.waterMass[target] = state.waterMass[source]!; result.ice[target] = state.ice[source]!; result.noise[target] = state.noise[source]!; }
  return { ...result, stepIndex: state.stepIndex, elapsedCa: state.elapsedCa, stopped: state.stopped, beta: state.beta, noiseAmplitude: state.noiseAmplitude, seed: [...state.seed] as Seed128 };
}

function budget02(): TestState { const state = makeState(); state.ice[INNER] = 1; state.waterMass[INNER] = 3 / 2; state.waterMass[RING_CORNER] = 1 / 4; return state; }
function replace(state: LatticeState, name: keyof LatticeState, value: unknown): LooseState { return { ...state, [name]: value }; }
function sized(kind: 'waterMass' | 'ice' | 'noise', length: number): ArrayBufferView { return kind === 'ice' ? new Uint8Array(length) : new Float64Array(length); }
function validAt(state: LatticeState, update: (copy: TestState) => void): void { const copy = cloneState(state); update(copy); expectValid(copy); }

describe('VB-01–09: independent vapor-budget classification and numerical behavior', () => {
  it('VB-01 classifies all 19 cells using the paper axial-neighbor oracle', () => {
    const state = makeState(); state.waterMass.fill(2 / 5); state.waterMass[CENTER] = 1; state.beta = 2 / 5;
    expect(acceptance(state).filter(Boolean)).toHaveLength(7);
    const result = audit(state); expectNear(result.depositedWater, 17 / 5); expectNear(result.mobileVapor, 24 / 5); expectNear(result.totalWater, 41 / 5); expect(result.iceCellCount).toBe(1);
  });
  it('VB-02 counts ring acceptance separately from ice count and uses exact dyadic totals', () => {
    const state = budget02(); const expected = rationalTotals(state, 8n); const result = audit(state);
    expect(acceptance(state).filter(Boolean)).toHaveLength(10); expect(result).toEqual(expected); expect(result).toEqual({ depositedWater: 29 / 8, mobileVapor: 9 / 8, totalWater: 19 / 4, iceCellCount: 2 });
  });
  it('VB-03 accepts an ice-free state and does not infer ice from water mass', () => {
    const state = makeState(); state.ice.fill(0); state.waterMass.fill(1 / 8); const result = audit(state);
    expect(result.mobileVapor).toBe(19 / 8); expect(Object.is(result.depositedWater, +0)).toBe(true); expect(result.totalWater).toBe(19 / 8); expect(result.iceCellCount).toBe(0);
  });
  it('VB-04 audits stopped states without a fixed-point shortcut', () => {
    const state = makeState(); state.stopped = true; state.stepIndex = 7; state.elapsedCa = 7 / 2; const result = audit(state);
    expect(result).toEqual({ depositedWater: 7 / 4, mobileVapor: 3 / 2, totalWater: 13 / 4, iceCellCount: 1 });
  });
  it('VB-05 preserves total while moving all water between classification phases', () => {
    const state = budget02(); state.ice.fill(0); const result = audit(state);
    expect(result).toEqual({ depositedWater: 0, mobileVapor: 19 / 4, totalWater: 19 / 4, iceCellCount: 0 });
  });
  it('VB-06 is covariant under independently mapped whole-lattice 60 degree rotation', () => {
    const base = budget02(); const rotatedState = rotated(base); const result = audit(rotatedState); expect(result).toEqual({ depositedWater: 29 / 8, mobileVapor: 9 / 8, totalWater: 19 / 4, iceCellCount: 2 });
  });
  it('VB-07 normalizes result zeros but preserves an input negative-zero bit', () => {
    const state = makeState(); state.ice.fill(0); state.waterMass.fill(0); state.waterMass[0] = -0; const result = audit(state);
    expect(Object.is(result.mobileVapor, +0)).toBe(true); expect(Object.is(result.depositedWater, +0)).toBe(true); expect(Object.is(result.totalWater, +0)).toBe(true);
  });
  it('VB-08 uses Kahan for mobile vapor in fixed enumeration order', () => {
    const state = makeState(); state.ice.fill(0); state.waterMass.fill(0); state.waterMass[0] = 2 ** 53; for (let i = 1; i <= 4; i += 1) state.waterMass[i] = 1;
    expect(audit(state)).toEqual({ mobileVapor: 2 ** 53 + 4, depositedWater: 0, totalWater: 2 ** 53 + 4, iceCellCount: 0 });
  });
  it('VB-08D uses a distinct Kahan accumulator for deposited water', () => {
    const state = makeState(); state.waterMass.fill(0); for (const index of [4, 5, 8, 9, 10]) state.waterMass[index] = index === 4 ? 2 ** 53 : 1;
    expect(acceptance(state).map((yes, i) => yes ? i : -1).filter((i) => i >= 0)).toEqual([4, 5, 8, 9, 10, 13, 14]);
    const result = audit(state); expect(result.depositedWater).toBe(2 ** 53 + 4); expect(Object.is(result.mobileVapor, +0)).toBe(true); expect(result.totalWater).toBe(2 ** 53 + 4); expect(result.iceCellCount).toBe(1);
  });
  it('VB-09 is bit deterministic, pure, and returns a new budget object', () => {
    const first = budget02(); const second = cloneState(first); const a = audit(first); const b = audit(second);
    expect([a.mobileVapor, a.depositedWater, a.totalWater, a.iceCellCount].map(numberBits)).toEqual([b.mobileVapor, b.depositedWater, b.totalWater, b.iceCellCount].map(numberBits)); expect(a).not.toBe(b); expect(a).not.toBe(first as unknown as VaporBudget); expect(b).not.toBe(second as unknown as VaporBudget);
  });
});

describe('VB-O1–O3: finite-cell aggregate overflow', () => {
  const cases: readonly [string, (state: LatticeState) => void, string][] = [
    ['VB-O1 mobileVapor', (s) => { s.ice.fill(0); s.waterMass.fill(0); s.waterMass[0] = MAX; s.waterMass[1] = MAX; }, 'mobileVapor'],
    ['VB-O2 depositedWater', (s) => { s.waterMass.fill(0); s.waterMass[CENTER] = MAX; s.waterMass[INNER] = MAX; }, 'depositedWater'],
    ['VB-O3 totalWater', (s) => { s.waterMass.fill(0); s.waterMass[CENTER] = MAX; s.waterMass[RING_CORNER] = MAX; }, 'totalWater'],
  ];
  for (const [id, setup, field] of cases) it(id, () => { const state = makeState(); setup(state); expectError(state, RangeError, field); });
});

describe('VB-V01–V23: complete validation table and endpoint acceptance', () => {
  it('VB-V01 rejects non-object state values with the state field', () => { for (const value of [null, undefined, 1, 'state', []]) expectStateError(value); });
  it('VB-V02–V03 validates radius before allocation', () => { for (const value of ['2', NaN, Infinity, -Infinity]) expectError(replace(makeState(), 'radius', value), TypeError, 'radius'); for (const value of [1, 1.5, 2 ** 53, 2 ** 26]) expectError(replace(makeState(), 'radius', value), RangeError, 'radius'); expectValid(makeState()); });
  it('VB-V04–V05 validates all array classes and both adjacent lengths', () => {
    for (const [field, bad] of [['waterMass', [[], new Float32Array(CELL_COUNT), null]], ['ice', [[], new Int8Array(CELL_COUNT), null]], ['noise', [[], new Float32Array(CELL_COUNT), null]]] as const) for (const value of bad) expectError(replace(makeState(), field, value), TypeError, field);
    for (const field of ['waterMass', 'ice', 'noise'] as const) for (const length of [18, 20]) expectError(replace(makeState(), field, sized(field, length)), RangeError, field);
  });
  it('VB-V06–V10 validates metadata primitive types, ranges, and accepted endpoints', () => {
    for (const value of ['0', NaN, Infinity, -Infinity]) expectError(replace(makeState(), 'stepIndex', value), TypeError, 'stepIndex'); for (const value of [-1, 1 / 2, 2 ** 53]) expectError(replace(makeState(), 'stepIndex', value), RangeError, 'stepIndex'); validAt(makeState(), (s) => { s.stepIndex = Number.MAX_SAFE_INTEGER; });
    for (const value of ['0', NaN, Infinity, -Infinity]) expectError(replace(makeState(), 'elapsedCa', value), TypeError, 'elapsedCa'); expectError(replace(makeState(), 'elapsedCa', -Number.MIN_VALUE), RangeError, 'elapsedCa'); validAt(makeState(), (s) => { s.elapsedCa = -0; }); validAt(makeState(), (s) => { s.elapsedCa = Number.MIN_VALUE; });
    for (const value of [0, 'false', null]) expectError(replace(makeState(), 'stopped', value), TypeError, 'stopped'); validAt(makeState(), (s) => { s.stopped = true; });
  });
  it('VB-V11–V15 validates beta, noise amplitude, and exact model version', () => {
    for (const [field, maximum] of [['beta', 0.95], ['noiseAmplitude', 1]] as const) { for (const value of ['0', NaN, Infinity, -Infinity]) expectError(replace(makeState(), field, value), TypeError, field); for (const value of [-Number.MIN_VALUE, maximum + EPSILON]) expectError(replace(makeState(), field, value), RangeError, field); validAt(makeState(), (s) => { s[field] = 0; }); validAt(makeState(), (s) => { s[field] = maximum; }); }
    for (const value of ['wrong-version', '', 1, null]) expectError(replace(makeState(), 'modelVersion', value), TypeError, 'modelVersion');
  });
  it('VB-V16–V19 validates seed shape, members, order, and all-zero state', () => {
    for (const seed of [null, new Uint32Array([1, 2, 3, 4]), [1, 2, 3], [1, 2, 3, 4, 5]]) expectError(replace(makeState(), 'seed', seed), TypeError, 'seed');
    validAt(makeState(), (s) => { s.seed = [0, 0, 0, 1]; });
    for (let index = 0; index < 4; index += 1) for (const value of [0, 0xffffffff]) validAt(makeState(), (s) => { const seed: [number, number, number, number] = [1, 2, 3, 4]; seed[index] = value; if (seed.every((part) => part === 0)) seed[3] = 1; s.seed = seed; });
    for (let index = 0; index < 4; index += 1) { for (const value of ['1', NaN, Infinity, -Infinity]) { const s = makeState(); const seed = [...s.seed] as unknown[]; seed[index] = value; expectError(replace(s, 'seed', seed), TypeError, `seed[${index}]`); } for (const value of [-1, 1 / 2, 2 ** 32]) { const s = makeState(); const seed = [...s.seed]; seed[index] = value; expectError(replace(s, 'seed', seed), RangeError, `seed[${index}]`); } }
    expectError(replace(makeState(), 'seed', [0, 0, 0, 0]), RangeError, 'seed');
  });
  it('VB-V20–V23 validates every requested cell endpoint and ring invariant', () => {
    for (const index of [0, 9, 18]) for (const value of [-Number.MIN_VALUE, NaN, Infinity, -Infinity]) { const s = makeState(); s.waterMass[index] = value; expectError(s, RangeError, `waterMass[${index}]`); }
    for (const index of [0, 9, 18]) for (const value of [2, 255]) { const s = makeState(); s.ice[index] = value; expectError(s, RangeError, `ice[${index}]`); }
    expect(-1 - EPSILON).toBeLessThan(-1); for (const index of [0, 9, 18]) for (const value of [-1 - EPSILON, 1, NaN, Infinity, -Infinity]) { const s = makeState(); s.noise[index] = value; expectError(s, RangeError, `noise[${index}]`); }
    for (const index of [0, 9, 18]) for (const value of [-1, 0, 1 - EPSILON]) { const s = makeState(); s.noise[index] = value; expectValid(s); }
    for (const index of [0, 9, 18]) for (const value of [+0, -0, MAX]) { const s = makeState(); s.waterMass[index] = value; expectValid(s); }
    for (const index of [RING_CORNER, RING_EDGE]) { const s = makeState(); s.ice[index] = 1; expectError(s, RangeError, `ice[${index}]`); } validAt(makeState(), (s) => { s.ice[INNER] = 1; });
  });
});

describe('VB-P01–P11: validation order', () => {
  const ordered: readonly [string, (s: TestState) => object, string][] = [
    ['VB-P01', (s) => ({ ...s, radius: 1, waterMass: new Float64Array(18), ice: new Uint8Array(18), noise: new Float64Array(18) }), 'radius'],
    ['VB-P02', (s) => ({ ...s, waterMass: [], ice: new Uint8Array(18), noise: [] }), 'waterMass'],
    ['VB-P03', (s) => ({ ...s, ice: new Uint8Array(18), noise: [] }), 'ice'],
    ['VB-P04', (s) => ({ ...s, noise: new Float64Array(18), stepIndex: -1 }), 'noise'],
    ['VB-P06a', (s) => ({ ...s, seed: [-1, -1, 0, 1] }), 'seed[0]'], ['VB-P06b', (s) => ({ ...s, seed: [0, 1, -1, -1] }), 'seed[2]'],
    ['VB-P07', (s) => { s.waterMass[0] = -1; s.ice[0] = 2; s.noise[0] = 1; return s; }, 'waterMass[0]'],
    ['VB-P08', (s) => { s.ice[0] = 2; s.noise[0] = 1; return s; }, 'ice[0]'],
    ['VB-P09a', (s) => { s.ice[RING_CORNER] = 1; s.noise[RING_CORNER] = 1; return s; }, `ice[${RING_CORNER}]`],
    ['VB-P09b', (s) => { s.waterMass[RING_CORNER] = -1; s.ice[RING_CORNER] = 1; return s; }, `waterMass[${RING_CORNER}]`],
    ['VB-P10', (s) => { s.noise[0] = 1; s.waterMass[1] = -1; return s; }, 'noise[0]'],
    ['VB-P11', (s) => { s.seed = [0, 0, 0, 0]; s.waterMass[0] = -1; return s; }, 'seed'],
  ];
  for (const [id, setup, field] of ordered) it(id, () => expectError(setup(makeState()), RangeError, field));
  it('VB-P05 reports each left metadata member before its adjacent invalid member', () => {
    const pairs: readonly [keyof LatticeState, unknown, keyof LatticeState, unknown, string][] = [
      ['stepIndex', -1, 'elapsedCa', -Number.MIN_VALUE, 'stepIndex'], ['elapsedCa', -Number.MIN_VALUE, 'stopped', 0, 'elapsedCa'], ['stopped', 0, 'beta', -Number.MIN_VALUE, 'stopped'], ['beta', -Number.MIN_VALUE, 'noiseAmplitude', -Number.MIN_VALUE, 'beta'], ['noiseAmplitude', -Number.MIN_VALUE, 'modelVersion', 'wrong-version', 'noiseAmplitude'], ['modelVersion', 'wrong-version', 'seed', [0, 0, 0, 0], 'modelVersion'],
    ];
    for (const [left, leftValue, right, rightValue, field] of pairs) { const state = makeState() as unknown as LooseState; state[left] = leftValue; state[right] = rightValue; expectError(state, left === 'stopped' || left === 'modelVersion' ? TypeError : RangeError, field); }
  });
});
