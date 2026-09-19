import type { AxialCoord, CartesianXZ } from './types';

const MAX_SAFE_NEIGHBOR_RADIUS = Number.MAX_SAFE_INTEGER - 1;
const SQRT_THREE_OVER_TWO = Math.sqrt(3) / 2;

function requireFinite(value: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new TypeError(`${name} must be a finite number`);
  }
}

function requireAxialCoordinate(q: number, r: number): void {
  requireFinite(q, 'q');
  if (!Number.isSafeInteger(q)) {
    throw new RangeError('q must be a safe integer');
  }

  requireFinite(r, 'r');
  if (!Number.isSafeInteger(r)) {
    throw new RangeError('r must be a safe integer');
  }

  const sum = q + r;
  if (
    !Number.isSafeInteger(sum)
    || Math.max(Math.abs(q), Math.abs(r), Math.abs(sum)) > MAX_SAFE_NEIGHBOR_RADIUS
  ) {
    throw new RangeError('axial coordinate must keep all six neighbors in the safe-integer domain');
  }
}

function validatedCellCount(radius: number): number {
  requireFinite(radius, 'radius');
  if (!Number.isSafeInteger(radius) || radius < 2) {
    throw new RangeError('radius must be a safe integer greater than or equal to 2');
  }

  const count = 1 + 3 * radius * (radius + 1);
  if (!Number.isSafeInteger(count)) {
    throw new RangeError('lattice cell count must be a safe integer');
  }
  return count;
}

function qMinimum(radius: number, r: number): number {
  return Math.max(-radius, -r - radius);
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
  const cellCount = 1 + 3 * radius * (radius + 1);
  return cellCount - trailingCellCount;
}

export function hexRadius(q: number, r: number): number {
  requireAxialCoordinate(q, r);
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}

export function axialNeighbors(q: number, r: number): readonly [AxialCoord, AxialCoord, AxialCoord, AxialCoord, AxialCoord, AxialCoord] {
  requireAxialCoordinate(q, r);
  return [
    { q: q + 1, r },
    { q: q + 1, r: r - 1 },
    { q, r: r - 1 },
    { q: q - 1, r },
    { q: q - 1, r: r + 1 },
    { q, r: r + 1 },
  ];
}

export function axialToCartesian(q: number, r: number): CartesianXZ {
  requireAxialCoordinate(q, r);
  const x = q + r / 2;
  const z = SQRT_THREE_OVER_TWO * r;
  if (!Number.isFinite(x) || !Number.isFinite(z)) {
    throw new RangeError('Cartesian result must be finite');
  }
  return { x, z };
}

export function cartesianToAxial(x: number, z: number): AxialCoord {
  requireFinite(x, 'x');
  requireFinite(z, 'z');

  const r = z / SQRT_THREE_OVER_TWO;
  const q = x - r / 2;
  if (!Number.isFinite(q) || !Number.isFinite(r) || !Number.isFinite(q + r)) {
    throw new RangeError('axial result must be finite');
  }
  return { q, r };
}

export function latticeCellCount(radius: number): number {
  return validatedCellCount(radius);
}

export function enumerateAxial(radius: number): readonly AxialCoord[] {
  const count = validatedCellCount(radius);
  const coordinates = new Array<AxialCoord>(count);
  let index = 0;
  for (let r = -radius; r <= radius; r += 1) {
    const minimum = qMinimum(radius, r);
    const maximum = Math.min(radius, -r + radius);
    for (let q = minimum; q <= maximum; q += 1) {
      coordinates[index] = { q, r };
      index += 1;
    }
  }
  return coordinates;
}

export function axialIndex(radius: number, q: number, r: number): number | null {
  validatedCellCount(radius);
  requireAxialCoordinate(q, r);
  if (Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) > radius) {
    return null;
  }
  return rowStartIndex(radius, r) + q - qMinimum(radius, r);
}

export function axialAtIndex(radius: number, index: number): AxialCoord {
  const count = validatedCellCount(radius);
  requireFinite(index, 'index');
  if (!Number.isSafeInteger(index) || index < 0 || index >= count) {
    throw new RangeError('index must identify a cell in the lattice');
  }

  let low = -radius;
  let high = radius;
  while (low <= high) {
    const r = Math.floor((low + high) / 2);
    const start = rowStartIndex(radius, r);
    const nextStart = r === radius ? count : rowStartIndex(radius, r + 1);
    if (index < start) {
      high = r - 1;
    } else if (index >= nextStart) {
      low = r + 1;
    } else {
      return { q: qMinimum(radius, r) + index - start, r };
    }
  }

  throw new RangeError('index must identify a cell in the lattice');
}
