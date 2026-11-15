// Procedural canvas textures (no network).
import * as THREE from "three";
import { rng } from "../sim/math";

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

/** Gravel/dirt/snow road: speckles plus two darker wheel ruts. */
export function roadTexture(base: string, light: string, dark: string, seed = 1) {
  const [c, g] = canvas(256, 512);
  const r = rng(seed);
  g.fillStyle = base;
  g.fillRect(0, 0, 256, 512);
  // Ruts where cars drive.
  for (const x of [70, 186]) {
    const grad = g.createLinearGradient(x - 26, 0, x + 26, 0);
    grad.addColorStop(0, "rgba(0,0,0,0)");
    grad.addColorStop(0.5, "rgba(0,0,0,0.16)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(x - 26, 0, 52, 512);
  }
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = r() < 0.5 ? light : dark;
    g.globalAlpha = 0.25 + r() * 0.5;
    const s = r() < 0.9 ? 1.5 : 3;
    g.fillRect(r() * 256, r() * 512, s, s);
  }
  // Soft edges fade into the verge.
  g.globalAlpha = 1;
  for (const [x0, x1] of [[0, 18], [256, 238]]) {
    const grad = g.createLinearGradient(x0, 0, x1, 0);
    grad.addColorStop(0, "rgba(0,0,0,0.25)");
    grad.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = grad;
    g.fillRect(Math.min(x0, x1), 0, 18, 512);
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** Grey-scale detail noise multiplied with terrain vertex colors. */
export function detailTexture(seed = 7) {
  const [c, g] = canvas(256, 256);
  const r = rng(seed);
  g.fillStyle = "#d8d8d8";
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 7000; i++) {
    const v = Math.floor(160 + r() * 95);
    g.fillStyle = `rgb(${v},${v},${v})`;
    const s = 1 + r() * 3;
    g.fillRect(r() * 256, r() * 256, s, s);
  }
  for (let i = 0; i < 60; i++) {
    const v = Math.floor(180 + r() * 60);
    g.fillStyle = `rgba(${v},${v},${v},0.25)`;
    g.beginPath();
    g.arc(r() * 256, r() * 256, 8 + r() * 24, 0, Math.PI * 2);
    g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

export function checkerTexture() {
  const [c, g] = canvas(512, 64);
  for (let x = 0; x < 32; x++)
    for (let y = 0; y < 4; y++) {
      g.fillStyle = (x + y) % 2 ? "#111111" : "#f4f4f4";
      g.fillRect(x * 16, y * 16, 16, 16);
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function bannerTexture(text: string) {
  const [c, g] = canvas(1024, 128);
  g.fillStyle = "#e8a317";
  g.fillRect(0, 0, 1024, 128);
  g.fillStyle = "#151515";
  g.fillRect(0, 0, 1024, 14);
  g.fillRect(0, 114, 1024, 14);
  g.font = "italic 800 76px 'Saira Condensed', Arial Narrow, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(text, 512, 68);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
