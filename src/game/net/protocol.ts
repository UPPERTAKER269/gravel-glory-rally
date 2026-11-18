// Online race wire format and remote-car smoothing. Pure TS (no React/three/network).
import type { CarState } from "../sim/vehicle";

/** Position packet, sent ~8x per second per player. Numbers are rounded to keep it small. */
export interface NetCarState {
  id: string;
  raceId: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  steer: number;
  lap: number;
  progress: number;
  fin: boolean;
  ft: number;
}

/** Host -> everyone: start this race now. */
export interface NetStart {
  raceId: string;
  trackId: string;
  laps: number;
  grid: { id: string; name: string; carId: string; upgrades?: Record<string, number> }[];
}

export interface PresenceMeta {
  name: string;
  carId: string;
  upgrades?: Record<string, number>;
  joinedAt: number;
}

export const MAX_ROOM_PLAYERS = 6;

/** Network send rate sized to the room (N^2 x tick stays well under the project limit). */
export function netTickFor(players: number) {
  return players <= 5 ? 1 / 8 : 1 / 6;
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function packCar(car: CarState, id: string, raceId: string): NetCarState {
  return {
    id, raceId,
    x: r2(car.x), y: r2(car.y), z: r2(car.z), yaw: r2(car.yaw),
    speed: r2(car.speed), steer: r2(car.steer),
    lap: car.lap, progress: r2(car.progress), fin: car.finished, ft: r2(car.finishTime),
  };
}

/** Move a remote car toward its latest packet. Snaps on big gaps (respawn/teleport). */
export function applyRemote(car: CarState, s: NetCarState, dt: number) {
  const k = 1 - Math.exp(-11 * dt);
  const dx = s.x - car.x;
  const dz = s.z - car.z;
  if (dx * dx + dz * dz > 25 * 25) {
    car.x = s.x; car.y = s.y; car.z = s.z; car.yaw = s.yaw;
  } else {
    car.x += dx * k;
    car.z += dz * k;
    car.y += (s.y - car.y) * k;
    const dy = Math.atan2(Math.sin(s.yaw - car.yaw), Math.cos(s.yaw - car.yaw));
    car.yaw += dy * k;
  }
  const prevSpeed = car.speed;
  car.speed += (s.speed - car.speed) * k;
  car.vx = Math.sin(car.yaw) * car.speed;
  car.vz = Math.cos(car.yaw) * car.speed;
  car.steer = s.steer;
  car.steerAngle = (s.steer * 0.6) / (1 + Math.abs(car.speed) * 0.19);
  car.wheelSpin += (car.speed / 0.45) * dt;
  car.lastAccel += ((car.speed - prevSpeed) / Math.max(dt, 1e-3) - car.lastAccel) * k;
  car.lap = s.lap;
  car.progress = s.progress;
  if (s.fin && !car.finished) {
    car.finished = true;
    car.finishTime = s.ft;
  }
}

/** Host = earliest joiner (ties broken by id), so everyone agrees without an election. */
export function pickHost(roster: { id: string; joinedAt: number }[]): string | null {
  if (!roster.length) return null;
  return [...roster].sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1))[0].id;
}

export function makeRoomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let c = "";
  for (let i = 0; i < 4; i++) c += alphabet[Math.floor(Math.random() * alphabet.length)];
  return c;
}

export function cleanRoomCode(raw: string) {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6);
}
