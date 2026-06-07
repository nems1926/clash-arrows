import { describe, it, expect } from 'vitest';
import { resolveSlots } from '../lobby.js';

describe('resolveSlots', () => {
  it('assigns one slot per joined gamepad', () => {
    const s = resolveSlots({ gamepads: [0, 1], keyboard: false });
    expect(s).toEqual([{ type: 'gamepad', index: 0 }, { type: 'gamepad', index: 1 }]);
  });
  it('adds keyboard only when < 4 gamepads and keyboard joined', () => {
    const s = resolveSlots({ gamepads: [0, 1], keyboard: true });
    expect(s).toContainEqual({ type: 'keyboard', index: 0 });
    expect(s.length).toBe(3);
  });
  it('drops keyboard when 4 gamepads are present', () => {
    const s = resolveSlots({ gamepads: [0, 1, 2, 3], keyboard: true });
    expect(s.length).toBe(4);
    expect(s.every((x) => x.type === 'gamepad')).toBe(true);
  });
  it('caps at 4 players', () => {
    const s = resolveSlots({ gamepads: [0, 1, 2, 3, 4], keyboard: true });
    expect(s.length).toBe(4);
  });
});
