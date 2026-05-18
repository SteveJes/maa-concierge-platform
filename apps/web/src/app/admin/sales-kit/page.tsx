"use client";

/**
 * Sales Kit — Daphné + Steve's premium feature catalogue for sales calls.
 *
 * Every feature we ship lives here with a one-line "why a tenant pays for it"
 * pitch, the tier(s) it belongs to, and a deep link to the demo or doc.
 * Daphné uses this page during prospect calls; she should never have to
 * remember which feature is included in which tier.
 */
import { useEffect, useState } from "react";
import AdminShell, { P, API, Card, SectionTitle } from "../_components/AdminShell";
import { useRouter } from "next/navigation";

type Tier = "Essentiel" | "Croissance" | "Prestige";
type Status = "live" | "beta" | "roadmap";

interface Feature {
  emoji: string;
  title: string;
  pitch: string;        // 1-line sales-grade sentence
  hooks: string[];      // 2-4 selling bullets Daphné can riff on
  tiers: Tier[];        // which plans include it
  status: Status;
  link?: { label: string; href: string };
}

interface Pack {
  label: string;
  intro: string;
  features: Feature[];
}

const SALES_KIT: Pack[] = [
  {
    label: "Conversation Premium",
    intro:
      "Le cœur du produit : un concierge IA bilingue qui parle comme votre meilleure réceptionniste, jamais comme un chatbot. Ce que tout client peut tester en 30 secondes.",
    features: [
      {
        emoji: "💬",
        title: "Concierge IA web (Sophie / SophIA)",
        pitch:
          "Conversation premium 24/7 sur votre site — réponses calibrées sur vos sources réelles, ton soigné, jamais robotique.",
        hooks: [
          "Bilingue FR-QC + EN, suit la langue du visiteur sans le forcer",
          "Réponses ancrées sur votre base de connaissances structurée — zéro hallucination",
          "Architecture multi-tenant : chaque client a son propre concierge, son propre ton, ses propres règles",
        ],
        tiers: ["Essentiel", "Croissance", "Prestige"],
        status: "live",
        link: { label: "Voir la démo MAA", href: "/demo/club-sportif-maa" },
      },
      {
        emoji: "🎙️",
        title: "Concierge IA téléphonique (VAPI)",
        pitch:
          "Le concierge prend l'appel, prononce votre marque correctement, gère le rappel et passe à l'humain quand vous le voulez.",
        hooks: [
          "Mode entrant + sortant (appelle le visiteur après chat)",
          "Continuité parfaite : reprend là où le chat s'est arrêté",
          "Outil capture_lead + transfer_to_human appelables en cours d'appel",
        ],
        tiers: ["Croissance", "Prestige"],
        status: "live",
      },
      {
        emoji: "✨",
        title: "Nudges proactifs « Conseil Privilège »",
        pitch:
          "12 messages premium rotent aléatoirement pendant l'inactivité — un sentiment de service attentif, jamais de pression.",
        hooks: [
          "12 nudges/locale, mélange Fisher-Yates par session",
          "Style premium, ton concierge, jamais commercial",
        ],
        tiers: ["Essentiel", "Croissance", "Prestige"],
        status: "live",
      },
    ],
  },
  {
    label: "Connaissance & véracité",
    intro:
      "Là où les chatbots génériques inventent, nous citons. Daphné encode la marque, nos systèmes vérifient.",
    features: [
      {
        emoji: "📚",
        title: "Base de connaissances v2 (encodée à la main)",
        pitch:
          "Nous prenons votre PDF, votre site, vos courriels — et nous les transformons en JSON structuré que l'IA ne peut pas mal lire.",
        hooks: [
          "Modèle de confiance 4 niveaux (Confirmé / À valider / Daté / Contradictoire)",
          "11 sections opérationnelles : abonnement, restaurant, piscine, sports, cours, clinique, spa, identité, clubs affiliés",
          "Détection automatique des contradictions internes — le bot choisit la version la plus à jour, sans exposer la mécanique au visiteur",
        ],
        tiers: ["Croissance", "Prestige"],
        status: "live",
      },
      {
        emoji: "🔒",
        title: "Garde-fous & confidentialité de sources",
        pitch:
          "Le visiteur reçoit la réponse, jamais la mécanique. Aucune mention de « selon le PDF », « selon notre base », ni de contradictions internes.",
        hooks: [
          "Phrases interdites bloquées (politiques, prix, garanties)",
          "Aucune divulgation de noms de cadres ou de postes directs sensibles",
          "Architecture safety-first : 16 intents critiques détectés à chaque tour",
        ],
        tiers: ["Essentiel", "Croissance", "Prestige"],
        status: "live",
      },
    ],
  },
  {
    label: "Captation & routage des leads",
    intro:
      "Chaque conversation peut devenir un lead qualifié, livré au bon humain — sans formulaire intrusif.",
    features: [
      {
        emoji: "📨",
        title: "Capture de lead intelligente",
        pitch:
          "Le formulaire apparaît seulement quand le visiteur accepte — jamais en pop-up agressif. Tonalité premium, courriel HTML soigné.",
        hooks: [
          "Détection d'acceptation multi-langue (oui, svp, yes please…)",
          "Persistance NocoDB + notification Brevo",
          "Mode shadow : tous les leads passent par vous avant d'aller au client",
        ],
        tiers: ["Essentiel", "Croissance", "Prestige"],
        status: "live",
      },
      {
        emoji: "🎯",
        title: "Routage par département",
        pitch:
          "Une question pickleball arrive à Nathalie. Restaurant arrive au 1881. Massage arrive à la clinique. Tout en un clic.",
        hooks: [
          "Mapping intent → contact construit sur les sources réelles du client",
          "Chip « Transmis à [Nom] » visible dans le formulaire",
          "Email sujet + corps montrent le département destinataire",
        ],
        tiers: ["Croissance", "Prestige"],
        status: "live",
      },
      {
        emoji: "🪟",
        title: "Aperçu de page intégré",
        pitch:
          "Vous proposez un lien (menu, abonnement, FAQ) — il s'ouvre à GAUCHE du concierge, jamais dans un nouvel onglet. Le visiteur ne quitte jamais la conversation.",
        hooks: [
          "Bordure dorée premium, animation de glissement cinématique",
          "Fallback élégant si la page refuse l'iframe (MyWellness, FLiiP)",
        ],
        tiers: ["Croissance", "Prestige"],
        status: "live",
      },
    ],
  },
  {
    label: "Qualité & Sentinel",
    intro:
      "L'add-on inclus par défaut qui prouve que votre concierge est bon. Pas juste « ça marche » — « voici les chiffres ».",
    features: [
      {
        emoji: "🛡️",
        title: "Sentinel — banc de tests automatisé",
        pitch:
          "Une banque de scénarios évolue avec chaque interaction litigieuse. Un juge IA vérifie chaque réponse, un rapport Markdown sort à chaque run.",
        hooks: [
          "44+ scénarios MAA, multi-tours, taxonomie d'échec",
          "Juge LLM (modèle différent du chatbot, pour éviter l'auto-complaisance)",
          "Catégorisation : source_leak, premature_callback, hallucination, missing_knowledge, etc.",
        ],
        tiers: ["Essentiel", "Croissance", "Prestige"],
        status: "live",
        link: { label: "Lancer un run", href: "/admin/dashboard" },
      },
      {
        emoji: "🤖",
        title: "5 sous-agents spécialisés (Claude Code)",
        pitch:
          "Conçus pour aller plus vite : un agent qui écrit les tests, un autre qui édite la base, un autre qui révise le ton Québécois.",
        hooks: [
          "/eval-test-designer, /kb-editor, /rag-failure-analyst",
          "/fr-qc-reviewer, /playwright-qa-engineer",
          "Permet à Daphné de demander un changement et de voir le résultat en quelques minutes",
        ],
        tiers: ["Croissance", "Prestige"],
        status: "live",
      },
      {
        emoji: "📝",
        title: "Tests « golden » éditables par Daphné",
        pitch:
          "YAML lisible. Daphné peut copier un test, changer la question, sauvegarder — c'est testé automatiquement à chaque déploiement.",
        hooks: [
          "Couverture trilingue : FR-QC, EN-only, FR↔EN switch",
          "Format inspiré d'OpenAI Evals + de la rigueur de Daphné",
        ],
        tiers: ["Croissance", "Prestige"],
        status: "live",
      },
    ],
  },
  {
    label: "Observabilité & analytics",
    intro:
      "Voir ce qui se passe dans votre concierge en temps réel — chaque message, chaque appel, chaque lead.",
    features: [
      {
        emoji: "🔭",
        title: "Langfuse — traçabilité LLM",
        pitch:
          "Chaque appel à l'IA est tracé : prompt complet, sortie, latence, tokens, coût. Idéal pour debug et amélioration continue.",
        hooks: [
          "Cloud US, conservation 30 jours",
          "Traces par tenant, par locale, par conversation",
        ],
        tiers: ["Croissance", "Prestige"],
        status: "live",
      },
      {
        emoji: "📊",
        title: "PostHog — entonnoir produit",
        pitch:
          "Pageviews, ouvertures de chat, premier message, lead capturé — un entonnoir complet pour optimiser le taux de conversion.",
        hooks: [
          "Événements personnalisés par tenant",
          "Tableaux de bord PostHog clé en main",
        ],
        tiers: ["Croissance", "Prestige"],
        status: "live",
      },
      {
        emoji: "🩺",
        title: "Health-check tenant",
        pitch:
          "État de santé en un coup d'œil : OpenAI, NocoDB, VAPI, Brevo. Un voyant rouge → on agit avant que le client appelle.",
        hooks: ["Surveillance VAPI : latence audio + coût par jour"],
        tiers: ["Croissance", "Prestige"],
        status: "live",
      },
    ],
  },
  {
    label: "Plateforme & administration",
    intro:
      "Onboarder un nouveau client en 5 minutes. Modifier son ton sans toucher au code. Facturation prête.",
    features: [
      {
        emoji: "🏢",
        title: "Multi-tenant SaaS",
        pitch:
          "Une seule plateforme, plusieurs marques. MAA, DUBUB, et chaque nouveau client a son propre concierge, sa propre voix, ses propres règles.",
        hooks: ["Isolation structurelle, aucun mélange de données entre tenants"],
        tiers: ["Essentiel", "Croissance", "Prestige"],
        status: "live",
      },
      {
        emoji: "⚙️",
        title: "Panneau Réglages",
        pitch:
          "Daphné ajuste le ton, les liens du menu, les heures de transfert humain — sans déploiement.",
        hooks: [
          "Override par tenant pour ton, suggestions, CTA",
          "Liens restaurant éditables (menu, réservation, commande)",
          "Heures de bureau pour transfert VAPI",
        ],
        tiers: ["Croissance", "Prestige"],
        status: "live",
      },
      {
        emoji: "💳",
        title: "Onboarding + facturation",
        pitch:
          "Stripe Checkout + facture Brevo automatique. Un client signe, paye, et le concierge est en ligne 5 minutes plus tard.",
        hooks: ["Numéros de facture séquentiels", "Modèles d'invoice premium"],
        tiers: ["Essentiel", "Croissance", "Prestige"],
        status: "live",
      },
    ],
  },
  {
    label: "Sur la feuille de route",
    intro:
      "Ce qui s'en vient — Daphné peut le mentionner comme « inclus à venir » sans s'engager sur une date précise.",
    features: [
      {
        emoji: "📱",
        title: "Mode mobile pleine page",
        pitch:
          "Sur téléphone, le concierge prend toute la fenêtre — comme une vraie app native.",
        hooks: ["Adapté iOS + Android keyboard"],
        tiers: ["Essentiel", "Croissance", "Prestige"],
        status: "beta",
      },
      {
        emoji: "🧠",
        title: "Apprentissage continu depuis production",
        pitch:
          "Une conversation problématique en prod devient automatiquement un candidat de test que Daphné approuve ou rejette.",
        hooks: ["Pipeline de promotion d'incidents → scénarios YAML"],
        tiers: ["Prestige"],
        status: "roadmap",
      },
      {
        emoji: "🔁",
        title: "Synchronisation site → KB",
        pitch:
          "Quand le client change ses tarifs sur son site, le concierge le détecte et propose à Daphné de mettre à jour.",
        hooks: ["Diff hebdo des pages-clés", "Validation humaine avant publication"],
        tiers: ["Croissance", "Prestige"],
        status: "roadmap",
      },
    ],
  },
];

