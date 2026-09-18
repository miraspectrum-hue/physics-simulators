import { describe, expect, it } from 'vitest';
import { axialAtIndex, axialIndex, axialNeighbors, axialToCartesian, cartesianToAxial, enumerateAxial, hexRadius, latticeCellCount } from '../index';
import type { AxialCoord, CartesianXZ } from '../index';

const M = Number.MAX_SAFE_INTEGER;
const radius2 = [
  { q: 0, r: -2 }, { q: 1, r: -2 }, { q: 2, r: -2 }, { q: -1, r: -1 }, { q: 0, r: -1 }, { q: 1, r: -1 }, { q: 2, r: -1 },
  { q: -2, r: 0 }, { q: -1, r: 0 }, { q: 0, r: 0 }, { q: 1, r: 0 }, { q: 2, r: 0 }, { q: -2, r: 1 }, { q: -1, r: 1 }, { q: 0, r: 1 }, { q: 1, r: 1 },
  { q: -2, r: 2 }, { q: -1, r: 2 }, { q: 0, r: 2 },
] as const;
const close = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(16 * Number.EPSILON * Math.max(1, Math.abs(actual), Math.abs(expected)));
const axialTypeSentinel: AxialCoord = { q: 0, r: 0 };
const cartesianTypeSentinel: CartesianXZ = { x: 0, z: 0 };
const ring2Indices = [0, 1, 2, 3, 6, 7, 11, 12, 15, 16, 17, 18];
const hexTestRadius = (q: number, r: number) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
const neighborDeltas = [{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }];
const expectNeighborDeltas = (q: number, r: number) => {
  expect(axialNeighbors(q, r).map((neighbor) => ({ q: neighbor.q - q, r: neighbor.r - r }))).toEqual(neighborDeltas);
};

