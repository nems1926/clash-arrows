// Extraction one-shot des planches de présentation vers des atlas propres.
// Lancer : node tools/extract-sprites.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { PNG } from 'pngjs';

const SRC = 'spritesheet';
const OUT = 'spritesheet/atlas';
mkdirSync(OUT, { recursive: true });

const decode = (p) => PNG.sync.read(readFileSync(p));

// Masque "encre" (1 = avant-plan).
//  mode 'sat'      : pixel encre si sombre (brightness < 120) OU saturé (maxDiff > 20).
//                    Fonctionne sur planches RGBA/RGB avec fond damier neutre.
//  mode 'colorkey' : fond = les 2 couleurs les plus fréquentes (damier incrusté) ;
//                    encre = tout le reste (tolérance L1 = 24).
function inkMask(png, mode) {
  const { width, height, data } = png;
  const mask = new Uint8Array(width * height);
  if (mode === 'sat') {
    for (let i = 0; i < width * height; i++) {
      const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2];
      const brightness = (r + g + b) / 3;
      const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
      mask[i] = (brightness < 120 || maxDiff > 20) ? 1 : 0;
    }
    return mask;
  }
  const hist = new Map();
  for (let i = 0; i < width * height; i++) {
    const key = (data[i*4] << 16) | (data[i*4+1] << 8) | data[i*4+2];
    hist.set(key, (hist.get(key) || 0) + 1);
  }
  const top = [...hist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 2).map((e) => e[0]);
  const near = (r, g, b) => top.some((t) =>
    Math.abs(r - ((t>>16)&255)) + Math.abs(g - ((t>>8)&255)) + Math.abs(b - (t&255)) <= 24);
  for (let i = 0; i < width * height; i++)
    mask[i] = near(data[i*4], data[i*4+1], data[i*4+2]) ? 0 : 1;
  return mask;
}

const rowOcc = (mask, w, h) => {
  const occ = new Int32Array(h);
  for (let y = 0; y < h; y++) { let c = 0; for (let x = 0; x < w; x++) c += mask[y*w+x]; occ[y] = c; }
  return occ;
};
const colOcc = (mask, w, y0, y1) => {
  const occ = new Int32Array(w);
  for (let x = 0; x < w; x++) { let c = 0; for (let y = y0; y < y1; y++) c += mask[y*w+x]; occ[x] = c; }
  return occ;
};

// Plages contiguës [start,end) où occ > thresh, fusionnées tant que le trou < minGap.
function clusters(occ, thresh, minGap) {
  const ranges = []; let start = -1, gap = 0;
  for (let i = 0; i < occ.length; i++) {
    if (occ[i] > thresh) { if (start < 0) start = i; gap = 0; }
    else if (start >= 0) { if (++gap >= minGap) { ranges.push([start, i - gap + 1]); start = -1; gap = 0; } }
  }
  if (start >= 0) ranges.push([start, occ.length - gap]);
  return ranges;
}

// Les n bandes de frames = les n clusters de lignes les plus HAUTS (les personnages),
// ce qui écarte titres / en-têtes / étiquettes (clusters courts).
function findBands(mask, w, h, n) {
  let rows = clusters(rowOcc(mask, w, h), 2, 3);
  rows.sort((a, b) => (b[1]-b[0]) - (a[1]-a[0]));
  rows = rows.slice(0, n).sort((a, b) => a[0] - b[0]);
  return rows;
}

// bbox serré de l'encre dans [x0,x1)×[y0,y1).
function bbox(mask, w, x0, x1, y0, y1) {
  let minx = x1, maxx = x0, miny = y1, maxy = y0, found = false;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (mask[y*w+x]) {
    found = true; if (x<minx)minx=x; if (x>maxx)maxx=x; if (y<miny)miny=y; if (y>maxy)maxy=y;
  }
  return found ? { x: minx, y: miny, w: maxx-minx+1, h: maxy-miny+1 } : null;
}

