// Merges keyboard, touch and gamepad into one CarInput.
// Steering sign: +1 = right for every source.
import { clamp } from "./sim/math";
import type { CarInput } from "./sim/vehicle";
import type { TouchState } from "./runtime";

export function keyboardInput(keys: Set<string>): CarInput {
  const up = keys.has("KeyW") || keys.has("ArrowUp");
  const down = keys.has("KeyS") || keys.has("ArrowDown");
  const left = keys.has("KeyA") || keys.has("ArrowLeft");
  const right = keys.has("KeyD") || keys.has("ArrowRight");
  return {
    throttle: up ? 1 : 0,
    brake: down ? 1 : 0,
    steer: (right ? 1 : 0) - (left ? 1 : 0),
    handbrake: keys.has("Space"),
  };
}

export function touchInput(t: TouchState): CarInput {
  return {
    throttle: t.gas ? 1 : 0,
    brake: t.brake ? 1 : 0,
    steer: (t.right ? 1 : 0) - (t.left ? 1 : 0),
    handbrake: t.handbrake,
  };
}

export interface PadSnapshot {
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}

const DEADZONE = 0.15;
export function gamepadInput(pad: PadSnapshot | null): CarInput {
  if (!pad) return { throttle: 0, brake: 0, steer: 0, handbrake: false };
  const raw = pad.axes[0] ?? 0;
  const mag = Math.abs(raw);
  const steer = mag < DEADZONE ? 0 : Math.sign(raw) * ((mag - DEADZONE) / (1 - DEADZONE));
  const b = (i: number) => pad.buttons[i]?.value ?? 0;
  const p = (i: number) => pad.buttons[i]?.pressed ?? false;
  return {
    throttle: Math.max(b(7), p(0) ? 1 : 0),
    brake: Math.max(b(6), p(2) ? 1 : 0),
    steer,
    handbrake: p(1) || p(5),
  };
}

export function mergeInputs(...inputs: CarInput[]): CarInput {
  const out: CarInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };
  for (const i of inputs) {
    out.throttle = Math.max(out.throttle, i.throttle);
    out.brake = Math.max(out.brake, i.brake);
    out.steer += i.steer;
    out.handbrake = out.handbrake || i.handbrake;
  }
  out.steer = clamp(out.steer, -1, 1);
  return out;
}
