"use client";

/**
 * Sentinel — premium AI-quality watchdog page for the portal.
 *
 * Mirrors the gold-on-ivory glass aesthetic from /admin/portal: glass cards,
 * status pills, gold-gradient KPIs on the headline numbers, a runs timeline.
 *
 * Data: /v1/admin/sentinel/runs (filtered by tenant). Strict tenant isolation.
 */
import { useEffect, useState, useCallback } from "react";
import { Sidebar } from "../../../../components/ui/Sidebar";
import { TopBar } from "../../../../components/ui/TopBar";
import { Card, CardHeader, Pill } from "../../../../components/ui/Card";
import { Stat } from "../../../../components/ui/Stat";
import { Button } from "../../../../components/ui/Button";
import {
  LayoutDashboard, MessageSquare, Users, Sparkles, Settings as SettingsIcon,
  Globe, RefreshCw, Play, Plus, ShieldCheck, AlertTriangle, Clock, Activity,
  ChevronRight, ChevronDown, ExternalLink,
} from "lucide-react";

const NAV = [
  { label: "Overview",       href: "/admin/portal",         icon: <LayoutDashboard size={16} /> },
  { label: "Conversations",  href: "/admin/conversations",  icon: <MessageSquare size={16} /> },
  { label: "Leads",          href: "/admin/leads",          icon: <Users size={16} /> },
  { label: "Sentinel",       href: "/admin/portal/sentinel", icon: <Sparkles size={16} /> },
  { label: "Tenants",        href: "/admin/portal/tenants", icon: <Globe size={16} /> },
  { label: "Settings",       href: "/admin/settings",       icon: <SettingsIcon size={16} /> },
];

const TENANTS = [
  { id: "maa", label: "Club Sportif MAA" },
  { id: "dubub", label: "DUBUB — SophIA" },
];

