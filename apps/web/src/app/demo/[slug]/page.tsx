"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { ChatShell } from "@platform/ui-chat";

interface DemoConfig {
  tenantId: string;
  name: string;
  websiteUrl: string | null;
  conciergeName: string;
  clientName: string;
  accentColor: string;
  accentGradient: string;
  accentRgb: string;
  accentTextColor?: string;
  darkMode?: boolean;
  bubbleGradient: string;
  bubbleGlow: string;
  logoUrl: string | null;
  nudgesFr: string[];
  nudgesEn: string[];
  nudgeLabelFr?: string;
  nudgeLabelEn?: string;
  nudgeSubLabelFr?: string;
  nudgeSubLabelEn?: string;
  suggestedQuestionsFr?: string[];
  suggestedQuestionsEn?: string[];
  tenantPhone?: string | null;
  pricingCtaFr?: string;
  pricingCtaEn?: string;
  pricingCtaMessageFr?: string;
  pricingCtaMessageEn?: string;
}

const MAA_NUDGES_FR = [
  "Saviez-vous que nos membres bénéficient d'un accès complet à la piscine, au spa et à plus de 50 cours de groupe par semaine ? Je peux vous aider à trouver la formule idéale.",
  "Le Club Sportif MAA est l'un des clubs les plus prestigieux de Montréal, fondé en 1881. Souhaitez-vous en savoir plus sur nos installations ou nos tarifs ?",
  "Notre piscine intérieure de 25 mètres, notre spa et nos courts de squash sont parmi les meilleures installations du centre-ville. Puis-je répondre à vos questions ?",
  "Vous pensez à l'abonnement ? Je peux vous donner un aperçu de nos formules et vous aider à choisir la meilleure option selon vos besoins.",
  "Besoin d'un coup de pouce ? Je suis disponible pour vous aider avec les tarifs, les horaires, les cours ou pour planifier une visite des installations.",
];
const MAA_NUDGES_EN = [
  "Did you know our members enjoy full access to the pool, spa, and over 50 group classes per week? I can help you find the perfect plan.",
  "Club Sportif MAA has been a Montreal landmark since 1881. Would you like to learn more about our facilities or membership options?",
  "Our 25m indoor pool, full spa, and squash courts are among the finest facilities in downtown Montreal. Can I answer any questions for you?",
  "Thinking about membership? I can walk you through our plans and help you find the best fit for your lifestyle.",
  "Need a hand? I'm here to help with pricing, hours, group classes, or to schedule a tour of the club.",
];

const DUBUB_NUDGES_FR = [
  "Vous cherchez à automatiser votre service client ? SophIA peut vous expliquer comment nos concierges IA transforment l'expérience client.",
  "Nos plans commencent à 790 $/mois — je peux vous guider vers la formule idéale pour votre entreprise.",
  "Vous souhaitez une démo live ? Je peux organiser ça avec l'équipe DUBUB dès maintenant.",
  "Saviez-vous que nos clients réduisent leur charge de front-desk de plus de 60 % ? Voyons ce que DUBUB peut faire pour vous.",
];
const DUBUB_NUDGES_EN = [
  "Looking to automate your customer service? SophIA can walk you through how our AI concierges transform the client experience.",
  "Our plans start at $790/month — I can help you find the right fit for your business.",
  "Want a live demo? I can arrange that with the DUBUB team right now.",
  "Did you know our clients reduce front-desk load by over 60%? Let's explore what DUBUB can do for you.",
];

const MAA_SUGGESTED_FR = [
  "Réserver un entraînement privé",
  "Horaire de pickleball",
  "Réserver une visite du club",
  "Comparer les abonnements",
  "Services du spa",
];
const MAA_SUGGESTED_EN = [
  "Book a private training session",
  "Pickleball schedule",
  "Book a club visit",
  "Compare memberships",
  "Spa services",
];
const DUBUB_SUGGESTED_FR = [
  "Quels sont vos plans et tarifs ?",
  "Comment fonctionne le concierge IA ?",
  "Pouvez-vous nous faire une démo ?",
  "Combien de temps pour l'intégration ?",
];
const DUBUB_SUGGESTED_EN = [
  "What are your plans and pricing?",
  "How does the AI concierge work?",
  "Can you do a live demo for us?",
  "How long does onboarding take?",
];

