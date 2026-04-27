"use client";

import { useState, useEffect, useCallback } from "react";

interface AnalyticsData {
  tenantId: string;
  period: { days: number; from: string | null; to: string | null };
  totals: { conversations: number; needsFollowup: number; needsFollowupRate: number };
  byOutcome: Record<string, number>;
  byLanguage: Record<string, number>;
  languageSplit: { frPct: number; enPct: number };
  dailySeries: { date: string; count: number }[];
}

// Montreal/Quebec benchmark constants (documented sources)
const BENCH = {
  costPerHumanInquiry: 2.75,   // ~$22/hr receptionist, ~7.5 min avg per inquiry
  membershipMonthlyValue: 225, // Club Sportif MAA annual plan, per month
  membershipLifetimeValue: 2700, // $225 × 12 months
  webChatConversionRate: 0.06, // 6% industry benchmark for premium fitness clubs (Mindbody 2024)
  aiCostPerMonth: 955,         // MAA Platform concierge subscription — full premium tier
  aiCostPerInteraction: 0.12,  // estimated at scale
  receptionistHoursPerDay: 8,  // 9am–5pm
  totalHoursPerDay: 24,
};

const PALETTE = {
  bg: "#06090c",
  cardBg: "linear-gradient(145deg, #0e1a24 0%, #091510 100%)",
  cardBgSolid: "#0d1821",
  cardBorder: "rgba(255,255,255,0.07)",
  gold: "#f0c040",
  goldDim: "#c09020",
  green: "#22d68a",
  greenDim: "#1a9e65",
  blue: "#3db8f5",
  purple: "#b388ff",
  orange: "#ff9100",
  red: "#ff5252",
  muted: "rgba(255,255,255,0.35)",
  dimmed: "rgba(255,255,255,0.55)",
  white: "#ffffff",
};

const OUTCOME_LABELS: Record<string, string> = {
  answered: "Répondu automatiquement",
  escalated: "Clarification demandée",
  callback: "Rappel demandé",
  booking: "Visite réservée",
  phone: "Continuation téléphonique",
  unknown: "Autre",
};

const OUTCOME_COLORS: Record<string, string> = {
  answered: PALETTE.green,
  escalated: PALETTE.orange,
  callback: PALETTE.blue,
  booking: PALETTE.purple,
  phone: PALETTE.gold,
  unknown: PALETTE.muted,
};

// ---- Monetary calculations ----
function calcImpact(data: AnalyticsData) {
  const convos = data.totals.conversations;
  const answered = data.byOutcome.answered ?? 0;
  const leads = (data.byOutcome.callback ?? 0) + (data.byOutcome.booking ?? 0);
  const period = data.period.days;

  const staffSaved = Math.round(answered * BENCH.costPerHumanInquiry);
  const extraCoverage = Math.round(
    ((BENCH.totalHoursPerDay - BENCH.receptionistHoursPerDay) / BENCH.totalHoursPerDay) * 100,
  );
  const potentialNewMembers = Math.round(leads * BENCH.webChatConversionRate * 10) / 10;
  const pipelineValue = Math.round(leads * BENCH.webChatConversionRate * BENCH.membershipLifetimeValue);
  const costPerInteraction =
    convos > 0 ? (BENCH.aiCostPerMonth / (convos * (30 / period))).toFixed(2) : "—";
  const vsHuman = (BENCH.costPerHumanInquiry - BENCH.aiCostPerInteraction).toFixed(2);
  const monthlyRoiPct =
    convos > 0 && period > 0
      ? Math.round(((convos * (30 / period) * BENCH.costPerHumanInquiry - BENCH.aiCostPerMonth) / BENCH.aiCostPerMonth) * 100)
      : 0;

  return {
    staffSaved,
    extraCoverage,
    potentialNewMembers,
    pipelineValue,
    costPerInteraction,
    vsHuman,
    monthlyRoiPct,
    leads,
  };
}

// ---- Components ----

