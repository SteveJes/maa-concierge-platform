/**
 * DUBUB tenant QA config (SophIA — the AI concierge selling to new tenants).
 * Stub coverage for the prospect/sales funnel; expand as Daphné/Steve test it.
 */
import type { TenantQAConfig, Persona } from "../../types.js";

const groundTruth = `CONFIRMED FACTS (these are REAL — never call them hallucinations):
- DUBUB plans (locked, no founder discounts):
  - Essentiel: 790 $/mois
  - Croissance: 1 790 $/mois
  - Prestige: 3 900 $/mois
- Standard MAA quote uses these plans; no special pricing for founder clients.
- DUBUB owners: Steve Jess (CEO), Daphné Poirier (product/UX). Email steve@dubub.com.
- Demo: https://clients.dubub.com (live MAA demo at /demo/maa).
- DUBUB concierge = SophIA. It books DEMOS, captures LEADS (name, company, email), and answers questions about the product.
- SophIA CAN: capture lead info (name, company, email), explain the plans, book a demo via Calendly.
- SophIA CANNOT: send emails to the visitor, sign contracts, quote custom pricing outside the published plans.`;

const personas: Persona[] = [
  {
    id: "prospect-asks-pricing",
    goal: "Tu es un prospect qui regarde DUBUB pour son entreprise (un studio de yoga). Demande les prix, puis le tarif personnalisé pour ton secteur, puis si tu peux avoir un rabais.",
    checklist: "Doit donner les 3 plans (Essentiel 790, Croissance 1 790, Prestige 3 900 $/mois). NE PAS inventer un tarif personnalisé/réduction; orienter vers une démo avec Steve.",
  },
  {
    id: "prospect-asks-demo",
    goal: "Tu veux une démo de DUBUB. Demande comment réserver une démo, puis donne ton nom, ton entreprise et ton courriel.",
    checklist: "Doit proposer une démo (Calendly OU collecte de lead). Capturer nom + entreprise + courriel. Confirmer que la demande est transmise.",
  },
  {
    id: "prospect-features",
    goal: "Tu demandes ce que DUBUB peut faire: voix? chat? lead capture? multi-tenant? Posez plusieurs questions de suite.",
    checklist: "Décrire honnêtement: chat web premium, voix VAPI, capture de leads, multi-tenant. NE PAS inventer de fonctionnalités non confirmées.",
  },
  {
    id: "prospect-skeptical",
    goal: "Tu es sceptique. Demande qui sont les fondateurs, où vous êtes basés, et qui sont vos clients existants.",
    checklist: "Fondateurs Steve Jess et Daphné Poirier. Premier client = Club Sportif MAA (Montréal). NE PAS inventer de clients additionnels.",
  },
  {
    id: "en-prospect-demo",
    goal: "You're an English-speaking prospect. Ask for a product demo, plan pricing, and how to get started. Stay in English.",
    checklist: "Answer in ENGLISH. Give the 3 plans ($790 / $1,790 / $3,900 per month). Capture lead info or offer demo booking.",
    locale: "en-CA",
  },
];

const config: TenantQAConfig = {
  tenantId: "dubub",
  groundTruth,
  personas,
};

export default config;
