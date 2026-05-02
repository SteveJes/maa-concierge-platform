"use client";

import { useState, useRef } from "react";
import AdminShell, { P, API, adminHeaders, Card, SectionTitle, GoldBtn, GhostBtn, Field, fieldStyle, labelStyle } from "../_components/AdminShell";

// ── Types ─────────────────────────────────────────────────────────────────────

interface OnboardingData {
  // Step 1 — Company Info
  companyName: string;
  industry: string;
  website: string;
  address: string;
  phone: string;
  email: string;
  // Step 2 — Brand & Voice
  language: string;
  tone: string;
  conciergeName: string;
  description: string;
  // Step 3 — Knowledge Sources
  crawlerEnabled: boolean;
  crawlerUrl: string;
  pdfs: File[];
  // Step 4 — Voice & Phone
  vapiEnabled: boolean;
  vapiAssistantId: string;
  vapiPhoneNumberId: string;
  openAiModel: string;
  // Step 5 — Plan & Billing
  plan: string;
  billingTerm: "monthly" | "annual";
  monthlyPriceCad: string;
  implementationFee: string;
  implFeeWaived: boolean;
  addons: string[];
  contactName: string;
  contactEmail: string;
  notifyEmail: string;
  sendInvoice: boolean;
  notes: string;
}

const EMPTY: OnboardingData = {
  companyName: "", industry: "", website: "", address: "", phone: "", email: "",
  language: "fr", tone: "premium-warm", conciergeName: "Sophie", description: "",
  crawlerEnabled: true, crawlerUrl: "", pdfs: [],
  vapiEnabled: false, vapiAssistantId: "", vapiPhoneNumberId: "", openAiModel: "gpt-4o",
  plan: "essentiel", billingTerm: "monthly", monthlyPriceCad: "599", implementationFee: "1950", implFeeWaived: false,
  addons: [], contactName: "", contactEmail: "", notifyEmail: "", sendInvoice: true, notes: "",
};

const INDUSTRIES = [
  "Fitness & Wellness", "Medical / Clinic", "Spa & Beauty", "Real Estate",
  "Hospitality & Hotel", "Restaurant", "Retail", "Professional Services",
  "Education", "Other",
];

const TONES = [
  { value: "premium-warm", label: "Premium & Warm", desc: "Polished, welcoming — ideal for fitness, wellness, hospitality" },
  { value: "professional", label: "Professional & Precise", desc: "Formal, efficient — ideal for medical, legal, finance" },
  { value: "friendly-casual", label: "Friendly & Casual", desc: "Approachable, conversational — ideal for retail, food" },
  { value: "luxury", label: "Luxury & Exclusive", desc: "Understated, refined — ideal for high-end spa, real estate" },
  { value: "energetic", label: "Energetic & Motivating", desc: "High-energy, inspiring — ideal for gyms, coaching" },
];

interface PlanDef {
  value: string;
  label: string;
  desc: string;
  monthly: number;
  implFee: number;
  custom?: boolean;
}

const PLANS: PlanDef[] = [
  { value: "essentiel", label: "Essentiel", monthly: 599, implFee: 1950, desc: "Concierge web · Chat IA bilingue · Base de connaissances · Support standard" },
  { value: "croissance", label: "Croissance", monthly: 1290, implFee: 3950, desc: "Tout Essentiel + IA vocale · Rappel automatique · Analytics · Support prioritaire" },
  { value: "prestige", label: "Prestige", monthly: 2590, implFee: 7950, desc: "Tout Croissance + Voix personnalisée · Multi-site · Intégrations CRM · SLA garanti" },
  { value: "autre", label: "Autre / Sur mesure", monthly: 0, implFee: 0, custom: true, desc: "Tarification personnalisée — entrez les montants manuellement" },
];

const ADDONS = [
  { value: "voice_calls", label: "AI Voice Calls (VAPI)" },
  { value: "knowledge_sync", label: "Auto Knowledge Sync" },
  { value: "crm_integration", label: "CRM Integration" },
  { value: "custom_voice", label: "Custom Voice (ElevenLabs)" },
  { value: "analytics", label: "Advanced Analytics" },
  { value: "white_label", label: "White-Label Branding" },
];

