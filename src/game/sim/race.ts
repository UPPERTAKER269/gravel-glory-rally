// Race rules: grid, countdown, laps, positions, finishing.
import { aiInput } from "./ai";
import { CARS, carById, type CarSpec } from "./cars";
import { buildTrack, type Track } from "./track";
import { trackById } from "./tracks";
import { upgradedSpec, type UpgradeLevels } from "./upgrades";
import { NO_INPUT, collideCars, stepVehicle, type CarInput, type CarState } from "./vehicle";

export const COUNTDOWN = 3.5; // seconds before the green light
export const FIXED_DT = 1 / 120;
export const AI_NAMES = ["K. Laine", "M. Rossi", "S. Ogier", "A. Vatanen", "P. Solberg", "C. McRae", "T. Kankkunen"];

export type Difficulty = "easy" | "normal" | "hard";
export const DIFFICULTY_SKILL: Record<Difficulty, number> = { easy: 0.8, normal: 0.9, hard: 0.98 };

export interface RaceConfig {
  trackId: string;
  laps: number;
  opponents: number;
  difficulty: Difficulty;
  playerCarId: string;
  playerUpgrades?: Partial<UpgradeLevels>;
  careerEventId?: string;
  online?: OnlineRaceInfo;
}

export interface OnlineGridEntry {
  id: string;
  name: string;
  carId: string;
  upgrades?: Partial<UpgradeLevels>;
}

export interface OnlineRaceInfo {
  roomCode: string;
  raceId: string;
  selfId: string;
  /** Everyone in the race, in grid order (pole first). */
  grid: OnlineGridEntry[];
}

export type RacePhase = "countdown" | "racing" | "finished";

export interface RaceState {
  config: RaceConfig;
  track: Track;
  cars: CarState[];
  player: CarState;
  time: number; // race clock, starts at green
  countdown: number;
  phase: RacePhase;
  finishOrder: number[];
  accumulator: number;
}

const trackCache = new Map<string, Track>();
export function getTrack(id: string): Track {
  let t = trackCache.get(id);
  if (!t) {
    t = buildTrack(trackById(id));
    trackCache.set(id, t);
  }
  return t;
}

function makeCar(id: number, name: string, spec: CarSpec, isPlayer: boolean, track: Track, slot: number, skill: number): CarState {
  const row = Math.floor(slot / 2);
  const col = slot % 2 === 0 ? -1 : 1;
  const s = track.length - 14 - row * 9 - (col > 0 ? 4 : 0);
  const smp = track.sampleAt(s);
  const lat = col * 2.7;
  const x = smp.x + smp.rx * lat;
  const z = smp.z + smp.rz * lat;
  const yaw = Math.atan2(smp.tx, smp.tz);
  const n = track.nearest(x, z, -1);
  return {
    id, name, spec, isPlayer,
    x, z, y: track.heightAt(x, z, n.i), yaw,
    vx: 0, vz: 0, vy: 0, yawRate: 0, steer: 0, steerAngle: 0, speed: 0, slip: 0,
    onRoad: true, lat, idx: n.i, s: n.s,
    pitch: 0, roll: 0, pitchVel: 0, rollVel: 0, bounce: 0, bounceVel: 0,
    groundPitch: 0, groundRoll: 0, wheelSpin: 0, lastAccel: 0, impact: 0,
    lap: -1, passedHalf: true, progress: n.s - track.length, finished: false,
    finishTime: 0, lapStart: 0, bestLap: 0,
    aiLane: ((id * 1.37) % 3) - 1.5, aiSkill: skill * (0.96 + ((id * 0.031) % 0.06)),
    stuckTime: 0, reverseTime: 0,
    gear: 1, rpm: 900, shiftTimer: 0,
  };
}

export function createRace(config: RaceConfig): RaceState {
  const track = getTrack(config.trackId);
  if (config.online) return createOnlineRace(config, config.online, track);
  const skill = DIFFICULTY_SKILL[config.difficulty];
  const n = Math.max(1, Math.min(5, config.opponents));
  const cars: CarState[] = [];
  const playerSpec = carById(config.playerCarId);
  // AI cars use the rest of the roster, cycling.
  const pool = CARS.filter((c) => c.id !== playerSpec.id);
  for (let i = 0; i < n; i++) {
    const spec = pool[i % pool.length];
    cars.push(makeCar(i + 1, AI_NAMES[i % AI_NAMES.length], spec, false, track, i, skill));
  }
  // Player starts at the back of the grid.
  const player = makeCar(0, "You", upgradedSpec(playerSpec, config.playerUpgrades), true, track, n, 1);
  cars.push(player);
  return { config, track, cars, player, time: 0, countdown: COUNTDOWN, phase: "countdown", finishOrder: [], accumulator: 0 };
}

