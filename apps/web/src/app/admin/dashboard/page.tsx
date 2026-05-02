"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const API = typeof window !== "undefined" && window.location.hostname === "clients.dubub.com"
  ? "https://api.dubub.com"
  : "http://localhost:4000";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TenantSummary {
  id: string;
  name: string;
  plan: string;
  status: string;
  since: string;
  monthlyPriceCad: number;
  addons: string[];
  contactEmail: string | null;
  website: string | null;
  vapiEnabled: boolean;
  notes: string | null;
}

type HealthLevel = "ok" | "warn" | "critical" | "unknown";

interface HealthCheck {
  key: string;
  label: string;
  status: HealthLevel;
  value: string;
  detail: string | null;
}

interface VapiCallSummary {
  id: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  turnLatencyAverage: number | null;
  modelLatencyAverage: number | null;
  voiceLatencyAverage: number | null;
  status: string;
  cost: number | null;
}

interface VapiStats {
  callCount24h: number;
  completedCount24h: number;
  failedCount24h: number;
  avgTurnLatencyMs: number | null;
  avgModelLatencyMs: number | null;
  avgVoiceLatencyMs: number | null;
  totalCostUsd: number;
}

interface TenantOverview {
  tenant: {
    id: string;
    name: string;
    plan: string;
    status: string;
    since: string;
    monthlyPriceCad: number;
    addons: string[];
    contactName: string | null;
    contactEmail: string | null;
    website: string | null;
    vapiAssistantId: string | null;
    openAiModel: string;
    notes: string | null;
  };
  health: {
    overallStatus: HealthLevel;
    generatedAt: string;
    checks: HealthCheck[];
    vapiCalls: VapiCallSummary[];
    vapiStats: VapiStats;
  };
}

// ── Palette ───────────────────────────────────────────────────────────────────

const P = {
  bg: "#06090c",
  sidebar: "#0a0f14",
  card: "#0e1520",
  border: "rgba(255,255,255,0.07)",
  gold: "#c9a84c",
  green: "#22d68a",
  orange: "#ff9100",
  red: "#ff5252",
  blue: "#3db8f5",
  muted: "rgba(255,255,255,0.35)",
  dim: "rgba(255,255,255,0.55)",
  white: "#fff",
};

function statusColor(s: HealthLevel | string): string {
  if (s === "ok" || s === "active") return P.green;
  if (s === "warn" || s === "trial") return P.orange;
  if (s === "critical" || s === "suspended") return P.red;
  return P.muted;
}

function statusIcon(s: HealthLevel): string {
  if (s === "ok") return "✓";
  if (s === "warn") return "⚠";
  if (s === "critical") return "✕";
  return "?";
}

function planBadgeColor(plan: string): string {
  if (plan === "enterprise") return P.gold;
  if (plan === "professional") return P.blue;
  return P.muted;
}

