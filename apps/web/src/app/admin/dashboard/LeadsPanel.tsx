"use client";

/**
 * Leads panel — surfaced inside the admin dashboard for the selected tenant.
 *
 * Pulls callback requests from /v1/admin/tenants/:id/leads (NocoDB-backed),
 * shows them in a sortable table, exposes Export CSV. Exports include all
 * fields visible in the table, escaped for spreadsheet safety.
 */
import { useEffect, useState } from "react";
import { P, API, Card, SectionTitle } from "../_components/AdminShell";

interface Lead {
  uuid?: string;
  name?: string | null;
  phone: string;
  email?: string | null;
  preferred_time_text?: string | null;
  question_summary?: string | null;
  locale?: string | null;
  status?: string | null;
  created_at: string;
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

function escapeCsv(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value).replace(/"/g, '""');
  return /[",\n;]/.test(s) ? `"${s}"` : s;
}

function toCsv(leads: Lead[]): string {
  const header = ["Date", "Nom", "Téléphone", "Courriel", "Plage horaire", "Langue", "Résumé", "Statut"];
  const rows = leads.map((l) => [
    l.created_at,
    l.name ?? "",
    l.phone,
    l.email ?? "",
    l.preferred_time_text ?? "",
    l.locale ?? "",
    l.question_summary ?? "",
    l.status ?? "",
  ].map(escapeCsv).join(","));
  return [header.join(","), ...rows].join("\n");
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function LeadsPanel({ tenantId, tenantName, token }: Props) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`${API}/v1/admin/tenants/${tenantId}/leads?days=${days}`, {
      headers: { "x-admin-token": token },
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<{ leads: Lead[]; count: number }>;
      })
      .then((data) => {
        if (cancelled) return;
        setLeads(data.leads ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Failed to load leads");
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [tenantId, days, token]);

  function handleExport() {
    if (leads.length === 0) return;
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(`leads-${tenantId}-${stamp}.csv`, toCsv(leads));
  }

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionTitle>Leads — {tenantName}</SectionTitle>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 14 }}>
        <KpiTile label="Total" value={leads.length} sub={`${days} derniers jours`} accent={P.gold} />
        <KpiTile label="Aujourd'hui" value={leads.filter(isToday).length} accent={P.green} />
        <KpiTile label="7 jours" value={leads.filter(isWithin(7)).length} accent={P.blue} />
        <KpiTile label="Avec courriel" value={leads.filter((l) => l.email).length} sub="contactables par email" />
      </div>

      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 11, color: P.muted }}>Période</span>
            {[7, 30, 90, 365].map((d) => (
              <button
                key={d}
                onClick={() => setDays(d)}
                style={{
                  background: days === d ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.04)",
                  border: `1px solid ${days === d ? P.gold + "66" : P.border}`,
                  borderRadius: 8,
                  color: days === d ? P.gold : P.dim,
                  fontSize: 12,
                  padding: "5px 12px",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {d}j
              </button>
            ))}
          </div>
          <button
            onClick={handleExport}
            disabled={leads.length === 0}
            style={{
              background: leads.length > 0 ? P.gold : "rgba(255,255,255,0.06)",
              color: leads.length > 0 ? "#111" : P.muted,
              border: "none",
              borderRadius: 8,
              padding: "8px 16px",
              fontSize: 12,
              fontWeight: 700,
              cursor: leads.length > 0 ? "pointer" : "not-allowed",
            }}
          >
            ⬇ Exporter CSV
          </button>
        </div>

        {loading && <div style={{ color: P.muted, fontSize: 13 }}>Chargement…</div>}
        {error && <div style={{ color: P.red, fontSize: 13 }}>Erreur: {error}</div>}
        {!loading && !error && leads.length === 0 && (
          <div style={{ color: P.muted, fontSize: 13, padding: "20px 0", textAlign: "center" }}>
            Aucun lead capturé sur les {days} derniers jours.
          </div>
        )}

        {!loading && !error && leads.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${P.border}`, color: P.muted }}>
                  {["Date", "Nom", "Téléphone", "Courriel", "Plage", "Langue", "Résumé"].map((h) => (
                    <th key={h} style={{ padding: "9px 12px", textAlign: "left", fontWeight: 600, fontSize: 10, textTransform: "uppercase", letterSpacing: "0.06em", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {leads.map((l) => (
                  <tr key={l.uuid ?? l.created_at + l.phone} style={{ borderBottom: `1px solid ${P.border}` }}>
                    <td style={{ padding: "10px 12px", color: P.dim, whiteSpace: "nowrap" }}>{fmtDate(l.created_at)}</td>
                    <td style={{ padding: "10px 12px", color: P.white, fontWeight: 600 }}>{l.name ?? "—"}</td>
                    <td style={{ padding: "10px 12px", color: P.dim, whiteSpace: "nowrap" }}>
                      <a href={`tel:${l.phone}`} style={{ color: P.gold, textDecoration: "none" }}>{l.phone}</a>
                    </td>
                    <td style={{ padding: "10px 12px", color: P.dim }}>
                      {l.email ? <a href={`mailto:${l.email}`} style={{ color: P.blue, textDecoration: "none" }}>{l.email}</a> : "—"}
                    </td>
                    <td style={{ padding: "10px 12px", color: P.dim }}>{l.preferred_time_text ?? "—"}</td>
                    <td style={{ padding: "10px 12px", color: P.dim }}>{l.locale?.startsWith("fr") ? "FR" : "EN"}</td>
                    <td style={{ padding: "10px 12px", color: P.dim, maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={l.question_summary ?? ""}>
                      {l.question_summary ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}

function KpiTile({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: string }) {
  return (
    <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${P.border}`, borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ fontSize: 9, color: P.muted, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: accent ?? P.white, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: P.muted, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function isToday(l: Lead): boolean {
  const created = new Date(l.created_at);
  const now = new Date();
  return created.toDateString() === now.toDateString();
}

function isWithin(days: number): (l: Lead) => boolean {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return (l: Lead) => Date.parse(l.created_at) >= cutoff;
}
