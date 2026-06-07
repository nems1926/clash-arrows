const MAX_PLAYERS = 4;

// joins: { gamepads: number[] (joined gamepad indices), keyboard: boolean }
// Rule: keyboard takes a slot only if a slot is free AND < 4 gamepads.
export function resolveSlots(joins) {
  const slots = joins.gamepads.slice(0, MAX_PLAYERS)
    .map((index) => ({ type: 'gamepad', index }));
  if (joins.keyboard && slots.length < MAX_PLAYERS && joins.gamepads.length < MAX_PLAYERS) {
    slots.push({ type: 'keyboard', index: 0 });
  }
  return slots.slice(0, MAX_PLAYERS);
}

// At least 2 players are required to start a match.
export const canStart = (slots) => slots.length >= 2;