function fmtMs(v: number | null): string {
  if (v === null) return "—";
  return `${v}ms`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-CA", { timeZone: "America/Montreal", dateStyle: "short", timeStyle: "short" });
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 12, padding: "18px 20px", minWidth: 130 }}>
      <div style={{ fontSize: 11, color: P.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 800, color: accent ?? P.white, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: P.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ── Health badge ──────────────────────────────────────────────────────────────

function HealthBadge({ status }: { status: HealthLevel }) {
  const color = statusColor(status);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${color}18`, border: `1px solid ${color}44`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, color, textTransform: "uppercase", letterSpacing: "0.06em" }}>
      <span>{statusIcon(status)}</span> {status}
    </span>
  );
}

// ── Main dashboard ────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overview, setOverview] = useState<TenantOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Auth check
  useEffect(() => {
    const t = localStorage.getItem("dubub_admin_token");
    if (!t) { router.replace("/admin/login"); return; }
    setToken(t);
  }, [router]);

  function logout() {
    localStorage.removeItem("dubub_admin_token");
    router.replace("/admin/login");
  }

  // Fetch tenant list
  const fetchTenants = useCallback(async (t: string) => {
    setTenantsLoading(true);
    const res = await fetch(`${API}/v1/admin/tenants`, { headers: { "x-admin-token": t } });
    if (res.status === 401) { logout(); return; }
    const data = await res.json() as TenantSummary[];
    setTenants(data);
    setTenantsLoading(false);
    if (!selectedId && data.length > 0) setSelectedId(data[0]!.id);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (token) void fetchTenants(token);
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch tenant overview
  const fetchOverview = useCallback(async (id: string, t: string) => {
    setLoading(true);
    setOverview(null);
    const res = await fetch(`${API}/v1/admin/tenants/${id}/overview`, { headers: { "x-admin-token": t } });
    if (res.status === 401) { logout(); return; }
    const data = await res.json() as TenantOverview;
    setOverview(data);
    setLoading(false);
    setLastRefresh(new Date());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedId && token) void fetchOverview(selectedId, token);
  }, [selectedId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) return null;

  const tenant = overview?.tenant;
  const health = overview?.health;

  return (
    <div style={{ minHeight: "100vh", background: P.bg, fontFamily: "Inter, system-ui, sans-serif", color: P.white, display: "flex" }}>

      {/* ── Sidebar ── */}
      <aside style={{ width: 240, background: P.sidebar, borderRight: `1px solid ${P.border}`, display: "flex", flexDirection: "column", flexShrink: 0, minHeight: "100vh" }}>
        {/* Logo */}
        <div style={{ padding: "24px 20px 16px", borderBottom: `1px solid ${P.border}` }}>
          <div style={{ background: "linear-gradient(135deg,#c9a84c,#8b6010)", borderRadius: 8, padding: "5px 10px", fontWeight: 800, fontSize: 15, color: "#111", letterSpacing: "0.08em", display: "inline-block" }}>DUBUB</div>
          <div style={{ color: P.muted, fontSize: 10, marginTop: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>Admin Console</div>
        </div>

        {/* Tenant list */}
        <div style={{ padding: "16px 12px 12px", flex: 1 }}>
          <div style={{ fontSize: 10, color: P.muted, textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 8px", marginBottom: 8 }}>Clients</div>
          {tenantsLoading
            ? <div style={{ color: P.muted, fontSize: 12, padding: "8px" }}>Chargement…</div>
            : tenants.map((t) => (
              <button
                key={t.id}
                onClick={() => setSelectedId(t.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, width: "100%",
                  background: selectedId === t.id ? "rgba(201,168,76,0.1)" : "transparent",
                  border: selectedId === t.id ? "1px solid rgba(201,168,76,0.2)" : "1px solid transparent",
                  borderRadius: 8, padding: "9px 10px", cursor: "pointer", marginBottom: 4, textAlign: "left",
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(t.status), flexShrink: 0 }} />
                <div>
                  <div style={{ color: selectedId === t.id ? P.gold : P.white, fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{t.name}</div>
                  <div style={{ color: P.muted, fontSize: 10, marginTop: 2 }}>{t.plan} · ${t.monthlyPriceCad}/mo</div>
                </div>
              </button>
            ))
          }
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 20px", borderTop: `1px solid ${P.border}` }}>
          <button onClick={logout} style={{ background: "none", border: "none", color: P.muted, fontSize: 12, cursor: "pointer", padding: 0 }}>
            ← Déconnexion
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, padding: "32px 36px", overflowY: "auto" }}>
        {loading && (
          <div style={{ color: P.muted, fontSize: 14, marginBottom: 24 }}>Chargement des données…</div>
        )}

        {!loading && !overview && !tenantsLoading && (
          <div style={{ color: P.muted, fontSize: 14 }}>Sélectionnez un client dans la barre latérale.</div>
        )}

        {overview && tenant && health && (
          <>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28, gap: 16, flexWrap: "wrap" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{tenant.name}</h1>
                  <HealthBadge status={health.overallStatus} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: planBadgeColor(tenant.plan), background: `${planBadgeColor(tenant.plan)}18`, border: `1px solid ${planBadgeColor(tenant.plan)}44`, borderRadius: 20, padding: "3px 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    {tenant.plan}
                  </span>
                </div>
                <div style={{ color: P.muted, fontSize: 12, marginTop: 6 }}>
                  {tenant.website && <a href={tenant.website} target="_blank" rel="noreferrer" style={{ color: P.blue, textDecoration: "none", marginRight: 12 }}>{tenant.website}</a>}
                  {tenant.contactEmail && <span style={{ marginRight: 12 }}>{tenant.contactEmail}</span>}
                  <span>Client depuis {new Date(tenant.since).getFullYear()}</span>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                {lastRefresh && <span style={{ fontSize: 11, color: P.muted }}>Rafraîchi {lastRefresh.toLocaleTimeString("fr-CA")}</span>}
                <button
                  onClick={() => token && selectedId && void fetchOverview(selectedId, token)}
                  style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${P.border}`, borderRadius: 8, color: P.white, fontSize: 12, padding: "8px 14px", cursor: "pointer" }}
                >
                  ↻ Actualiser
                </button>
              </div>
            </div>

            {/* Health checks */}
            <section style={{ marginBottom: 28 }}>
              <SectionTitle>Santé du service</SectionTitle>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                {health.checks.map((c) => (
                  <div key={c.key} style={{ background: P.card, border: `1px solid ${statusColor(c.status)}33`, borderRadius: 10, padding: "12px 16px", minWidth: 180, flex: "1 1 180px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, color: statusColor(c.status) }}>{statusIcon(c.status as HealthLevel)}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: P.dim }}>{c.label}</span>
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 800, color: statusColor(c.status) }}>{c.value}</div>
                    {c.detail && <div style={{ fontSize: 11, color: P.muted, marginTop: 4, lineHeight: 1.4 }}>{c.detail}</div>}
                  </div>
                ))}
              </div>
            </section>

            {/* Account details */}
            <section style={{ marginBottom: 28 }}>
              <SectionTitle>Compte & Configuration</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
                <StatCard label="Plan mensuel" value={`$${tenant.monthlyPriceCad}`} sub="CAD / mois" accent={P.gold} />
                <StatCard label="Modèle IA" value={tenant.openAiModel} />
                <StatCard label="VAPI" value={tenant.vapiAssistantId ? "Actif" : "Inactif"} accent={tenant.vapiAssistantId ? P.green : P.muted} />
                <StatCard label="Addons" value={tenant.addons.length} sub={tenant.addons.join(", ")} />
                <StatCard label="Statut" value={tenant.status} accent={statusColor(tenant.status)} />
              </div>
              {tenant.vapiAssistantId && (
                <div style={{ marginTop: 12, background: P.card, border: `1px solid ${P.border}`, borderRadius: 10, padding: "12px 16px" }}>
                  <span style={{ fontSize: 11, color: P.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>VAPI Assistant ID </span>
                  <code style={{ fontSize: 12, color: P.dim, marginLeft: 8 }}>{tenant.vapiAssistantId}</code>
                </div>
              )}
            </section>

            {/* VAPI stats */}
            <section style={{ marginBottom: 28 }}>
              <SectionTitle>Appels VAPI — 24 dernières heures</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, marginBottom: 20 }}>
                <StatCard label="Total appels" value={health.vapiStats.callCount24h} />
                <StatCard label="Complétés" value={health.vapiStats.completedCount24h} accent={P.green} />
                <StatCard label="Échoués" value={health.vapiStats.failedCount24h} accent={health.vapiStats.failedCount24h > 0 ? P.red : P.muted} />
                <StatCard label="Latence tour moy." value={fmtMs(health.vapiStats.avgTurnLatencyMs)} accent={health.vapiStats.avgTurnLatencyMs !== null && health.vapiStats.avgTurnLatencyMs > 2200 ? P.orange : P.green} />
                <StatCard label="Latence modèle" value={fmtMs(health.vapiStats.avgModelLatencyMs)} />
                <StatCard label="Latence voix TTS" value={fmtMs(health.vapiStats.avgVoiceLatencyMs)} />
                <StatCard label="Coût total" value={`$${health.vapiStats.totalCostUsd.toFixed(4)}`} sub="USD (toutes les données)" />
              </div>

              {/* Recent calls table */}
              {health.vapiCalls.length > 0 && (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${P.border}`, color: P.muted }}>
                        <Th>ID</Th>
                        <Th>Démarré</Th>
                        <Th>Durée</Th>
                        <Th>Statut</Th>
                        <Th>Turn Latency</Th>
                        <Th>Modèle</Th>
                        <Th>Voix</Th>
                        <Th>Coût</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {health.vapiCalls.map((c) => (
                        <tr key={c.id} style={{ borderBottom: `1px solid ${P.border}` }}>
                          <Td><code style={{ fontSize: 10, color: P.muted }}>{c.id.slice(0, 8)}…</code></Td>
                          <Td>{fmtDate(c.startedAt)}</Td>
                          <Td>{c.durationSeconds !== null ? `${c.durationSeconds}s` : "—"}</Td>
                          <Td><span style={{ color: statusColor(c.status === "completed" ? "ok" : c.status === "failed" ? "critical" : "unknown") }}>{c.status}</span></Td>
                          <Td>{fmtMs(c.turnLatencyAverage)}</Td>
                          <Td>{fmtMs(c.modelLatencyAverage)}</Td>
                          <Td>{fmtMs(c.voiceLatencyAverage)}</Td>
                          <Td>{c.cost !== null ? `$${c.cost.toFixed(4)}` : "—"}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Notes */}
            {tenant.notes && (
              <section>
                <SectionTitle>Notes</SectionTitle>
                <div style={{ background: P.card, border: `1px solid ${P.border}`, borderRadius: 10, padding: "14px 16px", fontSize: 13, color: P.dim, lineHeight: 1.6 }}>
                  {tenant.notes}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
      {children}
      <span style={{ flex: 8, height: 1, background: "rgba(255,255,255,0.07)" }} />
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, letterSpacing: "0.06em", fontSize: 10, textTransform: "uppercase", whiteSpace: "nowrap" }}>{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: "9px 12px", color: "rgba(255,255,255,0.65)" }}>{children}</td>;
}
