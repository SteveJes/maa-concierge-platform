import { Check } from "lucide-react";
import { cn } from "../../lib/cn";

interface StepsProps {
  steps: Array<{ n: number; label: string }>;
  current: number;
  onJump?: (n: number) => void;
}

export function Steps({ steps, current, onJump }: StepsProps) {
  return (
    <nav className="flex items-center gap-2">
      {steps.map((s, i) => {
        const done = s.n < current;
        const active = s.n === current;
        const future = s.n > current;
        const clickable = onJump && (done || active);
        return (
          <div key={s.n} className="flex items-center gap-2">
            <button
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onJump?.(s.n)}
              className={cn(
                "group flex items-center gap-2.5 px-3 h-9 rounded-[var(--radius-md)] transition-all",
                active && "bg-[var(--brand-gold-soft)] text-[var(--brand-gold-strong)] font-semibold",
                done && "text-[var(--text-muted)] hover:bg-[var(--bg-elev-2)] cursor-pointer",
                future && "text-[var(--text-subtle)] cursor-default",
              )}
            >
              <span className={cn(
                "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold",
                active && "bg-[var(--brand-gold)] text-[var(--brand-navy)]",
                done && "bg-[rgba(20,160,117,0.18)] text-[var(--success)]",
                future && "bg-[var(--bg-elev-2)] text-[var(--text-subtle)] border border-[var(--border)]",
              )}>
                {done ? <Check size={14} strokeWidth={3} /> : s.n}
              </span>
              <span className="text-sm whitespace-nowrap">{s.label}</span>
            </button>
            {i < steps.length - 1 ? (
              <span className={cn("w-6 h-px", done ? "bg-[var(--success)] opacity-40" : "bg-[var(--border-strong)]")} />
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
