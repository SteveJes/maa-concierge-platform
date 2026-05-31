"use client";
import { cn } from "../../lib/cn";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";

interface NavItem { label: string; href: string; icon: ReactNode; }
interface SidebarProps {
  items: NavItem[];
  brand?: ReactNode;
  footer?: ReactNode;
}

export function Sidebar({ items, brand, footer }: SidebarProps) {
  const pathname = usePathname();
  return (
    <aside className="w-60 shrink-0 border-r border-[var(--border)] bg-[var(--bg-elev)] flex flex-col">
      <div className="px-5 py-6 border-b border-[var(--border)]">
        {brand ?? <DefaultBrand />}
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {items.map((it) => {
          const active = pathname === it.href || (it.href !== "/" && pathname?.startsWith(it.href));
          return (
            <Link
              key={it.href}
              href={it.href}
              className={cn(
                "flex items-center gap-3 px-3 h-10 rounded-[var(--radius-md)] text-sm transition-colors",
                active
                  ? "bg-[var(--brand-gold-soft)] text-[var(--brand-gold-strong)] font-medium"
                  : "text-[var(--text-muted)] hover:bg-[var(--bg-elev-2)] hover:text-[var(--text)]",
              )}
            >
              <span className={cn("shrink-0", active && "text-[var(--brand-gold)]")}>{it.icon}</span>
              <span>{it.label}</span>
            </Link>
          );
        })}
      </nav>
      {footer ? <div className="px-5 py-4 border-t border-[var(--border)]">{footer}</div> : null}
    </aside>
  );
}

function DefaultBrand() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="w-9 h-9 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--brand-gold)] to-[var(--brand-gold-strong)] flex items-center justify-center text-[var(--brand-navy)] font-bold text-base shadow-[var(--shadow-sm)]">
        D
      </div>
      <div className="leading-tight">
        <div className="text-sm font-semibold text-[var(--text)]">DUBUB</div>
        <div className="text-xs text-[var(--text-subtle)]">Concierge IA</div>
      </div>
    </div>
  );
}
