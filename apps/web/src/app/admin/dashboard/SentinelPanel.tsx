"use client";

/**
 * Sentinel panel — premium AI-quality watchdog for the selected tenant.
 *
 * Sentinel is our add-on product included by default for every tenant. It:
 *   1. Runs structured scenario tests against the concierge service layer.
 *   2. Asks an LLM judge to verify each scenario semantically.
 *   3. Auto-generates new edge-case scenarios on demand (OpenAI proposes).
 *   4. Persists every run to disk and surfaces the trend here.
 *
 * Strict tenant isolation: this panel only ever shows runs scoped to
 * `tenantId`. The backend filters by tenantCode in each run file.
 */
import { useEffect, useState, useCallback } from "react";
import { P, API, Card, SectionTitle } from "../_components/AdminShell";

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

interface Props {
  tenantId: string;
  tenantName: string;
  token: string;
}

function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-CA", {
    timeZone: "America/Montreal",
    dateStyle: "short",
    timeStyle: "short",
  });
}

function passRateColor(rate: number): string {
  if (rate >= 95) return P.green;
  if (rate >= 80) return P.orange;
  return P.red;
}

export default function SentinelPanel({ tenantId, tenantName, token }: Props) {
  const [runs, setRuns] = useState<SentinelRunSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchRuns = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch(
        `${API}/v1/admin/sentinel/runs?tenant=${encodeURIComponent(tenantId)}&limit=10`,
        { headers: { "x-admin-token": token } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { runs?: SentinelRunSummary[] };
      setRuns(data.runs ?? []);
    } catch (err) {
      setError((err as Error).message);
      setRuns([]);
    }
  }, [tenantId, token]);

  useEffect(() => {
    void fetchRuns();
  }, [fetchRuns]);

  const latest = runs && runs.length > 0 ? runs[0] : null;

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionTitle>
        Sentinel — Audit qualité du concierge IA
      </SectionTitle>

      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, color: P.muted, lineHeight: 1.55 }}>
              Sentinel exécute en continu une banque de scénarios conversationnels sur {tenantName}, fait juger
              chaque réponse par un évaluateur IA dédié, et propose de nouveaux scénarios pour combler les angles morts.
              Inclus par défaut dans chaque licence.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void fetchRuns()}
            style={{
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 600,
              border: `1px solid ${P.border}`,
              borderRadius: 6,
              background: P.cardHover,
              color: P.white,
              cursor: "pointer",
            }}
          >
            Rafraîchir
          </button>
        </div>

        {error && (
          <div style={{ padding: 12, borderRadius: 6, background: "rgba(220,80,80,0.08)", color: P.red, fontSize: 12 }}>
            Erreur : {error}
          </div>
        )}

        {runs && runs.length === 0 && !error && (
          <div style={{ padding: 14, borderRadius: 6, background: P.cardHover, fontSize: 12, color: P.muted }}>
            Aucune exécution Sentinel pour ce tenant pour l&apos;instant.
            <br />
            Lancez <code style={{ background: P.bg, padding: "2px 6px", borderRadius: 3 }}>pnpm.cmd --filter @platform/api test:scenarios --tenant {tenantId}</code> pour produire un premier rapport.
          </div>
        )}

        {latest && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 18 }}>
            <SummaryStat label="Dernière exécution" value={fmtDate(latest.timestamp)} />
            <SummaryStat
              label="Taux de réussite"
              value={`${latest.passRate}%`}
              accent={passRateColor(latest.passRate)}
            />
            <SummaryStat label="Scénarios" value={`${latest.passed} / ${latest.total}`} />
            <SummaryStat label="Échecs" value={latest.failed} accent={latest.failed === 0 ? P.green : P.red} />
            <SummaryStat label="Mode" value={latest.mode === "live" ? "Prod (live)" : "Local"} />
            <SummaryStat label="Juge IA" value={latest.judge ? "Activé" : "Désactivé"} accent={latest.judge ? P.green : P.muted} />
          </div>
        )}

        {runs && runs.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${P.border}`, color: P.muted }}>
                  {["Date", "Mode", "Juge", "Réussite", "Échecs", ""].map((h) => (
                    <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                      {h}
                    </th>
                  ))}
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
        )}

        <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px dashed ${P.border}`, fontSize: 11, color: P.muted, lineHeight: 1.6 }}>
          <strong style={{ color: P.white }}>Commandes Sentinel :</strong>
          <ul style={{ margin: "6px 0 0 18px", padding: 0 }}>
            <li><code>pnpm.cmd --filter @platform/api test:scenarios --tenant {tenantId}</code> — exécution complète (juge IA actif par défaut)</li>
            <li><code>pnpm.cmd --filter @platform/api sentinel:generate --tenant {tenantId}</code> — OpenAI propose 8 nouveaux scénarios à valider</li>
            <li><code>pnpm.cmd --filter @platform/api test:scenarios --no-judge --tenant {tenantId}</code> — exécution sans juge IA (plus rapide / moins cher)</li>
          </ul>
        </div>
      </Card>
    </section>
  );
}

function SummaryStat({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div style={{ padding: 12, background: P.cardHover, borderRadius: 6, border: `1px solid ${P.border}` }}>
      <div style={{ fontSize: 10, color: P.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 700, color: accent ?? P.white }}>{value}</div>
    </div>
  );
}

function RunRow({
  run,
  expanded,
  onToggle,
}: {
  run: SentinelRunSummary;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        style={{
          borderBottom: `1px solid ${P.border}`,
          cursor: run.failures.length > 0 ? "pointer" : "default",
        }}
        onClick={() => run.failures.length > 0 && onToggle()}
      >
        <td style={{ padding: "10px 12px", whiteSpace: "nowrap" }}>{fmtDate(run.timestamp)}</td>
        <td style={{ padding: "10px 12px" }}>{run.mode === "live" ? "Prod" : "Local"}</td>
        <td style={{ padding: "10px 12px" }}>{run.judge ? "✓" : "—"}</td>
        <td style={{ padding: "10px 12px", color: passRateColor(run.passRate), fontWeight: 600 }}>
          {run.passed} / {run.total} ({run.passRate}%)
        </td>
        <td style={{ padding: "10px 12px", color: run.failed > 0 ? P.red : P.muted }}>{run.failed}</td>
        <td style={{ padding: "10px 12px", color: P.muted, fontSize: 11 }}>
          {run.failures.length > 0 ? (expanded ? "▼ Masquer" : "▶ Détails") : ""}
        </td>
      </tr>
      {expanded && run.failures.length > 0 && (
        <tr>
          <td colSpan={6} style={{ padding: "12px 12px 16px", background: P.cardHover }}>
            <div style={{ fontSize: 11, color: P.muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Scénarios en échec
            </div>
            <ul style={{ margin: 0, padding: "0 0 0 18px", fontSize: 12, color: P.white, lineHeight: 1.6 }}>
              {run.failures.map((f) => (
                <li key={f.id} style={{ marginBottom: 6 }}>
                  <strong>{f.id}</strong> — {f.label}
                  {f.reason && <div style={{ color: P.muted, fontSize: 11, marginTop: 2 }}>↳ {f.reason}</div>}
                </li>
              ))}
            </ul>
          </td>
        </tr>
      )}
    </>
  );
}
