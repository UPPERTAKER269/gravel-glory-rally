import { useState } from "react";
import { useGame } from "../store";
import { RallyButton, ScreenShell, Segmented } from "./common";

function Row({ label, hint, children }: { label: string; hint: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 border-b border-border py-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="font-display text-xl font-bold uppercase italic">{label}</div>
        <div className="text-sm text-muted-foreground">{hint}</div>
      </div>
      {children}
    </div>
  );
}

export function SettingsScreen() {
  const settings = useGame((s) => s.settings);
  const update = useGame((s) => s.updateSettings);
  const reset = useGame((s) => s.resetProgress);
  const [confirm, setConfirm] = useState(false);

  return (
    <ScreenShell title="Settings" kicker="Setup">
      <div className="max-w-3xl border border-border bg-glass px-5">
        <Row label="Camera" hint="Starting view. Press C or the camera button to switch mid-race.">
          <Segmented value={settings.camera} onChange={(camera) => update({ camera })} options={[{ value: "chase", label: "Chase" }, { value: "cockpit", label: "Cockpit" }]} />
        </Row>
        <Row label="Graphics" hint="Low turns off shadows and lowers resolution for older phones.">
          <Segmented value={settings.quality} onChange={(quality) => update({ quality })} options={[{ value: "high", label: "High" }, { value: "low", label: "Low" }]} />
        </Row>
        <Row label="Speed units" hint="Speedometer display.">
          <Segmented value={settings.units} onChange={(units) => update({ units })} options={[{ value: "kmh", label: "km/h" }, { value: "mph", label: "mph" }]} />
        </Row>
        <Row label="Touch controls" hint="Auto shows on-screen pedals on touch screens.">
          <Segmented value={settings.touch} onChange={(touch) => update({ touch })} options={[{ value: "auto", label: "Auto" }, { value: "on", label: "On" }, { value: "off", label: "Off" }]} />
        </Row>
        <Row label="AI difficulty" hint="Quick race rivals. Career events set their own.">
          <Segmented value={settings.difficulty} onChange={(difficulty) => update({ difficulty })} options={[{ value: "easy", label: "Easy" }, { value: "normal", label: "Normal" }, { value: "hard", label: "Hard" }]} />
        </Row>
        <Row label="Reset progress" hint="Clears coins, cars, tracks and career results on this device.">
          {confirm ? (
            <div className="flex gap-2">
              <RallyButton variant="accent" className="px-4 py-2 text-base" onClick={() => { reset(); setConfirm(false); }}>Yes, reset</RallyButton>
              <RallyButton variant="outline" className="px-4 py-2 text-base" onClick={() => setConfirm(false)}>Cancel</RallyButton>
            </div>
          ) : (
            <RallyButton variant="outline" className="px-4 py-2 text-base" onClick={() => setConfirm(true)}>Reset</RallyButton>
          )}
        </Row>
      </div>
      <div className="mt-6 max-w-3xl text-sm text-muted-foreground">
        <div className="font-display font-bold uppercase tracking-widest text-foreground">Controls</div>
        Keyboard: W/↑ throttle · S/↓ brake & reverse · A D/← → steer · Space handbrake · C camera · Esc pause.
        <br />Controller: left stick steer · RT throttle · LT brake · B handbrake.
      </div>
    </ScreenShell>
  );
}
