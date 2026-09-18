import type { AxialCoord, CartesianXZ } from './types';

// T1-1 compile-time scaffolds only; no coordinate or lattice algorithm is implemented here.
export function hexRadius(_q: number, _r: number): number { return -999; }
export function axialNeighbors(_q: number, _r: number): readonly [AxialCoord, AxialCoord, AxialCoord, AxialCoord, AxialCoord, AxialCoord] {
  const cell = { q: 999, r: 999 };
  return [cell, cell, cell, cell, cell, cell];
}
export function axialToCartesian(_q: number, _r: number): CartesianXZ { return { x: 999, z: 999 }; }
export function cartesianToAxial(_x: number, _z: number): AxialCoord { return { q: 999, r: 999 }; }
export function latticeCellCount(_radius: number): number { return 0; }
export function enumerateAxial(_radius: number): readonly AxialCoord[] { return []; }
export function axialIndex(_radius: number, _q: number, _r: number): number | null { return null; }
export function axialAtIndex(_radius: number, _index: number): AxialCoord { return { q: 999, r: 999 }; }
