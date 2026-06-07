import { describe, it, expect } from 'vitest';
import { canShoot, spendArrow, addArrow } from '../quiver.js';

describe('quiver', () => {
  it('can shoot when arrows remain', () => {
    expect(canShoot({ quiver: 1 })).toBe(true);
    expect(canShoot({ quiver: 0 })).toBe(false);
  });
  it('spending decrements but never below zero', () => {
    const p = { quiver: 1 };
    spendArrow(p);
    expect(p.quiver).toBe(0);
    spendArrow(p);
    expect(p.quiver).toBe(0);
  });
  it('adding increments', () => {
    const p = { quiver: 0 };
    addArrow(p);
    expect(p.quiver).toBe(1);
  });
});
