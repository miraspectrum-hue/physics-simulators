import { describe, expect, it } from 'vitest';
import * as domain from '../index';
import type { LatticeState } from '../index';

type StepParameters = { readonly beta: number; readonly gamma: number; readonly noiseAmplitude: number; readonly dtCa: number };
type MassLedger = { readonly beforeTotal: number; readonly afterTotal: number; readonly diffusionNet: number; readonly outOfPlaneInput: number; readonly reservoirExchange: number; readonly residual: number };
type StepResult = { readonly state: LatticeState; readonly ledger: MassLedger; readonly reachedEdge: boolean };
const step = (domain as typeof domain & { step?: (state: LatticeState, parameters: StepParameters) => StepResult }).step;

const directions: readonly (readonly [number, number])[] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const h = (q: number, r: number) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
const cells = (radius: number) => {
  const result: Array<readonly [number, number]> = [];
  for (let r = -radius; r <= radius; r += 1) for (let q = Math.max(-radius, -r - radius); q <= Math.min(radius, -r + radius); q += 1) result.push([q, r]);
  return result;
};
const indexMap = (radius: number) => new Map(cells(radius).map(([q, r], index) => [`${q},${r}`, index]));
const at = (radius: number, q: number, r: number) => indexMap(radius).get(`${q},${r}`)!;
const eps = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(32 * Number.EPSILON * Math.max(1, Math.abs(expected)));
const params = (overrides: Partial<StepParameters> = {}): StepParameters => ({ beta: 2 / 5, gamma: 0, noiseAmplitude: 0, dtCa: 1, ...overrides });

function s2(): LatticeState {
  return domain.createLattice({ radius: 2, seed: [1, 2, 3, 4], beta: 2 / 5, noiseAmplitude: 0 });
}
function call(state: LatticeState, p = params()): StepResult {
  expect(step, 'T1-6 must export the public step API').toBeTypeOf('function');
  return step!(state, p);
}
function bits(value: number): bigint { const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value); return view.getBigUint64(0); }
function snapshotValue(value: unknown): unknown {
  if (typeof value === 'number') return { type: 'number', bits: bits(value) };
  if (value === null || typeof value !== 'object') return { type: typeof value, value };
  if (ArrayBuffer.isView(value)) return { type: value.constructor.name, values: Array.from(value as unknown as ArrayLike<unknown>, snapshotValue) };
  if (Array.isArray(value)) return { type: 'Array', values: value.map(snapshotValue) };
  return { type: Object.prototype.toString.call(value), entries: Object.keys(value).sort().map(key => [key, snapshotValue((value as Record<string, unknown>)[key])]) };
}
function snapshot(state: LatticeState) { return { water: snapshotValue(state.waterMass), ice: snapshotValue(state.ice), noise: snapshotValue(state.noise), seed: snapshotValue(state.seed), metadata: snapshotValue([state.radius, state.stepIndex, state.elapsedCa, state.stopped, state.beta, state.noiseAmplitude, state.modelVersion]) }; }

