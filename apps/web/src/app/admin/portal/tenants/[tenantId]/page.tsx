"use client";
import { use, useState } from "react";
import Link from "next/link";
import { Sidebar } from "../../../../../components/ui/Sidebar";
import { TopBar } from "../../../../../components/ui/TopBar";
import { Card, CardHeader } from "../../../../../components/ui/Card";
import { Stat } from "../../../../../components/ui/Stat";
import { Button } from "../../../../../components/ui/Button";
import { Field, Input, TextArea, Toggle } from "../../../../../components/ui/Field";
import { LeadsAreaChart, IntentBarChart, LanguagePieChart } from "../../../../../components/ui/charts";
import {
  LayoutDashboard, MessageSquare, Users, Sparkles, Settings as SettingsIcon,
  Globe, Activity, TrendingUp, ExternalLink, Zap, Play, ChevronLeft, BookOpen, Brain, Phone,
} from "lucide-react";

const NAV = [
  { label: "Overview",       href: "/admin/portal",            icon: <LayoutDashboard size={16} /> },
  { label: "Onboarding",     href: "/admin/portal/onboarding", icon: <Sparkles size={16} /> },
  { label: "Conversations",  href: "/admin/conversations",     icon: <MessageSquare size={16} /> },
  { label: "Leads",          href: "/admin/leads",             icon: <Users size={16} /> },
  { label: "Tenants",        href: "/admin/portal/tenants",    icon: <Globe size={16} /> },
  { label: "Settings",       href: "/admin/settings",          icon: <SettingsIcon size={16} /> },
];

const TENANT_DETAIL: Record<string, {
  name: string; plan: string; monthly: number; contact: string;
  conversations7d: number; leads7d: number; qualityPct: number; avgResponseSec: number;
  conciergeName: string; description: string; language: string;
  leadsByDay: Array<{ day: string; leads: number }>;
  topIntents: Array<{ intent: string; count: number }>;
  languages: Array<{ name: string; value: number }>;
}> = {
  maa: {
    name: "Club Sportif MAA", plan: "Prestige", monthly: 3900, contact: "daphne@clubsportifmaa.com",
    conversations7d: 248, leads7d: 46, qualityPct: 94, avgResponseSec: 1.4,
    conciergeName: "Sophie", language: "FR (QC)",
    description: "Club Sportif MAA est un centre de conditionnement premium au cœur de Montréal, fondé en 1881.",
    leadsByDay: [
      { day: "Lun", leads: 4 }, { day: "Mar", leads: 7 }, { day: "Mer", leads: 5 },
      { day: "Jeu", leads: 9 }, { day: "Ven", leads: 12 }, { day: "Sam", leads: 6 },
      { day: "Dim", leads: 3 },
    ],
    topIntents: [
      { intent: "Tarifs", count: 28 }, { intent: "Horaires", count: 22 },
      { intent: "Clinique", count: 14 }, { intent: "Cours", count: 11 },
      { intent: "Restaurant", count: 7 },
    ],
    languages: [{ name: "Français", value: 71 }, { name: "English", value: 29 }],
  },
  dubub: {
    name: "DUBUB — SophIA", plan: "Croissance", monthly: 1790, contact: "steve@dubub.com",
    conversations7d: 89, leads7d: 12, qualityPct: 91, avgResponseSec: 1.7,
    conciergeName: "SophIA", language: "FR + EN",
    description: "DUBUB conçoit et opère des concierges IA premium pour entreprises de service.",
    leadsByDay: [
      { day: "Lun", leads: 2 }, { day: "Mar", leads: 3 }, { day: "Mer", leads: 1 },
      { day: "Jeu", leads: 2 }, { day: "Ven", leads: 3 }, { day: "Sam", leads: 1 },
      { day: "Dim", leads: 0 },
    ],
    topIntents: [
      { intent: "Tarifs", count: 18 }, { intent: "Démo", count: 12 },
      { intent: "Features", count: 9 }, { intent: "Contact", count: 5 },
    ],
    languages: [{ name: "Français", value: 62 }, { name: "English", value: 38 }],
  },
};

interface PageProps { params: Promise<{ tenantId: string }> }

