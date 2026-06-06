import { SOLID, ONEWAY, EMPTY } from './tilemap.js';

// 32 columns × 18 rows. Row 0 = top.
export const ARENA_A = [
  '................................', // 0
  '................................', // 1
  '................................', // 2
  '................................', // 3
  '............========............', // 4  one-way (top center)
  '................................', // 5
  '................................', // 6
  '................................', // 7
  '............########............', // 8  solid floating platform
  '................................', // 9
  '................................', // 10
  '......========....========......', // 11 one-way (left + right)
  '................................', // 12
  '...#........................#...', // 13 walls
  '...#........................#...', // 14 walls
  '...#..S..................S..#...', // 15 walls + spawns
  '############........############', // 16 ground (central hole)
  '############........############', // 17 ground
];

export function parseArena(ascii) {
  const grid = [];
  const spawns = [];
  for (let r = 0; r < ascii.length; r++) {
    const row = [];
    for (let c = 0; c < ascii[r].length; c++) {
      const ch = ascii[r][c];
      if (ch === '#') row.push(SOLID);
      else if (ch === '=') row.push(ONEWAY);
      else {
        row.push(EMPTY);
        if (ch === 'S') spawns.push({ col: c, row: r });
      }
    }
    grid.push(row);
  }
  return { grid, spawns };
}