describe('TC-STEP-001–010: Reiter alpha=1 local rule and boundary literals', () => {
  it('TC-STEP-001 uses old-state acceptance, mobile diffusion, and post-diffusion reservoir restoration', () => {
    const out = call(s2()); const center = at(2, 0, 0);
    eps(out.state.waterMass[center]!, 1);
    for (const [q, r] of cells(2).filter(([q, r]) => h(q, r) === 1)) eps(out.state.waterMass[at(2, q, r)]!, 1 / 2);
    for (const [q, r] of cells(2).filter(([q, r]) => h(q, r) === 2)) eps(out.state.waterMass[at(2, q, r)]!, 2 / 5);
    expect(out.ledger.beforeTotal).toBe(41 / 5); expect(out.ledger.afterTotal).toBe(44 / 5); expect(out.ledger.outOfPlaneInput).toBe(+0); eps(out.ledger.reservoirExchange, 3 / 5);
    expect(out.state.stepIndex).toBe(1); expect(out.state.elapsedCa).toBe(1); expect(out.state.stopped).toBe(false); expect(out.reachedEdge).toBe(false);
  });

  for (const [id, p, center, inner, after, reservoir, outOfPlane, elapsed] of [
    ['TC-STEP-002', params({ gamma: 1 / 4 }), 5 / 4, 3 / 4, 211 / 20, 3 / 5, 7 / 4, 1],
    ['TC-STEP-003', params({ gamma: 1 / 4, dtCa: 1 / 2 }), 9 / 8, 23 / 40, 75 / 8, 3 / 10, 7 / 8, 1 / 2],
  ] as const) it(id, () => {
    const out = call(s2(), p); eps(out.state.waterMass[at(2, 0, 0)]!, center);
    for (const [q, r] of cells(2).filter(([q, r]) => h(q, r) === 1)) eps(out.state.waterMass[at(2, q, r)]!, inner);
    eps(out.ledger.afterTotal, after); eps(out.ledger.reservoirExchange, reservoir); eps(out.ledger.outOfPlaneInput, outOfPlane); expect(out.state.elapsedCa).toBe(elapsed);
  });

  it('TC-STEP-004–006 keep old interior mass while applying both signed boundary exchanges', () => {
    let zeroFixture = domain.createLattice({ radius: 2, seed: [1, 2, 3, 4], beta: 0, noiseAmplitude: 0 });
    for (const p of [params({ beta: 0, dtCa: 1 }), params({ beta: 0, dtCa: 1 / 2 }), params({ beta: 0, dtCa: Number.MIN_VALUE })]) {
      const out = call(zeroFixture, p);
      for (const [q, r] of cells(2)) { const i = at(2, q, r); const isCenter = q === 0 && r === 0; expect(out.state.waterMass[i]).toBe(isCenter ? 1 : 0); expect(out.state.ice[i]).toBe(isCenter ? 1 : 0); }
      expect(out.reachedEdge).toBe(false); expect(out.state.stopped).toBe(false); zeroFixture = out.state;
    }
    const zero = call(s2(), params({ beta: 0 }));
    expect(zero.ledger.beforeTotal).toBe(41 / 5); expect(zero.ledger.afterTotal).toBe(17 / 5); expect(zero.ledger.reservoirExchange).toBe(-24 / 5);
    for (const [q, r] of cells(2).filter(([q, r]) => h(q, r) === 1)) eps(zero.state.waterMass[at(2, q, r)]!, 2 / 5);
    const high = call(s2(), params({ beta: 3 / 5 })); const low = call(s2(), params({ beta: 1 / 5 }));
    for (const [q, r] of cells(2).filter(([q, r]) => h(q, r) === 1)) { eps(high.state.waterMass[at(2, q, r)]!, 11 / 20); eps(low.state.waterMass[at(2, q, r)]!, 9 / 20); }
    eps(high.ledger.reservoirExchange, 33 / 10); eps(high.ledger.afterTotal, 23 / 2); eps(low.ledger.reservoirExchange, -21 / 10); eps(low.ledger.afterTotal, 61 / 10);
  });

  it('TC-STEP-007–009 add to every receptive cell, freeze at >= 1, and stop at h=R-1', () => {
    const edge = call(s2(), params({ gamma: 1 / 2 })); expect(edge.reachedEdge).toBe(true); expect(edge.state.stopped).toBe(true); expect(edge.ledger.outOfPlaneInput).toBe(7 / 2); expect(edge.ledger.afterTotal).toBe(123 / 10);
    const all = s2(); for (const [q, r] of cells(2).filter(([q, r]) => h(q, r) <= 1)) { const i = at(2, q, r); all.ice[i] = 1; all.waterMass[i] = 1; }
    const ring = call(all, params({ beta: 1 / 5, gamma: 1 / 4 })); expect(ring.state.stopped).toBe(true); expect(ring.ledger.beforeTotal).toBe(59 / 5); expect(ring.ledger.afterTotal).toBe(223 / 20); expect(ring.ledger.outOfPlaneInput).toBe(19 / 4); expect(ring.ledger.reservoirExchange).toBe(-27 / 5);
    for (const [q, r] of cells(2).filter(([q, r]) => h(q, r) === 2)) expect(ring.state.ice[at(2, q, r)]).toBe(0);
  });

  it('TC-STEP-008 reads fixed noise without consuming or changing it', () => {
    const state = s2(); state.noise.fill(0); state.noise[at(2, 0, 0)] = -1; state.noise[at(2, 1, 0)] = 1 / 2; const before = Array.from(state.noise, bits);
    const out = call(state, params({ gamma: 2 / 5, noiseAmplitude: 1, dtCa: 1 / 2 }));
    expect(Array.from(out.state.noise, bits)).toEqual(before); eps(out.state.waterMass[at(2, 0, 0)]!, 1); eps(out.state.waterMass[at(2, 1, 0)]!, 3 / 4); eps(out.ledger.outOfPlaneInput, 13 / 10); eps(out.ledger.afterTotal, 49 / 5);
  });

  it('TC-STEP-010 has no external exchange for an interior non-receptive pulse', () => {
    let state = domain.createLattice({ radius: 3, seed: [1, 2, 3, 4], beta: 0, noiseAmplitude: 0 }); state = { ...state, waterMass: new Float64Array(state.waterMass), ice: new Uint8Array(state.ice) }; state.waterMass.fill(0); state.ice.fill(0); state.waterMass[at(3, 0, 0)] = 3 / 5;
    const out = call(state, params({ beta: 0 }));
    const neighbors = new Set(directions.map(([q, r]) => `${q},${r}`));
    for (const [q, r] of cells(3)) { const i = at(3, q, r); const isCenter = q === 0 && r === 0; expect(out.state.waterMass[i]).toBe(isCenter ? 3 / 10 : neighbors.has(`${q},${r}`) ? 1 / 20 : 0); expect(out.state.ice[i]).toBe(0); }
    expect(out.ledger.beforeTotal).toBe(3 / 5); expect(out.ledger.afterTotal).toBe(3 / 5);
    for (const value of [out.ledger.outOfPlaneInput, out.ledger.reservoirExchange, out.ledger.diffusionNet, out.ledger.residual]) expect(Object.is(value, +0)).toBe(true);
  });

  it('TC-INVALID-001 to TC-INVALID-010 exhaustively cover validation order, boundaries, and immutability', () => {
    const fieldOf = (error: unknown) => String(error).match(/(?:waterMass|ice|noise|seed)\[\d+\]|\b(?:state|radius|waterMass|ice|noise|stepIndex|elapsedCa|stopped|beta|noiseAmplitude|modelVersion|seed|parameters|gamma|dtCa)\b/)?.[0];
    const paramBits = (p: StepParameters) => snapshotValue([p.beta, p.gamma, p.noiseAmplitude, p.dtCa]);
    const reject = (field: string, state: LatticeState, p: StepParameters, kind: new (...args: never[]) => Error) => {
      const stateBefore = snapshot(state); const parameterBefore = paramBits(p); let caught: unknown;
      try { call(state, p); } catch (error) { caught = error; }
      expect(caught).toBeInstanceOf(kind); expect(fieldOf(caught)).toBe(field); expect(snapshot(state)).toEqual(stateBefore); expect(paramBits(p)).toEqual(parameterBefore);
    };
    for (const value of [null, [], 0, 'state'] as const) { let caught: unknown; try { call(value as unknown as LatticeState); } catch (error) { caught = error; } expect(caught).toBeInstanceOf(TypeError); expect(fieldOf(caught)).toBe('state'); }
    for (const value of [NaN, Infinity, -Infinity, '2'] as const) reject('radius', { ...s2(), radius: value as number }, params(), TypeError);
    for (const value of [1, 2.5, Number.MAX_SAFE_INTEGER] as const) reject('radius', { ...s2(), radius: value }, params(), RangeError);
    for (const field of ['waterMass', 'ice', 'noise'] as const) {
      for (const value of [[], field === 'ice' ? new Float64Array(19) : new Uint8Array(19)] as const) reject(field, { ...s2(), [field]: value } as unknown as LatticeState, params(), TypeError);
      for (const length of [18, 20] as const) reject(field, { ...s2(), [field]: field === 'ice' ? new Uint8Array(length) : new Float64Array(length) } as LatticeState, params(), RangeError);
    }
    const arrayPrecedence = { ...s2(), waterMass: [], ice: new Float64Array(19), noise: [] } as unknown as LatticeState; reject('waterMass', arrayPrecedence, params(), TypeError);
    const iceBeforeNoiseArray = { ...s2(), ice: new Float64Array(19), noise: [] } as unknown as LatticeState; reject('ice', iceBeforeNoiseArray, params(), TypeError);
    for (const value of [-1, 1 / 2, Number.MAX_SAFE_INTEGER + 1] as const) reject('stepIndex', { ...s2(), stepIndex: value }, params(), RangeError);
    reject('stepIndex', { ...s2(), stepIndex: Number.MAX_SAFE_INTEGER }, params(), RangeError);
    for (const value of [NaN, Infinity, -Infinity, '0'] as const) reject('stepIndex', { ...s2(), stepIndex: value as number }, params(), TypeError);
    reject('elapsedCa', { ...s2(), elapsedCa: -1 }, params(), RangeError);
    for (const value of [NaN, Infinity, -Infinity] as const) reject('elapsedCa', { ...s2(), elapsedCa: value }, params(), TypeError);
    reject('stopped', { ...s2(), stopped: 0 as unknown as boolean }, params(), TypeError);
    for (const [field, maximum] of [['beta', 0.95], ['noiseAmplitude', 1]] as const) { for (const value of [-Number.MIN_VALUE, maximum + Number.EPSILON] as const) reject(field, { ...s2(), [field]: value } as LatticeState, params(), RangeError); for (const value of [NaN, Infinity, -Infinity, '0'] as const) reject(field, { ...s2(), [field]: value as number } as LatticeState, params(), TypeError); }
    reject('modelVersion', { ...s2(), modelVersion: 'wrong-version' as LatticeState['modelVersion'] }, params(), TypeError);
    for (const value of [null, {}, [1, 2, 3], [1, 2, 3, 4, 5]] as const) reject('seed', { ...s2(), seed: value } as unknown as LatticeState, params(), TypeError);
    const nonIterableSeed = { nested: { marker: '0' } }; const nonIterableState = { ...s2(), seed: nonIterableSeed } as unknown as LatticeState; reject('seed', nonIterableState, params(), TypeError);
    for (let index = 0; index < 4; index += 1) { for (const value of [NaN, Infinity, '1'] as const) { const state = s2(); const seed = [...state.seed] as unknown[]; seed[index] = value; reject(`seed[${index}]`, { ...state, seed } as unknown as LatticeState, params(), TypeError); } for (const value of [-1, 2 ** 32, 1 / 2] as const) { const state = s2(); const seed = [...state.seed] as unknown[]; seed[index] = value; reject(`seed[${index}]`, { ...state, seed } as unknown as LatticeState, params(), RangeError); } }
    reject('seed', { ...s2(), seed: [0, 0, 0, 0] } as unknown as LatticeState, params(), RangeError);
    for (const [field, values] of [['waterMass', [-1, NaN, Infinity]], ['ice', [2]], ['noise', [-1 - Number.EPSILON, 1, NaN, Infinity]]] as const) for (const index of [0, at(2, 0, 0)] as const) for (const value of values) { const state = s2(); (state[field] as Float64Array | Uint8Array)[index] = value; reject(`${field}[${index}]`, state, params(), RangeError); }
    for (const index of [at(2, 2, 0), at(2, 1, 1)] as const) { const state = s2(); state.ice[index] = 1; reject(`ice[${index}]`, state, params(), RangeError); }
    const validCellBounds = s2(); validCellBounds.waterMass[0] = -0; validCellBounds.waterMass[at(2, 2, 0)] = 1; validCellBounds.noise[0] = -1; validCellBounds.noise[1] = 1 - Number.EPSILON; expect(() => call(validCellBounds)).not.toThrow();
    for (const value of [null, [], 0, 'parameters'] as const) { const state = s2(); const before = snapshot(state); let caught: unknown; try { call(state, value as unknown as StepParameters); } catch (error) { caught = error; } expect(caught).toBeInstanceOf(TypeError); expect(fieldOf(caught)).toBe('parameters'); expect(snapshot(state)).toEqual(before); }
    for (const [field, lower, upper] of [['beta', 0, 0.95], ['gamma', 0, 1], ['noiseAmplitude', 0, 1], ['dtCa', 0, 1]] as const) { for (const value of [NaN, Infinity, -Infinity, '0'] as const) reject(field, s2(), { ...params(), [field]: value as number }, TypeError); for (const value of field === 'dtCa' ? [-Number.MIN_VALUE, 0, upper + Number.EPSILON] : [lower - Number.MIN_VALUE, upper + Number.EPSILON]) reject(field, s2(), { ...params(), [field]: value } as StepParameters, RangeError); }
    for (const p of [params({ beta: 0, gamma: 0, noiseAmplitude: 0, dtCa: Number.MIN_VALUE }), params({ beta: 0.95, gamma: 1, noiseAmplitude: 1, dtCa: 1 })]) expect(() => call(s2(), p)).not.toThrow();
    const stateFirst = s2(); stateFirst.waterMass[0] = -1; reject('waterMass[0]', stateFirst, params({ beta: Number.NaN }), RangeError);
    const stoppedStateFirst = { ...s2(), stopped: true, beta: -Number.MIN_VALUE }; reject('beta', stoppedStateFirst, params({ gamma: Number.NaN }), RangeError);
    for (const [field, p] of [['beta', params({ beta: Number.NaN, gamma: Number.NaN, noiseAmplitude: Number.NaN, dtCa: NaN })], ['gamma', params({ gamma: Number.NaN, noiseAmplitude: Number.NaN, dtCa: NaN })], ['noiseAmplitude', params({ noiseAmplitude: Number.NaN, dtCa: NaN })]] as const) reject(field, s2(), p, TypeError);
    const lowerIndexFirst = s2(); lowerIndexFirst.waterMass[1] = -1; lowerIndexFirst.noise[0] = 1; reject('noise[0]', lowerIndexFirst, params(), RangeError);
    const sameIndexFirst = s2(); sameIndexFirst.waterMass[0] = -1; sameIndexFirst.noise[0] = 1; reject('waterMass[0]', sameIndexFirst, params(), RangeError);
    const iceBeforeNoise = s2(); iceBeforeNoise.ice[0] = 2; iceBeforeNoise.noise[0] = 1; reject('ice[0]', iceBeforeNoise, params(), RangeError);
    const overflow = s2(); overflow.waterMass[at(2, 0, 0)] = Number.MAX_VALUE; overflow.waterMass[at(2, 1, 0)] = Number.MAX_VALUE; const overflowBefore = snapshot(overflow); expect(() => call(overflow, params())).toThrow(RangeError); expect(snapshot(overflow)).toEqual(overflowBefore);
    const stoppedOverflow = { ...overflow, stopped: true }; const stoppedOverflowBefore = snapshot(stoppedOverflow); expect(() => call(stoppedOverflow, params())).toThrow(RangeError); expect(snapshot(stoppedOverflow)).toEqual(stoppedOverflowBefore);
    const stoppedInvalidState = { ...s2(), stopped: true, stepIndex: -1 }; reject('stepIndex', stoppedInvalidState, params(), RangeError);
    expect(() => call({ ...s2(), elapsedCa: Number.MAX_VALUE }, params({ dtCa: 1 }))).not.toThrow();
    expect(() => call({ ...s2(), stopped: true, stepIndex: Number.MAX_SAFE_INTEGER, elapsedCa: Number.MAX_VALUE })).not.toThrow();
  });
});

