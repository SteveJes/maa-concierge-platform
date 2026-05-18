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
import { useEffect, useState } from "react";
import { P, API, Card, SectionTitle } from "../_components/AdminShell";

interface Overview {
  latestRun: {
    timestamp: string;
    tenantCode: string;
    total: number;
    passed: number;
    failed: number;
    passRate: number;
    failureTypeBreakdown: Record<string, number>;
    reportFile: string | null;
  } | null;
  goldenScenarios: { count: number; files: string[] };
  links: { sentinelRunsDir: string; goldenDir: string; agentsDir: string };
}

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

export default function QualityPanel({ tenantId, token }: Props) {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [agents, setAgents] = useState<AgentDef[] | null>(null);
  const [reportText, setReportText] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  useEffect(() => {
    fetch(`${API}/v1/admin/quality/overview?tenant=${encodeURIComponent(tenantId)}`, {
      headers: { "x-admin-token": token },
    })
      .then((r) => r.json())
      .then((data: Overview) => setOverview(data))
      .catch(() => setOverview(null));
    fetch(`${API}/v1/admin/quality/agents`, { headers: { "x-admin-token": token } })
      .then((r) => r.json())
      .then((data: { agents: AgentDef[] }) => setAgents(data.agents))
      .catch(() => setAgents([]));
  }, [tenantId, token]);

  async function openReport(file: string) {
    setShowReport(true);
    setReportText("Chargement…");
    const res = await fetch(`${API}/v1/admin/quality/report/${encodeURIComponent(file)}`, {
      headers: { "x-admin-token": token },
    });
    setReportText(res.ok ? await res.text() : `Erreur ${res.status}`);
  }

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionTitle>Qualité & activité — agents, tests, évaluations</SectionTitle>
      <Card>
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
    </section>
  );
}
