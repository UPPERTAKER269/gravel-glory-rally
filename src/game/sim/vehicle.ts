// Arcade rally vehicle model.
// Convention: yaw 0 faces +Z. forward = (sin yaw, cos yaw), right = (-cos yaw, sin yaw).
// Steering right (+1) turns the heading toward `right`, which decreases yaw.
import { clamp, damp } from "./math";
import { BOUNDARY, sceneryNear, type Track } from "./track";
import type { CarSpec } from "./cars";

export const WHEELBASE = 2.5;
export const MAX_STEER = 0.6; // rad at standstill
export const STEER_FALLOFF = 0.19; // steering angle shrinks with speed
export const STEER_RATE = 7; // how fast the wheel follows input (1/s)
export const BASE_GRIP = 8; // lateral velocity decay (1/s) at grip 1
export const HANDBRAKE_GRIP = 0.2; // grip multiplier with handbrake
export const HANDBRAKE_YAW = 0.9; // extra yaw rate (rad/s) while handbraking
export const HANDBRAKE_DECEL = 6;
export const ROLL_DRAG = 0.025; // 1/s
export const COAST_DECEL = 1.2; // m/s^2 when off throttle
export const SLIDE_DRAG = 0.35; // sliding sideways bleeds forward speed
export const REVERSE_TOP = 10;
export const REVERSE_ACCEL = 6;
export const CAR_RADIUS = 1.5;
// Gearbox: each gear tops out at this share of the car's top speed.
export const GEAR_TOP = [0.3, 0.47, 0.62, 0.76, 0.89, 1.04];
export const IDLE_RPM = 900;
export const REDLINE_RPM = 7400;
export const SHIFT_TIME = 0.14; // s of reduced drive while the clutch is out
export const SHIFT_DRIVE = 0.35; // share of drive kept during a shift
export const WEIGHT_TRANSFER = 0.012; // turn-in gained per m/s^2 of braking

export interface CarInput {
  throttle: number; // 0..1
  brake: number; // 0..1
  steer: number; // -1..1, + = right
  handbrake: boolean;
}

export const NO_INPUT: CarInput = { throttle: 0, brake: 0, steer: 0, handbrake: false };

export interface CarState {
  id: number;
  name: string;
  spec: CarSpec;
  isPlayer: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  vx: number;
  vz: number;
  vy: number;
  yawRate: number;
  steer: number;
  steerAngle: number;
  speed: number; // signed forward speed
  slip: number; // slip angle (rad), 0 when slow
  onRoad: boolean;
  lat: number;
  idx: number;
  s: number;
  // Visual suspension (radians / meters)
  pitch: number;
  roll: number;
  pitchVel: number;
  rollVel: number;
  bounce: number;
  bounceVel: number;
  groundPitch: number;
  groundRoll: number;
  wheelSpin: number;
  lastAccel: number;
  impact: number; // recent collision strength, decays
  // Race progress
  lap: number; // completed line crossings - 1 at start
  passedHalf: boolean;
  progress: number;
  finished: boolean;
  finishTime: number;
  lapStart: number;
  bestLap: number;
  // AI
  aiLane: number;
  aiSkill: number;
  stuckTime: number;
  reverseTime: number;
  // Drivetrain (sound + HUD)
  gear: number; // 1..6, -1 reverse
  rpm: number;
  shiftTimer: number;
  // Online: driven by network packets, not simulated here.
  remote?: boolean;
  netId?: string;
}

/** Pick gear and rpm from speed; returns the drive multiplier for this step. */
export function stepGearbox(car: CarState, vLong: number, throttle: number, dt: number): number {
  const top = car.spec.topSpeed;
  if (vLong < -0.5) {
    car.gear = -1;
    car.rpm = IDLE_RPM + (Math.abs(vLong) / REVERSE_TOP) * (REDLINE_RPM - IDLE_RPM) * 0.6;
    return 1;
  }
  if (car.gear < 1) car.gear = 1;
  const v = Math.max(0, vLong);
  const g = car.gear - 1;
  if (g < GEAR_TOP.length - 1 && v > GEAR_TOP[g] * top * 0.96) {
    car.gear += 1;
    car.shiftTimer = SHIFT_TIME;
  } else if (g > 0 && v < GEAR_TOP[g - 1] * top * 0.72) {
    car.gear -= 1;
  }
  const lo = car.gear > 1 ? GEAR_TOP[car.gear - 2] * top * 0.55 : 0;
  const hi = GEAR_TOP[car.gear - 1] * top;
  const f = Math.min(1.05, Math.max(0, (v - lo) / Math.max(1, hi - lo)));
  const target = IDLE_RPM + f * (REDLINE_RPM - IDLE_RPM) * (0.55 + 0.45 * Math.max(throttle, v > 1 ? 0.2 : 0)) + (v < 1 ? throttle * 2600 : 0);
  car.rpm += (target - car.rpm) * damp(car.shiftTimer > 0 ? 18 : 10, dt);
  if (car.shiftTimer > 0) {
    car.shiftTimer -= dt;
    return SHIFT_DRIVE;
  }
  return 1;
}

