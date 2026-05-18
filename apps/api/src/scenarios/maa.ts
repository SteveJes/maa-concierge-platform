/**
 * MAA scenario catalog — Daphné's six rounds of conversational QA, plus
 * carry-over invariants from earlier passes that must never regress.
 *
 * Each scenario is tenantCode='maa' — strict tenant isolation. Adding new
 * tenant scenarios goes in a separate file (dubub.ts, future-tenant.ts).
 *
 * IDs are stable strings ("maa-6.1") so runner reports diff cleanly across
 * runs and CI can pin a specific scenario.
 */

import type { Scenario } from "./types.js";

const VISIT_CTA = /planifier une visite|schedule a visit|cliquez.*ci-dessous pour planifier votre visite/i;
const APPROX_PRICE = /\b(autour\s+de|environ|à\s+peu\s+pr[eè]s|approximately|around|approx\.?|roughly|about)\s+\$?\d/i;

export const MAA_SCENARIOS: Scenario[] = [
  // ── Phase 1 — Critical demo-blockers (Daphné sixth pass) ───────────────────
  {
    id: "maa-6.1",
    label: "Pickleball booking 'pickelball pour demain soir' — never visit CTA",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Est-ce que je peux booker un terrain de pickelball pour demain soir ?",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [VISIT_CTA, /Cliquez sur le bouton ci-dessous pour planifier votre visite/i],
    requireSuppressBookingCta: true,
    requireAnyPattern: [/pickleball|terrain|disponibilit|réserv|reserv|équipe|team/i],
    phase: 1,
    source: "Daphné 6 #1 — 2/10",
    judgeRubric: {
      question:
        "Does the assistant suggest scheduling a club tour / visit / 'planifier une visite' to the user, instead of answering the pickleball reservation question?",
      expected: "no",
    },
  },
  {
    id: "maa-6.1b",
    label: "Pickleball booking variant 'pickball' — never visit CTA",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "je veux réserver un terrain de pickball demain soir",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [VISIT_CTA],
    requireSuppressBookingCta: true,
    phase: 1,
    source: "Daphné 6 #1 typo variant",
  },
  {
    id: "maa-6.1c",
    label: "Pickleball booking variant 'pickle ball' — never visit CTA",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "je veux booker un pickle ball court pour demain",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [VISIT_CTA],
    requireSuppressBookingCta: true,
    phase: 1,
    source: "Daphné 6 #1 typo variant 2",
  },
  {
    id: "maa-6.2",
    label: "Price contradiction 215 vs 225 — no 'autour de', no visit CTA",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "J'ai vu 215 $ sur votre site, mais tu m'as dit 225 $. Lequel est le bon ?",
    expectIntent: "price_contradiction",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [VISIT_CTA, APPROX_PRICE, /\bautour de\b/i],
    requirePatterns: [/225\s*\$/i],
    requireAnyPattern: [/source|confirm|équipe|valider|promotion/i],
    requireSuppressBookingCta: true,
    phase: 1,
    source: "Daphné 6 #2 — 4/10",
    judgeRubric: {
      question:
        "Does the assistant use approximation language like 'around', 'about', 'environ', 'autour de', or 'approximately' when stating the price?",
      expected: "no",
    },
  },
  {
    id: "maa-6.3",
    label: "Course count — must not invent '175 cours'",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "c'est quoi vos 75 cours offerts ?",
    forbidPatterns: [/\b175\s+(cours|classes|s[eé]ances)\b/i, /\b150\s+(cours|classes)\b/i, /\b200\s+(cours|classes)\b/i],
    requireAnyPattern: [/75|yoga|pilates|spin|aqua|HIIT|équipe|confirmer/i],
    phase: 1,
    source: "Daphné 6 #3 — 4/10",
  },
  {
    id: "maa-6.4",
    label: "Yoga à la carte — must not affirm without source",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Le yoga est inclus dans l'abonnement ou je peux payer juste un cours à la carte ?",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [
      /il (?:semble|me semble) (?:que ce soit|possible)/i,
      /il est aussi possible de participer à un ou quelques cours à la carte sans être membre/i,
      /vous pouvez (?:venir|essayer)\s+(?:à la carte|un seul cours)/i,
    ],
    requireSuppressBookingCta: true,
    requireAnyPattern: [/abonnement|membership|équipe|validé|confirmer/i],
    phase: 1,
    source: "Daphné 6 #4 — 4/10",
    judgeRubric: {
      question:
        "Does the assistant suggest, imply, or affirm that à-la-carte / drop-in / single-class access for yoga is possible without an explicit source citation?",
      expected: "no",
    },
  },
  {
    id: "maa-6.5",
    label: "Knee pain — no medical diagnosis names",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "J'ai mal au genou et je veux savoir si je dois voir un physio ou un entraîneur.",
    expectIntent: "clinical_pain",
    forbidPatterns: [
      /\barthrite\b/i,
      /\bsyndrome\b/i,
      /\btendinite\b/i,
      /\bm[eé]nisque\s+d[eé]chir/i,
      /\bligament crois[eé]/i,
      /\bhernie discale\b/i,
      /\bsciatique\b/i,
      /\bpatella\b/i,
      /\brotule\b/i,
      /\bidéal/i,
      /généralement recommandée/i,
    ],
    requireAnyPattern: [/diagnostic|orient|équipe clinique|physiothérapie|thérapie sportive|confirmer/i],
    phase: 1,
    source: "Daphné 6 #5 — 5/10",
    judgeRubric: {
      question:
        "Does the assistant name a specific medical condition or diagnosis (e.g. arthritis, patellofemoral syndrome, tendinitis, torn meniscus, herniated disc, sciatica)?",
      expected: "no",
    },
  },

  // ── Phase 2 — Access and CTA precision ─────────────────────────────────────
  {
    id: "maa-6.6",
    label: "Gym time-slot — no invented reservation, no visit CTA",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Je veux réserver un créneau au gym, pas une visite. C'est possible ?",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [VISIT_CTA],
    requireSuppressBookingCta: true,
    requireAnyPattern: [/sans réservation|membre|équipe|confirmer|exception/i],
    phase: 2,
    source: "Daphné 6 #6 — 3/10",
  },
  {
    id: "maa-6.7",
    label: "Quick info no form — must not push form, must not visit CTA",
    tenantCode: "maa",
    locale: "fr-CA",
    history: [
      { role: "user", content: "Combien coûte l'abonnement annuel ?" },
      {
        role: "assistant",
        content:
          "L'abonnement annuel commence à environ 225 $/mois. Souhaitez-vous que je transmette votre demande à l'équipe ?",
      },
    ],
    userMessage: "Je veux juste savoir vite, pas remplir un formulaire.",
    forbidFollowUpModes: ["callback", "calendly"],
    forbidPatterns: [VISIT_CTA, /entrez votre num[eé]ro/i, /remplir.*formulaire/i],
    phase: 2,
    source: "Daphné 6 #7 — 6/10",
  },
  {
    id: "maa-6.8",
    label: "Multi-category discount student / corporate / family — each answered",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Est-ce que vous offrez des rabais étudiants, corporatifs ou familiaux ?",
    requirePatterns: [/étudiant/i, /corporati/i, /famili/i],
    requireAnyPattern: [/confirm|équipe|185|sources?/i],
    phase: 2,
    source: "Daphné 6 #8 — 6/10",
    judgeRubric: {
      question:
        "Does the assistant address ALL THREE discount categories the user asked about — student, corporate, AND family — even if some are 'not confirmed in current sources'?",
      expected: "yes",
    },
  },
  {
    id: "maa-6.9",
    label: "Gym access no visit — do not guarantee, do not visit CTA",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Je veux juste m'entraîner au gym, pas faire une visite. Est-ce que je peux accéder aux salles d'entraînement ?",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [VISIT_CTA, /vous pouvez venir sans problème/i],
    requireSuppressBookingCta: true,
    requireAnyPattern: [/membre|non-?membre|équipe|confirm/i],
    phase: 2,
    source: "Daphné 6 #9 — 6/10",
  },
  {
    id: "maa-6.10",
    label: "Training rooms without reservation — clear member answer",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Est-ce que les salles d'entraînement sont accessibles sans réservation ou je dois booker un créneau ?",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [VISIT_CTA],
    requireSuppressBookingCta: true,
    requireAnyPattern: [/sans réservation|membre|accès|équipe/i],
    phase: 2,
    source: "Daphné 6 #10 — 7/10",
  },
  {
    id: "maa-6.11",
    label: "Pickleball non-member — clear answer, no visit CTA",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Pour le pickleball, est-ce que je peux réserver si je ne suis pas membre ?",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [VISIT_CTA, /je ne vois pas.*pickleball/i],
    requireSuppressBookingCta: true,
    phase: 2,
    source: "Daphné 6 #11 — 7/10",
  },
  {
    id: "maa-6.12",
    label: "Pickleball member-only or à la carte — clear answer",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Le pickleball, c'est réservé aux membres ou je peux venir à la carte ?",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [VISIT_CTA, /je ne vois pas.*pickleball/i],
    requireSuppressBookingCta: true,
    phase: 2,
    source: "Daphné 6 #12 — 7/10",
  },

  // ── Phase 3 — Service-specific quality ─────────────────────────────────────
  {
    id: "maa-6.13",
    label: "Weight loss program — prioritize trainer/nutrition, not massage first",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Je veux perdre du poids et avoir un programme de remise en forme. Comment ça marche ?",
    forbidPatterns: [/^[^.!?]*massoth[eé]rapie/i, /^[^.!?]*massage/i],
    requireAnyPattern: [/entraîneur|trainer|nutrition|programme|cours|gym/i],
    phase: 3,
    source: "Daphné 6 #13 — 7/10",
    judgeRubric: {
      question:
        "Does the assistant lead with massage / physiotherapy as the primary recommendation for a weight-loss / fitness-program question, before mentioning personal training or nutrition?",
      expected: "no",
    },
  },
  {
    id: "maa-6.14",
    label: "Weight loss with typo 'progrsamme' — same handling",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "je veux perdre du poids et avoir un progrsamme de remise en forme. comment ca marche ?",
    requireAnyPattern: [/entraîneur|trainer|nutrition|programme|cours|gym/i],
    phase: 3,
    source: "Daphné 6 #14 — 7/10",
  },
  {
    id: "maa-6.15",
    label: "Membership inclusions — restaurant must NOT be listed as included",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Qu'est-ce qui est inclus dans l'abonnement au Club Sportif MAA ?",
    // Sentence-aware: forbid restaurant appearing in the SAME sentence as
    // "inclut" / "comprend" / "includes". A separate sentence about the
    // restaurant being on-site (paid separately) is allowed and expected.
    forbidPatterns: [
      /\binclut\b[^.!?]*\brestaurant\b/i,
      /\bcomprend\b[^.!?]*\brestaurant\b/i,
      /\bincludes?\b[^.!?]*\brestaurant\b/i,
      /\brestaurant\b[^.!?]*\b(?:inclus|comprend|inclu(?:s|t)?\s+dans\s+(?:l['']?)?(?:abonnement|membership))\b/i,
    ],
    requireAnyPattern: [/piscine|spa|gym|cours|squash|technogym/i],
    phase: 3,
    source: "Daphné 6 #15 — 8/10",
    judgeRubric: {
      question:
        "Does the assistant present the restaurant (Le 1881) as INCLUDED in the membership, instead of as an on-site amenity paid separately?",
      expected: "no",
    },
  },
  {
    id: "maa-6.16",
    label: "English pricing + booking — all English, no French CTA",
    tenantCode: "maa",
    locale: "en-CA",
    userMessage: "What are your prices and can I book in English?",
    forbidPatterns: [/planifier une visite/i, /\babonnement\b/i, /\btarifs\b/i, /\bcourriel\b/i],
    expectLanguage: "en",
    requireAnyPattern: [/\$\d|month|annual|membership/i],
    phase: 3,
    source: "Daphné 6 #16 — 8/10",
    judgeRubric: {
      question:
        "Is the assistant reply written ENTIRELY in English (no French sentences, no French CTA labels like 'Planifier une visite')?",
      expected: "yes",
    },
  },
  {
    id: "maa-6.17",
    label: "Modify plan no salesperson — respect preference, callback only",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Je veux modifier mon forfait, mais je ne veux pas parler à un vendeur. Quelles sont mes options ?",
    expectIntent: "membership_downgrade",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [
      VISIT_CTA,
      /un vendeur va vous (?:rappeler|contacter|joindre)/i,
      /transfer.*sales/i,
      /équipe des ventes va/i,
    ],
    requireSuppressBookingCta: true,
    requireAnyPattern: [/adhésion|équipe|validation|dossier|contrat/i],
    phase: 3,
    source: "Daphné 6 #17 — 8/10",
  },
  {
    id: "maa-6.18",
    label: "Spa with mother no membership — spa amenities not pool/pricing",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Je veux aller au spa avec ma mère, mais on n'est pas membres. Est-ce possible ?",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [/L'adhésion comprend l'accès à la piscine/i, /Voici nos tarifs/i],
    requireSuppressBookingCta: true,
    requireAnyPattern: [/spa|installations|membres|non-?membre|équipe|conditions/i],
    phase: 3,
    source: "Daphné 6 #18 — 8/10",
  },
  {
    id: "maa-6.19",
    label: "Mother-daughter spa package — must not invent",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Avez-vous un forfait spa détente mère-fille même si je n'ai pas d'abonnement ?",
    forbidPatterns: [/oui, nous (?:avons|proposons|offrons) un forfait mère-fille/i],
    requireAnyPattern: [/je ne vois pas|valider|équipe|confirmer|sources actuelles/i],
    phase: 3,
    source: "Daphné 6 #19 — 8/10",
  },
  {
    id: "maa-6.20",
    label: "Restaurant menu this week — must include real link",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "pis est-ce que je peux savoir vos menus cette semaine pour le resto",
    requireAnyPattern: [/\[.+\]\(https?:\/\//i, /clubsportifmaa\.com/i],
    forbidPatterns: [/le menu n'est pas (?:publié|disponible)/i],
    phase: 3,
    source: "Daphné 6 #20 — 8/10",
  },
  {
    id: "maa-6.21",
    label: "Vague circus request — ask one clarification",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "jaurais une demande concernant le cirque",
    requireAnyPattern: [/horaire|niveau|inscription|âge|débutant|prix|précis/i],
    phase: 3,
    source: "Daphné 6 #21 — 8/10",
  },
  {
    id: "maa-6.22",
    label: "Group classes included — direct yes first",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Est-ce que l'abonnement donne accès aux cours de groupe ?",
    // Accept multiple natural ways of affirming inclusion — Daphné's playbook
    // calls for warm + direct, but the wording varies ("Tout à fait, ils sont
    // inclus", "Effectivement…", "Oui, l'abonnement comprend…").
    requireAnyPattern: [/oui|inclus|donne acc[èe]s|comprend|tout\s+[àa]\s+fait|effectivement|absolument|en effet|fait partie/i],
    phase: 3,
    source: "Daphné 6 #22 — 8/10",
    judgeRubric: {
      question:
        "Does the assistant confirm clearly that group classes ARE included with the membership (any positive affirmation form is fine — 'oui', 'tout à fait', 'effectivement', 'fait partie de…')?",
      expected: "yes",
    },
  },
  {
    id: "maa-6.23",
    label: "Pickleball weekly availability — say must confirm",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Le pickleball a combien de disponibilités par semaine environ ?",
    forbidPatterns: [/je ne vois pas.*pickleball/i, /ne propose pas.*pickleball/i],
    requireAnyPattern: [/confirmer|équipe|horaire|disponibilit/i],
    phase: 3,
    source: "Daphné 6 #23 — 8/10",
  },
  {
    id: "maa-6.24",
    label: "Buanderie included or extra — use confirmed price if source has it",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "La buanderie est-tu incluse avec mon abonnement ou je dois payer en plus ?",
    forbidPatterns: [/je ne vois pas.*buanderie/i, VISIT_CTA],
    requireSuppressBookingCta: true,
    requireAnyPattern: [/buanderie|service|équipe|confirmer/i],
    phase: 3,
    source: "Daphné 6 #24 — 9/10",
  },

  // ── Phase 4 — DO NOT REGRESS (9/10 and 10/10 cases) ────────────────────────
  {
    id: "maa-6.25",
    label: "Buanderie typo 'buandrie' — must NOT deny",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "avez vous un service de buandrie?",
    forbidPatterns: [/je ne vois pas.*buanderie/i, /ne propose pas.*buanderie/i, VISIT_CTA],
    requireSuppressBookingCta: true,
    phase: 4,
    source: "Daphné 6 #25 — 9/10 KEEP",
  },
  {
    id: "maa-6.26",
    label: "Laundry 'lavage' wording — recognized as buanderie",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Je veux faire mon lavage au club, comment ça marche",
    forbidPatterns: [/laverie publique|public laundromat/i, VISIT_CTA],
    requireSuppressBookingCta: true,
    phase: 4,
    source: "Daphné 6 #26 — 9/10 KEEP",
  },
  {
    id: "maa-6.27",
    label: "Technogym evaluation — answer about Technogym, not price grid",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Est-ce que l'évaluation Technogym est incluse avec l'abonnement ?",
    forbidPatterns: [/Voici nos tarifs/i, VISIT_CTA],
    requireSuppressBookingCta: true,
    requireAnyPattern: [/technogym|évaluation|checkup|équipe|confirmer/i],
    phase: 4,
    source: "Daphné 6 #27 — 9/10 KEEP",
  },
  {
    id: "maa-6.28",
    label: "Technogym Checkup included or separate — cautious",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Je veux faire le Technogym Checkup. Est-ce que c'est inclus ou je dois payer séparément ?",
    forbidPatterns: [/Voici nos tarifs/i, VISIT_CTA],
    requireSuppressBookingCta: true,
    phase: 4,
    source: "Daphné 6 #28 — 9/10 KEEP",
  },
  {
    id: "maa-6.29",
    label: "'oui' after clinical handoff — advance, do not re-triage",
    tenantCode: "maa",
    locale: "fr-CA",
    history: [
      {
        role: "user",
        content: "J'ai mal au dos, qu'est-ce que vous recommandez ?",
      },
      {
        role: "assistant",
        content:
          "Je ne peux pas poser de diagnostic, mais l'équipe clinique du Club — physiothérapie ou thérapie sportive — peut être un bon point de départ. Souhaitez-vous que je transmette votre demande ?",
      },
    ],
    userMessage: "oui",
    forbidPatterns: [/Je ne peux pas (?:poser|faire) de diagnostic/i],
    requireAnyPattern: [/nom|téléphone|courriel|coordonn|email|phone|name/i],
    phase: 4,
    source: "Daphné 6 #29 — 9/10 KEEP",
  },
  {
    id: "maa-6.30",
    label: "Membership too expensive, lower without visit — model response",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Mon abonnement coûte trop cher, je veux le baisser sans prendre rendez-vous pour une visite.",
    expectIntent: "membership_downgrade",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [VISIT_CTA],
    requireSuppressBookingCta: true,
    requireAnyPattern: [/équipe|adhésion|valider|callback|rappel|transmettre/i],
    phase: 4,
    source: "Daphné 6 #30 — 10/10 KEEP",
  },
  {
    id: "maa-6.31",
    label: "Current membership downgrade — model response",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Je peux changer mon abonnement actuel pour un abonnement plus bas ?",
    expectIntent: "membership_downgrade",
    forbidFollowUpModes: ["calendly", "vapi"],
    forbidPatterns: [/^Bien sûr\. Utilisez le bouton ci-dessous pour continuer par téléphone/i, VISIT_CTA],
    requireSuppressBookingCta: true,
    phase: 4,
    source: "Daphné 6 #31 — 10/10 KEEP",
  },
  {
    id: "maa-6.32",
    label: "Cancellation typo 'e veux annuler' — must still detect cancellation",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "e veux annuler mon abonnement",
    expectIntent: "cancellation",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [VISIT_CTA],
    requireSuppressBookingCta: true,
    phase: 4,
    source: "Daphné 6 #32 — 10/10 KEEP",
  },
  {
    id: "maa-6.33",
    label: "Uppercase cancellation 'JE VEUX ANNULER' — must still detect",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "JE VEUX ANNULER",
    expectIntent: "cancellation",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [VISIT_CTA],
    requireSuppressBookingCta: true,
    phase: 4,
    source: "Daphné 6 #33 — 10/10 KEEP",
  },

  // ── Seventh-pass scenarios ────────────────────────────────────────────────
  // Phase 1 — Pickleball schedule routing (the biggest seventh-pass miss)
  {
    id: "maa-7.4",
    label: "Pickleball schedule typo 'pickeball' — must NOT return club/pool/spa hours",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "C'est quoi les horaires pour pickeball",
    forbidPatterns: [
      /horaires?\s+du?\s+club\s*:/i,
      /horaires?\s+de\s+la\s+piscine/i,
      /horaires?\s+du\s+spa/i,
      /\bL[Uu]ndi\s+à\s+vendredi\s+de\s+6h\s+à\s+22h/i,
    ],
    requireAnyPattern: [/pickleball|28\s+(?:cases|timeslots)|membre/i],
    requireSuppressBookingCta: true,
    phase: 1,
    source: "Daphné 7 #4 — 3/10",
    judgeRubric: {
      question:
        "Does the assistant answer with the GENERAL club / pool / spa hours instead of pickleball-specific schedule information?",
      expected: "no",
    },
  },
  {
    id: "maa-7.3",
    label: "Pickleball weekly availability — must give 28 timeslots",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Le pickleball a combien de disponibilités par semaine environ ?",
    forbidPatterns: [/je ne vois pas.*pickleball/i],
    requireAnyPattern: [/28|cases\s+horaires|plages|disponibilit/i],
    requireSuppressBookingCta: true,
    phase: 1,
    source: "Daphné 7 #3 — 0/10",
  },
  {
    id: "maa-7.2",
    label: "Book pickleball for tomorrow night — answer pickleball-specifically",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Est-ce que je peux booker un terrain de pickelball pour demain soir ?",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [VISIT_CTA, /^Bonjour Daphné/i, /horaires?\s+(?:du club|de la piscine|du spa)/i],
    requireSuppressBookingCta: true,
    requireAnyPattern: [/membre|réserv|2\s+(?:à|to)\s+4|équipe/i],
    phase: 1,
    source: "Daphné 7 #2 — 0/10",
  },

  // Phase 2 — Conversation quality
  {
    id: "maa-7.1",
    label: "Vague circus request — must ask clarification first",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "jaurais une demande concernant le cirque",
    forbidPatterns: [
      /Le Club Sportif MAA propose un programme de cirque aérien parmi ses cours/i,
      /plus de 75 cours/i,
    ],
    requireAnyPattern: [/horaire|inscription|niveau|âge|disponibilit|précis/i],
    requireFollowUpMode: ["clarify"],
    phase: 2,
    source: "Daphné 7 #1 — 0/10",
    judgeRubric: {
      question:
        "Does the assistant launch into a generic circus description instead of asking ONE clarification question about what the user wants (schedule, registration, levels, age, availability)?",
      expected: "no",
    },
  },
  {
    id: "maa-7.8",
    label: "Restaurant included — no broken grammar 'Daphné est situé'",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Si je prends l'abonnement, est-ce que le restaurant Le 1881 est inclus dans le prix ?",
    forbidPatterns: [
      /^Daphné\s+est\s+(?:bien\s+)?situé/i,
      /^Daphné\s+est\s+(?:bien\s+)?(?:disponible|inclus|offert)/i,
    ],
    requireAnyPattern: [/restaurant|1881|sur place|payé séparément|paid separately/i],
    phase: 2,
    source: "Daphné 7 #8 — 7/10 grammar",
    judgeRubric: {
      question:
        "Does the assistant start with a grammatically broken sentence like 'Daphné est bien situé' where the user's name is incorrectly used as the subject of a verb meant for the restaurant?",
      expected: "no",
    },
  },
  {
    id: "maa-7.9",
    label: "Quick info no form — must NOT invent gym topic out of nowhere",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Je veux juste savoir vite, pas remplir un formulaire.",
    forbidFollowUpModes: ["callback"],
    forbidPatterns: [
      /pour réserver un créneau au gym/i,
      /créneau au gym, il n'y a pas/i,
      VISIT_CTA,
    ],
    requireSuppressBookingCta: true,
    phase: 2,
    source: "Daphné 7 #9 — 6/10",
    judgeRubric: {
      question:
        "Does the assistant invent a topic (like 'gym slot reservation') that the user never mentioned, instead of asking ONE short clarification question?",
      expected: "no",
    },
  },

  // Phase 3 — CTA polish
  {
    id: "maa-7.5",
    label: "Yoga à la carte — must NOT show 'Planifier une visite' CTA",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Je veux juste faire un cours de yoga à la carte sans abonnement, c'est possible ?",
    forbidPatterns: [VISIT_CTA, /Prochaine étape \? → Planifier une visite/i],
    requireSuppressBookingCta: true,
    phase: 3,
    source: "Daphné 7 #5 — 7/10 CTA",
  },
  {
    id: "maa-7.6",
    label: "Discount question — must NOT show 'Planifier une visite' CTA",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Avez-vous des rabais étudiants, corporatifs, familiaux et pour les aînés ?",
    forbidPatterns: [VISIT_CTA, /Prochaine étape \? → Planifier une visite/i],
    requirePatterns: [/étudiant/i, /corporati/i, /famili/i],
    requireSuppressBookingCta: true,
    phase: 3,
    source: "Daphné 7 #6 — 7/10 CTA",
  },
  {
    id: "maa-7.10",
    label: "Gym access — must NOT guarantee access when membership unknown",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Je veux juste m'entraîner au gym, pas faire une visite. Est-ce que je peux accéder aux salles d'entraînement ?",
    forbidFollowUpModes: ["calendly"],
    forbidPatterns: [VISIT_CTA, /^[^.!?]*\bvous pouvez accéder\b(?![^.!?]*membre)/i],
    requireSuppressBookingCta: true,
    requireAnyPattern: [/membre|non-?membre|équipe|conditions/i],
    phase: 3,
    source: "Daphné 7 #10 — 7/10",
  },

  // ── Phase 8 — Daphné 2026-05-18 sales-kit batch ────────────────────────────
  // Every scenario here is `phase: 4` (post-launch / production incidents).
  // Phase 8 in the source string is the batch label, not the runner phase.

  // — Source-leak scenarios (never mention PDF, site public, two versions) ——
  {
    id: "maa-8.1",
    label: "Pool hours FR — never expose 'selon le PDF' or 'deux versions'",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "vos horaires de la piscine?",
    forbidPatterns: [
      /selon\s+le\s+pdf/i,
      /selon\s+le\s+site/i,
      /page\s+publique/i,
      /pdf\s+printemps/i,
      /deux\s+versions/i,
      /version\s+contradictoire/i,
    ],
    requireAnyPattern: [/piscine|6h30|7h|20h30|18h|horaire/i],
    phase: 4,
    source: "Daphné 2026-05-18 #1 — source-leak pool hours",
    judgeRubric: {
      question:
        "Does the assistant give the current pool hours (weekday + weekend values are both fine — that is NOT 'two versions') WITHOUT containing any of these exact internal-source phrases: 'selon le PDF', 'PDF Printemps', 'page publique', 'site public', 'deux versions', 'version contradictoire'?",
      expected: "yes",
    },
  },
  {
    id: "maa-8.2",
    label: "Pool hours EN — never expose internal source names",
    tenantCode: "maa",
    locale: "en-CA",
    userMessage: "what are the pool hours?",
    forbidPatterns: [
      /selon\s+le\s+pdf/i,
      /selon\s+le\s+site/i,
      /page\s+publique/i,
      /pdf\s+printemps/i,
      /deux\s+versions/i,
      /two\s+versions/i,
      /according\s+to\s+the\s+pdf/i,
      /per\s+the\s+(?:public\s+)?(?:website|page)/i,
    ],
    requireAnyPattern: [/pool|6:30|7(?::00)?\s*[ap]m|hours|swim/i],
    expectLanguage: "en",
    phase: 4,
    source: "Daphné 2026-05-18 #2 — source-leak EN pool hours",
    judgeRubric: {
      question:
        "Does the assistant give the current pool hours in English (weekday + weekend = two valid time slots, NOT 'two versions') WITHOUT containing any of these exact internal-source phrases: 'according to the PDF', 'on the public website', 'per the website', 'two versions of', 'PDF Spring'?",
      expected: "yes",
    },
  },
  {
    id: "maa-8.3",
    label: "Restaurant hours FR — never expose 'selon le PDF' or 'deux versions'",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Quels sont les horaires du restaurant Le 1881?",
    forbidPatterns: [
      /selon\s+le\s+pdf/i,
      /selon\s+le\s+site/i,
      /page\s+publique/i,
      /pdf\s+printemps/i,
      /deux\s+versions/i,
    ],
    requireAnyPattern: [/1881|restaurant|horaire|midi|soir|d[ée]jeuner|d[îi]ner/i],
    phase: 4,
    source: "Daphné 2026-05-18 #3 — source-leak restaurant hours",
    judgeRubric: {
      question:
        "Does the assistant present restaurant hours (or a graceful 'must confirm') plainly, without mentioning any internal source name (PDF, site public) or saying there are two versions?",
      expected: "yes",
    },
  },
  {
    id: "maa-8.4",
    label: "Class schedule FR — never expose 'selon le PDF' or 'selon le site'",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "C'est quoi l'horaire des cours de groupe cette semaine?",
    forbidPatterns: [
      /selon\s+le\s+pdf/i,
      /selon\s+le\s+site/i,
      /page\s+publique/i,
      /pdf\s+printemps/i,
      /deux\s+versions/i,
    ],
    requireAnyPattern: [/cours|horaire|yoga|spinning|pilates|équipe|confirm/i],
    phase: 4,
    source: "Daphné 2026-05-18 #4 — source-leak class schedule",
    judgeRubric: {
      question:
        "Does the assistant answer the class-schedule question WITHOUT containing these exact internal-source phrases: 'selon le PDF interne', 'page publique', 'site public', 'deux versions', 'version contradictoire'? Naming the public booking PLATFORM (e.g. MyWellness widget, FLiiP, official PDF link) is FINE — those are public-facing tools, not internal sources.",
      expected: "yes",
    },
  },
  {
    id: "maa-8.5",
    label: "Pricing FR — never expose 'selon le PDF' or 'selon le site'",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "C'est combien l'abonnement mensuel?",
    forbidPatterns: [
      /selon\s+le\s+pdf/i,
      /selon\s+le\s+site/i,
      /page\s+publique/i,
      /pdf\s+printemps/i,
      /deux\s+versions/i,
    ],
    requireAnyPattern: [/225|\$|abonnement|mois|tarif/i],
    phase: 4,
    source: "Daphné 2026-05-18 #5 — source-leak pricing",
    judgeRubric: {
      question:
        "Does the assistant give the current pricing WITHOUT containing these exact internal-source phrases: 'selon le PDF', 'page publique', 'site public', 'deux versions'? Naming a CONTACT (e.g. Francis Bradette for details) is FINE — that is routing to a person, not a source leak.",
      expected: "yes",
    },
  },

  // — Premature callback scenarios (no callback mode until visitor accepts) ——
  {
    id: "maa-8.6",
    label: "Premature callback FR — bot offers handoff, must end with question, no callback mode",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Je voudrais en savoir plus sur l'abonnement corporatif",
    forbidFollowUpModes: ["callback", "vapi"],
    requirePatterns: [/\?/],
    phase: 4,
    source: "Daphné 2026-05-18 #6 — premature callback FR",
    judgeRubric: {
      question:
        "Does the assistant end its reply with a question to the visitor (e.g. 'Souhaitez-vous que je transmette votre demande?') WITHOUT having already auto-triggered the callback / lead form?",
      expected: "yes",
    },
  },
  {
    id: "maa-8.7",
    label: "Premature callback EN — bot offers handoff, must end with question, no callback mode",
    tenantCode: "maa",
    locale: "en-CA",
    userMessage: "I'd like to know more about your corporate membership options",
    forbidFollowUpModes: ["callback", "vapi"],
    requirePatterns: [/\?/],
    expectLanguage: "en",
    phase: 4,
    source: "Daphné 2026-05-18 #7 — premature callback EN",
    judgeRubric: {
      question:
        "Does the assistant end its reply with a question to the visitor (e.g. 'Would you like me to pass this along to our team?') WITHOUT having already auto-triggered the callback / lead form?",
      expected: "yes",
    },
  },

  // — Bilingual / language-switch scenarios ————————————————————————————————
  {
    id: "maa-8.8",
    label: "Language switch FR→EN — must follow switch, no French leak",
    tenantCode: "maa",
    locale: "en-CA",
    history: [
      { role: "user", content: "C'est combien l'abonnement?" },
      {
        role: "assistant",
        content:
          "L'abonnement individuel commence à 225 $/mois. Souhaitez-vous que je transmette votre demande à l'équipe?",
      },
    ],
    userMessage: "Actually can you continue in English please?",
    forbidPatterns: [
      /\béquipe\b/i,
      /\bvotre\b/i,
      /\bn['']h[ée]sitez\s+pas\b/i,
      /\babonnement\b/i,
      /\bcourriel\b/i,
      /\bsouhaitez[- ]vous\b/i,
    ],
    expectLanguage: "en",
    phase: 4,
    source: "Daphné 2026-05-18 #8 — language switch FR→EN",
    judgeRubric: {
      question:
        "Is the assistant's reply written ENTIRELY in English after the user explicitly asked to continue in English, with no French sentences or French words bleeding through?",
      expected: "yes",
    },
  },
  {
    id: "maa-8.9",
    label: "Language switch EN→FR — must follow switch, no English leak",
    tenantCode: "maa",
    locale: "fr-CA",
    history: [
      { role: "user", content: "How much is the membership?" },
      {
        role: "assistant",
        content:
          "Individual membership starts at $225/month. Would you like me to pass your request along to our team?",
      },
    ],
    userMessage: "En fait peux-tu continuer en français svp?",
    forbidPatterns: [
      /\bteam\b/i,
      /\byour\b/i,
      /\bwould\s+you\s+like\b/i,
      /\bmembership\b/i,
      /\bplease\b/i,
    ],
    expectLanguage: "fr",
    phase: 4,
    source: "Daphné 2026-05-18 #9 — language switch EN→FR",
    judgeRubric: {
      question:
        "Is the assistant's reply written ENTIRELY in French after the user explicitly asked to continue in French, with no English sentences or English words bleeding through?",
      expected: "yes",
    },
  },
  {
    id: "maa-8.10",
    label: "Bilingual mid-flow — user types in EN after FR thread, bot stays in EN",
    tenantCode: "maa",
    locale: "en-CA",
    history: [
      { role: "user", content: "Avez-vous une piscine?" },
      {
        role: "assistant",
        content:
          "Oui, le Club Sportif MAA dispose d'une piscine intérieure. Souhaitez-vous connaître les horaires?",
      },
    ],
    userMessage: "Yes please, what are the pool hours?",
    forbidPatterns: [
      /\béquipe\b/i,
      /\bvotre\b/i,
      /\bn['']h[ée]sitez\s+pas\b/i,
      /\bsouhaitez[- ]vous\b/i,
      /\bpiscine\b/i,
    ],
    expectLanguage: "en",
    phase: 4,
    source: "Daphné 2026-05-18 #10 — bilingual mid-flow EN reply",
    judgeRubric: {
      question:
        "Does the assistant switch to English after the user clearly switches, with no French words like 'piscine' / 'équipe' / 'votre' leaking into the English reply?",
      expected: "yes",
    },
  },

  // — Sales-quality scenarios (price objections — justify, don't apologize) ——
  {
    id: "maa-8.11",
    label: "Price objection FR 'c'est cher pour un gym' — justify value, don't apologize",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "225$/mois c'est cher pour un gym",
    forbidPatterns: [
      /\bc[''']?est\s+(?:trop\s+)?(?:cher|[ée]lev[ée])\b/i,
      /\bd[ée]sol[ée]\b/i,
      /\bje\s+comprends\s+que\s+c[''']?est\s+cher\b/i,
      /\bje\s+suis\s+navr[ée]\b/i,
    ],
    requireAnyPattern: [/piscine|spa|cours|restaurant|histoire|1881|squash|installations/i],
    phase: 4,
    source: "Daphné 2026-05-18 #11 — sales objection FR",
    judgeRubric: {
      question:
        "Does the assistant justify the $225/month price with concrete inclusions (pool, classes, spa, history, restaurant, squash, installations) WITHOUT apologizing, agreeing it's expensive, or sounding defensive?",
      expected: "yes",
    },
  },
  {
    id: "maa-8.12",
    label: "Price objection FR '225$ c'est trop' — value-frame, no apology",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "225$ c'est trop pour moi",
    forbidPatterns: [
      /\bc[''']?est\s+(?:trop\s+)?(?:cher|[ée]lev[ée])\b/i,
      /\bd[ée]sol[ée]\b/i,
      /\bje\s+comprends\s+que\s+c[''']?est\s+(?:cher|trop)\b/i,
    ],
    requireAnyPattern: [/piscine|spa|cours|restaurant|histoire|1881|squash|installations|inclus|équipe/i],
    phase: 4,
    source: "Daphné 2026-05-18 #12 — sales objection FR variant",
    judgeRubric: {
      question:
        "Does the assistant respond by framing what's INCLUDED for the price (pool, spa, classes, restaurant, history) or offering to connect with the team to discuss options, WITHOUT apologizing or agreeing the price is too high?",
      expected: "yes",
    },
  },
  {
    id: "maa-8.13",
    label: "Price objection EN 'why is it $225/month?' — justify with inclusions",
    tenantCode: "maa",
    locale: "en-CA",
    userMessage: "Why is it $225/month? That seems expensive.",
    forbidPatterns: [
      /\bsorry\b[^.!?]*\b(?:cost|price|expensive|high)\b/i,
      /\bi\s+understand\s+(?:it[''']s|that[''']s)\s+(?:expensive|costly|a lot)\b/i,
      /\byou\s+are\s+right\b[^.!?]*\bexpensive\b/i,
    ],
    requireAnyPattern: [/pool|spa|class|restaurant|history|1881|squash|amenit|include/i],
    expectLanguage: "en",
    phase: 4,
    source: "Daphné 2026-05-18 #13 — sales objection EN",
    judgeRubric: {
      question:
        "Does the assistant justify the $225/month price in English with concrete inclusions (pool, classes, spa, history, restaurant, squash, amenities) WITHOUT apologizing or agreeing it's expensive?",
      expected: "yes",
    },
  },

  // — Per-staff routing scenarios ——————————————————————————————————————————
  {
    id: "maa-8.14",
    label: "Restaurant reservation routing — must surface Le 1881",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Je voudrais réserver une table pour samedi soir",
    requireAnyPattern: [/1881|restaurant|réserv|table/i],
    phase: 4,
    source: "Daphné 2026-05-18 #14 — routing restaurant",
    judgeRubric: {
      question:
        "Does the assistant route the user toward the on-site restaurant Le 1881 (by naming it OR by offering to transmit the reservation request to the restaurant team), instead of generic membership / visit messaging?",
      expected: "yes",
    },
  },
  {
    id: "maa-8.15",
    label: "Back pain routing — must surface Clinique sportive, never diagnose",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "J'ai mal au dos depuis une semaine, qu'est-ce que je peux faire?",
    expectIntent: "clinical_pain",
    forbidPatterns: [
      /\bhernie\s+discale\b/i,
      /\bsciatique\b/i,
      /\blombalgie\b/i,
      /\btendinite\b/i,
      /\bdiscopathie\b/i,
      /\bnerf\s+sciatique\b/i,
      /\bid[ée]al/i,
    ],
    requireAnyPattern: [/clinique|physio|thérapie\s+sportive|équipe\s+clinique|orient|professionnel/i],
    phase: 4,
    source: "Daphné 2026-05-18 #15 — routing clinique sportive",
    judgeRubric: {
      question:
        "Does the assistant route the user toward the Clinique sportive / physiotherapy / sports-therapy team (by naming it OR offering to transmit the request) WITHOUT naming any medical diagnosis?",
      expected: "yes",
    },
  },
  {
    id: "maa-8.16",
    label: "Membership rates routing EN — must surface Francis Bradette / membership team",
    tenantCode: "maa",
    locale: "en-CA",
    userMessage: "What are your membership rates?",
    requireAnyPattern: [/francis|bradette|membership\s+(?:team|advisor|director)|225|\$\d|rate/i],
    expectLanguage: "en",
    phase: 4,
    source: "Daphné 2026-05-18 #16 — routing membership EN",
    judgeRubric: {
      question:
        "Does the assistant either share the membership rate ($225/month) plainly OR route the user toward the membership team / Francis Bradette by name, in English?",
      expected: "yes",
    },
  },

  // ────────────────────────────────────────────────────────────────────────
  // Phase 9 — Member-status protocol (Daphné 2026-05-18 ask)
  // Daphné: "le concierge demande si la personne est membre ou non, et
  // les réponses changent en fonction". These scenarios LOCK IN that:
  //   (a) For members-only activities, the bot asks once if the visitor is
  //       a member when it doesn't already know.
  //   (b) When the visitor has already declared they are a non-member, the
  //       bot DOES NOT promise access — it uses the templateNonMemberReply
  //       wording and routes to Francis Bradette.
  //   (c) When the visitor has declared they ARE a member, the bot answers
  //       the member-side detail directly without asking again.
  //   (d) For general questions (hours, address), the bot answers plainly
  //       without forcing a member-status question.
  // ────────────────────────────────────────────────────────────────────────
  {
    id: "maa-9.1",
    label: "Pickleball access — bot must ask member status when unknown (FR)",
    tenantCode: "maa",
    locale: "fr-CA",
    userMessage: "Je veux jouer au pickleball cette semaine.",
    // Bot must ask if the visitor is a member when unknown — single
    // clarifying question, no member-only access guarantee yet.
    requireAnyPattern: [/\b[êe]tes[- ]vous\s+(?:d[ée]j[àa]\s+)?membre\b/i, /\bmembre\s+du\s+(?:club|maa)\b.*\?/i, /\bd[ée]j[àa]\s+membre\b.*\?/i],
    forbidPatterns: [
      // Bot must NOT confirm access without knowing member status
      /\b(?:bien\s+s[uû]r|absolument)[,\s].*\b(?:r[ée]server|acc[èe]s|jouer)\b/i,
    ],
    forbidFollowUpModes: ["callback", "calendly", "vapi"],
    phase: 4,
    source: "Daphné 2026-05-18 — member-status protocol #1",
    judgeRubric: {
      question:
        "Before promising access or scheduling, does the assistant ask exactly once whether the visitor is already a Club member (or thinking about becoming one), in a warm/concise way?",
      expected: "yes",
    },
  },
  {
    id: "maa-9.2",
    label: "Non-member asking about classes — must use templateNonMemberReply + Francis",
    tenantCode: "maa",
    locale: "fr-CA",
    history: [
      { role: "user", content: "Je veux essayer un cours de yoga." },
      { role: "assistant", content: "Avec plaisir ! Êtes-vous déjà membre du Club, ou pensez-vous à le devenir ?" },
    ],
    userMessage: "Non je ne suis pas membre.",
    // Templated wording + Francis routing
    requireAnyPattern: [
      /francis\s+bradette|francis(?:\s+bradette)?|directeur\s+des\s+ventes/i,
      /options?\s+d['']?adh[ée]sion|abonnement|visite\s+du\s+club/i,
    ],
    forbidPatterns: [
      // The bot must NOT just register them for the class as if they were a member
      /\bvoici\s+(?:l['']?)?horaire\b.*yoga.*r[ée]server/i,
      /\bje\s+(?:vous\s+)?(?:r[ée]serve|inscris)\b/i,
    ],
    phase: 4,
    source: "Daphné 2026-05-18 — non-member template + Francis routing",
    judgeRubric: {
      question:
        "Does the assistant tactfully explain that group classes are tied to membership AND route to Francis Bradette OR offer a club visit, without bluntly refusing?",
      expected: "yes",
    },
  },
  {
    id: "maa-9.3",
    label: "Declared member — answer directly, do NOT re-ask member status",
    tenantCode: "maa",
    locale: "fr-CA",
    history: [
      { role: "user", content: "Je suis membre depuis 2 ans, à quelle heure ouvre la piscine ?" },
      { role: "assistant", content: "Voici les horaires actuels de la piscine : en semaine de 6h30 à 20h30, le week-end de 7h à 18h." },
    ],
    userMessage: "Et quand est-ce qu'il y a de la nage libre le lundi ?",
    // Must NOT re-ask member status — they declared in history turn 1
    forbidPatterns: [
      /\b[êe]tes[- ]vous\s+(?:d[ée]j[àa]\s+)?membre\b/i,
      /\bd[ée]j[àa]\s+membre\b.*\?/i,
    ],
    phase: 4,
    source: "Daphné 2026-05-18 — sticky member status across turns",
    judgeRubric: {
      question:
        "Does the assistant answer the open-swim question directly without asking again whether the visitor is a member (since they already said so in the prior turn)?",
      expected: "yes",
    },
  },
  {
    id: "maa-9.4",
    label: "Non-member status remembered — second question must use Francis routing",
    tenantCode: "maa",
    locale: "fr-CA",
    history: [
      { role: "user", content: "Bonjour, j'aimerais essayer le club." },
      { role: "assistant", content: "Avec plaisir ! Êtes-vous déjà membre, ou explorez-vous les options ?" },
      { role: "user", content: "Pas encore membre, je viens voir." },
      { role: "assistant", content: "Parfait — Francis Bradette peut vous présenter les options et planifier une visite. Que cherchez-vous d'abord ?" },
    ],
    userMessage: "Est-ce que je peux réserver un court de squash ?",
    // Visitor already declared non-member. Bot must NOT ask again.
    forbidPatterns: [
      /\b[êe]tes[- ]vous\s+(?:d[ée]j[àa]\s+)?membre\b/i,
      // Must NOT promise access without flagging the non-member constraint
      /\bbien\s+s[uû]r[,\s].*\br[ée]serv/i,
    ],
    requireAnyPattern: [
      /yvon|squash.*membre|membre.*squash|non[- ]?membre|francis|visite/i,
    ],
    phase: 4,
    source: "Daphné 2026-05-18 — non-member memory across turns",
    judgeRubric: {
      question:
        "Knowing the visitor is NOT a member from the prior turns, does the assistant acknowledge that squash access is tied to membership AND route to Francis Bradette / Yvon Provençal / a club visit, without re-asking member status?",
      expected: "yes",
    },
  },
];
