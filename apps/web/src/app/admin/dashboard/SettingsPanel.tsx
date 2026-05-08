"use client";

/**
 * Tenant Settings panel — surfaced inside the admin dashboard.
 *
 * Editable fields are PATCHed to /v1/admin/tenants/:id. The most important
 * field (notifyEmail) supports comma- or semicolon-separated lists so leads
 * can be routed to multiple recipients without code changes.
 *
 * Note: edits are in-memory on the API server and reset on restart until the
 * NocoDB persistence migration ships. The UI surfaces this caveat so you know
 * to also commit the change to source if it should outlive the next deploy.
 */
import { useEffect, useState } from "react";
import { P, API, Card, SectionTitle } from "../_components/AdminShell";

interface TenantSettings {
  id: string;
  name: string;
  plan: string;
  status: string;
  notifyEmail: string;
  vapiAssistantId: string | null;
  vapiPhoneNumberId: string | null;
  inboundPhoneNumber: string | null;
  openAiModel: string;
  monthlyPriceCad: number;
  contactName: string | null;
  contactEmail: string | null;
  website: string | null;
  notes: string | null;
  conciergeName?: string;
  description?: string;
  primaryContactPhone?: string;
  primaryContactEmail?: string;
  tunnelCtaFr?: string;
  tunnelCtaEn?: string;
  defaultLanguage?: "fr" | "en" | "bilingual";
}

interface Props {
  tenantId: string;
  initial: TenantSettings;
  token: string;
  onSaved?: (updated: TenantSettings) => void;
}

const inputBase: React.CSSProperties = {
  width: "100%",
  background: "rgba(255,255,255,0.04)",
  border: `1px solid ${P.border}`,
  borderRadius: 8,
  color: P.white,
  fontSize: 13,
  padding: "9px 12px",
  fontFamily: "inherit",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 10,
  color: P.muted,
  textTransform: "uppercase",
  letterSpacing: "0.1em",
  marginBottom: 6,
  fontWeight: 600,
};

