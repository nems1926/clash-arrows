export const canShoot = (p) => p.quiver > 0;
export function spendArrow(p) { if (p.quiver > 0) p.quiver--; }
export function addArrow(p) { p.quiver++; }
