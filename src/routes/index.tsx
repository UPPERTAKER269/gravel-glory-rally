import { createFileRoute } from "@tanstack/react-router";
import { GameApp } from "@/game/ui/GameApp";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "VUKA:CAR RACING — 3D Rally Racing Game" },
      { name: "description", content: "Drift through forest gravel, canyon hairpins and icy passes. Race AI rivals, earn coins and unlock rally cars." },
      { property: "og:title", content: "VUKA:CAR RACING — 3D Rally Racing Game" },
      { property: "og:description", content: "Drift through forest gravel, canyon hairpins and icy passes. Race AI rivals, earn coins and unlock rally cars." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameApp,
});
