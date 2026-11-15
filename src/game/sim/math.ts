// Pure math helpers shared by the simulation. No React, no three.js.
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const smoothstep = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};
export const wrapAngle = (a: number) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
/** Frame-rate independent damping factor for exponential smoothing. */
export const damp = (k: number, dt: number) => 1 - Math.exp(-k * dt);

/** Deterministic PRNG (mulberry32). */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Cheap smooth 2D noise from summed sines, range roughly -1..1. */
export function noise2(x: number, z: number) {
  return (
    Math.sin(x * 0.021 + z * 0.013) * 0.5 +
    Math.sin(x * 0.047 - z * 0.039 + 1.7) * 0.3 +
    Math.sin(x * 0.11 + z * 0.093 + 4.1) * 0.2
  );
}
