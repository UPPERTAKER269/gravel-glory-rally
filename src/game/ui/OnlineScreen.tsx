// Online lobby: create or join a room with a code, pick a car, host starts the race.
import { Check, Copy, Crown, Link2, LogOut, Users, Wifi } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { cleanRoomCode, makeRoomCode, MAX_ROOM_PLAYERS } from "../net/protocol";
import { hostSetSetup, hostStartRace, joinRoom, leaveRoom, refreshPresence, selfId, useOnline } from "../net/session";
import { carById } from "../sim/cars";
import { TRACKS, trackById } from "../sim/tracks";
import { useGame } from "../store";
import { RallyButton, ScreenShell, Segmented } from "./common";
import { TRACK_ART } from "./trackArt";

const label = "mb-2 font-display text-xs font-bold uppercase tracking-widest text-muted-foreground";
const input =
  "w-full border border-border bg-input px-4 py-3 font-display text-xl font-bold uppercase tracking-wider text-foreground outline-none placeholder:text-muted-foreground focus:border-primary";

export function OnlineScreen() {
  const status = useOnline((s) => s.status);
  return (
    <ScreenShell title="Online" kicker="Race your friends">
      {status === "lobby" ? <Lobby /> : <JoinPanel />}
    </ScreenShell>
  );
}

function JoinPanel() {
  const status = useOnline((s) => s.status);
  const error = useOnline((s) => s.error);
  const pendingCode = useOnline((s) => s.pendingCode);
  const name = useGame((s) => s.settings.playerName);
  const update = useGame((s) => s.updateSettings);
  const [code, setCode] = useState(pendingCode ?? "");

  useEffect(() => {
    if (!useGame.getState().settings.playerName) update({ playerName: `Driver${Math.floor(100 + Math.random() * 900)}` });
  }, [update]);
  useEffect(() => {
    if (pendingCode) setCode(pendingCode);
  }, [pendingCode]);

  const ready = name.trim().length >= 2;
  const connecting = status === "connecting";
  const join = (c: string) => {
    useOnline.setState({ pendingCode: null });
    joinRoom(c);
  };

  return (
    <div className="mx-auto grid max-w-4xl gap-5 md:grid-cols-2">
      <div className="border border-border bg-glass p-5 md:col-span-2">
        <div className={label}>Your driver name</div>
        <input
          className={input}
          value={name}
          maxLength={14}
          onChange={(e) => update({ playerName: e.target.value.replace(/[^\p{L}\p{N} _-]/gu, "") })}
          placeholder="Your name"
          aria-label="Driver name"
        />
      </div>
      <div className="flex flex-col gap-4 border border-border bg-glass p-5">
        <div>
          <div className="font-display text-2xl font-black uppercase italic">Create a room</div>
          <p className="text-sm text-muted-foreground">Get a code and send it to your friends. Up to {MAX_ROOM_PLAYERS} drivers.</p>
        </div>
        <RallyButton className="mt-auto w-full" disabled={!ready || connecting} onClick={() => join(makeRoomCode())}>
          <Wifi className="h-5 w-5" /> Create room
        </RallyButton>
      </div>
      <div className="flex flex-col gap-4 border border-border bg-glass p-5">
        <div>
          <div className="font-display text-2xl font-black uppercase italic">Join a friend</div>
          <p className="text-sm text-muted-foreground">Type the room code they sent you.</p>
        </div>
        <input
          className={cn(input, "text-center text-3xl tracking-[0.4em]")}
          value={code}
          onChange={(e) => setCode(cleanRoomCode(e.target.value))}
          placeholder="CODE"
          aria-label="Room code"
          onKeyDown={(e) => e.key === "Enter" && ready && code.length >= 4 && join(code)}
        />
        <RallyButton variant="outline" className="w-full" disabled={!ready || code.length < 4 || connecting} onClick={() => join(code)}>
          <Users className="h-5 w-5" /> Join room
        </RallyButton>
      </div>
      {connecting && <p className="text-center text-muted-foreground md:col-span-2">Connecting…</p>}
      {error && <p className="text-center text-accent md:col-span-2">{error}</p>}
    </div>
  );
}

