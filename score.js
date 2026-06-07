export const aliveCount = (players) =>
  players.filter((p) => p.state !== 'DEAD').length;

export const roundOver = (players) => aliveCount(players) <= 1;

export function lastAlive(players) {
  const survivors = players.filter((p) => p.state !== 'DEAD');
  return survivors.length === 1 ? survivors[0].index : null;
}

export function matchWinner(players, roundsToWin) {
  const w = players.find((p) => p.roundsWon >= roundsToWin);
  return w ? w.index : null;
}
