import { describe, it, expect } from 'vitest';
import { computeIntent } from '../input.js';

const none = { left: false, right: false, up: false, down: false, jump: false };

describe('computeIntent', () => {
  it('maps left/right to moveX', () => {
    expect(computeIntent({ ...none, right: true }, none).moveX).toBe(1);
    expect(computeIntent({ ...none, left: true }, none).moveX).toBe(-1);
    expect(computeIntent({ ...none, left: true, right: true }, none).moveX).toBe(0);
  });
  it('detects jump press edge', () => {
    const prev = { ...none, jump: false };
    const now = computeIntent({ ...none, jump: true }, prev);
    expect(now.jumpPressed).toBe(true);
    expect(now.jumpHeld).toBe(true);
  });
  it('does not re-fire jumpPressed while held', () => {
    const prev = { jump: true };
    const now = computeIntent({ ...none, jump: true }, prev);
    expect(now.jumpPressed).toBe(false);
    expect(now.jumpHeld).toBe(true);
  });
  it('passes down through', () => {
    expect(computeIntent({ ...none, down: true }, none).down).toBe(true);
  });
});
