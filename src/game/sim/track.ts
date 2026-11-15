// Builds the drivable track from a TrackDef: an arc-length sampled closed
// spline, nearest-point queries, the shared height function used by both the
// terrain mesh and the cars, and seeded scenery with colliders.
import { clamp, lerp, noise2, rng, smoothstep } from "./math";
import type { Environment, TrackDef } from "./tracks";

export const SAMPLE_SPACING = 2; // meters between centerline samples
export const VERGE = 4; // sloped gravel verge beside the road (m)
export const VERGE_DROP = 0.35; // verge drops this far below the road (m)
export const BOUNDARY = 24; // max distance off the road edge before an invisible wall (m)

export interface Sample {
  x: number;
  y: number;
  z: number;
  /** Unit tangent (forward). */
  tx: number;
  tz: number;
  /** Unit right vector: (-tz, tx). */
  rx: number;
  rz: number;
  s: number;
  /** Absolute curvature (1/m), smoothed. */
  curv: number;
}

export type SceneryKind = "pine" | "pineRound" | "oak" | "cactus" | "rock" | "rockTall";

export interface SceneryItem {
  kind: SceneryKind;
  x: number;
  y: number;
  z: number;
  scale: number;
  rot: number;
  radius: number;
}

export interface Nearest {
  i: number;
  /** Signed lateral offset; positive = right of centerline. */
  lat: number;
  /** Distance along the track (0..length). */
  s: number;
  /** Interpolated centerline height. */
  y: number;
}

export interface Track {
  def: TrackDef;
  samples: Sample[];
  length: number;
  halfWidth: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  scenery: SceneryItem[];
  /** Spatial hash for scenery colliders. */
  grid: Map<string, number[]>;
  nearest(x: number, z: number, hint?: number): Nearest;
  heightAt(x: number, z: number, hint?: number): number;
  sampleAt(s: number): Sample;
}

type P = { x: number; y: number; z: number };

// Centripetal Catmull-Rom (alpha 0.5) avoids loops and cusps on uneven spacing.
function catmull(p0: P, p1: P, p2: P, p3: P, t: number): P {
  const tj = (ti: number, a: P, b: P) =>
    ti + Math.pow(Math.hypot(b.x - a.x, b.z - a.z) || 1e-4, 0.5);
  const t0 = 0;
  const t1 = tj(t0, p0, p1);
  const t2 = tj(t1, p1, p2);
  const t3 = tj(t2, p2, p3);
  const u = lerp(t1, t2, t);
  const mix = (a: P, b: P, ta: number, tb: number): P => {
    const w = (u - ta) / (tb - ta);
    return { x: lerp(a.x, b.x, w), y: lerp(a.y, b.y, w), z: lerp(a.z, b.z, w) };
  };
  const a1 = mix(p0, p1, t0, t1);
  const a2 = mix(p1, p2, t1, t2);
  const a3 = mix(p2, p3, t2, t3);
  const b1 = mix(a1, a2, t0, t2);
  const b2 = mix(a2, a3, t1, t3);
  return mix(b1, b2, t1, t2);
}

