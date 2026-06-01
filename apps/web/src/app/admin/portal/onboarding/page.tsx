"use client";
import { useState, useRef } from "react";
import { Sidebar } from "../../../../components/ui/Sidebar";
import { TopBar } from "../../../../components/ui/TopBar";
import { Card, CardHeader } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import { Steps } from "../../../../components/ui/Steps";
import { Field, Input, TextArea, Select, Toggle } from "../../../../components/ui/Field";
import {
  LayoutDashboard, MessageSquare, Users, Sparkles, Settings as SettingsIcon,
  Globe, Upload, CheckCircle2, ExternalLink, Building2, Sparkle, BookOpen, Phone, CreditCard, ClipboardCheck,
} from "lucide-react";

const NAV = [
  { label: "Overview",       href: "/admin/portal",            icon: <LayoutDashboard size={16} /> },
  { label: "Onboarding",     href: "/admin/portal/onboarding", icon: <Sparkles size={16} /> },
  { label: "Conversations",  href: "/admin/portal/conversations", icon: <MessageSquare size={16} /> },
  { label: "Leads",          href: "/admin/leads",             icon: <Users size={16} /> },
  { label: "Tenants",        href: "/admin/tenants",           icon: <Globe size={16} /> },
  { label: "Settings",       href: "/admin/settings",          icon: <SettingsIcon size={16} /> },
];

const STEPS = [
  { n: 1, label: "Identité",   icon: <Building2 size={18} /> },
  { n: 2, label: "Concierge",  icon: <Sparkle size={18} /> },
  { n: 3, label: "Connaissances", icon: <BookOpen size={18} /> },
  { n: 4, label: "Voix",       icon: <Phone size={18} /> },
  { n: 5, label: "Forfait",    icon: <CreditCard size={18} /> },
  { n: 6, label: "Revue",      icon: <ClipboardCheck size={18} /> },
];

const INDUSTRIES = ["Fitness & Wellness", "Clinique médicale", "Spa & Beauté", "Immobilier", "Hôtellerie", "Restaurant", "Détail", "Services professionnels", "Éducation", "Autre"];
const TONES = [
  { value: "premium-warm",   label: "Premium & chaleureux",  desc: "Poli, accueillant — fitness, wellness, hôtellerie" },
  { value: "professional",   label: "Professionnel & précis",  desc: "Formel, efficace — médical, juridique, finance" },
  { value: "friendly-casual",label: "Amical & décontracté",    desc: "Accessible, conversationnel — détail, restauration" },
  { value: "luxury",         label: "Luxe & exclusif",         desc: "Raffiné, discret — spa, immobilier haut de gamme" },
  { value: "energetic",      label: "Énergique & motivant",    desc: "Inspirant — gyms, coaching, sport" },
];

const PLANS = [
  { value: "essentiel",  label: "Essentiel",  monthly: 790,  desc: "Concierge web · Chat IA bilingue · Base de connaissances · Support standard" },
  { value: "croissance", label: "Croissance", monthly: 1790, desc: "Tout Essentiel + IA vocale · Rappel automatique · Analytics · Support prioritaire" },
  { value: "prestige",   label: "Prestige",   monthly: 3900, desc: "Tout Croissance + Voix personnalisée · Multi-site · Intégrations CRM · SLA garanti" },
];

interface Data {
  companyName: string; industry: string; website: string; address: string; phone: string; email: string;
  language: string; tone: string; conciergeName: string; description: string;
  tunnelCtaFr: string; tunnelCtaEn: string;
  crawlerEnabled: boolean; crawlerUrl: string;
  vapiEnabled: boolean; vapiAssistantId: string; vapiPhoneNumberId: string; openAiModel: string;
  bookingEnabled: boolean; calendlyUrl: string;
  plan: string; monthlyPriceCad: string;
  contactName: string; contactEmail: string; notifyEmail: string; notes: string;
}

