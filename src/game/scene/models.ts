import hatchback from "@/assets/models/hatchback-sports.glb.asset.json";
import sedan from "@/assets/models/sedan-sports.glb.asset.json";
import suv from "@/assets/models/suv.glb.asset.json";
import race from "@/assets/models/race.glb.asset.json";
import raceFuture from "@/assets/models/race-future.glb.asset.json";
import cone from "@/assets/models/cone.glb.asset.json";
import pineTall from "@/assets/models/tree-pinetalla.glb.asset.json";
import pineRound from "@/assets/models/tree-pinerounda.glb.asset.json";
import oak from "@/assets/models/tree-default.glb.asset.json";
import cactus from "@/assets/models/cactus-tall.glb.asset.json";
import rock from "@/assets/models/rock-largea.glb.asset.json";
import rockTall from "@/assets/models/rock-talla.glb.asset.json";
import type { CarSpec } from "../sim/cars";
import type { SceneryKind } from "../sim/track";

export const CAR_MODEL_URL: Record<CarSpec["model"], string> = {
  "hatchback-sports": hatchback.url,
  "sedan-sports": sedan.url,
  suv: suv.url,
  race: race.url,
  "race-future": raceFuture.url,
};

export const SCENERY_URL: Record<SceneryKind, string> = {
  pine: pineTall.url,
  pineRound: pineRound.url,
  oak: oak.url,
  cactus: cactus.url,
  rock: rock.url,
  rockTall: rockTall.url,
};

export const CONE_URL = cone.url;

/** Kenney cars are ~2.85 m long; scale to ~4.3 m. */
export const CAR_SCALE = 1.5;