interface SentinelRunSummary {
  file: string;
  tenantCode: string;
  timestamp: string;
  mode: "live" | "in-process";
  judge: boolean;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  failures: Array<{ id: string; label: string; reason?: string }>;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://api.dubub.com";

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-CA", {
    timeZone: "America/Montreal",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function fmtRelative(iso: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "à l'instant";
  if (mins < 60) return `il y a ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `il y a ${hrs} h`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `il y a ${days} j`;
  return fmtDate(iso);
}

function rateTone(rate: number): "success" | "warning" | "danger" {
  if (rate >= 95) return "success";
  if (rate >= 80) return "warning";
  return "danger";
}

export default function SentinelPortalPage() {
  const [tenant, setTenant] = useState("maa");
  const [runs, setRuns] = useState<SentinelRunSummary[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const tenantName = TENANTS.find((t) => t.id === tenant)?.label ?? tenant;

  const fetchRuns = useCallback(async () => {
    try {
      setRefreshing(true);
      setError(null);
      const token = typeof window !== "undefined" ? window.localStorage.getItem("admin-token") ?? "" : "";
      const res = await fetch(
        `${API}/v1/admin/sentinel/runs?tenant=${encodeURIComponent(tenant)}&limit=12`,
        { headers: { "x-admin-token": token } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { runs?: SentinelRunSummary[] };
      setRuns(data.runs ?? []);
    } catch (err) {
      setError((err as Error).message);
      setRuns([]);
    } finally {
      setRefreshing(false);
    }
  }, [tenant]);

  useEffect(() => { void fetchRuns(); }, [fetchRuns]);

  const latest = runs && runs.length > 0 ? runs[0] : null;
  const trend = runs && runs.length >= 2
    ? Math.round(latest!.passRate - runs[1]!.passRate)
    : 0;

  // Aggregate categories of failures (gym/spa/clinique/etc.) from recent runs
  const allFailures = runs?.flatMap((r) => r.failures) ?? [];

  return (
    <div className="light-portal flex min-h-screen">
      <Sidebar
        items={NAV}
        footer={
          <div className="text-xs text-[var(--text-subtle)]">
            <div className="font-medium text-[var(--text-muted)]">Sentinel</div>
            <div className="mt-0.5">QA continu · juge IA</div>
          </div>
        }
      />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar
          title="Sentinel"
          subtitle={`${tenantName} · audit qualité du concierge IA`}
          tenants={TENANTS}
          activeTenant={tenant}
          onTenantChange={setTenant}
          right={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="ghost" iconLeft={<RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />} onClick={() => void fetchRuns()}>
                Rafraîchir
              </Button>
              <Button size="sm" variant="outline" iconLeft={<Plus size={14} />}>
                Générer scénarios
              </Button>
              <Button size="sm" iconLeft={<Play size={14} />}>
                Lancer un audit
              </Button>
            </div>
          }
        />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Hero KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat
              glass gold
              label="Dernier taux de réussite"
              value={latest ? `${latest.passRate} %` : "—"}
              delta={latest ? { value: `${trend >= 0 ? "+" : ""}${trend} pts`, direction: trend >= 0 ? "up" : "down" } : undefined}
              icon={<ShieldCheck size={16} />}
            />
            <Stat
              glass
              label="Scénarios couverts"
              value={latest ? `${latest.passed} / ${latest.total}` : "—"}
              icon={<Sparkles size={16} />}
            />
            <Stat
              glass
              label="Échecs récents"
              value={latest ? String(latest.failed) : "—"}
              icon={<AlertTriangle size={16} />}
            />
            <Stat
              glass
              label="Dernière exécution"
              value={latest ? fmtRelative(latest.timestamp) : "—"}
              icon={<Clock size={16} />}
            />
          </div>

          {error ? (
            <Card glass>
              <div className="flex items-center gap-3 text-[var(--danger)]">
                <AlertTriangle size={18} />
                <div>
                  <div className="font-medium">Erreur de chargement</div>
                  <div className="text-sm text-[var(--text-muted)]">{error} — vérifiez votre token admin.</div>
                </div>
              </div>
            </Card>
          ) : null}

          {runs && runs.length === 0 && !error ? (
            <Card glass>
              <div className="text-center py-10">
                <div className="inline-flex w-12 h-12 rounded-full bg-[var(--brand-gold-soft)] text-[var(--brand-gold-strong)] items-center justify-center mx-auto mb-3">
                  <Sparkles size={20} />
                </div>
                <h3 className="text-base font-semibold text-[var(--text)] mb-1">Aucune exécution Sentinel</h3>
                <p className="text-sm text-[var(--text-muted)] mb-4">Lancez un premier audit pour voir apparaître les résultats ici.</p>
                <Button size="sm" iconLeft={<Play size={14} />}>Lancer un audit</Button>
              </div>
            </Card>
          ) : null}

          {/* Runs timeline */}
          {runs && runs.length > 0 ? (
            <Card glass>
              <CardHeader
                title="Historique des audits"
                subtitle="Chaque ligne est une exécution complète notée par le juge IA"
                action={<Pill tone={latest && latest.passRate >= 95 ? "success" : "warning"}>
                  {latest ? `${latest.passRate} %` : "—"}
                </Pill>}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                      <th className="pb-3 font-medium">Date</th>
                      <th className="pb-3 font-medium">Mode</th>
                      <th className="pb-3 font-medium">Juge</th>
                      <th className="pb-3 font-medium">Réussite</th>
                      <th className="pb-3 font-medium">Échecs</th>
                      <th className="pb-3 font-medium text-right">Détails</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <RunRow
                        key={run.file}
                        run={run}
                        expanded={expanded === run.file}
                        onToggle={() => setExpanded(expanded === run.file ? null : run.file)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          {/* Recent failures (rolled up) */}
          {allFailures.length > 0 ? (
            <Card glass>
              <CardHeader
                title="Scénarios à revoir"
                subtitle={`${allFailures.length} échecs sur les ${runs?.length ?? 0} dernières exécutions`}
                action={<Pill tone="danger">{allFailures.length}</Pill>}
              />
              <ul className="divide-y divide-[var(--border)]">
                {allFailures.slice(0, 8).map((f, i) => (
                  <li key={`${f.id}-${i}`} className="py-3 flex items-start gap-3">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-[rgba(208,74,74,0.10)] text-[var(--danger)] flex items-center justify-center">
                      <AlertTriangle size={13} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-[var(--text)]">{f.label}</div>
                      <div className="text-xs text-[var(--text-subtle)] mt-0.5"><code className="text-[10px] bg-black/[0.04] px-1.5 py-0.5 rounded">{f.id}</code></div>
                      {f.reason ? <div className="text-xs text-[var(--text-muted)] mt-1.5">↳ {f.reason}</div> : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          {/* Commands footer */}
          <Card glass>
            <CardHeader title="Commandes Sentinel" subtitle="Pour les ingénieurs DUBUB" />
            <div className="space-y-2 text-xs">
              <CommandLine label="Audit complet" cmd={`pnpm.cmd --filter @platform/api test:scenarios --tenant ${tenant}`} />
              <CommandLine label="Génération scénarios (8 propositions)" cmd={`pnpm.cmd --filter @platform/api sentinel:generate --tenant ${tenant}`} />
              <CommandLine label="Audit sans juge IA (rapide)" cmd={`pnpm.cmd --filter @platform/api test:scenarios --no-judge --tenant ${tenant}`} />
            </div>
            <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center gap-2 text-xs text-[var(--text-muted)]">
              <Activity size={12} className="text-[var(--brand-gold-strong)]" />
              <span>Cron quotidien — audit auto avant l'envoi du daily digest à 7h.</span>
              <a className="ml-auto inline-flex items-center gap-1 text-[var(--brand-gold-strong)] hover:underline" href="https://us.cloud.langfuse.com" target="_blank" rel="noreferrer">
                Voir dans Langfuse <ExternalLink size={11} />
              </a>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}

function RunRow({
  run, expanded, onToggle,
}: {
  run: SentinelRunSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  const tone = rateTone(run.passRate);
  return (
    <>
      <tr
        className="border-t border-[var(--border)] hover:bg-black/[0.02] transition-colors cursor-pointer"
        onClick={() => run.failures.length > 0 && onToggle()}
      >
        <td className="py-3 whitespace-nowrap text-[var(--text)] font-medium">{fmtDate(run.timestamp)}</td>
        <td className="py-3"><Pill tone={run.mode === "live" ? "gold" : "neutral"}>{run.mode === "live" ? "Prod" : "Local"}</Pill></td>
        <td className="py-3"><Pill tone={run.judge ? "success" : "neutral"}>{run.judge ? "GPT-4o" : "off"}</Pill></td>
        <td className="py-3">
          <span className="inline-flex items-center gap-2">
            <Pill tone={tone}>{run.passRate} %</Pill>
            <span className="text-xs text-[var(--text-muted)]">{run.passed}/{run.total}</span>
          </span>
        </td>
        <td className="py-3">
          {run.failed > 0
            ? <Pill tone="danger">{run.failed}</Pill>
            : <Pill tone="success">0</Pill>}
        </td>
        <td className="py-3 text-right text-[var(--text-subtle)]">
          {run.failures.length > 0
            ? (expanded ? <ChevronDown size={14} className="inline" /> : <ChevronRight size={14} className="inline" />)
            : "—"}
        </td>
      </tr>
      {expanded && run.failures.length > 0 ? (
        <tr>
          <td colSpan={6} className="py-4 bg-black/[0.02]">
            <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--text-subtle)] mb-2">Scénarios en échec</div>
            <ul className="space-y-2 text-sm">
              {run.failures.map((f) => (
                <li key={f.id} className="flex items-start gap-2">
                  <code className="text-[10px] bg-white/70 border border-[var(--border)] px-1.5 py-0.5 rounded shrink-0 mt-0.5">{f.id}</code>
                  <div className="min-w-0">
                    <div className="text-[var(--text)]">{f.label}</div>
                    {f.reason ? <div className="text-xs text-[var(--text-muted)] mt-0.5">↳ {f.reason}</div> : null}
                  </div>
                </li>
              ))}
            </ul>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function CommandLine({ label, cmd }: { label: string; cmd: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.08em] text-[var(--text-subtle)] mb-1">{label}</div>
      <code className="block bg-black/[0.04] border border-[var(--border)] px-3 py-2 rounded-md font-mono text-[11px] text-[var(--text)] overflow-x-auto">
        {cmd}
      </code>
    </div>
  );
}