function ImpactCard({
  emoji,
  label,
  value,
  sub,
  accent,
  large,
}: {
  emoji: string;
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
  large?: boolean;
}) {
  return (
    <div
      style={{
        background: PALETTE.cardBg,
        border: `1px solid ${PALETTE.cardBorder}`,
        borderTop: `3px solid ${accent}`,
        borderRadius: 14,
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -20,
          right: -10,
          fontSize: 80,
          opacity: 0.05,
          pointerEvents: "none",
          lineHeight: 1,
        }}
      >
        {emoji}
      </div>
      <div style={{ fontSize: 22, lineHeight: 1 }}>{emoji}</div>
      <span
        style={{
          color: PALETTE.muted,
          fontSize: 10,
          letterSpacing: "0.13em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: accent,
          fontSize: large ? 44 : 36,
          fontWeight: 800,
          lineHeight: 1,
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ color: PALETTE.dimmed, fontSize: 11, lineHeight: 1.4 }}>
          {sub}
        </span>
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent: string;
}) {
  return (
    <div
      style={{
        background: PALETTE.cardBg,
        border: `1px solid ${PALETTE.cardBorder}`,
        borderLeft: `3px solid ${accent}`,
        borderRadius: 12,
        padding: "1.1rem 1.4rem",
        display: "flex",
        flexDirection: "column",
        gap: 5,
      }}
    >
      <span
        style={{
          color: PALETTE.muted,
          fontSize: 9,
          letterSpacing: "0.13em",
          textTransform: "uppercase",
          fontWeight: 600,
        }}
      >
        {label}
      </span>
      <span
        style={{
          color: accent,
          fontSize: 32,
          fontWeight: 700,
          lineHeight: 1,
        }}
      >
        {value}
      </span>
      {sub && (
        <span style={{ color: PALETTE.muted, fontSize: 10 }}>{sub}</span>
      )}
    </div>
  );
}

function ComparisonRow({
  label,
  aiValue,
  humanValue,
  better,
}: {
  label: string;
  aiValue: string;
  humanValue: string;
  better: "ai" | "human";
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 12,
        alignItems: "center",
        padding: "10px 0",
        borderBottom: `1px solid ${PALETTE.cardBorder}`,
      }}
    >
      <span style={{ color: PALETTE.dimmed, fontSize: 12 }}>{label}</span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: better === "ai" ? PALETTE.green : PALETTE.muted,
            flexShrink: 0,
          }}
        />
        <span
          style={{
            color: better === "ai" ? PALETTE.green : PALETTE.dimmed,
            fontWeight: better === "ai" ? 700 : 400,
            fontSize: 13,
          }}
        >
          {aiValue}
        </span>
      </div>
      <span style={{ color: PALETTE.muted, fontSize: 12, textDecoration: "line-through" }}>
        {humanValue}
      </span>
    </div>
  );
}

function OutcomeBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span style={{ color: PALETTE.dimmed, fontSize: 12 }}>{label}</span>
        <span style={{ color: color, fontSize: 12, fontWeight: 700 }}>
          {count}{" "}
          <span style={{ color: PALETTE.muted, fontWeight: 400 }}>
            ({pct}%)
          </span>
        </span>
      </div>
      <div
        style={{
          height: 7,
          background: "rgba(255,255,255,0.06)",
          borderRadius: 4,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            borderRadius: 4,
            transition: "width 0.7s ease",
          }}
        />
      </div>
    </div>
  );
}

