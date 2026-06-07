import { describe, it, expect } from 'vitest';
import { logicalToWorld } from '../coords.js';

describe('logicalToWorld', () => {
  // Logical top-left (lx,ly) of an AABB w×h → q5play centered-origin sprite center.
  it('maps the arena center AABB to world origin-ish', () => {
    // W=320,H=180; an 8×12 box centered at logical (160-4,90-6)=(156,84)
    const c = logicalToWorld(156, 84, 8, 12, 320, 180);
    expect(c.x).toBeCloseTo(0, 5);
    expect(c.y).toBeCloseTo(0, 5);
  });
  it('maps logical top-left corner to negative world quadrant', () => {
    const c = logicalToWorld(0, 0, 8, 12, 320, 180);
    expect(c.x).toBeCloseTo(-320 / 2 + 4, 5);
    expect(c.y).toBeCloseTo(-180 / 2 + 6, 5);
  });
});
