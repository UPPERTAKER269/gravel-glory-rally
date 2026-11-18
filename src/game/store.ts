// UI + persistent profile state. Per-frame state lives in runtime.ts, not here.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Difficulty, RaceConfig, RaceResultRow } from "./sim/race";
import { carById } from "./sim/cars";
import { MAX_UPGRADE_LEVEL, levelsOf, upgradeCost, type UpgradeKind, type UpgradeLevels } from "./sim/upgrades";

export type Screen = "menu" | "play" | "garage" | "career" | "settings" | "race" | "results" | "online";
export type CameraMode = "chase" | "cockpit";

export interface Settings {
  camera: CameraMode;
  quality: "high" | "low";
  units: "kmh" | "mph";
  touch: "auto" | "on" | "off";
  difficulty: Difficulty;
  sound: boolean;
  playerName: string;
}

export interface Profile {
  coins: number;
  ownedCars: string[];
  selectedCar: string;
  unlockedTracks: string[];
  careerBest: Record<string, number>;
  racesRun: number;
  wins: number;
  upgrades: Record<string, UpgradeLevels>;
}

export interface LastResult {
  config: RaceConfig;
  rows: RaceResultRow[];
  coins: number;
  bonus: number;
  unlockedTrack?: string;
}

const DEFAULT_PROFILE: Profile = {
  coins: 0,
  ownedCars: ["hatch"],
  selectedCar: "hatch",
  unlockedTracks: ["pinewood"],
  careerBest: {},
  racesRun: 0,
  wins: 0,
  upgrades: {},
};

const DEFAULT_SETTINGS: Settings = {
  camera: "chase",
  quality: "high",
  units: "kmh",
  touch: "auto",
  difficulty: "normal",
  sound: true,
  playerName: "",
};

interface PersistedState {
  profile: Profile;
  settings: Settings;
}

interface GameStore extends PersistedState {
  screen: Screen;
  raceConfig: RaceConfig | null;
  raceKey: number;
  paused: boolean;
  lastResult: LastResult | null;
  setScreen: (s: Screen) => void;
  startRace: (c: RaceConfig) => void;
  restartRace: () => void;
  setPaused: (p: boolean) => void;
  finishRace: (r: LastResult) => void;
  updateSettings: (s: Partial<Settings>) => void;
  buyCar: (id: string, price: number) => boolean;
  selectCar: (id: string) => void;
  buyTrack: (id: string, price: number) => boolean;
  buyUpgrade: (carId: string, kind: UpgradeKind) => boolean;
  resetProgress: () => void;
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      profile: DEFAULT_PROFILE,
      settings: DEFAULT_SETTINGS,
      screen: "menu",
      raceConfig: null,
      raceKey: 0,
      paused: false,
      lastResult: null,
      setScreen: (screen) => set({ screen, paused: false }),
      startRace: (config) =>
        set((s) => {
          // Your bought upgrades always ride along with the car you drive.
          const raceConfig = { ...config, playerUpgrades: config.playerUpgrades ?? levelsOf(s.profile.upgrades?.[config.playerCarId]) };
          return { raceConfig, screen: "race", paused: false, raceKey: s.raceKey + 1 };
        }),
      restartRace: () => set((s) => ({ screen: "race", paused: false, raceKey: s.raceKey + 1 })),
      setPaused: (paused) => set({ paused }),
      finishRace: (r) =>
        set((s) => {
          const p = { ...s.profile };
          p.coins += r.coins + r.bonus;
          p.racesRun += 1;
          const me = r.rows.find((x) => x.isPlayer);
          if (me?.position === 1) p.wins += 1;
          if (r.config.careerEventId && me) {
            const prev = p.careerBest[r.config.careerEventId];
            p.careerBest = { ...p.careerBest, [r.config.careerEventId]: prev ? Math.min(prev, me.position) : me.position };
          }
          if (r.unlockedTrack && !p.unlockedTracks.includes(r.unlockedTrack)) p.unlockedTracks = [...p.unlockedTracks, r.unlockedTrack];
          return { profile: p, lastResult: r, screen: "results", paused: false };
        }),
      updateSettings: (u) => set((s) => ({ settings: { ...s.settings, ...u } })),
      buyCar: (id, price) => {
        const p = get().profile;
        if (p.ownedCars.includes(id) || p.coins < price) return false;
        set({ profile: { ...p, coins: p.coins - price, ownedCars: [...p.ownedCars, id], selectedCar: id } });
        return true;
      },
      selectCar: (id) => {
        const p = get().profile;
        if (p.ownedCars.includes(id)) set({ profile: { ...p, selectedCar: id } });
      },
      buyTrack: (id, price) => {
        const p = get().profile;
        if (p.unlockedTracks.includes(id) || p.coins < price) return false;
        set({ profile: { ...p, coins: p.coins - price, unlockedTracks: [...p.unlockedTracks, id] } });
        return true;
      },
      buyUpgrade: (carId, kind) => {
        const p = get().profile;
        if (!p.ownedCars.includes(carId)) return false;
        const cur = levelsOf(p.upgrades?.[carId]);
        if (cur[kind] >= MAX_UPGRADE_LEVEL) return false;
        const price = upgradeCost(carById(carId), cur[kind] + 1);
        if (p.coins < price) return false;
        set({ profile: { ...p, coins: p.coins - price, upgrades: { ...p.upgrades, [carId]: { ...cur, [kind]: cur[kind] + 1 } } } });
        return true;
      },
      resetProgress: () => set({ profile: DEFAULT_PROFILE }),
    }),
    {
      name: "dust-rally-save-v1",
      partialize: (s): PersistedState => ({ profile: s.profile, settings: s.settings }),
      // Older saves lack newer fields (upgrades, sound, name): fill them from defaults.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<PersistedState>;
        return {
          ...current,
          profile: { ...DEFAULT_PROFILE, ...(p.profile ?? {}) },
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
        };
      },
    },
  ),
);