describe('TC-HEX: axial lattice and Cartesian transforms', () => {
  it('TC-HEX-001 computes cube radius and ordered, distinct six neighbors', () => {
    expect(axialTypeSentinel).toEqual({ q: 0, r: 0 });
    expect(hexRadius(0, 0)).toBe(0);
    expect(hexRadius(2, -1)).toBe(2);
    expect(hexRadius(-2, 1)).toBe(2);
    const neighbors = axialNeighbors(0, 0);
    expect(neighbors).toEqual([{ q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 }, { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 }]);
    expect(new Set(neighbors.map(({ q, r }) => `${q},${r}`)).size).toBe(6);
    for (const neighbor of neighbors) expect(hexRadius(neighbor.q, neighbor.r)).toBe(1);
  });

  it('TC-HEX-002 uses the specified XZ basis and analytic inverse within tauCoord', () => {
    expect(cartesianTypeSentinel).toEqual({ x: 0, z: 0 });
    const qBasis = axialToCartesian(1, 0);
    close(qBasis.x, 1); close(qBasis.z, 0);
    const rBasis = axialToCartesian(0, 1);
    close(rBasis.x, 0.5); close(rBasis.z, Math.sqrt(3) / 2);
    const inverse = cartesianToAxial(0.75, Math.sqrt(3) / 2);
    close(inverse.q, 0.25); close(inverse.r, 1);
    const directXZ = axialToCartesian(2, -1);
    close(directXZ.x, 1.5); close(directXZ.z, -Math.sqrt(3) / 2);
    const directInverse = cartesianToAxial(1.5, -Math.sqrt(3) / 2);
    close(directInverse.q, 2); close(directInverse.r, -1);
    const coordinate = { q: 24149949, r: -48187277 };
    const coordinateXZ = axialToCartesian(coordinate.q, coordinate.r);
    const roundTrip = cartesianToAxial(coordinateXZ.x, coordinateXZ.z);
    close(roundTrip.q, coordinate.q); close(roundTrip.r, coordinate.r);
  });

  it('TC-HEX-003 and 004 enumerate radius two in literal order with bidirectional indices', () => {
    expect(latticeCellCount(2)).toBe(19);
    expect(enumerateAxial(2)).toEqual(radius2);
    radius2.forEach((coordinate, index) => {
      expect(axialIndex(2, coordinate.q, coordinate.r)).toBe(index);
      expect(axialAtIndex(2, index)).toEqual(coordinate);
    });
    expect(radius2.map(({ q, r }, index) => hexTestRadius(q, r) === 2 ? index : -1).filter((index) => index >= 0)).toEqual(ring2Indices);
    expect(radius2.map(({ q, r }, index) => hexTestRadius(q, r) <= 1 ? index : -1).filter((index) => index >= 0)).toEqual([4, 5, 8, 9, 10, 13, 14]);
    expect(axialIndex(2, 3, 0)).toBeNull();
    expect(axialIndex(2, 0, -3)).toBeNull();
    expect(axialIndex(2, -3, 3)).toBeNull();
  });

  it('TC-HEX-005 checks radius-three formula, rings, neighbor distance and translation invariance', () => {
    const cells = enumerateAxial(3);
    expect(latticeCellCount(3)).toBe(37);
    expect(cells).toHaveLength(37);
    expect(cells.filter(({ q, r }) => hexTestRadius(q, r) === 3)).toHaveLength(18);
    for (const cell of cells) {
      expect(axialAtIndex(3, axialIndex(3, cell.q, cell.r) as number)).toEqual(cell);
      for (const neighbor of axialNeighbors(cell.q, cell.r)) expect(Math.abs(hexRadius(neighbor.q, neighbor.r) - hexRadius(cell.q, cell.r))).toBeLessThanOrEqual(1);
    }
    const center = { q: -4, r: 2 }; const shift = { q: 7, r: -3 };
    const translated = { q: center.q + shift.q, r: center.r + shift.r };
    expectNeighborDeltas(center.q, center.r);
    expectNeighborDeltas(translated.q, translated.r);
  });

  it('TC-HEX-006 accepts safe-neighbor maximum and preserves a large coordinate round trip', () => {
    expectNeighborDeltas(M - 1, 0);
    for (const neighbor of axialNeighbors(M - 1, 0)) {
      expect(Number.isSafeInteger(neighbor.q)).toBe(true);
      expect(Number.isSafeInteger(neighbor.r)).toBe(true);
      expect(Number.isSafeInteger(neighbor.q + neighbor.r)).toBe(true);
    }
    const maximumCartesian = axialToCartesian(M - 1, 0);
    expect(Number.isFinite(maximumCartesian.x)).toBe(true); expect(Number.isFinite(maximumCartesian.z)).toBe(true);
    const maximumRoundTrip = cartesianToAxial(maximumCartesian.x, maximumCartesian.z);
    close(maximumRoundTrip.q, M - 1); close(maximumRoundTrip.r, 0);
    const cartesian = axialToCartesian(24149949, -48187277);
    const roundTrip = cartesianToAxial(cartesian.x, cartesian.z);
    close(roundTrip.q, 24149949); close(roundTrip.r, -48187277);
  });

  it('TC-HEX-007 rejects invalid, unsafe, and overflowing coordinates in validation order', () => {
    for (const value of [NaN, Infinity, -Infinity, '1' as unknown as number]) {
      for (const axial of [hexRadius, axialNeighbors, axialToCartesian]) {
        expect(() => axial(value, 0)).toThrow(TypeError);
        expect(() => axial(0, value)).toThrow(TypeError);
      }
      expect(() => cartesianToAxial(value, 0)).toThrow(TypeError);
      expect(() => cartesianToAxial(0, value)).toThrow(TypeError);
    }
    for (const value of [0.5, M, M + 1]) {
      for (const axial of [hexRadius, axialNeighbors, axialToCartesian]) {
        expect(() => axial(value, 0)).toThrow(RangeError);
        expect(() => axial(0, value)).toThrow(RangeError);
      }
    }
    for (const axial of [hexRadius, axialNeighbors, axialToCartesian]) expect(() => axial(M - 1, 1)).toThrow(RangeError);
    expect(() => cartesianToAxial(Number.MAX_VALUE, Number.MAX_VALUE)).toThrow(RangeError);
    const firstOverflowR = (2 * Number.MAX_VALUE) / Math.sqrt(3);
    expect(Number.isFinite(firstOverflowR)).toBe(false);
    expect(() => cartesianToAxial(Number.MAX_VALUE, Number.MAX_VALUE / 4)).toThrow(RangeError);
    const q = Number.MAX_VALUE - Number.MAX_VALUE / (4 * Math.sqrt(3));
    const r = (2 / Math.sqrt(3)) * (Number.MAX_VALUE / 4);
    expect(Number.isFinite(q)).toBe(true); expect(Number.isFinite(r)).toBe(true); expect(q + r).toBe(Infinity);
    expect(() => hexRadius(0.5, NaN)).toThrow(RangeError);
    expect(() => hexRadius(NaN, 0.5)).toThrow(TypeError);
    expect(() => cartesianToAxial(Number.MAX_VALUE, NaN)).toThrow(TypeError);
  });

  it('TC-HEX-008 validates radius, index, and safe cell-count boundaries without allocation', () => {
    expect(latticeCellCount(115)).toBe(40021);
    expect(latticeCellCount(54794157)).toBe(9007199088404419);
    const cellCountBigInt = (radius: bigint) => 1n + 3n * radius * (radius + 1n);
    expect(cellCountBigInt(54794157n)).toBe(9007199088404419n);
    expect(cellCountBigInt(54794158n)).toBe(9007199417169367n);
    for (const radius of [NaN, Infinity, -Infinity, '2' as unknown as number]) expect(() => latticeCellCount(radius)).toThrow(TypeError);
    for (const radius of [1, 2.5, M + 1, 54794158]) expect(() => latticeCellCount(radius)).toThrow(RangeError);
    for (const index of [-1, 19, 0.5, M + 1]) expect(() => axialAtIndex(2, index)).toThrow(RangeError);
    for (const index of [NaN, Infinity, -Infinity, '0' as unknown as number]) expect(() => axialAtIndex(2, index)).toThrow(TypeError);
    for (const value of [NaN, Infinity, -Infinity, '0' as unknown as number]) expect(() => axialIndex(2, 0, value)).toThrow(TypeError);
    for (const value of [0.5, M, M + 1]) expect(() => axialIndex(2, 0, value)).toThrow(RangeError);
    for (const coordinate of [[M, 0], [0, M], [M - 1, 1]] as const) expect(() => axialIndex(2, coordinate[0], coordinate[1])).toThrow(RangeError);
    expect(() => axialIndex(NaN, 0.5, 0)).toThrow(TypeError);
    expect(() => axialIndex(1, NaN, 0)).toThrow(RangeError);
    expect(() => axialIndex(2, NaN, 0.5)).toThrow(TypeError);
    expect(() => axialIndex(2, 0.5, NaN)).toThrow(RangeError);
    expect(() => axialAtIndex(NaN, 0.5)).toThrow(TypeError);
    expect(() => axialAtIndex(1, NaN)).toThrow(RangeError);
    expect(() => axialAtIndex(2, NaN)).toThrow(TypeError);
    for (const radius of [NaN, Infinity, -Infinity, '2' as unknown as number]) expect(() => enumerateAxial(radius)).toThrow(TypeError);
    for (const radius of [1, 2.5, M + 1, 54794158]) expect(() => enumerateAxial(radius)).toThrow(RangeError);
    const enumerated = enumerateAxial(2);
    const firstSnapshot = enumerated.map(({ q, r }) => ({ q, r }));
    const enumeratedAgain = enumerateAxial(2);
    expect(enumerated).toEqual(firstSnapshot); expect(firstSnapshot).toEqual(radius2); expect(enumeratedAgain).toEqual(firstSnapshot);
    expect(() => enumerateAxial(2.5)).toThrow(RangeError);
    expect(() => enumerateAxial(2n as unknown as number)).toThrow(TypeError);
  });
});