const STEPS = [
  { n: 1, label: "Company Info" },
  { n: 2, label: "Brand & Voice" },
  { n: 3, label: "Knowledge" },
  { n: 4, label: "Voice & Phone" },
  { n: 5, label: "Plan & Billing" },
  { n: 6, label: "Review" },
];

// ── Main component ─────────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ invoiceNumber?: string; stripeUrl?: string; total?: number; tenantSlug?: string } | null>(null);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  function set<K extends keyof OnboardingData>(key: K, val: OnboardingData[K]) {
    setData(prev => ({ ...prev, [key]: val }));
  }

  function toggleAddon(v: string) {
    set("addons", data.addons.includes(v) ? data.addons.filter(a => a !== v) : [...data.addons, v]);
  }

  async function handleFileAdd(files: FileList | null) {
    if (!files) return;
    const newFiles = Array.from(files).filter(f => f.type === "application/pdf");
    set("pdfs", [...data.pdfs, ...newFiles]);
  }

  async function submit() {
    setError("");
    setSubmitting(true);
    try {
      // 1. Upload PDFs
      const uploadedUrls: string[] = [];
      for (const pdf of data.pdfs) {
        const fd = new FormData();
        fd.append("file", pdf);
        fd.append("companyName", data.companyName);
        setUploadProgress(p => [...p, `Uploading ${pdf.name}…`]);
        const r = await fetch(`${API}/v1/admin/onboarding/upload-pdf`, {
          method: "POST",
          headers: { "x-admin-token": adminHeaders()["x-admin-token"] },
          body: fd,
        });
        if (r.ok) {
          const { url } = await r.json() as { url: string };
          uploadedUrls.push(url);
          setUploadProgress(p => [...p.slice(0, -1), `✓ ${pdf.name}`]);
        }
      }

      // 2. Submit tenant
      const res = await fetch(`${API}/v1/admin/onboarding`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          ...data,
          pdfs: undefined,
          uploadedPdfUrls: uploadedUrls,
          implementationFee: data.implFeeWaived ? "0" : data.implementationFee,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(e.error ?? `HTTP ${res.status}`);
      }
      const result = await res.json() as { invoiceNumber?: string; stripeUrl?: string; total?: number; tenantSlug?: string };
      setSubmitResult(result);
      setSubmitted(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) return (
    <AdminShell title="Onboarding" subtitle="New tenant setup">
      <div style={{ maxWidth: 560, margin: "60px auto", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 20 }}>✓</div>
        <h2 style={{ color: P.gold, fontWeight: 800, fontSize: 28, margin: "0 0 12px" }}>Tenant créé !</h2>
        <p style={{ color: P.dim, fontSize: 15, marginBottom: 28 }}>
          <strong style={{ color: P.white }}>{data.companyName}</strong> est maintenant sur la plateforme.
        </p>
        {submitResult?.invoiceNumber && (
          <div style={{ background: "rgba(201,168,76,0.07)", border: "1px solid rgba(201,168,76,0.25)", borderRadius: 12, padding: "20px 24px", marginBottom: 24, textAlign: "left" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Facturation</div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ color: P.dim, fontSize: 14 }}>N° facture</span>
              <span style={{ color: P.white, fontWeight: 700, fontFamily: "monospace" }}>{submitResult.invoiceNumber}</span>
            </div>
            {submitResult.total != null && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ color: P.dim, fontSize: 14 }}>Total (taxes incluses)</span>
                <span style={{ color: P.gold, fontWeight: 800, fontSize: 16 }}>{submitResult.total.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}</span>
              </div>
            )}
            <div style={{ fontSize: 12, color: P.muted }}>
              {data.sendInvoice ? `Facture envoyée à ${data.contactEmail}` : "Envoi de facture désactivé"}
            </div>
            {submitResult.stripeUrl && (
              <a href={submitResult.stripeUrl} target="_blank" rel="noreferrer"
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14, background: "linear-gradient(135deg,#c9a84c,#8b6010)", borderRadius: 8, padding: "11px 20px", color: "#111", fontWeight: 700, fontSize: 14, textDecoration: "none" }}>
                Ouvrir le lien de paiement Stripe →
              </a>
            )}
          </div>
        )}
        {submitResult?.tenantSlug && (
          <div style={{ background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)', borderRadius: 12, padding: '20px 24px', marginBottom: 24, textAlign: 'left' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>Démo concierge</div>
            <div style={{ fontSize: 13, color: P.dim, marginBottom: 10 }}>
              Voici l'URL de démonstration à partager avec le client :
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 14 }}>
              <code style={{ flex: 1, color: '#3db8f5', fontSize: 13, fontFamily: 'monospace', wordBreak: 'break-all' }}>
                {'https://clients.dubub.com/demo/' + submitResult.tenantSlug}
              </code>
              <button
                type="button"
                onClick={() => { void navigator.clipboard.writeText('https://clients.dubub.com/demo/' + submitResult!.tenantSlug!); }}
                style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: P.muted, fontSize: 11, cursor: 'pointer', padding: '4px 10px', whiteSpace: 'nowrap' }}
              >
                Copier
              </button>
            </div>
            <a
              href={'https://clients.dubub.com/demo/' + submitResult.tenantSlug}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#3db8f5', fontSize: 13, textDecoration: 'underline' }}
            >
              Ouvrir la démo →
            </a>
          </div>
        )}
        <GoldBtn onClick={() => { setData(EMPTY); setStep(1); setSubmitted(false); setSubmitResult(null); setUploadProgress([]); }}>
          Ajouter un autre tenant
        </GoldBtn>
      </div>
    </AdminShell>
  );

  return (
    <AdminShell title="New Tenant Onboarding" subtitle="Set up a new client on the Concierge Platform">
      {/* Progress bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 36, alignItems: "center" }}>
        {STEPS.map((s, i) => {
          const done = step > s.n;
          const active = step === s.n;
          return (
            <div key={s.n} style={{ display: "flex", alignItems: "center", flex: i < STEPS.length - 1 ? 1 : undefined }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, cursor: done ? "pointer" : "default" }}
                   onClick={() => { if (done) setStep(s.n); }}>
                <div style={{
                  width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700,
                  background: done ? P.gold : active ? "rgba(201,168,76,0.15)" : "rgba(255,255,255,0.05)",
                  border: `2px solid ${done || active ? P.gold : P.border}`,
                  color: done ? "#111" : active ? P.gold : P.muted,
                  transition: "all 0.2s",
                }}>
                  {done ? "✓" : s.n}
                </div>
                <span style={{ fontSize: 10, color: active ? P.gold : done ? P.dim : P.muted, fontWeight: active ? 700 : 500, whiteSpace: "nowrap" }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: done ? P.gold : P.border, margin: "0 6px", marginBottom: 22, transition: "background 0.3s" }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step content */}
      <Card style={{ maxWidth: 680, margin: "0 auto" }}>
        {step === 1 && <Step1 data={data} set={set} />}
        {step === 2 && <Step2 data={data} set={set} />}
        {step === 3 && <Step3 data={data} set={set} fileRef={fileRef} onFiles={handleFileAdd} />}
        {step === 4 && <Step4 data={data} set={set} />}
        {step === 5 && <Step5 data={data} set={set} />}
        {step === 6 && <Step6 data={data} uploadProgress={uploadProgress} />}

        {error && <div style={{ color: P.red, fontSize: 13, marginTop: 16, padding: "10px 14px", background: "rgba(255,82,82,0.08)", borderRadius: 8 }}>{error}</div>}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 32 }}>
          <div>
            {step > 1 && <GhostBtn onClick={() => setStep(s => s - 1)}>← Back</GhostBtn>}
          </div>
          <div>
            {step < 6 && <GoldBtn onClick={() => setStep(s => s + 1)}>Continue →</GoldBtn>}
            {step === 6 && <GoldBtn onClick={() => void submit()} disabled={submitting}>{submitting ? "Creating tenant…" : "Create tenant"}</GoldBtn>}
          </div>
        </div>
      </Card>
    </AdminShell>
  );
}

