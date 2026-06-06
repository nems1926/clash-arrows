import { W, H, SCALE, DEFAULT_CONFIG } from './config.js';

const PARAMS = [
  ['vMax', 0, 300], ['accel', 0, 2000], ['decel', 0, 2000],
  ['vJump', -400, 0], ['gravity', 0, 2000], ['vFallMax', 0, 600],
  ['vSlide', 0, 300], ['wallJumpX', 0, 400], ['wallJumpY', -400, 0],
  ['coyoteFrames', 0, 20], ['bufferFrames', 0, 20],
  ['apexGravityMult', 0, 1], ['apexVyThreshold', 0, 200], ['jumpCutMult', 0, 1],
];

export function createDebug(cfg) {
  const panel = document.createElement('div');
  panel.style.cssText =
    'position:fixed;top:0;right:0;background:rgba(0,0,0,.82);color:#cbd5e1;' +
    'font:11px monospace;padding:8px;z-index:10;max-height:100vh;overflow:auto';

  const valSpans = {};
  for (const [key, min, max] of PARAMS) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:6px;align-items:center;margin:2px 0';
    const label = document.createElement('span');
    label.textContent = key;
    label.style.width = '110px';
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = min; slider.max = max; slider.step = (max - min) / 200;
    slider.value = cfg[key];
    const val = document.createElement('span');
    val.textContent = cfg[key];
    val.style.width = '40px';
    slider.oninput = () => { cfg[key] = parseFloat(slider.value); val.textContent = cfg[key]; };
    valSpans[key] = { slider, val };
    row.append(label, slider, val);
    panel.append(row);
  }

  const reset = document.createElement('button');
  reset.textContent = 'R: reset';
  reset.onclick = () => {
    for (const [key] of PARAMS) {
      cfg[key] = DEFAULT_CONFIG[key];
      valSpans[key].slider.value = cfg[key];
      valSpans[key].val.textContent = cfg[key];
    }
  };
  const copy = document.createElement('button');
  copy.textContent = 'C: copier';
  copy.onclick = () => {
    const out = {};
    for (const [key] of PARAMS) out[key] = cfg[key];
    const text = JSON.stringify(out, null, 2);
    navigator.clipboard?.writeText(text);
    console.log('[config calibré]\n' + text);
  };
  panel.append(reset, copy);
  document.body.append(panel);

  const dbg = { visible: true, panel };
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      dbg.visible = !dbg.visible;
      panel.style.display = dbg.visible ? 'block' : 'none';
    } else if (e.key === 'r' || e.key === 'R') {
      reset.onclick();
    } else if (e.key === 'c' || e.key === 'C') {
      copy.onclick();
    }
  });
  return dbg;
}

export function drawDebug(dbg, player) {
  if (!dbg.visible) return;
  push();
  translate(-W * SCALE / 2, -H * SCALE / 2);
  fill('#4ade80');
  textFont('monospace');
  textSize(14);
  textAlign(LEFT, TOP);
  const lines = [
    `état: ${player.state}`,
    `v: (${player.vx.toFixed(0)}, ${player.vy.toFixed(0)})`,
    `sol:${player.grounded ? '✔' : '✘'} mur:${player.wallDir}`,
    `coyote:${Math.max(0, player.coyote)} buf:${Math.max(0, player.buffer)}`,
  ];
  lines.forEach((l, i) => text(l, 6, 6 + i * 16));
  pop();
}
