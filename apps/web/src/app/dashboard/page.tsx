export const dynamic = "force-dynamic";

interface AnalyticsData {
  tenantId: string;
  period: { days: number; from: string | null; to: string | null };
  totals: { conversations: number; needsFollowup: number; needsFollowupRate: number };
  byOutcome: Record<string, number>;
  byLanguage: Record<string, number>;
  languageSplit: { frPct: number; enPct: number };
  dailySeries: { date: string; count: number }[];
}

async function fetchAnalytics(days = 30): Promise<AnalyticsData | null> {
  try {
    const res = await fetch(
      `http://localhost:4000/v1/tenants/maa/analytics?days=${days}`,
      { cache: "no-store" },
    );
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const OUTCOME_LABELS: Record<string, string> = {
  answered: "Answered",
  escalated: "Clarification needed",
  callback: "Callback requested",
  booking: "Booking initiated",
  phone: "Continued by phone",
  unknown: "Unknown",
};

const OUTCOME_COLORS: Record<string, string> = {
  answered: "#1a5c38",
  escalated: "#a07830",
  callback: "#1a4a7a",
  booking: "#6b3a8c",
  phone: "#2a6b5a",
  unknown: "#3a4a40",
};

function KpiCard({
  label,
  value,
  sub,
  accent = "#c9a84c",
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: "#111f17",
        border: "1px solid #1c3828",
        borderRadius: 12,
        padding: "1.5rem",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <span style={{ color: "#6b8c7a", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600 }}>
        {label}
      </span>
      <span style={{ color: accent, fontSize: 36, fontWeight: 700, lineHeight: 1 }}>
        {value}
      </span>
      {sub && (
        <span style={{ color: "#3d5e4a", fontSize: 12 }}>{sub}</span>
      )}
    </div>
  );
}

function OutcomeBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ color: "#8aab96", fontSize: 12 }}>{label}</span>
        <span style={{ color: "#c9a84c", fontSize: 12, fontWeight: 600 }}>{count} <span style={{ color: "#3d5e4a" }}>({pct}%)</span></span>
      </div>
      <div style={{ height: 6, background: "#1c3828", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.3s" }} />
      </div>
    </div>
  );
}