const near: number[] = [];

export function stepVehicle(car: CarState, input: CarInput, track: Track, dt: number) {
  const spec = car.spec;
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  const rx = -fz;
  const rz = fx;
  let vLong = car.vx * fx + car.vz * fz;
  let vLat = car.vx * rx + car.vz * rz;
  const prevLong = vLong;

  const n = track.nearest(car.x, car.z, car.idx);
  car.idx = n.i;
  car.lat = n.lat;
  car.s = n.s;
  const absLat = Math.abs(n.lat);
  car.onRoad = absLat <= track.halfWidth + 0.6;
  const surf = car.onRoad ? track.def.grip : track.def.offGrip;
  const extraDrag = car.onRoad ? 0 : track.def.offDrag;

  // Steering wheel follows input smoothly.
  car.steer += (clamp(input.steer, -1, 1) - car.steer) * damp(STEER_RATE, dt);

  // Engine and brakes.
  const ratio = vLong / spec.topSpeed;
  const drive = stepGearbox(car, vLong, input.throttle, dt);
  if (input.throttle > 0 && vLong > -1) {
    vLong += spec.accel * drive * input.throttle * Math.max(0, 1 - Math.max(0, ratio) ** 2) * dt;
  }
  if (input.brake > 0) {
    if (vLong > 0.5) vLong = Math.max(0, vLong - spec.brake * input.brake * dt);
    else if (vLong > -REVERSE_TOP) vLong -= REVERSE_ACCEL * input.brake * dt;
  }
  if (input.throttle > 0 && vLong < -0.5) vLong = Math.min(0, vLong + spec.brake * input.throttle * dt);
  if (input.handbrake) vLong -= Math.sign(vLong) * Math.min(Math.abs(vLong), HANDBRAKE_DECEL * dt);
  if (input.throttle === 0 && input.brake === 0) {
    vLong -= Math.sign(vLong) * Math.min(Math.abs(vLong), COAST_DECEL * dt);
  }
  vLong *= Math.exp(-(ROLL_DRAG + extraDrag) * dt);

  // Steering: bicycle model with speed-sensitive lock.
  const speedAbs = Math.abs(vLong);
  car.steerAngle = (car.steer * MAX_STEER) / (1 + speedAbs * STEER_FALLOFF);
  // Weight transfer: braking loads the front tyres (sharper turn-in), hard throttle unloads them.
  const transfer = 1 + clamp(-car.lastAccel * WEIGHT_TRANSFER, -0.1, 0.18);
  let yawRate = -((vLong * Math.tan(car.steerAngle)) / WHEELBASE) * spec.turn * transfer;
  if (input.handbrake && speedAbs > 6) yawRate -= car.steer * HANDBRAKE_YAW;
  // Sliding (big slip) adds a little rotation, lets drifts hold.
  yawRate -= Math.sign(vLong) * clamp(vLat * 0.02, -0.4, 0.4) * (input.throttle * 0.5);
  car.yawRate = yawRate;

  // Lateral grip.
  let grip = BASE_GRIP * spec.grip * surf;
  if (input.handbrake) grip *= HANDBRAKE_GRIP;
  vLat *= Math.exp(-grip * dt);
  vLong -= Math.sign(vLong) * Math.min(Math.abs(vLong), Math.abs(vLat) * SLIDE_DRAG * dt * 3);

  // Recompose on the old axes, then rotate the heading: next step sees the slip.
  car.vx = fx * vLong + rx * vLat;
  car.vz = fz * vLong + rz * vLat;
  car.yaw += yawRate * dt;
  car.x += car.vx * dt;
  car.z += car.vz * dt;

  car.speed = vLong;
  const planar = Math.hypot(car.vx, car.vz);
  car.slip = planar > 4 ? Math.atan2(vLat, Math.abs(vLong) + 0.01) : 0;

  // Collisions with scenery.
  sceneryNear(track, car.x, car.z, near);
  for (const i of near) {
    const o = track.scenery[i];
    const dx = car.x - o.x;
    const dz = car.z - o.z;
    const min = o.radius + CAR_RADIUS;
    const d2 = dx * dx + dz * dz;
    if (d2 < min * min) {
      const d = Math.sqrt(d2) || 0.001;
      const nx = dx / d;
      const nz = dz / d;
      car.x = o.x + nx * min;
      car.z = o.z + nz * min;
      const vn = car.vx * nx + car.vz * nz;
      if (vn < 0) {
        car.vx -= vn * nx * 1.3;
        car.vz -= vn * nz * 1.3;
        car.vx *= 0.7;
        car.vz *= 0.7;
        car.impact = Math.max(car.impact, -vn);
      }
    }
  }

  // Invisible boundary well off the road.
  const limit = track.halfWidth + BOUNDARY;
  const n2 = track.nearest(car.x, car.z, car.idx);
  if (Math.abs(n2.lat) > limit) {
    const smp = track.samples[n2.i];
    const side = Math.sign(n2.lat);
    const push = Math.abs(n2.lat) - limit;
    car.x -= smp.rx * side * push;
    car.z -= smp.rz * side * push;
    const vOut = (car.vx * smp.rx + car.vz * smp.rz) * side;
    if (vOut > 0) {
      car.vx -= smp.rx * side * vOut * 1.2;
      car.vz -= smp.rz * side * vOut * 1.2;
      car.impact = Math.max(car.impact, vOut);
    }
  }

  // Height, slope and suspension.
  const groundY = track.heightAt(car.x, car.z, car.idx);
  const fy = track.heightAt(car.x + fx * 1.6, car.z + fz * 1.6, car.idx);
  const by = track.heightAt(car.x - fx * 1.6, car.z - fz * 1.6, car.idx);
  const ry = track.heightAt(car.x + rx * 0.9, car.z + rz * 0.9, car.idx);
  const ly = track.heightAt(car.x - rx * 0.9, car.z - rz * 0.9, car.idx);
  const avg = (groundY * 2 + fy + by) / 4;
  // Light airtime over crests: keep vertical velocity, fall with gravity.
  car.vy -= 22 * dt;
  car.y += car.vy * dt;
  if (car.y <= avg) {
    if (car.vy < -3) car.bounceVel -= car.vy * 0.04;
    car.y = avg;
    const slopeV = ((fy - by) / 3.2) * vLong; // vertical speed following the slope
    car.vy = Math.max(slopeV, 0) * 0.6;
  }
  car.groundPitch += (-Math.atan2(fy - by, 3.2) - car.groundPitch) * damp(12, dt);
  car.groundRoll += (-Math.atan2(ry - ly, 1.8) - car.groundRoll) * damp(12, dt);

  const accelLong = (vLong - prevLong) / dt;
  car.lastAccel += (accelLong - car.lastAccel) * damp(10, dt);
  const aLatRight = vLong * -yawRate;
  const pitchTarget = clamp(car.lastAccel * 0.006, -0.08, 0.08);
  const rollTarget = clamp(-aLatRight * 0.0045, -0.09, 0.09);
  // Spring-damper for body motion.
  const K = 90, C = 11;
  car.pitchVel += (K * (pitchTarget - car.pitch) - C * car.pitchVel) * dt;
  car.pitch += car.pitchVel * dt;
  car.rollVel += (K * (rollTarget - car.roll) - C * car.rollVel) * dt;
  car.roll += car.rollVel * dt;
  const rough = car.onRoad ? 0.015 : 0.05;
  car.bounceVel += (-120 * car.bounce - 9 * car.bounceVel) * dt + (Math.random() - 0.5) * rough * speedAbs * dt * 6;
  car.bounce += car.bounceVel * dt;
  car.bounce = clamp(car.bounce, -0.12, 0.12);

  car.wheelSpin += (vLong / 0.45) * dt;
  car.impact *= Math.exp(-4 * dt);
}

