// Controller menu navigation: D-pad / left stick moves focus between buttons,
// A presses, B goes back, Start pauses a race. Driving input lives in input.ts.
import { useEffect } from "react";
import { useGame } from "../store";

export type Dir = "up" | "down" | "left" | "right";
export interface Box { x: number; y: number; w: number; h: number }

/** Pick the nearest box in a direction (pure, testable). Returns index or -1. */
export function pickNext(from: Box, boxes: Box[], dir: Dir): number {
  const cx = from.x + from.w / 2, cy = from.y + from.h / 2;
  let best = -1, bestScore = Infinity;
  boxes.forEach((b, i) => {
    const bx = b.x + b.w / 2, by = b.y + b.h / 2;
    const dx = bx - cx, dy = by - cy;
    const main = dir === "left" ? -dx : dir === "right" ? dx : dir === "up" ? -dy : dy;
    const cross = dir === "left" || dir === "right" ? Math.abs(dy) : Math.abs(dx);
    if (main <= 4) return;
    const score = main + cross * 2.2;
    if (score < bestScore) { bestScore = score; best = i; }
  });
  return best;
}

const FOCUSABLE = "button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex='-1'])";
const REPEAT_FIRST = 0.38, REPEAT_NEXT = 0.16;

function focusables(): HTMLElement[] {
  // Inside an open dialog/pause menu, stay inside it.
  const scope = (document.querySelector("[data-nav-scope]") as HTMLElement | null) ?? document.body;
  return [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    if (el.closest("[data-nav-skip]")) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < window.innerHeight;
  });
}

function move(dir: Dir) {
  const els = focusables();
  if (!els.length) return;
  const cur = document.activeElement as HTMLElement | null;
  if (!cur || !els.includes(cur)) { els[0].focus(); return; }
  const r = cur.getBoundingClientRect();
  const others = els.filter((e) => e !== cur);
  const i = pickNext({ x: r.x, y: r.y, w: r.width, h: r.height }, others.map((e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; }), dir);
  if (i >= 0) { others[i].focus(); others[i].scrollIntoView({ block: "nearest", inline: "nearest" }); }
}

export function useGamepadMenuNav() {
  useEffect(() => {
    let raf = 0;
    let prev: boolean[] = [];
    let held: Dir | null = null;
    let holdT = 0;
    let last = performance.now();
    const tick = () => {
      raf = requestAnimationFrame(tick);
      const now = performance.now();
      const dt = (now - last) / 1000;
      last = now;
      const pads = navigator.getGamepads?.() ?? [];
      const pad = [...pads].find((p) => p);
      if (!pad) { prev = []; return; }
      const pressed = pad.buttons.map((b) => b.pressed);
      const edge = (i: number) => pressed[i] && !prev[i];
      prev = pressed;

      const g = useGame.getState();
      const inRace = g.screen === "race";
      if (pressed.some(Boolean)) document.documentElement.dataset.gamepad = "1";

      // Start / Options toggles pause in a race.
      if (inRace && edge(9)) { g.setPaused(!g.paused); return; }
      // While driving, the pad is for driving only.
      if (inRace && !g.paused) { held = null; return; }

      const ax = pad.axes[0] ?? 0, ay = pad.axes[1] ?? 0;
      let dir: Dir | null = null;
      if (pressed[12] || ay < -0.6) dir = "up";
      else if (pressed[13] || ay > 0.6) dir = "down";
      else if (pressed[14] || ax < -0.6) dir = "left";
      else if (pressed[15] || ax > 0.6) dir = "right";
      if (dir !== held) { held = dir; holdT = REPEAT_FIRST; if (dir) move(dir); }
      else if (dir) { holdT -= dt; if (holdT <= 0) { holdT = REPEAT_NEXT; move(dir); } }

      if (edge(0)) {
        const el = document.activeElement as HTMLElement | null;
        if (el && el !== document.body) el.click();
        else focusables()[0]?.focus();
      }
      if (edge(1)) {
        if (inRace) g.setPaused(false);
        else if (g.screen !== "menu") g.setScreen("menu");
      }
    };
    raf = requestAnimationFrame(tick);
    const clear = () => { delete document.documentElement.dataset.gamepad; };
    window.addEventListener("pointerdown", clear);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("pointerdown", clear); };
  }, []);
}