// Hardcoded known tenants — no API call needed for these
const KNOWN_CONFIGS: Record<string, DemoConfig> = {
  "maa": {
    tenantId: "maa", name: "Club Sportif MAA", websiteUrl: "https://www.clubsportifmaa.com/fr/",
    conciergeName: "Sophie", clientName: "Club Sportif MAA",
    accentColor: "#c9a84c", accentGradient: "linear-gradient(135deg, #c9a84c, #a07830)", accentRgb: "201,168,76",
    bubbleGradient: "linear-gradient(135deg, #c9a84c 0%, #8b6010 100%)", bubbleGlow: "rgba(201,168,76,0.55)",
    logoUrl: "https://www.clubsportifmaa.com/wp-content/uploads/2021/01/club-sportif-maa-logo.svg",
    nudgesFr: MAA_NUDGES_FR, nudgesEn: MAA_NUDGES_EN,
    suggestedQuestionsFr: MAA_SUGGESTED_FR, suggestedQuestionsEn: MAA_SUGGESTED_EN,
    nudgeLabelFr: "Conseil Privilège", nudgeLabelEn: "Member Insight",
    nudgeSubLabelFr: "Information du club", nudgeSubLabelEn: "Club information",
    pricingCtaFr: "→ Planifier une visite", pricingCtaEn: "→ Schedule a tour",
    pricingCtaMessageFr: "Je souhaite planifier une visite des installations.", pricingCtaMessageEn: "I'd like to schedule a tour of the facilities.",
    tenantPhone: null,
  },
  "club-sportif-maa": {
    tenantId: "maa", name: "Club Sportif MAA", websiteUrl: "https://www.clubsportifmaa.com/fr/",
    conciergeName: "Sophie", clientName: "Club Sportif MAA",
    accentColor: "#c9a84c", accentGradient: "linear-gradient(135deg, #c9a84c, #a07830)", accentRgb: "201,168,76",
    bubbleGradient: "linear-gradient(135deg, #c9a84c 0%, #8b6010 100%)", bubbleGlow: "rgba(201,168,76,0.55)",
    logoUrl: "https://www.clubsportifmaa.com/wp-content/uploads/2021/01/club-sportif-maa-logo.svg",
    nudgesFr: MAA_NUDGES_FR, nudgesEn: MAA_NUDGES_EN,
    suggestedQuestionsFr: MAA_SUGGESTED_FR, suggestedQuestionsEn: MAA_SUGGESTED_EN,
    nudgeLabelFr: "Conseil Privilège", nudgeLabelEn: "Member Insight",
    nudgeSubLabelFr: "Information du club", nudgeSubLabelEn: "Club information",
    pricingCtaFr: "→ Planifier une visite", pricingCtaEn: "→ Schedule a tour",
    pricingCtaMessageFr: "Je souhaite planifier une visite des installations.", pricingCtaMessageEn: "I'd like to schedule a tour of the facilities.",
    tenantPhone: null,
  },
  "dubub": {
    tenantId: "dubub", name: "DUBUB", websiteUrl: "https://dubub.ca/",
    conciergeName: "SophIA", clientName: "DUBUB",
    // Daphne's brand: bright lime on near-black — matches dubub.ca landing page exactly
    accentColor: "#b4ca90", accentGradient: "linear-gradient(135deg, #f0fde4, #b4ca90)", accentRgb: "180,202,144",
    accentTextColor: "#0d1208", darkMode: true,
    bubbleGradient: "linear-gradient(135deg, #f0fde4 0%, #b4ca90 100%)", bubbleGlow: "rgba(180,202,144,0.55)",
    logoUrl: null,
    nudgesFr: DUBUB_NUDGES_FR, nudgesEn: DUBUB_NUDGES_EN,
    suggestedQuestionsFr: DUBUB_SUGGESTED_FR, suggestedQuestionsEn: DUBUB_SUGGESTED_EN,
    nudgeLabelFr: "Conseil SophIA", nudgeLabelEn: "SophIA's Insight",
    nudgeSubLabelFr: "Plateforme DUBUB", nudgeSubLabelEn: "DUBUB Platform",
    pricingCtaFr: "→ Planifier une démo", pricingCtaEn: "→ Book a free demo",
    pricingCtaMessageFr: "Je souhaite planifier une démo de votre plateforme.", pricingCtaMessageEn: "I'd like to schedule a demo of your platform.",
    tenantPhone: "+14386075588",
  },
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "https://api.dubub.com";

export default function DemoSlugPage() {
  const params = useParams();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const [chatOpen, setChatOpen] = useState(false);
  const [labelDismissed, setLabelDismissed] = useState(false);
  const [config, setConfig] = useState<DemoConfig | null>(null);
  const [notFound, setNotFound] = useState(false);
  const vpHeightRef = useRef<number | null>(null);
  const [bubbleOffset, setBubbleOffset] = useState({ x: 0, y: 0 });

  // Android-only keyboard fix
  useEffect(() => {
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS) return;

    function update() {
      const h = window.visualViewport?.height ?? window.innerHeight;
      if (h !== vpHeightRef.current) {
        vpHeightRef.current = h;
        document.documentElement.style.setProperty("--vp-h", `${h}px`);
      }
    }
    update();
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Mouse-magnetic bubble — pulls bubble toward cursor when nearby
  useEffect(() => {
    if (chatOpen || typeof window === "undefined") return;
    const isMobile = window.innerWidth < 600;
    if (isMobile) return;

    function onMouseMove(e: MouseEvent) {
      const bx = window.innerWidth - 24 - 31;
      const by = window.innerHeight - 24 - 31;
      const dx = e.clientX - bx;
      const dy = e.clientY - by;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxDist = 220;
      if (dist < maxDist) {
        const pull = ((1 - dist / maxDist) ** 1.5) * 14;
        setBubbleOffset({ x: (dx / dist) * pull, y: (dy / dist) * pull });
      } else {
        setBubbleOffset({ x: 0, y: 0 });
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      setBubbleOffset({ x: 0, y: 0 });
    };
  }, [chatOpen]);

  useEffect(() => {
    if (KNOWN_CONFIGS[slug]) { setConfig(KNOWN_CONFIGS[slug]!); return; }
    const qp = new URLSearchParams(window.location.search);
    const siteName = qp.get("name");
    const siteUrl = qp.get("site");
    if (siteName) {
      setConfig({
        tenantId: slug, name: siteName, websiteUrl: siteUrl, conciergeName: "Sophie",
        clientName: siteName, accentColor: "#c9a84c", accentGradient: "linear-gradient(135deg, #c9a84c, #a07830)", accentRgb: "201,168,76",
        bubbleGradient: "linear-gradient(135deg, #c9a84c 0%, #8b6010 100%)", bubbleGlow: "rgba(201,168,76,0.55)",
        logoUrl: null, nudgesFr: MAA_NUDGES_FR, nudgesEn: MAA_NUDGES_EN,
      });
      return;
    }
    fetch(`${API}/v1/demo-config/${slug}`)
      .then((r) => { if (!r.ok) throw new Error("not_found"); return r.json() as Promise<{ tenantId: string; name: string; websiteUrl: string | null; conciergeName: string }>; })
      .then((d) => setConfig({
        ...d,
        clientName: d.name,
        accentColor: "#c9a84c", accentGradient: "linear-gradient(135deg, #c9a84c, #a07830)", accentRgb: "201,168,76",
        bubbleGradient: "linear-gradient(135deg, #c9a84c 0%, #8b6010 100%)", bubbleGlow: "rgba(201,168,76,0.55)",
        logoUrl: null, nudgesFr: MAA_NUDGES_FR, nudgesEn: MAA_NUDGES_EN,
      }))
      .catch(() => setNotFound(true));
  }, [slug]);

  if (notFound) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0d14", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "Inter, system-ui, sans-serif", color: "#fff" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Démo introuvable</h2>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 14 }}>Le slug « {slug} » ne correspond à aucun client configuré.</p>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div style={{ minHeight: "100vh", background: "#0d0d14", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ width: 40, height: 40, border: "3px solid rgba(201,168,76,0.3)", borderTopColor: "#c9a84c", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const glowColor = config.bubbleGlow;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body { overflow: hidden; overflow-x: hidden; height: 100%; max-width: 100%; }
        @keyframes bubblePulse {
          0%, 100% { box-shadow: 0 0 0 0 ${glowColor}, 0 8px 32px rgba(0,0,0,0.4); }
          55%       { box-shadow: 0 0 0 16px rgba(0,0,0,0), 0 8px 32px rgba(0,0,0,0.4); }
        }
        @keyframes ripple {
          0%   { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(2.4); opacity: 0; }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(24px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes floatBob {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-5px); }
        }
        .bubble-label {
          position: relative;
          background: #fff;
          color: #1a1a1a;
          font-size: 13.5px;
          font-weight: 600;
          padding: 9px 16px;
          border-radius: 22px;
          box-shadow: 0 6px 24px rgba(0,0,0,0.18);
          white-space: nowrap;
          font-family: 'Inter', system-ui, sans-serif;
          border: 1px solid rgba(0,0,0,0.06);
          animation: fadeUp 0.5s ease 0.2s both;
          cursor: pointer;
        }
        .bubble-label::after {
          content: '';
          position: absolute;
          bottom: -8px;
          right: 22px;
          width: 0; height: 0;
          border-left: 8px solid transparent;
          border-right: 8px solid transparent;
          border-top: 9px solid #fff;
          filter: drop-shadow(0 3px 4px rgba(0,0,0,0.12));
        }
        .bubble-btn {
          width: 62px; height: 62px;
          border-radius: 50%;
          border: none; cursor: pointer;
          animation: bubblePulse 3s ease-in-out infinite, fadeUp 0.5s ease 0.3s both, floatBob 4s ease-in-out 1s infinite;
          position: relative; display: flex; align-items: center; justify-content: center;
          will-change: transform;
          filter: drop-shadow(0 8px 24px rgba(0,0,0,0.35));
        }
        .bubble-ripple, .bubble-ripple-2 {
          position: absolute; inset: 0; border-radius: 50%;
          animation: ripple 2.2s ease-out 0.8s infinite;
          pointer-events: none;
        }
        .bubble-ripple-2 { animation-delay: 1.4s; }
        .chat-panel {
          position: fixed; bottom: 24px; right: 24px; z-index: 1001;
          animation: panelIn 0.38s cubic-bezier(0.16,1,0.3,1) both;
          width: 400px;
          height: min(680px, calc(100vh - 40px));
          border-radius: 20px; overflow: hidden;
          box-shadow: 0 32px 80px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.1);
          display: flex; flex-direction: column;
        }
        .chat-panel > * { flex: 1; min-height: 0; }
        .demo-badge {
          position: fixed; top: 10px; left: 0; right: 0;
          width: fit-content; margin: 0 auto; z-index: 1002;
          background: rgba(6,10,6,0.82); backdrop-filter: blur(12px);
          border: 1px solid rgba(201,168,76,0.28); border-radius: 100px;
          padding: 7px 20px; color: rgba(255,255,255,0.82); font-size: 12px;
          font-family: 'Inter', system-ui, sans-serif; letter-spacing: 0.025em;
          white-space: nowrap; display: flex; align-items: center; gap: 8px;
          animation: fadeUp 0.5s ease 0.1s both;
        }
        .badge-short { display: none; }
        @media (max-width: 480px) {
          .badge-full { display: none; }
          .badge-short { display: inline; }
          .chat-panel {
            bottom: 0; right: 0; left: 0; width: 100%;
            height: calc(var(--vp-h, 100dvh) - 40px); top: 40px; border-radius: 0;
            overflow-x: hidden;
          }
          .arrow-hint { display: none; }
          .bubble-label { display: none; }
        }
      `}</style>

      <div className="demo-badge">
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22d68a", flexShrink: 0, display: "inline-block" }} />
        <span className="badge-full">Démonstration client · {config.name} — propulsé par DUBUB</span>
        <span className="badge-short">Démo · {config.name}</span>
      </div>

      {config.websiteUrl ? (
        <iframe
          src={config.websiteUrl}
          title={config.name}
          style={{ position: "fixed", inset: 0, width: "100%", height: "100%", border: "none", zIndex: 0, pointerEvents: "none" }}
        />
      ) : (
        <div style={{ position: "fixed", inset: 0, zIndex: 0, background: "linear-gradient(135deg, #0d0d14 0%, #1a1a2a 100%)" }} />
      )}

      <div style={{ position: "fixed", inset: 0, zIndex: 1, pointerEvents: "none" }} />

      {chatOpen ? (
        <div className="chat-panel">
          <button
            type="button"
            onClick={() => setChatOpen(false)}
            style={{
              position: "absolute", top: 12, right: 12, zIndex: 10,
              width: 30, height: 30, borderRadius: "50%",
              background: "rgba(255,255,255,0.18)", border: "none",
              color: "#fff", fontSize: 17, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", lineHeight: 1,
              transition: "background 0.15s",
            }}
            aria-label="Réduire"
          >
            ×
          </button>
          <ChatShell
            mode="inline"
            tenantId={config.tenantId}
            conciergeName={config.conciergeName}
            clientName={config.clientName}
            accentColor={config.accentColor}
            accentGradient={config.accentGradient}
            accentRgb={config.accentRgb}
            accentTextColor={config.accentTextColor}
            darkMode={config.darkMode}
            logoUrl={config.logoUrl}
            nudgesFr={config.nudgesFr}
            nudgesEn={config.nudgesEn}
            nudgeLabelFr={config.nudgeLabelFr}
            nudgeLabelEn={config.nudgeLabelEn}
            nudgeSubLabelFr={config.nudgeSubLabelFr}
            nudgeSubLabelEn={config.nudgeSubLabelEn}
            suggestedQuestionsFr={config.suggestedQuestionsFr}
            suggestedQuestionsEn={config.suggestedQuestionsEn}
            tenantPhone={config.tenantPhone}
            pricingCtaFr={config.pricingCtaFr}
            pricingCtaEn={config.pricingCtaEn}
            pricingCtaMessageFr={config.pricingCtaMessageFr}
            pricingCtaMessageEn={config.pricingCtaMessageEn}
          />
        </div>
      ) : (
        <div
          style={{
            position: "fixed", bottom: 24, right: 24, zIndex: 1000,
            display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 10,
            transform: `translate(${bubbleOffset.x}px, ${bubbleOffset.y}px)`,
            transition: "transform 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          }}
        >
          {!labelDismissed && (
            <div className="bubble-label" onClick={() => { setChatOpen(true); setLabelDismissed(true); }}>
              💬 Bonjour ! Je suis votre concierge {config.name}
              <span onClick={(e) => { e.stopPropagation(); setLabelDismissed(true); }} style={{ marginLeft: 8, opacity: 0.4, cursor: "pointer", fontSize: 12 }}>✕</span>
            </div>
          )}
          <button
            className="bubble-btn"
            style={{ background: config.bubbleGradient }}
            onClick={() => { setChatOpen(true); setLabelDismissed(true); }}
            aria-label={`Ouvrir le Concierge ${config.name}`}
          >
            <span className="bubble-ripple" style={{ border: `2px solid ${config.accentColor}55` }} />
            <span className="bubble-ripple-2" style={{ border: `2px solid ${config.accentColor}55` }} />
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style={{ position: "relative", zIndex: 1 }}>
              <path d="M12 2C6.48 2 2 6.04 2 11c0 2.7 1.18 5.13 3.07 6.84L4 22l4.36-1.45C9.51 20.84 10.72 21 12 21c5.52 0 10-4.04 10-9s-4.48-9-10-9z" fill="white" />
            </svg>
          </button>
        </div>
      )}
    </>
  );
}
