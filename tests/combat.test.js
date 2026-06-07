import { describe, it, expect } from 'vitest';
import { aabbOverlap, toroidalOverlap } from '../combat.js';

describe('aabb overlap', () => {
  const A = { x: 10, y: 10, w: 8, h: 12 };
  it('overlaps when boxes intersect', () => {
    expect(aabbOverlap(A, { x: 12, y: 12, w: 6, h: 2 })).toBe(true);
  });
  it('does not overlap when apart', () => {
    expect(aabbOverlap(A, { x: 100, y: 100, w: 6, h: 2 })).toBe(false);
  });
  it('toroidal overlap sees across the seam', () => {
    const near = { x: 0, y: 10, w: 8, h: 12 };
    const far = { x: 318, y: 10, w: 6, h: 2 }; // wraps to near 0 on a 320-wide arena
    expect(aabbOverlap(near, far)).toBe(false);
    expect(toroidalOverlap(near, far, 320, 180)).toBe(true);
  });
});
