import { describe, it, expect } from 'vitest';
import { aimVector } from '../aim.js';

const S = Math.SQRT1_2; // ≈0.707

describe('aimVector', () => {
  it('aims right when holding right', () => {
    expect(aimVector({ moveX: 1, up: false, down: false }, 1)).toEqual({ x: 1, y: 0 });
  });
  it('aims up when holding up', () => {
    expect(aimVector({ moveX: 0, up: true, down: false }, 1)).toEqual({ x: 0, y: -1 });
  });
  it('normalizes the up-left diagonal', () => {
    const v = aimVector({ moveX: -1, up: true, down: false }, 1);
    expect(v.x).toBeCloseTo(-S, 5);
    expect(v.y).toBeCloseTo(-S, 5);
  });
  it('defaults to facing when neutral', () => {
    expect(aimVector({ moveX: 0, up: false, down: false }, -1)).toEqual({ x: -1, y: 0 });
    expect(aimVector({ moveX: 0, up: false, down: false }, 1)).toEqual({ x: 1, y: 0 });
  });
  it('aims down when holding down only', () => {
    expect(aimVector({ moveX: 0, up: false, down: true }, 1)).toEqual({ x: 0, y: 1 });
  });
});
