import { cn } from "../../lib/cn.js";
import type { ReactNode } from "react";

interface StatProps {
  label: string;
  value: ReactNode;
  delta?: { value: string; direction: "up" | "down" | "flat" };
  icon?: ReactNode;
  className?: string;
}

export function Stat({ label, value, delta, icon, className }: StatProps) {
  const deltaTone = delta?.direction === "up"
    ? "text-[var(--success)]"
    : delta?.direction === "down"
      ? "text-[var(--danger)]"
      : "text-[var(--text-muted)]";
  return (
    <div className={cn(
      "rounded-[var(--radius-lg)] bg-[var(--bg-elev)] border border-[var(--border)] p-5",
      "shadow-[var(--shadow-sm)] transition-shadow hover:shadow-[var(--shadow-md)]",
      className,
    )}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-subtle)]">{label}</span>
        {icon ? <span className="text-[var(--brand-gold)]">{icon}</span> : null}
      </div>
      <div className="text-3xl font-semibold text-[var(--text)] leading-none tracking-tight">{value}</div>
      {delta ? (
        <div className={cn("mt-2 text-xs font-medium", deltaTone)}>
          {delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "—"} {delta.value}
        </div>
      ) : null}
    </div>
  );
}
