import { describe, expect, it } from 'vitest';
import * as domain from '../index';
import type { LatticeState } from '../index';

type Parameters = { beta: number; gamma: number; noiseAmplitude: number; dtCa: number };
type Result = { state: LatticeState; ledger: { beforeTotal: number; afterTotal: number; diffusionNet: number; outOfPlaneInput: number; reservoirExchange: number; residual: number } };
const step = (domain as typeof domain & { step?: (state: LatticeState, p: Parameters) => Result }).step;
const dirs: readonly (readonly [number, number])[] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];
const h = (q: number, r: number) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
const coordinates = (r: number) => { const a: Array<readonly [number, number]> = []; for (let y = -r; y <= r; y += 1) for (let x = Math.max(-r, -y - r); x <= Math.min(r, r - y); x += 1) a.push([x, y]); return a; };
const mapFor = (r: number) => new Map(coordinates(r).map(([q, s], i) => [`${q},${s}`, i]));
const e = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(32 * Number.EPSILON * Math.max(1, Math.abs(expected)));
const bits = (value: number) => { const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value); return view.getBigUint64(0); };
function neumaier(values: readonly number[]): number { let sum = 0; let correction = 0; for (const value of values) { const next = sum + value; correction += Math.abs(sum) >= Math.abs(value) ? (sum - next) + value : (value - next) + sum; sum = next; } return sum + correction === 0 ? 0 : sum + correction; }
function expectDiagnostic(actual: number, expected: number): void { if (expected === 0) expect(Object.is(actual, +0)).toBe(true); else expect(bits(actual)).toBe(bits(expected)); }

function reference(state: LatticeState, p: Parameters) {
  const c = coordinates(state.radius); const map = mapFor(state.radius); const receptive = c.map(([q, r], i) => state.ice[i] === 1 || dirs.some(([dq, dr]) => state.ice[map.get(`${q + dq},${r + dr}`) ?? -1] === 1));
  const barred = c.map(([q, r], i) => h(q, r) === state.radius ? p.beta : state.waterMass[i]!);
  const mobile = barred.map((v, i) => receptive[i] ? 0 : v); const deposited = barred.map((v, i) => receptive[i] ? v : 0); const delta = new Float64Array(c.length);
  let edges = 0;
  for (let i = 0; i < c.length; i += 1) { const [q, r] = c[i]!; for (const [dq, dr] of dirs) { const j = map.get(`${q + dq},${r + dr}`); if (j !== undefined && i < j) { const flux = p.dtCa / 12 * (mobile[j]! - mobile[i]!); delta[i] = delta[i]! + flux; delta[j] = delta[j]! - flux; edges += 1; } } }
  const pairwiseUStar = mobile.map((value, i) => value + delta[i]!);
  const cDiffusion = p.dtCa / 12;
  const ledgerUStar = mobile.map((value, i) => {
    const [q, r] = c[i]!;
    const neighbors = dirs.map(([dq, dr]) => map.get(`${q + dq},${r + dr}`)).filter((j): j is number => j !== undefined);
    let convexValue = (1 - cDiffusion * neighbors.length) * value;
    for (const j of neighbors) convexValue += cDiffusion * mobile[j]!;
    return convexValue;
  });
  const preTerms = c.map(([q, r], i) => h(q, r) === state.radius ? p.beta - state.waterMass[i]! : 0); const pre = neumaier(preTerms);
  const additions = receptive.map((yes, i) => yes ? p.gamma * (1 + p.noiseAmplitude * state.noise[i]!) * p.dtCa : 0); const addition = neumaier(additions);
  const pairwiseRaw = c.map((_, i) => deposited[i]! + pairwiseUStar[i]! + additions[i]!);
  const water = pairwiseRaw.map((value, i) => h(...c[i]!) === state.radius ? p.beta : value);
  const ledgerRaw = c.map((_, i) => deposited[i]! + ledgerUStar[i]! + additions[i]!);
  const ledgerWater = ledgerRaw.map((value, i) => h(...c[i]!) === state.radius ? p.beta : value);
  const postTerms = c.map(([q, r], i) => h(q, r) === state.radius ? p.beta - ledgerRaw[i]! : 0); const post = neumaier(postTerms);
  const diffusionTerms = ledgerUStar.map((value, i) => value - mobile[i]!);
  const before = neumaier(Array.from(state.waterMass)); const after = neumaier(ledgerWater); const diffusionNet = neumaier(diffusionTerms); const diffusionAbsSum = neumaier(diffusionTerms.map(Math.abs)); const reservoirExchange = neumaier([...preTerms, ...postTerms]); const reservoirAbsSum = neumaier([...preTerms, ...postTerms].map(Math.abs)); const residual = ((after - before) - addition) - reservoirExchange;
  return { water, edges, ringInner: c.reduce((n, [q, r]) => n + dirs.filter(([dq, dr]) => h(q, r) === state.radius && h(q + dq, r + dr) === state.radius - 1).length, 0), addition, pre, post, before, after, diffusionNet, diffusionAbsSum, reservoirExchange, reservoirAbsSum, residual };
}
function run(state: LatticeState, p: Parameters): Result { expect(step).toBeTypeOf('function'); return step!(state, p); }

