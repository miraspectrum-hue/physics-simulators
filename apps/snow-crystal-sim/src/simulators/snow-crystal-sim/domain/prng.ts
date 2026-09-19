import type { Seed128, Xoshiro128ssResult } from './types';

const UINT32_MAX = 0xffff_ffff;

function requireFinite(value: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}

function normalizedSeed(state: Seed128): Seed128 {
  if (!Array.isArray(state) || state.length !== 4) {
    throw new TypeError('state must be an Array with four uint32 members');
  }

  const values: number[] = [];
  for (let index = 0; index < 4; index += 1) {
    const value = state[index];
    requireFinite(value, `state[${index}]`);
    if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
      throw new RangeError(`state[${index}] must be a uint32`);
    }
    values.push(value === 0 ? 0 : value);
  }
  if (values.every((value) => value === 0)) {
    throw new RangeError('xoshiro128** state must not be all zero');
  }
  return values as unknown as Seed128;
}

function rotateLeft32(value: number, shift: number): number {
  return ((value << shift) | (value >>> (32 - shift))) >>> 0;
}

export function nextXoshiro128ss(state: Seed128): Xoshiro128ssResult {
  const [a, b, c, d] = normalizedSeed(state);
  const output = Math.imul(rotateLeft32(Math.imul(b, 5) >>> 0, 7), 9) >>> 0;
  const t = (b << 9) >>> 0;
  const c1 = (c ^ a) >>> 0;
  const d1 = (d ^ b) >>> 0;
  const b1 = (b ^ c1) >>> 0;
  const a1 = (a ^ d1) >>> 0;
  const c2 = (c1 ^ t) >>> 0;
  const d2 = rotateLeft32(d1, 11);
  return { output, state: [a1, b1, c2, d2] };
}

export function uint32ToNoise(output: number): number {
  requireFinite(output, 'output');
  if (!Number.isInteger(output) || output < 0 || output > UINT32_MAX) {
    throw new RangeError('output must be a uint32');
  }
  const u = output / 4294967296;
  return 2 * u - 1;
}
