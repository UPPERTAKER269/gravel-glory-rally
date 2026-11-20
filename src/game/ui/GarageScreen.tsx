// Garage: pick, buy and preview cars on a turntable.
import { ContactShadows, Environment, Lightformer, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { Check, Coins, Lock, Wrench } from "lucide-react";
import { Suspense, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { applyCarLook } from "../scene/carPaint";
import { Effects } from "../scene/Effects";
import { CAR_MODEL_URL, CAR_SCALE } from "../scene/models";
import { CARS, carById, carStats, type CarSpec } from "../sim/cars";
import { MAX_UPGRADE_LEVEL, UPGRADE_INFO, UPGRADE_KINDS, levelsOf, upgradeCost, upgradedSpec } from "../sim/upgrades";
import { useGame } from "../store";
import { CoinBadge, RallyButton, ScreenShell, StatBar } from "./common";

function TurntableCar({ car }: { car: CarSpec }) {
  const { scene } = useGLTF(CAR_MODEL_URL[car.model]);
  const obj = useMemo(() => {
    const c = scene.clone(true);
    applyCarLook(c, { paint: car.paint });
    return c;
  }, [scene, car.paint]);
  return <primitive object={obj} scale={CAR_SCALE} />;
}

function Turntable({ car }: { car: CarSpec }) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: [4.5, 2.2, 5.5], fov: 35 }} gl={{ alpha: true }}>
      <hemisphereLight args={["#fff3dc", "#3a2c20", 0.9]} />
      <directionalLight position={[5, 8, 4]} intensity={2.2} />
      <Environment resolution={64}>
        <Lightformer intensity={2} position={[0, 6, 0]} rotation-x={Math.PI / 2} scale={[10, 10, 1]} />
        <Lightformer intensity={1.2} color="#ffb35c" position={[-5, 1, -1]} rotation-y={Math.PI / 2} scale={[20, 2, 1]} />
        <Lightformer intensity={0.8} color="#9cc4ff" position={[5, 1, 2]} rotation-y={-Math.PI / 2} scale={[20, 2, 1]} />
      </Environment>
      <Suspense fallback={null}>
        <group position={[0, -0.6, 0]}>
          <TurntableCar key={car.id} car={car} />
        </group>
      </Suspense>
      <ContactShadows position={[0, -0.6, 0]} opacity={0.7} scale={10} blur={2.4} far={3} />
      <Effects saturation={0.08} />
      <OrbitControls target={[0, 0.2, 0]} autoRotate autoRotateSpeed={1.4} enablePan={false} enableZoom={false} minPolarAngle={0.9} maxPolarAngle={1.45} />
    </Canvas>
  );
}

