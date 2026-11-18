// Tyre marks left on the ground while sliding: a ring buffer of thin quads, one draw call.
import * as THREE from "three";
import type { CarState } from "../sim/vehicle";

const MAX_SEGS = 1600;
const WIDTH = 0.32;

export class SkidMarks {
  mesh: THREE.Mesh;
  private pos = new Float32Array(MAX_SEGS * 4 * 3);
  private alpha = new Float32Array(MAX_SEGS * 4);
  private next = 0;
  private last = new Map<string, { x: number; y: number; z: number } | null>();
  private geo: THREE.BufferGeometry;

  constructor(color: string) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1));
    const idx = new Uint32Array(MAX_SEGS * 6);
    for (let i = 0; i < MAX_SEGS; i++) {
      const v = i * 4;
      idx.set([v, v + 1, v + 2, v + 2, v + 1, v + 3], i * 6);
    }
    g.setIndex(new THREE.BufferAttribute(idx, 1));
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
      fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { uColor: { value: new THREE.Color(color) } }]),
      vertexShader: /* glsl */ `
        #include <fog_pars_vertex>
        attribute float aAlpha; varying float vAlpha;
        void main() {
          vAlpha = aAlpha;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: /* glsl */ `
        #include <fog_pars_fragment>
        uniform vec3 uColor; varying float vAlpha;
        void main() {
          gl_FragColor = vec4(uColor, vAlpha);
          #include <fog_fragment>
        }`,
    });
    this.mesh = new THREE.Mesh(g, mat);
    this.mesh.frustumCulled = false;
  }

  /** Lay marks under both rear wheels when the car slides, brakes hard or handbrakes. */
  update(cars: CarState[], braking: boolean) {
    let dirty = false;
    for (const car of cars) {
      const sp = Math.hypot(car.vx, car.vz);
      const sliding = sp > 5 && (Math.abs(car.slip) > 0.16 || (car.isPlayer && braking && sp > 10));
      const strength = Math.min(0.55, 0.15 + Math.abs(car.slip) * 0.8);
      const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
      for (const side of [-0.78, 0.78]) {
        const key = `${car.id}:${side}`;
        const x = car.x - fx * 1.15 - fz * side;
        const z = car.z - fz * 1.15 + fx * side;
        const y = car.y + 0.03;
        const prev = this.last.get(key);
        if (!sliding) { this.last.set(key, null); continue; }
        if (prev) {
          const dx = x - prev.x, dz = z - prev.z;
          const d = Math.hypot(dx, dz);
          if (d < 0.5) continue;
          if (d < 4) { this.addSeg(prev, { x, y, z }, dx / d, dz / d, strength); dirty = true; }
        }
        this.last.set(key, { x, y, z });
      }
    }
    if (dirty) {
      (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  private addSeg(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }, dx: number, dz: number, alpha: number) {
    const i = this.next;
    this.next = (this.next + 1) % MAX_SEGS;
    const px = -dz * WIDTH * 0.5, pz = dx * WIDTH * 0.5;
    const p = this.pos, o = i * 12;
    p[o] = a.x + px; p[o + 1] = a.y; p[o + 2] = a.z + pz;
    p[o + 3] = a.x - px; p[o + 4] = a.y; p[o + 5] = a.z - pz;
    p[o + 6] = b.x + px; p[o + 7] = b.y; p[o + 8] = b.z + pz;
    p[o + 9] = b.x - px; p[o + 10] = b.y; p[o + 11] = b.z - pz;
    this.alpha.fill(alpha, i * 4, i * 4 + 4);
  }

  dispose() {
    this.geo.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
