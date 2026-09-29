import { MODEL_VERSION } from './types';
import type { LatticeState, MorphologyMetrics, SixArmValues } from './types';

const UINT32_MAX = 0xffff_ffff;
const NEIGHBORS: readonly (readonly [number, number])[] = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];
const COMPACTNESS_DENOMINATOR = 6 * Math.PI * Math.sqrt(3);

interface NeumaierSum {
  sum: number;
  correction: number;
}

function finiteScalar(value: unknown, field: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${field} must be a finite number`);
  }
}

function boundedScalar(
  value: unknown,
  field: string,
  minimum: number,
  maximum: number,
): asserts value is number {
  finiteScalar(value, field);
  if (value < minimum || value > maximum) {
    throw new RangeError(`${field} is outside its allowed range`);
  }
}

function hexDistance(q: number, r: number): number {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}

function rowStartIndex(radius: number, r: number): number {
  if (r <= 0) {
    const precedingRows = r + radius;
    return precedingRows * (radius + 1) + precedingRows * (precedingRows - 1) / 2;
  }

  const trailingRows = radius - r + 1;
  const twiceAverageTrailingRowLength = 3 * radius + 2 - r;
  const trailingCellCount = trailingRows % 2 === 0
    ? (trailingRows / 2) * twiceAverageTrailingRowLength
    : trailingRows * (twiceAverageTrailingRowLength / 2);
  return 1 + 3 * radius * (radius + 1) - trailingCellCount;
}

function axialIndexUnchecked(radius: number, q: number, r: number): number | null {
  if (hexDistance(q, r) > radius) return null;
  const minimumQ = Math.max(-radius, -radius - r);
  return rowStartIndex(radius, r) + q - minimumQ;
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

  let index = 0;
  for (let r = -state.radius; r <= state.radius; r += 1) {
    const minimumQ = Math.max(-state.radius, -state.radius - r);
    const maximumQ = Math.min(state.radius, state.radius - r);
    for (let q = minimumQ; q <= maximumQ; q += 1) {
      const mass = state.waterMass[index]!;
      if (!Number.isFinite(mass) || mass < 0) {
        throw new RangeError(`waterMass[${index}] must be finite and nonnegative`);
      }
      const ice = state.ice[index]!;
      if (ice !== 0 && ice !== 1) {
        throw new RangeError(`ice[${index}] must be 0 or 1`);
      }
      if (ice === 1 && hexDistance(q, r) === state.radius) {
        throw new RangeError(`ice[${index}] is forbidden on the reservoir ring`);
      }
      const noise = state.noise[index]!;
      if (!Number.isFinite(noise) || noise < -1 || noise >= 1) {
        throw new RangeError(`noise[${index}] must be in [-1, 1)`);
      }
      index += 1;
    }
  }

  return cellCount;
}

function validateThickness(thicknessCells: unknown): asserts thicknessCells is number | undefined {
  if (thicknessCells === undefined) return;
  finiteScalar(thicknessCells, 'thicknessCells');
  if (thicknessCells < 0) {
    throw new RangeError('thicknessCells must be nonnegative');
  }
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

function sector(q: number, r: number): number {
  if (q >= 0 && r >= 0) return 0;
  if (q < 0 && r > 0 && q + r >= 0) return 1;
  if (q < 0 && r >= 0 && q + r < 0) return 2;
  if (q <= 0 && r < 0) return 3;
  if (q > 0 && r < 0 && q + r <= 0) return 4;
  if (q > 0 && r < 0 && q + r > 0) return 5;
  throw new RangeError('non-center axial coordinate does not belong to one sector');
}

function coefficientOfVariation(values: SixArmValues, field: string): number | null {
  let maximum = 0;
  for (let index = 0; index < 6; index += 1) {
    const value = values[index]!;
    if (!Number.isFinite(value) || value < 0) {
      throw new RangeError(`${field}[${index}] is invalid`);
    }
    if (value > maximum) maximum = value;
  }
  if (maximum === 0) return null;

  const scaled = new Array<number>(6);
  let scaledTotal = 0;
  for (let index = 0; index < 6; index += 1) {
    const value = values[index]! / maximum;
    scaled[index] = value;
    scaledTotal += value;
    if (!Number.isFinite(value) || !Number.isFinite(scaledTotal)) {
      throw new RangeError(`${field} mean overflowed`);
    }
  }
  const mean = scaledTotal / 6;
  if (!Number.isFinite(mean) || mean <= 0) {
    throw new RangeError(`${field} mean is invalid`);
  }

  let squaredDeviationTotal = 0;
  for (let index = 0; index < 6; index += 1) {
    const deviation = scaled[index]! - mean;
    const term = deviation * deviation;
    squaredDeviationTotal += term;
    if (!Number.isFinite(term) || !Number.isFinite(squaredDeviationTotal)) {
      throw new RangeError(`${field} variance overflowed`);
    }
  }
  const variance = squaredDeviationTotal / 6;
  const cv = Math.sqrt(variance) / mean;
  if (variance < 0 || !Number.isFinite(variance) || !Number.isFinite(cv)) {
    throw new RangeError(`${field} coefficient of variation is invalid`);
  }
  return cv === 0 ? 0 : cv;
}

/** Measures independent, deterministic discrete morphology on the complete lattice. */
export function morphologyMetrics(
  state: LatticeState,
  thicknessCells?: number,
): MorphologyMetrics {
  const cellCount = validateState(state);
  validateThickness(thicknessCells);

  let iceCellCount = 0;
  let perimeterEdges = 0;
  let tipCount = 0;
  let basalRadiusCells = 0;
  const armLength: number[] = [0, 0, 0, 0, 0, 0];
  const armMassAccumulators: NeumaierSum[] = Array.from(
    { length: 6 },
    () => ({ sum: 0, correction: 0 }),
  );

  let index = 0;
  for (let r = -state.radius; r <= state.radius; r += 1) {
    const minimumQ = Math.max(-state.radius, -state.radius - r);
    const maximumQ = Math.min(state.radius, state.radius - r);
    for (let q = minimumQ; q <= maximumQ; q += 1) {
      if (state.ice[index] === 1) {
        iceCellCount += 1;
        if (!Number.isSafeInteger(iceCellCount)) {
          throw new RangeError('iceCellCount overflowed');
        }

        const radialSquare = q * q + q * r + r * r;
        const radius = Math.sqrt(radialSquare);
        if (!Number.isFinite(radialSquare) || !Number.isFinite(radius)) {
          throw new RangeError(`basalRadiusCells overflowed at index ${index}`);
        }
        if (radius > basalRadiusCells) basalRadiusCells = radius;

        let iceNeighborCount = 0;
        for (const [deltaQ, deltaR] of NEIGHBORS) {
          const neighborIndex = axialIndexUnchecked(state.radius, q + deltaQ, r + deltaR);
          if (neighborIndex !== null && state.ice[neighborIndex] === 1) {
            iceNeighborCount += 1;
          } else {
            perimeterEdges += 1;
            if (!Number.isSafeInteger(perimeterEdges)) {
              throw new RangeError('perimeterEdges overflowed');
            }
          }
        }
        if (iceNeighborCount === 1) tipCount += 1;

        if (q !== 0 || r !== 0) {
          const arm = sector(q, r);
          if (radius > armLength[arm]!) armLength[arm] = radius;
          add(armMassAccumulators[arm]!, state.waterMass[index]!, `armMass[${arm}]`);
        }
      }
      index += 1;
    }
  }
  if (index !== cellCount) {
    throw new RangeError('lattice enumeration did not match the validated cell count');
  }

  const basalDiameterCells = 2 * basalRadiusCells;
  if (!Number.isFinite(basalDiameterCells)) {
    throw new RangeError('basalDiameterCells overflowed');
  }

  let compactness = 0;
  let tipDensity = 0;
  if (iceCellCount > 0) {
    compactness = ((perimeterEdges / iceCellCount) * perimeterEdges) / COMPACTNESS_DENOMINATOR;
    tipDensity = tipCount / iceCellCount;
    if (!Number.isFinite(compactness) || !Number.isFinite(tipDensity)) {
      throw new RangeError('morphology scalar overflowed');
    }
  }

  const armMass = armMassAccumulators.map((accumulator, arm) => (
    finish(accumulator, `armMass[${arm}]`)
  ));
  const armLengthValues = armLength as unknown as SixArmValues;
  const armMassValues = armMass as unknown as SixArmValues;
  const armLengthCv = coefficientOfVariation(armLengthValues, 'armLength');
  const armMassCv = coefficientOfVariation(armMassValues, 'armMass');

  let aspectRatio: number | null = null;
  if (thicknessCells !== undefined && basalDiameterCells > 0) {
    const quotient = thicknessCells / basalDiameterCells;
    if (!Number.isFinite(quotient)) {
      throw new RangeError('aspectRatio overflowed');
    }
    aspectRatio = quotient === 0 ? 0 : quotient;
  }

  return {
    basalRadiusCells: basalRadiusCells === 0 ? 0 : basalRadiusCells,
    basalDiameterCells: basalDiameterCells === 0 ? 0 : basalDiameterCells,
    iceCellCount,
    perimeterEdges,
    compactness: compactness === 0 ? 0 : compactness,
    tipDensity: tipDensity === 0 ? 0 : tipDensity,
    aspectRatio,
    armLength: armLengthValues,
    armMass: armMassValues,
    armLengthCv,
    armMassCv,
  };
}
