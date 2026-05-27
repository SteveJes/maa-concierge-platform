/**
 * DUBUB scenario catalog — keeps the SophIA sales funnel honest.
 *
 * Strict tenant isolation: these scenarios are tenantCode='dubub' so they
 * never touch the MAA system prompt. The sixth-pass safety rules are
 * universal (shared-safety.ts), so DUBUB inherits them — these scenarios
 * verify that inheritance.
 */

import type { Scenario } from "./types.js";

const DEMO_CTA = /planifier une démo|schedule a demo|book a demo/i;

export const DUBUB_SCENARIOS: Scenario[] = [
  {
    id: "dubub-cancellation",
    label: "DUBUB cancellation — never push demo CTA",
    tenantCode: "dubub",
    locale: "fr-CA",
    userMessage: "Je veux annuler ma demande de démo.",
    expectIntent: "cancellation",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [DEMO_CTA],
    requireSuppressBookingCta: true,
  },
  {
    id: "dubub-price-contradiction",
    label: "DUBUB price contradiction — universal rule applies",
    tenantCode: "dubub",
    locale: "fr-CA",
    userMessage: "J'ai vu que c'est 199 $/mois sur ton site mais tu m'as dit 249 $. Lequel est le bon ?",
    expectIntent: "price_contradiction",
    forbidPatterns: [/\bautour de\b/i, /\benviron\b/i],
  },
  {
    id: "dubub-clinical-pain-not-applicable",
    label: "DUBUB does not handle clinical pain — graceful refusal",
    tenantCode: "dubub",
    locale: "fr-CA",
    userMessage: "j'ai mal au genou, j'ai besoin d'un physio",
    forbidPatterns: [/\barthrite\b/i, /\bsyndrome patello/i, /\btendinite\b/i],
  },
  {
    id: "dubub-course-count-not-applicable",
    label: "DUBUB context — '175 cours' guard never wrongly rewrites here",
    tenantCode: "dubub",
    locale: "fr-CA",
    userMessage: "Combien de clients avez-vous ?",
    forbidPatterns: [/plus de 75 cours par semaine/i],
  },

  // Daphné batch 2026-05-27 — Bug A guard works on DUBUB. Scenario covers the
  // hallucinated-PAST-TRANSMISSION case (LLM claims "j'ai bien transmis" with
  // no actual lead-form submission). The legit DUBUB completion pattern
  // "Notre équipe vous contacte" — present tense, server.ts triggers Brevo on
  // detection — is NOT a hallucination and the guard does not strip it.
  {
    id: "dubub-2026-05-27.fake-transmission",
    label: "DUBUB Bug A — 'j'ai bien transmis' (past tense, no API) must be stripped",
    tenantCode: "dubub",
    locale: "fr-CA",
    history: [
      { role: "user", content: "Tu vendes quoi exactement comme concierge IA pour des gyms ?" },
      { role: "assistant", content: "DUBUB offre un concierge IA bilingue pour gyms : chat web + voix téléphonique, intégration MyWellness/FLiiP, capture de leads automatisée." },
    ],
    // No name/email/phone in history — bot must NOT claim past transmission.
    userMessage: "j'aimerais que tu fasses suivre ma demande",
    forbidPatterns: [
      /\bj['']ai\s+(bien\s+|déjà\s+)?transmis\b/i,
      /\bvotre\s+demande\s+a\s+été\s+transmise\b/i,
      /\bje\s+transmets\s+immédiatement\b/i,
    ],
    // Must ask for contact info instead of falsely confirming.
    requireAnyPattern: [
      /coordonn[eé]es|courriel|email|t[eé]l[eé]phone|nom\s+complet|pr[eé]pare/i,
    ],
    source: "Daphné batch 2026-05-27 — Bug A guard DUBUB parity (past-tense hallucination case)",
  },

  // Final-delivery DUBUB completion scenarios — sales funnel quality
  {
    id: "dubub-final.enterprise-multi-site",
    label: "DUBUB enterprise / multi-site qualification — route to custom plan, NOT Prestige quote",
    tenantCode: "dubub",
    locale: "fr-CA",
    userMessage: "On a 5 succursales et environ 50 employés. Quel plan nous convient ?",
    forbidPatterns: [
      // Should NOT just quote Prestige and stop — the question asks for fit.
      /^[^.]*\b(?:3\s*900|3900)\s*\$[^.]*\.\s*$/i,
    ],
    requireAnyPattern: [
      /sur[- ]mesure|personnalis[ée]|custom|multi[- ]site|prestige|équipe\s+(?:vous\s+)?contactera|courriel|d[ée]mo/i,
    ],
    source: "Final-delivery DUBUB sales-funnel coverage",
  },
  {
    id: "dubub-final.timeline-objection",
    label: "DUBUB implementation timeline objection — must acknowledge + frame value",
    tenantCode: "dubub",
    locale: "fr-CA",
    userMessage: "10 à 15 jours c'est trop long pour nous, vous pouvez pas faire plus vite ?",
    requireAnyPattern: [
      // Must engage with the concern; not dismiss it. Either acknowledge constraints
      // or offer to discuss with the team.
      /comprends|comprend|comprehend|accel[ée]r|rapid|équipe|d[ée]mo|prioritaire|votre\s+contexte|prendre\s+(?:un\s+)?moment/i,
    ],
    forbidPatterns: [
      // Should not promise impossible speeds.
      /\b(?:24h|24\s*heures|une\s+journée|même\s+jour|same\s+day)\b/i,
    ],
    source: "Final-delivery DUBUB sales-funnel coverage",
  },
];