const INITIAL: Data = {
  companyName: "", industry: "", website: "", address: "", phone: "", email: "",
  language: "fr", tone: "premium-warm", conciergeName: "Sophie", description: "",
  tunnelCtaFr: "Planifier une rencontre", tunnelCtaEn: "Schedule a meeting",
  crawlerEnabled: true, crawlerUrl: "",
  vapiEnabled: false, vapiAssistantId: "", vapiPhoneNumberId: "", openAiModel: "gpt-4o",
  bookingEnabled: false, calendlyUrl: "",
  plan: "essentiel", monthlyPriceCad: "790",
  contactName: "", contactEmail: "", notifyEmail: "", notes: "",
};

const API = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/, "");

export default function OnboardingPortal() {
  const [step, setStep] = useState(1);
  const [data, setData] = useState<Data>(INITIAL);
  const [pdfs, setPdfs] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ tenantSlug?: string; error?: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Data>(k: K, v: Data[K]) => setData((d) => ({ ...d, [k]: v }));

  async function submit() {
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch(`${API}/v1/admin/onboarding`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) {
        setResult({ error: json?.message ?? `HTTP ${res.status}` });
      } else {
        setResult({ tenantSlug: json?.tenantSlug ?? "new-tenant" });
      }
    } catch (e) {
      setResult({ error: e instanceof Error ? e.message : "Network error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="light-portal flex min-h-screen">
      <Sidebar items={NAV} />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar
          title="Nouveau tenant"
          subtitle="Création d'un nouveau concierge IA"
          right={<Button size="sm" variant="ghost">Annuler</Button>}
        />
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-6">
              <Steps steps={STEPS} current={step} onJump={(n) => setStep(n)} />
            </div>

            <Card>
              {step === 1 && <Step1 data={data} set={set} />}
              {step === 2 && <Step2 data={data} set={set} />}
              {step === 3 && <Step3 data={data} set={set} pdfs={pdfs} setPdfs={setPdfs} fileRef={fileRef} />}
              {step === 4 && <Step4 data={data} set={set} />}
              {step === 5 && <Step5 data={data} set={set} />}
              {step === 6 && <Step6 data={data} pdfs={pdfs} submitting={submitting} result={result} onSubmit={submit} />}

              {!result?.tenantSlug ? (
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--border)]">
                  <Button variant="ghost" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>← Retour</Button>
                  <div className="text-xs text-[var(--text-subtle)]">Étape {step} sur {STEPS.length}</div>
                  {step < 6 ? (
                    <Button onClick={() => setStep((s) => Math.min(6, s + 1))}>Continuer →</Button>
                  ) : (
                    <Button onClick={submit} disabled={submitting}>
                      {submitting ? "Création…" : "Créer le tenant"}
                    </Button>
                  )}
                </div>
              ) : null}
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function Step1({ data, set }: { data: Data; set: <K extends keyof Data>(k: K, v: Data[K]) => void }) {
  return (
    <>
      <CardHeader title="Identité du client" subtitle="Les informations de base de l'entreprise" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nom de l'entreprise" required>
          <Input value={data.companyName} onChange={(e) => set("companyName", e.target.value)} placeholder="Club Sportif MAA" />
        </Field>
        <Field label="Industrie" required>
          <Select value={data.industry} onChange={(e) => set("industry", e.target.value)}>
            <option value="">Sélectionner…</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </Select>
        </Field>
        <Field label="Site web" hint="Utilisé par le crawler de connaissances">
          <Input type="url" value={data.website} onChange={(e) => set("website", e.target.value)} placeholder="https://www.exemple.com" />
        </Field>
        <Field label="Adresse">
          <Input value={data.address} onChange={(e) => set("address", e.target.value)} placeholder="2070 rue Peel, Montréal" />
        </Field>
        <Field label="Téléphone principal">
          <Input value={data.phone} onChange={(e) => set("phone", e.target.value)} placeholder="514 845-2233" />
        </Field>
        <Field label="Courriel de contact">
          <Input type="email" value={data.email} onChange={(e) => set("email", e.target.value)} placeholder="info@exemple.com" />
        </Field>
      </div>
    </>
  );
}

function Step2({ data, set }: { data: Data; set: <K extends keyof Data>(k: K, v: Data[K]) => void }) {
  return (
    <>
      <CardHeader title="Personnalité du concierge" subtitle="Le ton et la voix de Sophie pour ce tenant" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Field label="Nom du concierge" required>
          <Input value={data.conciergeName} onChange={(e) => set("conciergeName", e.target.value)} placeholder="Sophie" />
        </Field>
        <Field label="Langue principale" required>
          <Select value={data.language} onChange={(e) => set("language", e.target.value)}>
            <option value="fr">Français (Québec)</option>
            <option value="en">English (Canada)</option>
            <option value="bilingual">Bilingue (FR + EN)</option>
          </Select>
        </Field>
      </div>
      <div className="mb-4">
        <span className="block text-sm font-medium text-[var(--text)] mb-2">Tonalité</span>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {TONES.map((t) => (
            <button key={t.value} type="button" onClick={() => set("tone", t.value)}
              className={`text-left p-4 rounded-[var(--radius-md)] border transition-colors ${
                data.tone === t.value
                  ? "border-[var(--brand-gold)] bg-[var(--brand-gold-soft)]"
                  : "border-[var(--border-strong)] hover:border-[var(--brand-gold)] bg-[var(--bg-elev)]"
              }`}>
              <div className="text-sm font-semibold text-[var(--text)]">{t.label}</div>
              <div className="text-xs text-[var(--text-muted)] mt-1">{t.desc}</div>
            </button>
          ))}
        </div>
      </div>
      <Field label="Description du client" hint="2-3 phrases — le concierge s'en sert pour son introduction et son contexte">
        <TextArea rows={4} value={data.description} onChange={(e) => set("description", e.target.value)}
          placeholder="Club Sportif MAA est un centre de conditionnement premium au cœur de Montréal, fondé en 1881…" />
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        <Field label="CTA principal (FR)" hint="Bouton de prise de contact">
          <Input value={data.tunnelCtaFr} onChange={(e) => set("tunnelCtaFr", e.target.value)} placeholder="Planifier une rencontre" />
        </Field>
        <Field label="CTA principal (EN)">
          <Input value={data.tunnelCtaEn} onChange={(e) => set("tunnelCtaEn", e.target.value)} placeholder="Schedule a meeting" />
        </Field>
      </div>
    </>
  );
}

function Step3({ data, set, pdfs, setPdfs, fileRef }: { data: Data; set: <K extends keyof Data>(k: K, v: Data[K]) => void; pdfs: File[]; setPdfs: (f: File[]) => void; fileRef: React.RefObject<HTMLInputElement | null> }) {
  return (
    <>
      <CardHeader title="Source de connaissances" subtitle="Le concierge apprend votre entreprise à partir du site et des PDFs" />
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-[var(--radius-md)] bg-[var(--bg-elev-2)]">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Crawler du site web</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">Aspirer les pages publiques du site pour bâtir la base initiale</div>
          </div>
          <Toggle checked={data.crawlerEnabled} onChange={(v) => set("crawlerEnabled", v)} />
        </div>
        {data.crawlerEnabled ? (
          <Field label="URL de base à explorer">
            <Input type="url" value={data.crawlerUrl || data.website} onChange={(e) => set("crawlerUrl", e.target.value)} placeholder="https://www.exemple.com" />
          </Field>
        ) : null}

        <div>
          <span className="block text-sm font-medium text-[var(--text)] mb-2">Documents PDF</span>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="w-full p-6 border-2 border-dashed border-[var(--border-strong)] rounded-[var(--radius-md)] text-center hover:border-[var(--brand-gold)] hover:bg-[var(--brand-gold-soft)] transition-colors">
            <Upload className="mx-auto mb-2 text-[var(--brand-gold)]" size={20} />
            <div className="text-sm text-[var(--text)] font-medium">Ajouter des PDFs</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">Horaires, tarifs, brochures, foires aux questions</div>
          </button>
          <input ref={fileRef} type="file" accept="application/pdf" multiple className="hidden"
            onChange={(e) => setPdfs([...pdfs, ...Array.from(e.target.files ?? [])])} />
          {pdfs.length > 0 ? (
            <ul className="mt-3 space-y-1.5">
              {pdfs.map((f, i) => (
                <li key={i} className="flex items-center justify-between text-sm bg-[var(--bg-elev-2)] px-3 py-2 rounded-[var(--radius-sm)]">
                  <span className="text-[var(--text)] truncate">{f.name}</span>
                  <button type="button" onClick={() => setPdfs(pdfs.filter((_, j) => j !== i))}
                    className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)]">Retirer</button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Step4({ data, set }: { data: Data; set: <K extends keyof Data>(k: K, v: Data[K]) => void }) {
  return (
    <>
      <CardHeader title="Voix & téléphone" subtitle="Configuration optionnelle pour l'IA vocale (VAPI)" />
      <div className="space-y-4">
        <div className="flex items-center justify-between p-4 rounded-[var(--radius-md)] bg-[var(--bg-elev-2)]">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Activer la voix IA (VAPI)</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">Permet au concierge de parler au téléphone</div>
          </div>
          <Toggle checked={data.vapiEnabled} onChange={(v) => set("vapiEnabled", v)} />
        </div>
        {data.vapiEnabled ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="VAPI Assistant ID">
              <Input value={data.vapiAssistantId} onChange={(e) => set("vapiAssistantId", e.target.value)} placeholder="asst-xxx" />
            </Field>
            <Field label="VAPI Phone Number ID">
              <Input value={data.vapiPhoneNumberId} onChange={(e) => set("vapiPhoneNumberId", e.target.value)} placeholder="phn-xxx" />
            </Field>
          </div>
        ) : null}
        <Field label="Modèle OpenAI">
          <Select value={data.openAiModel} onChange={(e) => set("openAiModel", e.target.value)}>
            <option value="gpt-4o">gpt-4o (recommandé)</option>
            <option value="gpt-4o-mini">gpt-4o-mini (économique)</option>
            <option value="gpt-4-turbo">gpt-4-turbo</option>
          </Select>
        </Field>
        <div className="flex items-center justify-between p-4 rounded-[var(--radius-md)] bg-[var(--bg-elev-2)]">
          <div>
            <div className="text-sm font-semibold text-[var(--text)]">Réservation Calendly</div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">CTA principal redirige vers un Calendly</div>
          </div>
          <Toggle checked={data.bookingEnabled} onChange={(v) => set("bookingEnabled", v)} />
        </div>
        {data.bookingEnabled ? (
          <Field label="URL Calendly">
            <Input type="url" value={data.calendlyUrl} onChange={(e) => set("calendlyUrl", e.target.value)} placeholder="https://calendly.com/exemple" />
          </Field>
        ) : null}
      </div>
    </>
  );
}

function Step5({ data, set }: { data: Data; set: <K extends keyof Data>(k: K, v: Data[K]) => void }) {
  return (
    <>
      <CardHeader title="Forfait & contact" subtitle="Le plan choisi définit les fonctionnalités activées" />
      <div className="space-y-3 mb-6">
        {PLANS.map((p) => (
          <button key={p.value} type="button" onClick={() => { set("plan", p.value); set("monthlyPriceCad", String(p.monthly)); }}
            className={`w-full text-left p-4 rounded-[var(--radius-md)] border transition-colors ${
              data.plan === p.value
                ? "border-[var(--brand-gold)] bg-[var(--brand-gold-soft)]"
                : "border-[var(--border-strong)] hover:border-[var(--brand-gold)] bg-[var(--bg-elev)]"
            }`}>
            <div className="flex items-baseline justify-between">
              <div className="text-base font-semibold text-[var(--text)]">{p.label}</div>
              <div className="text-base font-semibold text-[var(--brand-gold-strong)]">{p.monthly} $/mois</div>
            </div>
            <div className="text-xs text-[var(--text-muted)] mt-1">{p.desc}</div>
          </button>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="Nom du contact principal" required>
          <Input value={data.contactName} onChange={(e) => set("contactName", e.target.value)} placeholder="Daphné Poirier" />
        </Field>
        <Field label="Courriel du contact principal" required>
          <Input type="email" value={data.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} placeholder="daphne@exemple.com" />
        </Field>
        <Field label="Courriel notifications de leads" hint="Adresse qui reçoit chaque nouveau lead">
          <Input type="email" value={data.notifyEmail} onChange={(e) => set("notifyEmail", e.target.value)} placeholder="leads@exemple.com" />
        </Field>
        <Field label="Notes internes" hint="Pour Steve & Daphné uniquement">
          <TextArea rows={2} value={data.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>
      </div>
    </>
  );
}

function Step6({ data, pdfs, submitting, result, onSubmit }: { data: Data; pdfs: File[]; submitting: boolean; result: { tenantSlug?: string; error?: string } | null; onSubmit: () => void }) {
  if (result?.tenantSlug) {
    return (
      <div className="text-center py-12">
        <div className="inline-flex w-16 h-16 rounded-full bg-[rgba(20,160,117,0.15)] items-center justify-center mb-6">
          <CheckCircle2 size={32} className="text-[var(--success)]" />
        </div>
        <h3 className="text-2xl font-semibold text-[var(--text)] mb-2">{data.companyName} est prêt</h3>
        <p className="text-sm text-[var(--text-muted)] mb-8 max-w-md mx-auto">
          Le concierge a été créé. Vous pouvez maintenant lui parler ou continuer à configurer la base de connaissances.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Button iconLeft={<ExternalLink size={14} />} onClick={() => window.open(`/demo/${result.tenantSlug}`, "_blank")}>
            Parler à {data.conciergeName} maintenant
          </Button>
          <Button variant="outline">Voir le tenant dans le portail</Button>
        </div>
      </div>
    );
  }
  return (
    <>
      <CardHeader title="Revue avant création" subtitle="Vérifiez les informations puis créez le tenant" />
      {result?.error ? (
        <div className="mb-4 p-3 rounded-[var(--radius-md)] bg-[rgba(208,74,74,0.1)] border border-[rgba(208,74,74,0.3)] text-sm text-[var(--danger)]">
          Erreur : {result.error}
        </div>
      ) : null}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
        <ReviewRow label="Entreprise" value={data.companyName || "—"} />
        <ReviewRow label="Industrie" value={data.industry || "—"} />
        <ReviewRow label="Site web" value={data.website || "—"} />
        <ReviewRow label="Adresse" value={data.address || "—"} />
        <ReviewRow label="Concierge" value={`${data.conciergeName} · ${data.language.toUpperCase()}`} />
        <ReviewRow label="Tonalité" value={TONES.find((t) => t.value === data.tone)?.label ?? data.tone} />
        <ReviewRow label="PDF(s)" value={`${pdfs.length} document(s)`} />
        <ReviewRow label="Crawler" value={data.crawlerEnabled ? "Activé" : "Désactivé"} />
        <ReviewRow label="Voix VAPI" value={data.vapiEnabled ? "Activé" : "Désactivé"} />
        <ReviewRow label="Modèle" value={data.openAiModel} />
        <ReviewRow label="Forfait" value={`${PLANS.find((p) => p.value === data.plan)?.label} · ${data.monthlyPriceCad} $/mois`} />
        <ReviewRow label="Contact" value={data.contactEmail || "—"} />
      </div>
      <div className="mt-8 p-4 rounded-[var(--radius-md)] bg-[var(--bg-elev-2)] text-sm text-[var(--text-muted)]">
        <strong className="text-[var(--text)]">Après création :</strong> le concierge sera immédiatement testable. Vous pourrez ensuite raffiner la base de connaissances et activer/désactiver des fonctionnalités à tout moment.
      </div>
    </>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-[var(--border)]">
      <span className="text-[var(--text-muted)] shrink-0">{label}</span>
      <span className="text-[var(--text)] text-right font-medium">{value}</span>
    </div>
  );
}
