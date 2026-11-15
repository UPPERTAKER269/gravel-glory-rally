import { lazy, Suspense } from "react";
import heroImg from "@/assets/menu-hero.jpg";
import { useGame } from "../store";
import { MainMenu } from "./MainMenu";
import { PlayScreen } from "./PlayScreen";
import { CareerScreen } from "./CareerScreen";
import { SettingsScreen } from "./SettingsScreen";
import { ResultsScreen } from "./ResultsScreen";

const Garage = lazy(() => import("./GarageScreen"));
const RaceScreen = lazy(() => import("./RaceScreen"));

function Loading({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-background">
      <div className="text-center">
        <div className="stripes mx-auto mb-4 h-2 w-40 animate-pulse" />
        <div className="font-display text-xl font-bold uppercase tracking-[0.3em] text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

export function GameApp() {
  const screen = useGame((s) => s.screen);
  const raceKey = useGame((s) => s.raceKey);

  if (screen === "race") {
    return (
      <div className="fixed inset-0 overflow-hidden bg-background no-select">
        <Suspense fallback={<Loading label="Loading stage" />}>
          <RaceScreen key={raceKey} />
        </Suspense>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground no-select">
      <img src={heroImg} alt="" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-hero-gradient" />
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-fade-up" />
      {screen !== "menu" && <div className="absolute inset-0 bg-scrim backdrop-blur-sm" />}
      <div className="relative h-full">
        {screen === "menu" && <MainMenu />}
        {screen === "play" && <PlayScreen />}
        {screen === "career" && <CareerScreen />}
        {screen === "settings" && <SettingsScreen />}
        {screen === "results" && <ResultsScreen />}
        {screen === "garage" && (
          <Suspense fallback={<Loading label="Opening garage" />}>
            <Garage />
          </Suspense>
        )}
      </div>
    </div>
  );
}
