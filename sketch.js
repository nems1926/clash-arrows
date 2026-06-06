import { W, H, SCALE } from './config.js';

if (!navigator.gpu) {
  document.body.innerHTML =
    '<p style="color:#fff;font-family:sans-serif;padding:1rem">' +
    'WebGPU requis — ce navigateur est incompatible.</p>';
} else {
  await Canvas(W * SCALE, H * SCALE);
  world.gravity.y = 0;     // on gère la gravité nous-mêmes (cinématique custom)
  pixelDensity(1);
  noSmooth();              // pixel-perfect, pas de flou

  q5.update = function () {
    background('#0d1b2a');
  };
}
