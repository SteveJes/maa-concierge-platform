"use client";

/**
 * Quality & Activity panel — surfaces the eval framework's work for Steve
 * and Daphné. What you see here:
 *   1. Latest Sentinel run with failure-type breakdown (so you can tell at a
 *      glance: are the failures source-leaks, premature callbacks, KB gaps?).
 *   2. Golden YAML scenario count — how many Daphné-editable test cases live
 *      under apps/api/src/scenarios/golden/.
 *   3. Active subagents (.claude/agents/) — the specialized assistants the
 *      eval framework can dispatch (eval-test-designer, kb-editor, etc.).
 *   4. One-click open of the markdown report for the latest run.
 */
import { useCallback, useEffect, useState } from "react";
import { P, API, Card, SectionTitle } from "../_components/AdminShell";

interface FailureDetail {
  id: string;
  label: string;
  failureType: string;
  failureReason: string | null;
  assistantMessage: string;
  judgeVerdict: { verdict: string; reasoning: string } | null;
}

interface Overview {
  latestRun: {
    timestamp: string;
    tenantCode: string;
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    failureTypeBreakdown: Record<string, number>;
    failures: FailureDetail[];
    reportFile: string | null;
  } | null;
  goldenScenarios: { count: number; files: string[] };
  links: { sentinelRunsDir: string; goldenDir: string; agentsDir: string };
}

const FAILURE_OWNER: Record<string, { agent: string; surface: string }> = {
  source_leak: { agent: "/eval-test-designer", surface: "apps/api/src/prompts/maa-chat-system-v2.ts (SOURCE PRIVACY)" },
  premature_callback: { agent: "Prompt review", surface: "FOLLOW-UP MODE rule" },
  repetition: { agent: "/rag-failure-analyst", surface: "services/maa-chat.ts (resolveShortAffirmativeFollowUp)" },
  model_hallucination: { agent: "/rag-failure-analyst → /kb-editor", surface: "matching section JSON" },
  missing_knowledge: { agent: "/kb-editor", surface: "apps/api/src/knowledge/maa-v2/sections/" },
  bad_retrieval: { agent: "/rag-failure-analyst", surface: "relevantSectionsForMessage regex" },
  conflicting_kb: { agent: "/kb-editor", surface: "sources-vivantes.json + matching section" },
  french_localization_issue: { agent: "/fr-qc-reviewer", surface: "BILINGUAL POLICY + STRICT LANGUAGE LOCK" },
  sales_quality_issue: { agent: "/fr-qc-reviewer", surface: "UPSELL RULES + voice-tone.json" },
  prompt_problem: { agent: "Prompt author", surface: "apps/api/src/prompts/maa-chat-system-v2.ts" },
  slow_response: { agent: "Performance review", surface: "answerMaaChat tracing" },
  ui_bug: { agent: "/playwright-qa-engineer", surface: "packages/ui-chat/src/index.tsx" },
  unknown: { agent: "Manual triage", surface: "Read reply + tag failure_type" },
};

interface AgentDef { name: string; description: string; tools: string[] }

interface Props {
  tenantId: string;
  token: string;
}

const FAILURE_LABELS: Record<string, { label: string; tone: "info" | "warn" | "danger" }> = {
  source_leak: { label: "🔒 Source leak", tone: "danger" },
  premature_callback: { label: "📋 Premature callback", tone: "danger" },
  repetition: { label: "🔁 Repetition", tone: "warn" },
  model_hallucination: { label: "👻 Hallucination", tone: "danger" },
  missing_knowledge: { label: "📚 Missing knowledge", tone: "warn" },
  bad_retrieval: { label: "🔍 Bad retrieval", tone: "warn" },
  conflicting_kb: { label: "⚖️ Conflicting KB", tone: "warn" },
  french_localization_issue: { label: "🇫🇷 FR / QC", tone: "warn" },
  sales_quality_issue: { label: "💰 Sales quality", tone: "info" },
  prompt_problem: { label: "📝 Prompt", tone: "info" },
  slow_response: { label: "🐌 Slow", tone: "warn" },
  ui_bug: { label: "🖥️ UI bug", tone: "warn" },
  unknown: { label: "❓ Unclassified", tone: "info" },
};

function toneColor(t: "info" | "warn" | "danger"): string {
  if (t === "danger") return P.red;
  if (t === "warn") return P.orange;
  return P.blue;
}

interface HistoryRun {
  timestamp: string;
  tenantCode: string;
  mode: string;
  judge: boolean;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  failureTypes: Record<string, number>;
}

