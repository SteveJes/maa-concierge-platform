"use client";

/**
 * Links hub — one-stop reference for every URL, credential, and dashboard
 * Steve and Daphné need during demos, sales calls, and day-to-day ops.
 */
import { useState } from "react";
import { Sidebar } from "../../../../components/ui/Sidebar";
import { TopBar } from "../../../../components/ui/TopBar";
import { Card, CardHeader, Pill } from "../../../../components/ui/Card";
import {
  LayoutDashboard, Users, Sparkles, Settings as SettingsIcon,
  Globe, Link as LinkIcon, ExternalLink, Copy, Check, KeyRound, Sparkle,
  FileText, Database, Eye,
} from "lucide-react";

const NAV = [
  { label: "Overview",       href: "/admin/portal",          icon: <LayoutDashboard size={16} /> },
  { label: "Sentinel",       href: "/admin/portal/sentinel", icon: <Sparkles size={16} /> },
  { label: "Tenants",        href: "/admin/portal/tenants",  icon: <Globe size={16} /> },
  { label: "Onboarding",     href: "/admin/portal/onboarding", icon: <Users size={16} /> },
  { label: "Liens utiles",   href: "/admin/portal/links",    icon: <LinkIcon size={16} /> },
  { label: "Capacités",      href: "/admin/portal/features", icon: <Sparkle size={16} /> },
  { label: "Réglages",       href: "/admin/settings",        icon: <SettingsIcon size={16} /> },
];

interface LinkRow {
  label: string;
  url?: string;
  value?: string;
  description: string;
  badge?: { tone: "gold" | "info" | "success" | "neutral"; label: string };
  copyable?: boolean;
}

const CLIENT_DEMO_LINKS: LinkRow[] = [
  { label: "Concierge web — Club Sportif MAA", url: "https://clients.dubub.com/demo/maa", description: "Démo client live. C'est le lien à montrer à Daphné.", badge: { tone: "gold", label: "DÉMO MAA" } },
  { label: "Concierge web — DUBUB SophIA", url: "https://clients.dubub.com/chat/dubub", description: "Concierge IA du site DUBUB. Capture les leads, présente les plans (790 / 1790 / 3900 $).", badge: { tone: "info", label: "DUBUB SALES" } },
];

const PORTAL_LINKS: LinkRow[] = [
  { label: "Connexion", url: "https://clients.dubub.com/admin/login", description: "Page de connexion. Redirige automatiquement vers le portail." },
  { label: "Portail — Vue d'ensemble", url: "https://clients.dubub.com/admin/portal", description: "Tableau de bord premium avec KPIs, leads, intentions, Sentinel." },
  { label: "Sentinel — Audit qualité IA", url: "https://clients.dubub.com/admin/portal/sentinel", description: "Historique des audits, taux de réussite, échecs récents." },
  { label: "Liste des tenants", url: "https://clients.dubub.com/admin/portal/tenants", description: "Vue multi-tenant : MAA, DUBUB, futurs clients." },
  { label: "Wizard d'onboarding", url: "https://clients.dubub.com/admin/portal/onboarding", description: "6 étapes polies pour onboarder un nouveau tenant." },
];

const CREDENTIALS: LinkRow[] = [
  { label: "Super-admin DUBUB", value: "admin / dubub2025", description: "Accès complet — voit tous les tenants. Mot de passe rotable via env.", badge: { tone: "neutral", label: "INTERNE" }, copyable: true },
  { label: "MAA — Daphné", value: "maa / maa-concierge-2026", description: "Connexion verrouillée sur MAA. Aucun autre tenant visible.", badge: { tone: "gold", label: "CLIENT MAA" }, copyable: true },
];

const EXTERNAL_LINKS: LinkRow[] = [
  { label: "Langfuse (US Cloud)", url: "https://us.cloud.langfuse.com", description: "Trace de chaque appel OpenAI : input, output, tokens, coût, latence.", badge: { tone: "info", label: "OBSERVABILITÉ" } },
  { label: "PostHog", url: "https://app.posthog.com", description: "Pageviews + entonnoir de démo.", badge: { tone: "info", label: "ANALYTICS" } },
  { label: "CodeRabbit", url: "https://app.coderabbit.ai", description: "Review automatique des PRs GitHub.", badge: { tone: "info", label: "CODE REVIEW" } },
  { label: "Droplet DigitalOcean", value: "165.227.40.198", description: "Serveur de production. SSH : root@165.227.40.198.", badge: { tone: "neutral", label: "INFRA" }, copyable: true },
  { label: "VAPI Dashboard", url: "https://dashboard.vapi.ai", description: "Configuration de l'IA téléphonique. Custom LLM pointe vers /v1/vapi/llm?tenantId=maa.", badge: { tone: "info", label: "VOIX" } },
];

