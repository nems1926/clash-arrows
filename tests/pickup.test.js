import { describe, it, expect } from 'vitest';
import { createPickup, chooseSpawn, randomType, PICKUP_TYPES } from '../pickup.js';

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
  it('PICKUP_TYPES includes shield and the special arrows', () => {
    expect(PICKUP_TYPES).toEqual(['shield', 'bomb', 'superbomb', 'laser', 'bolt', 'drill']);
  });
  it('randomType indexes PICKUP_TYPES via the injected rand', () => {
    expect(randomType(() => 0)).toBe('shield');
    expect(randomType(() => 0.5)).toBe('laser');   // floor(0.5*6)=3
    expect(randomType(() => 0.99)).toBe('drill');  // floor(5.94)=5
  });
});
