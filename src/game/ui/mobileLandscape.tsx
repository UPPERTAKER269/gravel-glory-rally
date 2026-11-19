// Phones: play in landscape. Try fullscreen + orientation lock on the first tap
// (browsers only allow it after a gesture), and cover portrait with a rotate prompt.
import { RotateCw, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

const PORTRAIT = "(orientation: portrait)";
const PHONE_MAX_SIDE = 1024; // tablets in portrait also get the prompt; desktops never

function isTouchDevice() {
  return window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;
}

export async function enterLandscape() {
  if (!isTouchDevice()) return; // desktop unchanged
  try {
    const el = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: "hide" });
      else await el.webkitRequestFullscreen?.();
    }
  } catch {
    /* fullscreen refused (iPhone Safari, embedded preview): carry on */
  }
  try {
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.("landscape");
  } catch {
    /* orientation lock unsupported: the rotate prompt covers it */
  }
}

export function useLandscapeOnTap() {
  useEffect(() => {
    if (!isTouchDevice()) return;
    const onTap = () => {
      if (!document.fullscreenElement) void enterLandscape();
    };
    window.addEventListener("pointerup", onTap);
    return () => window.removeEventListener("pointerup", onTap);
  }, []);
}

export function RotatePrompt() {
  const [portrait, setPortrait] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT);
    const on = () => setPortrait(mq.matches && isTouchDevice() && Math.min(window.innerWidth, window.innerHeight) <= PHONE_MAX_SIDE);
    on();
    mq.addEventListener("change", on);
    window.addEventListener("resize", on);
    return () => {
      mq.removeEventListener("change", on);
      window.removeEventListener("resize", on);
    };
  }, []);
  if (!portrait) return null;
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-8 bg-background px-8 text-center text-foreground" role="dialog" aria-label="Rotate your phone">
      <div className="absolute inset-0 bg-hero-gradient opacity-60" />
      <div className="relative">
        <div className="stripes mx-auto mb-10 h-2 w-28" />
        <div className="relative mx-auto h-36 w-36">
          <Smartphone className="animate-rotate-phone absolute inset-0 h-full w-full text-primary" strokeWidth={1.4} />
          <RotateCw className="absolute -right-4 -top-2 h-10 w-10 text-accent" />
        </div>
        <h2 className="mt-10 text-5xl font-black uppercase italic leading-none">Rotate<br />your phone</h2>
        <p className="mx-auto mt-4 max-w-xs text-muted-foreground">VUKA:CAR RACING plays sideways. Turn your phone to landscape to race.</p>
      </div>
    </div>
  );
}
