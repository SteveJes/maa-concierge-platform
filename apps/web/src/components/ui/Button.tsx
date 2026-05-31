import { cn } from "../../lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "outline" | "danger";
  size?: "sm" | "md" | "lg";
  iconLeft?: ReactNode;
  children: ReactNode;
}

const variants = {
  primary: "bg-[var(--brand-gold)] text-[var(--brand-navy)] hover:bg-[var(--brand-gold-strong)] font-semibold",
  ghost: "bg-transparent text-[var(--text)] hover:bg-[var(--bg-elev-2)]",
  outline: "bg-transparent text-[var(--text)] border border-[var(--border-strong)] hover:bg-[var(--bg-elev-2)]",
  danger: "bg-[var(--danger)] text-white hover:opacity-90 font-semibold",
} as const;

const sizes = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-5 text-base",
} as const;

export function Button({ variant = "primary", size = "md", iconLeft, children, className, ...rest }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] transition-all",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {iconLeft ? <span className="shrink-0">{iconLeft}</span> : null}
      {children}
    </button>
  );
}
