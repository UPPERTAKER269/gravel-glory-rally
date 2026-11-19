import { Flag, Globe, Settings, Trophy, Warehouse } from "lucide-react";
import { carById } from "../sim/cars";
import { useGame } from "../store";
import { CoinBadge } from "./common";

const ITEMS = [
  { id: "play", label: "Play", sub: "Quick race", icon: Flag },
  { id: "online", label: "Online", sub: "Race your friends", icon: Globe },
  { id: "career", label: "Career", sub: "Championship ladder", icon: Trophy },
  { id: "garage", label: "Garage", sub: "Cars & upgrades", icon: Warehouse },
  { id: "settings", label: "Settings", sub: "Camera, controls, graphics", icon: Settings },
] as const;

export function MainMenu() {
  const setScreen = useGame((s) => s.setScreen);
  const profile = useGame((s) => s.profile);
  const car = carById(profile.selectedCar);

  return (
    <div className="flex h-full flex-col justify-between px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1.5rem)] sm:px-12 lg:px-20">
      <div className="flex items-start justify-between">
        <div className="stripes h-2 w-24" />
        <div className="border border-border bg-glass px-4 py-2">
          <CoinBadge amount={profile.coins} className="text-lg" />
        </div>
      </div>

      <div className="max-w-xl">
        <div className="animate-rally-in font-display text-sm font-bold uppercase tracking-[0.4em] text-primary">Gravel · Sand · Snow</div>
        <h1 className="animate-rally-in mt-2 text-7xl font-black uppercase italic leading-[0.85] tracking-tight sm:text-8xl lg:text-9xl">
          Vuka
          <span className="text-primary">:</span>
          <br />
          <span className="text-5xl text-primary sm:text-6xl lg:text-7xl">Car Racing</span>
        </h1>

        <nav className="mt-8 flex flex-col gap-2 sm:mt-10">
          {ITEMS.map((it, i) => (
            <button
              key={it.id}
              onClick={() => setScreen(it.id)}
              style={{ animationDelay: `${80 + i * 60}ms` }}
              className="group animate-rally-in skew-rally flex w-full max-w-sm items-center gap-4 border-l-4 border-transparent bg-glass px-5 py-3 text-left transition-all hover:translate-x-2 hover:border-primary hover:bg-primary hover:text-primary-foreground"
            >
              <span className="unskew-rally flex items-center gap-4">
                <it.icon className="h-5 w-5 text-primary transition-colors group-hover:text-primary-foreground" />
                <span>
                  <span className="block font-display text-2xl font-black uppercase italic leading-none">{it.label}</span>
                  <span className="block text-xs text-muted-foreground transition-colors group-hover:text-primary-foreground">{it.sub}</span>
                </span>
              </span>
            </button>
          ))}
        </nav>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-4 text-sm text-muted-foreground">
        <div>
          <span className="font-display font-bold uppercase tracking-widest text-foreground">{car.name}</span> · {profile.racesRun} races · {profile.wins} wins
        </div>
        <div className="hidden sm:block">W A S D / arrows · Space handbrake · C camera · Esc pause · Controller supported</div>
      </div>
    </div>
  );
}
