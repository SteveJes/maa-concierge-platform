import { cn } from "../../lib/cn";
import type { ReactNode, HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Optional padding override. Default: comfortable. */
  pad?: "none" | "sm" | "md" | "lg";
  /** Elevation level. Default: subtle. */
  elev?: "flat" | "sm" | "md" | "lg";
  /** Use the premium glassmorphic surface (DUBUB gold border + blur). */
  glass?: boolean;
}

const padMap = { none: "p-0", sm: "p-3", md: "p-5", lg: "p-7" } as const;
const elevMap = {
  flat: "shadow-none",
  sm: "shadow-[var(--shadow-sm)]",
  md: "shadow-[var(--shadow-md)]",
  lg: "shadow-[var(--shadow-lg)]",
} as const;

export function Card({ children, pad = "md", elev = "sm", glass, className, ...rest }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-[var(--radius-lg)]",
        glass
          ? "glass-card"
          : cn(
              "bg-[var(--bg-elev)] border border-[var(--border)] transition-shadow hover:shadow-[var(--shadow-md)]",
              elevMap[elev],
            ),
        padMap[pad],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-4">
      <div className="min-w-0">
        <h3 className="text-base font-semibold leading-tight text-[var(--text)]">{title}</h3>
        {subtitle ? <p className="mt-1 text-sm text-[var(--text-muted)]">{subtitle}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Status pill — concise label with a tone. Used in activity feed + lead table. */
export function Pill({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: "success" | "warning" | "danger" | "info" | "gold" | "neutral";
  className?: string;
}) {
  return <span className={cn("pill", `pill-${tone}`, className)}>{children}</span>;
}
