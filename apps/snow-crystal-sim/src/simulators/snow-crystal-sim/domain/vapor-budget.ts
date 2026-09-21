import type { LatticeState, VaporBudget } from './types';

// Deliberately minimal test-code-stage sentinel. T1-5 implementation replaces it.
export function vaporBudget(_state: LatticeState): VaporBudget {
  return { mobileVapor: 0, depositedWater: 0, totalWater: 0, iceCellCount: 0 };
}
