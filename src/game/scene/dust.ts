// Pooled dust/snow spray particles drawn as soft points.
import * as THREE from "three";

const MAX = 700;

export class DustSystem {
  points: THREE.Points;
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private life = new Float32Array(MAX);
  private maxLife = new Float32Array(MAX);
  private size = new Float32Array(MAX);
  private alpha = new Float32Array(MAX);
  private next = 0;
  material: THREE.ShaderMaterial;

  constructor(color: string) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute("aSize", new THREE.BufferAttribute(this.size, 1));
    g.setAttribute("aAlpha", new THREE.BufferAttribute(this.alpha, 1));
    this.material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uColor: { value: new THREE.Color(color) }, uScale: { value: 400 } },
      vertexShader: /* glsl */ `
        attribute float aSize; attribute float aAlpha; varying float vAlpha; uniform float uScale;
        void main() {
          vAlpha = aAlpha;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_PointSize = aSize * uScale / max(0.5, -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying float vAlpha;
        void main() {
          vec2 c = gl_PointCoord - 0.5;
          float d = dot(c, c) * 4.0;
          float a = clamp(1.0 - d, 0.0, 1.0);
          a = a * a * vAlpha;
          if (a < 0.01) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
  }

  emit(x: number, y: number, z: number, vx: number, vz: number, strength: number) {
    const i = this.next;
    this.next = (this.next + 1) % MAX;
    this.pos[i * 3] = x + (Math.random() - 0.5) * 0.6;
    this.pos[i * 3 + 1] = y + 0.2;
    this.pos[i * 3 + 2] = z + (Math.random() - 0.5) * 0.6;
    this.vel[i * 3] = vx * 0.25 + (Math.random() - 0.5) * 2;
    this.vel[i * 3 + 1] = 0.8 + Math.random() * 1.4;
    this.vel[i * 3 + 2] = vz * 0.25 + (Math.random() - 0.5) * 2;
    this.maxLife[i] = 1.2 + Math.random() * 1.2 * strength;
    this.life[i] = this.maxLife[i];
    this.size[i] = 0.8;
    this.alpha[i] = 0;
  }

  update(dt: number) {
    for (let i = 0; i < MAX; i++) {
      if (this.life[i] <= 0) {
        this.alpha[i] = 0;
        continue;
      }
      this.life[i] -= dt;
      const t = 1 - this.life[i] / this.maxLife[i];
      const drag = Math.exp(-2.2 * dt);
      this.vel[i * 3] *= drag;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag;
      this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.size[i] = 0.8 + t * 4.5;
      this.alpha[i] = Math.min(1, t * 6) * (1 - t) * 0.55;
    }
    const g = this.points.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.aSize.needsUpdate = true;
    g.attributes.aAlpha.needsUpdate = true;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }
}
