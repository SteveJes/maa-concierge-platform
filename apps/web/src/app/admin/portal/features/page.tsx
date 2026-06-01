"use client";

/**
 * Features showcase — the full marketing kit of every capability shipped in
 * the DUBUB concierge platform.
 */
import { Sidebar } from "../../../../components/ui/Sidebar";
import { TopBar } from "../../../../components/ui/TopBar";
import { Card, CardHeader, Pill } from "../../../../components/ui/Card";
import {
  LayoutDashboard, Users, Sparkles, Settings as SettingsIcon,
  Globe, Link as LinkIcon, Sparkle, Shield, Brain, BookOpen, PhoneCall,
  Eye, Layers, Award, Languages, Clock, Lock, MessageSquare,
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

interface Feature {
  name: string;
  description: string;
  badge?: { tone: "gold" | "info" | "success" | "danger" | "neutral"; label: string };
}

interface Section {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  features: Feature[];
}

const SECTIONS: Section[] = [
  {
    title: "Concierge IA — la voix de votre marque",
    subtitle: "Une vraie concierge premium, pas un chatbot",
    icon: <Brain size={18} />,
    features: [
      { name: "Ton concierge premium", description: "Chaleureux, poli, jamais robotique. Calibré sur la voix-tone du client. Vouvoiement québécois, ouvertures variées.", badge: { tone: "gold", label: "SIGNATURE" } },
      { name: "Bilingue FR/EN avec verrouillage", description: "Détecte la langue, reste constant. Verrouillage strict en EN : aucun mot français hors noms propres.", badge: { tone: "info", label: "MULTILINGUE" } },
      { name: "Conscience du temps réel", description: "Connaît l'heure et le jour à Montréal. Sait que le restaurant ferme à 16h le dimanche. Aucune affirmation hors plage horaire.", badge: { tone: "success", label: "NOUVEAU" } },
      { name: "Compréhension d'intention", description: "Comprend ce que le visiteur VEUT, pas juste les mots-clés. Pose UNE question de clarification quand c'est ambigu.", badge: { tone: "gold", label: "INTELLIGENCE" } },
      { name: "Mémoire conversationnelle", description: "Suit le sujet actif à travers les tours. 'Oui' après une question sur le triathlon exécute l'action triathlon.", badge: { tone: "info", label: "CONTEXTE" } },
      { name: "Réponses déterministes pour les faits critiques", description: "Tarifs massages, buanderie, pickleball, menus, FLiiP, MyWellness — réponses garanties exactes, jamais inventées.", badge: { tone: "success", label: "ZÉRO HALLUCINATION" } },
      { name: "Liens cliquables intelligents", description: "Tout URL livré est un bouton markdown. Auto-wrap des URLs nues (fliipapp, mywellness, clusterpos).", badge: { tone: "info", label: "UX" } },
      { name: "Refus honnête", description: "Quand l'info n'existe pas, le concierge le dit clairement et propose le bon contact, sans inventer.", badge: { tone: "gold", label: "INTÉGRITÉ" } },
    ],
  },
  {
    title: "Sentinel — l'œil qualité 24/7",
    subtitle: "Audit IA adversarial qui ne dort jamais",
    icon: <Sparkles size={18} />,
    features: [
      { name: "Banque de scénarios évolutive", description: "45+ scénarios canary + 48 probes de stress horaire + 24 personas adversariaux. Un nouveau bug = un nouveau scénario permanent.", badge: { tone: "gold", label: "RÉGRESSION ZÉRO" } },
      { name: "Juge IA GPT-4o calibré", description: "Note chaque réponse contre la ground truth + checklist tenant-spécifique. Règles ABSOLUES + exemples de calibration.", badge: { tone: "info", label: "JUGE" } },
      { name: "Détection multi-axe", description: "HALLUCINATION, CHECKLIST_MISS, MISROUTE, WALL_OF_TEXT, CONTEXT_BREAK — 5 types de violations distincts.", badge: { tone: "info", label: "TAXONOMIE" } },
      { name: "Canary post-deploy", description: "45 flows rejoués automatiquement après chaque déploiement en prod. Bloque la mise en ligne si la qualité baisse.", badge: { tone: "success", label: "CI/CD" } },
      { name: "Auto-générateur de scénarios", description: "OpenAI propose 8 nouveaux scénarios edge-case à valider — comble les angles morts en continu.", badge: { tone: "gold", label: "AUTOPILOT" } },
      { name: "Isolation par tenant", description: "Chaque tenant a sa banque de scénarios et son ground truth séparé. Aucune fuite multi-tenant.", badge: { tone: "info", label: "MULTI-TENANT" } },
      { name: "Historique persistant", description: "Chaque exécution sauvegardée sur disque + indexée. Tendance qualité visible dans le portail.", badge: { tone: "neutral", label: "TRACEABLE" } },
    ],
  },
  {
    title: "Garde-fous structurels",
    subtitle: "16 intentions critiques + post-process guards",
    icon: <Shield size={18} />,
    features: [
      { name: "16 intentions critiques détectées", description: "Annulation, garantie, vie privée, identité, urgence humaine, jours fériés, réalité présente — chacune sort du tunnel de vente.", badge: { tone: "danger", label: "STRUCTUREL" } },
      { name: "Anti-tunnel automatique", description: "Le CTA 'Planifier une visite' est INTERDIT pour annulation, plainte, paiement. Architectural, pas optionnel.", badge: { tone: "danger", label: "INVARIANT" } },
      { name: "Garde anti-emails inventés", description: "Détecte et supprime tout courriel non-allowlisté avant l'envoi.", badge: { tone: "danger", label: "SÉCURITÉ" } },
      { name: "Garde anti-grilles d'heures inventées", description: "Strip automatique des grilles 'lun-ven 9h-19h' pour services sans horaires publiés.", badge: { tone: "danger", label: "VÉRACITÉ" } },
      { name: "Garde tarifs massage canoniques", description: "Toute paire durée↔prix incorrecte est strippée et remplacée par la grille officielle.", badge: { tone: "danger", label: "EXACTITUDE" } },
      { name: "Garde longueur premium", description: "Mène avec la réponse, 2-3 points courts, jamais de mur de texte.", badge: { tone: "gold", label: "PREMIUM" } },
      { name: "Garde URL-wrap n'écrasant pas les emails", description: "Protection des courriels avant le wrap des URLs — aucune corruption de nlambert@clubsportifmaa.com.", badge: { tone: "danger", label: "ZÉRO CORRUPTION" } },
    ],
  },
  {
    title: "Base de connaissances tenant",
    subtitle: "Architecture modulaire pour onboarder un client en heures",
    icon: <BookOpen size={18} />,
    features: [
      { name: "Knowledge v2 — couche META", description: "JSON modulaire : index, intents, contacts, links, rules, voice-tone, staff. Chaque pièce remplaçable.", badge: { tone: "info", label: "ARCHITECTURE" } },
      { name: "Sources vivantes vs gelées", description: "Taxonomie : LIVE_DATED, STATIC_PUBLISHED, REALTIME_EXTERNAL, NO_SCHEDULE_PUBLISHED.", badge: { tone: "gold", label: "TAXONOMIE" } },
      { name: "Overrides ciblés", description: "Une page (PDF) = un override JSON. Les nouvelles règles s'ajoutent sans casser l'existant.", badge: { tone: "info", label: "MAINTENABLE" } },
      { name: "PDFs schedule en boutons", description: "10+ documents PDF livrés comme liens cliquables : piscine, cours, cirque, PowerWatts, pilates, triathlon, menus.", badge: { tone: "success", label: "LIVRABLE" } },
      { name: "Staff routing intelligent", description: "Chaque service route vers le bon humain : Francis (abonnements), Nathalie (sports), Elisabeth (pilates), Valérie (boutique).", badge: { tone: "info", label: "DÉPARTEMENTS" } },
      { name: "Contacts staff déterministes", description: "Demande de courriel/téléphone d'un employé → réponse exacte (extension, email) directement depuis contacts.json.", badge: { tone: "success", label: "NOUVEAU" } },
    ],
  },
  {
    title: "Voix — VAPI (téléphone IA)",
    subtitle: "Le chat et le téléphone parlent d'une seule voix",
    icon: <PhoneCall size={18} />,
    features: [
      { name: "Custom LLM endpoint", description: "/v1/vapi/llm route vers le même cerveau answerMaaChat — toute amélioration du chat profite à la voix.", badge: { tone: "gold", label: "UNIFIÉ" } },
      { name: "Multi-tenant sur un seul endpoint", description: "?tenantId=maa ou ?tenantId=dubub réveille le bon cerveau.", badge: { tone: "info", label: "PROPRE" } },
      { name: "Réveil chaud", description: "Émet un delta role-only immédiatement pour garder le canal VAPI ouvert pendant le round-trip 2-4s.", badge: { tone: "neutral", label: "UX" } },
      { name: "Normalisation phonétique", description: "'PECO ball' / 'pickoball' → pickleball. Tolérance aux erreurs STT.", badge: { tone: "info", label: "PHONÉTIQUE" } },
      { name: "Continuité chat → appel", description: "L'historique conversationnel est passé à VAPI, donc l'IA téléphonique sait ce que le visiteur a déjà demandé.", badge: { tone: "gold", label: "CONTINUITÉ" } },
      { name: "Fallback gracieux", description: "Si VAPI échoue, message clair vers la réception. Jamais de silence.", badge: { tone: "success", label: "RÉSILIENCE" } },
    ],
  },
  {
    title: "Observabilité",
    subtitle: "Voir, mesurer, améliorer",
    icon: <Eye size={18} />,
    features: [
      { name: "Langfuse — chaque appel tracé", description: "Input, output, tokens, latence, coût par appel OpenAI. Filtré par tenantCode + locale.", badge: { tone: "info", label: "LANGFUSE" } },
      { name: "PostHog — pageviews + entonnoir", description: "Tracking du parcours visiteur sur le widget de démo.", badge: { tone: "info", label: "POSTHOG" } },
      { name: "Coût OpenAI par tenant", description: "Cumul mensuel des tokens consommés par tenant pour facturation interne.", badge: { tone: "neutral", label: "FINANCE" } },
      { name: "CodeRabbit sur GitHub", description: "Review automatique de chaque PR. Trouve les bugs avant le merge.", badge: { tone: "info", label: "QUALITÉ" } },
      { name: "Health endpoint + PM2", description: "Monitoring uptime, restart automatique PM2 si crash.", badge: { tone: "success", label: "INFRA" } },
    ],
  },
  {
    title: "Plateforme",
    subtitle: "Multi-tenant SaaS prêt à scaler",
    icon: <Layers size={18} />,
    features: [
      { name: "Wizard d'onboarding 6 étapes", description: "Identité, concierge, connaissances, voix, forfait, revue. Onboarding en moins d'une heure.", badge: { tone: "gold", label: "SCALABLE" } },
      { name: "Plans verrouillés (790 / 1790 / 3900)", description: "Tarification SaaS DUBUB ferme. Aucune négociation, message cohérent.", badge: { tone: "info", label: "TARIFS" } },
      { name: "Identifiants par tenant", description: "Chaque client (ex. MAA) a son login dédié. Le portail se verrouille sur leur tenant.", badge: { tone: "danger", label: "ISOLATION" } },
      { name: "Capture de leads par département", description: "Chaque lead routé vers le bon humain. Email via Brevo en synchrone.", badge: { tone: "gold", label: "ROUTING" } },
      { name: "Dashboard premium gold-on-ivory", description: "8 KPIs, charts Recharts, glassmorphic cards, status pills.", badge: { tone: "gold", label: "PREMIUM UI" } },
      { name: "Export CSV des leads", description: "Téléchargement direct du registre des leads en un clic.", badge: { tone: "info", label: "EXPORT" } },
    ],
  },
];

export default function FeaturesShowcase() {
  return (
    <div className="light-portal flex min-h-screen">
      <Sidebar items={NAV} footer={<div className="text-xs text-[var(--text-subtle)]"><div className="font-medium text-[var(--text-muted)]">DUBUB Concierge IA</div><div className="mt-0.5">v0.2 · multi-tenant</div></div>} />
      <main className="flex-1 flex flex-col min-w-0">
        <TopBar title="Capacités de la plateforme" subtitle="Le kit complet de tout ce que DUBUB Concierge IA fait pour vous" right={<Pill tone="gold">Premium</Pill>} />
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <Card glass>
            <div className="flex flex-col md:flex-row gap-6 items-start">
              <div className="shrink-0 w-14 h-14 rounded-2xl bg-[var(--brand-gold-soft)] text-[var(--brand-gold-strong)] flex items-center justify-center">
                <Award size={26} />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl font-semibold text-[var(--text)] mb-2">Un concierge IA premium, sécurisé, multilingue — opéré 24/7</h2>
                <p className="text-sm text-[var(--text-muted)] leading-relaxed">DUBUB Concierge IA combine une voix de marque calibrée, un audit qualité IA continu (Sentinel), des garde-fous structurels, et une continuité chat + téléphone.</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <Pill tone="gold"><Languages size={11} /> Bilingue FR/EN</Pill>
                  <Pill tone="success"><Shield size={11} /> Garde-fous</Pill>
                  <Pill tone="info"><Clock size={11} /> Temps réel</Pill>
                  <Pill tone="info"><PhoneCall size={11} /> Web + voix</Pill>
                  <Pill tone="success"><Sparkles size={11} /> Sentinel 24/7</Pill>
                  <Pill tone="gold"><Lock size={11} /> Multi-tenant isolé</Pill>
                </div>
              </div>
            </div>
          </Card>

          {SECTIONS.map((section) => (
            <Card key={section.title} glass>
              <CardHeader title={section.title} subtitle={section.subtitle} action={<span className="inline-flex items-center justify-center w-9 h-9 rounded-full bg-[var(--brand-gold-soft)] text-[var(--brand-gold-strong)]">{section.icon}</span>} />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {section.features.map((f) => (
                  <div key={f.name} className="p-4 rounded-lg border border-[var(--border)] bg-white/40 hover:bg-white/70 transition-colors">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="font-medium text-[var(--text)] text-sm">{f.name}</div>
                      {f.badge ? <Pill tone={f.badge.tone}>{f.badge.label}</Pill> : null}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] leading-relaxed">{f.description}</p>
                  </div>
                ))}
              </div>
            </Card>
          ))}

          <Card glass>
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[var(--text)]">Prêt à équiper votre marque d'un concierge IA?</h3>
                <p className="text-sm text-[var(--text-muted)] mt-1">DUBUB onboard un nouveau client en moins d'une heure. Tous les plans incluent Sentinel.</p>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone="info">Standard — 790 $/mois</Pill>
                <Pill tone="gold">Premium — 1 790 $/mois</Pill>
                <Pill tone="success">Enterprise — 3 900 $/mois</Pill>
              </div>
            </div>
          </Card>
        </div>
      </main>
    </div>
  );
}
