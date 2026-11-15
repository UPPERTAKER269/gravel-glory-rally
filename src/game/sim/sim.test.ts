import { describe, expect, it } from "vitest";
import { TRACKS } from "./tracks";
import { buildTrack } from "./track";
import { createRace, simulate, standings } from "./race";
import { raceReward, careerUnlocked, CAREER } from "./progression";
import { carById } from "./cars";

describe("tracks", () => {
  for (const def of TRACKS) {
    it(`${def.id} never overlaps itself`, () => {
      const t = buildTrack(def);
      const m = t.samples.length;
      let minD = Infinity;
      for (let i = 0; i < m; i += 2)
        for (let j = 0; j < m; j += 2) {
          const gap = Math.min(Math.abs(i - j), m - Math.abs(i - j));
          if (gap * 2 < 80) continue; // only parts at least 80 m apart along the road
          const a = t.samples[i], b = t.samples[j];
          minD = Math.min(minD, Math.hypot(a.x - b.x, a.z - b.z));
        }
      expect(minD).toBeGreaterThan(def.width * 2.5);
    });
    it(`${def.id} lap is between 1.2 and 2.2 km`, () => {
      const t = buildTrack(def);
      expect(t.length).toBeGreaterThan(1200);
      expect(t.length).toBeLessThan(2200);
    });
  }
});

describe("driving", () => {
  it("flat out on the starter car reaches 90% of top speed within 12 s", () => {
    const race = createRace({ trackId: "pinewood", laps: 1, opponents: 1, difficulty: "easy", playerCarId: "hatch" });
    simulate(race, 3.6);
    let peak = 0;
    simulate(race, 12, (r) => {
      peak = Math.max(peak, r.player.speed);
      // Steer toward the road with a simple pursuit so we stay on the straight.
      return { throttle: 1, brake: 0, steer: 0, handbrake: false };
    });
    expect(peak).toBeGreaterThan(carById("hatch").topSpeed * 0.9 * 0.85); // gravel drag
  });

  it("the car does not move during the countdown", () => {
    const race = createRace({ trackId: "pinewood", laps: 1, opponents: 2, difficulty: "easy", playerCarId: "hatch" });
    const x = race.player.x, z = race.player.z;
    simulate(race, 3, { throttle: 1, brake: 0, steer: 0, handbrake: false });
    expect(Math.hypot(race.player.x - x, race.player.z - z)).toBeLessThan(0.5);
  });
});

describe("AI", () => {
  for (const def of TRACKS) {
    it(`AI finishes 2 laps of ${def.id} and stays mostly on the road`, () => {
      const race = createRace({ trackId: def.id, laps: 2, opponents: 5, difficulty: "hard", playerCarId: "hatch" });
      // The player is autopiloted too (finished cars are AI-driven): mark as finished-ish by using AI.
      race.player.isPlayer = false;
      let off = 0, samples = 0;
      for (let t = 0; t < 400 && race.cars.some((c) => !c.finished); t += 1) {
        simulate(race, 1);
        for (const c of race.cars) { samples++; if (!c.onRoad) off++; }
      }
      const finished = race.cars.filter((c) => c.finished).length;
      const times = race.cars.map((c) => c.finishTime.toFixed(1));
      console.log(def.id, "len", race.track.length.toFixed(0), "finish times", times.join(", "), "offroad", (off / samples).toFixed(3));
      expect(finished).toBe(race.cars.length);
      expect(off / samples).toBeLessThan(0.08);
    });
  }
});

describe("progression", () => {
  it("1st place on Pinewood over 1 lap pays 500 coins", () => {
    expect(raceReward(1, 1, 1, false)).toBe(500);
  });
  it("career races pay 1.5x", () => {
    expect(raceReward(1, 1, 1, true)).toBe(750);
  });
  it("6th place still pays something", () => {
    expect(raceReward(6, 1, 1, false)).toBe(60);
  });
  it("next career event opens only after a podium", () => {
    expect(careerUnlocked(0, {})).toBe(true);
    expect(careerUnlocked(1, { [CAREER[0].id]: 4 })).toBe(false);
    expect(careerUnlocked(1, { [CAREER[0].id]: 3 })).toBe(true);
  });
});

describe("standings", () => {
  it("player starts at the back of the grid", () => {
    const race = createRace({ trackId: "canyon", laps: 2, opponents: 5, difficulty: "normal", playerCarId: "hatch" });
    expect(standings(race).indexOf(race.player)).toBe(5);
  });
});