export default function TenantDetailPage(props: PageProps) {
  const { tenantId } = use(props.params);
  const t = TENANT_DETAIL[tenantId];
  const [simState, setSimState] = useState<"idle" | "running" | "done">("idle");

  if (!t) {
    return (
      <div className="light-portal flex min-h-screen">
        <Sidebar items={NAV} />
        <main className="flex-1 flex items-center justify-center p-6 text-[var(--text-muted)]">
          Tenant <span className="font-mono mx-1">{tenantId}</span> introuvable.
        </main>
      </div>
    );
  }

  async function runSim() {
    setSimState("running");
    await new Promise((r) => setTimeout(r, 3500));
    setSimState("done");
    setTimeout(() => setSimState("idle"), 6000);
  }

  return (
    <div className="light-portal flex min-h-screen">
      <Sidebar items={NAV} />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar
          title={t.name}
          subtitle={`${t.plan} · ${t.monthly} $/mois · ${t.contact}`}
          right={
            <div className="flex items-center gap-2">
              <Link href="/admin/portal/tenants"><Button size="sm" variant="ghost" iconLeft={<ChevronLeft size={14} />}>Tenants</Button></Link>
              <a href={`/demo/${tenantId === "maa" ? "club-sportif-maa" : tenantId}`} target="_blank" rel="noreferrer">
                <Button size="sm" variant="outline" iconLeft={<ExternalLink size={14} />}>Parler à {t.conciergeName}</Button>
              </a>
              <Button size="sm" iconLeft={simState === "running" ? <Activity className="animate-pulse" size={14} /> : <Zap size={14} />} onClick={runSim} disabled={simState !== "idle"}>
                {simState === "running" ? "Simulation en cours…" : simState === "done" ? "Simulation : 24/24 ✓" : "Lancer la simulation"}
              </Button>
            </div>
          }
        />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Conversations 7j" value={t.conversations7d.toString()} delta={{ value: "+18 %", direction: "up" }} icon={<MessageSquare size={18} />} />
            <Stat label="Leads 7j" value={t.leads7d.toString()} delta={{ value: "+9 %", direction: "up" }} icon={<Users size={18} />} />
            <Stat label="Qualité Sentinel" value={`${t.qualityPct} %`} delta={{ value: "+2 pts", direction: "up" }} icon={<Activity size={18} />} />
            <Stat label="Réponse moyenne" value={`${t.avgResponseSec} s`} delta={{ value: "-0.3 s", direction: "up" }} icon={<TrendingUp size={18} />} />
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader title="Leads des 7 derniers jours" />
              <LeadsAreaChart data={t.leadsByDay} />
            </Card>
            <Card>
              <CardHeader title="Langues" />
              <LanguagePieChart data={t.languages} />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader title="Intentions populaires" subtitle="Sujets demandés cette semaine" />
              <IntentBarChart data={t.topIntents} />
            </Card>
            <Card>
              <CardHeader title="QA & Sentinel" subtitle="Système adversariel" />
              <ul className="space-y-2.5 text-sm">
                <KvLine label="Canary daphne-replay" value="45 / 45" tone="success" />
                <KvLine label="Batch-8 gate" value="11 / 11" tone="success" />
                <KvLine label="Review v2 (24 cats)" value="43 / 43" tone="success" />
                <KvLine label="Sim adversariale" value="23 / 24" tone="success" />
                <KvLine label="Schedule stress (48 probes)" value="—" tone="muted" />
              </ul>
              <Button size="sm" variant="outline" className="mt-4 w-full">Voir tous les rapports</Button>
            </Card>
          </div>

          {/* Configuration */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader title="Personnalité" />
              <div className="space-y-3 text-sm">
                <KvLine label="Concierge" value={t.conciergeName} />
                <KvLine label="Langue" value={t.language} />
                <KvLine label="Description" value={t.description} multi />
              </div>
            </Card>
            <Card>
              <CardHeader title="Base de connaissances" action={<Button size="sm" variant="ghost" iconLeft={<BookOpen size={14} />}>Éditer</Button>} />
              <div className="space-y-3 text-sm">
                <KvLine label="Documents PDF" value="7 fichiers" />
                <KvLine label="Pages crawlées" value="42 pages" />
                <KvLine label="Dernière maj" value="il y a 3 h" />
                <KvLine label="Override layer" value="actif" tone="success" />
              </div>
            </Card>
            <Card>
              <CardHeader title="Intelligence" action={<Button size="sm" variant="ghost" iconLeft={<Brain size={14} />}>Prompt</Button>} />
              <div className="space-y-3 text-sm">
                <KvLine label="Modèle" value="gpt-4o" />
                <KvLine label="Voix VAPI" value={tenantId === "maa" ? "Activée" : "Désactivée"} tone={tenantId === "maa" ? "success" : "muted"} />
                <KvLine label="Tonalité" value="Premium & chaleureux" />
                <KvLine label="Sécurité" value="rules v3" tone="success" />
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function KvLine({ label, value, tone, multi }: { label: string; value: string; tone?: "success" | "muted"; multi?: boolean }) {
  return (
    <div className={`flex ${multi ? "flex-col gap-1" : "items-center justify-between gap-3"}`}>
      <span className="text-[var(--text-muted)] text-xs uppercase tracking-wider">{label}</span>
      <span className={`${multi ? "text-[var(--text)]" : "text-right font-medium"} ${tone === "success" ? "text-[var(--success)]" : tone === "muted" ? "text-[var(--text-subtle)]" : "text-[var(--text)]"}`}>
        {value}
      </span>
    </div>
  );
}
