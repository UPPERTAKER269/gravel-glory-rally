import { expect, test } from "vitest";
import { carById } from "./cars";
import { MAX_UPGRADE_LEVEL, upgradeCost, upgradedSpec } from "./upgrades";

test("upgrade prices are coins: 300/700/1400 on the starter car", () => {
  const hatch = carById("hatch");
  expect([1, 2, 3].map((l) => upgradeCost(hatch, l))).toEqual([300, 700, 1400]);
});

test("top car upgrades cost double", () => {
  expect(upgradeCost(carById("apex"), 1)).toBe(600);
});

test("no level past the max", () => {
  expect(upgradeCost(carById("hatch"), MAX_UPGRADE_LEVEL + 1)).toBe(Infinity);
});

test("engine level 3 gives +18% accel and +9% top speed", () => {
  const base = carById("hatch");
  const up = upgradedSpec(base, { engine: 3 });
  expect(up.accel).toBeCloseTo(base.accel * 1.18);
  expect(up.topSpeed).toBeCloseTo(base.topSpeed * 1.09);
  expect(up.grip).toBe(base.grip);
});

test("buying an upgrade spends coins and raises the level", async () => {
  const { useGame } = await import("../store");
  useGame.setState((s) => ({ profile: { ...s.profile, coins: 1000, ownedCars: ["hatch"], upgrades: {} } }));
  expect(useGame.getState().buyUpgrade("hatch", "engine")).toBe(true);
  expect(useGame.getState().profile.coins).toBe(700);
  expect(useGame.getState().profile.upgrades.hatch.engine).toBe(1);
  // 700 left, level 2 costs 700: allowed; then level 3 (1400) is not affordable.
  expect(useGame.getState().buyUpgrade("hatch", "engine")).toBe(true);
  expect(useGame.getState().buyUpgrade("hatch", "engine")).toBe(false);
  expect(useGame.getState().profile.coins).toBe(0);
});

test("can't upgrade a car you don't own", async () => {
  const { useGame } = await import("../store");
  useGame.setState((s) => ({ profile: { ...s.profile, coins: 99999, ownedCars: ["hatch"] } }));
  expect(useGame.getState().buyUpgrade("apex", "tyres")).toBe(false);
});
