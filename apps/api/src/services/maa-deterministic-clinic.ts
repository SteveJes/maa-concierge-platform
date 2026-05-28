/**
 * Deterministic clinic-pricing answers for MAA (Daphné batch 8, 2026-05-28).
 *
 * WHY THIS EXISTS — Correctifs MAA 8 #3: massage prices were unstable across
 * turns (the bot gave 120/85, then 105/120, then the obsolete 25/55/85 grid in
 * three consecutive turns). Root cause: the LLM samples/mixes pricing from the
 * base sections + RAG chunks + override. The only reliable fix is to take the
 * LLM out of the loop for clinic pricing entirely: detect the service and return
 * the ONE authoritative answer, verbatim from the Apr 23 2026 clinic grid
 * (verified pixel-by-pixel against Horaires et tarifs clinique sportive MAA.pdf).
 *
 * Authoritative source of truth (NO member/guest split for massage — single flat
 * price per duration; the "120$ membre / 85$ invité" the bot invented does not
 * exist):
 *   Massage:  30min 65$ · 60min 120$ · 90min 170$ · 120min 230$
 *   Thérapie sportive: Geyson/Solis 1re 130$/suivi 115$ · Angie 1re 140$/suivi 125$
 *   Physio:   Demirakos éval 115$/suivi 95$ · Duchesne 1re 160$/suivi 155$ (PAS de taxes)
 *   Nutrition: Léa Daoura (naturo) 130$/85$ · Justine Doyon-Blondin (nutri) 140$/85$
 *   Soins infirmiers ITSS: combo 249/349/419$ · injections 95/150$ · prélèv/IV/fertilité/spermo: à confirmer
 */

export interface DeterministicClinicAnswer {
  assistantMessage: string;
  followUpMode: "done" | "clarify";
  usedCitations: number[];
  /** Which clinic service matched — used for lead routing + telemetry. */
  service: "massage" | "sports_therapy" | "physiotherapy" | "nutrition" | "nursing";
}

function isFr(locale: string | undefined): boolean {
  return !locale || locale.startsWith("fr");
}

/** Is the user asking about PRICE/COST (vs. just describing a service)? */
function asksPrice(m: string): boolean {
  return /(prix|tarif|tarification|co[uû]te?|combien|cost|price|pricing|how\s+much|fee|rate)/i.test(m);
}

/**
 * Detect the specific clinic service the user is asking the PRICE of.
 * High-precision: only fires when both a price-intent AND a clinic-service
 * keyword are present, so generic "tarifs" (abonnement) is not captured.
 * NOTE: no \b around accented words — \b mis-handles é/è without the u flag.
 */
