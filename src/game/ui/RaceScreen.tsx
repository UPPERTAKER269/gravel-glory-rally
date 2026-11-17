// Race screen: owns the RaceState for one race, wires keyboard/touch into runtime,
// and draws the HUD on top of the 3D canvas. HUD refreshes ~15x/s from runtime, not per frame.
import { ArrowBigLeft, ArrowBigRight, Camera, Pause, Play, RotateCcw, Home } from "lucide-react";
import { useEffect, useMemo, useState, type PointerEvent as RPointerEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { runtime, type TouchState } from "../runtime";
import { RaceCanvas } from "../scene/RaceCanvas";
import { aiInput } from "../sim/ai";
import { FIXED_DT, createRace, playerPosition, simulate, standings, type RaceState } from "../sim/race";
import { useGame } from "../store";
import { RallyButton, formatTime, ordinal } from "./common";

const HUD_MS = 66;
const CONTROL_KEYS = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"]);

function useTick(ms: number) {
  const [, set] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => set((n) => n + 1), ms);
    return () => window.clearInterval(id);
  }, [ms]);
}

function useTouchEnabled() {
  const pref = useGame((s) => s.settings.touch);
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    setCoarse(mq.matches || navigator.maxTouchPoints > 0);
    const on = () => setCoarse(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return pref === "on" || (pref === "auto" && coarse);
}

export default function RaceScreen() {
  const config = useGame((s) => s.raceConfig);
  const quality = useGame((s) => s.settings.quality);
  const race = useMemo(() => (config ? createRace(config) : null), [config]);

  if (!race) return null;
  return <RaceView race={race} quality={quality} />;
}

function RaceView({ race, quality }: { race: RaceState; quality: "high" | "low" }) {
  const camera = useGame((s) => s.settings.camera);
  const updateSettings = useGame((s) => s.updateSettings);
  const paused = useGame((s) => s.paused);
  const setPaused = useGame((s) => s.setPaused);
  const touchOn = useTouchEnabled();

  // Register the race with the runtime for the stepper.
  runtime.race = race;
  runtime.camera = camera;

  useEffect(() => {
    runtime.race = race;
    const w = window as unknown as { __game?: unknown };
    if (import.meta.env.DEV) {
      w.__game = {
        get race() { return runtime.race; },
        // Fixed-step sim; autopilot drives the player with the AI.
        sim: (seconds: number, autopilot = false) =>
          runtime.race && simulate(runtime.race, seconds, autopilot ? (r) => aiInput(r.player, r.track, r.cars, FIXED_DT) : undefined),
        standings: () => runtime.race && standings(runtime.race).map((c) => c.name),
      };
    }
    return () => {
      if (runtime.race === race) runtime.race = null;
      runtime.keys.clear();
      Object.assign(runtime.touch, { left: false, right: false, gas: false, brake: false, handbrake: false });
    };
  }, [race]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (CONTROL_KEYS.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (e.code === "Escape" || e.code === "KeyP") {
        const s = useGame.getState();
        s.setPaused(!s.paused);
        return;
      }
      if (e.code === "KeyC") {
        const s = useGame.getState();
        s.updateSettings({ camera: s.settings.camera === "chase" ? "cockpit" : "chase" });
        return;
      }
      runtime.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => runtime.keys.delete(e.code);
    const blur = () => runtime.keys.clear();
    const vis = () => {
      if (document.hidden && runtime.race?.phase !== "finished") useGame.getState().setPaused(true);
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    document.addEventListener("visibilitychange", vis);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);

  const toggleCamera = () => updateSettings({ camera: camera === "chase" ? "cockpit" : "chase" });

  return (
    <>
      <RaceCanvas race={race} quality={quality} />
      <Hud race={race} onCamera={toggleCamera} onPause={() => setPaused(true)} />
      {touchOn && !paused && <TouchControls />}
      {paused && <PauseMenu onCamera={toggleCamera} camera={camera} />}
    </>
  );
}

/* ---------------- HUD ---------------- */

function Hud({ race, onCamera, onPause }: { race: RaceState; onCamera: () => void; onPause: () => void }) {
  useTick(HUD_MS);
  const units = useGame((s) => s.settings.units);
  const p = race.player;
  const pos = playerPosition(race);
  const laps = race.config.laps;
  const lap = Math.max(1, Math.min(laps, p.lap + 1));
  const lapTime = race.phase === "countdown" ? 0 : race.time - p.lapStart;
  const speed = Math.abs(p.speed) * (units === "kmh" ? 3.6 : 2.237);

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none text-foreground">
      {/* Top left: position + lap */}
      <div className="absolute left-3 top-[max(env(safe-area-inset-top),0.75rem)] flex items-stretch gap-2 sm:left-5">
        <div className="skew-rally bg-primary px-3 py-1 text-primary-foreground shadow-panel sm:px-4">
          <div className="unskew-rally text-center">
            <div className="font-display text-[10px] font-bold uppercase tracking-[0.25em] opacity-80">Pos</div>
            <div className="font-display text-3xl font-black italic leading-none tabular sm:text-4xl">
              {pos}<span className="text-lg opacity-70">/{race.cars.length}</span>
            </div>
          </div>
        </div>
        <div className="skew-rally bg-scrim px-3 py-1 shadow-panel backdrop-blur-sm sm:px-4">
          <div className="unskew-rally text-center">
            <div className="font-display text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">Lap</div>
            <div className="font-display text-3xl font-black italic leading-none tabular sm:text-4xl">
              {lap}<span className="text-lg text-muted-foreground">/{laps}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Top centre: timer */}
      <div className="absolute left-1/2 top-[max(env(safe-area-inset-top),0.75rem)] -translate-x-1/2 bg-scrim px-4 py-1.5 text-center shadow-panel backdrop-blur-sm">
        <div className="font-display text-2xl font-bold leading-none tabular sm:text-3xl">{formatTime(race.time || 0.0001).replace("--:--.--", "0:00.00")}</div>
        <div className="mt-0.5 font-display text-[11px] font-bold uppercase tracking-widest text-muted-foreground tabular">
          Lap {formatTime(lapTime)} · Best {formatTime(p.bestLap)}
        </div>
      </div>

      {/* Top right: minimap + buttons */}
      <div className="absolute right-3 top-[max(env(safe-area-inset-top),0.75rem)] flex flex-col items-end gap-2 sm:right-5">
        <div className="pointer-events-auto flex gap-2">
          <HudButton label="Switch camera (C)" onClick={onCamera}><Camera className="h-5 w-5" /></HudButton>
          <HudButton label="Pause (Esc)" onClick={onPause}><Pause className="h-5 w-5" /></HudButton>
        </div>
        <Minimap race={race} />
      </div>

      {/* Bottom centre: speedometer */}
      <div className="absolute bottom-[max(env(safe-area-inset-bottom),0.75rem)] left-1/2 -translate-x-1/2">
        <Speedo speed={speed} max={units === "kmh" ? 200 : 125} unit={units === "kmh" ? "km/h" : "mph"} reverse={p.speed < -0.5} />
      </div>

      <Countdown race={race} />
      {race.phase === "finished" && <FinishBanner pos={playerPosition(race)} />}
      {!p.onRoad && race.phase === "racing" && Math.abs(p.lat) > race.track.halfWidth + 6 && (
        <div className="absolute left-1/2 top-[30%] -translate-x-1/2 bg-accent px-4 py-1 font-display text-lg font-bold uppercase tracking-widest text-accent-foreground">
          Back to the road
        </div>
      )}
    </div>
  );
}

function HudButton({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button aria-label={label} title={label} onClick={onClick} className="flex h-10 w-10 items-center justify-center border border-border bg-scrim text-foreground backdrop-blur-sm transition-colors hover:border-primary hover:text-primary">
      {children}
    </button>
  );
}

function Speedo({ speed, max, unit, reverse }: { speed: number; max: number; unit: string; reverse: boolean }) {
  const frac = Math.min(1, speed / max);
  const R = 52;
  const start = Math.PI * 0.8;
  const sweep = Math.PI * 1.4;
  const arc = (f: number) => {
    const a0 = start, a1 = start + sweep * f;
    const x0 = 60 + R * Math.cos(a0), y0 = 60 + R * Math.sin(a0);
    const x1 = 60 + R * Math.cos(a1), y1 = 60 + R * Math.sin(a1);
    return `M ${x0} ${y0} A ${R} ${R} 0 ${sweep * f > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
  };
  return (
    <div className="relative h-28 w-36 sm:h-32 sm:w-40">
      <div className="absolute left-1/2 top-[8%] aspect-square h-[84%] -translate-x-1/2 rounded-full bg-scrim backdrop-blur-sm" />
      <svg viewBox="0 0 120 105" className="absolute inset-0 h-full w-full drop-shadow-lg">
        <path d={arc(1)} fill="none" className="stroke-scrim-strong" strokeWidth={10} />
        {frac > 0.005 && <path d={arc(frac)} fill="none" className={frac > 0.85 ? "stroke-accent" : "stroke-primary"} strokeWidth={10} />}
      </svg>
      <div className="absolute inset-x-0 top-[34%] text-center">
        <div className="font-display text-4xl font-black italic leading-none tabular sm:text-5xl">{Math.round(speed)}</div>
        <div className="font-display text-xs font-bold uppercase tracking-[0.25em] text-muted-foreground">{reverse ? "Reverse" : unit}</div>
      </div>
    </div>
  );
}

function Minimap({ race }: { race: RaceState }) {
  const t = race.track;
  const { path, view } = useMemo(() => {
    const b = t.bounds;
    const pad = 12;
    const step = Math.max(1, Math.floor(t.samples.length / 220));
    let d = "";
    for (let i = 0; i < t.samples.length; i += step) {
      const s = t.samples[i];
      d += `${i === 0 ? "M" : "L"}${s.x.toFixed(1)} ${s.z.toFixed(1)} `;
    }
    d += "Z";
    return { path: d, view: `${b.minX - pad} ${b.minZ - pad} ${b.maxX - b.minX + pad * 2} ${b.maxZ - b.minZ + pad * 2}` };
  }, [t]);
  const start = t.samples[0];
  const span = Math.max(t.bounds.maxX - t.bounds.minX, t.bounds.maxZ - t.bounds.minZ);
  const dot = span / 38;
  return (
    <div className="h-28 w-28 border border-border bg-scrim p-1.5 shadow-panel backdrop-blur-sm sm:h-36 sm:w-36" aria-label="Minimap">
      <svg viewBox={view} className="h-full w-full">
        <path d={path} fill="none" className="stroke-muted-foreground/60" strokeWidth={span / 22} strokeLinejoin="round" />
        <path d={path} fill="none" className="stroke-foreground/80" strokeWidth={span / 70} strokeLinejoin="round" />
        {start && <circle cx={start.x} cy={start.z} r={dot * 0.8} className="fill-success" />}
        {race.cars.filter((c) => !c.isPlayer).map((c) => (
          <circle key={c.id} cx={c.x} cy={c.z} r={dot} className="fill-accent stroke-background" strokeWidth={dot * 0.3} />
        ))}
        <circle cx={race.player.x} cy={race.player.z} r={dot * 1.35} className="fill-primary stroke-background" strokeWidth={dot * 0.35} />
      </svg>
    </div>
  );
}

function Countdown({ race }: { race: RaceState }) {
  let label: string | null = null;
  if (race.phase === "countdown") {
    const n = Math.ceil(race.countdown);
    label = n > 3 ? "Ready" : String(n);
  } else if (race.phase === "racing" && race.time < 1) label = "Go!";
  if (!label) return null;
  const go = label === "Go!";
  return (
    <div className="absolute inset-x-0 top-[22%] flex justify-center">
      <div key={label} className={cn("animate-count-pop font-display text-7xl font-black uppercase italic drop-shadow-2xl sm:text-9xl", go ? "text-success" : "text-primary")}>
        {label}
      </div>
    </div>
  );
}

function FinishBanner({ pos }: { pos: number }) {
  return (
    <div className="absolute inset-x-0 top-[24%] flex justify-center">
      <div className="animate-rally-in skew-rally bg-scrim-strong px-10 py-4 text-center shadow-panel">
        <div className="unskew-rally">
          <div className="stripes mx-auto mb-2 h-1.5 w-32" />
          <div className="font-display text-sm font-bold uppercase tracking-[0.4em] text-muted-foreground">Finished</div>
          <div className="font-display text-6xl font-black uppercase italic text-primary">{ordinal(pos)}</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Touch ---------------- */

function TouchPad({ k, className, children, label }: { k: keyof TouchState; className?: string; children: ReactNode; label: string }) {
  const [on, setOn] = useState(false);
  const set = (v: boolean) => (e: RPointerEvent) => {
    e.preventDefault();
    if (v) (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    runtime.touch[k] = v;
    setOn(v);
  };
  return (
    <button
      aria-label={label}
      onPointerDown={set(true)}
      onPointerUp={set(false)}
      onPointerCancel={set(false)}
      onLostPointerCapture={set(false)}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        "pointer-events-auto flex touch-none select-none items-center justify-center border-2 font-display font-black uppercase tracking-wider backdrop-blur-sm transition-colors",
        on ? "border-primary bg-primary/70 text-primary-foreground" : "border-border bg-scrim text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

function TouchControls() {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-end justify-between gap-4 px-[max(env(safe-area-inset-left),0.75rem)] pb-[max(env(safe-area-inset-bottom),0.75rem)]">
      <div className="flex gap-3">
        <TouchPad k="left" label="Steer left" className="h-20 w-20 rounded-full sm:h-24 sm:w-24"><ArrowBigLeft className="h-10 w-10" /></TouchPad>
        <TouchPad k="right" label="Steer right" className="h-20 w-20 rounded-full sm:h-24 sm:w-24"><ArrowBigRight className="h-10 w-10" /></TouchPad>
      </div>
      <div className="flex items-end gap-3 pr-[max(env(safe-area-inset-right),0px)]">
        <div className="flex flex-col gap-3">
          <TouchPad k="handbrake" label="Handbrake" className="h-12 w-20 text-xs">Hand</TouchPad>
          <TouchPad k="brake" label="Brake" className="h-20 w-20 text-sm">Brake</TouchPad>
        </div>
        <TouchPad k="gas" label="Accelerate" className="h-32 w-20 text-sm sm:h-36 sm:w-24">Gas</TouchPad>
      </div>
    </div>
  );
}

/* ---------------- Pause ---------------- */

function PauseMenu({ onCamera, camera }: { onCamera: () => void; camera: string }) {
  const setPaused = useGame((s) => s.setPaused);
  const restart = useGame((s) => s.restartRace);
  const setScreen = useGame((s) => s.setScreen);
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-scrim backdrop-blur-sm">
      <div className="animate-rally-in w-72 space-y-3 border border-border bg-card p-6 shadow-panel">
        <div className="stripes h-1.5 w-24" />
        <h2 className="text-4xl font-black uppercase italic">Paused</h2>
        <RallyButton className="w-full" onClick={() => setPaused(false)} autoFocus><Play className="h-5 w-5" /> Resume</RallyButton>
        <RallyButton variant="outline" className="w-full" onClick={onCamera}><Camera className="h-5 w-5" /> {camera === "chase" ? "Chase cam" : "Cockpit cam"}</RallyButton>
        <RallyButton variant="outline" className="w-full" onClick={restart}><RotateCcw className="h-5 w-5" /> Restart</RallyButton>
        <RallyButton variant="ghost" className="w-full" onClick={() => setScreen("menu")}><Home className="h-5 w-5" /> Quit to menu</RallyButton>
        <p className="pt-1 text-xs text-muted-foreground">W/S or arrows: gas & brake · A/D: steer · Space: handbrake · C: camera</p>
      </div>
    </div>
  );
}
