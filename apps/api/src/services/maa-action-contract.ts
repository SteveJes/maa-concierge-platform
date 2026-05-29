/**
 * MAA ActionContract — deterministic "send the link" execution (Daphné batch 8 #5).
 *
 * WHY: Daphné's Correctifs MAA 8 #5 ("Liens ou plateformes pas assez exécutés").
 * The bot offered to send a booking/platform link ("Souhaitez-vous que je vous
 * envoie le lien direct vers la plateforme de réservation ?"). The user said
 * "oui" — and the bot asked for callback coordinates instead of sending the
 * link (transcript rows 18→19). The LLM-rewrite approach (resolveShortAffirmative
 * FollowUp) still drifted ~30% of runs because the link offer didn't name a
 * platform keyword it could bind to.
 *
 * This module takes the LLM out of that loop. When the active service has a
 * canonical actionable link AND either (a) the user just asked for the
 * link/platform, or (b) the user said a short "oui" right after the bot offered
 * one, we emit the exact link deterministically — no callback-coordinate detour.
 *
 * It does NOT call the LLM. Returns null when it doesn't apply, so all other
 * handlers/paths are untouched.
 */
import type { MaaActiveContext } from "./maa-conversation-state.js";

interface ServiceLink {
  fr: string;
  en: string;
  url: string;
}

/**
 * Active service → its ONE canonical actionable link (booking/platform/info).
 * URLs verified against apps/api/src/knowledge/maa-v2/links.json. Only services
 * with a confident, action-oriented URL are listed — anything else returns null
 * so we never emit a wrong/guessed link.
 */
const SERVICE_LINK: Record<string, ServiceLink> = {
  massage: {
    fr: "Massothérapie — réservation en ligne (FLiiP)",
    en: "Massage therapy — online booking (FLiiP)",
    url: "https://clubsportifmaa.fliipapp.com/user/register/buy_service/1",
  },
  therapie_sportive: {
    fr: "Thérapie sportive — page de réservation",
    en: "Sports therapy — booking page",
    url: "https://www.clubsportifmaa.com/fr/therapie-sportive/",
  },
  nutrition: {
    fr: "Nutrition — page de prise de rendez-vous",
    en: "Nutrition — appointment page",
    url: "https://www.clubsportifmaa.com/fr/nutrition/",
  },
  pilates_reformer: {
    fr: "Pilates Reformer — achat / réservation (FLiiP)",
    en: "Pilates Reformer — purchase / booking (FLiiP)",
    url: "https://clubsportifmaa.fliipapp.com/user/register/buy_product/1#",
  },
  cours_en_groupe: {
    fr: "Horaire MyWellness — cours en temps réel",
    en: "MyWellness schedule — real-time classes",
    url: "https://widgets.mywellness.com/facility/ac1088953",
  },
  natation: {
    fr: "Natation adulte — informations et inscription",
    en: "Adult swimming — info and registration",
    url: "https://www.clubsportifmaa.com/fr/cours/cours-de-natation-pour-adultes/",
  },
  soins_infirmiers: {
    fr: "Soins infirmiers Mobile Mediq — demande de rendez-vous",
    en: "Mobile Mediq nursing — appointment request",
    url: "https://mmqclientweb.azurewebsites.net/form/maa?culture=fr-CA",
  },
  services_medicaux: {
    fr: "Services médicaux — prise de rendez-vous (Wellcenter)",
    en: "Medical services — appointments (Wellcenter)",
    url: "https://wellcenter.ca/appointments",
  },
  entrainement_personnel: {
    fr: "Entraînement personnel — réservation (FLiiP)",
    en: "Personal training — booking (FLiiP)",
    url: "https://clubsportifmaa.fliipapp.com/user/register/buy_service/1",
  },
};

/** Restaurant resolves to one of two links depending on order vs. reserve. */
const RESTAURANT_ORDER: ServiceLink = {
  fr: "Restaurant Le 1881 — commande en ligne",
  en: "Restaurant Le 1881 — order online",
  url: "https://clubsportifmaa.clusterpos.com/menu",
};
const RESTAURANT_RESERVE: ServiceLink = {
  fr: "Restaurant Le 1881 — réservation (Libro)",
  en: "Restaurant Le 1881 — reservation (Libro)",
  url: "https://booking.libroreserve.com/2599e556a189b49/QC016934055076/seat",
};

const SHORT_AFFIRMATIVE_RE =
  /^(?:\s*(?:oui|ouais|ouip|yes|yep|yeah|ok|okay|sure|d['']?accord|daccord|parfait|vas[- ]?y|allez[- ]?y|go(?:\s+ahead)?|svp|s['']?il\s+vous\s+pla[iî]t|please|carr[eé]ment|absolument|exact|correct)\b[\s.!?,]*)+$/i;

