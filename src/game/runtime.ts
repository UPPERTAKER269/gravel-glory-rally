// Mutable per-frame state shared by the stepper, the scene and the HUD.
// Never stored in React state: it changes 60+ times a second.
import type { RaceState } from "./sim/race";
import type { CameraMode } from "./store";

export interface TouchState {
  left: boolean;
  right: boolean;
  gas: boolean;
  brake: boolean;
  handbrake: boolean;
}

export const runtime = {
  race: null as RaceState | null,
  keys: new Set<string>(),
  touch: { left: false, right: false, gas: false, brake: false, handbrake: false } as TouchState,
  camera: "chase" as CameraMode,
  gamepadIndex: -1,
};
