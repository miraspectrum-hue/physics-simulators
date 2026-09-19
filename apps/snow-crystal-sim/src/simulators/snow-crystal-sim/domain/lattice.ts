import { MODEL_VERSION } from './types';
import type { CreateLatticeInput, LatticeState } from './types';
import { latticeCellCount, axialIndex } from './hex-lattice';
import { nextXoshiro128ss, uint32ToNoise } from './prng';

const UINT32_MAX = 0xffff_ffff;

function requireFinite(value: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}

function copySeed(seed: CreateLatticeInput['seed']): CreateLatticeInput['seed'] {
  if (!Array.isArray(seed) || seed.length !== 4) {
    throw new TypeError('seed must be an Array with four uint32 members');
  }

  const values: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    const value = seed[index];
    requireFinite(value, `seed[${index}]`);
    if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
      throw new RangeError(`seed[${index}] must be a uint32`);
    }
    values.push(value === 0 ? 0 : value);
  }
  if (values.every((value) => value === 0)) {
    throw new RangeError('seed must not be all zero');
  }
  return values as unknown as CreateLatticeInput['seed'];
}

function requireInRange(value: number, name: string, minimum: number, maximum: number): void {
  requireFinite(value, name);
  if (value < minimum || value > maximum) {
    throw new RangeError(`${name} must be in [${minimum}, ${maximum}]`);
  }
}

export function createLattice(input: CreateLatticeInput): LatticeState {
  const cellCount = latticeCellCount(input.radius);
  const seed = copySeed(input.seed);
  requireInRange(input.beta, 'beta', 0, 0.95);
  requireInRange(input.noiseAmplitude, 'noiseAmplitude', 0, 1);

  const waterMass = new Float64Array(cellCount);
  const ice = new Uint8Array(cellCount);
  const noise = new Float64Array(cellCount);

  let state = seed;
  for (let index = 0; index < cellCount; index += 1) {
    const result = nextXoshiro128ss(state);
    noise[index] = uint32ToNoise(result.output);
    state = result.state;
  }

  waterMass.fill(input.beta);
  const centerIndex = axialIndex(input.radius, 0, 0);
  if (centerIndex === null) {
    throw new RangeError('lattice must contain its center cell');
  }
  waterMass[centerIndex] = 1;
  ice[centerIndex] = 1;

  return {
    radius: input.radius,
    waterMass,
    ice,
    noise,
    stepIndex: 0,
    elapsedCa: 0,
    stopped: false,
    beta: input.beta,
    noiseAmplitude: input.noiseAmplitude,
    seed,
    modelVersion: MODEL_VERSION,
  };
}
