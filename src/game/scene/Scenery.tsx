// Instanced roadside scenery: one InstancedMesh per sub-mesh per kind.
import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import type { SceneryItem, SceneryKind, Track } from "../sim/track";
import type { Environment } from "../sim/tracks";
import { SCENERY_URL } from "./models";

function recolor(mat: THREE.Material, env: Environment): THREE.Material {
  const m = (mat as THREE.MeshStandardMaterial).clone();
  const name = mat.name.toLowerCase();
  if (env === "snow" && name.includes("leaf")) m.color.lerp(new THREE.Color("#e8f0f6"), 0.5);
  if (env === "snow" && name.includes("grass")) m.color.set("#eef3f7");
  if (env === "canyon" && name.includes("dirt")) m.color.set("#b4532d");
  if (env === "canyon" && name.includes("grass")) m.color.set("#d9a46c");
  m.roughness = 0.9;
  return m;
}

function KindInstances({ kind, items, env, shadows }: { kind: SceneryKind; items: SceneryItem[]; env: Environment; shadows: boolean }) {
  const { scene } = useGLTF(SCENERY_URL[kind]);
  const meshes = useMemo(() => {
    scene.updateMatrixWorld(true);
    const out: THREE.InstancedMesh[] = [];
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      const mat = mats.length === 1 ? recolor(mats[0], env) : mats.map((x) => recolor(x, env));
      const inst = new THREE.InstancedMesh(mesh.geometry, mat, items.length);
      inst.userData.local = mesh.matrixWorld.clone();
      inst.castShadow = shadows;
      inst.receiveShadow = true;
      out.push(inst);
    });
    return out;
  }, [scene, items.length, env, shadows]);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const p = new THREE.Vector3();
    const s = new THREE.Vector3();
    for (const inst of meshes) {
      items.forEach((it, i) => {
        q.setFromAxisAngle(up, it.rot);
        p.set(it.x, it.y, it.z);
        s.setScalar(it.scale);
        m.compose(p, q, s).multiply(inst.userData.local);
        inst.setMatrixAt(i, m);
      });
      inst.instanceMatrix.needsUpdate = true;
      inst.computeBoundingSphere();
    }
    return () => meshes.forEach((x) => x.dispose());
  }, [meshes, items]);

  return (
    <>
      {meshes.map((m, i) => (
        <primitive key={i} object={m} />
      ))}
    </>
  );
}

export function Scenery({ track, shadows }: { track: Track; shadows: boolean }) {
  const groups = useMemo(() => {
    const g = new Map<SceneryKind, SceneryItem[]>();
    for (const it of track.scenery) {
      const l = g.get(it.kind) ?? [];
      l.push(it);
      g.set(it.kind, l);
    }
    return [...g.entries()];
  }, [track]);
  return (
    <>
      {groups.map(([kind, items]) => (
        <KindInstances key={kind} kind={kind} items={items} env={track.def.environment} shadows={shadows} />
      ))}
    </>
  );
}
