"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import AdminShell, { P, API, Card, SectionTitle } from "../_components/AdminShell";
import SettingsPanel from "./SettingsPanel";
import LeadsPanel from "./LeadsPanel";
import SentinelPanel from "./SentinelPanel";

// ── Types ─────────────────────────────────────────────────────────────────────

interface TenantSummary {
  id: string; name: string; plan: string; status: string; since: string;
  monthlyPriceCad: number; addons: string[]; contactEmail: string | null;
  website: string | null; vapiEnabled: boolean; notes: string | null;
}

type HealthLevel = "ok" | "warn" | "critical" | "unknown";

interface HealthCheck {
  key: string; label: string; status: HealthLevel; value: string; detail: string | null;
}

interface VapiCallSummary {
  id: string; startedAt: string | null; endedAt: string | null;
  durationSeconds: number | null; turnLatencyAverage: number | null;
  modelLatencyAverage: number | null; voiceLatencyAverage: number | null;
  status: string; cost: number | null;
}

interface VapiStats {
  callCount24h: number; completedCount24h: number; failedCount24h: number;
  avgTurnLatencyMs: number | null; avgModelLatencyMs: number | null;
  avgVoiceLatencyMs: number | null; totalCostUsd: number;
}

interface TenantOverview {
  tenant: {
    id: string; name: string; plan: string; status: string; since: string;
    monthlyPriceCad: number; addons: string[]; contactName: string | null;
    contactEmail: string | null; website: string | null; vapiAssistantId: string | null;
    openAiModel: string; notes: string | null;
  };
  health: {
    overallStatus: HealthLevel; generatedAt: string;
    checks: HealthCheck[]; vapiCalls: VapiCallSummary[]; vapiStats: VapiStats;
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusColor(s: string): string {
  if (s === "ok" || s === "active" || s === "completed") return P.green;
  if (s === "warn" || s === "trial") return P.orange;
  if (s === "critical" || s === "suspended" || s === "failed") return P.red;
  return P.muted;
}
function statusIcon(s: HealthLevel) { return s === "ok" ? "✓" : s === "warn" ? "⚠" : s === "critical" ? "✕" : "?"; }
function fmtMs(v: number | null) { return v === null ? "—" : `${v}ms`; }
function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-CA", { timeZone: "America/Montreal", dateStyle: "short", timeStyle: "short" });
}
function planColor(p: string) { return p === "enterprise" ? P.gold : p === "professional" ? P.blue : P.muted; }

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${P.border}`, borderRadius: 12, padding: "16px 18px" }}>
      <div style={{ fontSize: 10, color: P.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: accent ?? P.white, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: P.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ObsLinkCard({ label, title, description, href, accent }: { label: string; title: string; description: string; href: string; accent: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      style={{
        display: "block",
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${accent}33`,
        borderRadius: 12,
        padding: "16px 18px",
        textDecoration: "none",
        transition: "all 0.18s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = `${accent}88`;
        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = `${accent}33`;
        e.currentTarget.style.background = "rgba(255,255,255,0.03)";
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 9, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: "0.14em" }}>{label}</span>
        <span style={{ fontSize: 11, color: accent }}>↗</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: P.white, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 11, color: P.muted, lineHeight: 1.5 }}>{description}</div>
    </a>
  );
}

function HealthBadge({ status }: { status: HealthLevel }) {
  const c = statusColor(status);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: `${c}18`, border: `1px solid ${c}44`, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700, color: c, textTransform: "uppercase", letterSpacing: "0.06em" }}>
      {statusIcon(status)} {status}
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

interface TenantUsage {
  tenantId: string; calls: number; inputTokens: number; outputTokens: number;
  costUsd: number; lastCallAt: string;
  byModel: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }>;
}

