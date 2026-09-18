import { MODEL_VERSION } from './types';
import type { CreateLatticeInput, LatticeState } from './types';

// T1-1 compile-time scaffold. It intentionally performs no allocation policy or initialization logic.
export function createLattice(_input: CreateLatticeInput): LatticeState {
  return { radius: 0, waterMass: new Float64Array(), ice: new Uint8Array(), noise: new Float64Array(), stepIndex: -1, elapsedCa: -1, stopped: true, beta: -1, noiseAmplitude: -1, seed: [0, 0, 0, 0], modelVersion: MODEL_VERSION };
}
