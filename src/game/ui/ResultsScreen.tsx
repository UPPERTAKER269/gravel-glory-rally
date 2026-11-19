import { Home, RotateCcw, Trophy, Unlock, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { CAREER } from "../sim/progression";
import { trackById } from "../sim/tracks";
import { useGame } from "../store";
import { CoinBadge, RallyButton, formatTime, ordinal } from "./common";

const PLACE_COLOR = ["text-gold", "text-silver", "text-bronze"];

export function ResultsScreen() {
  const result = useGame((s) => s.lastResult);
  const restart = useGame((s) => s.restartRace);
  const setScreen = useGame((s) => s.setScreen);
  if (!result) return null;
  const me = result.rows.find((r) => r.isPlayer);
  const track = trackById(result.config.trackId);
  const event = CAREER.find((e) => e.id === result.config.careerEventId);
  const pos = me?.position ?? result.rows.length;
  const online = !!result.config.online;

  return (
    <div className="relative z-10 flex h-full flex-col overflow-y-auto px-4 py-[max(env(safe-area-inset-top),1rem)] sm:px-8">
      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-6 lg:grid-cols-[1fr_1.3fr]">
        <div className="animate-rally-in">
          <div className="font-display text-xs font-bold uppercase tracking-[0.3em] text-primary">
            {online ? `Online · Room ${result.config.online!.roomCode}` : event ? `Career · ${event.name}` : "Quick race"} · {track.name}
          </div>
          <div className={cn("font-display text-8xl font-black uppercase italic leading-none sm:text-9xl", PLACE_COLOR[pos - 1] ?? "text-foreground")}>
            {ordinal(pos)}
          </div>
          <div className="mt-1 text-muted-foreground">
            {pos === 1 ? "Stage win. Flat out." : pos <= 3 ? "On the podium." : "Off the podium this time."}
          </div>
          <div className="mt-5 space-y-2 border border-border bg-glass p-4">
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold uppercase tracking-widest text-muted-foreground">Prize money</span>
              <CoinBadge amount={result.coins} className="text-xl" />
            </div>
            {result.bonus > 0 && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-display text-sm font-bold uppercase tracking-widest text-muted-foreground"><Trophy className="h-4 w-4 text-gold" /> First podium bonus</span>
                <CoinBadge amount={result.bonus} className="text-xl" />
              </div>
            )}
            {result.unlockedTrack && (
              <div className="flex items-center gap-2 pt-1 text-success">
                <Unlock className="h-4 w-4" /> {trackById(result.unlockedTrack).name} unlocked for quick races
              </div>
            )}
            {me && me.bestLap > 0 && (
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Your best lap</span>
                <span className="font-display text-lg font-bold tabular text-foreground">{formatTime(me.bestLap)}</span>
              </div>
            )}
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            {online ? (
              <RallyButton onClick={() => setScreen("online")}><Users className="h-5 w-5" /> Back to lobby</RallyButton>
            ) : (
              <RallyButton onClick={restart}><RotateCcw className="h-5 w-5" /> Race again</RallyButton>
            )}
            {online ? null : event ? (
              <RallyButton variant="outline" onClick={() => setScreen("career")}>Career</RallyButton>
            ) : (
              <RallyButton variant="outline" onClick={() => setScreen("play")}>New race</RallyButton>
            )}
            <RallyButton variant="ghost" onClick={() => setScreen("menu")}><Home className="h-5 w-5" /> Menu</RallyButton>
          </div>
        </div>

        <div className="animate-rally-in border border-border bg-glass shadow-panel [animation-delay:120ms]">
          <div className="grid grid-cols-[2.5rem_1fr_auto] gap-3 border-b border-border px-4 py-2 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">
            <span>Pos</span><span>Driver</span><span className="text-right">Time</span>
          </div>
          {result.rows.map((r) => (
            <div key={r.id} className={cn("grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 px-4 py-2.5", r.isPlayer && "bg-primary/15")}>
              <span className={cn("font-display text-2xl font-black italic", PLACE_COLOR[r.position - 1] ?? "text-muted-foreground")}>{r.position}</span>
              <span className="min-w-0">
                <span className={cn("block truncate font-display text-lg font-bold uppercase", r.isPlayer && "text-primary")}>{r.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{r.carName}</span>
              </span>
              <span className="text-right font-display text-lg font-bold tabular">
                {r.estimated ? <span className="text-muted-foreground">~{formatTime(r.time)}</span> : formatTime(r.time)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
