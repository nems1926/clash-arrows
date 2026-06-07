import { roundOver, lastAlive, matchWinner } from './score.js';

export function createGame() {
  return { state: 'LOBBY', winner: null, roundEndTimer: 0 };
}

// One call per fixed step. Mutates: awards a won round; transitions state.
// States: LOBBY → PLAYING → (ROUND_END → RESPAWN → PLAYING)* → MATCH_END.
export function advance(game, players, cfg) {
  if (game.state === 'PLAYING') {
    if (roundOver(players)) {
      const w = lastAlive(players);
      if (w !== null) {
        const winner = players.find((p) => p.index === w);
        if (winner) winner.roundsWon++;
      }
      const mw = matchWinner(players, cfg.roundsToWin);
      if (mw !== null) { game.state = 'MATCH_END'; game.winner = mw; }
      else { game.state = 'ROUND_END'; game.roundEndTimer = 45; }
    }
  } else if (game.state === 'ROUND_END') {
    game.roundEndTimer--;
    if (game.roundEndTimer <= 0) game.state = 'RESPAWN';
  }
  return game.state;
}
