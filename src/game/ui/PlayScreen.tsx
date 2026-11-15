import { Lock } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { carById } from "../sim/cars";
import { TRACKS } from "../sim/tracks";
import { useGame } from "../store";
import { CoinBadge, RallyButton, ScreenShell, Segmented } from "./common";
import { TRACK_ART } from "./trackArt";

const ENV_LABEL = { forest: "Gravel", canyon: "Dirt", snow: "Snow & ice" } as const;

export function PlayScreen() {
  const profile = useGame((s) => s.profile);
  const settings = useGame((s) => s.settings);
  const startRace = useGame((s) => s.startRace);
  const buyTrack = useGame((s) => s.buyTrack);
  const [trackId, setTrackId] = useState(profile.unlockedTracks[0] ?? "pinewood");
  const [laps, setLaps] = useState(2);
  const [opponents, setOpponents] = useState(5);
  const unlocked = profile.unlockedTracks.includes(trackId);
  const track = TRACKS.find((t) => t.id === trackId)!;

  return (
    <ScreenShell title="Quick Race" kicker="Play">
      <div className="grid gap-4 md:grid-cols-3">
        {TRACKS.map((t) => {
          const open = profile.unlockedTracks.includes(t.id);
          return (
            <button
              key={t.id}
              onClick={() => setTrackId(t.id)}
              className={cn(
                "group relative overflow-hidden border-2 text-left transition-all",
                t.id === trackId ? "border-primary shadow-glow" : "border-border hover:border-muted-foreground",
              )}
            >
              <img src={TRACK_ART[t.id]} alt={t.name} loading="lazy" width={1024} height={640} className={cn("aspect-[16/10] w-full object-cover transition-transform duration-500 group-hover:scale-105", !open && "grayscale")} />
              <div className="absolute inset-0 bg-fade-up" />
              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="font-display text-xs font-bold uppercase tracking-[0.25em] text-primary">
                  {t.location} · {ENV_LABEL[t.environment]}
                </div>
                <div className="font-display text-2xl font-black uppercase italic leading-tight">{t.name}</div>
                <div className="mt-1 flex items-center gap-1">
                  {[1, 2, 3].map((d) => (
                    <span key={d} className={cn("h-1.5 w-6", d <= t.difficulty ? "bg-accent" : "bg-muted")} />
                  ))}
                </div>
              </div>
              {!open && (
                <div className="absolute right-3 top-3 flex items-center gap-2 bg-scrim-strong px-3 py-1.5">
                  <Lock className="h-4 w-4" />
                  <CoinBadge amount={t.price} />
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 border border-border bg-glass p-5 lg:grid-cols-[1fr_auto]">
        <div className="space-y-4">
          <p className="text-muted-foreground">{track.tagline} Rewards ×{track.rewardMult}.</p>
          <div className="flex flex-wrap gap-6">
            <div>
              <div className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">Laps</div>
              <Segmented value={laps} onChange={setLaps} options={[1, 2, 3, 5].map((n) => ({ value: n, label: String(n) }))} />
            </div>
            <div>
              <div className="mb-2 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">Rivals</div>
              <Segmented value={opponents} onChange={setOpponents} options={[1, 3, 5].map((n) => ({ value: n, label: String(n) }))} />
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            Driving the <span className="text-foreground">{carById(profile.selectedCar).name}</span> · AI: <span className="capitalize text-foreground">{settings.difficulty}</span>
          </p>
        </div>
        <div className="flex items-end">
          {unlocked ? (
            <RallyButton className="w-full px-10 py-4 text-2xl lg:w-auto" onClick={() => startRace({ trackId, laps, opponents, difficulty: settings.difficulty, playerCarId: profile.selectedCar })}>
              Start race
            </RallyButton>
          ) : (
            <RallyButton variant="accent" className="w-full px-8 py-4 text-xl lg:w-auto" disabled={profile.coins < track.price} onClick={() => buyTrack(trackId, track.price)}>
              <Lock className="h-5 w-5" /> Unlock · {track.price.toLocaleString("en-US")}
            </RallyButton>
          )}
        </div>
      </div>
    </ScreenShell>
  );
}