/** Pairwise car contact: push apart and exchange normal velocity. */
export function collideCars(cars: CarState[]) {
  for (let i = 0; i < cars.length; i++) {
    for (let j = i + 1; j < cars.length; j++) {
      const a = cars[i];
      const b = cars[j];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const min = CAR_RADIUS * 2 * 0.95;
      const d2 = dx * dx + dz * dz;
      if (d2 >= min * min || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const nx = dx / d;
      const nz = dz / d;
      if (a.remote && b.remote) continue;
      // A remote car is positioned by its owner: treat it as immovable here.
      const ma = a.remote ? 1e6 : a.spec.mass;
      const mb = b.remote ? 1e6 : b.spec.mass;
      const overlap = min - d;
      a.x -= nx * overlap * (mb / (ma + mb));
      a.z -= nz * overlap * (mb / (ma + mb));
      b.x += nx * overlap * (ma / (ma + mb));
      b.z += nz * overlap * (ma / (ma + mb));
      const rel = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
      if (rel < 0) {
        const e = 0.25;
        const jImp = (-(1 + e) * rel) / (1 / ma + 1 / mb);
        a.vx -= (jImp / ma) * nx;
        a.vz -= (jImp / ma) * nz;
        b.vx += (jImp / mb) * nx;
        b.vz += (jImp / mb) * nz;
        a.impact = Math.max(a.impact, -rel * 0.5);
        b.impact = Math.max(b.impact, -rel * 0.5);
      }
    }
  }
}