/** Online: one car per grid entry, no AI. Remote cars are moved by network packets. */
function createOnlineRace(config: RaceConfig, online: OnlineRaceInfo, track: Track): RaceState {
  const cars: CarState[] = [];
  let player: CarState | null = null;
  online.grid.forEach((g, slot) => {
    const isSelf = g.id === online.selfId;
    const spec = upgradedSpec(carById(g.carId), g.upgrades);
    const car = makeCar(slot, isSelf ? "You" : g.name, spec, isSelf, track, slot, 1);
    car.netId = g.id;
    if (isSelf) player = car;
    else car.remote = true;
    cars.push(car);
  });
  if (!player) throw new Error("Local player missing from online grid");
  return { config, track, cars, player, time: 0, countdown: COUNTDOWN, phase: "countdown", finishOrder: [], accumulator: 0 };
}

function updateProgress(race: RaceState, car: CarState, prevS: number) {
  const L = race.track.length;
  const s = car.s;
  if (s > L * 0.4 && s < L * 0.6) car.passedHalf = true;
  // Crossed the line forward.
  if (prevS > L * 0.8 && s < L * 0.2 && car.passedHalf) {
    car.lap += 1;
    car.passedHalf = false;
    if (car.lap >= 1) {
      const lapTime = race.time - car.lapStart;
      if (car.bestLap === 0 || lapTime < car.bestLap) car.bestLap = lapTime;
    }
    car.lapStart = race.time;
    if (car.lap >= race.config.laps && !car.finished) {
      car.finished = true;
      car.finishTime = race.time;
      race.finishOrder.push(car.id);
    }
  }
  // Crossed backward: undo.
  if (prevS < L * 0.2 && s > L * 0.8 && !car.passedHalf) {
    car.lap -= 1;
    car.passedHalf = true;
  }
  car.progress = car.lap * L + s;
}

/** Ordered list, leader first. */
export function standings(race: RaceState): CarState[] {
  return [...race.cars].sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1;
    if (b.finished) return 1;
    return b.progress - a.progress;
  });
}

export function playerPosition(race: RaceState) {
  return standings(race).indexOf(race.player) + 1;
}

function fixedStep(race: RaceState, playerInput: CarInput, dt: number) {
  if (race.phase === "countdown") {
    race.countdown -= dt;
    if (race.countdown <= 0) {
      race.phase = "racing";
      race.countdown = 0;
    }
  } else {
    race.time += dt;
  }
  const frozen = race.phase === "countdown";
  for (const car of race.cars) {
    if (car.remote) continue;
    let input: CarInput;
    if (frozen) input = NO_INPUT;
    else if (car.isPlayer && !car.finished) input = playerInput;
    else input = aiInput(car, race.track, race.cars, dt);
    if (car.finished) input = { ...input, throttle: input.throttle * 0.5 };
    const prevS = car.s;
    const px = car.x, pz = car.z;
    stepVehicle(car, input, race.track, dt);
    if (frozen) { car.x = px; car.z = pz; car.vx = 0; car.vz = 0; car.speed = 0; }
    if (!frozen) updateProgress(race, car, prevS);
  }
  collideCars(race.cars);
  if (race.phase === "racing" && race.player.finished) race.phase = "finished";
}

/** Advance the race by a real frame delta, in fixed substeps. */
export function stepRace(race: RaceState, playerInput: CarInput, frameDt: number) {
  race.accumulator += Math.min(frameDt, 0.1);
  let steps = 0;
  while (race.accumulator >= FIXED_DT && steps < 12) {
    fixedStep(race, playerInput, FIXED_DT);
    race.accumulator -= FIXED_DT;
    steps++;
  }
  if (steps >= 12) race.accumulator = 0;
}

/** Fixed-step simulation without rendering (tests, debug). */
export function simulate(race: RaceState, seconds: number, input: CarInput | ((r: RaceState) => CarInput) = NO_INPUT) {
  const steps = Math.round(seconds / FIXED_DT);
  for (let i = 0; i < steps; i++) {
    fixedStep(race, typeof input === "function" ? input(race) : input, FIXED_DT);
  }
}

export interface RaceResultRow {
  id: number;
  name: string;
  carName: string;
  isPlayer: boolean;
  position: number;
  time: number; // finish time or estimate
  estimated: boolean;
  bestLap: number;
}

export function raceResults(race: RaceState): RaceResultRow[] {
  const L = race.track.length;
  const total = race.config.laps * L;
  return standings(race).map((c, i) => {
    let time = c.finishTime;
    let estimated = false;
    if (!c.finished) {
      const avg = Math.max(5, (c.progress + 1) / Math.max(race.time, 1));
      time = race.time + Math.max(0, total - c.progress) / avg;
      estimated = true;
    }
    return { id: c.id, name: c.name, carName: c.spec.name, isPlayer: c.isPlayer, position: i + 1, time, estimated, bestLap: c.bestLap };
  });
}