/**
 * User explicitly asks for the link / platform (even with extra words).
 * Deliberately narrow: a bare "accès/access" mention ("est-ce que le massage
 * donne accès au spa ?") must NOT trigger a booking link. We require an explicit
 * link/platform/url word, or the specific phrase "accéder à la plateforme".
 */
const ASKS_FOR_LINK_RE =
  /\b(lien|liens|link|links|plateforme|platform|url|page\s+(?:de\s+)?(?:r[eé]servation|booking))\b|acc[eé]der\s+(?:à|a|au)\s+(?:la\s+plateforme|booking|site|lien)/i;

/** Last assistant turn offered to send/give a link or platform access. */
const OFFERED_LINK_RE =
  /\b(envoie|envoyer|envoyé|donner?|partager?|fournir|transmettre|acc[eé]der\s+(?:à|a)\s+la\s+plateforme|lien\s+(?:direct|vers)|le\s+lien|the\s+link|send\s+you\s+the\s+link|booking\s+link|platform)\b/i;

/** Last assistant turn already DELIVERED a known booking/platform URL. */
const DELIVERED_LINK_RE =
  /(fliipapp|widgets\.mywellness\.com|booking\.libroreserve\.com|clusterpos\.com|mmqclientweb|wellcenter\.ca|clubsportifmaa\.com\/fr\/)/i;

/**
 * Try to answer with a deterministic link for the active service.
 * Returns null unless: (active service has a canonical link) AND
 * (user asked for the link OR said a short "oui" right after a link offer).
 */
export function tryAnswerSendLink(
  ctx: MaaActiveContext,
  currentUserMessage: string,
  lastAssistantText: string,
  locale: string | undefined,
): { assistantMessage: string; followUpMode: "clarify" } | null {
  if (!ctx.activeService) return null;

  const msg = (currentUserMessage ?? "").trim();
  const last = lastAssistantText ?? "";

  const userAsksForLink = ASKS_FOR_LINK_RE.test(msg);
  const isShortYes = SHORT_AFFIRMATIVE_RE.test(msg);
  const lastOfferedLink = OFFERED_LINK_RE.test(last) && /\?/.test(last);
  const lastDeliveredLink = DELIVERED_LINK_RE.test(last);
  const fr = !locale || locale.startsWith("fr");

  const link = resolveLink(ctx.activeService, msg, last);

  // Case A — deliver the link: user asked for it, or said "oui" to a link offer.
  if (link && (userAsksForLink || (isShortYes && lastOfferedLink))) {
    const label = fr ? link.fr : link.en;
    return {
      followUpMode: "clarify",
      assistantMessage: fr
        ? `Avec plaisir — voici le lien : [${label}](${link.url}). Vous pouvez réserver directement en ligne. Si vous préférez, ${ctx.departmentName ?? "notre équipe"} peut aussi vous accompagner par téléphone.`
        : `Of course — here is the link: [${label}](${link.url}). You can book directly online. If you'd rather, ${ctx.departmentName ?? "our team"} can also help you over the phone.`,
    };
  }

  // Case B — "oui" right AFTER a link was already delivered. Do NOT regress to
  // asking for callback coordinates (Daphné #5). Confirm the next step instead.
  if (isShortYes && lastDeliveredLink) {
    return {
      followUpMode: "clarify",
      assistantMessage: fr
        ? `Parfait — le lien ci-dessus vous mène directement à la réservation. Si une étape vous bloque, ${ctx.departmentName ?? "notre équipe"} peut finaliser le rendez-vous avec vous.`
        : `Perfect — the link above takes you straight to booking. If any step blocks you, ${ctx.departmentName ?? "our team"} can finalize the appointment with you.`,
    };
  }

  return null;
}

function resolveLink(service: string, msg: string, last: string): ServiceLink | null {
  if (service === "restaurant") {
    const wantsOrder = /\b(command|order|en\s+ligne|menu|emporter|take\s*out|livraison|delivery)\b/i.test(`${msg} ${last}`);
    const wantsReserve = /\b(r[eé]serv|reserve|table|booking|libro)\b/i.test(`${msg} ${last}`);
    if (wantsOrder && !wantsReserve) return RESTAURANT_ORDER;
    if (wantsReserve) return RESTAURANT_RESERVE;
    return RESTAURANT_ORDER;
  }
  return SERVICE_LINK[service] ?? null;
}
