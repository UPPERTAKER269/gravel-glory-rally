// The one per-frame loop: input -> race sim -> car poses -> dust -> camera -> finish.
import { useFrame, useThree } from "@react-three/fiber";
import { useRef } from "react";
import * as THREE from "three";
import { gamepadInput, keyboardInput, mergeInputs, touchInput } from "../input";
import { runtime } from "../runtime";
import { damp } from "../sim/math";
import { raceResults, stepRace, type RaceState } from "../sim/race";
import { raceReward, CAREER } from "../sim/progression";
import { trackById } from "../sim/tracks";
import { useGame } from "../store";
import { carNodes } from "./CarModel";
import type { DustSystem } from "./dust";

const camPos = new THREE.Vector3();
const camLook = new THREE.Vector3();
const tmp = new THREE.Vector3();
const tmp2 = new THREE.Vector3();

function readPad() {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return null;
  const pads = navigator.getGamepads();
  if (runtime.gamepadIndex >= 0) return pads[runtime.gamepadIndex] ?? null;
  for (const p of pads) if (p) { runtime.gamepadIndex = p.index; return p; }
  return null;
}

function poseCars(race: RaceState) {
  for (const car of race.cars) {
    const n = carNodes.get(car.id);
    if (!n) continue;
    n.root.position.set(car.x, car.y, car.z);
    n.root.rotation.order = "YXZ";
    n.root.rotation.set(car.groundPitch, car.yaw, car.groundRoll);
    if (n.body) {
      n.body.rotation.x = car.pitch;
      n.body.rotation.z = car.roll;
      n.body.position.y = n.bodyY + car.bounce;
    }
    for (const w of n.wheels) {
      w.obj.rotation.x = car.wheelSpin;
      w.obj.rotation.y = w.front ? -car.steerAngle * 1.6 : 0;
    }
  }
}

export function Stepper({ dust, sun, wrapper }: { dust: DustSystem; sun: THREE.DirectionalLight | null; wrapper: HTMLElement | null }) {
  const { camera, size } = useThree();
  const camYaw = useRef<number | null>(null);
  const finishTimer = useRef(0);
  const reported = useRef(false);
  const ready = useRef(false);

  useFrame((_, rawDelta) => {
    const race = runtime.race;
    if (!race) return;
    const delta = Math.min(rawDelta, 0.05);
    const paused = useGame.getState().paused;

    if (!paused) {
      const input = mergeInputs(keyboardInput(runtime.keys), touchInput(runtime.touch), gamepadInput(readPad()));
      stepRace(race, input, delta);
    }
    poseCars(race);

    // Dust from the rear wheels.
    if (!paused) {
      for (const car of race.cars) {
        const sp = Math.hypot(car.vx, car.vz);
        if (sp < 5) continue;
        const rate = (sp / 45) * 0.9 + Math.abs(car.slip) * 1.5 + (car.onRoad ? 0 : 0.4);
        if (Math.random() < rate) {
          const fx = Math.sin(car.yaw), fz = Math.cos(car.yaw);
          const side = Math.random() < 0.5 ? -0.8 : 0.8;
          dust.emit(car.x - fx * 1.6 - fz * side, car.y, car.z - fz * 1.6 + fx * side, -car.vx, -car.vz, Math.min(1.5, sp / 30 + Math.abs(car.slip)));
        }
      }
      dust.update(delta);
    }
    dust.material.uniforms.uScale.value = size.height * 0.55;

    // Camera.
    const p = race.player;
    const cam = camera as THREE.PerspectiveCamera;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    if (runtime.camera === "cockpit") {
      const n = carNodes.get(p.id);
      if (n) {
        n.root.updateMatrixWorld(true);
        const base = n.body ?? n.root;
        tmp.set(0, 0.62, 0.05).applyMatrix4(base.matrixWorld);
        tmp2.set(0, 0.55, 8).applyMatrix4(base.matrixWorld);
        cam.position.copy(tmp);
        cam.lookAt(tmp2);
      }
      camYaw.current = null;
    } else {
      // Heading blends toward the direction of travel, so drifts read as drifts.
      const sp = Math.hypot(p.vx, p.vz);
      let target = p.yaw;
      if (sp > 6 && p.speed > 0) {
        const vy = Math.atan2(p.vx, p.vz);
        let d = vy - p.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        target = p.yaw + d * 0.45;
      }
      if (camYaw.current === null) camYaw.current = target;
      let dy = target - camYaw.current;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      camYaw.current += dy * damp(4.5, delta);
      const cx = Math.sin(camYaw.current), cz = Math.cos(camYaw.current);
      const dist = 7.2 + Math.min(1.5, sp * 0.03);
      camPos.set(p.x - cx * dist, p.y + 2.9, p.z - cz * dist);
      const ground = race.track.heightAt(camPos.x, camPos.z, p.idx) + 1.2;
      if (camPos.y < ground) camPos.y = ground;
      const first = cam.userData.init !== true;
      cam.position.lerp(camPos, first ? 1 : damp(9, delta));
      camLook.set(p.x + fx * 4, p.y + 1.2, p.z + fz * 4);
      cam.lookAt(camLook);
      cam.userData.init = true;
      // Collision shake.
      if (p.impact > 2) cam.position.y += (Math.random() - 0.5) * Math.min(0.4, p.impact * 0.03);
    }
    const fov = 62 + Math.min(14, Math.max(0, p.speed) * 0.28);
    if (Math.abs(cam.fov - fov) > 0.05) {
      cam.fov += (fov - cam.fov) * damp(3, delta);
      cam.updateProjectionMatrix();
    }

    if (sun) {
      sun.target.position.set(p.x, p.y, p.z);
      sun.target.updateMatrixWorld();
      sun.position.copy(sun.target.position).add(sun.userData.offset as THREE.Vector3);
    }

    if (!ready.current && carNodes.has(p.id) && wrapper) {
      ready.current = true;
      wrapper.dataset.sceneReady = "1";
    }

    // Finish -> results, once.
    if (race.phase === "finished" && !reported.current) {
      finishTimer.current += delta;
      if (finishTimer.current > 2.5) {
        reported.current = true;
        reportResult(race);
      }
    }
  });
  return null;
}

function reportResult(race: RaceState) {
  const rows = raceResults(race);
  const me = rows.find((r) => r.isPlayer)!;
  const def = trackById(race.config.trackId);
  const career = !!race.config.careerEventId;
  const coins = raceReward(me.position, def.rewardMult, race.config.laps, career);
  const store = useGame.getState();
  let bonus = 0;
  let unlockedTrack: string | undefined;
  if (career && me.position <= 3) {
    const prev = store.profile.careerBest[race.config.careerEventId!];
    if (prev === undefined || prev > 3) bonus = 400;
    if (!store.profile.unlockedTracks.includes(def.id)) unlockedTrack = def.id;
  }
  void CAREER;
  store.finishRace({ config: race.config, rows, coins, bonus, unlockedTrack });
}
