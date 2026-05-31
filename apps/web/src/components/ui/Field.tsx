import type { ReactNode, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

interface FieldProps {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

export function Field({ label, hint, required, error, children }: FieldProps) {
  return (
    <label className="block">
      <span className="flex items-center gap-1.5 text-sm font-medium text-[var(--text)] mb-1.5">
        {label}
        {required ? <span className="text-[var(--danger)]">*</span> : null}
      </span>
      {children}
      {error ? (
        <span className="block mt-1.5 text-xs text-[var(--danger)] font-medium">{error}</span>
      ) : hint ? (
        <span className="block mt-1.5 text-xs text-[var(--text-subtle)]">{hint}</span>
      ) : null}
    </label>
  );
}

const fieldBase =
  "w-full h-10 px-3 rounded-[var(--radius-md)] bg-[var(--bg-elev)] border border-[var(--border-strong)] text-sm text-[var(--text)] " +
  "placeholder:text-[var(--text-subtle)] " +
  "transition-colors hover:border-[var(--brand-gold)] focus:border-[var(--brand-gold)] focus:outline-none focus:ring-2 focus:ring-[var(--brand-gold-soft)]";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...rest} />;
}

export function TextArea({ className, rows = 4, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "h-auto py-2 resize-y", className)} rows={rows} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "appearance-none pr-9 bg-[length:14px_14px] bg-[right_12px_center] bg-no-repeat", className)}
            style={{ backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2'><polyline points='6 9 12 15 18 9'/></svg>\")" }}
            {...rest}>
      {children}
    </select>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="inline-flex items-center gap-3 cursor-pointer">
      <span
        className={cn(
          "relative inline-block w-10 h-6 rounded-full transition-colors",
          checked ? "bg-[var(--brand-gold)]" : "bg-[var(--bg-elev-2)] border border-[var(--border-strong)]",
        )}
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
      >
        <span className={cn(
          "absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )} />
      </span>
      {label ? <span className="text-sm text-[var(--text)]">{label}</span> : null}
    </label>
  );
}
