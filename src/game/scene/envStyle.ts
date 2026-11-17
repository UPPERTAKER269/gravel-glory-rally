// Per-environment look: light, fog, sky and surface colors.
import type { Environment } from "../sim/tracks";

export interface EnvStyle {
  sun: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  hemiSky: string;
  hemiGround: string;
  hemiIntensity: number;
  fog: string;
  fogNear: number;
  fogFar: number;
  turbidity: number;
  rayleigh: number;
  road: [string, string, string]; // base, light speck, dark speck
  verge: string;
  terrainLow: string;
  terrainHigh: string;
  terrainSteep: string;
  dust: string;
  exposure: number;
  /** Lower = shinier (packed snow and ice glint). */
  roadRoughness: number;
}

export const ENV_STYLE: Record<Environment, EnvStyle> = {
  forest: {
    sun: [120, 70, -60], sunColor: "#ffe2b8", sunIntensity: 2.6,
    hemiSky: "#cfe3f2", hemiGround: "#4a5a2c", hemiIntensity: 0.9,
    fog: "#c9cdb8", fogNear: 70, fogFar: 420, turbidity: 6, rayleigh: 1.4,
    road: ["#8c7a62", "#b3a184", "#5e5141"], verge: "#6e6a45",
    terrainLow: "#5f7d36", terrainHigh: "#3f5e2a", terrainSteep: "#6b6250",
    dust: "#c8b28c", exposure: 1.0, roadRoughness: 0.95,
  },
  canyon: {
    sun: [-90, 110, 80], sunColor: "#fff0d6", sunIntensity: 3.0,
    hemiSky: "#bfd8ee", hemiGround: "#9a5a35", hemiIntensity: 0.85,
    fog: "#e6c7a3", fogNear: 90, fogFar: 520, turbidity: 9, rayleigh: 1.1,
    road: ["#c08f63", "#dcb388", "#8f6644"], verge: "#b27b4f",
    terrainLow: "#d39a64", terrainHigh: "#b0532f", terrainSteep: "#8e3f24",
    dust: "#d9aa7a", exposure: 1.0, roadRoughness: 0.92,
  },
  snow: {
    sun: [60, 45, 120], sunColor: "#eaf2ff", sunIntensity: 2.2,
    hemiSky: "#dce9f7", hemiGround: "#8796a8", hemiIntensity: 1.0,
    fog: "#d7e2ec", fogNear: 60, fogFar: 380, turbidity: 3, rayleigh: 0.8,
    road: ["#c9d2da", "#eef3f7", "#97a3ae"], verge: "#e3eaf0",
    terrainLow: "#f1f5f8", terrainHigh: "#e2eaf1", terrainSteep: "#7d8794",
    dust: "#f4f8fb", exposure: 0.95, roadRoughness: 0.7,
  },
};
