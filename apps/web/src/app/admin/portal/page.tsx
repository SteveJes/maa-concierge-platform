"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "../../../components/ui/Sidebar";
import { TopBar } from "../../../components/ui/TopBar";
import { Card, CardHeader, Pill } from "../../../components/ui/Card";
import { Stat } from "../../../components/ui/Stat";
import { Button } from "../../../components/ui/Button";
import { LeadsAreaChart, IntentBarChart, LanguagePieChart } from "../../../components/ui/charts";
import {
  LayoutDashboard, MessageSquare, Users, Sparkles, Settings as SettingsIcon,
  Phone, Mail, TrendingUp, Activity, Globe, Zap, ExternalLink, Share2, Download,
  DollarSign, Clock, Target, PhoneCall, ChevronDown, Calendar,
  Link as LinkIcon, Sparkle,
} from "lucide-react";

const NAV = [
  { label: "Overview",       href: "/admin/portal",            icon: <LayoutDashboard size={16} /> },
  { label: "Conversations",  href: "/admin/portal/conversations", icon: <MessageSquare size={16} /> },
  { label: "Sentinel",       href: "/admin/portal/sentinel",   icon: <Sparkles size={16} /> },
  { label: "Tenants",        href: "/admin/portal/tenants",    icon: <Globe size={16} /> },
  { label: "Onboarding",     href: "/admin/portal/onboarding", icon: <Users size={16} /> },
  { label: "Liens utiles",   href: "/admin/portal/links",      icon: <LinkIcon size={16} /> },
  { label: "Capacités",      href: "/admin/portal/features",   icon: <Sparkle size={16} /> },
  { label: "Réglages",       href: "/admin/settings",          icon: <SettingsIcon size={16} /> },
];

const TENANTS = [
  { id: "maa", label: "Club Sportif MAA" },
  { id: "dubub", label: "DUBUB — SophIA" },
];

const LEADS_BY_DAY = [
  { day: "Lun", leads: 4 }, { day: "Mar", leads: 7 }, { day: "Mer", leads: 5 },
  { day: "Jeu", leads: 9 }, { day: "Ven", leads: 12 }, { day: "Sam", leads: 6 },
  { day: "Dim", leads: 3 },
];
const INTENTS = [
  { intent: "Tarifs",       count: 28 },
  { intent: "Horaires",     count: 22 },
  { intent: "Visite",       count: 18 },
  { intent: "Clinique",     count: 14 },
  { intent: "Cours",        count: 11 },
  { intent: "Restaurant",   count: 7 },
];
const LANGUAGES = [
  { name: "Français", value: 71 },
  { name: "English",  value: 29 },
];
const LEAD_TYPE_BY_AMOUNT = [
  { name: "Visite club",     value: 18 },
  { name: "Membership",      value: 14 },
  { name: "Clinique / spa",  value: 8 },
  { name: "Restaurant",      value: 6 },
];

const TABS = ["Overview", "Conversations", "Leads", "Qualité"] as const;
type Tab = typeof TABS[number];

const RANGES = ["7 derniers jours", "30 derniers jours", "Ce mois", "Ce trimestre"] as const;

const TENANT_DEMO_URL: Record<string, string> = {
  maa: "https://clients.dubub.com/demo/maa",
  dubub: "https://clients.dubub.com/chat/dubub",
};

const LEADS_CSV_ROWS = [
  { name: "Sophie L.",   intent: "Visite club",        status: "Nouveau", when: "12 min" },
  { name: "Marc D.",     intent: "Cours en groupe",    status: "Traité",  when: "1 h" },
  { name: "Julie B.",    intent: "Massothérapie",      status: "Suivi",   when: "2 h" },
  { name: "Patrick G.",  intent: "Abonnement",         status: "Nouveau", when: "4 h" },
  { name: "Marie-J. R.", intent: "Restaurant Le 1881", status: "Traité",  when: "hier" },
];

