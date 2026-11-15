// Draws one car from its GLB and registers its nodes so the stepper can pose it.
import { useGLTF } from "@react-three/drei";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import type { CarSpec } from "../sim/cars";
import { CAR_MODEL_URL, CAR_SCALE } from "./models";

export interface CarNodes {
  root: THREE.Group;
  body: THREE.Object3D | null;
  bodyY: number;
  wheels: { obj: THREE.Object3D; front: boolean }[];
}

export const carNodes = new Map<number, CarNodes>();

export function CarModel({ carId, model, shadows }: { carId: number; model: CarSpec["model"]; shadows: boolean }) {
  const { scene } = useGLTF(CAR_MODEL_URL[model]);
  const cloned = useMemo(() => skeletonClone(scene), [scene]);
  const root = useRef<THREE.Group>(null);

  useLayoutEffect(() => {
    if (!root.current) return;
    let body: THREE.Object3D | null = null;
    const wheels: CarNodes["wheels"] = [];
    cloned.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) {
        mesh.castShadow = shadows;
        mesh.receiveShadow = true;
      }
      if (o.name === "body") body = o;
      if (o.name.startsWith("wheel-") && o.name !== "wheel-back") {
        o.rotation.order = "YXZ";
        wheels.push({ obj: o, front: o.name.includes("front") });
      }
    });
    const b = body as THREE.Object3D | null;
    carNodes.set(carId, { root: root.current, body: b, bodyY: b ? b.position.y : 0, wheels });
    return () => {
      carNodes.delete(carId);
    };
  }, [cloned, carId, shadows]);

  return (
    <group ref={root}>
      <group scale={CAR_SCALE}>
        <primitive object={cloned} />
      </group>
    </group>
  );
}

Object.values(CAR_MODEL_URL).forEach((u) => useGLTF.preload(u));
