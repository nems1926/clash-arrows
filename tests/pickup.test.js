import { describe, it, expect } from 'vitest';
import { createPickup, chooseSpawn, randomType } from '../pickup.js';

describe('pickup helpers', () => {
  it('createPickup is inactive by default', () => {
    const pk = createPickup();
    expect(pk.active).toBe(false);
  });
  it('chooseSpawn picks a point using the injected rand', () => {
    const pts = [{ col: 1, row: 1 }, { col: 5, row: 2 }, { col: 9, row: 3 }];
    expect(chooseSpawn(pts, () => 0)).toEqual({ col: 1, row: 1 });
    expect(chooseSpawn(pts, () => 0.99)).toEqual({ col: 9, row: 3 });
    expect(chooseSpawn([], () => 0)).toBe(null);
  });
  it('randomType returns bomb or shield from the injected rand', () => {
    expect(randomType(() => 0.2)).toBe('bomb');
    expect(randomType(() => 0.8)).toBe('shield');
  });
});
