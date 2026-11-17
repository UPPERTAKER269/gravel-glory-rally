import { expect, test } from "vitest";
import { aiInput } from "./ai";
import { FIXED_DT, createRace, simulate } from "./race";

test.each(["pinewood", "canyon", "frostpeak"])("AI-driven player finishes 2 laps of %s in normal time", (trackId) => {
  const race = createRace({ trackId, laps: 2, opponents: 5, difficulty: "normal", playerCarId: "hatch" });
  simulate(race, 200, (r) => aiInput(r.player, r.track, r.cars, FIXED_DT));
  console.log(trackId, race.player.finished, race.player.finishTime.toFixed(1), race.player.lap);
  expect(race.player.finished).toBe(true);
  expect(race.player.finishTime).toBeLessThan(160);
});