function BarChart({ series }: { series: { date: string; count: number }[] }) {
  if (series.length === 0)
    return (
      <div style={{ color: PALETTE.muted, fontSize: 12 }}>Pas encore de données</div>
    );

  const last14 = series.slice(-14);
  const max = Math.max(...last14.map((s) => s.count), 1);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 4,
        height: 110,
        paddingBottom: 22,
        position: "relative",
      }}
    >
      {last14.map((s) => {
        const barH = Math.max((s.count / max) * 88, 2);
        return (
          <div
            key={s.date}
            title={`${s.date}: ${s.count}`}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: 3,
              height: "100%",
            }}
          >
            <div
              style={{
                width: "100%",
                height: barH,
                background: `linear-gradient(180deg, ${PALETTE.blue} 0%, ${PALETTE.blue}44 100%)`,
                borderRadius: "3px 3px 0 0",
                transition: "height 0.6s ease",
              }}
            />
            <span
              style={{
                color: PALETTE.muted,
                fontSize: 8,
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                whiteSpace: "nowrap",
              }}
            >
              {s.date.slice(5)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function SectionTitle({ children }: { children: string | number }) {
  return (
    <h2
      style={{
        color: PALETTE.gold,
        fontSize: 10,
        letterSpacing: "0.16em",
        textTransform: "uppercase",
        fontWeight: 700,
        margin: "0 0 1.25rem",
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 20,
          height: 2,
          background: PALETTE.gold,
          borderRadius: 1,
        }}
      />
      {children}
    </h2>
  );
}

function Skeleton() {
  return (
    <div style={{ padding: "5rem", textAlign: "center", color: PALETTE.muted }}>
      <div
        style={{
          width: 36,
          height: 36,
          border: `3px solid ${PALETTE.blue}33`,
          borderTop: `3px solid ${PALETTE.blue}`,
          borderRadius: "50%",
          animation: "spin 0.8s linear infinite",
          margin: "0 auto 1rem",
        }}
      />
      <p style={{ fontSize: 14 }}>Chargement des données…</p>
    </div>
  );
}

const PERIOD_OPTIONS = [
  { label: "7 jours", days: 7 },
  { label: "30 jours", days: 30 },
  { label: "90 jours", days: 90 },
];

function fmt$(n: number) {
  return n.toLocaleString("fr-CA", { style: "currency", currency: "CAD", maximumFractionDigits: 0 });
}

const DASHBOARD_PASSWORD = process.env.NEXT_PUBLIC_DASHBOARD_PASSWORD ?? "dubub2024";

function LoginGate({ onAuth }: { onAuth: () => void }) {
  const [pw, setPw] = useState("");
  const [shake, setShake] = useState(false);

  function attempt() {
    if (pw === DASHBOARD_PASSWORD) {
      sessionStorage.setItem("dash_authed", "1");
      onAuth();
    } else {
      setShake(true);
      setPw("");
      setTimeout(() => setShake(false), 500);
    }
  }

  return (
    <>
      <style>{`
        @keyframes shake { 0%,100%{transform:translateX(0)} 20%,60%{transform:translateX(-8px)} 40%,80%{transform:translateX(8px)} }
        .shake { animation: shake 0.45s ease; }
        * { box-sizing: border-box; }
        body { margin: 0; }
      `}</style>
      <div style={{
        minHeight: "100vh",
        background: "#06090c",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}>
        <div style={{
          background: "linear-gradient(145deg, #0e1a24 0%, #091510 100%)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 16,
          padding: "48px 40px",
          width: 360,
          textAlign: "center",
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <h2 style={{ color: "#f0c040", margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Tableau de bord</h2>
          <p style={{ color: "rgba(255,255,255,0.45)", fontSize: 13, margin: "0 0 28px" }}>MAA Concierge Platform · Accès restreint</p>
          <input
            type="password"
            placeholder="Mot de passe"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && attempt()}
            className={shake ? "shake" : ""}
            style={{
              width: "100%",
              padding: "12px 16px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.05)",
              color: "#fff",
              fontSize: 15,
              outline: "none",
              marginBottom: 16,
            }}
          />
          <button
            onClick={attempt}
            style={{
              width: "100%",
              padding: "12px 0",
              borderRadius: 8,
              border: "none",
              background: "linear-gradient(135deg, #f0c040, #c09020)",
              color: "#06090c",
              fontWeight: 700,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Accéder au tableau de bord
          </button>
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: 11, marginTop: 20 }}>
            Intelligence propulsée par DUBUB
          </p>
        </div>
      </div>
    </>
  );
}

// ── Types for quality review ──────────────────────────────────────────────────
interface ConvMessage { role: string; content: string; }
interface ConvRow { uuid?: string; started_at?: string; outcome?: string; messages: ConvMessage[]; }
interface FeedbackRecord { id: string; userMessage: string; aiResponse: string; verdict: string; correctedResponse: string | null; aiAlternatives: string[]; reviewedAt: string; }

function QualityReviewPanel() {
  const [tab, setTab] = useState<"review" | "history">("review");
  const [convos, setConvos] = useState<ConvRow[]>([]);
  const [feedback, setFeedback] = useState<FeedbackRecord[]>([]);
  const [loadingConvos, setLoadingConvos] = useState(false);
  const [selectedConvo, setSelectedConvo] = useState<ConvRow | null>(null);
  const [pendingFeedback, setPendingFeedback] = useState<{ userMessage: string; aiResponse: string; conversationId: string | null } | null>(null);
  const [customCorrection, setCustomCorrection] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alternatives, setAlternatives] = useState<string[]>([]);

  const loadConvos = async () => {
    setLoadingConvos(true);
    try {
      const r = await fetch("http://localhost:4000/v1/tenants/maa/recent-conversations");
      if (r.ok) { const d = (await r.json()) as { conversations: ConvRow[] }; setConvos(d.conversations); }
    } catch { /* ok */ } finally { setLoadingConvos(false); }
  };

  const loadFeedback = async () => {
    try {
      const r = await fetch("http://localhost:4000/v1/tenants/maa/feedback");
      if (r.ok) { const d = (await r.json()) as { feedback: FeedbackRecord[] }; setFeedback(d.feedback); }
    } catch { /* ok */ }
  };

  useEffect(() => { void loadConvos(); void loadFeedback(); }, []);

  const submitFeedback = async (verdict: "correct" | "incorrect" | "custom", correction?: string) => {
    if (!pendingFeedback) return;
    setSubmitting(true);
    try {
      const r = await fetch("http://localhost:4000/v1/tenants/maa/feedback", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...pendingFeedback, verdict, correctedResponse: correction ?? (customCorrection || null) }),
      });
      if (r.ok) {
        const d = (await r.json()) as { aiAlternatives: string[] };
        if (verdict === "incorrect" && d.aiAlternatives.length > 0) { setAlternatives(d.aiAlternatives); }
        else { setPendingFeedback(null); setAlternatives([]); setCustomCorrection(""); void loadFeedback(); }
      }
    } catch { /* ok */ } finally { setSubmitting(false); }
  };

  const findTurns = (convo: ConvRow) => {
    const turns: Array<{ user: string; ai: string }> = [];
    const msgs = convo.messages ?? [];
    for (let i = 0; i < msgs.length - 1; i++) {
      if (msgs[i]!.role === "user" && msgs[i + 1]!.role === "assistant") {
        turns.push({ user: msgs[i]!.content, ai: msgs[i + 1]!.content });
      }
    }
    return turns;
  };

  return (
    <div style={{ marginBottom: "1.5rem", background: PALETTE.cardBg, border: `1px solid ${PALETTE.cardBorder}`, borderRadius: 14, overflow: "hidden" }}>
      {/* Panel header */}
      <div style={{ padding: "1rem 1.5rem", borderBottom: `1px solid ${PALETTE.cardBorder}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <span style={{ color: PALETTE.gold, fontWeight: 700, fontSize: 14, letterSpacing: "0.06em", textTransform: "uppercase" }}>🧠 Revue Qualité IA</span>
          <span style={{ color: PALETTE.muted, fontSize: 11, marginLeft: 12 }}>Approuvez, corrigez ou générez des alternatives</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {(["review", "history"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: "5px 14px", borderRadius: 20, border: `1px solid ${tab === t ? PALETTE.gold : PALETTE.cardBorder}`, background: tab === t ? "rgba(240,192,64,0.12)" : "transparent", color: tab === t ? PALETTE.gold : PALETTE.muted, fontSize: 11, cursor: "pointer", fontWeight: tab === t ? 700 : 400 }}>
              {t === "review" ? "Revue" : "Historique"}
            </button>
          ))}
        </div>
      </div>

      {tab === "review" && (
        <div style={{ padding: "1rem 1.5rem" }}>
          {loadingConvos ? (
            <div style={{ color: PALETTE.muted, fontSize: 12 }}>Chargement des conversations...</div>
          ) : convos.length === 0 ? (
            <div style={{ color: PALETTE.muted, fontSize: 12 }}>Aucune conversation récente. Assurez-vous que la persistance NocoDB est configurée.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: "1rem", minHeight: 300 }}>
              {/* Left: conversation list */}
              <div style={{ borderRight: `1px solid ${PALETTE.cardBorder}`, paddingRight: "1rem", overflowY: "auto", maxHeight: 400 }}>
                {convos.map((c) => (
                  <button key={c.uuid} onClick={() => { setSelectedConvo(c); setPendingFeedback(null); setAlternatives([]); }}
                    style={{ width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 8, border: "none", background: selectedConvo?.uuid === c.uuid ? "rgba(240,192,64,0.1)" : "transparent", color: selectedConvo?.uuid === c.uuid ? PALETTE.gold : PALETTE.dimmed, cursor: "pointer", fontSize: 11, marginBottom: 4, borderLeft: `2px solid ${selectedConvo?.uuid === c.uuid ? PALETTE.gold : "transparent"}` }}>
                    <div style={{ fontWeight: 600 }}>{(c.started_at ?? "").slice(0, 10)}</div>
                    <div style={{ opacity: 0.6, marginTop: 2 }}>{c.outcome ?? "—"} · {(c.messages ?? []).length} msgs</div>
                  </button>
                ))}
              </div>

              {/* Right: turns + feedback */}
              <div style={{ overflowY: "auto", maxHeight: 400 }}>
                {!selectedConvo ? (
                  <div style={{ color: PALETTE.muted, fontSize: 12, paddingTop: 8 }}>Sélectionnez une conversation à gauche.</div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {findTurns(selectedConvo).map((turn, i) => {
                      const isPending = pendingFeedback?.userMessage === turn.user && pendingFeedback?.aiResponse === turn.ai;
                      return (
                        <div key={i} style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${isPending ? PALETTE.gold : PALETTE.cardBorder}` }}>
                          <div style={{ fontSize: 11, color: PALETTE.muted, marginBottom: 4 }}>Tour {i + 1}</div>
                          <div style={{ fontSize: 12, color: PALETTE.gold, marginBottom: 4 }}>👤 {turn.user}</div>
                          <div style={{ fontSize: 12, color: PALETTE.dimmed, marginBottom: 10 }}>🤖 {turn.ai}</div>

                          {!isPending ? (
                            <div style={{ display: "flex", gap: 6 }}>
                              <button onClick={() => { setPendingFeedback({ userMessage: turn.user, aiResponse: turn.ai, conversationId: selectedConvo.uuid ?? null }); void submitFeedback("correct"); }}
                                style={{ padding: "4px 12px", borderRadius: 12, border: "none", background: "rgba(34,214,138,0.15)", color: PALETTE.green, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✓ Correct</button>
                              <button onClick={() => { setPendingFeedback({ userMessage: turn.user, aiResponse: turn.ai, conversationId: selectedConvo.uuid ?? null }); }}
                                style={{ padding: "4px 12px", borderRadius: 12, border: "none", background: "rgba(255,82,82,0.15)", color: PALETTE.red, fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✗ Incorrect</button>
                            </div>
                          ) : alternatives.length > 0 ? (
                            <div>
                              <div style={{ fontSize: 11, color: PALETTE.gold, marginBottom: 6 }}>Alternatives suggérées par l'IA :</div>
                              {alternatives.map((alt, j) => (
                                <div key={j} style={{ padding: 8, borderRadius: 8, background: "rgba(255,255,255,0.04)", border: `1px solid ${PALETTE.cardBorder}`, marginBottom: 6 }}>
                                  <div style={{ fontSize: 11, color: PALETTE.dimmed, marginBottom: 4 }}>{alt}</div>
                                  <button onClick={() => void submitFeedback("custom", alt)} disabled={submitting}
                                    style={{ padding: "3px 10px", borderRadius: 10, border: "none", background: "rgba(240,192,64,0.15)", color: PALETTE.gold, fontSize: 10, cursor: "pointer" }}>
                                    ✓ Approuver cette version
                                  </button>
                                </div>
                              ))}
                              <div style={{ marginTop: 8 }}>
                                <textarea value={customCorrection} onChange={(e) => setCustomCorrection(e.target.value)} placeholder="Ou écrivez votre propre correction..."
                                  style={{ width: "100%", padding: 8, borderRadius: 8, border: `1px solid ${PALETTE.cardBorder}`, background: "#0a1218", color: PALETTE.white, fontSize: 11, resize: "vertical", minHeight: 60 }} />
                                <button onClick={() => void submitFeedback("custom")} disabled={submitting || !customCorrection.trim()}
                                  style={{ marginTop: 6, padding: "4px 14px", borderRadius: 12, border: "none", background: PALETTE.gold, color: PALETTE.bg, fontWeight: 700, fontSize: 11, cursor: "pointer", opacity: customCorrection.trim() ? 1 : 0.5 }}>
                                  Enregistrer correction
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: PALETTE.orange }}>Génération des alternatives... <button onClick={() => { setPendingFeedback(null); setAlternatives([]); }} style={{ background: "none", border: "none", color: PALETTE.muted, cursor: "pointer", fontSize: 10 }}>Annuler</button></div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div style={{ padding: "1rem 1.5rem" }}>
          {feedback.length === 0 ? (
            <div style={{ color: PALETTE.muted, fontSize: 12 }}>Aucun feedback enregistré encore.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 400, overflowY: "auto" }}>
              {feedback.map((f) => (
                <div key={f.id} style={{ padding: 12, borderRadius: 10, background: "rgba(255,255,255,0.03)", border: `1px solid ${f.verdict === "correct" ? "rgba(34,214,138,0.2)" : f.verdict === "incorrect" ? "rgba(255,82,82,0.2)" : "rgba(240,192,64,0.2)"}` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 10, color: f.verdict === "correct" ? PALETTE.green : f.verdict === "incorrect" ? PALETTE.red : PALETTE.gold, fontWeight: 700, textTransform: "uppercase" }}>{f.verdict}</span>
                    <span style={{ fontSize: 10, color: PALETTE.muted }}>{f.reviewedAt.slice(0, 16).replace("T", " ")}</span>
                  </div>
                  <div style={{ fontSize: 11, color: PALETTE.gold, marginBottom: 4 }}>👤 {f.userMessage}</div>
                  <div style={{ fontSize: 11, color: PALETTE.dimmed, marginBottom: f.correctedResponse ? 6 : 0 }}>🤖 {f.aiResponse.slice(0, 150)}{f.aiResponse.length > 150 ? "..." : ""}</div>
                  {f.correctedResponse && (
                    <div style={{ fontSize: 11, color: PALETTE.green, borderTop: `1px solid rgba(255,255,255,0.06)`, paddingTop: 6, marginTop: 4 }}>✓ Correction : {f.correctedResponse}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const [authed, setAuthed] = useState(false);
  const [selectedDays, setSelectedDays] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchData = useCallback(async (days: number) => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `http://localhost:4000/v1/tenants/maa/analytics?days=${days}`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("API error");
      const json = (await res.json()) as AnalyticsData;
      setData(json);
      setLastRefreshed(new Date());
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("dash_authed") === "1") setAuthed(true);
  }, []);

  useEffect(() => {
    if (authed) void fetchData(selectedDays);
  }, [authed, fetchData, selectedDays]);

  useEffect(() => {
    const interval = setInterval(() => void fetchData(selectedDays), 30_000);
    return () => clearInterval(interval);
  }, [fetchData, selectedDays]);

  if (!authed) return <LoginGate onAuth={() => setAuthed(true)} />;

  return (
    <>
      <style>{`
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin   { to { transform:rotate(360deg); } }
        * { box-sizing:border-box; }
        body { margin:0; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: PALETTE.bg,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          color: PALETTE.white,
        }}
      >
        {/* Header */}
        <header
          style={{
            background: "rgba(6,9,12,0.96)",
            backdropFilter: "blur(16px)",
            borderBottom: `1px solid ${PALETTE.cardBorder}`,
            padding: "0 2rem",
            height: 60,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 30,
                height: 30,
                borderRadius: 7,
                background: `linear-gradient(135deg, ${PALETTE.gold}, ${PALETTE.goldDim})`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: `0 0 12px ${PALETTE.gold}55`,
              }}
            >
              <span style={{ color: PALETTE.bg, fontWeight: 900, fontSize: 14 }}>M</span>
            </div>
            <div>
              <span
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  color: PALETTE.white,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                }}
              >
                Club Sportif MAA
              </span>
              <span
                style={{
                  color: PALETTE.muted,
                  fontSize: 11,
                  marginLeft: 10,
                  letterSpacing: "0.06em",
                }}
              >
                Concierge IA — Tableau de bord
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", gap: 4 }}>
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setSelectedDays(opt.days)}
                  style={{
                    background: selectedDays === opt.days ? PALETTE.blue : "rgba(255,255,255,0.06)",
                    color: selectedDays === opt.days ? PALETTE.bg : PALETTE.dimmed,
                    border: "none",
                    borderRadius: 6,
                    padding: "4px 11px",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.2s",
                    letterSpacing: "0.04em",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              onClick={() => void fetchData(selectedDays)}
              disabled={loading}
              style={{
                background: "rgba(255,255,255,0.05)",
                color: loading ? PALETTE.muted : PALETTE.green,
                border: `1px solid ${PALETTE.cardBorder}`,
                borderRadius: 6,
                padding: "4px 12px",
                fontSize: 11,
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "…" : "↺ Actualiser"}
            </button>

            {lastRefreshed && (
              <span style={{ color: PALETTE.muted, fontSize: 10 }}>
                {lastRefreshed.toLocaleTimeString("fr-CA")}
              </span>
            )}
          </div>
        </header>

        <main style={{ padding: "2rem", maxWidth: 1280, margin: "0 auto" }}>
          {loading && !data ? (
            <Skeleton />
          ) : error && !data ? (
            <div style={{ color: PALETTE.muted, textAlign: "center", paddingTop: "5rem" }}>
              <p style={{ fontSize: 18 }}>Données indisponibles — API inaccessible.</p>
              <p style={{ fontSize: 13, marginTop: 8 }}>
                Assurez-vous que l'API tourne sur le port 4000.
              </p>
            </div>
          ) : data ? (
            <div style={{ animation: "fadeIn 0.4s ease-out" }}>

              {/* ── SECTION 1: IMPACT FINANCIER ── */}
              <div style={{ marginBottom: "2.5rem" }}>
                <SectionTitle>{`Impact financier estimé — ${selectedDays} derniers jours`}</SectionTitle>

                {(() => {
                  const imp = calcImpact(data);
                  return (
                    <>
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: "1rem",
                          marginBottom: "1rem",
                        }}
                      >
                        <ImpactCard
                          emoji="💰"
                          label="Économisé sur la réception"
                          value={fmt$(imp.staffSaved)}
                          sub={`${data.byOutcome.answered ?? 0} demandes traitées automatiquement × ${fmt$(BENCH.costPerHumanInquiry)} avg`}
                          accent={PALETTE.green}
                          large
                        />
                        <ImpactCard
                          emoji="🎯"
                          label="Valeur pipeline (leads)"
                          value={fmt$(imp.pipelineValue)}
                          sub={`${imp.leads} leads × ${Math.round(BENCH.webChatConversionRate * 100)}% conv. × ${fmt$(BENCH.membershipLifetimeValue)} valeur membre`}
                          accent={PALETTE.gold}
                          large
                        />
                        <ImpactCard
                          emoji="📈"
                          label="ROI estimé ce mois"
                          value={`${imp.monthlyRoiPct > 0 ? "+" : ""}${imp.monthlyRoiPct}%`}
                          sub={`vs ${fmt$(BENCH.aiCostPerMonth)}/mois abonnement concierge IA`}
                          accent={imp.monthlyRoiPct >= 0 ? PALETTE.green : PALETTE.red}
                          large
                        />
                        <ImpactCard
                          emoji="🕐"
                          label="Couverture additionnelle"
                          value={`+${imp.extraCoverage}%`}
                          sub="Disponible 24h/24, 7j/7 vs réceptionniste 9h-17h"
                          accent={PALETTE.blue}
                        />
                      </div>

                      {/* Cost comparison table */}
                      <div
                        style={{
                          background: PALETTE.cardBg,
                          border: `1px solid ${PALETTE.cardBorder}`,
                          borderRadius: 14,
                          padding: "1.5rem",
                        }}
                      >
                        <SectionTitle>Concierge IA vs réceptionniste humain</SectionTitle>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr 1fr",
                            gap: 12,
                            marginBottom: 8,
                          }}
                        >
                          <span style={{ color: PALETTE.muted, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>Critère</span>
                          <span style={{ color: PALETTE.green, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>Concierge IA</span>
                          <span style={{ color: PALETTE.muted, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>Réceptionniste</span>
                        </div>
                        <ComparisonRow label="Coût par interaction" aiValue={`${fmt$(BENCH.aiCostPerInteraction)}`} humanValue={`${fmt$(BENCH.costPerHumanInquiry)}`} better="ai" />
                        <ComparisonRow label="Disponibilité" aiValue="24h/24 — 7j/7" humanValue="~8h/jour (jours ouvrables)" better="ai" />
                        <ComparisonRow label="Délai de réponse" aiValue="< 3 secondes" humanValue="2-5 minutes (si disponible)" better="ai" />
                        <ComparisonRow label="Langues" aiValue="FR + EN simultané" humanValue="Selon l'employé" better="ai" />
                        <ComparisonRow label="Coût mensuel" aiValue={`${fmt$(BENCH.aiCostPerMonth)}/mois`} humanValue="~3 500-4 500 $/mois" better="ai" />
                        <ComparisonRow label="Formation requise" aiValue="Aucune" humanValue="2-4 semaines" better="ai" />

                        <div
                          style={{
                            marginTop: 16,
                            padding: "12px 16px",
                            background: `${PALETTE.green}11`,
                            borderRadius: 8,
                            border: `1px solid ${PALETTE.green}33`,
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                          }}
                        >
                          <span style={{ fontSize: 20 }}>✅</span>
                          <span style={{ color: PALETTE.dimmed, fontSize: 12 }}>
                            Économie estimée sur ce mois:{" "}
                            <strong style={{ color: PALETTE.green }}>
                              {fmt$(Math.round(data.totals.conversations * (30 / selectedDays) * BENCH.costPerHumanInquiry - BENCH.aiCostPerMonth))}
                            </strong>
                            {" "}en remplaçant la gestion manuelle des demandes entrantes.{" "}
                            <span style={{ color: PALETTE.muted }}>
                              Basé sur {Math.round(data.totals.conversations * (30 / selectedDays))} interactions/mois estimées.
                            </span>
                          </span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* ── SECTION 2: KPIs OPÉRATIONNELS ── */}
              <div style={{ marginBottom: "2rem" }}>
                <SectionTitle>Performance opérationnelle</SectionTitle>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                    gap: "0.85rem",
                  }}
                >
                  <KpiCard
                    label="Conversations totales"
                    value={data.totals.conversations}
                    sub={`${data.period.from ?? "—"} au ${data.period.to ?? "—"}`}
                    accent={PALETTE.blue}
                  />
                  <KpiCard
                    label="Taux de résolution"
                    value={
                      data.totals.conversations > 0
                        ? `${Math.round(((data.byOutcome.answered ?? 0) / data.totals.conversations) * 100)}%`
                        : "—"
                    }
                    sub={`${data.byOutcome.answered ?? 0} répondues sans escalade`}
                    accent={PALETTE.green}
                  />
                  <KpiCard
                    label="Rappels demandés"
                    value={data.byOutcome.callback ?? 0}
                    sub="Leads chauds capturés"
                    accent={PALETTE.orange}
                  />
                  <KpiCard
                    label="Visites réservées"
                    value={data.byOutcome.booking ?? 0}
                    sub="Via calendrier"
                    accent={PALETTE.purple}
                  />
                  <KpiCard
                    label="Continuation tél."
                    value={data.byOutcome.phone ?? 0}
                    sub="Transferts Vapi"
                    accent={PALETTE.gold}
                  />
                  <KpiCard
                    label="Sessions françaises"
                    value={`${data.languageSplit.frPct}%`}
                    sub={`${data.languageSplit.enPct}% anglais`}
                    accent={PALETTE.purple}
                  />
                </div>
              </div>

              {/* ── SECTION 3: CHARTS ── */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "1rem",
                  marginBottom: "1rem",
                }}
              >
                {/* Outcome breakdown */}
                <div
                  style={{
                    background: PALETTE.cardBg,
                    border: `1px solid ${PALETTE.cardBorder}`,
                    borderRadius: 14,
                    padding: "1.5rem",
                  }}
                >
                  <SectionTitle>Répartition des résultats</SectionTitle>
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {Object.entries(OUTCOME_LABELS).map(([key, label]) => (
                      <OutcomeBar
                        key={key}
                        label={label}
                        count={data.byOutcome[key] ?? 0}
                        total={data.totals.conversations}
                        color={OUTCOME_COLORS[key] ?? PALETTE.muted}
                      />
                    ))}
                  </div>
                </div>

                {/* Daily volume */}
                <div
                  style={{
                    background: PALETTE.cardBg,
                    border: `1px solid ${PALETTE.cardBorder}`,
                    borderRadius: 14,
                    padding: "1.5rem",
                  }}
                >
                  <SectionTitle>Volume quotidien (14 derniers jours)</SectionTitle>
                  <BarChart series={data.dailySeries} />
                  <div style={{ display: "flex", gap: 36, marginTop: "0.75rem" }}>
                    <div>
                      <div style={{ color: PALETTE.muted, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        Moy. / jour
                      </div>
                      <div style={{ color: PALETTE.white, fontSize: 26, fontWeight: 700 }}>
                        {data.dailySeries.length > 0
                          ? (data.totals.conversations / data.dailySeries.length).toFixed(1)
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: PALETTE.muted, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        Pic journalier
                      </div>
                      <div style={{ color: PALETTE.white, fontSize: 26, fontWeight: 700 }}>
                        {data.dailySeries.length > 0
                          ? Math.max(...data.dailySeries.map((s) => s.count))
                          : "—"}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: PALETTE.muted, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                        Projeté / 30j
                      </div>
                      <div style={{ color: PALETTE.blue, fontSize: 26, fontWeight: 700 }}>
                        {data.dailySeries.length > 0
                          ? Math.round((data.totals.conversations / data.period.days) * 30)
                          : "—"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── SECTION: QUALITY REVIEW ── */}
              <QualityReviewPanel />

              {/* Footnote */}
              <div
                style={{
                  marginTop: "2rem",
                  padding: "1rem 1.5rem",
                  borderTop: `1px solid ${PALETTE.cardBorder}`,
                  color: PALETTE.muted,
                  fontSize: 10,
                  lineHeight: 1.6,
                }}
              >
                * Estimations basées sur les benchmarks du secteur fitness au Québec (Mindbody 2024, Association des clubs de fitness du Canada).
                Coût moyen d'un réceptionniste à Montréal: ~42 000 $/an (source: Emploi-Québec 2024). Taux de conversion web-to-member: 6% (clubs haut de gamme).
                Valeur membre annuelle: 2 700 $ (225 $/mois × 12). Les chiffres réels peuvent varier.
              </div>
            </div>
          ) : null}
        </main>
      </div>
    </>
  );
}