export function tryAnswerClinicPricing(
  userMessage: string,
  locale: string | undefined,
): DeterministicClinicAnswer | null {
  const m = (userMessage ?? "").toLowerCase();
  if (!asksPrice(m)) return null;
  const fr = isFr(locale);

  // ── Massage ────────────────────────────────────────────────────────────────
  if (/(massage|massoth[eé]rapie)/i.test(m)) {
    return {
      service: "massage",
      followUpMode: "clarify",
      usedCitations: [],
      assistantMessage: fr
        ? "Pour la massothérapie au Club Sportif MAA, les tarifs (taxes en sus) sont les mêmes pour tous selon la durée : 30 minutes — 65 $, 60 minutes — 120 $, 90 minutes — 170 $, 120 minutes — 230 $. Plusieurs techniques sont offertes (suédois, Ashiatsu, thaï, tissus profonds). La réservation se fait via FLiiP (clubsportifmaa.fliipapp.com/user/register/buy_service/1) ou la clinique au 514 845-2233, poste 234. Un formulaire de santé est requis à la première visite; préavis de 24 h pour annuler sans frais."
        : "For massage therapy at Club Sportif MAA, rates (taxes extra) are the same for everyone by duration: 30 minutes — $65, 60 minutes — $120, 90 minutes — $170, 120 minutes — $230. Several techniques are offered (Swedish, Ashiatsu, Thai, deep tissue). Booking is via FLiiP (clubsportifmaa.fliipapp.com/user/register/buy_service/1) or the clinic at 514 845-2233, ext. 234. A health form is required on the first visit; 24 h notice to cancel free of charge.",
    };
  }

  // ── Sports therapy ───────────────────────────────────────────────────────────
  if (/(th[eé]rapie\s+sportive|sport\s+therap|kin[eé]si)/i.test(m)) {
    return {
      service: "sports_therapy",
      followUpMode: "clarify",
      usedCitations: [],
      assistantMessage: fr
        ? "Pour la thérapie sportive (tarifs en vigueur, taxes en sus) : avec Kevin Geyson ou Daniela Solis — première visite 60 min à 130 $, suivi 60 min à 115 $. Avec Angie West — première visite 55 min à 140 $, suivi 50 min à 125 $. Les disponibilités ne sont pas publiées : la prise de rendez-vous se fait par thérapeute via la page thérapie sportive ou la clinique au 514 845-2233, poste 234."
        : "For sports therapy (current rates, taxes extra): with Kevin Geyson or Daniela Solis — first visit 60 min at $130, follow-up 60 min at $115. With Angie West — first visit 55 min at $140, follow-up 50 min at $125. Availability isn't published: booking is per therapist via the sports-therapy page or the clinic at 514 845-2233, ext. 234.",
    };
  }

  // ── Physiotherapy ────────────────────────────────────────────────────────────
  if (/(physio|physioth[eé]rapie|physiotherap)/i.test(m)) {
    return {
      service: "physiotherapy",
      followUpMode: "clarify",
      usedCitations: [],
      assistantMessage: fr
        ? "Pour la physiothérapie (tarifs variables selon le praticien, physiothérapie exemptée de taxes) : avec George Demirakos — évaluation 60 min à 115 $, suivi 30 min à 95 $. Avec Isabelle Duchesne (experte du haut du corps) — première visite 55 min à 160 $, suivi 45 min à 155 $. Les disponibilités ne sont pas publiées : rendez-vous via la page physiothérapie ou la clinique au 514 845-2233, poste 234."
        : "For physiotherapy (rates vary by practitioner; physio is tax-exempt): with George Demirakos — evaluation 60 min at $115, follow-up 30 min at $95. With Isabelle Duchesne (upper-body specialist) — first visit 55 min at $160, follow-up 45 min at $155. Availability isn't published: book via the physiotherapy page or the clinic at 514 845-2233, ext. 234.",
    };
  }

  // ── Nutrition ────────────────────────────────────────────────────────────────
  if (/(nutrition|nutritionniste|naturopath|di[eé]t[eé]ti)/i.test(m)) {
    return {
      service: "nutrition",
      followUpMode: "clarify",
      usedCitations: [],
      assistantMessage: fr
        ? "Pour la nutrition (taxes en sus) : avec la naturopathe Léa Daoura — évaluation initiale en clinique 130 $, suivi 85 $. Avec la nutritionniste Justine Doyon-Blondin — évaluation nutritionnelle 140 $, suivi 85 $. La prise de rendez-vous se fait via la page nutrition ou la clinique au 514 845-2233, poste 234."
        : "For nutrition (taxes extra): with naturopath Léa Daoura — initial in-clinic assessment $130, follow-up $85. With dietitian Justine Doyon-Blondin — nutrition assessment $140, follow-up $85. Booking is via the nutrition page or the clinic at 514 845-2233, ext. 234.",
    };
  }

  // ── Nursing / Mobile Mediq (ITSS, injections) ────────────────────────────────
  if (/(d[eé]pistage|itss|injection|pr[eé]l[eè]vement|spermogramme|profil\s+fertilit|soins?\s+infirmiers?|mobile\s+mediq)/i.test(m)) {
    return {
      service: "nursing",
      followUpMode: "clarify",
      usedCitations: [],
      assistantMessage: fr
        ? "Les soins infirmiers sont offerts via le partenaire Mobile Mediq (514 543-2121). Dépistage ITSS : Combo 1 (gonorrhée, chlamydia) 249 $; Combo 2 (+ syphilis, hépatite B, VIH) 349 $; Combo 3 (+ hépatite C) 419 $. Injections : 95 $ (intramusculaire ou sous-cutanée) ou 150 $ avec livraison de la médication. Pour les prélèvements, IV, profil de fertilité et spermogramme, les prix ne sont pas publiés — à confirmer via la plateforme Mobile Mediq (mmqclientweb.azurewebsites.net/form/maa)."
        : "Nursing care is offered via partner Mobile Mediq (514 543-2121). STI screening: Combo 1 (gonorrhea, chlamydia) $249; Combo 2 (+ syphilis, hepatitis B, HIV) $349; Combo 3 (+ hepatitis C) $419. Injections: $95 (intramuscular or subcutaneous) or $150 with medication delivery. For blood draws, IV, fertility profile and spermogram, prices aren't published — to be confirmed via the Mobile Mediq platform (mmqclientweb.azurewebsites.net/form/maa).",
    };
  }

  return null;
}
