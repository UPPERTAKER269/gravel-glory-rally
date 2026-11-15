import type { ButtonHTMLAttributes, ReactNode } from "react";
import { ArrowLeft, Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { useGame } from "../store";

type Variant = "primary" | "ghost" | "outline" | "accent";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground hover:brightness-110 shadow-glow",
  accent: "bg-accent text-accent-foreground hover:brightness-110",
  outline: "border border-border bg-glass text-foreground hover:border-primary hover:text-primary",
  ghost: "text-muted-foreground hover:text-foreground",
};

export function RallyButton({
  variant = "primary",
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...rest}
      className={cn(
        "skew-rally inline-flex items-center justify-center px-6 py-3 font-display text-lg font-bold uppercase tracking-wider transition-all duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40",
        VARIANTS[variant],
        className,
      )}
    >
      <span className="unskew-rally inline-flex items-center gap-2">{children}</span>
    </button>
  );
}

export function CoinBadge({ amount, className }: { amount: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 font-display font-bold tabular text-gold", className)}>
      <Coins className="h-4 w-4" />
      {amount.toLocaleString("en-US")}
    </span>
  );
}

export function ScreenShell({ title, kicker, children, right }: { title: string; kicker?: string; children: ReactNode; right?: ReactNode }) {
  const setScreen = useGame((s) => s.setScreen);
  const coins = useGame((s) => s.profile.coins);
  return (
    <div className="relative z-10 flex h-full flex-col">
      <header className="flex items-center justify-between gap-4 px-4 pt-[max(env(safe-area-inset-top),1rem)] sm:px-8">
        <div className="flex items-center gap-3 sm:gap-5">
          <button
            onClick={() => setScreen("menu")}
            className="flex h-11 w-11 items-center justify-center border border-border bg-glass text-foreground transition-colors hover:border-primary hover:text-primary"
            aria-label="Back to main menu"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            {kicker && <div className="font-display text-xs font-bold uppercase tracking-[0.3em] text-primary">{kicker}</div>}
            <h1 className="text-3xl font-black uppercase italic leading-none tracking-tight sm:text-4xl">{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {right}
          <div className="border border-border bg-glass px-4 py-2">
            <CoinBadge amount={coins} className="text-lg" />
          </div>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-5 sm:px-8">{children}</div>
    </div>
  );
}

export function StatBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] items-center gap-3">
      <span className="font-display text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <div className="h-2 bg-muted">
        <div className="h-full bg-primary transition-all duration-500" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex flex-wrap border border-border bg-glass">
      {options.map((o) => (
        <button
          key={String(o.value)}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-w-12 px-4 py-2 font-display text-sm font-bold uppercase tracking-wider transition-colors",
            o.value === value ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function formatTime(t: number) {
  if (!isFinite(t) || t <= 0) return "--:--.--";
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, "0")}`;
}

export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
