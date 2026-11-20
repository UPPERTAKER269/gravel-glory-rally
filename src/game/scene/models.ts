import vento from "@/assets/models/car-vento.glb.asset.json";
import strada from "@/assets/models/car-strada.glb.asset.json";
import ridge from "@/assets/models/car-ridge.glb.asset.json";
import falco from "@/assets/models/car-falco.glb.asset.json";
import apex from "@/assets/models/car-apex.glb.asset.json";
import cone from "@/assets/models/cone.glb.asset.json";
import pineTall from "@/assets/models/tree-pinetalla.glb.asset.json";
import pineRound from "@/assets/models/tree-pinerounda.glb.asset.json";
import oak from "@/assets/models/tree-default.glb.asset.json";
import cactus from "@/assets/models/cactus-tall.glb.asset.json";
import rock from "@/assets/models/rock-largea.glb.asset.json";
import rockTall from "@/assets/models/rock-talla.glb.asset.json";
import type { CarSpec } from "../sim/cars";
import type { SceneryKind } from "../sim/track";

/** Quaternius Realistic Car Pack (CC0), converted with nodes body / wheel-front-left / wheel-front-right / wheel-rear. */
export const CAR_MODEL_URL: Record<CarSpec["model"], string> = {
  vento: vento.url,
  strada: strada.url,
  ridge: ridge.url,
  falco: falco.url,
  apex: apex.url,
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

/** Models are modelled in metres (3.3-4.2 m long); a touch larger reads better at speed. */
export const CAR_SCALE = 1.08;
