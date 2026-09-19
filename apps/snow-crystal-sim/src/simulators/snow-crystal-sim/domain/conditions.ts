import type { NormalizedConditions } from './types';

function requireFinite(value: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}

export function normalizeConditions(temperatureC: number, supersaturationPct: number): NormalizedConditions {
  requireFinite(temperatureC, 'temperatureC');
  requireFinite(supersaturationPct, 'supersaturationPct');

  const normalizedTemperatureC = Math.min(0, Math.max(-30, temperatureC));
  const normalizedSupersaturationPct = Math.min(30, Math.max(0, supersaturationPct));

  return {
    temperatureC: normalizedTemperatureC,
    supersaturationPct: normalizedSupersaturationPct,
    x: (normalizedTemperatureC + 30) / 30,
    y: normalizedSupersaturationPct / 30,
    clamped:
      normalizedTemperatureC !== temperatureC
      || normalizedSupersaturationPct !== supersaturationPct,
  };
}
