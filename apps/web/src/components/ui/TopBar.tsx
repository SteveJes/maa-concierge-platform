"use client";
import type { ReactNode } from "react";
import { Button } from "./Button";
import { ChevronDown } from "lucide-react";

interface TopBarProps {
  title: string;
  subtitle?: string;
  tenants?: Array<{ id: string; label: string }>;
  activeTenant?: string;
  onTenantChange?: (id: string) => void;
  right?: ReactNode;
}

export function TopBar({ title, subtitle, tenants, activeTenant, onTenantChange, right }: TopBarProps) {
  return (
    <header className="h-16 px-6 border-b border-[var(--border)] bg-[var(--bg-elev)] flex items-center gap-4">
      <div className="flex-1 min-w-0">
        <h1 className="text-lg font-semibold text-[var(--text)] leading-tight truncate">{title}</h1>
        {subtitle ? <p className="text-xs text-[var(--text-muted)] truncate">{subtitle}</p> : null}
      </div>
      {tenants && tenants.length > 0 ? (
        <label className="relative inline-flex items-center">
          <span className="sr-only">Tenant</span>
          <select
            value={activeTenant}
            onChange={(e) => onTenantChange?.(e.target.value)}
            className="appearance-none h-10 pl-3 pr-9 rounded-[var(--radius-md)] bg-[var(--bg-elev-2)] border border-[var(--border-strong)] text-sm text-[var(--text)] font-medium cursor-pointer hover:bg-[var(--bg)]"
          >
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>{t.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 w-4 h-4 text-[var(--text-muted)] pointer-events-none" />
        </label>
      ) : null}
      {right ?? <Button size="sm" variant="outline">Settings</Button>}
    </header>
  );
}
