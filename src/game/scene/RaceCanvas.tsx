// The race scene. Mounted once per race; all motion happens in <Stepper>.
import { Environment, Lightformer, Sky, useGLTF, Clone } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { runtime } from "../runtime";
import type { RaceState } from "../sim/race";
import { CarModel } from "./CarModel";
import { DustSystem } from "./dust";
import { ENV_STYLE } from "./envStyle";
import { CONE_URL } from "./models";
import { Scenery } from "./Scenery";
import { Stepper } from "./Stepper";
import { TrackMesh } from "./TrackMesh";

function Cones({ race }: { race: RaceState }) {
  const { scene } = useGLTF(CONE_URL);
  const t = race.track;
  const spots = useMemo(() => {
    const out: [number, number, number][] = [];
    for (let k = 1; k <= 6; k++) {
      const smp = t.sampleAt(k * 7);
      for (const side of [-1, 1]) {
        const off = (t.halfWidth + 1.2) * side;
        out.push([smp.x + smp.rx * off, smp.y - 0.05, smp.z + smp.rz * off]);
      }
    }
    return out;
  }, [t]);
  return (
    <>
      {spots.map((p, i) => (
        <Clone key={i} object={scene} position={p} scale={1.6} />
      ))}
    </>
  );
}

export function RaceCanvas({ race, quality }: { race: RaceState; quality: "high" | "low" }) {
  const style = ENV_STYLE[race.track.def.environment];
  const dust = useMemo(() => new DustSystem(style.dust), [style.dust]);
  const [sun, setSun] = useState<THREE.DirectionalLight | null>(null);
  const [wrapper, setWrapper] = useState<HTMLDivElement | null>(null);
  const shadows = quality === "high";
  useEffect(() => () => dust.dispose(), [dust]);

  const sunOffset = useMemo(() => new THREE.Vector3(...style.sun).normalize().multiplyScalar(80), [style.sun]);

  return (
    <div ref={setWrapper} className="absolute inset-0" id="race-wrapper">
      <Canvas
        shadows={shadows}
        dpr={quality === "high" ? [1, 1.75] : 1}
        gl={{ antialias: quality === "high", powerPreference: "high-performance" }}
        camera={{ fov: 62, near: 0.2, far: 1400, position: [0, 5, -10] }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = style.exposure;
        }}
      >
        <fog attach="fog" args={[style.fog, style.fogNear, style.fogFar]} />
        <Sky sunPosition={style.sun} turbidity={style.turbidity} rayleigh={style.rayleigh} mieCoefficient={0.006} mieDirectionalG={0.85} distance={4000} />
        <hemisphereLight args={[style.hemiSky, style.hemiGround, style.hemiIntensity]} />
        <directionalLight
          ref={(l) => {
            if (l && l !== sun) {
              l.userData.offset = sunOffset;
              setSun(l);
            }
          }}
          color={style.sunColor}
          intensity={style.sunIntensity}
          castShadow={shadows}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-55}
          shadow-camera-right={55}
          shadow-camera-top={55}
          shadow-camera-bottom={-55}
          shadow-camera-near={1}
          shadow-camera-far={220}
          shadow-bias={-0.0004}
          shadow-normalBias={0.04}
        />
        <Environment resolution={64}>
          <Lightformer intensity={1.6} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[12, 12, 1]} color={style.hemiSky} />
          <Lightformer intensity={0.8} position={[-6, 1, -2]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} color={style.sunColor} />
          <Lightformer intensity={0.5} position={[6, 1, 2]} rotation-y={-Math.PI / 2} scale={[20, 2, 1]} color={style.fog} />
        </Environment>

        <TrackMesh track={race.track} quality={quality} />
        <primitive object={dust.points} />

        <Suspense fallback={null}>
          <Scenery track={race.track} shadows={shadows} />
        </Suspense>
        <Suspense fallback={null}>
          <Cones race={race} />
        </Suspense>
        {race.cars.map((c) => (
          <Suspense key={c.id} fallback={null}>
            <CarModel carId={c.id} model={c.spec.model} shadows={shadows} />
          </Suspense>
        ))}
        <Stepper dust={dust} sun={sun} wrapper={wrapper} />
      </Canvas>
    </div>
  );
}

export { runtime };
