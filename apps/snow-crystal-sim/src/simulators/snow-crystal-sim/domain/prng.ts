import type { Seed128, Xoshiro128ssResult } from './types';

// T1-1 compile-time scaffolds only; this is deliberately not a PRNG implementation.
export function nextXoshiro128ss(_state: Seed128): Xoshiro128ssResult { return { output: 0, state: [0, 0, 0, 0] }; }
export function uint32ToNoise(_output: number): number { return 999; }
