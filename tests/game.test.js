import { describe, it, expect } from 'vitest';
import { createGame, advance } from '../game.js';

describe('game state machine', () => {
  it('starts in LOBBY', () => {
    expect(createGame().state).toBe('LOBBY');
  });
  it('advances PLAYING -> ROUND_END and awards the survivor', () => {
    const game = createGame(); game.state = 'PLAYING';
    const players = [{ index: 0, state: 'AIRBORNE', roundsWon: 0 }, { index: 1, state: 'DEAD', roundsWon: 0 }];
    advance(game, players, { roundsToWin: 5 });
    expect(players[0].roundsWon).toBe(1);
    expect(game.state).toBe('ROUND_END');
  });
  it('goes to MATCH_END when a player reaches roundsToWin', () => {
    const game = createGame(); game.state = 'PLAYING';
    const players = [{ index: 0, state: 'AIRBORNE', roundsWon: 4 }, { index: 1, state: 'DEAD', roundsWon: 0 }];
    advance(game, players, { roundsToWin: 5 });
    expect(game.state).toBe('MATCH_END');
    expect(game.winner).toBe(0);
  });
  it('ROUND_END ticks down to RESPAWN', () => {
    const game = createGame(); game.state = 'ROUND_END'; game.roundEndTimer = 1;
    advance(game, [], { roundsToWin: 5 });
    expect(game.state).toBe('RESPAWN');
  });
});
