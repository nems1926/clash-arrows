// Logique d'animation — module pur (aucune dépendance q5/DOM, testable).
// Mappe l'état joueur (FSM + vitesse) vers (clip, frame, flip).
// Portée actuelle : course horizontale uniquement (run32.webp, 8 frames).
// Les états aériens / dodge retombent sur la frame de repos en attendant
// leurs propres clips.

// Comportement par clip. count = nb de frames (doit matcher le spritesheet).
// run : horloge libre à `fps`, en boucle.
export const CLIPS = {
  run: { count: 8, fps: 12, loop: true },
};

export const MOVE_EPS = 5;   // |vx| (px/s) seuil idle <-> run
export const IDLE_FRAME = 0; // frame de repos (puise dans l'atlas run)

export function selectClip(p) {
  if (p.state === 'GROUNDED') return Math.abs(p.vx) > MOVE_EPS ? 'run' : 'idle';
  return 'idle'; // AIRBORNE / WALLSLIDE / DODGING : pas encore de clip dédié
}

export function frameIndexFor(clip, clock) {
  if (clip === 'run') return Math.floor(clock * CLIPS.run.fps) % CLIPS.run.count;
  return IDLE_FRAME; // idle (et tout clip inconnu)
}

// Descripteur prêt à blitter. `atlas` = quelle image source (idle puise dans run).
export function spriteFor(p, clock) {
  const clip = selectClip(p);
  return {
    clip,
    atlas: 'run',
    frameIndex: frameIndexFor(clip, clock),
    flipX: p.facing < 0,
  };
}
