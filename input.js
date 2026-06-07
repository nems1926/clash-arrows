// q5play exposes `kb` as a global. Adjust key names here if the runtime
// check in Task 11 shows different identifiers.

export function readKeys() {
  return {
    left: kb.pressing('left') || kb.pressing('a') || kb.pressing('q'),
    right: kb.pressing('right') || kb.pressing('d'),
    up: kb.pressing('up'),
    down: kb.pressing('down') || kb.pressing('s'),
    jump: kb.pressing('space') || kb.pressing('w'),
    shoot: kb.pressing('e'),
    dodge: kb.pressing('shift'),
  };
}

// --- Gamepad input (q5play exposes connected controllers as the global `contros`).
// Accessors below follow the documented p5play controller API; a human confirms
// the exact button/stick names in the browser (see Phase C manual validation).
export function getGamepad(index) {
  return (typeof contros !== 'undefined' && contros[index]) ? contros[index] : null;
}

export function connectedGamepadIndices() {
  if (typeof contros === 'undefined') return [];
  const out = [];
  for (let i = 0; i < contros.length; i++) if (contros[i]) out.push(i);
  return out;
}

// Raw read for one controller, normalized to the same shape as readKeys().
export function readGamepad(pad) {
  const NONE = { left: false, right: false, up: false, down: false, jump: false, shoot: false, dodge: false };
  if (!pad) return NONE;
  const DZ = 0.4;
  const ax = pad.leftStick ? pad.leftStick.x : 0;
  const ay = pad.leftStick ? pad.leftStick.y : 0;
  return {
    left: ax < -DZ || pad.pressing('left'),
    right: ax > DZ || pad.pressing('right'),
    up: ay < -DZ || pad.pressing('up'),
    down: ay > DZ || pad.pressing('down'),
    jump: pad.pressing('a'),
    shoot: pad.pressing('x'),
    dodge: pad.pressing('r') || pad.pressing('rt'),
  };
}

export function computeIntent(keys, prev) {
  const moveX = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  return {
    moveX,
    up: !!keys.up,
    down: !!keys.down,
    jumpHeld: !!keys.jump,
    jumpPressed: keys.jump && !prev.jump,
    shootPressed: keys.shoot && !prev.shoot,
    dodgePressed: keys.dodge && !prev.dodge,
  };
}
