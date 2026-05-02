"use client";

import { useRouter, usePathname } from "next/navigation";

export const P = {
  bg: "#06090c",
  sidebar: "#0a0f14",
  card: "#0e1520",
  cardHover: "#121d2a",
  border: "rgba(255,255,255,0.07)",
  borderFocus: "rgba(201,168,76,0.4)",
  gold: "#c9a84c",
  goldLight: "#e8c96a",
  green: "#22d68a",
  orange: "#ff9100",
  red: "#ff5252",
  blue: "#3db8f5",
  purple: "#b388ff",
  muted: "rgba(255,255,255,0.30)",
  dim: "rgba(255,255,255,0.55)",
  white: "#ffffff",
};

export const API =
  typeof window !== "undefined" && window.location.hostname === "clients.dubub.com"
    ? "https://api.dubub.com"
    : "http://localhost:4000";

export function adminHeaders(): Record<string, string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("dubub_admin_token") ?? "" : "";
  return { "x-admin-token": token, "Content-Type": "application/json" };
}

const NAV_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "◉" },
  { href: "/admin/onboarding", label: "Onboarding", icon: "＋" },
];

interface Props {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function AdminShell({ children, title, subtitle, actions }: Props) {
  const router = useRouter();
  const pathname = usePathname();

  function logout() {
    localStorage.removeItem("dubub_admin_token");
    router.push("/admin/login");
  }

  return (
    <div style={{ minHeight: "100vh", background: P.bg, fontFamily: "Inter, system-ui, sans-serif", color: P.white, display: "flex" }}>
      {/* ── Sidebar ── */}
      <aside style={{ width: 220, background: P.sidebar, borderRight: `1px solid ${P.border}`, display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>
        {/* Logo */}
        <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${P.border}` }}>
          <div style={{ background: "linear-gradient(135deg,#c9a84c,#8b6010)", borderRadius: 8, padding: "5px 10px", fontWeight: 800, fontSize: 15, color: "#111", letterSpacing: "0.08em", display: "inline-block" }}>DUBUB</div>
          <div style={{ color: P.muted, fontSize: 10, marginTop: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>Platform Admin</div>
        </div>

        {/* Nav */}
        <nav style={{ padding: "16px 12px", flex: 1 }}>
          <div style={{ fontSize: 10, color: P.muted, textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 8px", marginBottom: 8 }}>Navigation</div>
          {NAV_ITEMS.map((item) => {
            const active = pathname?.startsWith(item.href);
            return (
              <button
                key={item.href}
                onClick={() => router.push(item.href)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  background: active ? "rgba(201,168,76,0.1)" : "transparent",
                  border: active ? "1px solid rgba(201,168,76,0.2)" : "1px solid transparent",
                  borderRadius: 8, padding: "10px 12px", cursor: "pointer", marginBottom: 4, textAlign: "left",
                  transition: "all 0.15s",
                }}
              >
                <span style={{ fontSize: 14, color: active ? P.gold : P.muted, width: 18, textAlign: "center" }}>{item.icon}</span>
                <span style={{ color: active ? P.gold : P.dim, fontSize: 13, fontWeight: active ? 700 : 500 }}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${P.border}` }}>
          <div style={{ fontSize: 10, color: P.muted, marginBottom: 8 }}>v2.0 · Concierge Platform</div>
          <button onClick={logout} style={{ background: "none", border: "none", color: P.muted, fontSize: 12, cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <span>→</span> Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <main style={{ flex: 1, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Page header */}
        {(title ?? actions) && (
          <div style={{ padding: "28px 36px 20px", borderBottom: `1px solid ${P.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", background: P.sidebar }}>
            <div>
              {title && <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{title}</h1>}
              {subtitle && <p style={{ margin: "4px 0 0", fontSize: 13, color: P.muted }}>{subtitle}</p>}
            </div>
            {actions && <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{actions}</div>}
          </div>
        )}
        {/* Content */}
        <div style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
          {children}
        </div>
      </main>
    </div>
  );
}

// ── Shared UI primitives ──────────────────────────────────────────────────────

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, color: P.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 16, display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ flex: 0, whiteSpace: "nowrap" }}>{children}</span>
      <span style={{ flex: 1, height: 1, background: P.border }} />
    </div>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 14, padding: "24px", ...style }}>
      {children}
    </div>
  );
}

export function GoldBtn({ children, onClick, disabled, type = "button" }: { children: React.ReactNode; onClick?: () => void; disabled?: boolean; type?: "button" | "submit" }) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{ background: disabled ? "#2a2a38" : "linear-gradient(135deg,#c9a84c,#8b6010)", border: "none", borderRadius: 10, color: disabled ? P.muted : "#111", fontWeight: 700, fontSize: 14, padding: "12px 24px", cursor: disabled ? "default" : "pointer", transition: "all 0.15s" }}>
      {children}
    </button>
  );
}

export function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${P.border}`, borderRadius: 10, color: P.dim, fontWeight: 600, fontSize: 14, padding: "12px 24px", cursor: "pointer" }}>
      {children}
    </button>
  );
}

export const fieldStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 10,
  color: "#fff",
  fontSize: 14,
  padding: "11px 14px",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  fontFamily: "Inter, system-ui, sans-serif",
};

export const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 700,
  color: "rgba(255,255,255,0.45)",
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 6,
};

export function Field({ label, required, children, hint }: { label: string; required?: boolean; children: React.ReactNode; hint?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}{required && <span style={{ color: P.gold, marginLeft: 3 }}>*</span>}</label>
      {children}
      {hint && <div style={{ fontSize: 11, color: P.muted, marginTop: 5, lineHeight: 1.4 }}>{hint}</div>}
    </div>
  );
}
