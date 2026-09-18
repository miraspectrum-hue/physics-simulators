import type { NormalizedConditions } from './types';

// T1-1 compile-time scaffold. ArchitectPhysics replaces this sentinel in implementation.
export function normalizeConditions(_temperatureC: number, _supersaturationPct: number): NormalizedConditions {
  return { temperatureC: 999, supersaturationPct: 999, x: 999, y: 999, clamped: false };
}