export default function SettingsPanel({ tenantId, initial, token, onSaved }: Props) {
  const [form, setForm] = useState<TenantSettings>(initial);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    setForm(initial);
    setDirty(false);
    setError(null);
  }, [initial, tenantId]);

  function update<K extends keyof TenantSettings>(key: K, value: TenantSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${API}/v1/admin/tenants/${tenantId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-admin-token": token },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
        throw new Error(body.message ?? body.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as { tenant: TenantSettings };
      setSavedAt(new Date());
      setDirty(false);
      onSaved?.(data.tenant);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionTitle>Paramètres du client</SectionTitle>
      <Card>
        <div style={{ fontSize: 11, color: P.muted, marginBottom: 16, lineHeight: 1.5 }}>
          Modifications appliquées immédiatement sur le serveur en cours d&apos;exécution.
          Pour les rendre permanentes, mettez aussi à jour la source (NocoDB ou code).
        </div>

        {/* Lead notification — the highlight field */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ ...labelStyle, color: P.gold }}>📨 Destinataires des leads (séparés par virgule)</label>
          <input
            type="text"
            style={{ ...inputBase, borderColor: `${P.gold}66` }}
            value={form.notifyEmail ?? ""}
            onChange={(e) => update("notifyEmail", e.target.value)}
            placeholder="lead@client.com, autre@client.com"
          />
          <div style={{ fontSize: 11, color: P.muted, marginTop: 6 }}>
            Tous les leads (chat + voix) seront envoyés à ces adresses. Multiple supporté.
          </div>
        </div>

        {/* Identity */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
          <Field label="Nom du client" value={form.name} onChange={(v) => update("name", v)} />
          <SelectField
            label="Plan"
            value={form.plan}
            onChange={(v) => update("plan", v)}
            options={[
              ["starter", "Starter"],
              ["professional", "Professional"],
              ["enterprise", "Enterprise"],
            ]}
          />
          <SelectField
            label="Statut"
            value={form.status}
            onChange={(v) => update("status", v)}
            options={[
              ["active", "Active"],
              ["trial", "Trial"],
              ["suspended", "Suspended"],
            ]}
          />
          <Field
            label="Prix mensuel CAD"
            value={String(form.monthlyPriceCad ?? 0)}
            onChange={(v) => update("monthlyPriceCad", Number(v) || 0)}
            type="number"
          />
        </div>

        {/* Concierge identity */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
          <Field label="Nom du concierge IA" value={form.conciergeName ?? ""} onChange={(v) => update("conciergeName", v)} placeholder="Sophie, SophIA, Maxime…" />
          <SelectField
            label="Langue par défaut"
            value={form.defaultLanguage ?? "bilingual"}
            onChange={(v) => update("defaultLanguage", v as "fr" | "en" | "bilingual")}
            options={[
              ["bilingual", "Bilingue"],
              ["fr", "Français"],
              ["en", "English"],
            ]}
          />
          <Field label="CTA principal (FR)" value={form.tunnelCtaFr ?? ""} onChange={(v) => update("tunnelCtaFr", v)} placeholder="Planifier une visite" />
          <Field label="CTA principal (EN)" value={form.tunnelCtaEn ?? ""} onChange={(v) => update("tunnelCtaEn", v)} placeholder="Schedule a visit" />
        </div>

        {/* Public contact */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
          <Field label="Téléphone public" value={form.primaryContactPhone ?? ""} onChange={(v) => update("primaryContactPhone", v)} placeholder="(514) 845-2233" />
          <Field label="Courriel public" value={form.primaryContactEmail ?? ""} onChange={(v) => update("primaryContactEmail", v)} placeholder="info@client.com" type="email" />
          <Field label="Site web" value={form.website ?? ""} onChange={(v) => update("website", v)} placeholder="https://www.client.com" />
          <Field label="Modèle OpenAI" value={form.openAiModel} onChange={(v) => update("openAiModel", v)} placeholder="gpt-4o-mini" />
        </div>

        {/* VAPI */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 24 }}>
          <Field label="VAPI Assistant ID" value={form.vapiAssistantId ?? ""} onChange={(v) => update("vapiAssistantId", v || null)} />
          <Field label="VAPI Phone Number ID" value={form.vapiPhoneNumberId ?? ""} onChange={(v) => update("vapiPhoneNumberId", v || null)} />
          <Field label="Numéro entrant" value={form.inboundPhoneNumber ?? ""} onChange={(v) => update("inboundPhoneNumber", v || null)} placeholder="+14385551234" />
        </div>

        {/* Description / notes */}
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Description</label>
          <textarea
            rows={2}
            style={{ ...inputBase, fontFamily: "inherit", resize: "vertical" }}
            value={form.description ?? ""}
            onChange={(e) => update("description", e.target.value)}
            placeholder="1-2 phrases utilisées par l'IA pour se présenter."
          />
        </div>
        <div style={{ marginBottom: 24 }}>
          <label style={labelStyle}>Notes internes</label>
          <textarea
            rows={3}
            style={{ ...inputBase, fontFamily: "inherit", resize: "vertical" }}
            value={form.notes ?? ""}
            onChange={(e) => update("notes", e.target.value || null)}
            placeholder="Visible seulement dans ce dashboard."
          />
        </div>

        {/* Action row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 8, borderTop: `1px solid ${P.border}` }}>
          <button
            onClick={() => void save()}
            disabled={!dirty || saving}
            style={{
              background: dirty ? P.gold : "rgba(255,255,255,0.06)",
              color: dirty ? "#111" : P.muted,
              border: "none",
              borderRadius: 8,
              padding: "10px 22px",
              fontSize: 13,
              fontWeight: 700,
              cursor: dirty && !saving ? "pointer" : "not-allowed",
              opacity: saving ? 0.6 : 1,
              transition: "all 0.15s ease",
            }}
          >
            {saving ? "Enregistrement…" : "Enregistrer les changements"}
          </button>
          {!dirty && savedAt && (
            <span style={{ fontSize: 11, color: P.green }}>
              ✓ Enregistré à {savedAt.toLocaleTimeString("fr-CA")}
            </span>
          )}
          {dirty && (
            <span style={{ fontSize: 11, color: P.orange }}>● Changements non enregistrés</span>
          )}
          {error && (
            <span style={{ fontSize: 11, color: P.red }}>Erreur: {error}</span>
          )}
        </div>
      </Card>
    </section>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <input
        type={type}
        style={inputBase}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </div>
  );
}

function SelectField({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: Array<[string, string]> }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      <select
        style={{ ...inputBase, appearance: "none", cursor: "pointer" }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}