export function buildCenterline(def: TrackDef): Sample[] {
  const pts: P[] = def.points.map(([x, z, y]) => ({ x: x * def.scale, y, z: z * def.scale }));
  const n = pts.length;
  // Dense polyline first.
  const dense: P[] = [];
  const SUB = 60;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    for (let k = 0; k < SUB; k++) dense.push(catmull(p0, p1, p2, p3, k / SUB));
  }
  // Cumulative length.
  const cum = [0];
  for (let i = 1; i <= dense.length; i++) {
    const a = dense[i - 1];
    const b = dense[i % dense.length];
    cum.push(cum[i - 1] + Math.hypot(b.x - a.x, b.z - a.z));
  }
  const total = cum[cum.length - 1];
  const count = Math.round(total / SAMPLE_SPACING);
  const step = total / count;
  const out: Sample[] = [];
  let j = 0;
  for (let k = 0; k < count; k++) {
    const s = k * step;
    while (cum[j + 1] < s) j++;
    const a = dense[j];
    const b = dense[(j + 1) % dense.length];
    const w = (s - cum[j]) / (cum[j + 1] - cum[j] || 1);
    out.push({
      x: lerp(a.x, b.x, w),
      y: lerp(a.y, b.y, w),
      z: lerp(a.z, b.z, w),
      tx: 0, tz: 1, rx: -1, rz: 0, s, curv: 0,
    });
  }
  const m = out.length;
  for (let k = 0; k < m; k++) {
    const a = out[(k - 1 + m) % m];
    const b = out[(k + 1) % m];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const l = Math.hypot(dx, dz) || 1;
    out[k].tx = dx / l;
    out[k].tz = dz / l;
    out[k].rx = -out[k].tz;
    out[k].rz = out[k].tx;
  }
  // Curvature over a 5-sample window, then smoothed.
  const raw = new Array(m).fill(0);
  const W = 4;
  for (let k = 0; k < m; k++) {
    const a = out[k];
    const b = out[(k + W) % m];
    const cross = a.tx * b.tz - a.tz * b.tx;
    const dot = a.tx * b.tx + a.tz * b.tz;
    raw[k] = Math.abs(Math.atan2(cross, dot)) / (W * step);
  }
  for (let k = 0; k < m; k++) {
    let sum = 0;
    for (let o = -3; o <= 3; o++) sum += raw[(k + o + m) % m];
    out[k].curv = sum / 7;
  }
  // Smooth height so slopes stay drivable.
  const ys = out.map((p) => p.y);
  for (let k = 0; k < m; k++) {
    let sum = 0;
    for (let o = -10; o <= 10; o++) sum += ys[(k + o + m) % m];
    out[k].y = sum / 21;
  }
  return out;
}

/** Terrain far from the road, by environment. `d` = distance from road edge. */
function backdrop(env: Environment, x: number, z: number, base: number, d: number) {
  const n = noise2(x, z);
  if (env === "canyon") {
    // Canyon walls rise away from the road.
    const rise = smoothstep(10, 60, d) * 22 + smoothstep(60, 160, d) * 25;
    return base + rise + n * 5 * smoothstep(5, 40, d);
  }
  if (env === "snow") {
    const rise = smoothstep(20, 90, d) * 10 + smoothstep(120, 260, d) * 45;
    return base + rise + n * 4 * smoothstep(5, 40, d);
  }
  return base + n * 3.5 * smoothstep(5, 50, d) + smoothstep(140, 260, d) * 12;
}

function cellKey(x: number, z: number) {
  return `${Math.floor(x / 20)},${Math.floor(z / 20)}`;
}

const KIND_RADIUS: Record<SceneryKind, number> = {
  pine: 0.09,
  pineRound: 0.12,
  oak: 0.1,
  cactus: 0.12,
  rock: 0.38,
  rockTall: 0.42,
};

const ENV_KINDS: Record<Environment, [SceneryKind, number, number, number][]> = {
  // kind, weight, minScale, maxScale
  forest: [["pine", 5, 7, 11], ["pineRound", 3, 6, 9], ["oak", 1, 5, 7], ["rock", 1, 3, 6]],
  canyon: [["cactus", 4, 4, 7], ["rock", 3, 4, 9], ["rockTall", 3, 5, 10]],
  snow: [["pine", 6, 7, 12], ["pineRound", 2, 6, 9], ["rock", 1, 3, 6]],
};

