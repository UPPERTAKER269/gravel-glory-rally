// Car upgrades, bought with coins earned in races. Pure rules: no React/three.
import type { CarSpec } from "./cars";

export const UPGRADE_KINDS = ["engine", "tyres", "brakes", "suspension"] as const;
export type UpgradeKind = (typeof UPGRADE_KINDS)[number];
export type UpgradeLevels = Record<UpgradeKind, number>;

export const MAX_UPGRADE_LEVEL = 3;
export const NO_UPGRADES: UpgradeLevels = { engine: 0, tyres: 0, brakes: 0, suspension: 0 };

export const UPGRADE_INFO: Record<UpgradeKind, { name: string; effect: string }> = {
  engine: { name: "Engine", effect: "+6% acceleration, +3% top speed per level" },
  tyres: { name: "Tyres", effect: "+5% grip per level" },
  brakes: { name: "Brakes", effect: "+10% stopping power per level" },
  suspension: { name: "Suspension", effect: "+4% steering, +2% grip per level" },
};

/** Coin price per level (index = level being bought - 1), before the car class factor. */
export const UPGRADE_BASE_COST = [300, 700, 1400] as const;

/** Pricier cars cost more to upgrade: x1 for the starter car, up to x2 for the top car. */
export function upgradeCost(car: CarSpec, nextLevel: number): number {
  if (nextLevel < 1 || nextLevel > MAX_UPGRADE_LEVEL) return Infinity;
  const factor = 1 + Math.min(1, car.price / 9000);
  return Math.round((UPGRADE_BASE_COST[nextLevel - 1] * factor) / 10) * 10;
}

export function levelsOf(levels: Partial<UpgradeLevels> | undefined): UpgradeLevels {
  return { ...NO_UPGRADES, ...(levels ?? {}) };
}

/** The car's spec with upgrades applied. */
export function upgradedSpec(car: CarSpec, levels: Partial<UpgradeLevels> | undefined): CarSpec {
  const l = levelsOf(levels);
  return {
    ...car,
    accel: car.accel * (1 + 0.06 * l.engine),
    topSpeed: car.topSpeed * (1 + 0.03 * l.engine),
    grip: car.grip * (1 + 0.05 * l.tyres + 0.02 * l.suspension),
    brake: car.brake * (1 + 0.1 * l.brakes),
    turn: car.turn * (1 + 0.04 * l.suspension),
  };
}