function Lobby() {
  const { roomCode, roster, hostId, trackId, laps, notice } = useOnline();
  const profile = useGame((s) => s.profile);
  const selectCar = useGame((s) => s.selectCar);
  const amHost = hostId === selfId;
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const track = trackById(trackId);

  const copy = async (what: "code" | "link") => {
    const text = what === "code" ? roomCode : `${window.location.origin}/?room=${roomCode}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      /* clipboard blocked: the code is on screen */
    }
  };

  return (
    <div className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col gap-5">
        <div className="border border-border bg-glass p-5">
          <div className={label}>Room code</div>
          <div className="font-display text-6xl font-black italic tracking-[0.25em] text-primary" data-testid="room-code">{roomCode}</div>
          <div className="mt-3 flex flex-wrap gap-2">
            <RallyButton variant="outline" className="px-4 py-2 text-sm" onClick={() => copy("code")}>
              {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy code
            </RallyButton>
            <RallyButton variant="outline" className="px-4 py-2 text-sm" onClick={() => copy("link")}>
              {copied === "link" ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} Copy invite link
            </RallyButton>
          </div>
        </div>

        <div className="border border-border bg-glass">
          <div className="flex items-center justify-between border-b border-border px-4 py-2">
            <span className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">Drivers</span>
            <span className="font-display text-sm font-bold tabular text-muted-foreground">{roster.length}/{MAX_ROOM_PLAYERS}</span>
          </div>
          {roster.map((r) => (
            <div key={r.id} className={cn("flex items-center justify-between gap-3 px-4 py-2.5", r.id === selfId && "bg-primary/15")}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-display text-lg font-bold uppercase">
                  <span className="truncate">{r.name}</span>
                  {r.id === selfId && <span className="text-xs text-primary">You</span>}
                  {r.id === hostId && <Crown className="h-4 w-4 text-gold" aria-label="Host" />}
                </div>
                <div className="truncate text-xs text-muted-foreground">{carById(r.carId).name}</div>
              </div>
            </div>
          ))}
          {roster.length < 2 && <div className="px-4 py-3 text-sm text-muted-foreground">Waiting for friends to join with the code…</div>}
        </div>

        <div className="border border-border bg-glass p-5">
          <div className={label}>Your car</div>
          <div className="flex flex-wrap gap-2">
            {profile.ownedCars.map((id) => (
              <button
                key={id}
                onClick={() => { selectCar(id); window.setTimeout(refreshPresence, 0); }}
                className={cn(
                  "border-2 px-3 py-1.5 font-display text-sm font-bold uppercase transition-colors",
                  profile.selectedCar === id ? "border-primary text-primary" : "border-border text-muted-foreground hover:text-foreground",
                )}
              >
                {carById(id).name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Your garage upgrades come with you.</p>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        <div className="border border-border bg-glass p-5">
          <div className={label}>{amHost ? "Pick the stage" : "Stage (host picks)"}</div>
          <div className="grid grid-cols-3 gap-2">
            {TRACKS.map((t) => (
              <button
                key={t.id}
                disabled={!amHost}
                onClick={() => hostSetSetup(t.id, laps)}
                className={cn("relative overflow-hidden border-2 text-left transition-colors disabled:cursor-default", t.id === trackId ? "border-primary" : "border-border", !amHost && t.id !== trackId && "opacity-40")}
              >
                <img src={TRACK_ART[t.id]} alt={t.name} width={1024} height={640} loading="lazy" className="aspect-[16/10] w-full object-cover" />
                <div className="absolute inset-0 bg-fade-up" />
                <div className="absolute inset-x-0 bottom-0 p-2 font-display text-sm font-black uppercase italic leading-tight">{t.name}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <div>
              <div className={label}>Laps</div>
              {amHost ? (
                <Segmented value={laps} onChange={(l) => hostSetSetup(trackId, l)} options={[1, 2, 3, 5].map((n) => ({ value: n, label: String(n) }))} />
              ) : (
                <div className="font-display text-2xl font-black">{laps}</div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{track.tagline}</p>
          </div>
        </div>

        {notice && <p className="text-sm text-accent">{notice}</p>}

        <div className="mt-auto flex flex-wrap gap-3">
          {amHost ? (
            <RallyButton className="flex-1 py-4 text-2xl" disabled={roster.length < 2} onClick={hostStartRace}>
              {roster.length < 2 ? "Need 2+ drivers" : "Start race"}
            </RallyButton>
          ) : (
            <div className="flex flex-1 items-center justify-center border border-border bg-glass px-4 py-4 font-display text-lg font-bold uppercase tracking-widest text-muted-foreground">
              Waiting for host to start…
            </div>
          )}
          <RallyButton variant="ghost" onClick={leaveRoom}><LogOut className="h-5 w-5" /> Leave</RallyButton>
        </div>
        <p className="text-xs text-muted-foreground">Online races are free and use any stage. You earn coins for where you finish.</p>
      </div>
    </div>
  );
}
