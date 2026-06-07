import { describe, it, expect } from 'vitest';
import { aliveCount, lastAlive, roundOver, matchWinner } from '../score.js';

const alive = (i) => ({ index: i, state: 'AIRBORNE' });
const dead = (i) => ({ index: i, state: 'DEAD' });

describe('score logic', () => {
  it('counts living players', () => {
    expect(aliveCount([alive(0), dead(1), alive(2)])).toBe(2);
  });
  it('round is over when <= 1 alive', () => {
    expect(roundOver([alive(0), dead(1)])).toBe(true);
    expect(roundOver([alive(0), alive(1)])).toBe(false);
  });
  it('lastAlive returns the survivor index, or null on a draw', () => {
    expect(lastAlive([dead(0), alive(1)])).toBe(1);
    expect(lastAlive([dead(0), dead(1)])).toBe(null);
  });
  it('matchWinner returns the index reaching roundsToWin', () => {
    expect(matchWinner([{ index: 0, roundsWon: 5 }, { index: 1, roundsWon: 2 }], 5)).toBe(0);
    expect(matchWinner([{ index: 0, roundsWon: 4 }], 5)).toBe(null);
  });
});
