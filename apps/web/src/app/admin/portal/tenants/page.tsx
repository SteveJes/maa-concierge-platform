"use client";
import Link from "next/link";
import { Sidebar } from "../../../../components/ui/Sidebar";
import { TopBar } from "../../../../components/ui/TopBar";
import { Card, CardHeader } from "../../../../components/ui/Card";
import { Button } from "../../../../components/ui/Button";
import {
  LayoutDashboard, MessageSquare, Users, Sparkles, Settings as SettingsIcon,
  Globe, Plus, ArrowRight, ExternalLink, Activity, Volume2,
} from "lucide-react";

const NAV = [
  { label: "Overview",       href: "/admin/portal",            icon: <LayoutDashboard size={16} /> },
  { label: "Onboarding",     href: "/admin/portal/onboarding", icon: <Sparkles size={16} /> },
  { label: "Conversations",  href: "/admin/portal/conversations", icon: <MessageSquare size={16} /> },
  { label: "Leads",          href: "/admin/leads",             icon: <Users size={16} /> },
  { label: "Tenants",        href: "/admin/portal/tenants",    icon: <Globe size={16} /> },
  { label: "Settings",       href: "/admin/settings",          icon: <SettingsIcon size={16} /> },
];

const TENANTS = [
  {
    id: "maa", name: "Club Sportif MAA", slug: "maa", plan: "Prestige",
    since: "Mai 2026", monthly: 3900, status: "active",
    conversations7d: 248, leads7d: 46, qualityPct: 94, voiceEnabled: true,
    contact: "daphne@clubsportifmaa.com",
  },
  {
    id: "dubub", name: "DUBUB — SophIA", slug: "dubub", plan: "Croissance",
    since: "Avril 2026", monthly: 1790, status: "active",
    conversations7d: 89, leads7d: 12, qualityPct: 91, voiceEnabled: false,
    contact: "steve@dubub.com",
  },
];

export default function TenantsListPage() {
  return (
    <div className="light-portal flex min-h-screen">
      <Sidebar items={NAV} />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar
          title="Tenants"
          subtitle={`${TENANTS.length} tenants actifs`}
          right={
            <Link href="/admin/portal/onboarding">
              <Button size="sm" iconLeft={<Plus size={14} />}>Nouveau tenant</Button>
            </Link>
          }
        />
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {TENANTS.map((t) => (
            <Card key={t.id} pad="lg">
              <div className="flex items-start gap-5">
                <div className="shrink-0 w-12 h-12 rounded-[var(--radius-md)] bg-gradient-to-br from-[var(--brand-gold)] to-[var(--brand-gold-strong)] flex items-center justify-center text-[var(--brand-navy)] font-bold text-lg shadow-[var(--shadow-sm)]">
                  {t.name.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline justify-between gap-4 mb-1">
                    <div>
                      <h3 className="text-base font-semibold text-[var(--text)]">{t.name}</h3>
                      <div className="text-xs text-[var(--text-muted)] mt-0.5">
                        {t.plan} · depuis {t.since} · {t.monthly} $/mois · {t.contact}
                      </div>
                    </div>
                    <Link href={`/admin/portal/tenants/${t.id}`}>
                      <Button size="sm" variant="outline" iconLeft={<ArrowRight size={14} />}>Ouvrir</Button>
                    </Link>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t border-[var(--border)]">
                    <MiniStat label="Conversations 7j" value={t.conversations7d.toString()} icon={<MessageSquare size={14} />} />
                    <MiniStat label="Leads 7j" value={t.leads7d.toString()} icon={<Users size={14} />} />
                    <MiniStat label="Qualité Sentinel" value={`${t.qualityPct}%`} icon={<Activity size={14} />} />
                    <MiniStat label="Voix VAPI" value={t.voiceEnabled ? "Activée" : "Désactivée"} icon={<Volume2 size={14} />} />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[var(--text-subtle)] text-xs mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-base font-semibold text-[var(--text)] leading-none">{value}</div>
    </div>
  );
}