describe('TC-STEP-011/012: independent pairwise-flux reference and mass audit', () => {
  it('TC-STEP-012 is covariant under an independently mapped 60-degree rotation when e=0', () => {
    const source = domain.createLattice({ radius: 3, seed: [1, 2, 3, 4], beta: 2 / 5, noiseAmplitude: 0 }); const c = coordinates(3); const map = mapFor(3); source.waterMass[map.get('1,0')!] = 7 / 10; source.waterMass[map.get('-1,1')!] = 1 / 8; source.ice[map.get('1,0')!] = 1;
    const rotated = { ...source, waterMass: new Float64Array(source.waterMass.length), ice: new Uint8Array(source.ice.length), noise: new Float64Array(source.noise.length), seed: [...source.seed] as LatticeState['seed'] };
    for (let i = 0; i < c.length; i += 1) { const [q, r] = c[i]!; const target = map.get(`${-r},${q + r}`)!; rotated.waterMass[target] = source.waterMass[i]!; rotated.ice[target] = source.ice[i]!; rotated.noise[target] = source.noise[i]!; }
    const p = { beta: 2 / 5, gamma: 1 / 4, noiseAmplitude: 0, dtCa: 1 / 2 }; const left = run(source, p); const right = run(rotated, p); for (let i = 0; i < c.length; i += 1) { const [q, r] = c[i]!; const target = map.get(`${-r},${q + r}`)!; expect(right.state.ice[target]).toBe(left.state.ice[i]); e(right.state.waterMass[target]!, left.state.waterMass[i]!); } expect(right.state.stopped).toBe(left.state.stopped); e(right.ledger.outOfPlaneInput, left.ledger.outOfPlaneInput); e(right.ledger.reservoirExchange, left.ledger.reservoirExchange);
  });
  it('TC-STEP-012 also rotates a fixed asymmetric noise field when e>0', () => {
    const source = domain.createLattice({ radius: 3, seed: [1, 2, 3, 4], beta: 2 / 5, noiseAmplitude: 1 }); const c = coordinates(3); const map = mapFor(3); source.noise.fill(0); source.noise[map.get('1,0')!] = 1 / 2; source.noise[map.get('-1,1')!] = -3 / 4; source.waterMass[map.get('1,0')!] = 7 / 10; source.ice[map.get('1,0')!] = 1;
    const rotated = { ...source, waterMass: new Float64Array(source.waterMass.length), ice: new Uint8Array(source.ice.length), noise: new Float64Array(source.noise.length), seed: [...source.seed] as LatticeState['seed'] };
    for (let i = 0; i < c.length; i += 1) { const [q, r] = c[i]!; const target = map.get(`${-r},${q + r}`)!; rotated.waterMass[target] = source.waterMass[i]!; rotated.ice[target] = source.ice[i]!; rotated.noise[target] = source.noise[i]!; }
    const p = { beta: 2 / 5, gamma: 1 / 4, noiseAmplitude: 1, dtCa: 1 / 2 }; const left = run(source, p); const right = run(rotated, p); for (let i = 0; i < c.length; i += 1) { const [q, r] = c[i]!; const target = map.get(`${-r},${q + r}`)!; expect(right.state.ice[target]).toBe(left.state.ice[i]); e(right.state.waterMass[target]!, left.state.waterMass[i]!); } expect(right.state.stopped).toBe(left.state.stopped); e(right.ledger.outOfPlaneInput, left.ledger.outOfPlaneInput); e(right.ledger.reservoirExchange, left.ledger.reservoirExchange);
  });
  it('constructs the literal whole-lattice graph without production lattice helpers', () => {
    for (const [radius, expectedEdges, expectedRingInner] of [[2, 42, 18], [7, 462, 78]] as const) { const c = coordinates(radius); const map = mapFor(radius); let edges = 0; let ringInner = 0; for (let i = 0; i < c.length; i += 1) { const [q, r] = c[i]!; for (const [dq, dr] of dirs) { const j = map.get(`${q + dq},${r + dr}`); if (j !== undefined && i < j) { edges += 1; if ((h(q, r) === radius && h(...c[j]!) === radius - 1) || (h(...c[j]!) === radius && h(q, r) === radius - 1)) ringInner += 1; } } } expect(edges).toBe(expectedEdges); expect(ringInner).toBe(expectedRingInner); }
  });
  it('TC-STEP-011 matches every independent pairwise flux value and independent vapor budgets', () => {
    const state = domain.createLattice({ radius: 3, seed: [1, 2, 3, 4], beta: 2 / 5, noiseAmplitude: 0 }); state.waterMass[mapFor(3).get('2,0')!] = 3 / 8;
    for (const dtCa of [1 / 2, 1] as const) { const p = { beta: 2 / 5, gamma: 0, noiseAmplitude: 0, dtCa }; const ref = reference(state, p); const before = domain.vaporBudget(state); const out = run(state, p); const after = domain.vaporBudget(out.state); const tau = 256 * Number.EPSILON * Math.max(1, Math.abs(ref.before), Math.abs(ref.after), Math.abs(ref.addition), Math.abs(ref.reservoirExchange), ref.diffusionAbsSum, ref.reservoirAbsSum); expect(ref.edges).toBe(90); for (let i = 0; i < ref.water.length; i += 1) e(out.state.waterMass[i]!, ref.water[i]!); e(out.ledger.beforeTotal, ref.before); e(out.ledger.afterTotal, ref.after); e(out.ledger.outOfPlaneInput, ref.addition); e(out.ledger.reservoirExchange, ref.reservoirExchange); expectDiagnostic(out.ledger.diffusionNet, ref.diffusionNet); expectDiagnostic(out.ledger.residual, ref.residual); expect(Math.abs(out.ledger.diffusionNet)).toBeLessThanOrEqual(tau); expect(Math.abs(out.ledger.residual)).toBeLessThanOrEqual(tau); e(after.totalWater - before.totalWater, ref.addition + ref.reservoirExchange); expect(out.state.waterMass.every(v => v >= 0)).toBe(true); }
  });
  it('TC-STEP-001–006 reconstruct boundary and addition terms independently of the ledger', () => {
    for (const p of [{ beta: 2 / 5, gamma: 0, noiseAmplitude: 0, dtCa: 1 }, { beta: 3 / 5, gamma: 0, noiseAmplitude: 0, dtCa: 1 }, { beta: 1 / 5, gamma: 0, noiseAmplitude: 0, dtCa: 1 }, { beta: 2 / 5, gamma: 1 / 4, noiseAmplitude: 0, dtCa: 1 / 2 }] as const) { const state = domain.createLattice({ radius: 2, seed: [1, 2, 3, 4], beta: 2 / 5, noiseAmplitude: 0 }); const before = domain.vaporBudget(state); const ref = reference(state, p); const out = run(state, p); const after = domain.vaporBudget(out.state); const tau = 256 * Number.EPSILON * Math.max(1, Math.abs(ref.before), Math.abs(ref.after), Math.abs(ref.addition), Math.abs(ref.reservoirExchange), ref.diffusionAbsSum, ref.reservoirAbsSum); for (let i = 0; i < ref.water.length; i += 1) e(out.state.waterMass[i]!, ref.water[i]!); e(out.ledger.beforeTotal, ref.before); e(out.ledger.afterTotal, ref.after); e(out.ledger.outOfPlaneInput, ref.addition); e(out.ledger.reservoirExchange, ref.reservoirExchange); expectDiagnostic(out.ledger.diffusionNet, ref.diffusionNet); expectDiagnostic(out.ledger.residual, ref.residual); expect(Math.abs(out.ledger.residual)).toBeLessThanOrEqual(tau); e(after.totalWater - before.totalWater, ref.addition + ref.reservoirExchange); if (p.beta === 3 / 5) { e(ref.pre, 12 / 5); e(ref.post, 9 / 10); } if (p.beta === 1 / 5) { e(ref.pre, -12 / 5); e(ref.post, 3 / 10); } }
  });
});