interface UsageReport {
  tenants: TenantUsage[];
  note: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [tenants, setTenants] = useState<TenantSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [overview, setOverview] = useState<TenantOverview | null>(null);
  const [usageReport, setUsageReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [tenantsLoading, setTenantsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  useEffect(() => {
    const t = localStorage.getItem("dubub_admin_token");
    if (!t) { router.replace("/admin/login"); return; }
    setToken(t);
  }, [router]);

  const fetchTenants = useCallback(async (t: string) => {
    setTenantsLoading(true);
    const res = await fetch(`${API}/v1/admin/tenants`, { headers: { "x-admin-token": t } });
    if (res.status === 401) { router.replace("/admin/login"); return; }
    const data = await res.json() as TenantSummary[];
    setTenants(data);
    setTenantsLoading(false);
    if (data.length > 0) setSelectedId((prev) => prev ?? data[0]!.id);
  }, [router]);

  const fetchOverview = useCallback(async (id: string, t: string) => {
    setLoading(true); setOverview(null);
    const res = await fetch(`${API}/v1/admin/tenants/${id}/overview`, { headers: { "x-admin-token": t } });
    if (res.status === 401) { router.replace("/admin/login"); return; }
    setOverview(await res.json() as TenantOverview);
    setLoading(false);
    setLastRefresh(new Date());
  }, [router]);

  const fetchUsage = useCallback(async (t: string) => {
    const res = await fetch(`${API}/v1/admin/usage`, { headers: { "x-admin-token": t } });
    if (res.ok) setUsageReport(await res.json() as UsageReport);
  }, []);

  useEffect(() => { if (token) void fetchTenants(token); }, [token, fetchTenants]);
  useEffect(() => { if (token) void fetchUsage(token); }, [token, fetchUsage]);
  useEffect(() => { if (selectedId && token) void fetchOverview(selectedId, token); }, [selectedId, token, fetchOverview]);

  if (!token) return null;

  const tenant = overview?.tenant;
  const health = overview?.health;

  const sidebarContent = (
    <div style={{ padding: "16px 12px", borderTop: `1px solid ${P.border}` }}>
      <div style={{ fontSize: 10, color: P.muted, textTransform: "uppercase", letterSpacing: "0.1em", padding: "0 8px", marginBottom: 10 }}>Clients actifs</div>
      {tenantsLoading
        ? <div style={{ color: P.muted, fontSize: 12, padding: "8px" }}>Chargement…</div>
        : tenants.map((t) => (
          <button key={t.id} onClick={() => setSelectedId(t.id)} style={{
            display: "flex", alignItems: "center", gap: 10, width: "100%",
            background: selectedId === t.id ? "rgba(201,168,76,0.1)" : "transparent",
            border: selectedId === t.id ? "1px solid rgba(201,168,76,0.2)" : "1px solid transparent",
            borderRadius: 8, padding: "9px 10px", cursor: "pointer", marginBottom: 4, textAlign: "left",
          }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: statusColor(t.status), flexShrink: 0 }} />
            <div>
              <div style={{ color: selectedId === t.id ? P.gold : P.white, fontSize: 13, fontWeight: 600, lineHeight: 1.2 }}>{t.name}</div>
              <div style={{ color: P.muted, fontSize: 10, marginTop: 2 }}>{t.plan} · ${t.monthlyPriceCad}/mo</div>
            </div>
          </button>
        ))
      }
    </div>
  );

  const actions = selectedId && token ? (
    <>
      {lastRefresh && <span style={{ fontSize: 11, color: P.muted }}>Rafraîchi {lastRefresh.toLocaleTimeString("fr-CA")}</span>}
      <button onClick={() => token && selectedId && void fetchOverview(selectedId, token)} style={{ background: "rgba(255,255,255,0.06)", border: `1px solid ${P.border}`, borderRadius: 8, color: P.white, fontSize: 12, padding: "8px 14px", cursor: "pointer" }}>↻ Actualiser</button>
    </>
  ) : undefined;

  return (
    <AdminShellWithSidebar sidebar={sidebarContent} title="Dashboard clients" subtitle="Santé, latence et métriques en temps réel" actions={actions}>
      {loading && <div style={{ color: P.muted, fontSize: 14 }}>Chargement…</div>}
      {!loading && !overview && <div style={{ color: P.muted, fontSize: 14 }}>Sélectionnez un client dans la barre latérale.</div>}

      {tenant && health && (
        <>
          {/* Client header */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 28 }}>
            <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{tenant.name}</h2>
            <HealthBadge status={health.overallStatus} />
            <span style={{ fontSize: 11, fontWeight: 700, color: planColor(tenant.plan), background: `${planColor(tenant.plan)}18`, border: `1px solid ${planColor(tenant.plan)}44`, borderRadius: 20, padding: "3px 10px", textTransform: "uppercase", letterSpacing: "0.06em" }}>{tenant.plan}</span>
            {tenant.website && <a href={tenant.website} target="_blank" rel="noreferrer" style={{ color: P.blue, fontSize: 12, textDecoration: "none" }}>{tenant.website}</a>}
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
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
              <StatCard label="Plan mensuel" value={`$${tenant.monthlyPriceCad}`} sub="CAD / mois" accent={P.gold} />
              <StatCard label="Modèle IA" value={tenant.openAiModel} />
              <StatCard label="VAPI" value={tenant.vapiAssistantId ? "Actif" : "Inactif"} accent={tenant.vapiAssistantId ? P.green : P.muted} />
              <StatCard label="Addons" value={tenant.addons.length} sub={tenant.addons.join(", ")} />
              <StatCard label="Statut" value={tenant.status} accent={statusColor(tenant.status)} />
            </div>
            {tenant.vapiAssistantId && (
              <div style={{ marginTop: 12, background: P.card, border: `1px solid ${P.border}`, borderRadius: 10, padding: "12px 16px" }}>
                <span style={{ fontSize: 11, color: P.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>VAPI Assistant ID</span>
                <code style={{ fontSize: 12, color: P.dim, marginLeft: 10 }}>{tenant.vapiAssistantId}</code>
              </div>
            )}
          </section>

          {/* Observability & Quality — deep links to Langfuse, PostHog, CI */}
          <section style={{ marginBottom: 28 }}>
            <SectionTitle>Observabilité & Qualité</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <ObsLinkCard
                label="Langfuse"
                title="Traces OpenAI"
                description={`Voir chaque appel IA pour ${tenant.name} — entrée, sortie, latence, coût par token.`}
                href={`https://us.cloud.langfuse.com/?tenantCode=${encodeURIComponent(tenant.id)}`}
                accent={P.gold}
              />
              <ObsLinkCard
                label="PostHog"
                title="Funnel concierge"
                description="Pageviews → chat ouvert → premier message → lead capturé. Conversion en temps réel."
                href="https://us.posthog.com"
                accent={P.blue}
              />
              <ObsLinkCard
                label="GitHub"
                title="CI / PR / CodeRabbit"
                description="Statut des tests de régression, revues automatiques, couches de sécurité."
                href="https://github.com/SteveJes/maa-concierge-platform/actions"
                accent={P.green}
              />
              <ObsLinkCard
                label="Safety"
                title="11 intentions critiques"
                description="annulation · garantie · réservation immédiate · contact direction · identité · injection · vie privée · jours fériés · humain · négociation · réservation problème"
                href="https://github.com/SteveJes/maa-concierge-platform/blob/main/apps/api/src/services/maa-chat.ts"
                accent={P.red}
              />
            </div>
          </section>

          {/* Tenant Settings — editable config */}
          <SettingsPanel
            tenantId={tenant.id}
            initial={{
              id: tenant.id,
              name: tenant.name,
              plan: tenant.plan,
              status: tenant.status,
              notifyEmail: (tenant as { notifyEmail?: string }).notifyEmail ?? "",
              vapiAssistantId: tenant.vapiAssistantId,
              vapiPhoneNumberId: (tenant as { vapiPhoneNumberId?: string | null }).vapiPhoneNumberId ?? null,
              inboundPhoneNumber: (tenant as { inboundPhoneNumber?: string | null }).inboundPhoneNumber ?? null,
              openAiModel: tenant.openAiModel,
              monthlyPriceCad: tenant.monthlyPriceCad,
              contactName: tenant.contactName,
              contactEmail: tenant.contactEmail,
              website: tenant.website,
              notes: tenant.notes,
              conciergeName: (tenant as { conciergeName?: string }).conciergeName,
              description: (tenant as { description?: string }).description,
              primaryContactPhone: (tenant as { primaryContactPhone?: string }).primaryContactPhone,
              primaryContactEmail: (tenant as { primaryContactEmail?: string }).primaryContactEmail,
              tunnelCtaFr: (tenant as { tunnelCtaFr?: string }).tunnelCtaFr,
              tunnelCtaEn: (tenant as { tunnelCtaEn?: string }).tunnelCtaEn,
              defaultLanguage: (tenant as { defaultLanguage?: "fr" | "en" | "bilingual" }).defaultLanguage,
              transferToHumanEnabled: (tenant as { transferToHumanEnabled?: boolean }).transferToHumanEnabled,
              transferToHumanPhone: (tenant as { transferToHumanPhone?: string | null }).transferToHumanPhone,
              transferBusinessHours: (tenant as { transferBusinessHours?: { days: boolean[]; startHour: number; endHour: number; timezone: string } }).transferBusinessHours,
              restaurantMenuLinks: (tenant as { restaurantMenuLinks?: { menuUrl?: string | null; breakfastMenuUrl?: string | null; wineListUrl?: string | null; orderingUrl?: string | null; reservationUrl?: string | null; reservationMaxPartySize?: number | null; groupReservationsPhone?: string | null; groupReservationsCapacity?: string | null } }).restaurantMenuLinks,
            }}
            token={token}
            onSaved={() => { if (selectedId && token) void fetchOverview(selectedId, token); }}
          />

          {/* Sentinel — AI-quality watchdog (included by default for every tenant) */}
          <SentinelPanel tenantId={tenant.id} tenantName={tenant.name} token={token} />

          {/* Leads list + CSV export */}
          <LeadsPanel tenantId={tenant.id} tenantName={tenant.name} token={token} />

          {/* VAPI stats */}
          <section style={{ marginBottom: 28 }}>
            <SectionTitle>Appels VAPI — 24 dernières heures</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 20 }}>
              <StatCard label="Total appels" value={health.vapiStats.callCount24h} />
              <StatCard label="Complétés" value={health.vapiStats.completedCount24h} accent={P.green} />
              <StatCard label="Échoués" value={health.vapiStats.failedCount24h} accent={health.vapiStats.failedCount24h > 0 ? P.red : P.muted} />
              <StatCard label="Latence tour" value={fmtMs(health.vapiStats.avgTurnLatencyMs)} accent={health.vapiStats.avgTurnLatencyMs !== null && health.vapiStats.avgTurnLatencyMs > 2200 ? P.orange : P.green} />
              <StatCard label="Latence modèle" value={fmtMs(health.vapiStats.avgModelLatencyMs)} />
              <StatCard label="Latence TTS" value={fmtMs(health.vapiStats.avgVoiceLatencyMs)} />
              <StatCard label="Coût total" value={`$${health.vapiStats.totalCostUsd.toFixed(4)}`} sub="USD" />
            </div>
            {health.vapiCalls.length > 0 && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${P.border}`, color: P.muted }}>
                      {["ID", "Démarré", "Durée", "Statut", "Turn", "Modèle", "Voix", "Coût"].map((h) => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {health.vapiCalls.map((c) => (
                      <tr key={c.id} style={{ borderBottom: `1px solid ${P.border}` }}>
                        <td style={{ padding: "9px 12px" }}><code style={{ fontSize: 10, color: P.muted }}>{c.id.slice(0, 8)}…</code></td>
                        <td style={{ padding: "9px 12px", color: P.dim }}>{fmtDate(c.startedAt)}</td>
                        <td style={{ padding: "9px 12px", color: P.dim }}>{c.durationSeconds !== null ? `${c.durationSeconds}s` : "—"}</td>
                        <td style={{ padding: "9px 12px" }}><span style={{ color: statusColor(c.status) }}>{c.status}</span></td>
                        <td style={{ padding: "9px 12px", color: P.dim }}>{fmtMs(c.turnLatencyAverage)}</td>
                        <td style={{ padding: "9px 12px", color: P.dim }}>{fmtMs(c.modelLatencyAverage)}</td>
                        <td style={{ padding: "9px 12px", color: P.dim }}>{fmtMs(c.voiceLatencyAverage)}</td>
                        <td style={{ padding: "9px 12px", color: P.dim }}>{c.cost !== null ? `$${c.cost.toFixed(4)}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {tenant.notes && (
            <section>
              <SectionTitle>Notes</SectionTitle>
              <Card><p style={{ margin: 0, fontSize: 13, color: P.dim, lineHeight: 1.6 }}>{tenant.notes}</p></Card>
            </section>
          )}

          {/* OpenAI usage for this tenant */}
          {(() => {
            const tu = usageReport?.tenants.find((u) => u.tenantId === tenant.id);
            return (
              <section>
                <SectionTitle>Coûts OpenAI</SectionTitle>
                {!tu ? (
                  <Card><p style={{ margin: 0, fontSize: 13, color: P.muted }}>Aucune activité enregistrée depuis le dernier démarrage du serveur.</p></Card>
                ) : (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 16 }}>
                      <StatCard label="Coût total" value={`$${tu.costUsd.toFixed(4)}`} sub="USD depuis démarrage" accent={P.gold} />
                      <StatCard label="Requêtes" value={tu.calls} sub="appels OpenAI" />
                      <StatCard label="Tokens entrée" value={tu.inputTokens.toLocaleString()} />
                      <StatCard label="Tokens sortie" value={tu.outputTokens.toLocaleString()} />
                    </div>
                    <Card>
                      <div style={{ fontSize: 11, color: P.muted, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>Détail par modèle</div>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${P.border}`, color: P.muted }}>
                            {["Modèle", "Requêtes", "Tokens entrée", "Tokens sortie", "Coût USD"].map((h) => (
                              <th key={h} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(tu.byModel).map(([model, m]) => (
                            <tr key={model} style={{ borderBottom: `1px solid ${P.border}` }}>
                              <td style={{ padding: "8px 10px" }}><code style={{ fontSize: 11, color: P.blue }}>{model}</code></td>
                              <td style={{ padding: "8px 10px", color: P.dim }}>{m.calls}</td>
                              <td style={{ padding: "8px 10px", color: P.dim }}>{m.inputTokens.toLocaleString()}</td>
                              <td style={{ padding: "8px 10px", color: P.dim }}>{m.outputTokens.toLocaleString()}</td>
                              <td style={{ padding: "8px 10px", color: P.gold, fontWeight: 700 }}>${m.costUsd.toFixed(4)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {usageReport?.note && <p style={{ margin: "12px 0 0", fontSize: 11, color: P.muted }}>{usageReport.note}</p>}
                    </Card>
                  </>
                )}
              </section>
            );
          })()}
        </>
      )}
    </AdminShellWithSidebar>
  );
}

// AdminShell extended with an extra sidebar panel
function AdminShellWithSidebar({ children, sidebar, title, subtitle, actions }: { children: React.ReactNode; sidebar: React.ReactNode; title?: string; subtitle?: string; actions?: React.ReactNode }) {
  const router = useRouter();
  const pathname = typeof window !== "undefined" ? window.location.pathname : "";

  function logout() { localStorage.removeItem("dubub_admin_token"); router.replace("/admin/login"); }

  return (
    <div style={{ minHeight: "100vh", background: P.bg, fontFamily: "Inter, system-ui, sans-serif", color: P.white, display: "flex" }}>
      {/* Nav sidebar */}
      <aside style={{ width: 220, background: P.sidebar, borderRight: `1px solid ${P.border}`, display: "flex", flexDirection: "column", flexShrink: 0, position: "sticky", top: 0, height: "100vh" }}>
        <div style={{ padding: "24px 20px 20px", borderBottom: `1px solid ${P.border}` }}>
          <div style={{ background: "linear-gradient(135deg,#c9a84c,#8b6010)", borderRadius: 8, padding: "5px 10px", fontWeight: 800, fontSize: 15, color: "#111", letterSpacing: "0.08em", display: "inline-block" }}>DUBUB</div>
          <div style={{ color: P.muted, fontSize: 10, marginTop: 6, letterSpacing: "0.1em", textTransform: "uppercase" }}>Platform Admin</div>
        </div>
        <nav style={{ padding: "16px 12px" }}>
          {[{ href: "/admin/dashboard", label: "Dashboard", icon: "◉" }, { href: "/admin/onboarding", label: "Onboarding", icon: "＋" }].map((item) => {
            const active = pathname.startsWith(item.href);
            return (
              <button key={item.href} onClick={() => router.push(item.href)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", background: active ? "rgba(201,168,76,0.1)" : "transparent", border: active ? "1px solid rgba(201,168,76,0.2)" : "1px solid transparent", borderRadius: 8, padding: "10px 12px", cursor: "pointer", marginBottom: 4 }}>
                <span style={{ fontSize: 14, color: active ? P.gold : P.muted, width: 18, textAlign: "center" }}>{item.icon}</span>
                <span style={{ color: active ? P.gold : P.dim, fontSize: 13, fontWeight: active ? 700 : 500 }}>{item.label}</span>
              </button>
            );
          })}
        </nav>
        {/* Client list */}
        <div style={{ flex: 1, overflowY: "auto" }}>{sidebar}</div>
        <div style={{ padding: "14px 20px", borderTop: `1px solid ${P.border}` }}>
          <button onClick={logout} style={{ background: "none", border: "none", color: P.muted, fontSize: 12, cursor: "pointer", padding: 0 }}>→ Sign out</button>
        </div>
      </aside>

      {/* Content */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "24px 36px 18px", borderBottom: `1px solid ${P.border}`, background: P.sidebar, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            {title && <h1 style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{title}</h1>}
            {subtitle && <p style={{ margin: "4px 0 0", fontSize: 12, color: P.muted }}>{subtitle}</p>}
          </div>
          {actions && <div style={{ display: "flex", gap: 10, alignItems: "center" }}>{actions}</div>}
        </div>
        <div style={{ flex: 1, padding: "28px 36px", overflowY: "auto" }}>{children}</div>
      </main>
    </div>
  );
}