const STATUS_BADGE: Record<Status, { label: string; tone: string }> = {
  live: { label: "Live", tone: "#1f9c5a" },
  beta: { label: "Bêta", tone: "#c87a16" },
  roadmap: { label: "Feuille de route", tone: "#7a4ed1" },
};

const TIER_TONE: Record<Tier, string> = {
  Essentiel: "#1c6dbf",
  Croissance: "#c9a84c",
  Prestige: "#7a4ed1",
};

export default function SalesKitPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const t = typeof window !== "undefined" ? localStorage.getItem("dubub_admin_token") : null;
    if (!t) {
      router.replace("/admin/login");
      return;
    }
    setToken(t);
  }, [router]);

  if (!token) return null;

  return (
    <AdminShell
      title="Trousse de vente"
      subtitle="Tout ce que DUBUB offre, prêt à présenter — pour les appels prospects, les pitchs et les démos."
    >
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 24, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: P.gold, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 8 }}>
              Argumentaire premium
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: P.ink, marginBottom: 8, lineHeight: 1.3 }}>
              « Vous ne signez pas pour un chatbot. Vous signez pour un concierge IA premium, calibré sur votre marque, qui transmet les bons leads à la bonne personne. »
            </div>
            <div style={{ fontSize: 13, color: P.dim, lineHeight: 1.55 }}>
              Cette page liste chaque fonction du produit, regroupée pour faciliter le pitch. Cliquez sur un titre pour ouvrir la démo correspondante. Les badges « Live / Bêta / Feuille de route » et les paliers (Essentiel / Croissance / Prestige) sont prêts à être cités tels quels lors d'un appel.
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <a
              href="/demo/club-sportif-maa"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block", padding: "10px 16px", borderRadius: 10,
                background: "linear-gradient(135deg,#c9a84c,#8b6010)", color: "#1a1610",
                fontWeight: 700, fontSize: 13, textDecoration: "none", textAlign: "center",
                boxShadow: "0 4px 14px rgba(201,168,76,0.30)",
              }}
            >
              ▶ Ouvrir la démo MAA dans un onglet
            </a>
            <a
              href="https://dubub.ca"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block", padding: "10px 16px", borderRadius: 10,
                background: "#ffffff", border: `1px solid ${P.border}`, color: P.ink,
                fontWeight: 600, fontSize: 13, textDecoration: "none", textAlign: "center",
              }}
            >
              dubub.ca · site corporatif
            </a>
            <button
              onClick={() => router.push("/admin/dashboard")}
              style={{
                padding: "10px 16px", borderRadius: 10,
                background: "#ffffff", border: `1px solid ${P.border}`, color: P.ink,
                fontWeight: 600, fontSize: 13, cursor: "pointer",
              }}
            >
              ⓘ Voir l'état Sentinel (Qualité)
            </button>
          </div>
        </div>
      </Card>

      {SALES_KIT.map((pack) => (
        <section key={pack.label} style={{ marginBottom: 28 }}>
          <SectionTitle>{pack.label}</SectionTitle>
          <p style={{ marginTop: -6, marginBottom: 14, fontSize: 13, color: P.dim, lineHeight: 1.55, maxWidth: 720 }}>
            {pack.intro}
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 14 }}>
            {pack.features.map((f) => {
              const badge = STATUS_BADGE[f.status];
              return (
                <div
                  key={f.title}
                  style={{
                    background: "#ffffff",
                    border: `1px solid ${P.border}`,
                    borderRadius: 14,
                    padding: "18px 20px",
                    boxShadow: "0 2px 10px rgba(20,16,8,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden="true">{f.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 800, color: P.ink, lineHeight: 1.3 }}>{f.title}</div>
                    </div>
                    <span style={{
                      flexShrink: 0,
                      background: `${badge.tone}18`,
                      border: `1px solid ${badge.tone}44`,
                      color: badge.tone,
                      fontSize: 10, fontWeight: 800, letterSpacing: "0.06em",
                      padding: "3px 9px", borderRadius: 999, textTransform: "uppercase",
                    }}>{badge.label}</span>
                  </div>
                  <div style={{ fontSize: 13, color: P.dim, lineHeight: 1.5 }}>{f.pitch}</div>
                  <ul style={{ margin: 0, padding: "0 0 0 16px", fontSize: 12, color: P.dim, lineHeight: 1.55, display: "flex", flexDirection: "column", gap: 3 }}>
                    {f.hooks.map((h) => (
                      <li key={h}>{h}</li>
                    ))}
                  </ul>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: "auto", paddingTop: 6 }}>
                    {f.tiers.map((t) => (
                      <span key={t} style={{
                        fontSize: 9.5, fontWeight: 800, letterSpacing: "0.06em",
                        background: `${TIER_TONE[t]}14`, border: `1px solid ${TIER_TONE[t]}40`,
                        color: TIER_TONE[t], padding: "3px 8px", borderRadius: 999,
                        textTransform: "uppercase",
                      }}>{t}</span>
                    ))}
                    {f.link && (
                      <a
                        href={f.link.href}
                        target={f.link.href.startsWith("http") ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        style={{ marginLeft: "auto", fontSize: 11, color: P.gold, fontWeight: 700, textDecoration: "none" }}
                      >
                        {f.link.label} ↗
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      <Card style={{ marginTop: 8, background: "linear-gradient(135deg, #fbf8ef 0%, #ffffff 100%)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: P.gold, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 10 }}>
          Pour le pitch
        </div>
        <div style={{ fontSize: 13, color: P.ink, lineHeight: 1.6 }}>
          La vraie histoire : un commerce premium reçoit 50 questions répétitives par jour. Pricing, horaires, services. Chacune coûte 2-3 minutes à la réception. Notre concierge IA répond instantanément, en deux langues, sans hallucination — parce que nous encodons votre savoir-faire, nous le testons en continu, et nous transmettons les leads à la bonne personne. <strong>Vous ne signez pas un chatbot. Vous signez le visage IA de votre marque.</strong>
        </div>
      </Card>
    </AdminShell>
  );
}
