// Draws the road ribbon, verges, terrain and start arch from the sim's Track.
import { useMemo } from "react";
import * as THREE from "three";
import { VERGE, VERGE_DROP, type Track } from "../sim/track";
import { ENV_STYLE } from "./envStyle";
import { bannerTexture, checkerTexture, detailTexture, roadTexture } from "./textures";

function ribbon(track: Track, inner: number, outer: number, yInner: number, yOuter: number, vScale: number) {
  const { samples } = track;
  const m = samples.length;
  const pos: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let k = 0; k <= m; k++) {
    const s = samples[k % m];
    const v = (k === m ? track.length : s.s) / vScale;
    pos.push(s.x + s.rx * inner, s.y + yInner, s.z + s.rz * inner);
    pos.push(s.x + s.rx * outer, s.y + yOuter, s.z + s.rz * outer);
    uv.push(0, v, 1, v);
    if (k < m) {
      const a = k * 2;
      idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Make sure faces point up regardless of winding.
  const n = g.getAttribute("normal");
  if (n.getY(0) < 0) {
    g.setIndex(idx.map((_, i, arr) => arr[i - (i % 3) + [0, 2, 1][i % 3]]));
    g.computeVertexNormals();
  }
  return g;
}

function terrain(track: Track, quality: "high" | "low") {
  const style = ENV_STYLE[track.def.environment];
  const M = 260;
  const { minX, maxX, minZ, maxZ } = track.bounds;
  const x0 = minX - M, x1 = maxX + M, z0 = minZ - M, z1 = maxZ + M;
  const cell = quality === "high" ? 6 : 9;
  const nx = Math.ceil((x1 - x0) / cell);
  const nz = Math.ceil((z1 - z0) / cell);
  const pos = new Float32Array((nx + 1) * (nz + 1) * 3);
  const col = new Float32Array((nx + 1) * (nz + 1) * 3);
  const uv = new Float32Array((nx + 1) * (nz + 1) * 2);
  const heights = new Float32Array((nx + 1) * (nz + 1));
  const near = new Float32Array((nx + 1) * (nz + 1));
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const x = x0 + i * cell;
      const z = z0 + j * cell;
      const n = track.nearest(x, z, -1);
      const h = track.heightAt(x, z, n.i);
      const k = j * (nx + 1) + i;
      heights[k] = h;
      near[k] = Math.abs(n.lat) - track.halfWidth;
      pos[k * 3] = x;
      pos[k * 3 + 1] = h;
      pos[k * 3 + 2] = z;
      uv[k * 2] = x / 14;
      uv[k * 2 + 1] = z / 14;
    }
  const low = new THREE.Color(style.terrainLow);
  const high = new THREE.Color(style.terrainHigh);
  const steep = new THREE.Color(style.terrainSteep);
  const verge = new THREE.Color(style.verge);
  const c = new THREE.Color();
  const baseY = track.samples.reduce((a, s) => a + s.y, 0) / track.samples.length;
  let minY = Infinity;
  for (let k = 0; k < heights.length; k++) minY = Math.min(minY, heights[k]);
  for (let j = 0; j <= nz; j++)
    for (let i = 0; i <= nx; i++) {
      const k = j * (nx + 1) + i;
      const hx = heights[Math.min(k + 1, heights.length - 1)] - heights[Math.max(k - 1, 0)];
      const hz = heights[Math.min(k + nx + 1, heights.length - 1)] - heights[Math.max(k - nx - 1, 0)];
      const slope = Math.min(1, Math.hypot(hx, hz) / (cell * 2) / 0.9);
      const hT = Math.min(1, Math.max(0, (heights[k] - baseY) / 30));
      c.copy(low).lerp(high, hT);
      // Canyon: horizontal strata on the walls.
      if (track.def.environment === "canyon") {
        const band = 0.5 + 0.5 * Math.sin(heights[k] * 0.9);
        c.lerp(steep, slope * 0.8 * (0.6 + band * 0.4));
      } else c.lerp(steep, Math.max(0, slope - 0.35) * 1.3);
      const dv = near[k];
      if (dv < VERGE + 6) c.lerp(verge, 1 - Math.max(0, dv) / (VERGE + 6));
      col[k * 3] = c.r;
      col[k * 3 + 1] = c.g;
      col[k * 3 + 2] = c.b;
    }
  const idx: number[] = [];
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const a = j * (nx + 1) + i;
      const b = a + 1;
      const d = a + nx + 1;
      const e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.BufferAttribute(col, 3));
  g.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  // The far ground sits below the lowest terrain point so it never covers the road.
  return { geometry: g, extent: { x0, x1, z0, z1 }, edgeY: minY - 1 };
}