function downloadLeadsCsv(tenantName: string): void {
  const header = "Visiteur,Intention,Statut,Quand";
  const lines = LEADS_CSV_ROWS.map((r) => `${r.name},${r.intent},${r.status},${r.when}`);
  const csv = "﻿" + [header, ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const ts = new Date().toISOString().slice(0, 10);
  a.download = `dubub-leads-${tenantName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function copyShareLink(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const url = window.location.href;
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
}

export default function PortalOverview() {
  const router = useRouter();
  // Tenant-scoped login? Per-tenant users (e.g. MAA) land here with a tenant
  // pinned in localStorage; we lock the active tenant + hide the switcher so
  // the demo feels owned by them. Super-admin sees the full dropdown.
  const scopedTenant = typeof window !== "undefined" ? window.localStorage.getItem("dubub_admin_tenant") : null;
  const [tenant, setTenant] = useState(scopedTenant ?? "maa");
  const [tab, setTab] = useState<Tab>("Overview");
  const [range, setRange] = useState<typeof RANGES[number]>("7 derniers jours");
  const [rangeOpen, setRangeOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const tenantName = TENANTS.find((t) => t.id === tenant)?.label ?? tenant;

  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function handleViewConcierge() {
    if (typeof window !== "undefined") window.open(TENANT_DEMO_URL[tenant] ?? TENANT_DEMO_URL.maa, "_blank", "noopener,noreferrer");
  }
  function handleRunSim() {
    router.push("/admin/portal/sentinel");
  }
  function handleShare() {
    void copyShareLink().then((ok) => flashToast(ok ? "Lien copié dans le presse-papiers" : "Copie impossible — copiez l'URL manuellement"));
  }
  function handleExport() {
    downloadLeadsCsv(tenantName);
    flashToast("Export CSV téléchargé");
  }
  function handleTabChange(t: Tab) {
    setTab(t);
    // 2026-06-01: tabs other than Overview are deferred surfaces; show a polite
    // toast instead of leaving the visitor on a stale screen.
    if (t !== "Overview") {
      flashToast(`${t} — disponible bientôt`);
    }
  }

  return (
    <div className="light-portal flex min-h-screen">
      <Sidebar
        items={NAV}
        footer={
          <div className="text-xs text-[var(--text-subtle)]">
            <div className="font-medium text-[var(--text-muted)]">DUBUB Concierge IA</div>
            <div className="mt-0.5">v0.2 · multi-tenant</div>
          </div>
        }
      />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar
          title="Vue d'ensemble"
          subtitle={tenantName}
          tenants={scopedTenant ? TENANTS.filter((t) => t.id === scopedTenant) : TENANTS}
          activeTenant={tenant}
          onTenantChange={setTenant}
          right={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" iconLeft={<ExternalLink size={14} />} onClick={handleViewConcierge}>
                Voir le concierge
              </Button>
              <Button size="sm" iconLeft={<Zap size={14} />} onClick={handleRunSim}>
                Lancer la simulation
              </Button>
            </div>
          }
        />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Tabs + action row */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-white/60 backdrop-blur border border-[var(--border)] rounded-full p-1">
              {TABS.map((t) => (
                <button
                  key={t}
                  onClick={() => handleTabChange(t)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                    tab === t
                      ? "bg-[var(--brand-gold-soft)] text-[var(--brand-gold-strong)]"
                      : "text-[var(--text-muted)] hover:text-[var(--text)]"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative">
                <button
                  onClick={() => setRangeOpen((v) => !v)}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg bg-white/70 backdrop-blur border border-[var(--border)] text-[var(--text)] hover:border-[var(--brand-gold)]/40 transition-colors"
                >
                  <Calendar size={14} className="text-[var(--brand-gold-strong)]" />
                  {range}
                  <ChevronDown size={14} className="text-[var(--text-subtle)]" />
                </button>
                {rangeOpen ? (
                  <div className="absolute right-0 mt-1 w-56 rounded-xl glass-card p-1 z-20">
                    {RANGES.map((r) => (
                      <button
                        key={r}
                        onClick={() => { setRange(r); setRangeOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                          r === range
                            ? "bg-[var(--brand-gold-soft)] text-[var(--brand-gold-strong)] font-medium"
                            : "text-[var(--text)] hover:bg-black/[0.03]"
                        }`}
                      >{r}</button>
                    ))}
                  </div>
                ) : null}
              </div>
              <Button size="sm" variant="ghost" iconLeft={<Share2 size={14} />} onClick={handleShare}>Partager</Button>
              <Button size="sm" variant="outline" iconLeft={<Download size={14} />} onClick={handleExport}>Exporter</Button>
            </div>
          </div>

          {/* HERO ROI banner — the money story, front and center for the demo */}
          <Card glass className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-gold-soft)] via-transparent to-transparent pointer-events-none" />
            <div className="relative grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--brand-gold-strong)] font-semibold mb-2">Valeur générée — 7 derniers jours</div>
                <div className="kpi-gold text-[44px] font-bold leading-none tracking-tight">11 040&nbsp;$</div>
                <div className="mt-2 text-sm text-[var(--text-muted)]">Pipeline de leads capturés par Sophie · <span className="font-medium text-[var(--success)]">+2 160 $ vs semaine précédente</span></div>
              </div>
              <div className="md:border-l md:border-r border-[var(--brand-gold)]/20 md:px-6 md:py-2">
                <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-subtle)] font-semibold mb-2">Valeur moyenne par lead</div>
                <div className="kpi-gold text-[36px] font-bold leading-none tracking-tight">240&nbsp;$</div>
                <div className="mt-2 text-sm text-[var(--text-muted)]">46 leads × 240 $ moy. <span className="font-medium text-[var(--success)]">+12 $ /lead</span></div>
              </div>
              <div>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--text-subtle)] font-semibold mb-2">Économies vs réception</div>
                <div className="kpi-gold text-[36px] font-bold leading-none tracking-tight">62&nbsp;h</div>
                <div className="mt-2 text-sm text-[var(--text-muted)]">Heures de réception remplacées par Sophie · <span className="font-medium text-[var(--success)]">≈ 1 860 $/mois</span></div>
              </div>
            </div>
          </Card>

          {/* Primary KPI row — operational metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat glass label="Conversations 7j" value="248" delta={{ value: "+18 %", direction: "up" }} icon={<MessageSquare size={16} />} />
            <Stat glass label="Nouveaux leads"   value="46"  delta={{ value: "+9 %",  direction: "up" }} icon={<Users size={16} />} />
            <Stat glass gold label="Valeur pipeline" value="11 040 $" delta={{ value: "+2 160 $", direction: "up" }} icon={<DollarSign size={16} />} />
            <Stat glass gold label="Valeur moy. par lead" value="240 $" delta={{ value: "+12 $", direction: "up" }} icon={<Target size={16} />} />
          </div>

          {/* Secondary KPI row */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat glass label="Qualité Sentinel" value="94 %" delta={{ value: "+2 pts", direction: "up" }} icon={<Activity size={16} />} />
            <Stat glass label="Réponse moyenne" value="1.4 s" delta={{ value: "-0.3 s", direction: "up" }} icon={<TrendingUp size={16} />} />
            <Stat glass label="Appels VAPI 7j"  value="38"   delta={{ value: "+6",     direction: "up" }} icon={<PhoneCall size={16} />} />
            <Stat glass label="Heures économisées" value="62 h" delta={{ value: "+9 h", direction: "up" }} icon={<Clock size={16} />} />
          </div>

          {/* Leads + language */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card glass className="lg:col-span-2">
              <CardHeader title="Leads des 7 derniers jours" subtitle="Demandes de rappel + courriel" />
              <LeadsAreaChart data={LEADS_BY_DAY} />
            </Card>
            <Card glass>
              <CardHeader title="Langues" subtitle="Conversations 7j" />
              <LanguagePieChart data={LANGUAGES} />
            </Card>
          </div>

          {/* Intents + activity */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card glass className="lg:col-span-2">
              <CardHeader title="Intentions les plus fréquentes" subtitle="Sujets demandés par les visiteurs" />
              <IntentBarChart data={INTENTS} />
            </Card>
            <Card glass>
              <CardHeader title="Activité récente" action={<Pill tone="gold">Live</Pill>} />
              <ul className="space-y-3 text-sm">
                <ActivityLine icon={<Mail size={14} />}        text="Nouveau lead — Sophie L."          time="il y a 12 min" pill={{ tone: "gold", label: "FR" }} />
                <ActivityLine icon={<Sparkles size={14} />}    text="Sentinel — 45/45 sur la canary"    time="il y a 1 h"    pill={{ tone: "success", label: "PASS" }} />
                <ActivityLine icon={<MessageSquare size={14} />}text="42 conversations aujourd'hui"      time="depuis 0 h" />
                <ActivityLine icon={<Phone size={14} />}       text="Appel VAPI — 2 min 14 s"           time="il y a 3 h"    pill={{ tone: "info", label: "VAPI" }} />
                <ActivityLine icon={<Sparkles size={14} />}    text="Sim adversariale — 23/24 personas" time="hier"          pill={{ tone: "success", label: "PASS" }} />
              </ul>
            </Card>
          </div>

          {/* Lead type by amount + recent leads */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card glass>
              <CardHeader title="Type de leads" subtitle="Distribution 7j" />
              <LanguagePieChart data={LEAD_TYPE_BY_AMOUNT} />
            </Card>
            <Card glass className="lg:col-span-2">
              <CardHeader title="Derniers leads" subtitle="Capturés via le concierge" action={
                <button className="text-sm text-[var(--brand-gold-strong)] hover:underline">Tout voir →</button>
              } />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[var(--text-subtle)]">
                      <th className="pb-3 font-medium">Visiteur</th>
                      <th className="pb-3 font-medium">Intention</th>
                      <th className="pb-3 font-medium">Statut</th>
                      <th className="pb-3 font-medium text-right">Quand</th>
                    </tr>
                  </thead>
                  <tbody>
                    <LeadRow name="Sophie L."   intent="Visite club"        status="Nouveau" tone="gold"    when="12 min" />
                    <LeadRow name="Marc D."     intent="Cours en groupe"    status="Traité"  tone="success" when="1 h"    />
                    <LeadRow name="Julie B."    intent="Massothérapie"      status="Suivi"   tone="info"    when="2 h"    />
                    <LeadRow name="Patrick G."  intent="Abonnement"         status="Nouveau" tone="gold"    when="4 h"    />
                    <LeadRow name="Marie-J. R." intent="Restaurant Le 1881" status="Traité"  tone="success" when="hier"   />
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      </main>
      {toast ? (
        <div className="fixed bottom-6 right-6 glass-card px-4 py-3 text-sm text-[var(--text)] z-50 animate-fade-in">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

function ActivityLine({
  icon, text, time, pill,
}: {
  icon: React.ReactNode;
  text: string;
  time: string;
  pill?: { tone: "success" | "warning" | "danger" | "info" | "gold" | "neutral"; label: string };
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-[var(--brand-gold-soft)] text-[var(--brand-gold-strong)]">
        {icon}
      </span>
      <div className="min-w-0 flex-1 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[var(--text)] leading-tight truncate">{text}</div>
          <div className="text-xs text-[var(--text-subtle)] mt-0.5">{time}</div>
        </div>
        {pill ? <Pill tone={pill.tone}>{pill.label}</Pill> : null}
      </div>
    </li>
  );
}

function LeadRow({
  name, intent, status, tone, when,
}: {
  name: string;
  intent: string;
  status: string;
  tone: "success" | "warning" | "danger" | "info" | "gold" | "neutral";
  when: string;
}) {
  return (
    <tr className="border-t border-[var(--border)] hover:bg-black/[0.02] transition-colors">
      <td className="py-3 font-medium text-[var(--text)]">{name}</td>
      <td className="py-3 text-[var(--text-muted)]">{intent}</td>
      <td className="py-3"><Pill tone={tone}>{status}</Pill></td>
      <td className="py-3 text-right text-[var(--text-subtle)]">{when}</td>
    </tr>
  );
}
