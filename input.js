// q5play exposes `kb` as a global. Adjust key names here if the runtime
// check in Task 11 shows different identifiers.
export function readKeys() {
  return {
    left: kb.pressing('left') || kb.pressing('a') || kb.pressing('q'),
    right: kb.pressing('right') || kb.pressing('d'),
    up: kb.pressing('up'),
    down: kb.pressing('down') || kb.pressing('s'),
    jump: kb.pressing('space') || kb.pressing('w'),
  };
}

export function computeIntent(keys, prev) {
  const moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  return {
    moveX,
    jumpHeld: keys.jump,
    jumpPressed: keys.jump && !prev.jump && !prev.jumpHeld,
    down: keys.down,
  };
}