export function TrackMesh({ track, quality }: { track: Track; quality: "high" | "low" }) {
  const style = ENV_STYLE[track.def.environment];
  const hw = track.halfWidth;
  const data = useMemo(() => {
    const road = ribbon(track, -hw, hw, 0.03, 0.03, 9);
    const vergeL = ribbon(track, -hw - VERGE, -hw, -VERGE_DROP + 0.02, 0.02, 9);
    const vergeR = ribbon(track, hw, hw + VERGE, 0.02, -VERGE_DROP + 0.02, 9);
    const roadTex = roadTexture(...style.road, track.def.seed);
    roadTex.repeat.set(1, 1);
    const vergeTex = roadTexture(style.verge, style.road[1], style.road[2], track.def.seed + 3);
    const detail = detailTexture(track.def.seed);
    const t = terrain(track, quality);
    return { road, vergeL, vergeR, roadTex, vergeTex, detail, terrain: t };
  }, [track, hw, style, quality]);

  const start = track.samples[0];
  const yaw = Math.atan2(start.tx, start.tz);
  const arch = useMemo(() => ({ banner: bannerTexture("VUKA  ·  START"), checker: checkerTexture() }), []);
  const span = track.def.width + 3;
  const { x0, x1, z0, z1 } = data.terrain.extent;

  return (
    <group>
      <mesh geometry={data.road} receiveShadow>
        <meshStandardMaterial map={data.roadTex} roughness={style.roadRoughness} metalness={0} envMapIntensity={style.roadRoughness < 0.8 ? 1.15 : 1} />
      </mesh>
      <mesh geometry={data.vergeL} receiveShadow>
        <meshStandardMaterial map={data.vergeTex} roughness={1} color="#cfcfcf" />
      </mesh>
      <mesh geometry={data.vergeR} receiveShadow>
        <meshStandardMaterial map={data.vergeTex} roughness={1} color="#cfcfcf" />
      </mesh>
      <mesh geometry={data.terrain.geometry} receiveShadow>
        <meshStandardMaterial vertexColors map={data.detail} roughness={1} metalness={0} />
      </mesh>
      {/* Far ground beyond the terrain grid, hidden by fog. */}
      <mesh rotation-x={-Math.PI / 2} position={[(x0 + x1) / 2, data.terrain.edgeY, (z0 + z1) / 2]}>
        <planeGeometry args={[(x1 - x0) * 4, (z1 - z0) * 4]} />
        <meshStandardMaterial color={style.terrainHigh} roughness={1} />
      </mesh>
      {/* Start / finish line and arch */}
      <group position={[start.x, start.y, start.z]} rotation-y={yaw}>
        <mesh position={[0, 0.06, 0]} rotation-x={-Math.PI / 2} receiveShadow>
          <planeGeometry args={[track.def.width, 1.6]} />
          <meshStandardMaterial map={arch.checker} roughness={0.9} />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={side} position={[side * (span / 2), 3, 0]} castShadow>
            <boxGeometry args={[0.6, 6, 0.6]} />
            <meshStandardMaterial color="#1c1c1c" roughness={0.6} />
          </mesh>
        ))}
        <mesh position={[0, 6.2, 0]} castShadow>
          <boxGeometry args={[span + 0.6, 1.4, 0.4]} />
          <meshStandardMaterial map={arch.banner} roughness={0.7} />
        </mesh>
      </group>
    </group>
  );
}
