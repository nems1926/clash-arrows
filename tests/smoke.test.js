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
  it('exposes sane combat defaults', () => {
    // values are tunable (calibrated via the debug panel) — assert invariants,
    // not exact literals, so calibration doesn't break the suite.
    expect(DEFAULT_CONFIG.arrowSpeed).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.arrowGravity).toBeLessThan(DEFAULT_CONFIG.gravity);
    expect(DEFAULT_CONFIG.quiverStart).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.roundsToWin).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.dodgeInvulnFrames).toBeLessThanOrEqual(DEFAULT_CONFIG.dodgeDuration);
  });
});
