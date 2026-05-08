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
  transferToHumanEnabled?: boolean;
  transferToHumanPhone?: string | null;
  transferBusinessHours?: {
    days: boolean[];
    startHour: number;
    endHour: number;
    timezone: string;
  };
  restaurantMenuLinks?: {
    menuUrl?: string | null;
    breakfastMenuUrl?: string | null;
    wineListUrl?: string | null;
    orderingUrl?: string | null;
    reservationUrl?: string | null;
    reservationMaxPartySize?: number | null;
    groupReservationsPhone?: string | null;
    groupReservationsCapacity?: string | null;
  };
}

const DAY_LABELS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

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
          Les modifications sont sauvegardées sur le serveur et survivent aux redémarrages.
          Le fichier JSON local (apps/api/data/tenants-overrides.json) est l&apos;autorité —
          la migration vers NocoDB est planifiée comme étape distincte.
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

        {/* Transfer to human (VAPI only) */}
        <div style={{ marginBottom: 24, padding: "16px 18px", background: "rgba(201,168,76,0.04)", borderRadius: 12, border: `1px solid ${P.gold}33` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <span style={{ fontSize: 18 }}>📞</span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: P.white }}>Transfert vers humain (appels VAPI)</div>
              <div style={{ fontSize: 11, color: P.muted, marginTop: 2 }}>
                Le concierge IA transfère uniquement si l&apos;appelant le demande explicitement et confirme.
                Hors heures, on capture un lead automatiquement.
              </div>
            </div>
          </div>

          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", marginBottom: 14 }}>
            <input
              type="checkbox"
              checked={form.transferToHumanEnabled ?? false}
              onChange={(e) => update("transferToHumanEnabled", e.target.checked)}
              style={{ width: 16, height: 16, accentColor: P.gold }}
            />
            <span style={{ fontSize: 12, color: P.dim, fontWeight: 600 }}>Activer le transfert vers humain</span>
          </label>

          {form.transferToHumanEnabled && (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Numéro de téléphone du transfert</label>
                <input
                  type="tel"
                  style={inputBase}
                  value={form.transferToHumanPhone ?? ""}
                  onChange={(e) => update("transferToHumanPhone", e.target.value || null)}
                  placeholder="+15148452233"
                />
                <div style={{ fontSize: 10, color: P.muted, marginTop: 4 }}>Format E.164 (ex. +15148452233).</div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Jours actifs</label>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {DAY_LABELS_FR.map((label, idx) => {
                    const days = form.transferBusinessHours?.days ?? [false, true, true, true, true, true, false];
                    const active = days[idx] ?? false;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => {
                          const next = [...days];
                          next[idx] = !active;
                          update("transferBusinessHours", {
                            days: next,
                            startHour: form.transferBusinessHours?.startHour ?? 9,
                            endHour: form.transferBusinessHours?.endHour ?? 17,
                            timezone: form.transferBusinessHours?.timezone ?? "America/Montreal",
                          });
                        }}
                        style={{
                          padding: "6px 12px",
                          borderRadius: 8,
                          border: `1px solid ${active ? P.gold + "88" : P.border}`,
                          background: active ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.03)",
                          color: active ? P.gold : P.muted,
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          minWidth: 44,
                        }}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Field
                  label="Début (heure 0-23)"
                  type="number"
                  value={String(form.transferBusinessHours?.startHour ?? 9)}
                  onChange={(v) => {
                    const startHour = Math.max(0, Math.min(23, Number(v) || 0));
                    update("transferBusinessHours", {
                      days: form.transferBusinessHours?.days ?? [false, true, true, true, true, true, false],
                      startHour,
                      endHour: form.transferBusinessHours?.endHour ?? 17,
                      timezone: form.transferBusinessHours?.timezone ?? "America/Montreal",
                    });
                  }}
                />
                <Field
                  label="Fin (heure 1-24)"
                  type="number"
                  value={String(form.transferBusinessHours?.endHour ?? 17)}
                  onChange={(v) => {
                    const endHour = Math.max(1, Math.min(24, Number(v) || 0));
                    update("transferBusinessHours", {
                      days: form.transferBusinessHours?.days ?? [false, true, true, true, true, true, false],
                      startHour: form.transferBusinessHours?.startHour ?? 9,
                      endHour,
                      timezone: form.transferBusinessHours?.timezone ?? "America/Montreal",
                    });
                  }}
                />
                <Field
                  label="Fuseau horaire"
                  value={form.transferBusinessHours?.timezone ?? "America/Montreal"}
                  onChange={(v) => {
                    update("transferBusinessHours", {
                      days: form.transferBusinessHours?.days ?? [false, true, true, true, true, true, false],
                      startHour: form.transferBusinessHours?.startHour ?? 9,
                      endHour: form.transferBusinessHours?.endHour ?? 17,
                      timezone: v || "America/Montreal",
                    });
                  }}
                  placeholder="America/Montreal"
                />
              </div>
            </>
          )}
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

        {/* Restaurant menu links — used by the concierge to direct guests to the right PDF */}
        <div style={{ marginBottom: 24, padding: 16, background: "rgba(255,255,255,0.02)", borderRadius: 10, border: `1px solid ${P.border}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: P.white, marginBottom: 4 }}>🍽 Restaurant — liens du menu</div>
          <div style={{ fontSize: 11, color: P.muted, marginBottom: 14 }}>
            Le concierge IA utilise ces URLs pour rediriger le visiteur vers le bon menu. Affichés sous forme de liens nommés (« Menu », « Petit-déjeuner », « Carte des vins ») et non en URL brute. Laisser vide si le tenant n&apos;a pas de restaurant.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
            <div>
              <label style={labelStyle}>Menu principal (URL PDF)</label>
              <input
                type="url"
                style={inputBase}
                value={form.restaurantMenuLinks?.menuUrl ?? ""}
                onChange={(e) =>
                  update("restaurantMenuLinks", {
                    ...(form.restaurantMenuLinks ?? {}),
                    menuUrl: e.target.value || null,
                  })
                }
                placeholder="https://…/menu.pdf"
              />
            </div>
            <div>
              <label style={labelStyle}>Menu petit-déjeuner (URL PDF)</label>
              <input
                type="url"
                style={inputBase}
                value={form.restaurantMenuLinks?.breakfastMenuUrl ?? ""}
                onChange={(e) =>
                  update("restaurantMenuLinks", {
                    ...(form.restaurantMenuLinks ?? {}),
                    breakfastMenuUrl: e.target.value || null,
                  })
                }
                placeholder="https://…/breakfast.pdf"
              />
            </div>
            <div>
              <label style={labelStyle}>Carte des vins (URL PDF)</label>
              <input
                type="url"
                style={inputBase}
                value={form.restaurantMenuLinks?.wineListUrl ?? ""}
                onChange={(e) =>
                  update("restaurantMenuLinks", {
                    ...(form.restaurantMenuLinks ?? {}),
                    wineListUrl: e.target.value || null,
                  })
                }
                placeholder="https://…/wine-list.pdf"
              />
            </div>
            <div>
              <label style={labelStyle}>Commande en ligne / take-out (optionnel)</label>
              <input
                type="url"
                style={inputBase}
                value={form.restaurantMenuLinks?.orderingUrl ?? ""}
                onChange={(e) =>
                  update("restaurantMenuLinks", {
                    ...(form.restaurantMenuLinks ?? {}),
                    orderingUrl: e.target.value || null,
                  })
                }
                placeholder="https://…/order"
              />
            </div>
            <div>
              <label style={labelStyle}>Réservation en ligne (URL widget)</label>
              <input
                type="url"
                style={inputBase}
                value={form.restaurantMenuLinks?.reservationUrl ?? ""}
                onChange={(e) =>
                  update("restaurantMenuLinks", {
                    ...(form.restaurantMenuLinks ?? {}),
                    reservationUrl: e.target.value || null,
                  })
                }
                placeholder="https://widgets.libroreserve.com/…"
              />
            </div>
            <div>
              <label style={labelStyle}>Taille max — réservation en ligne</label>
              <input
                type="number"
                min={1}
                max={50}
                style={inputBase}
                value={form.restaurantMenuLinks?.reservationMaxPartySize ?? ""}
                onChange={(e) =>
                  update("restaurantMenuLinks", {
                    ...(form.restaurantMenuLinks ?? {}),
                    reservationMaxPartySize: e.target.value ? Number(e.target.value) : null,
                  })
                }
                placeholder="6"
              />
            </div>
            <div>
              <label style={labelStyle}>Téléphone réservations de groupe</label>
              <input
                type="text"
                style={inputBase}
                value={form.restaurantMenuLinks?.groupReservationsPhone ?? ""}
                onChange={(e) =>
                  update("restaurantMenuLinks", {
                    ...(form.restaurantMenuLinks ?? {}),
                    groupReservationsPhone: e.target.value || null,
                  })
                }
                placeholder="(514) 845-8002"
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label style={labelStyle}>Capacité réservations de groupe</label>
              <input
                type="text"
                style={inputBase}
                value={form.restaurantMenuLinks?.groupReservationsCapacity ?? ""}
                onChange={(e) =>
                  update("restaurantMenuLinks", {
                    ...(form.restaurantMenuLinks ?? {}),
                    groupReservationsCapacity: e.target.value || null,
                  })
                }
                placeholder="ex. salle de conférence jusqu'à 10 personnes"
              />
            </div>
          </div>
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