export function buildTrack(def: TrackDef): Track {
  const samples = buildCenterline(def);
  const m = samples.length;
  const length = m * (samples[1].s - samples[0].s);
  const halfWidth = def.width / 2;

  const project = (x: number, z: number, i: number) => {
    const a = samples[i];
    const lat = (x - a.x) * a.rx + (z - a.z) * a.rz;
    const along = (x - a.x) * a.tx + (z - a.z) * a.tz;
    return { lat, along };
  };

  const fullNearest = (x: number, z: number) => {
    let best = 0;
    let bd = Infinity;
    for (let i = 0; i < m; i += 3) {
      const d = (samples[i].x - x) ** 2 + (samples[i].z - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    for (let o = -3; o <= 3; o++) {
      const i = (best + o + m) % m;
      const d = (samples[i].x - x) ** 2 + (samples[i].z - z) ** 2;
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  };

  const nearest = (x: number, z: number, hint = -1): Nearest => {
    let best: number;
    if (hint < 0) best = fullNearest(x, z);
    else {
      best = hint;
      let bd = Infinity;
      for (let o = -25; o <= 25; o++) {
        const i = (hint + o + m) % m;
        const d = (samples[i].x - x) ** 2 + (samples[i].z - z) ** 2;
        if (d < bd) { bd = d; best = i; }
      }
    }
    const { lat, along } = project(x, z, best);
    const a = samples[best];
    const b = samples[(best + (along >= 0 ? 1 : -1) + m) % m];
    const w = clamp(Math.abs(along) / SAMPLE_SPACING, 0, 1);
    let s = a.s + along;
    if (s < 0) s += length;
    if (s >= length) s -= length;
    return { i: best, lat, s, y: lerp(a.y, b.y, w) };
  };

  const heightFrom = (x: number, z: number, n: Nearest) => {
    const d = Math.abs(n.lat);
    if (d <= halfWidth) return n.y;
    const dv = d - halfWidth;
    if (dv <= VERGE) return n.y - VERGE_DROP * smoothstep(0, VERGE, dv);
    return backdrop(def.environment, x, z, n.y - VERGE_DROP, dv - VERGE);
  };

  const heightAt = (x: number, z: number, hint = -1) => heightFrom(x, z, nearest(x, z, hint));

  const sampleAt = (s: number) => {
    const i = Math.floor((((s % length) + length) % length) / (length / m)) % m;
    return samples[i];
  };

  // Bounds.
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const p of samples) {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
  }

  // Scenery.
  const r = rng(def.seed);
  const kinds = ENV_KINDS[def.environment];
  const totalW = kinds.reduce((a, k) => a + k[1], 0);
  const pick = () => {
    let v = r() * totalW;
    for (const k of kinds) { v -= k[1]; if (v <= 0) return k; }
    return kinds[0];
  };
  const scenery: SceneryItem[] = [];
  const grid = new Map<string, number[]>();
  const step = def.environment === "canyon" ? 7 : 4;
  for (let i = 0; i < m; i += step) {
    const a = samples[i];
    for (const side of [-1, 1]) {
      if (r() < 0.25) continue;
      const off = halfWidth + VERGE + 3 + Math.pow(r(), 1.6) * 70;
      const x = a.x + a.rx * off * side + (r() - 0.5) * 6;
      const z = a.z + a.rz * off * side + (r() - 0.5) * 6;
      const n = nearest(x, z, -1);
      if (Math.abs(n.lat) < halfWidth + VERGE + 2.5) continue;
      // Keep the start straight clear for the grid and the arch.
      const ds = Math.min(n.s, length - n.s);
      if (ds < 40 && Math.abs(n.lat) < halfWidth + 14) continue;
      const [kind, , mn, mx] = pick();
      const scale = lerp(mn, mx, r());
      const item: SceneryItem = {
        kind, x, z, scale, rot: r() * Math.PI * 2,
        y: heightFrom(x, z, n) - 0.1,
        radius: KIND_RADIUS[kind] * scale,
      };
      const key = cellKey(x, z);
      const list = grid.get(key) ?? [];
      list.push(scenery.length);
      grid.set(key, list);
      scenery.push(item);
    }
  }

  return { def, samples, length, halfWidth, bounds: { minX, maxX, minZ, maxZ }, scenery, grid, nearest, heightAt, sampleAt };
}

/** Scenery indices in the 3x3 cells around a point. */
export function sceneryNear(track: Track, x: number, z: number, out: number[]) {
  out.length = 0;
  const cx = Math.floor(x / 20);
  const cz = Math.floor(z / 20);
  for (let dx = -1; dx <= 1; dx++)
    for (let dz = -1; dz <= 1; dz++) {
      const l = track.grid.get(`${cx + dx},${cz + dz}`);
      if (l) for (const i of l) out.push(i);
    }
  return out;
}
