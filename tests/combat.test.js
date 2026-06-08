import { describe, it, expect } from 'vitest';
import { aabbOverlap, toroidalOverlap, canCatch, isArmed, arrowLethal, isStomp, isInvulnerable, killOrShield, playersInRadius, destructibleCellsInRadius, spikeOverlap } from '../combat.js';
import { DEFAULT_CONFIG } from '../config.js';
import { SPIKE } from '../tilemap.js';

const cfg = () => ({ ...DEFAULT_CONFIG });

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

describe('combat predicates', () => {
  it('canCatch only during the invuln window of a dodge', () => {
    expect(canCatch({ state: 'DODGING', invulnTime: 3 })).toBe(true);
    expect(canCatch({ state: 'DODGING', invulnTime: 0 })).toBe(false);
    expect(canCatch({ state: 'AIRBORNE', invulnTime: 3 })).toBe(false);
  });
  it('isArmed after the self-arm delay', () => {
    expect(isArmed({ ageFrames: DEFAULT_CONFIG.selfArmFrames }, cfg())).toBe(true);
    expect(isArmed({ ageFrames: 0 }, cfg())).toBe(false);
  });
  it("an opponent's arrow is always lethal", () => {
    expect(arrowLethal({ owner: 1, ageFrames: 0 }, 0, cfg())).toBe(true);
  });
  it('your own arrow is lethal only after arming', () => {
    expect(arrowLethal({ owner: 0, ageFrames: 0 }, 0, cfg())).toBe(false);
    expect(arrowLethal({ owner: 0, ageFrames: 99 }, 0, cfg())).toBe(true);
  });
});

describe('stomp', () => {
  // victim AABB at (50,50,8,12) → top edge y=50
  const victim = { x: 50, y: 50, w: 8, h: 12, vy: 0 };
  it('is a stomp when falling onto the head from above with overlap', () => {
    const stomper = { x: 51, y: 40, w: 8, h: 12, vy: 80, prevBottom: 49 };
    expect(isStomp(stomper, victim)).toBe(true);
  });
  it('is not a stomp when moving up', () => {
    const stomper = { x: 51, y: 40, w: 8, h: 12, vy: -80, prevBottom: 49 };
    expect(isStomp(stomper, victim)).toBe(false);
  });
  it('is not a stomp on a side hit (no vertical-from-above)', () => {
    const stomper = { x: 51, y: 50, w: 8, h: 12, vy: 80, prevBottom: 62 };
    expect(isStomp(stomper, victim)).toBe(false);
  });
  it('is NOT a stomp when the stomper is far above (no real contact yet)', () => {
    // descending + horizontally overlapping + was above the head last frame,
    // but its body is nowhere near the victim this frame: must not stomp.
    const stomper = { x: 51, y: 10, w: 8, h: 12, vy: 80, prevBottom: 21 };
    expect(isStomp(stomper, victim)).toBe(false);
  });
});

describe('explosion & shield helpers', () => {
  it('isInvulnerable during the dodge window', () => {
    expect(isInvulnerable({ invulnTime: 2 })).toBe(true);
    expect(isInvulnerable({ invulnTime: 0 })).toBe(false);
  });
  it('killOrShield consumes a shield, then kills', () => {
    const p = { state: 'AIRBORNE', shield: true, vx: 5, vy: 5 };
    expect(killOrShield(p)).toBe(false);   // absorbed
    expect(p.shield).toBe(false);
    expect(p.state).toBe('AIRBORNE');
    expect(killOrShield(p)).toBe(true);    // now lethal
    expect(p.state).toBe('DEAD');
  });
  it('playersInRadius returns players within the (toroidal) radius', () => {
    const a = { x: 48, y: 48, w: 8, h: 12 };  // center ~ (52,54)
    const far = { x: 200, y: 100, w: 8, h: 12 };
    const got = playersInRadius([a, far], 52, 54, 20, 320, 180);
    expect(got).toContain(a);
    expect(got).not.toContain(far);
  });
  it('playersInRadius sees across the seam', () => {
    const edge = { x: 314, y: 50, w: 8, h: 12 }; // center ~318
    const got = playersInRadius([edge], 2, 56, 20, 320, 180); // x=2 ~4px from 318 across seam
    expect(got).toContain(edge);
  });
  it('destructibleCellsInRadius returns only DESTRUCT cells in range', () => {
    const grid = [
      [0, 0, 0],
      [0, 3, 1], // (1,1)=destruct, (2,1)=solid
      [0, 0, 0],
    ];
    const cells = destructibleCellsInRadius(grid, 15, 15, 8, 10, 30, 30); // near col1,row1 center (15,15)
    expect(cells).toEqual([{ r: 1, c: 1 }]);
  });
});

describe('spikeOverlap', () => {
  const grid = [[0, 0, 0], [0, SPIKE, 0], [0, 0, 0]]; // spike at col1,row1 (10..20)
  it('true when the player AABB overlaps a spike cell', () => {
    expect(spikeOverlap(grid, { x: 11, y: 11, w: 6, h: 6 }, 10)).toBe(true);
  });
  it('false when clear of spikes', () => {
    expect(spikeOverlap(grid, { x: 0, y: 0, w: 6, h: 6 }, 10)).toBe(false);
  });
});
