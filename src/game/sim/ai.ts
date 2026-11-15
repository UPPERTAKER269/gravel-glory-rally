// AI driver: follows the centerline with a personal lane offset, brakes for
// upcoming curvature, steers around cars just ahead and reverses when stuck.
import { clamp, wrapAngle } from "./math";
import { SAMPLE_SPACING, type Track } from "./track";
import type { CarInput, CarState } from "./vehicle";

export const AI_LAT_ACCEL = 15; // m/s^2 cornering budget at skill 1, scaled by grip
export const AI_LOOKAHEAD = 9; // m
export const AI_LOOKAHEAD_PER_SPEED = 0.5; // s

export function aiInput(car: CarState, track: Track, cars: CarState[], dt: number): CarInput {
  const m = track.samples.length;
  const speed = Math.abs(car.speed);

  // Recovery when stuck against something.
  if (car.reverseTime > 0) {
    car.reverseTime -= dt;
    return { throttle: 0, brake: 1, steer: -Math.sign(car.lat || 1), handbrake: false };
  }
  if (speed < 1.5) car.stuckTime += dt;
  else car.stuckTime = 0;
  if (car.stuckTime > 1.8) {
    car.stuckTime = 0;
    car.reverseTime = 1.3;
  }

  const look = AI_LOOKAHEAD + speed * AI_LOOKAHEAD_PER_SPEED;
  const j = (car.idx + Math.round(look / SAMPLE_SPACING)) % m;
  const t = track.samples[j];

  // Avoid the car directly ahead by shifting lane.
  let lane = car.aiLane;
  const fx = Math.sin(car.yaw);
  const fz = Math.cos(car.yaw);
  for (const o of cars) {
    if (o === car) continue;
    const dx = o.x - car.x;
    const dz = o.z - car.z;
    const ahead = dx * fx + dz * fz;
    const side = dx * -fz + dz * fx;
    if (ahead > 0 && ahead < 14 && Math.abs(side) < 3) {
      lane += side > 0 ? -2.6 : 2.6;
      break;
    }
  }
  lane = clamp(lane, -track.halfWidth + 1.8, track.halfWidth - 1.8);

  const tx = t.x + t.rx * lane;
  const tz = t.z + t.rz * lane;
  const desired = Math.atan2(tx - car.x, tz - car.z);
  // Positive error = target is to the right (yaw must decrease).
  const err = wrapAngle(car.yaw - desired);
  const steer = clamp(err * 2.6, -1, 1);

  // Speed target from the tightest curve in the braking zone.
  const span = Math.round((18 + speed * 1.6) / SAMPLE_SPACING);
  let maxCurv = 0;
  for (let k = 0; k < span; k++) maxCurv = Math.max(maxCurv, track.samples[(car.idx + k) % m].curv);
  const latBudget = AI_LAT_ACCEL * car.aiSkill * track.def.grip * car.spec.grip;
  const cornerSpeed = Math.sqrt(latBudget / Math.max(maxCurv, 1e-4));
  let target = Math.min(car.spec.topSpeed * (0.9 + 0.1 * car.aiSkill), cornerSpeed);
  if (!car.onRoad) target = Math.min(target, 18);

  let throttle = 0;
  let brake = 0;
  if (speed < target - 0.5) throttle = 1;
  else if (speed > target + 1.5) brake = clamp((speed - target) / 6, 0.25, 1);
  // Ease off when pointing well away from the target.
  if (Math.abs(err) > 0.6 && speed > 12) { throttle = 0.3; }
  return { throttle, brake, steer, handbrake: false };
}
