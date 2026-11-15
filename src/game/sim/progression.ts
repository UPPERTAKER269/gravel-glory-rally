// Coins, unlocks and the career ladder.
import type { Difficulty } from "./race";

export const POSITION_REWARD = [500, 350, 250, 150, 100, 60];
export const CAREER_MULT = 1.5;
export const PODIUM_BONUS = 400; // first-time career podium
export const LAP_REWARD = 0.25; // extra per lap beyond the first, as a fraction

export function raceReward(position: number, trackMult: number, laps: number, career: boolean) {
  const base = POSITION_REWARD[Math.min(position, POSITION_REWARD.length) - 1] ?? 0;
  const lapFactor = 1 + LAP_REWARD * Math.max(0, laps - 1);
  return Math.round(base * trackMult * lapFactor * (career ? CAREER_MULT : 1));
}

export interface CareerEvent {
  id: string;
  name: string;
  trackId: string;
  laps: number;
  opponents: number;
  difficulty: Difficulty;
}

export const CAREER: CareerEvent[] = [
  { id: "c1", name: "Rookie Sprint", trackId: "pinewood", laps: 2, opponents: 3, difficulty: "easy" },
  { id: "c2", name: "Canyon Debut", trackId: "canyon", laps: 2, opponents: 4, difficulty: "easy" },
  { id: "c3", name: "Forest Duel", trackId: "pinewood", laps: 3, opponents: 5, difficulty: "normal" },
  { id: "c4", name: "First Frost", trackId: "frostpeak", laps: 2, opponents: 5, difficulty: "normal" },
  { id: "c5", name: "Red Rock Classic", trackId: "canyon", laps: 3, opponents: 5, difficulty: "hard" },
  { id: "c6", name: "Frostpeak Championship", trackId: "frostpeak", laps: 3, opponents: 5, difficulty: "hard" },
];

/** An event is open when it is the first one or the previous was finished on the podium. */
export function careerUnlocked(index: number, best: Record<string, number>) {
  if (index === 0) return true;
  const prev = best[CAREER[index - 1].id];
  return prev !== undefined && prev <= 3;
}