export default function GarageScreen() {
  const profile = useGame((s) => s.profile);
  const buyCar = useGame((s) => s.buyCar);
  const selectCar = useGame((s) => s.selectCar);
  const [viewId, setViewId] = useState(profile.selectedCar);
  const car = carById(viewId);
  const owned = profile.ownedCars.includes(car.id);
  const levels = levelsOf(profile.upgrades?.[car.id]);
  const tuned = upgradedSpec(car, owned ? levels : undefined);
  const stats = carStats(tuned);
  const buyUpgrade = useGame((s) => s.buyUpgrade);
  const selected = profile.selectedCar === car.id;

  return (
    <ScreenShell title="Garage" kicker={`${profile.ownedCars.length}/${CARS.length} cars owned`}>
      <div className="grid h-full gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex min-h-0 flex-col gap-4">
          <div className="relative h-56 min-h-0 border border-border bg-glass sm:h-72 lg:h-auto lg:flex-1">
            <Turntable car={car} />
            <div className="pointer-events-none absolute left-4 top-3">
              <div className="font-display text-xs font-bold uppercase tracking-[0.3em] text-primary">Class {car.className}</div>
              <div className="font-display text-3xl font-black uppercase italic leading-tight sm:text-4xl">{car.name}</div>
            </div>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {CARS.map((c) => {
              const own = profile.ownedCars.includes(c.id);
              return (
                <button
                  key={c.id}
                  onClick={() => setViewId(c.id)}
                  className={cn(
                    "min-w-32 flex-1 border-2 bg-glass px-3 py-2 text-left transition-colors",
                    c.id === viewId ? "border-primary" : "border-border hover:border-muted-foreground",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                    {c.className}
                    {profile.selectedCar === c.id ? <Check className="h-3.5 w-3.5 text-success" /> : !own && <Lock className="h-3.5 w-3.5" />}
                  </div>
                  <div className="truncate font-display text-lg font-bold uppercase">{c.name}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-4 border border-border bg-glass p-5">
          <p className="text-muted-foreground">{car.description}</p>
          <div className="space-y-3">
            <StatBar label="Top speed" value={stats.speed} />
            <StatBar label="Accel" value={stats.accel} />
            <StatBar label="Handling" value={stats.handling} />
            <StatBar label="Weight" value={stats.weight} />
          </div>
          <div className="text-sm text-muted-foreground">
            Top speed <span className="font-bold text-foreground tabular">{Math.round(tuned.topSpeed * 3.6)} km/h</span>
          </div>
          {owned && (
            <div className="border-t border-border pt-4">
              <div className="mb-1 flex items-center gap-2 font-display text-lg font-black uppercase italic"><Wrench className="h-4 w-4 text-primary" /> Upgrades</div>
              <p className="mb-3 flex items-center gap-1.5 text-xs text-muted-foreground"><Coins className="h-3.5 w-3.5 text-gold" /> Paid with coins you win in races. No real money.</p>
              <div className="space-y-2">
                {UPGRADE_KINDS.map((k) => {
                  const lvl = levels[k];
                  const maxed = lvl >= MAX_UPGRADE_LEVEL;
                  const price = upgradeCost(car, lvl + 1);
                  return (
                    <div key={k} className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-display text-sm font-bold uppercase tracking-wider">{UPGRADE_INFO[k].name}</span>
                          <span className="flex gap-0.5" aria-label={`Level ${lvl} of ${MAX_UPGRADE_LEVEL}`}>
                            {Array.from({ length: MAX_UPGRADE_LEVEL }, (_, i) => (
                              <span key={i} className={cn("h-2 w-4", i < lvl ? "bg-primary" : "bg-muted")} />
                            ))}
                          </span>
                        </div>
                        <div className="truncate text-xs text-muted-foreground">{UPGRADE_INFO[k].effect}</div>
                      </div>
                      <button
                        disabled={maxed || profile.coins < price}
                        onClick={() => buyUpgrade(car.id, k)}
                        aria-label={maxed ? `${UPGRADE_INFO[k].name} maxed` : `Upgrade ${UPGRADE_INFO[k].name} for ${price} coins`}
                        className="shrink-0 border border-border bg-glass px-3 py-1.5 font-display text-sm font-bold uppercase tabular transition-colors hover:border-primary hover:text-primary disabled:opacity-40 disabled:hover:border-border disabled:hover:text-foreground"
                      >
                        {maxed ? "Max" : <span className="inline-flex items-center gap-1 text-gold"><Coins className="h-3.5 w-3.5" />{price.toLocaleString("en-US")}</span>}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="mt-auto">
            {owned ? (
              <RallyButton className="w-full" disabled={selected} onClick={() => selectCar(car.id)}>
                {selected ? <><Check className="h-5 w-5" /> Selected</> : "Drive this car"}
              </RallyButton>
            ) : (
              <>
                <RallyButton variant="accent" className="w-full" disabled={profile.coins < car.price} onClick={() => buyCar(car.id, car.price)}>
                  <Lock className="h-5 w-5" /> Buy · {car.price.toLocaleString("en-US")}
                </RallyButton>
                {profile.coins < car.price && (
                  <p className="mt-2 text-center text-sm text-muted-foreground">
                    You need <CoinBadge amount={car.price - profile.coins} className="text-sm" /> more. Win races to earn coins.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </ScreenShell>
  );
}
