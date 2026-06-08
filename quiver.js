// The quiver is a stack (array) of arrow type strings; the top is the last
// element (the next arrow that will be fired).
export const canShoot = (p) => p.quiver.length > 0;
export const arrowCount = (p) => p.quiver.length;
export const nextType = (p) => (p.quiver.length ? p.quiver[p.quiver.length - 1] : null);

export function shootType(p) {
  return p.quiver.length ? p.quiver.pop() : null;
}

export function addArrow(p, type, cap) {
  if (p.quiver.length < cap) p.quiver.push(type);
}

export function addArrows(p, type, n, cap) {
  for (let i = 0; i < n && p.quiver.length < cap; i++) p.quiver.push(type);
}

export function fillWith(p, type, cap) {
  p.quiver = Array(cap).fill(type);
}