// ── Steps ──────────────────────────────────────────────────────────────────────

function Step1({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionTitle>Company Information</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Company Name" required>
          <input style={fieldStyle} value={data.companyName} onChange={e => set("companyName", e.target.value)} placeholder="Club Sportif MAA" />
        </Field>
        <Field label="Industry" required>
          <select style={fieldStyle} value={data.industry} onChange={e => set("industry", e.target.value)}>
            <option value="">Select industry…</option>
            {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Website URL" required hint="Used by the knowledge crawler to fetch business info">
        <input style={fieldStyle} value={data.website} onChange={e => set("website", e.target.value)} placeholder="https://www.example.com" />
      </Field>
      <Field label="Address">
        <input style={fieldStyle} value={data.address} onChange={e => set("address", e.target.value)} placeholder="1234 Rue Sainte-Catherine, Montréal, QC" />
      </Field>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Phone Number">
          <input style={fieldStyle} value={data.phone} onChange={e => set("phone", e.target.value)} placeholder="+1 514 000-0000" />
        </Field>
        <Field label="Business Email">
          <input style={fieldStyle} value={data.email} onChange={e => set("email", e.target.value)} placeholder="info@example.com" />
        </Field>
      </div>
    </div>
  );
}

function Step2({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionTitle>Brand & Concierge Voice</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Primary Language" required>
          <select style={fieldStyle} value={data.language} onChange={e => set("language", e.target.value)}>
            <option value="fr">French (Québec)</option>
            <option value="en">English</option>
            <option value="fr-en">Bilingual FR / EN</option>
            <option value="es">Spanish</option>
          </select>
        </Field>
        <Field label="Concierge Name" required hint="The AI's display name">
          <input style={fieldStyle} value={data.conciergeName} onChange={e => set("conciergeName", e.target.value)} placeholder="Sophie" />
        </Field>
      </div>

      <Field label="Concierge Tone" required hint="Shapes how the AI communicates with visitors">
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {TONES.map(t => (
            <label key={t.value} style={{
              display: "flex", alignItems: "flex-start", gap: 12,
              background: data.tone === t.value ? "rgba(201,168,76,0.08)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${data.tone === t.value ? "rgba(201,168,76,0.35)" : P.border}`,
              borderRadius: 10, padding: "12px 14px", cursor: "pointer", transition: "all 0.15s",
            }}>
              <input type="radio" name="tone" value={t.value} checked={data.tone === t.value}
                onChange={() => set("tone", t.value)}
                style={{ marginTop: 2, accentColor: P.gold }} />
              <div>
                <div style={{ color: data.tone === t.value ? P.gold : P.white, fontWeight: 700, fontSize: 14 }}>{t.label}</div>
                <div style={{ color: P.muted, fontSize: 12, marginTop: 2 }}>{t.desc}</div>
              </div>
            </label>
          ))}
        </div>
      </Field>

      <Field label="Company Description" hint="Brief pitch the AI uses to describe the business (2-3 sentences max)">
        <textarea style={{ ...fieldStyle, minHeight: 90, resize: "vertical" }}
          value={data.description} onChange={e => set("description", e.target.value)}
          placeholder="Club Sportif MAA est un centre de conditionnement physique premium situé au cœur de Montréal…" />
      </Field>
    </div>
  );
}

function Step3({ data, set, fileRef, onFiles }: {
  data: OnboardingData;
  set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
  fileRef: React.RefObject<HTMLInputElement | null>;
  onFiles: (f: FileList | null) => void;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionTitle>Knowledge Sources</SectionTitle>

      {/* Crawler toggle */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${P.border}`, borderRadius: 12, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Website Crawler</div>
            <div style={{ color: P.muted, fontSize: 12 }}>Automatically extracts services, pricing, hours, and FAQs from the website</div>
          </div>
          <Toggle on={data.crawlerEnabled} onToggle={() => set("crawlerEnabled", !data.crawlerEnabled)} />
        </div>
        {data.crawlerEnabled && (
          <div style={{ marginTop: 14 }}>
            <Field label="Crawl URL" hint="Leave blank to use the company website entered in Step 1">
              <input style={fieldStyle} value={data.crawlerUrl} onChange={e => set("crawlerUrl", e.target.value)}
                placeholder="https://www.example.com/about" />
            </Field>
          </div>
        )}
      </div>

      {/* PDF upload */}
      <div>
        <label style={labelStyle}>PDF Documents <span style={{ color: P.muted, textTransform: "none", fontWeight: 400 }}>— optional</span></label>
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
          onClick={() => fileRef.current?.click()}
          style={{
            border: `2px dashed ${dragging ? P.gold : P.border}`,
            borderRadius: 12, padding: "32px 24px", textAlign: "center", cursor: "pointer",
            background: dragging ? "rgba(201,168,76,0.05)" : "rgba(255,255,255,0.02)",
            transition: "all 0.2s",
          }}
        >
          <div style={{ fontSize: 28, marginBottom: 10 }}>📄</div>
          <div style={{ color: P.dim, fontSize: 14 }}>Drop PDF files here, or <span style={{ color: P.gold }}>browse</span></div>
          <div style={{ color: P.muted, fontSize: 12, marginTop: 6 }}>Pricing sheets, member handbooks, FAQs, policies — any PDF the AI should know</div>
          <input ref={fileRef} type="file" accept=".pdf" multiple style={{ display: "none" }}
            onChange={e => onFiles(e.target.files)} />
        </div>
        {data.pdfs.length > 0 && (
          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
            {data.pdfs.map((f, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "8px 12px" }}>
                <span style={{ fontSize: 13, color: P.dim }}>📄 {f.name} <span style={{ color: P.muted, fontSize: 11 }}>({(f.size / 1024).toFixed(0)} KB)</span></span>
                <button onClick={() => set("pdfs", data.pdfs.filter((_, j) => j !== i))}
                  style={{ background: "none", border: "none", color: P.muted, cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 4px" }}>×</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Step4({ data, set }: { data: OnboardingData; set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionTitle>AI Voice & Phone (VAPI)</SectionTitle>

      <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${P.border}`, borderRadius: 12, padding: "18px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Enable AI Voice Calls</div>
            <div style={{ color: P.muted, fontSize: 12 }}>Allows the concierge to call visitors back via VAPI</div>
          </div>
          <Toggle on={data.vapiEnabled} onToggle={() => set("vapiEnabled", !data.vapiEnabled)} />
        </div>
      </div>

      {data.vapiEnabled && (
        <>
          <Field label="VAPI Assistant ID" required hint="Found in your VAPI dashboard under Assistants">
            <input style={fieldStyle} value={data.vapiAssistantId} onChange={e => set("vapiAssistantId", e.target.value)}
              placeholder="ec272999-2782-4e57-9068-55a3bacd4915" />
          </Field>
          <Field label="VAPI Phone Number ID" hint="The outbound phone number ID from VAPI">
            <input style={fieldStyle} value={data.vapiPhoneNumberId} onChange={e => set("vapiPhoneNumberId", e.target.value)}
              placeholder="ce90916e-0c0f-432d-9889-fd2dd204c77b" />
          </Field>
          <Field label="OpenAI Model" hint="Model used for VAPI LLM proxy">
            <select style={fieldStyle} value={data.openAiModel} onChange={e => set("openAiModel", e.target.value)}>
              <option value="gpt-4o">GPT-4o (recommended)</option>
              <option value="gpt-4o-mini">GPT-4o mini (cost-optimized)</option>
              <option value="gpt-4-turbo">GPT-4 Turbo</option>
            </select>
          </Field>
        </>
      )}

      {!data.vapiEnabled && (
        <div style={{ color: P.muted, fontSize: 13, padding: "16px 0", textAlign: "center" }}>
          Voice calls disabled — the concierge will be chat-only.
        </div>
      )}
    </div>
  );
}

function Step5({ data, set }: {
  data: OnboardingData;
  set: <K extends keyof OnboardingData>(k: K, v: OnboardingData[K]) => void;
}) {
  const selectedPlan = PLANS.find(p => p.value === data.plan) ?? PLANS[0];
  const monthly = parseFloat(data.monthlyPriceCad) || 0;
  const implFee = data.implFeeWaived ? 0 : parseFloat(data.implementationFee) || 0;
  const subtotal = implFee + (data.billingTerm === "annual" ? monthly * 12 : monthly);
  const gst = Math.round(subtotal * 0.05 * 100) / 100;
  const qst = Math.round(subtotal * 0.09975 * 100) / 100;
  const total = Math.round((subtotal + gst + qst) * 100) / 100;
  const fmt = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

  function selectPlan(pl: PlanDef) {
    set("plan", pl.value);
    if (!pl.custom) {
      set("monthlyPriceCad", String(pl.monthly));
      set("implementationFee", String(pl.implFee));
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <SectionTitle>Plan & Facturation</SectionTitle>

      {/* Plan selector */}
      <Field label="Plan" required>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 4 }}>
          {PLANS.map(pl => {
            const active = data.plan === pl.value;
            return (
              <label key={pl.value} style={{
                display: "flex", alignItems: "flex-start", gap: 14, cursor: "pointer",
                background: active ? "rgba(201,168,76,0.08)" : "rgba(255,255,255,0.03)",
                border: `1px solid ${active ? "rgba(201,168,76,0.35)" : P.border}`,
                borderRadius: 12, padding: "14px 16px", transition: "all 0.15s",
              }}>
                <input type="radio" name="plan" value={pl.value} checked={active}
                  onChange={() => selectPlan(pl)} style={{ marginTop: 3, accentColor: P.gold, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: active ? P.gold : P.white, fontWeight: 700, fontSize: 15 }}>{pl.label}</span>
                    {!pl.custom && (
                      <span style={{ color: active ? P.gold : P.dim, fontWeight: 700, fontSize: 14 }}>
                        {fmt(pl.monthly)}<span style={{ color: P.muted, fontWeight: 400, fontSize: 12 }}>/mois</span>
                      </span>
                    )}
                  </div>
                  <div style={{ color: P.muted, fontSize: 12, marginTop: 4 }}>{pl.desc}</div>
                  {!pl.custom && (
                    <div style={{ color: P.muted, fontSize: 11, marginTop: 5 }}>
                      Frais d'implantation : <strong style={{ color: P.dim }}>{fmt(pl.implFee)}</strong>
                      <span style={{ color: P.green, marginLeft: 8 }}>ou gratuit · engagement 12 mois</span>
                    </div>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </Field>

      {/* Term */}
      <Field label="Durée d'engagement" required>
        <div style={{ display: "flex", gap: 10 }}>
          {[
            { v: "monthly" as const, label: "Mensuel" },
            { v: "annual" as const, label: "12 mois (frais d'implantation offerts)" },
          ].map(t => (
            <label key={t.v} style={{
              flex: 1, display: "flex", alignItems: "center", gap: 10, cursor: "pointer",
              background: data.billingTerm === t.v ? "rgba(201,168,76,0.08)" : "rgba(255,255,255,0.03)",
              border: `1px solid ${data.billingTerm === t.v ? "rgba(201,168,76,0.35)" : P.border}`,
              borderRadius: 10, padding: "12px 14px",
            }}>
              <input type="radio" name="term" value={t.v} checked={data.billingTerm === t.v}
                onChange={() => {
                  set("billingTerm", t.v);
                  if (t.v === "annual") set("implFeeWaived", true);
                }}
                style={{ accentColor: P.gold }} />
              <span style={{ color: data.billingTerm === t.v ? P.gold : P.dim, fontSize: 13, fontWeight: data.billingTerm === t.v ? 700 : 500 }}>{t.label}</span>
            </label>
          ))}
        </div>
      </Field>

      {/* Price override */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Mensualité (CAD)" required>
          <input style={fieldStyle} value={data.monthlyPriceCad}
            onChange={e => set("monthlyPriceCad", e.target.value)} placeholder="599" />
        </Field>
        <div>
          <label style={{ ...labelStyle }}>
            Frais d'implantation (CAD)
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 10, cursor: "pointer" }}>
              <input type="checkbox" checked={data.implFeeWaived}
                onChange={() => set("implFeeWaived", !data.implFeeWaived)}
                style={{ accentColor: P.gold }} />
              <span style={{ color: P.green, fontSize: 11, textTransform: "none", letterSpacing: 0 }}>offerts</span>
            </label>
          </label>
          <input style={{ ...fieldStyle, opacity: data.implFeeWaived ? 0.35 : 1 }}
            value={data.implFeeWaived ? "0" : data.implementationFee}
            disabled={data.implFeeWaived}
            onChange={e => set("implementationFee", e.target.value)} placeholder="1950" />
        </div>
      </div>

      {/* Add-ons (coming soon) */}
      <div style={{ background: "rgba(255,255,255,0.02)", border: `1px solid ${P.border}`, borderRadius: 12, padding: "16px 18px", opacity: 0.6 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Add-ons</div>
          <div style={{ background: "rgba(255,255,255,0.07)", borderRadius: 6, padding: "3px 10px", fontSize: 11, color: P.muted }}>Bientôt disponible</div>
        </div>
        <div style={{ color: P.muted, fontSize: 12, marginTop: 6 }}>Voix personnalisée, intégrations CRM, analytics avancés…</div>
      </div>

      {/* Invoice preview */}
      <div style={{ background: "rgba(201,168,76,0.05)", border: "1px solid rgba(201,168,76,0.2)", borderRadius: 12, padding: "18px 20px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 12 }}>Aperçu de facturation</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {implFee > 0 && <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}><span style={{ color: P.dim }}>Frais d'implantation</span><span style={{ color: P.white }}>{fmt(implFee)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
            <span style={{ color: P.dim }}>Abonnement {data.billingTerm === "annual" ? "× 12 mois" : "(1 mois)"}</span>
            <span style={{ color: P.white }}>{fmt(data.billingTerm === "annual" ? monthly * 12 : monthly)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: P.muted }}><span>TPS (5%)</span><span>{fmt(gst)}</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: P.muted }}><span>TVQ (9.975%)</span><span>{fmt(qst)}</span></div>
          <div style={{ height: 1, background: "rgba(201,168,76,0.2)", margin: "4px 0" }} />
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 800 }}><span style={{ color: P.gold }}>Total CAD</span><span style={{ color: P.gold }}>{fmt(total)}</span></div>
        </div>
      </div>

      <SectionTitle>Contact & Notification</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <Field label="Nom du contact">
          <input style={fieldStyle} value={data.contactName} onChange={e => set("contactName", e.target.value)} placeholder="Jean Tremblay" />
        </Field>
        <Field label="Courriel du contact" hint="Recevra la facture">
          <input style={fieldStyle} value={data.contactEmail} onChange={e => set("contactEmail", e.target.value)} placeholder="jean@example.com" />
        </Field>
        <Field label="Courriel de notification" hint="Alertes et rapports internes">
          <input style={fieldStyle} value={data.notifyEmail} onChange={e => set("notifyEmail", e.target.value)} placeholder="steve@dubub.com" />
        </Field>
      </div>

      {/* Invoice send toggle */}
      <div style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${P.border}`, borderRadius: 12, padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>Envoyer la facture par courriel</div>
            <div style={{ color: P.muted, fontSize: 12 }}>Inclut un lien de paiement Stripe si configuré</div>
          </div>
          <Toggle on={data.sendInvoice} onToggle={() => set("sendInvoice", !data.sendInvoice)} />
        </div>
      </div>

      <Field label="Notes internes">
        <textarea style={{ ...fieldStyle, minHeight: 70, resize: "vertical" }}
          value={data.notes} onChange={e => set("notes", e.target.value)}
          placeholder="Contacté via démo Mai 2026. Intéressé par Prestige après 6 mois…" />
      </Field>
    </div>
  );
}

function Step6({ data, uploadProgress }: { data: OnboardingData; uploadProgress: string[] }) {
  const tone = TONES.find(t => t.value === data.tone);
  const plan = PLANS.find(p => p.value === data.plan);
  const monthly = parseFloat(data.monthlyPriceCad) || 0;
  const implFee = data.implFeeWaived ? 0 : parseFloat(data.implementationFee) || 0;
  const subtotal = implFee + (data.billingTerm === "annual" ? monthly * 12 : monthly);
  const gst = Math.round(subtotal * 0.05 * 100) / 100;
  const qst = Math.round(subtotal * 0.09975 * 100) / 100;
  const total = Math.round((subtotal + gst + qst) * 100) / 100;
  const fmt = (n: number) => n.toLocaleString("fr-CA", { style: "currency", currency: "CAD" });

  const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "10px 0", borderBottom: `1px solid ${P.border}` }}>
      <span style={{ color: P.muted, fontSize: 13, minWidth: 160 }}>{label}</span>
      <span style={{ color: P.white, fontSize: 13, textAlign: "right", fontWeight: 500 }}>{value}</span>
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <SectionTitle>Review & Confirm</SectionTitle>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Company</div>
        <Row label="Name" value={data.companyName || "—"} />
        <Row label="Industry" value={data.industry || "—"} />
        <Row label="Website" value={data.website || "—"} />
        <Row label="Phone" value={data.phone || "—"} />
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Brand & Voice</div>
        <Row label="Language" value={{ fr: "French (QC)", en: "English", "fr-en": "Bilingual", es: "Spanish" }[data.language] ?? data.language} />
        <Row label="Concierge name" value={data.conciergeName || "—"} />
        <Row label="Tone" value={tone?.label ?? data.tone} />
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Knowledge</div>
        <Row label="Web crawler" value={data.crawlerEnabled ? "Enabled" : "Disabled"} />
        <Row label="PDF documents" value={data.pdfs.length > 0 ? data.pdfs.map(f => f.name).join(", ") : "None"} />
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Voice & Phone</div>
        <Row label="VAPI enabled" value={data.vapiEnabled ? "Yes" : "No"} />
        {data.vapiEnabled && <Row label="Assistant ID" value={<span style={{ fontFamily: "monospace", fontSize: 11 }}>{data.vapiAssistantId || "—"}</span>} />}
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, color: P.muted, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 8 }}>Plan & Facturation</div>
        <Row label="Plan" value={plan?.label ?? data.plan} />
        <Row label="Durée" value={data.billingTerm === "annual" ? "12 mois" : "Mensuel"} />
        <Row label="Mensualité" value={fmt(monthly)} />
        <Row label="Frais d'implantation" value={implFee > 0 ? fmt(implFee) : <span style={{ color: P.green }}>Offerts</span>} />
        <Row label="TPS (5%)" value={fmt(gst)} />
        <Row label="TVQ (9.975%)" value={fmt(qst)} />
        <Row label="Total CAD" value={<span style={{ color: P.gold, fontWeight: 800 }}>{fmt(total)}</span>} />
        <Row label="Facture par courriel" value={data.sendInvoice ? `Oui → ${data.contactEmail || "—"}` : "Non"} />
        <Row label="Notification" value={data.notifyEmail || "—"} />
      </div>

      {uploadProgress.length > 0 && (
        <div style={{ background: "rgba(255,255,255,0.03)", borderRadius: 10, padding: "14px 16px" }}>
          <div style={{ fontSize: 11, color: P.muted, marginBottom: 8 }}>Upload progress</div>
          {uploadProgress.map((msg, i) => <div key={i} style={{ fontSize: 13, color: P.dim }}>{msg}</div>)}
        </div>
      )}

      <div style={{ background: "rgba(201,168,76,0.06)", border: `1px solid rgba(201,168,76,0.2)`, borderRadius: 10, padding: "14px 16px", fontSize: 13, color: P.dim }}>
        Clicking <strong style={{ color: P.gold }}>Create tenant</strong> will add this configuration to the platform and trigger the first knowledge crawl.
      </div>
    </div>
  );
}

// ── UI Primitives ─────────────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} style={{
      width: 48, height: 26, borderRadius: 13, border: "none", cursor: "pointer", flexShrink: 0,
      background: on ? P.gold : "rgba(255,255,255,0.1)",
      position: "relative", transition: "background 0.2s",
    }}>
      <div style={{
        width: 20, height: 20, borderRadius: "50%", background: on ? "#111" : "rgba(255,255,255,0.4)",
        position: "absolute", top: 3, left: on ? 25 : 3, transition: "left 0.2s",
      }} />
    </button>
  );
}