// Découpe une bande en frames : un trou clairsemé (occ <= thresh) ≥ gap px sépare 2 perso ;
// on ignore les clusters trop fins (< minW px) qui sont du bruit / étiquettes isolées.
function extractBand(png, mask, band, colThresh, colGap, minW) {
  const [y0, y1] = band;
  return clusters(colOcc(mask, png.width, y0, y1), colThresh, colGap)
    .filter(([a, b]) => b - a > minW)
    .map(([cx0, cx1]) => bbox(mask, png.width, cx0, cx1, y0, y1))
    .filter(Boolean);
}

// Compose un atlas horizontal : cellule commune, frame centrée X, pieds au bas (bottom).
// Ne copie QUE les pixels encre → fond réellement transparent.
function writeAtlas(name, src, mask, frames) {
  const cellW = Math.max(...frames.map((f) => f.w));
  const cellH = Math.max(...frames.map((f) => f.h));
  const out = new PNG({ width: cellW * frames.length, height: cellH });
  out.data.fill(0);
  frames.forEach((f, idx) => {
    const dx0 = idx * cellW + ((cellW - f.w) >> 1);
    const dy0 = cellH - f.h;
    for (let y = 0; y < f.h; y++) for (let x = 0; x < f.w; x++) {
      if (!mask[(f.y+y)*src.width + (f.x+x)]) continue; // hors-encre → transparent
      const si = ((f.y+y)*src.width + (f.x+x)) * 4;
      const di = ((dy0+y)*out.width + (dx0+x)) * 4;
      out.data[di] = src.data[si]; out.data[di+1] = src.data[si+1];
      out.data[di+2] = src.data[si+2]; out.data[di+3] = 255;
    }
  });
  writeFileSync(`${OUT}/${name}.png`, PNG.sync.write(out));
  return { frameW: cellW, frameH: cellH, count: frames.length };
}

const meta = {};
const rdr = decode(`${SRC}/run_dodge_roll.png`);
// Les planches ont un fond damier neutre (gris) ; on détecte l'encre par saturation/luminosité.
// thresh=25 sur colOcc sépare les groupes de labels des groupes de sprites pour dodge/roll.
// minW=50 écarte les étiquettes texte (< 50 px) mais garde les sprites (~170-280 px).
const rdrMask = inkMask(rdr, 'sat');
const [runB, dodgeB, rollB] = findBands(rdrMask, rdr.width, rdr.height, 3);
meta.run   = writeAtlas('run',   rdr, rdrMask, extractBand(rdr, rdrMask, runB,   0,  4, 50));
meta.dodge = writeAtlas('dodge', rdr, rdrMask, extractBand(rdr, rdrMask, dodgeB, 25, 4, 50));
meta.roll  = writeAtlas('roll',  rdr, rdrMask, extractBand(rdr, rdrMask, rollB,  25, 4, 50));

const jmp = decode(`${SRC}/jump.png`);
// jump.png est RGB avec fond damier neutre ; détection par saturation/luminosité,
// minW=20 pour écarter le bruit (< 20 px) tout en gardant les 8 sprites (~165-260 px).
const jmpMask = inkMask(jmp, 'sat');
const [jumpB] = findBands(jmpMask, jmp.width, jmp.height, 1);
meta.jump = writeAtlas('jump', jmp, jmpMask, extractBand(jmp, jmpMask, jumpB, 0, 4, 20));

const EXPECT = { run: 8, dodge: 8, roll: 10, jump: 8 };
let ok = true;
for (const k of Object.keys(EXPECT)) {
  const got = meta[k].count;
  if (got !== EXPECT[k]) ok = false;
  console.log(`${k}: ${got} frames (attendu ${EXPECT[k]}) — cellule ${meta[k].frameW}x${meta[k].frameH}`);
}
writeFileSync(`${OUT}/frames.js`, 'export default ' + JSON.stringify(meta, null, 2) + ';\n');
console.log(ok ? '✅ comptes OK' : '⚠️ comptes inattendus — ajuster les seuils (gap/largeur min)');
