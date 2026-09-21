export { MODEL_VERSION } from './types';
export type { ModelVersion, Seed128, AxialCoord, CartesianXZ, NormalizedConditions, CreateLatticeInput, LatticeState, Xoshiro128ssResult, VaporBudget } from './types';
export { normalizeConditions } from './conditions';
export { hexRadius, axialNeighbors, axialToCartesian, cartesianToAxial, latticeCellCount, enumerateAxial, axialIndex, axialAtIndex } from './hex-lattice';
export { nextXoshiro128ss, uint32ToNoise } from './prng';
export { createLattice } from './lattice';
export { vaporBudget } from './vapor-budget';
