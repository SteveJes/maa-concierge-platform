"use client";
import { useState } from "react";
import { Sidebar } from "../../../components/ui/Sidebar";
import { TopBar } from "../../../components/ui/TopBar";
import { Card, CardHeader } from "../../../components/ui/Card";
import { Stat } from "../../../components/ui/Stat";
import { Button } from "../../../components/ui/Button";
import { LeadsAreaChart, IntentBarChart, LanguagePieChart } from "../../../components/ui/charts";
import {
  LayoutDashboard, MessageSquare, Users, Sparkles, Settings as SettingsIcon,
  Phone, Mail, TrendingUp, Activity, Globe, Zap, ExternalLink,
  DollarSign, Clock, Target, PhoneCall,
} from "lucide-react";

const NAV = [
  { label: "Overview",       href: "/admin/portal",         icon: <LayoutDashboard size={16} /> },
  { label: "Conversations",  href: "/admin/conversations",  icon: <MessageSquare size={16} /> },
  { label: "Leads",          href: "/admin/leads",          icon: <Users size={16} /> },
  { label: "Quality",        href: "/admin/quality",        icon: <Sparkles size={16} /> },
  { label: "Tenants",        href: "/admin/tenants",        icon: <Globe size={16} /> },
  { label: "Settings",       href: "/admin/settings",       icon: <SettingsIcon size={16} /> },
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

export default function PortalOverview() {
  const [tenant, setTenant] = useState("maa");
  const tenantName = TENANTS.find((t) => t.id === tenant)?.label ?? tenant;

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
          tenants={TENANTS}
          activeTenant={tenant}
          onTenantChange={setTenant}
          right={
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" iconLeft={<ExternalLink size={14} />}>
                Voir le concierge
              </Button>
              <Button size="sm" iconLeft={<Zap size={14} />}>
                Lancer la simulation
              </Button>
            </div>
          }
        />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* KPI row — primary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Conversations 7j" value="248" delta={{ value: "+18 %", direction: "up" }} icon={<MessageSquare size={18} />} />
            <Stat label="Nouveaux leads" value="46"  delta={{ value: "+9 %",  direction: "up" }} icon={<Users size={18} />} />
            <Stat label="Valeur pipeline" value="11 040 $" delta={{ value: "+2 160 $", direction: "up" }} icon={<DollarSign size={18} />} />
            <Stat label="Valeur moy. par lead" value="240 $" delta={{ value: "+12 $", direction: "up" }} icon={<Target size={18} />} />
          </div>

          {/* KPI row — secondary */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat label="Qualité Sentinel" value="94 %" delta={{ value: "+2 pts", direction: "up" }} icon={<Activity size={18} />} />
            <Stat label="Réponse moyenne" value="1.4 s" delta={{ value: "-0.3 s", direction: "up" }} icon={<TrendingUp size={18} />} />
            <Stat label="Appels VAPI 7j" value="38" delta={{ value: "+6", direction: "up" }} icon={<PhoneCall size={18} />} />
            <Stat label="Heures économisées" value="62 h" delta={{ value: "+9 h", direction: "up" }} icon={<Clock size={18} />} />
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader title="Leads des 7 derniers jours" subtitle="Demandes de rappel + courriel" />
              <LeadsAreaChart data={LEADS_BY_DAY} />
            </Card>
            <Card>
              <CardHeader title="Langues" subtitle="Conversations 7j" />
              <LanguagePieChart data={LANGUAGES} />
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card className="lg:col-span-2">
              <CardHeader title="Intentions les plus fréquentes" subtitle="Sujets demandés par les visiteurs" />
              <IntentBarChart data={INTENTS} />
            </Card>
            <Card>
              <CardHeader title="Activité récente" />
              <ul className="space-y-3 text-sm">
                <ActivityLine icon={<Mail size={14} />}        text="Nouveau lead — Sophie L. (FR)"        time="il y a 12 min" />
                <ActivityLine icon={<Sparkles size={14} />}    text="Sentinel : 45/45 sur la canary"      time="il y a 1 h"   tone="success" />
                <ActivityLine icon={<MessageSquare size={14} />}text="42 conversations aujourd'hui"        time="depuis 0 h"   />
                <ActivityLine icon={<Phone size={14} />}       text="Appel VAPI — 2 min 14 s"             time="il y a 3 h"   />
                <ActivityLine icon={<Sparkles size={14} />}    text="Sim adversariale : 23/24 personas"   time="hier"        tone="success" />
              </ul>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function ActivityLine({ icon, text, time, tone }: { icon: React.ReactNode; text: string; time: string; tone?: "success" }) {
  return (
    <li className="flex items-start gap-3">
      <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
        tone === "success"
          ? "bg-[rgba(20,160,117,0.12)] text-[var(--success)]"
          : "bg-[var(--brand-gold-soft)] text-[var(--brand-gold-strong)]"
      }`}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[var(--text)] leading-tight">{text}</div>
        <div className="text-xs text-[var(--text-subtle)] mt-0.5">{time}</div>
      </div>
    </li>
  );
}
