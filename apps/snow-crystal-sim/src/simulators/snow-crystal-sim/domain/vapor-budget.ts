import { axialIndex, enumerateAxial } from './hex-lattice';
import { MODEL_VERSION } from './types';
import type { LatticeState, VaporBudget } from './types';

const UINT32_MAX = 0xffff_ffff;
const NEIGHBORS: readonly (readonly [number, number])[] = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

function finiteScalar(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`);
  }
}

function boundedScalar(value: unknown, field: string, minimum: number, maximum: number): void {
  finiteScalar(value, field);
  if (value < minimum || value > maximum) {
    throw new RangeError(`${field} is outside its allowed range`);
  }
}

function validate(state: LatticeState): void {
  if (state === null || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('state must be a non-array object');
  }

  finiteScalar(state.radius, 'radius');
  if (!Number.isSafeInteger(state.radius) || state.radius < 2) {
    throw new RangeError('radius must be a safe integer at least 2');
  }
  const count = 1 + 3 * state.radius * (state.radius + 1);
  if (!Number.isSafeInteger(count)) {
    throw new RangeError('radius produces an unsafe cell count');
  }

  if (!(state.waterMass instanceof Float64Array)) {
    throw new TypeError('waterMass must be a Float64Array');
  }
  if (state.waterMass.length !== count) {
    throw new RangeError('waterMass has the wrong length');
  }
  if (!(state.ice instanceof Uint8Array)) {
    throw new TypeError('ice must be a Uint8Array');
  }
  if (state.ice.length !== count) {
    throw new RangeError('ice has the wrong length');
  }
  if (!(state.noise instanceof Float64Array)) {
    throw new TypeError('noise must be a Float64Array');
  }
  if (state.noise.length !== count) {
    throw new RangeError('noise has the wrong length');
  }

  finiteScalar(state.stepIndex, 'stepIndex');
  if (!Number.isSafeInteger(state.stepIndex) || state.stepIndex < 0) {
    throw new RangeError('stepIndex must be a nonnegative safe integer');
  }
  finiteScalar(state.elapsedCa, 'elapsedCa');
  if (state.elapsedCa < 0) {
    throw new RangeError('elapsedCa must be nonnegative');
  }
  if (typeof state.stopped !== 'boolean') {
    throw new TypeError('stopped must be a boolean');
  }
  boundedScalar(state.beta, 'beta', 0, 0.95);
  boundedScalar(state.noiseAmplitude, 'noiseAmplitude', 0, 1);
  if (state.modelVersion !== MODEL_VERSION) {
    throw new TypeError('modelVersion does not match the model contract');
  }
  if (!Array.isArray(state.seed) || state.seed.length !== 4) {
    throw new TypeError('seed must be a four-member Array');
  }
  let hasNonzeroSeed = false;
  for (let index = 0; index < 4; index += 1) {
    const field = `seed[${index}]`;
    const value = state.seed[index];
    finiteScalar(value, field);
    if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
      throw new RangeError(`${field} must be uint32`);
    }
    hasNonzeroSeed ||= value !== 0;
  }
  if (!hasNonzeroSeed) {
    throw new RangeError('seed must not be all zero');
  }

  const radius = state.radius;
  let index = 0;
  for (let r = -radius; r <= radius; r += 1) {
    const minimumQ = Math.max(-radius, -radius - r);
    const maximumQ = Math.min(radius, radius - r);
    for (let q = minimumQ; q <= maximumQ; q += 1) {
      const mass = state.waterMass[index]!;
      if (!Number.isFinite(mass) || mass < 0) {
        throw new RangeError(`waterMass[${index}] must be finite and nonnegative`);
      }
      const ice = state.ice[index]!;
      if (ice !== 0 && ice !== 1) {
        throw new RangeError(`ice[${index}] must be 0 or 1`);
      }
      if (ice === 1 && Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) === radius) {
        throw new RangeError(`ice[${index}] is forbidden on the reservoir ring`);
      }
      const noise = state.noise[index]!;
      if (!Number.isFinite(noise) || noise < -1 || noise >= 1) {
        throw new RangeError(`noise[${index}] must be in [-1, 1)`);
      }
      index += 1;
    }
  }
}

interface KahanSum {
  sum: number;
  compensation: number;
}

function add(accumulator: KahanSum, value: number, field: string): void {
  const y = value - accumulator.compensation;
  const t = accumulator.sum + y;
  const compensation = (t - accumulator.sum) - y;
  if (!Number.isFinite(y) || !Number.isFinite(t) || !Number.isFinite(compensation)) {
    throw new RangeError(`${field} overflowed`);
  }
  accumulator.sum = t;
  accumulator.compensation = compensation;
}

/** Independently audits all saved CA water, including the reservoir ring. */
export function vaporBudget(state: LatticeState): VaporBudget {
  validate(state);
  const mobile: KahanSum = { sum: 0, compensation: 0 };
  const deposited: KahanSum = { sum: 0, compensation: 0 };
  let iceCellCount = 0;

  const coordinates = enumerateAxial(state.radius);
  for (let index = 0; index < coordinates.length; index += 1) {
    const { q, r } = coordinates[index]!;
    const isIce = state.ice[index] === 1;
    if (isIce) iceCellCount += 1;
    const receptive = isIce || NEIGHBORS.some(([dq, dr]) => {
      const neighbor = axialIndex(state.radius, q + dq, r + dr);
      return neighbor !== null && state.ice[neighbor] === 1;
    });
    add(receptive ? deposited : mobile, state.waterMass[index]!, receptive ? 'depositedWater' : 'mobileVapor');
  }
  if (!Number.isSafeInteger(iceCellCount)) {
    throw new RangeError('iceCellCount overflowed');
  }

  const total: KahanSum = { sum: 0, compensation: 0 };
  add(total, mobile.sum, 'totalWater');
  add(total, deposited.sum, 'totalWater');
  return {
    mobileVapor: mobile.sum === 0 ? 0 : mobile.sum,
    depositedWater: deposited.sum === 0 ? 0 : deposited.sum,
    totalWater: total.sum === 0 ? 0 : total.sum,
    iceCellCount,
  };
}