describe('TC-STEP-017 and TC-INVALID-001–010: threshold, validation, and purity', () => {
  function thresholdFixture(): LatticeState { const state = domain.createLattice({ radius: 4, seed: [1, 2, 3, 4], beta: 0, noiseAmplitude: 0 }); state.waterMass.fill(0); state.ice.fill(0); state.waterMass[at(4, 0, 0)] = 1; state.ice[at(4, 0, 0)] = 1; state.waterMass[at(4, 1, 0)] = 1 / 2; return state; }
  it('TC-STEP-017 uses exact >= threshold and does not cascade new acceptance in the same step', () => {
    for (const [gamma, expected, frozen] of [[1 / 2 - 2 ** -53, 1 - 2 ** -53, 0], [1 / 2, 1, 1], [1 / 2 + 2 ** -52, 1 + 2 ** -52, 1]] as const) { const out = call(thresholdFixture(), params({ beta: 0, gamma })); for (const [q, r] of cells(4)) { const i = at(4, q, r); const isCenter = q === 0 && r === 0; const isA = q === 1 && r === 0; const isOtherFirstRing = h(q, r) === 1 && !isA; expect(bits(out.state.waterMass[i]!)).toBe(bits(isCenter ? 1 + gamma : isA ? expected : isOtherFirstRing ? gamma : 0)); expect(out.state.ice[i]).toBe(isCenter || (isA && frozen === 1) ? 1 : 0); } expect(out.ledger.beforeTotal).toBe(3 / 2); expect(out.ledger.afterTotal).toBe(3 / 2 + 7 * gamma); expect(out.ledger.outOfPlaneInput).toBe(7 * gamma); expect(Object.is(out.ledger.reservoirExchange, +0)).toBe(true); expect(out.state.stopped).toBe(false); expect(out.reachedEdge).toBe(false); }
    const first = call(thresholdFixture(), params({ beta: 0, gamma: 1 / 2 }));
    expect(first.ledger.beforeTotal).toBe(3 / 2); expect(first.ledger.afterTotal).toBe(5); expect(first.ledger.outOfPlaneInput).toBe(7 / 2); expect(Object.is(first.ledger.reservoirExchange, +0)).toBe(true); expect(first.state.stopped).toBe(false); expect(first.reachedEdge).toBe(false);
    for (const [q, r] of cells(4)) { const i = at(4, q, r); const isCenter = q === 0 && r === 0; const isA = q === 1 && r === 0; const isOtherFirstRing = h(q, r) === 1 && !isA; expect(first.state.waterMass[i]).toBe(isCenter ? 3 / 2 : isA ? 1 : isOtherFirstRing ? 1 / 2 : 0); expect(first.state.ice[i]).toBe(isCenter || isA ? 1 : 0); }
    const second = call(first.state, params({ beta: 0, gamma: 1 / 2 }));
    expect(second.ledger.beforeTotal).toBe(5); expect(second.ledger.afterTotal).toBe(10); expect(second.ledger.outOfPlaneInput).toBe(5); expect(Object.is(second.ledger.reservoirExchange, +0)).toBe(true); expect(second.state.stopped).toBe(false); expect(second.reachedEdge).toBe(false);
    const outwardA = new Set(['2,0', '2,-1', '1,1']);
    for (const [q, r] of cells(4)) { const i = at(4, q, r); const isCenter = q === 0 && r === 0; const isA = q === 1 && r === 0; const isOtherFirstRing = h(q, r) === 1 && !isA; const isOutwardA = outwardA.has(`${q},${r}`); expect(second.state.waterMass[i]).toBe(isCenter ? 2 : isA ? 3 / 2 : isOtherFirstRing ? 1 : isOutwardA ? 1 / 2 : 0); expect(second.state.ice[i]).toBe(isCenter || h(q, r) === 1 ? 1 : 0); }
  });
  it('TC-STEP-014 validates parameters before stopped fixed point and copies every mutable input', () => {
    const stopped = call(s2(), params({ gamma: 1 / 2 })).state; const before = snapshot(stopped); expect(() => call(stopped, params({ beta: Number.NaN }))).toThrow(TypeError); const out = call(stopped, params({ beta: 0, gamma: 1, noiseAmplitude: 1, dtCa: 1 / 2 })); expect(snapshot(stopped)).toEqual(before); expect(snapshot(out.state)).toEqual(before); expect(out.state).not.toBe(stopped); expect(out.state.waterMass).not.toBe(stopped.waterMass); expect(Object.is(out.ledger.diffusionNet, +0)).toBe(true);
  });
  it('TC-INVALID-001–010 reject the complete reachable validation matrix, report its first field, and preserve the candidate', () => {
    const cases: readonly [string, (state: LatticeState) => unknown, StepParameters, new (...args: never[]) => Error][] = [
      ['state', () => null, params(), TypeError], ['radius', s => ({ ...s, radius: 1 }), params(), RangeError], ['waterMass', s => ({ ...s, waterMass: [] }), params(), TypeError], ['ice', s => ({ ...s, ice: new Uint8Array(18) }), params(), RangeError], ['noise', s => ({ ...s, noise: [] }), params(), TypeError], ['stepIndex', s => ({ ...s, stepIndex: -1 }), params(), RangeError], ['elapsedCa', s => ({ ...s, elapsedCa: -1 }), params(), RangeError], ['stopped', s => ({ ...s, stopped: 0 }), params(), TypeError], ['beta', s => ({ ...s, beta: -Number.MIN_VALUE }), params(), RangeError], ['seed', s => ({ ...s, seed: [0, 0, 0, 0] }), params(), RangeError], ['parameters', s => s, null as unknown as StepParameters, TypeError], ['gamma', s => s, params({ gamma: -Number.MIN_VALUE }), RangeError], ['dtCa', s => s, params({ dtCa: 0 }), RangeError],
    ];
    const fieldOf = (error: unknown) => String(error).match(/(?:waterMass|ice|noise|seed)\[\d+\]|\b(?:state|radius|waterMass|ice|noise|stepIndex|elapsedCa|stopped|beta|noiseAmplitude|modelVersion|seed|parameters|gamma|dtCa)\b/)?.[0];
    for (const [field, alter, p, error] of cases) { const input = s2(); const candidate = alter(input) as LatticeState; const before = candidate && typeof candidate === 'object' && 'waterMass' in candidate ? snapshot(candidate) : candidate; let caught: unknown; try { call(candidate, p); } catch (caughtError) { caught = caughtError; } expect(caught).toBeInstanceOf(error); expect(fieldOf(caught)).toBe(field); if (candidate && typeof candidate === 'object' && 'waterMass' in candidate) expect(snapshot(candidate)).toEqual(before); }
    for (const value of [NaN, Infinity, -Infinity, '0'] as const) { const candidate = s2(); const before = snapshot(candidate); expect(() => call(candidate, params({ beta: value as number }))).toThrow(TypeError); expect(snapshot(candidate)).toEqual(before); }
    for (const value of [-Number.MIN_VALUE, 0.95 + Number.EPSILON] as const) expect(() => call(s2(), params({ beta: value }))).toThrow(RangeError);
    for (const value of [NaN, Infinity, -Infinity, '1'] as const) { const candidate = s2(); const seed = [...candidate.seed] as unknown[]; seed[2] = value; const altered = { ...candidate, seed } as unknown as LatticeState; const before = snapshot(altered); const p = params(); const pBefore = { ...p }; expect(() => call(altered, p)).toThrow(TypeError); expect(snapshot(altered)).toEqual(before); expect(p).toEqual(pBefore); }
    for (const [field, value] of [['waterMass', -1], ['ice', 2], ['noise', 1]] as const) { const candidate = s2(); (candidate[field] as Float64Array | Uint8Array)[0] = value; const before = snapshot(candidate); expect(() => call(candidate, params())).toThrow(RangeError); expect(snapshot(candidate)).toEqual(before); }
    const precedence = s2(); precedence.waterMass[0] = -1; precedence.ice[0] = 2; precedence.noise[0] = 1; let error: unknown; try { call(precedence, params({ beta: Number.NaN })); } catch (caught) { error = caught; } expect(fieldOf(error)).toBe('waterMass[0]');
    for (const p of [params({ beta: 0, gamma: 0, noiseAmplitude: 0, dtCa: Number.MIN_VALUE }), params({ beta: 0.95, gamma: 1, noiseAmplitude: 1, dtCa: 1 })]) expect(() => call(s2(), p)).not.toThrow();
    const overflow = s2(); overflow.waterMass[at(2, 0, 0)] = Number.MAX_VALUE; overflow.waterMass[at(2, 1, 0)] = Number.MAX_VALUE; const overflowBefore = snapshot(overflow); expect(() => call(overflow, params())).toThrow(RangeError); expect(snapshot(overflow)).toEqual(overflowBefore);
    const stopped = { ...s2(), stopped: true, stepIndex: Number.MAX_SAFE_INTEGER, elapsedCa: Number.MAX_VALUE }; const stoppedBefore = snapshot(stopped); expect(() => call(stopped, params())).not.toThrow(); expect(snapshot(stopped)).toEqual(stoppedBefore);
  });
});
