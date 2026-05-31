import { cn } from "../../lib/cn";
import type { ReactNode } from "react";

interface StatProps {
  label: string;
  value: ReactNode;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  icon?: ReactNode;
  /** Render number in DUBUB-gold gradient (use for primary financial KPIs). */
  gold?: boolean;
  /** Use the glassmorphic premium variant. */
  glass?: boolean;
  className?: string;
}

export function Stat({ label, value, delta, icon, gold, glass, className }: StatProps) {
  const deltaTone = delta?.direction === "up"
    ? "text-[var(--success)]"
    : delta?.direction === "down"
      ? "text-[var(--danger)]"
      : "text-[var(--text-muted)]";
  return (
    <div className={cn(
      "rounded-[var(--radius-lg)] p-5",
      glass
        ? "glass-card"
        : "bg-[var(--bg-elev)] border border-[var(--border)] shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]",
      className,
    )}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-subtle)]">{label}</span>
        {icon ? (
          <span className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center bg-[var(--brand-gold-soft)] text-[var(--brand-gold-strong)]">
            {icon}
          </span>
        ) : null}
      </div>
      <div className={cn(
        "text-[28px] font-semibold leading-none tracking-tight",
        gold ? "kpi-gold" : "kpi-number",
      )}>{value}</div>
      {delta ? (
        <div className={cn("mt-2 text-[11px] font-medium inline-flex items-center gap-1", deltaTone)}>
          <span aria-hidden>{delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "—"}</span>
          <span>{delta.value}</span>
          <span className="text-[var(--text-subtle)] font-normal ml-1">vs 7j</span>
        </div>
      ) : null}
    </div>
  );
}
