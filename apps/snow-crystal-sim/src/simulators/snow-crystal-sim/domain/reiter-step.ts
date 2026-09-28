import { axialIndex, enumerateAxial } from './hex-lattice';
import { MODEL_VERSION } from './types';
import type { LatticeState, MassLedger, StepParameters, StepResult } from './types';

const UINT32_MAX = 0xffff_ffff;
const NEIGHBORS: readonly (readonly [number, number])[] = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

interface NeumaierSum {
  sum: number;
  correction: number;
}

function finiteScalar(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`);
  }
}

function boundedScalar(value: unknown, field: string, minimum: number, maximum: number): asserts value is number {
  finiteScalar(value, field);
  if (value < minimum || value > maximum) {
    throw new RangeError(`${field} is outside its allowed range`);
  }
}

function validateState(state: LatticeState): number {
  if (state === null || typeof state !== 'object' || Array.isArray(state)) {
    throw new TypeError('state must be a non-array object');
  }

  finiteScalar(state.radius, 'radius');
  if (!Number.isSafeInteger(state.radius) || state.radius < 2) {
    throw new RangeError('radius must be a safe integer at least 2');
  }
  const cellCount = 1 + 3 * state.radius * (state.radius + 1);
  if (!Number.isSafeInteger(cellCount)) {
    throw new RangeError('radius produces an unsafe cell count');
  }

  if (!(state.waterMass instanceof Float64Array)) {
    throw new TypeError('waterMass must be a Float64Array');
  }
  if (state.waterMass.length !== cellCount) {
    throw new RangeError('waterMass has the wrong length');
  }
  if (!(state.ice instanceof Uint8Array)) {
    throw new TypeError('ice must be a Uint8Array');
  }
  if (state.ice.length !== cellCount) {
    throw new RangeError('ice has the wrong length');
  }
  if (!(state.noise instanceof Float64Array)) {
    throw new TypeError('noise must be a Float64Array');
  }
  if (state.noise.length !== cellCount) {
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

  const coordinates = enumerateAxial(state.radius);
  for (let index = 0; index < cellCount; index += 1) {
    const mass = state.waterMass[index]!;
    if (!Number.isFinite(mass) || mass < 0) {
      throw new RangeError(`waterMass[${index}] must be finite and nonnegative`);
    }
    const ice = state.ice[index]!;
    if (ice !== 0 && ice !== 1) {
      throw new RangeError(`ice[${index}] must be 0 or 1`);
    }
    const { q, r } = coordinates[index]!;
    if (ice === 1 && hexDistance(q, r) === state.radius) {
      throw new RangeError(`ice[${index}] is forbidden on the reservoir ring`);
    }
    const noise = state.noise[index]!;
    if (!Number.isFinite(noise) || noise < -1 || noise >= 1) {
      throw new RangeError(`noise[${index}] must be in [-1, 1)`);
    }
  }
  return cellCount;
}

function validateParameters(parameters: StepParameters): void {
  if (parameters === null || typeof parameters !== 'object' || Array.isArray(parameters)) {
    throw new TypeError('parameters must be a non-array object');
  }
  boundedScalar(parameters.beta, 'beta', 0, 0.95);
  boundedScalar(parameters.gamma, 'gamma', 0, 1);
  boundedScalar(parameters.noiseAmplitude, 'noiseAmplitude', 0, 1);
  finiteScalar(parameters.dtCa, 'dtCa');
  if (parameters.dtCa <= 0 || parameters.dtCa > 1) {
    throw new RangeError('dtCa is outside its allowed range');
  }
}

function hexDistance(q: number, r: number): number {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}

function add(accumulator: NeumaierSum, value: number, field: string): void {
  if (!Number.isFinite(value)) {
    throw new RangeError(`${field} contains a non-finite term`);
  }
  const next = accumulator.sum + value;
  const correction = Math.abs(accumulator.sum) >= Math.abs(value)
    ? (accumulator.sum - next) + value
    : (value - next) + accumulator.sum;
  const nextCorrection = accumulator.correction + correction;
  if (!Number.isFinite(next) || !Number.isFinite(correction) || !Number.isFinite(nextCorrection)) {
    throw new RangeError(`${field} overflowed`);
  }
  accumulator.sum = next;
  accumulator.correction = nextCorrection;
}

function finish(accumulator: NeumaierSum, field: string): number {
  const value = accumulator.sum + accumulator.correction;
  if (!Number.isFinite(value)) {
    throw new RangeError(`${field} overflowed`);
  }
  return value === 0 ? 0 : value;
}

function totalWater(waterMass: Float64Array, field: string): number {
  const accumulator: NeumaierSum = { sum: 0, correction: 0 };
  for (let index = 0; index < waterMass.length; index += 1) {
    add(accumulator, waterMass[index]!, field);
  }
  return finish(accumulator, field);
}

function copiedState(state: LatticeState): LatticeState {
  return {
    radius: state.radius,
    waterMass: new Float64Array(state.waterMass),
    ice: new Uint8Array(state.ice),
    noise: new Float64Array(state.noise),
    stepIndex: state.stepIndex,
    elapsedCa: state.elapsedCa,
    stopped: state.stopped,
    beta: state.beta,
    noiseAmplitude: state.noiseAmplitude,
    seed: [...state.seed],
    modelVersion: state.modelVersion,
  };
}

function fixedPoint(state: LatticeState): StepResult {
  const total = totalWater(state.waterMass, 'beforeTotal');
  const ledger: MassLedger = {
    beforeTotal: total,
    afterTotal: total,
    diffusionNet: 0,
    outOfPlaneInput: 0,
    reservoirExchange: 0,
    residual: 0,
  };
  return { state: copiedState(state), ledger, reachedEdge: true };
}

/** Advances the complete finite hexagonal lattice by one Reiter alpha=1 CA step. */
export function step(state: LatticeState, parameters: StepParameters): StepResult {
  const cellCount = validateState(state);
  validateParameters(parameters);

  if (state.stopped) {
    return fixedPoint(state);
  }

  const nextStepIndex = state.stepIndex + 1;
  if (!Number.isSafeInteger(nextStepIndex)) {
    throw new RangeError('stepIndex would exceed the safe-integer range');
  }
  const nextElapsedCa = state.elapsedCa + parameters.dtCa;
  if (!Number.isFinite(nextElapsedCa)) {
    throw new RangeError('elapsedCa would overflow');
  }

  const coordinates = enumerateAxial(state.radius);
  const barred = new Float64Array(cellCount);
  const mobile = new Float64Array(cellCount);
  const deposited = new Float64Array(cellCount);
  const receptive = new Uint8Array(cellCount);
  const diffused = new Float64Array(cellCount);
  const candidate = new Float64Array(cellCount);
  const waterMass = new Float64Array(cellCount);
  const ice = new Uint8Array(cellCount);
  const reservoir: NeumaierSum = { sum: 0, correction: 0 };

  const beforeTotal = totalWater(state.waterMass, 'beforeTotal');

  for (let index = 0; index < cellCount; index += 1) {
    const { q, r } = coordinates[index]!;
    const onRing = hexDistance(q, r) === state.radius;
    const value = onRing ? parameters.beta : state.waterMass[index]!;
    barred[index] = value;
    if (onRing) {
      add(reservoir, parameters.beta - state.waterMass[index]!, 'reservoirExchange');
    }

    let isReceptive = state.ice[index] === 1;
    if (!isReceptive) {
      for (const [dq, dr] of NEIGHBORS) {
        const neighbor = axialIndex(state.radius, q + dq, r + dr);
        if (neighbor !== null && state.ice[neighbor] === 1) {
          isReceptive = true;
          break;
        }
      }
    }
    receptive[index] = isReceptive ? 1 : 0;
    deposited[index] = isReceptive ? value : 0;
    mobile[index] = isReceptive ? 0 : value;
  }

  const diffusion: NeumaierSum = { sum: 0, correction: 0 };
  const outOfPlane: NeumaierSum = { sum: 0, correction: 0 };
  const diffusionCoefficient = parameters.dtCa / 12;
  if (!Number.isFinite(diffusionCoefficient)) {
    throw new RangeError('diffusion coefficient overflowed');
  }

  for (let index = 0; index < cellCount; index += 1) {
    const { q, r } = coordinates[index]!;
    const neighborIndices: number[] = [];
    for (const [dq, dr] of NEIGHBORS) {
      const neighbor = axialIndex(state.radius, q + dq, r + dr);
      if (neighbor !== null) neighborIndices.push(neighbor);
    }

    let diffusedValue = (1 - diffusionCoefficient * neighborIndices.length) * mobile[index]!;
    for (const neighbor of neighborIndices) {
      diffusedValue += diffusionCoefficient * mobile[neighbor]!;
    }
    if (!Number.isFinite(diffusedValue) || diffusedValue < 0) {
      throw new RangeError(`waterMass[${index}] became invalid during diffusion`);
    }
    diffused[index] = diffusedValue;
    add(diffusion, diffusedValue - mobile[index]!, 'diffusionNet');

    const noisyGamma = parameters.gamma * (1 + parameters.noiseAmplitude * state.noise[index]!);
    const addition = receptive[index] === 1 ? noisyGamma * parameters.dtCa : 0;
    if (!Number.isFinite(noisyGamma) || !Number.isFinite(addition) || addition < 0) {
      throw new RangeError(`outOfPlaneInput[${index}] became invalid`);
    }
    add(outOfPlane, addition, 'outOfPlaneInput');

    const rawCandidate = deposited[index]! + diffusedValue + addition;
    if (!Number.isFinite(rawCandidate) || rawCandidate < 0) {
      throw new RangeError(`waterMass[${index}] became invalid during the update`);
    }
    candidate[index] = rawCandidate;
  }

  for (let index = 0; index < cellCount; index += 1) {
    const { q, r } = coordinates[index]!;
    if (hexDistance(q, r) === state.radius) {
      add(reservoir, parameters.beta - candidate[index]!, 'reservoirExchange');
      waterMass[index] = parameters.beta;
      ice[index] = 0;
    } else {
      waterMass[index] = candidate[index]!;
      ice[index] = state.ice[index] === 1 || candidate[index]! >= 1 ? 1 : 0;
    }
  }

  let reachedEdge = false;
  for (let index = 0; index < cellCount; index += 1) {
    const { q, r } = coordinates[index]!;
    if (hexDistance(q, r) === state.radius - 1 && ice[index] === 1) {
      reachedEdge = true;
      break;
    }
  }

  const afterTotal = totalWater(waterMass, 'afterTotal');
  const diffusionNet = finish(diffusion, 'diffusionNet');
  const outOfPlaneInput = finish(outOfPlane, 'outOfPlaneInput');
  const reservoirExchange = finish(reservoir, 'reservoirExchange');
  const residual = ((afterTotal - beforeTotal) - outOfPlaneInput) - reservoirExchange;
  if (!Number.isFinite(residual)) {
    throw new RangeError('residual overflowed');
  }

  const nextState: LatticeState = {
    radius: state.radius,
    waterMass,
    ice,
    noise: new Float64Array(state.noise),
    stepIndex: nextStepIndex,
    elapsedCa: nextElapsedCa,
    stopped: reachedEdge,
    beta: parameters.beta,
    noiseAmplitude: parameters.noiseAmplitude,
    seed: [...state.seed],
    modelVersion: state.modelVersion,
  };
  const ledger: MassLedger = {
    beforeTotal,
    afterTotal,
    diffusionNet,
    outOfPlaneInput,
    reservoirExchange,
    residual: residual === 0 ? 0 : residual,
  };
  return { state: nextState, ledger, reachedEdge };
}
