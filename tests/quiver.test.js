import { describe, it, expect } from 'vitest';
import { canShoot, shootType, addArrow, addArrows, fillWith, nextType, arrowCount } from '../quiver.js';

describe('typed quiver (stack)', () => {
  it('canShoot reflects the stack', () => {
    expect(canShoot({ quiver: ['normal'] })).toBe(true);
    expect(canShoot({ quiver: [] })).toBe(false);
  });
  it('shootType pops the top type, null when empty', () => {
    const p = { quiver: ['normal', 'bomb'] };
    expect(shootType(p)).toBe('bomb');
    expect(p.quiver).toEqual(['normal']);
    expect(shootType({ quiver: [] })).toBe(null);
  });
  it('addArrow pushes the type up to capacity', () => {
    const p = { quiver: ['normal', 'normal'] };
    addArrow(p, 'bomb', 3);
    expect(p.quiver).toEqual(['normal', 'normal', 'bomb']);
    addArrow(p, 'normal', 3);           // already at cap
    expect(p.quiver).toEqual(['normal', 'normal', 'bomb']);
  });
  it('fillWith fills to capacity with one type', () => {
    const p = { quiver: ['normal'] };
    fillWith(p, 'bomb', 6);
    expect(p.quiver).toEqual(Array(6).fill('bomb'));
  });
  it('nextType / arrowCount report the top and length', () => {
    expect(nextType({ quiver: ['normal', 'bomb'] })).toBe('bomb');
    expect(nextType({ quiver: [] })).toBe(null);
    expect(arrowCount({ quiver: ['a', 'b'] })).toBe(2);
  });
  it('addArrows pushes n of a type up to capacity', () => {
    const p = { quiver: ['normal'] };
    addArrows(p, 'laser', 3, 6);
    expect(p.quiver).toEqual(['normal', 'laser', 'laser', 'laser']);
    addArrows(p, 'bomb', 5, 5); // already 4, cap 5 → only 1 fits
    expect(p.quiver).toEqual(['normal', 'laser', 'laser', 'laser', 'bomb']);
  });
});
