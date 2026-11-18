import { expect, test } from "vitest";
import { applyRemote, packCar, pickHost } from "../net/protocol";
import { aiInput } from "./ai";
import { FIXED_DT, createRace, simulate } from "./race";

const grid = [
  { id: "aaa", name: "Thabo", carId: "hatch" },
  { id: "bbb", name: "Lerato", carId: "sedan" },
  { id: "ccc", name: "Sipho", carId: "suv" },
];
const online = (selfId: string) => ({ roomCode: "ABCD", raceId: "r1", selfId, grid });

test("online race has one car per friend and no AI", () => {
  const race = createRace({ trackId: "pinewood", laps: 1, opponents: 5, difficulty: "normal", playerCarId: "sedan", online: online("bbb") });
  expect(race.cars).toHaveLength(3);
  expect(race.player.netId).toBe("bbb");
  expect(race.cars.filter((c) => c.remote).map((c) => c.netId)).toEqual(["aaa", "ccc"]);
});

test("remote cars only move from network packets", () => {
  const race = createRace({ trackId: "pinewood", laps: 1, opponents: 0, difficulty: "normal", playerCarId: "hatch", online: online("aaa") });
  const remote = race.cars[1];
  const x0 = remote.x;
  simulate(race, 8, (r) => aiInput(r.player, r.track, r.cars, FIXED_DT));
  expect(remote.x).toBe(x0);
  expect(Math.abs(race.player.speed)).toBeGreaterThan(5);
});

test("remote car converges to its packet and copies finish", () => {
  const race = createRace({ trackId: "pinewood", laps: 1, opponents: 0, difficulty: "normal", playerCarId: "hatch", online: online("aaa") });
  const remote = race.cars[1];
  const pkt = { ...packCar(remote, "bbb", "r1"), x: remote.x + 3, fin: true, ft: 61.5, lap: 1 };
  for (let i = 0; i < 60; i++) applyRemote(remote, pkt, 1 / 60);
  expect(remote.x).toBeCloseTo(pkt.x, 1);
  expect(remote.finished).toBe(true);
  expect(remote.finishTime).toBe(61.5);
});

test("host is the first player to join", () => {
  expect(pickHost([{ id: "zzz", joinedAt: 5 }, { id: "yyy", joinedAt: 9 }])).toBe("zzz");
});

test("gearbox climbs through the gears on a full-throttle run", () => {
  const race = createRace({ trackId: "pinewood", laps: 1, opponents: 1, difficulty: "normal", playerCarId: "hatch" });
  simulate(race, 3.6 + 12, (r) => aiInput(r.player, r.track, r.cars, FIXED_DT));
  expect(race.player.gear).toBeGreaterThanOrEqual(3);
  expect(race.player.rpm).toBeGreaterThan(1500);
});

test("upgraded player car is faster from the line", () => {
  const base = createRace({ trackId: "pinewood", laps: 1, opponents: 1, difficulty: "normal", playerCarId: "hatch" });
  const up = createRace({ trackId: "pinewood", laps: 1, opponents: 1, difficulty: "normal", playerCarId: "hatch", playerUpgrades: { engine: 3 } });
  const full = { throttle: 1, brake: 0, steer: 0, handbrake: false };
  simulate(base, 3.5 + 3, full);
  simulate(up, 3.5 + 3, full);
  expect(up.player.speed).toBeGreaterThan(base.player.speed);
});