const KNOWLEDGE_LINKS: LinkRow[] = [
  { label: "Horaire piscine (PDF)", url: "https://www.clubsportifmaa.com/wp-content/uploads/2026/04/MAA_Piscine_Pool_Printemps2026_04-07-26.pdf", description: "Document daté printemps 2026." },
  { label: "Horaire cours en groupe (PDF)", url: "https://www.clubsportifmaa.com/wp-content/uploads/2026/05/MAA_CoursEnGroupe_HoraireClassifications_2070Peel_May05-26.pdf", description: "Grille des cours collectifs." },
  { label: "MyWellness — horaire temps réel", url: "https://widgets.mywellness.com/facility/ac1088953", description: "Source live pour cours en groupe." },
  { label: "Cirque aérien (PDF)", url: "https://www.clubsportifmaa.com/wp-content/uploads/2026/03/MAA_Aerial-Circus_Spring2026.pdf", description: "Horaire des cours de cirque aérien." },
  { label: "PowerWatts (PDF)", url: "https://www.clubsportifmaa.com/wp-content/uploads/2026/04/MAA_PowerWatts_Hiver-Spring2026.pdf", description: "Sessions spinning haute intensité." },
  { label: "Pilates Reformer (PDF)", url: "https://www.clubsportifmaa.com/wp-content/uploads/2026/04/MAA_Pilates_Reformer_Horaire-Schedule_May4-26.pdf", description: "Espace Pilates — Elisabeth Boutin." },
  { label: "Programme triathlon (PDF)", url: "https://www.clubsportifmaa.com/wp-content/uploads/2026/01/MAA_ClubTriathlon_Programme-Offres-FR_Jan26.pdf", description: "Sessions natation maîtres + offres triathlon." },
  { label: "Menu principal Le 1881 (PDF)", url: "https://www.clubsportifmaa.com/wp-content/uploads/2025/10/1881_Menu1_Fr_Oct2025.pdf", description: "Menu du restaurant du Club." },
  { label: "Menu déjeuner Le 1881 (PDF)", url: "https://www.clubsportifmaa.com/wp-content/uploads/2025/10/1881_Menu2_Fr_Oct2025.pdf", description: "Menu du midi." },
  { label: "Carte des vins (PDF)", url: "https://www.clubsportifmaa.com/wp-content/uploads/2023/09/1881_Menu_CarteDesVins.pdf", description: "Carte des vins Le 1881." },
  { label: "Commander en ligne", url: "https://clubsportifmaa.clusterpos.com/menu", description: "Take-out direct via ClusterPOS." },
  { label: "Réservation FLiiP", url: "https://clubsportifmaa.fliipapp.com", description: "Plateforme officielle du club." },
];

export default function LinksHub() {
  const [copied, setCopied] = useState<string | null>(null);

  function copyValue(text: string) {
    void navigator.clipboard.writeText(text);
    setCopied(text);
    setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="light-portal flex min-h-screen">
      <Sidebar items={NAV} footer={<div className="text-xs text-[var(--text-subtle)]"><div className="font-medium text-[var(--text-muted)]">DUBUB Concierge IA</div><div className="mt-0.5">v0.2 · multi-tenant</div></div>} />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar title="Liens utiles" subtitle="Toutes les ressources, identifiants et tableaux de bord en un seul endroit" />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <Section title="Démos client" subtitle="À montrer pendant les présentations" icon={<Eye size={16} />} rows={CLIENT_DEMO_LINKS} copied={copied} onCopy={copyValue} />
          <Section title="Portail et administration" subtitle="Tableaux de bord internes" icon={<LayoutDashboard size={16} />} rows={PORTAL_LINKS} copied={copied} onCopy={copyValue} />
          <Section title="Identifiants" subtitle="Super-admin et logins client" icon={<KeyRound size={16} />} rows={CREDENTIALS} copied={copied} onCopy={copyValue} />
          <Section title="Services externes" subtitle="Observabilité, analytics, infra" icon={<Database size={16} />} rows={EXTERNAL_LINKS} copied={copied} onCopy={copyValue} />
          <Section title="Documents du Club" subtitle="PDFs livrés par le concierge" icon={<FileText size={16} />} rows={KNOWLEDGE_LINKS} copied={copied} onCopy={copyValue} />
        </div>
      </main>
    </div>
  );
}

function Section({ title, subtitle, icon, rows, copied, onCopy }: { title: string; subtitle?: string; icon: React.ReactNode; rows: LinkRow[]; copied: string | null; onCopy: (v: string) => void; }) {
  return (
    <Card glass>
      <CardHeader title={title} subtitle={subtitle} action={<span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-[var(--brand-gold-soft)] text-[var(--brand-gold-strong)]">{icon}</span>} />
      <ul className="space-y-3">
        {rows.map((row, i) => {
          const target = row.url ?? row.value ?? "";
          const wasCopied = copied === target;
          return (
            <li key={i} className="flex items-start gap-3 p-3 -mx-3 rounded-lg hover:bg-black/[0.02] transition-colors">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-[var(--text)]">{row.label}</span>
                  {row.badge ? <Pill tone={row.badge.tone}>{row.badge.label}</Pill> : null}
                </div>
                {row.url ? (
                  <a href={row.url} target="_blank" rel="noopener noreferrer" className="text-xs text-[var(--brand-gold-strong)] hover:underline break-all inline-flex items-center gap-1 mt-1">
                    {row.url}<ExternalLink size={11} />
                  </a>
                ) : row.value ? (
                  <code className="text-xs font-mono text-[var(--text)] bg-black/[0.04] px-2 py-1 rounded inline-block mt-1">{row.value}</code>
                ) : null}
                <p className="text-xs text-[var(--text-muted)] mt-1.5">{row.description}</p>
              </div>
              {(row.copyable || row.value) && target ? (
                <button onClick={() => onCopy(target)} className="shrink-0 p-2 rounded-md text-[var(--text-subtle)] hover:text-[var(--brand-gold-strong)] hover:bg-[var(--brand-gold-soft)] transition-colors" title="Copier">
                  {wasCopied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
