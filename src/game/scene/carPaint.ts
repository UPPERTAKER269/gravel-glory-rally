// Real-car materials for the converted car models. Material names come from the converter:
// paint, paint2, glass, trim, chrome, headlight, taillight, tyre, rim.
import * as THREE from "three";

export interface CarLook {
  paint: string;
  /** Mud colour splashed up the lower body (race only). */
  mud?: string;
}

export interface CarLights {
  tail: THREE.MeshStandardMaterial;
  head: THREE.MeshStandardMaterial;
}

export const TAIL_IDLE = 0.6;
export const TAIL_BRAKE = 4;

function paintMaterial(color: THREE.Color, mud: string | undefined) {
  const m = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.45,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.5,
  });
  if (mud) {
    const mudColor = new THREE.Color(mud).multiplyScalar(0.62);
    m.onBeforeCompile = (sh) => {
      sh.uniforms["uMud"] = { value: mudColor };
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying float vMudY;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvMudY = position.y;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying float vMudY;\nuniform vec3 uMud;")
        .replace(
          "#include <color_fragment>",
          "#include <color_fragment>\nfloat mudM = (1.0 - smoothstep(0.22, 0.72, vMudY)) * 0.85;\ndiffuseColor.rgb = mix(diffuseColor.rgb, uMud, mudM);",
        )
        .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.95, mudM);")
        .replace("#include <lights_physical_fragment>", "#include <lights_physical_fragment>\nmaterial.clearcoat *= 1.0 - mudM;");
    };
    m.customProgramCacheKey = () => "car-mud";
  }
  return m;
}

/** Replace the converter's flat colours with paint, glass, chrome and rubber. One set per car so lights can change. */
export function applyCarLook(root: THREE.Object3D, look: CarLook): CarLights {
  const base = new THREE.Color(look.paint);
  const accent = base.clone().multiplyScalar(0.45);
  const head = new THREE.MeshStandardMaterial({ color: "#fff6e0", emissive: "#fff1d2", emissiveIntensity: 1.6, roughness: 0.15 });
  const tail = new THREE.MeshStandardMaterial({ color: "#5a0806", emissive: "#ff1d12", emissiveIntensity: TAIL_IDLE, roughness: 0.2 });
  const mats: Record<string, THREE.Material> = {
    paint: paintMaterial(base, look.mud),
    paint2: paintMaterial(accent, look.mud),
    glass: new THREE.MeshPhysicalMaterial({ color: "#0a0d11", metalness: 0, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2 }),
    trim: new THREE.MeshStandardMaterial({ color: "#151618", roughness: 0.75, metalness: 0.05 }),
    chrome: new THREE.MeshStandardMaterial({ color: "#c9ccd1", roughness: 0.22, metalness: 1, envMapIntensity: 1.4 }),
    tyre: new THREE.MeshStandardMaterial({ color: look.mud ? new THREE.Color("#161412").lerp(new THREE.Color(look.mud), 0.18) : "#161616", roughness: 0.93 }),
    rim: new THREE.MeshStandardMaterial({ color: "#a4a9b0", roughness: 0.3, metalness: 0.9 }),
    headlight: head,
    taillight: tail,
  };
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const pick = (m: THREE.Material) => mats[m.name] ?? m;
    mesh.material = Array.isArray(mesh.material) ? mesh.material.map(pick) : pick(mesh.material);
  });
  return { tail, head };
}
