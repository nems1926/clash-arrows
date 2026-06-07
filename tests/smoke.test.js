import { describe, it, expect } from 'vitest';
import { DEFAULT_CONFIG, TILE, COLS, ROWS } from '../config.js';

describe('config', () => {
  it('has a 32x18 grid of 10px tiles', () => {
    expect(TILE).toBe(10);
    expect(COLS).toBe(32);
    expect(ROWS).toBe(18);
  });
  it('exposes tunable defaults', () => {
    expect(DEFAULT_CONFIG.vMax).toBe(90);
    expect(DEFAULT_CONFIG.gravity).toBe(600);
  });
  it('exposes combat defaults', () => {
    expect(DEFAULT_CONFIG.arrowSpeed).toBe(220);
    expect(DEFAULT_CONFIG.arrowGravity).toBeLessThan(DEFAULT_CONFIG.gravity);
    expect(DEFAULT_CONFIG.quiverStart).toBe(3);
    expect(DEFAULT_CONFIG.roundsToWin).toBe(5);
    expect(DEFAULT_CONFIG.dodgeInvulnFrames).toBeLessThanOrEqual(DEFAULT_CONFIG.dodgeDuration);
  });
});
