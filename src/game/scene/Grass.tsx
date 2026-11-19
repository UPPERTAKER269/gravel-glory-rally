// Instanced roadside grass / dry brush / snow tufts. One draw call per track.
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { rng } from "../sim/math";
import { VERGE, type Track } from "../sim/track";
import type { Environment } from "../sim/tracks";

const LOOK: Record<Environment, { base: string; tip: string; height: number; density: number }> = {
  forest: { base: "#5b7a2e", tip: "#b9c766", height: 0.75, density: 1 },
  canyon: { base: "#a8844c", tip: "#e0c48a", height: 0.6, density: 0.45 },
  snow: { base: "#a7b2a0", tip: "#f2f6f9", height: 0.45, density: 0.4 },
};

/** A clump of 7 tapered blades with a base->tip color ramp. */
function tuftGeometry(baseHex: string, tipHex: string) {
  const base = new THREE.Color(baseHex);
  const tip = new THREE.Color(tipHex);
  const pos: number[] = [];
  const col: number[] = [];
  const r = rng(11);
  for (let b = 0; b < 7; b++) {
    const a = (b / 7) * Math.PI * 2 + r() * 0.6;
    const ox = Math.cos(a) * 0.12 * r(), oz = Math.sin(a) * 0.12 * r();
    const w = 0.07 + r() * 0.05;
    const h = 0.6 + r() * 0.5;
    const lean = 0.15 + r() * 0.3;
    const px = Math.cos(a + Math.PI / 2) * w, pz = Math.sin(a + Math.PI / 2) * w;
    const tx = ox + Math.cos(a) * lean, tz = oz + Math.sin(a) * lean;
    // Both windings, so each side is a front face lit from above (no dark back faces).
    pos.push(ox - px, 0, oz - pz, ox + px, 0, oz + pz, tx, h, tz);
    pos.push(ox + px, 0, oz + pz, ox - px, 0, oz - pz, tx, h, tz);
    for (let k = 0; k < 2; k++) col.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  // Light grass from above, not from its random blade normals.
  const n = g.getAttribute("normal");
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

export function Grass({ track, quality }: { track: Track; quality: "high" | "low" }) {
  const env = track.def.environment;
  const look = LOOK[env];
  const count = Math.round((quality === "high" ? (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0 ? 3200 : 5200) : 1800) * look.density);

  const mesh = useMemo(() => {
    const geo = tuftGeometry(look.base, look.tip);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 });
    const m = new THREE.InstancedMesh(geo, mat, count);
    m.receiveShadow = true;
    m.frustumCulled = false;
    return m;
  }, [look, count]);

  useLayoutEffect(() => {
    const r = rng(track.def.seed * 7 + 3);
    const hw = track.halfWidth;
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    let placed = 0;
    let guard = 0;
    while (placed < count && guard++ < count * 4) {
      const smp = track.sampleAt(r() * track.length);
      const side = r() < 0.5 ? -1 : 1;
      // Dense on the verge edge, thinning out into the field.
      const off = hw + 0.8 + Math.pow(r(), 2.2) * (VERGE + 30);
      const x = smp.x + smp.rx * off * side + (r() - 0.5) * 2;
      const z = smp.z + smp.rz * off * side + (r() - 0.5) * 2;
      const n = track.nearest(x, z, -1);
      if (Math.abs(n.lat) < hw + 0.6) continue;
      p.set(x, track.heightAt(x, z, n.i) - 0.04, z);
      q.setFromAxisAngle(up, r() * Math.PI * 2);
      const k = look.height * (0.6 + r() * 0.9);
      s.set(k * (0.8 + r() * 0.5), k, k * (0.8 + r() * 0.5));
      m4.compose(p, q, s);
      mesh.setMatrixAt(placed++, m4);
    }
    mesh.count = placed;
    mesh.instanceMatrix.needsUpdate = true;
    return () => {
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
    };
  }, [mesh, track, count, look.height]);

  return <primitive object={mesh} />;
}
