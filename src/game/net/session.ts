// Online room: one realtime channel per room, kept open from lobby through race and results.
// Presence = who is in the room; broadcast = start signal + car positions.
import type { RealtimeChannel } from "@supabase/supabase-js";
import { create } from "zustand";
import { supabase } from "@/integrations/supabase/client";
import type { RaceState } from "../sim/race";
import { useGame } from "../store";
import {
  MAX_ROOM_PLAYERS, applyRemote, netTickFor, packCar, pickHost,
  type NetCarState, type NetStart, type PresenceMeta,
} from "./protocol";

export const selfId: string =
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);

export interface RosterEntry extends PresenceMeta {
  id: string;
}

export type OnlineStatus = "idle" | "connecting" | "lobby" | "error";

interface OnlineStore {
  status: OnlineStatus;
  roomCode: string;
  roster: RosterEntry[];
  hostId: string | null;
  trackId: string;
  laps: number;
  error: string | null;
  notice: string | null;
  /** Code from a shared ?room= link, waiting to be joined. */
  pendingCode: string | null;
}

export const useOnline = create<OnlineStore>(() => ({
  status: "idle",
  roomCode: "",
  roster: [],
  hostId: null,
  trackId: "pinewood",
  laps: 2,
  error: null,
  notice: null,
  pendingCode: null,
}));

let channel: RealtimeChannel | null = null;
let joinedAt = 0;
const remote = new Map<string, NetCarState>();
const send = { acc: 0, lastAt: -1, last: "" };

export const isHost = () => useOnline.getState().hostId === selfId;

function myMeta(): PresenceMeta {
  const g = useGame.getState();
  return {
    name: g.settings.playerName || "Driver",
    carId: g.profile.selectedCar,
    upgrades: g.profile.upgrades?.[g.profile.selectedCar],
    joinedAt,
  };
}

export function joinRoom(code: string) {
  leaveRoom();
  joinedAt = Date.now();
  useOnline.setState({ status: "connecting", roomCode: code, roster: [], hostId: null, error: null, notice: null });
  const ch = supabase.channel(`vuka:${code}`, {
    config: { broadcast: { self: false }, presence: { key: selfId } },
  });
  ch.on("presence", { event: "sync" }, () => {
    const state = ch.presenceState<PresenceMeta>();
    const roster: RosterEntry[] = Object.entries(state)
      .map(([id, metas]) => ({ id, ...(metas[metas.length - 1] as PresenceMeta) }))
      .sort((a, b) => a.joinedAt - b.joinedAt || (a.id < b.id ? -1 : 1));
    const hostId = pickHost(roster);
    // Too many drivers: the latest arrival steps out.
    const myIndex = roster.findIndex((r) => r.id === selfId);
    if (myIndex >= MAX_ROOM_PLAYERS) {
      leaveRoom();
      useOnline.setState({ status: "error", error: `Room ${code} is full (${MAX_ROOM_PLAYERS} drivers max).` });
      return;
    }
    useOnline.setState({ roster, hostId });
    for (const id of [...remote.keys()]) if (!roster.some((r) => r.id === id)) remote.delete(id);
    // Host re-announces the track whenever someone joins or the host changes.
    if (hostId === selfId) announceSetup();
  });
  ch.on("broadcast", { event: "setup" }, ({ payload }) => {
    const p = payload as { trackId: string; laps: number };
    useOnline.setState({ trackId: p.trackId, laps: p.laps });
  });
  ch.on("broadcast", { event: "start" }, ({ payload }) => startFromNet(payload as NetStart));
  ch.on("broadcast", { event: "state" }, ({ payload }) => {
    const s = payload as NetCarState;
    const race = useGame.getState().raceConfig?.online;
    if (s.id !== selfId && race && s.raceId === race.raceId) remote.set(s.id, s);
  });
  ch.subscribe((status) => {
    if (import.meta.env.DEV) console.log("[net] channel:", status);
    if (status === "SUBSCRIBED") {
      useOnline.setState({ status: "lobby" });
      void ch.track(myMeta());
    } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
      useOnline.setState({ status: "error", error: "Couldn't connect to the room. Check your internet and try again." });
    }
  });
  channel = ch;
}

export function leaveRoom() {
  if (channel) {
    void supabase.removeChannel(channel);
    channel = null;
  }
  remote.clear();
  useOnline.setState({ status: "idle", roster: [], hostId: null, notice: null });
}

/** Re-send presence after you change car (rare, never per frame). */
export function refreshPresence() {
  if (channel && useOnline.getState().status === "lobby") void channel.track(myMeta());
}

function announceSetup() {
  const { trackId, laps } = useOnline.getState();
  void channel?.send({ type: "broadcast", event: "setup", payload: { trackId, laps } });
}

export function hostSetSetup(trackId: string, laps: number) {
  useOnline.setState({ trackId, laps });
  if (isHost()) announceSetup();
}

export function hostStartRace() {
  const { roster, trackId, laps } = useOnline.getState();
  if (!channel || !isHost() || roster.length < 1) return;
  const start: NetStart = {
    raceId: Math.random().toString(36).slice(2, 10),
    trackId,
    laps,
    grid: roster.map((r) => ({ id: r.id, name: r.name, carId: r.carId, upgrades: r.upgrades })),
  };
  void channel.send({ type: "broadcast", event: "start", payload: start });
  startFromNet(start);
}

function startFromNet(start: NetStart) {
  const me = start.grid.find((g) => g.id === selfId);
  if (!me) {
    useOnline.setState({ notice: "A race started before you joined. You'll be on the grid for the next one." });
    return;
  }
  remote.clear();
  send.acc = 0;
  send.lastAt = -1;
  send.last = "";
  const g = useGame.getState();
  g.startRace({
    trackId: start.trackId,
    laps: start.laps,
    opponents: 0,
    difficulty: "normal",
    playerCarId: me.carId,
    playerUpgrades: me.upgrades,
    online: { roomCode: useOnline.getState().roomCode, raceId: start.raceId, selfId, grid: start.grid },
  });
}

/** Called once per frame by the race stepper: move remote cars, send ours at the net tick. */
export function netStep(race: RaceState, dt: number, clock: number) {
  const online = race.config.online;
  if (!online) return;
  for (const car of race.cars) {
    if (!car.remote || !car.netId) continue;
    const s = remote.get(car.netId);
    if (s) applyRemote(car, s, dt);
  }
  if (!channel) return;
  send.acc += dt;
  const tick = netTickFor(race.cars.length);
  const finishedNow = race.player.finished && !send.last.includes('"fin":true');
  if (send.acc < tick && !finishedNow) return;
  send.acc = 0;
  if (typeof document !== "undefined" && document.hidden && !finishedNow) return;
  const pkt = packCar(race.player, selfId, online.raceId);
  const body = JSON.stringify(pkt);
  const stale = clock - send.lastAt > 1;
  if (body === send.last && !stale) return;
  send.last = body;
  send.lastAt = clock;
  void channel.send({ type: "broadcast", event: "state", payload: pkt });
}

/** Online: is everyone still in the room done? */
export function allConnectedFinished(race: RaceState) {
  const ids = new Set(useOnline.getState().roster.map((r) => r.id));
  return race.cars.every((c) => c.finished || (c.remote && c.netId && !ids.has(c.netId)));
}