interface RunStatus {
  running: boolean;
  completed?: boolean;
  pid?: number;
  tenant?: string;
  judge?: boolean;
  startedAt?: string;
  elapsedMs?: number;
  passed?: number;
  failed?: number;
  processedCount?: number;
  logTail?: string;
}

interface RemediationPlan {
  file: string;
  tenantCode?: string;
  failureCount: number;
  passRate: number | null;
  markdown: string;
}

interface CostsBucket {
  date?: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  byTenant: Record<string, number>;
}
interface CostsResponse {
  today: CostsBucket;
  last7Days: CostsBucket;
  last30Days: CostsBucket;
  dailyByTenant: Array<{ date: string; costUsd: number; byTenant: Record<string, number> }>;
  budget: { dailyTargetUsd: number; todayPctOfDailyTarget: number };
}

export default function QualityPanel({ tenantId, token }: Props) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [agents, setAgents] = useState<AgentDef[] | null>(null);
  const [history, setHistory] = useState<HistoryRun[] | null>(null);
  const [reportText, setReportText] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [runStatus, setRunStatus] = useState<string | null>(null);
  const [live, setLive] = useState<RunStatus | null>(null);
  const [costs, setCosts] = useState<CostsResponse | null>(null);
  const [remediation, setRemediation] = useState<RemediationPlan | null>(null);
  const [showRemediation, setShowRemediation] = useState(false);

  const refreshAll = useCallback(() => {
    fetch(`${API}/v1/admin/quality/overview?tenant=${encodeURIComponent(tenantId)}`, {
      headers: { "x-admin-token": token },
    })
      .then((r) => r.json())
      .then((data: Overview) => setOverview(data))
      .catch(() => setOverview(null));
    fetch(`${API}/v1/admin/quality/history?tenant=${encodeURIComponent(tenantId)}&limit=30`, {
      headers: { "x-admin-token": token },
    })
      .then((r) => r.json())
      .then((data: { runs: HistoryRun[] }) => setHistory(data.runs))
      .catch(() => setHistory([]));
    fetch(`${API}/v1/admin/quality/costs?days=14`, { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((data: CostsResponse) => setCosts(data))
      .catch(() => setCosts(null));
    fetch(`${API}/v1/admin/quality/remediation?tenant=${encodeURIComponent(tenantId)}`, {
      headers: { "x-admin-token": token },
    })
      .then((r) => r.json())
      .then((data: { plan: RemediationPlan | null }) => setRemediation(data.plan))
      .catch(() => setRemediation(null));
  }, [tenantId, token]);

  useEffect(() => {
    refreshAll();
    fetch(`${API}/v1/admin/quality/agents`, { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((data: { agents: AgentDef[] }) => setAgents(data.agents))
      .catch(() => setAgents([]));
  }, [refreshAll, token]);

  // Live polling — every 3s while a run is in flight. When the server reports
  // completed=true we refresh overview + history once and stop polling.
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    async function tick() {
      try {
        const res = await fetch(`${API}/v1/admin/quality/run-status`, {
          headers: { "x-admin-token": token },
        });
        if (!res.ok) return;
        const data = (await res.json()) as RunStatus;
        if (stopped) return;
        setLive(data);
        if (data.completed) {
          // run just finished — pull fresh overview + history then stop
          refreshAll();
          setRunStatus(null);
          // Clear the completed banner after 5s
          setTimeout(() => { if (!stopped) setLive(null); }, 5000);
          return;
        }
      } catch {
        // network blip — keep polling
      }
      timer = setTimeout(() => { if (!stopped) void tick(); }, 3000);
    }
    void tick();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tenantId]);

  async function openReport(file: string) {
    setShowReport(true);
    setReportText("Chargement…");
    const res = await fetch(`${API}/v1/admin/quality/report/${encodeURIComponent(file)}`, {
      headers: { "x-admin-token": token },
    });
    setReportText(res.ok ? await res.text() : `Erreur ${res.status}`);
  }

  async function runSentinel(opts: { judge: boolean }) {
    setRunStatus(opts.judge ? "Démarrage (avec juge IA)…" : "Démarrage…");
    try {
      const res = await fetch(`${API}/v1/admin/quality/run-sentinel`, {
        method: "POST",
        headers: { "x-admin-token": token, "Content-Type": "application/json" },
        body: JSON.stringify({ tenant: tenantId, judge: opts.judge }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const body = (await res.json()) as { message?: string };
      setRunStatus(body.message ?? (opts.judge
        ? "Lancée avec juge IA. Suite + jugement = ~5-10 min. Rafraîchir ensuite."
        : "Lancée. La suite dure 2-5 minutes — rafraîchir ensuite."));
      setTimeout(() => setRunStatus(null), 15000);
    } catch (err) {
      setRunStatus(`Erreur : ${(err as Error).message}`);
    }
  }

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionTitle>Qualité & activité — agents, tests, évaluations</SectionTitle>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <Card>
        {/* Live run banner — visible whenever a Sentinel run is in flight or
            just finished. Streams scenario progress + the log tail so Daphné
            & Steve can see exactly what's happening, not a blank screen. */}
        {live && (live.running || live.completed) && (
          <div
            style={{
              marginBottom: 16,
              padding: "12px 16px",
              borderRadius: 12,
              border: `1px solid ${live.completed ? `${P.green}44` : `${P.gold}55`}`,
              background: live.completed ? `${P.green}10` : `${P.gold}10`,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {live.running ? (
                  <span
                    aria-hidden="true"
                    style={{
                      width: 12,
                      height: 12,
                      borderRadius: "50%",
                      border: `2px solid ${P.gold}`,
                      borderTopColor: "transparent",
                      animation: "spin 0.8s linear infinite",
                      display: "inline-block",
                    }}
                  />
                ) : (
                  <span style={{ color: P.green, fontWeight: 800 }}>✓</span>
                )}
                <span style={{ fontSize: 13, fontWeight: 700, color: P.ink }}>
                  {live.completed
                    ? `Sentinel terminé — ${live.passed} réussis · ${live.failed} échecs`
                    : `Sentinel en cours${live.judge ? " (juge IA)" : ""} — ${live.processedCount ?? 0} scénarios traités${typeof live.passed === "number" ? ` (${live.passed} OK · ${live.failed} KO)` : ""}`}
                </span>
              </div>
              <span style={{ fontSize: 11, color: P.muted }}>
                {live.elapsedMs ? `Écoulé : ${Math.floor(live.elapsedMs / 1000)}s` : ""}
              </span>
            </div>
            {live.logTail && (
              <pre
                style={{
                  margin: 0,
                  maxHeight: 140,
                  overflow: "auto",
                  background: "#0e0e14",
                  color: "#e0d8c0",
                  fontFamily: "ui-monospace, monospace",
                  fontSize: 11,
                  lineHeight: 1.45,
                  padding: "10px 12px",
                  borderRadius: 8,
                  whiteSpace: "pre-wrap",
                }}
              >
                {live.logTail.split("\n").slice(-12).join("\n")}
              </pre>
            )}
          </div>
        )}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginBottom: 14, alignItems: "center", flexWrap: "wrap" }}>
          {runStatus && (
            <span style={{ fontSize: 11, color: runStatus.startsWith("Erreur") ? P.red : P.green, fontWeight: 600 }}>
              {runStatus}
            </span>
          )}
          <button
            onClick={() => void runSentinel({ judge: false })}
            disabled={!!runStatus && !runStatus.startsWith("Erreur")}
            style={{
              background: "#ffffff",
              border: `1px solid ${P.border}`,
              borderRadius: 8,
              color: P.ink,
              fontWeight: 600,
              fontSize: 12,
              padding: "8px 14px",
              cursor: runStatus ? "default" : "pointer",
              opacity: runStatus ? 0.7 : 1,
            }}
            title="Test rapide (assertions seulement, sans juge IA — 2-5 min)"
          >
            ▶ Test rapide
          </button>
          <button
            onClick={() => void runSentinel({ judge: true })}
            disabled={!!runStatus && !runStatus.startsWith("Erreur")}
            style={{
              background: "linear-gradient(135deg,#c9a84c,#8b6010)",
              border: "none",
              borderRadius: 8,
              color: "#1a1610",
              fontWeight: 700,
              fontSize: 12,
              padding: "8px 16px",
              cursor: runStatus ? "default" : "pointer",
              boxShadow: "0 2px 6px rgba(201,168,76,0.28)",
              opacity: runStatus ? 0.7 : 1,
            }}
            title="Test complet avec juge IA — meilleure détection de tonalité, hallucination, qualité (5-10 min)"
          >
            ▶ Test complet avec juge IA
          </button>
        </div>

        {/* ── ACTION CENTER ── what to do next, per failure ───────────────── */}
        {overview?.latestRun && overview.latestRun.failures.length > 0 && (
          <ActionCenter
            run={overview.latestRun}
            history={history}
            onOpenReport={overview.latestRun.reportFile ? () => openReport(overview.latestRun!.reportFile!) : undefined}
            onOpenRemediation={remediation && remediation.failureCount > 0 ? () => setShowRemediation(true) : undefined}
            onRerun={() => void runSentinel({ judge: true })}
            rerunning={!!runStatus}
          />
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 24 }}>
          {/* Failure-type breakdown */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
              Dernière exécution Sentinel
            </div>
            {overview?.latestRun ? (
              <>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 28, fontWeight: 800, color: P.ink, lineHeight: 1 }}>
                    {overview.latestRun.passRate}%
                  </div>
                  <div style={{ fontSize: 12, color: P.muted }}>
                    {overview.latestRun.passed} / {overview.latestRun.total} scénarios réussis · {new Date(overview.latestRun.timestamp).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })}
                  </div>
                </div>

                {Object.keys(overview.latestRun.failureTypeBreakdown).length > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
                    {Object.entries(overview.latestRun.failureTypeBreakdown)
                      .sort((a, b) => b[1] - a[1])
                      .map(([type, count]) => {
                        const meta = FAILURE_LABELS[type] ?? FAILURE_LABELS.unknown!;
                        const c = toneColor(meta.tone);
                        return (
                          <span
                            key={type}
                            title={type}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "5px 11px",
                              borderRadius: 999,
                              background: `${c}14`,
                              border: `1px solid ${c}44`,
                              color: c,
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {meta.label}
                            <span style={{ background: c, color: "#fff", borderRadius: 999, padding: "1px 7px", fontSize: 10, fontWeight: 800 }}>{count}</span>
                          </span>
                        );
                      })}
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: P.green, marginBottom: 14, fontWeight: 600 }}>
                    ✓ Aucun échec — toutes les vérifications passent.
                  </div>
                )}

                {overview.latestRun.reportFile && (
                  <button
                    onClick={() => void openReport(overview.latestRun!.reportFile!)}
                    style={{
                      background: "#ffffff",
                      border: `1px solid ${P.border}`,
                      borderRadius: 8,
                      color: P.ink,
                      fontSize: 12,
                      fontWeight: 600,
                      padding: "8px 14px",
                      cursor: "pointer",
                      boxShadow: "0 1px 2px rgba(20,16,8,0.04)",
                    }}
                  >
                    Voir le rapport Markdown
                  </button>
                )}
                {remediation && remediation.failureCount > 0 && (
                  <button
                    onClick={() => setShowRemediation(true)}
                    style={{
                      marginLeft: 8,
                      background: "linear-gradient(135deg,#c9a84c,#8b6010)",
                      border: "none",
                      borderRadius: 8,
                      color: "#1a1610",
                      fontSize: 12,
                      fontWeight: 700,
                      padding: "8px 14px",
                      cursor: "pointer",
                      boxShadow: "0 2px 6px rgba(201,168,76,0.28)",
                    }}
                    title="Auto-suggested fixes for the latest run"
                  >
                    ⚙ {remediation.failureCount} correctifs proposés
                  </button>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: P.muted }}>Aucune exécution disponible — lancer une suite Sentinel.</div>
            )}
          </div>

          {/* Coverage + agents */}
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
              Couverture & Agents
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ background: "#ffffff", border: `1px solid ${P.border}`, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: P.muted, textTransform: "uppercase", letterSpacing: "0.10em" }}>Tests YAML</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: P.ink, lineHeight: 1.1, marginTop: 4 }}>
                  {overview?.goldenScenarios.count ?? "—"}
                </div>
                <div style={{ fontSize: 10, color: P.muted, marginTop: 2 }}>Daphné-éditables</div>
              </div>
              <div style={{ background: "#ffffff", border: `1px solid ${P.border}`, borderRadius: 10, padding: "10px 12px" }}>
                <div style={{ fontSize: 10, color: P.muted, textTransform: "uppercase", letterSpacing: "0.10em" }}>Agents spécialisés</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: P.ink, lineHeight: 1.1, marginTop: 4 }}>
                  {agents?.length ?? "—"}
                </div>
                <div style={{ fontSize: 10, color: P.muted, marginTop: 2 }}>actifs</div>
              </div>
            </div>

            {agents && agents.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {agents.map((a) => (
                  <div
                    key={a.name}
                    style={{
                      background: "#ffffff",
                      border: `1px solid ${P.border}`,
                      borderRadius: 10,
                      padding: "8px 12px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                      <span style={{ background: P.gold, color: "#1a1610", fontWeight: 800, fontSize: 10, padding: "1px 7px", borderRadius: 999, letterSpacing: "0.04em" }}>/{a.name}</span>
                    </div>
                    <div style={{ fontSize: 11, color: P.dim, lineHeight: 1.45 }}>{a.description.split(".")[0]}.</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Costs — OpenAI usage per tenant + daily budget */}
        {costs && (
          <div style={{ marginTop: 24, paddingTop: 20, borderTop: `1px solid ${P.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Coûts OpenAI — budget {costs.budget.dailyTargetUsd.toFixed(2)} $US / jour
              </div>
              <div style={{ fontSize: 11, color: P.muted }}>
                {costs.last7Days.calls.toLocaleString("fr-CA")} appels sur 7j · {costs.last30Days.calls.toLocaleString("fr-CA")} sur 30j
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
              <CostTile
                label="Aujourd'hui"
                amount={costs.today.costUsd}
                sub={`${costs.today.calls.toLocaleString("fr-CA")} appels · ${costs.budget.todayPctOfDailyTarget}% du budget`}
                warn={costs.budget.todayPctOfDailyTarget >= 80}
              />
              <CostTile label="7 derniers jours" amount={costs.last7Days.costUsd} sub={`${costs.last7Days.calls.toLocaleString("fr-CA")} appels`} />
              <CostTile label="30 derniers jours" amount={costs.last30Days.costUsd} sub={`${costs.last30Days.calls.toLocaleString("fr-CA")} appels`} />
            </div>
            {Object.keys(costs.last7Days.byTenant).length > 0 && (
              <div>
                <div style={{ fontSize: 10, color: P.muted, textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 8 }}>
                  Par tenant — 7 derniers jours
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {Object.entries(costs.last7Days.byTenant)
                    .sort((a, b) => b[1] - a[1])
                    .map(([tenant, amount]) => {
                      const pct = costs.last7Days.costUsd > 0 ? (amount / costs.last7Days.costUsd) * 100 : 0;
                      return (
                        <div key={tenant} style={{ display: "grid", gridTemplateColumns: "120px 1fr 80px", gap: 10, alignItems: "center" }}>
                          <span style={{ fontSize: 12, color: P.ink, fontWeight: 600 }}>{tenant}</span>
                          <div style={{ background: `${P.gold}14`, height: 12, borderRadius: 6, overflow: "hidden" }}>
                            <div style={{ background: P.gold, width: `${pct}%`, height: "100%", borderRadius: 6 }} />
                          </div>
                          <span style={{ fontSize: 11, color: P.dim, fontWeight: 700, textAlign: "right" }}>
                            {amount.toFixed(4)} $US
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trend — last 30 Sentinel runs */}
        {history && history.length > 1 && (
          <div style={{ marginTop: 28, paddingTop: 22, borderTop: `1px solid ${P.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: "uppercase", letterSpacing: "0.12em" }}>
                Tendance — {history.length} dernières exécutions
              </div>
              <div style={{ fontSize: 11, color: P.muted }}>
                {history.filter((r) => r.judge).length} avec juge IA · {history.filter((r) => !r.judge).length} en mode rapide
              </div>
            </div>
            <TrendChart runs={history} />
            <FailureDistribution runs={history} />
          </div>
        )}
      </Card>

      {showReport && (
        <div
          role="dialog"
          aria-label="Sentinel report"
          onClick={() => setShowReport(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(20,16,8,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              border: `1px solid ${P.border}`,
              borderRadius: 14,
              padding: "20px 24px",
              maxWidth: 880,
              maxHeight: "85vh",
              overflow: "auto",
              boxShadow: "0 22px 60px rgba(20,16,8,0.18)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <strong style={{ color: P.ink }}>Sentinel Report</strong>
              <button onClick={() => setShowReport(false)} style={{ background: "none", border: "none", cursor: "pointer", color: P.muted, fontSize: 16 }}>✕</button>
            </div>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace", fontSize: 12, color: P.ink, margin: 0 }}>{reportText ?? "Chargement…"}</pre>
          </div>
        </div>
      )}

      {showRemediation && remediation && (
        <div
          role="dialog"
          aria-label="Auto-suggested remediation"
          onClick={() => setShowRemediation(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(20,16,8,0.45)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#ffffff",
              border: `1px solid ${P.border}`,
              borderRadius: 14,
              padding: "20px 24px",
              maxWidth: 880,
              maxHeight: "85vh",
              overflow: "auto",
              boxShadow: "0 22px 60px rgba(20,16,8,0.18)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
              <div>
                <strong style={{ color: P.ink, fontSize: 15 }}>Plan de remédiation auto</strong>
                <div style={{ fontSize: 11, color: P.muted, marginTop: 2 }}>
                  {remediation.failureCount} correctif{remediation.failureCount > 1 ? "s" : ""} proposé{remediation.failureCount > 1 ? "s" : ""} · Pass rate {remediation.passRate}%
                </div>
              </div>
              <button onClick={() => setShowRemediation(false)} style={{ background: "none", border: "none", cursor: "pointer", color: P.muted, fontSize: 16 }}>✕</button>
            </div>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "ui-monospace, monospace", fontSize: 12, color: P.ink, margin: 0, lineHeight: 1.55 }}>{remediation.markdown}</pre>
          </div>
        </div>
      )}
    </section>
  );
}

/** SVG sparkline of pass rate over time. Each point is a Sentinel run.
 *  Judged runs get a gold dot, fast runs get a slim grey dot. */
function TrendChart({ runs }: { runs: HistoryRun[] }) {
  const W = 760;
  const H = 140;
  const PAD_L = 36;
  const PAD_R = 12;
  const PAD_T = 12;
  const PAD_B = 24;
  const plotW = W - PAD_L - PAD_R;
  const plotH = H - PAD_T - PAD_B;
  const xs = runs.map((_, i) => (runs.length === 1 ? plotW / 2 : (i / (runs.length - 1)) * plotW));
  const ys = runs.map((r) => plotH - (r.passRate / 100) * plotH);
  const poly = xs.map((x, i) => `${PAD_L + x},${PAD_T + ys[i]!}`).join(" ");
  const minRate = Math.min(...runs.map((r) => r.passRate));
  const maxRate = Math.max(...runs.map((r) => r.passRate));
  const latest = runs[runs.length - 1]!;
  const prev = runs.length >= 2 ? runs[runs.length - 2]! : null;
  const delta = prev ? +(latest.passRate - prev.passRate).toFixed(1) : 0;

  return (
    <div style={{ background: "#ffffff", border: `1px solid ${P.border}`, borderRadius: 12, padding: "14px 16px", marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <div>
          <div style={{ fontSize: 10, color: P.muted, textTransform: "uppercase", letterSpacing: "0.10em" }}>Taux de réussite</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span style={{ fontSize: 24, fontWeight: 800, color: P.ink }}>{latest.passRate}%</span>
            {prev && (
              <span style={{ fontSize: 12, color: delta >= 0 ? P.green : P.red, fontWeight: 700 }}>
                {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} pt
              </span>
            )}
          </div>
        </div>
        <div style={{ textAlign: "right", fontSize: 11, color: P.muted }}>
          Plage: {minRate}% – {maxRate}%
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} preserveAspectRatio="none">
        {[100, 90, 80, 70].map((tick) => {
          const y = PAD_T + plotH - (tick / 100) * plotH;
          return (
            <g key={tick}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke={P.border} strokeDasharray="2 4" />
              <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize="9" fill={P.muted}>{tick}%</text>
            </g>
          );
        })}
        <polyline points={poly} fill="none" stroke={P.gold} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {runs.map((r, i) => (
          <circle
            key={i}
            cx={PAD_L + xs[i]!}
            cy={PAD_T + ys[i]!}
            r={r.judge ? 4 : 2.5}
            fill={r.judge ? P.gold : P.muted}
            stroke="#ffffff"
            strokeWidth="1.5"
          >
            <title>{`${new Date(r.timestamp).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })} — ${r.passed}/${r.total} (${r.passRate}%${r.judge ? ", juge IA" : ", rapide"})`}</title>
          </circle>
        ))}
        <text x={PAD_L} y={H - 6} fontSize="9" fill={P.muted}>{new Date(runs[0]!.timestamp).toLocaleDateString("fr-CA", { month: "short", day: "numeric" })}</text>
        <text x={W - PAD_R} y={H - 6} fontSize="9" fill={P.muted} textAnchor="end">{new Date(latest.timestamp).toLocaleDateString("fr-CA", { month: "short", day: "numeric" })}</text>
      </svg>
      <div style={{ display: "flex", gap: 14, fontSize: 10, color: P.muted, marginTop: 4 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: P.gold, display: "inline-block" }} /> Juge IA
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: P.muted, display: "inline-block" }} /> Test rapide
        </span>
      </div>
    </div>
  );
}

/** Failure-type distribution over the recent runs (totals). */
function FailureDistribution({ runs }: { runs: HistoryRun[] }) {
  const totals: Record<string, number> = {};
  for (const r of runs) {
    for (const [t, n] of Object.entries(r.failureTypes)) {
      totals[t] = (totals[t] ?? 0) + n;
    }
  }
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) {
    return (
      <div style={{ background: "#ffffff", border: `1px solid ${P.border}`, borderRadius: 12, padding: "14px 16px", color: P.green, fontWeight: 600, fontSize: 12 }}>
        ✓ Aucun échec sur les {runs.length} dernières exécutions.
      </div>
    );
  }
  const max = entries[0]![1];
  return (
    <div style={{ background: "#ffffff", border: `1px solid ${P.border}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 10, color: P.muted, textTransform: "uppercase", letterSpacing: "0.10em", marginBottom: 10 }}>
        Échecs cumulés par type ({runs.length} exécutions)
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {entries.map(([type, count]) => {
          const meta = FAILURE_LABELS[type] ?? FAILURE_LABELS.unknown!;
          const c = toneColor(meta.tone);
          const pct = (count / max) * 100;
          return (
            <div key={type} style={{ display: "grid", gridTemplateColumns: "180px 1fr 40px", gap: 10, alignItems: "center" }}>
              <span style={{ fontSize: 11, color: P.ink, fontWeight: 600 }}>{meta.label}</span>
              <div style={{ background: `${c}14`, height: 14, borderRadius: 7, overflow: "hidden", position: "relative" }}>
                <div style={{ background: c, width: `${pct}%`, height: "100%", borderRadius: 7, transition: "width 0.3s" }} />
              </div>
              <span style={{ fontSize: 11, color: P.dim, fontWeight: 700, textAlign: "right" }}>{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** ── ACTION CENTER ──────────────────────────────────────────────────────
 *  Top-of-panel block Daphné + Steve open every morning. Shows the hero
 *  pass-rate with climb badge, then a numbered list of "what to do" — every
 *  failing scenario with its label, classified failure type, suggested
 *  subagent owner, and a row of inline actions (view detail, view full
 *  remediation plan, re-run after fixing).
 */
interface ActionCenterRun {
  timestamp: string;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  failures: FailureDetail[];
}

function ActionCenter({
  run,
  history,
  onOpenReport,
  onOpenRemediation,
  onRerun,
  rerunning,
}: {
  run: ActionCenterRun;
  history: HistoryRun[] | null;
  onOpenReport?: () => void;
  onOpenRemediation?: () => void;
  onRerun: () => void;
  rerunning: boolean;
}) {
  const previous = history && history.length >= 2 ? history[history.length - 2] : null;
  const delta = previous ? +(run.passRate - previous.passRate).toFixed(1) : 0;
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div
      style={{
        marginBottom: 24,
        background: "linear-gradient(135deg, #fbf8ef 0%, #f7f4ea 100%)",
        border: `1px solid ${P.gold}44`,
        borderRadius: 14,
        padding: "20px 22px",
        boxShadow: "0 2px 14px rgba(201,168,76,0.10)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: P.muted, textTransform: "uppercase", letterSpacing: "0.14em" }}>
            Prochaines étapes
          </span>
          <span style={{ fontSize: 26, fontWeight: 800, color: P.ink, lineHeight: 1 }}>
            {run.passRate}%
          </span>
          {previous && (
            <span style={{ fontSize: 12, color: delta >= 0 ? P.green : P.red, fontWeight: 700 }}>
              {delta >= 0 ? "▲" : "▼"} {Math.abs(delta).toFixed(1)} pt vs précédente
            </span>
          )}
          <span style={{ fontSize: 12, color: P.muted }}>
            · {run.passed} / {run.total} scénarios · {run.failures.length} correctif{run.failures.length > 1 ? "s" : ""} à appliquer pour atteindre 100 %
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {onOpenRemediation && (
            <button
              onClick={onOpenRemediation}
              style={{
                background: "linear-gradient(135deg,#c9a84c,#8b6010)",
                border: "none", borderRadius: 8,
                color: "#1a1610", fontSize: 12, fontWeight: 700,
                padding: "8px 14px", cursor: "pointer",
                boxShadow: "0 2px 6px rgba(201,168,76,0.28)",
              }}
            >
              ⚙ Plan complet
            </button>
          )}
          {onOpenReport && (
            <button
              onClick={onOpenReport}
              style={{
                background: "#ffffff",
                border: `1px solid ${P.border}`, borderRadius: 8,
                color: P.ink, fontSize: 12, fontWeight: 600,
                padding: "8px 14px", cursor: "pointer",
                boxShadow: "0 1px 2px rgba(20,16,8,0.04)",
              }}
            >
              📄 Rapport
            </button>
          )}
          <button
            onClick={onRerun}
            disabled={rerunning}
            style={{
              background: rerunning ? "#e8e3d6" : P.ink,
              border: "none", borderRadius: 8,
              color: rerunning ? P.muted : "#fbf8ef",
              fontSize: 12, fontWeight: 700,
              padding: "8px 14px", cursor: rerunning ? "default" : "pointer",
            }}
          >
            ▶ Re-tester avec juge
          </button>
        </div>
      </div>

      {/* Per-failure rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {run.failures.map((f, i) => {
          const meta = FAILURE_LABELS[f.failureType] ?? FAILURE_LABELS.unknown!;
          const owner = FAILURE_OWNER[f.failureType] ?? FAILURE_OWNER.unknown!;
          const c = toneColor(meta.tone);
          const isOpen = expandedId === f.id;
          return (
            <div
              key={f.id}
              style={{
                background: "#ffffff",
                border: `1px solid ${P.border}`,
                borderRadius: 10,
                padding: "12px 14px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                <span style={{
                  width: 22, height: 22, borderRadius: "50%",
                  background: P.ink, color: "#fbf8ef",
                  fontSize: 11, fontWeight: 800,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0,
                }}>{i + 1}</span>
                <span style={{
                  fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 700,
                  color: P.gold, background: `${P.gold}14`,
                  padding: "2px 8px", borderRadius: 999,
                  flexShrink: 0,
                }}>{f.id}</span>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  padding: "3px 9px", borderRadius: 999,
                  background: `${c}14`, border: `1px solid ${c}44`,
                  color: c, fontSize: 11, fontWeight: 600,
                  flexShrink: 0,
                }}>{meta.label}</span>
                <span style={{ flex: 1, minWidth: 200, fontSize: 13, color: P.ink, fontWeight: 600 }}>{f.label}</span>
                <span style={{ fontSize: 11, color: P.muted, flexShrink: 0 }}>
                  À traiter par : <strong style={{ color: P.ink }}>{owner.agent}</strong>
                </span>
                <button
                  onClick={() => setExpandedId(isOpen ? null : f.id)}
                  style={{
                    background: "none", border: `1px solid ${P.border}`,
                    borderRadius: 6, padding: "4px 10px",
                    fontSize: 11, color: P.dim, cursor: "pointer", fontWeight: 600,
                  }}
                >
                  {isOpen ? "▲ Cacher" : "▼ Détails"}
                </button>
              </div>
              {isOpen && (
                <div style={{ marginTop: 12, paddingLeft: 34, fontSize: 12, color: P.dim, lineHeight: 1.55, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div>
                    <span style={{ color: P.muted, fontWeight: 700, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>Surface du fix</span>
                    <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: P.ink, marginTop: 2 }}>{owner.surface}</div>
                  </div>
                  {f.failureReason && (
                    <div>
                      <span style={{ color: P.muted, fontWeight: 700, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>Raison technique</span>
                      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: P.ink, marginTop: 2, wordBreak: "break-word" }}>{f.failureReason}</div>
                    </div>
                  )}
                  {f.judgeVerdict && (
                    <div>
                      <span style={{ color: P.muted, fontWeight: 700, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>Verdict du juge IA</span>
                      <div style={{ fontSize: 11, color: P.ink, marginTop: 2, fontStyle: "italic" }}>
                        <strong>{f.judgeVerdict.verdict}</strong> — {f.judgeVerdict.reasoning}
                      </div>
                    </div>
                  )}
                  {f.assistantMessage && (
                    <div>
                      <span style={{ color: P.muted, fontWeight: 700, fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>Réponse du concierge</span>
                      <div style={{
                        fontSize: 11, color: P.ink, marginTop: 2,
                        background: "#fbf8ef", padding: "8px 10px", borderRadius: 6,
                        borderLeft: `3px solid ${P.gold}66`,
                        fontStyle: "italic",
                      }}>{f.assistantMessage}…</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14, fontSize: 11, color: P.muted, lineHeight: 1.55 }}>
        💡 <strong>Comment procéder :</strong> ouvrez « ⚙ Plan complet » pour la version Markdown détaillée, dispatcher l'agent suggéré pour chaque correctif, puis cliquez « ▶ Re-tester avec juge » pour confirmer la progression.
      </div>
    </div>
  );
}

/** Small KPI tile for an OpenAI cost amount. Goes red when over budget. */
function CostTile({ label, amount, sub, warn }: { label: string; amount: number; sub?: string; warn?: boolean }) {
  return (
    <div
      style={{
        background: "#ffffff",
        border: `1px solid ${warn ? `${P.red}66` : P.border}`,
        borderRadius: 12,
        padding: "12px 14px",
      }}
    >
      <div style={{ fontSize: 10, color: P.muted, textTransform: "uppercase", letterSpacing: "0.10em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: warn ? P.red : P.ink, lineHeight: 1.1, marginTop: 4 }}>
        {amount.toFixed(4)} <span style={{ fontSize: 12, color: P.muted, fontWeight: 600 }}>$US</span>
      </div>
      {sub && <div style={{ fontSize: 10, color: P.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
