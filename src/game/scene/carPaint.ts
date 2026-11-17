// Swaps Kenney's flat car materials for glossy clear-coated paint (same colormap texture).
import * as THREE from "three";

const cache = new WeakMap<THREE.Material, THREE.Material>();

function paint(src: THREE.Material, wheel: boolean): THREE.Material {
  const key = cache.get(src);
  if (key && !wheel) return key;
  const s = src as THREE.MeshStandardMaterial;
  if (wheel) {
    const m = s.clone();
    m.roughness = 0.8;
    m.metalness = 0.1;
    return m;
  }
  const m = new THREE.MeshPhysicalMaterial({
    map: s.map,
    color: s.color,
    roughness: 0.42,
    metalness: 0.2,
    clearcoat: 1,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.35,
  });
  cache.set(src, m);
  return m;
}

export function upgradeCarMaterials(root: THREE.Object3D) {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    let wheel = false;
    for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p.name.startsWith("wheel")) wheel = true;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map((x) => paint(x, wheel)) : paint(mesh.material, wheel);
  });
}
