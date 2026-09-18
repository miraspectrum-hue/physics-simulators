import { describe, expect, it } from 'vitest';
import { normalizeConditions } from '../index';
import type { NormalizedConditions } from '../index';

const typeSentinel: NormalizedConditions = {
  temperatureC: -12.5, supersaturationPct: 7.25, x: 17.5 / 30, y: 7.25 / 30, clamped: false,
};
const expectNormalized = (actual: NormalizedConditions, expected: NormalizedConditions) => {
  for (const field of ['temperatureC', 'supersaturationPct', 'x', 'y'] as const) {
    expect(Math.abs(actual[field] - expected[field])).toBeLessThanOrEqual(1e-12);
  }
  expect(actual.clamped).toBe(expected.clamped);
};

describe('TC-NORM: normalizeConditions', () => {
  it('TC-NORM-001 maps closed interval endpoints and midpoint exactly', () => {
    expectNormalized(normalizeConditions(-30, 0), { temperatureC: -30, supersaturationPct: 0, x: 0, y: 0, clamped: false });
    expectNormalized(normalizeConditions(0, 30), { temperatureC: 0, supersaturationPct: 30, x: 1, y: 1, clamped: false });
    expectNormalized(normalizeConditions(-15, 15), { temperatureC: -15, supersaturationPct: 15, x: 0.5, y: 0.5, clamped: false });
  });

  it('TC-NORM-002 clamps each coordinate independently at the immediate exterior', () => {
    const cases = [
      [[-30.000000000001, -1e-12], { temperatureC: -30, supersaturationPct: 0, x: 0, y: 0, clamped: true }],
      [[1e-12, 30.000000000001], { temperatureC: 0, supersaturationPct: 30, x: 1, y: 1, clamped: true }],
      [[-31, 15], { temperatureC: -30, supersaturationPct: 15, x: 0, y: 0.5, clamped: true }],
      [[-15, 31], { temperatureC: -15, supersaturationPct: 30, x: 0.5, y: 1, clamped: true }],
      [[-30, 30], { temperatureC: -30, supersaturationPct: 30, x: 0, y: 1, clamped: false }],
    ] as const;
    for (const [[temperatureC, supersaturationPct], expected] of cases) expectNormalized(normalizeConditions(temperatureC, supersaturationPct), expected);
  });

  it('TC-NORM-003 rejects non-finite values and non-numbers as TypeError', () => {
    for (const value of [NaN, Infinity, -Infinity, '0' as unknown as number]) {
      expect(() => normalizeConditions(value, 10)).toThrow(TypeError);
      expect(() => normalizeConditions(-10, value)).toThrow(TypeError);
    }
  });

  it('TC-NORM-004 is deterministic and does not mutate its input primitives', () => {
    const first = normalizeConditions(-12.5, 7.25);
    const second = normalizeConditions(-12.5, 7.25);
    expectNormalized(first, typeSentinel);
    expectNormalized(second, typeSentinel);
    expect(first).toEqual(second);
  });
});
