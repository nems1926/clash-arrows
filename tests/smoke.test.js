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
});
