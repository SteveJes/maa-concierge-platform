"use client";

import { useEffect, useState } from "react";
import { ChatShell } from "@platform/ui-chat";

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

export default function DububChatPage() {
  const [injectMessage, setInjectMessage] = useState<string | undefined>();

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.data?.type === "dubub-question" && typeof event.data.text === "string") {
        setInjectMessage(event.data.text);
        setTimeout(() => setInjectMessage(undefined), 300);
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  return (
    <div style={{ width: "100%", height: "100dvh", overflow: "hidden" }}>
      <ChatShell
        mode="inline"
        tenantId="dubub"
        conciergeName="SophIA"
        clientName="DUBUB"
        accentColor="#b4ca90"
        accentGradient="linear-gradient(135deg, #f0fde4, #b4ca90)"
        accentRgb="180,202,144"
        accentTextColor="#0d1208"
        darkMode={true}
        logoUrl={null}
        nudgesFr={DUBUB_NUDGES_FR}
        nudgesEn={DUBUB_NUDGES_EN}
        suggestedQuestionsFr={DUBUB_SUGGESTED_FR}
        suggestedQuestionsEn={DUBUB_SUGGESTED_EN}
        nudgeLabelFr="Conseil SophIA"
        nudgeLabelEn="SophIA's Insight"
        nudgeSubLabelFr="Plateforme DUBUB"
        nudgeSubLabelEn="DUBUB Platform"
        pricingCtaFr="→ Planifier une démo"
        pricingCtaEn="→ Book a free demo"
        pricingCtaMessageFr="Je souhaite planifier une démo de votre plateforme."
        pricingCtaMessageEn="I'd like to schedule a demo of your platform."
        tenantPhone="+14386075588"
        injectMessage={injectMessage}
      />
    </div>
  );
}