function MiniChart({ series }: { series: { date: string; count: number }[] }) {
  if (series.length === 0) return <div style={{ color: "#3d5e4a", fontSize: 12 }}>No data yet</div>;

  const max = Math.max(...series.map((s) => s.count), 1);
  const last14 = series.slice(-14);

  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 60 }}>
      {last14.map((s) => (
        <div key={s.date} title={`${s.date}: ${s.count}`} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
          <div
            style={{
              width: "100%",
              height: Math.max((s.count / max) * 52, 2),
              background: "#1a5c38",
              borderRadius: 2,
              transition: "height 0.3s",
            }}
          />
          <span style={{ color: "#2d4a38", fontSize: 9, writingMode: "vertical-rl", transform: "rotate(180deg)" }}>
            {s.date.slice(5)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default async function DashboardPage() {
  const data = await fetchAnalytics(30);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0d1f17",
        fontFamily: "Inter, system-ui, -apple-system, sans-serif",
        color: "#ffffff",
      }}
    >
      {/* Header */}
      <header
        style={{
          background: "#0d1f17",
          borderBottom: "1px solid #1c3828",
          padding: "0 2rem",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, background: "linear-gradient(135deg, #c9a84c, #a07830)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#0d1f17", fontWeight: 900, fontSize: 13 }}>M</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 15, color: "#ffffff", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Club Sportif MAA
          </span>
        </div>
        <span style={{ color: "#c9a84c", fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", fontWeight: 600 }}>
          Concierge Dashboard · Last 30 days
        </span>
      </header>

      <main style={{ padding: "2rem", maxWidth: 1100, margin: "0 auto" }}>
        {!data ? (
          <div style={{ color: "#6b8c7a", textAlign: "center", paddingTop: "4rem" }}>
            <p style={{ fontSize: 18 }}>Analytics unavailable — API not reachable.</p>
            <p style={{ fontSize: 13, marginTop: 8 }}>Make sure the API is running on port 4000.</p>
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "1rem",
                marginBottom: "1.5rem",
              }}
            >
              <KpiCard
                label="Total Conversations"
                value={data.totals.conversations}
                sub={`${data.period.from ?? "—"} → ${data.period.to ?? "—"}`}
              />
              <KpiCard
                label="Fully Answered"
                value={`${data.byOutcome.answered ?? 0}`}
                sub={`${data.totals.conversations > 0 ? Math.round(((data.byOutcome.answered ?? 0) / data.totals.conversations) * 100) : 0}% resolution rate`}
                accent="#4caf7a"
              />
              <KpiCard
                label="Callbacks Requested"
                value={data.byOutcome.callback ?? 0}
                sub="Leads captured"
                accent="#6ba8e8"
              />
              <KpiCard
                label="Phone Continuations"
                value={data.byOutcome.phone ?? 0}
                sub="Escalated to Vapi"
                accent="#e8c36b"
              />
              <KpiCard
                label="French Sessions"
                value={`${data.languageSplit.frPct}%`}
                sub={`${data.languageSplit.enPct}% English`}
                accent="#c9a84c"
              />
              <KpiCard
                label="Needs Follow-up"
                value={`${data.totals.needsFollowupRate}%`}
                sub={`${data.totals.needsFollowup} of ${data.totals.conversations}`}
                accent={data.totals.needsFollowupRate > 30 ? "#e87a6b" : "#4caf7a"}
              />
            </div>

            {/* Charts row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              {/* Outcome breakdown */}
              <div style={{ background: "#111f17", border: "1px solid #1c3828", borderRadius: 12, padding: "1.5rem" }}>
                <h2 style={{ color: "#c9a84c", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, margin: "0 0 1.25rem" }}>
                  Outcome Breakdown
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {Object.entries(OUTCOME_LABELS).map(([key, label]) => (
                    <OutcomeBar
                      key={key}
                      label={label}
                      count={data.byOutcome[key] ?? 0}
                      total={data.totals.conversations}
                      color={OUTCOME_COLORS[key] ?? "#1a5c38"}
                    />
                  ))}
                </div>
              </div>

              {/* Daily volume */}
              <div style={{ background: "#111f17", border: "1px solid #1c3828", borderRadius: 12, padding: "1.5rem" }}>
                <h2 style={{ color: "#c9a84c", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, margin: "0 0 1.25rem" }}>
                  Daily Volume (last 14 days)
                </h2>
                <MiniChart series={data.dailySeries} />
                <div style={{ marginTop: "1.25rem", display: "flex", gap: 24 }}>
                  <div>
                    <div style={{ color: "#6b8c7a", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>Avg / day</div>
                    <div style={{ color: "#ffffff", fontSize: 22, fontWeight: 700 }}>
                      {data.dailySeries.length > 0
                        ? (data.totals.conversations / data.dailySeries.length).toFixed(1)
                        : "—"}
                    </div>
                  </div>
                  <div>
                    <div style={{ color: "#6b8c7a", fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase" }}>Peak day</div>
                    <div style={{ color: "#ffffff", fontSize: 22, fontWeight: 700 }}>
                      {data.dailySeries.length > 0
                        ? Math.max(...data.dailySeries.map((s) => s.count))
                        : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Language split */}
            <div style={{ marginTop: "1rem", background: "#111f17", border: "1px solid #1c3828", borderRadius: 12, padding: "1.5rem" }}>
              <h2 style={{ color: "#c9a84c", fontSize: 12, letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 600, margin: "0 0 1rem" }}>
                Language Distribution
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ flex: 1, height: 12, background: "#1c3828", borderRadius: 6, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${data.languageSplit.frPct}%`, background: "linear-gradient(90deg, #c9a84c, #a07830)", borderRadius: 6 }} />
                </div>
                <span style={{ color: "#c9a84c", fontWeight: 700, fontSize: 14, minWidth: 80 }}>
                  {data.languageSplit.frPct}% Français
                </span>
                <span style={{ color: "#6b8c7a", fontSize: 14, minWidth: 80 }}>
                  {data.languageSplit.enPct}% English
                </span>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
