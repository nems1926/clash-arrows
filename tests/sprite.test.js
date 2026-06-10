import { describe, it, expect } from 'vitest';
import { selectClip, frameIndexFor, spriteFor, CLIPS, IDLE_FRAME, MOVE_EPS } from '../sprite.js';

const base = { state: 'GROUNDED', vx: 0, facing: 1 };

describe('selectClip', () => {
  it('run quand au sol et en mouvement horizontal', () => {
    expect(selectClip({ ...base, state: 'GROUNDED', vx: 50 })).toBe('run');
    expect(selectClip({ ...base, state: 'GROUNDED', vx: -50 })).toBe('run');
  });
  it('idle quand au sol et (quasi) immobile', () => {
    expect(selectClip({ ...base, state: 'GROUNDED', vx: 0 })).toBe('idle');
    expect(selectClip({ ...base, state: 'GROUNDED', vx: MOVE_EPS - 1 })).toBe('idle');
  });
  it('idle hors du sol (pas de clip dédié pour jump/dodge)', () => {
    expect(selectClip({ ...base, state: 'AIRBORNE', vx: 80 })).toBe('idle');
    expect(selectClip({ ...base, state: 'WALLSLIDE', vx: 80 })).toBe('idle');
    expect(selectClip({ ...base, state: 'DODGING', vx: 80 })).toBe('idle');
  });
});

describe('frameIndexFor', () => {
  it('idle renvoie la frame de repos fixe', () => {
    expect(frameIndexFor('idle', 0)).toBe(IDLE_FRAME);
    expect(frameIndexFor('idle', 12.3)).toBe(IDLE_FRAME);
  });
  it("run avance avec l'horloge et boucle", () => {
    expect(frameIndexFor('run', 0)).toBe(0);
    expect(frameIndexFor('run', 1 / CLIPS.run.fps)).toBe(1);
    const cycle = CLIPS.run.count / CLIPS.run.fps;
    expect(frameIndexFor('run', cycle)).toBe(0);
  });
});

describe('spriteFor', () => {
  it('expose clip + frame + flipX selon facing, atlas run', () => {
    const right = spriteFor({ ...base, state: 'GROUNDED', vx: 50, facing: 1 }, 0);
    expect(right.clip).toBe('run');
    expect(right.atlas).toBe('run');
    expect(right.frameIndex).toBe(0);
    expect(right.flipX).toBe(false);

    const left = spriteFor({ ...base, state: 'GROUNDED', vx: 50, facing: -1 }, 0);
    expect(left.flipX).toBe(true);
  });
});
