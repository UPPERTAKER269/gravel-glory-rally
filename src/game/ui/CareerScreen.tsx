import { Check, Lock, Medal } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAREER, careerUnlocked, raceReward } from "../sim/progression";
import { trackById } from "../sim/tracks";
import { useGame } from "../store";
import { CoinBadge, RallyButton, ScreenShell, ordinal } from "./common";
import { TRACK_ART } from "./trackArt";

const MEDAL = ["text-gold", "text-silver", "text-bronze"];

export function CareerScreen() {
  const profile = useGame((s) => s.profile);
  const startRace = useGame((s) => s.startRace);
  const done = CAREER.filter((e) => (profile.careerBest[e.id] ?? 99) <= 3).length;

  return (
    <ScreenShell title="Career" kicker={`Championship · ${done}/${CAREER.length} podiums`}>
      <p className="mb-5 max-w-2xl text-muted-foreground">Finish on the podium to open the next event. Career races pay 1.5× coins, a bonus for your first podium, and unlock the stage for quick races.</p>
      <div className="grid gap-3 lg:grid-cols-2">
        {CAREER.map((e, i) => {
          const open = careerUnlocked(i, profile.careerBest);
          const best = profile.careerBest[e.id];
          const t = trackById(e.trackId);
          return (
            <div key={e.id} className={cn("flex overflow-hidden border border-border bg-glass", !open && "opacity-55")}>
              <img src={TRACK_ART[e.trackId]} alt="" loading="lazy" width={1024} height={640} className={cn("w-28 shrink-0 object-cover sm:w-40", !open && "grayscale")} />
              <div className="flex min-w-0 flex-1 flex-col justify-between gap-3 p-4">
                <div>
                  <div className="font-display text-xs font-bold uppercase tracking-[0.25em] text-primary">
                    Round {i + 1} · {t.name}
                  </div>
                  <div className="font-display text-2xl font-black uppercase italic leading-tight">{e.name}</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {e.laps} laps · {e.opponents} rivals · <span className="capitalize">{e.difficulty}</span> · Win <CoinBadge amount={raceReward(1, t.rewardMult, e.laps, true)} className="text-sm" />
                  </div>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    {best !== undefined ? (
                      <>
                        {best <= 3 ? <Medal className={cn("h-5 w-5", MEDAL[best - 1])} /> : <Check className="h-4 w-4 text-muted-foreground" />}
                        <span className="text-muted-foreground">Best: {ordinal(best)}</span>
                      </>
                    ) : open ? (
                      <span className="text-muted-foreground">Not raced yet</span>
                    ) : (
                      <span className="flex items-center gap-1.5 text-muted-foreground"><Lock className="h-4 w-4" /> Podium round {i} to open</span>
                    )}
                  </div>
                  <RallyButton
                    className="px-5 py-2 text-base"
                    disabled={!open}
                    onClick={() => startRace({ trackId: e.trackId, laps: e.laps, opponents: e.opponents, difficulty: e.difficulty, playerCarId: profile.selectedCar, careerEventId: e.id })}
                  >
                    Race
                  </RallyButton>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </ScreenShell>
  );
}
