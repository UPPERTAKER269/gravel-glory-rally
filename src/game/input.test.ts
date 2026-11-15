import { describe, expect, it } from "vitest";
import { gamepadInput, keyboardInput, mergeInputs, touchInput } from "./input";

describe("input mapping: right is +1 for every source", () => {
  it("keyboard D and ArrowRight steer right", () => {
    expect(keyboardInput(new Set(["KeyD"])).steer).toBe(1);
    expect(keyboardInput(new Set(["ArrowRight"])).steer).toBe(1);
    expect(keyboardInput(new Set(["KeyA"])).steer).toBe(-1);
  });
  it("touch right button steers right", () => {
    expect(touchInput({ left: false, right: true, gas: false, brake: false, handbrake: false }).steer).toBe(1);
  });
  it("gamepad stick right steers right, resting stick is centered", () => {
    expect(gamepadInput({ axes: [1], buttons: [] }).steer).toBe(1);
    expect(gamepadInput({ axes: [0.1], buttons: [] }).steer).toBe(0);
  });
  it("merged input clamps steering", () => {
    const k = keyboardInput(new Set(["KeyD"]));
    expect(mergeInputs(k, k).steer).toBe(1);
  });
});
