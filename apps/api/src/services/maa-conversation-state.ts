/**
 * MAA conversation-state machine (Daphné batch 8, 2026-05-28).
 *
 * WHY: Correctifs MAA 8 #1/#7 — the bot loses the active subject across turns
 * ("oui" after triathlon → restaurant callback; "horaire cours en groupe" →
 * pickleball; pickleball → abonnement tarifs). The root cause is that there was
 * no explicit notion of an ACTIVE SERVICE + ACTIVE DEPARTMENT carried turn to
 * turn. This module resolves that deterministically from the conversation so
 * the prompt + lead routing can lock onto it.
 *
 * It does NOT call the LLM. It walks the history (most-recent-first) and the
 * current message to decide: what service are we on, which department owns it,
 * and what the bot last OFFERED (so a bare "oui" executes that, not a generic
 * fallback).
 */

export type MaaDepartment =
  | "nathalie_lambert"      // sports programming: pickleball, basketball, classes, pool, cirque, triathlon, powerwatts, run club
  | "clinique_sportive"     // massage, physio, sports therapy, nutrition, osteo, medical
  | "mobile_mediq"          // nursing
  | "restaurant_1881"       // restaurant
  | "francis_bradette"      // membership, visits, personal training (sales)
  | "elisabeth_boutin"      // pilates reformer
  | "yvon_provencal"        // squash
  | "valerie_de_vigne"      // boutique
  | "reception_poste_0";    // general / affiliated clubs

export interface MaaServiceDef {
  service: string;
  department: MaaDepartment;
  /** Substring patterns (no \b — accents break \b without the u flag). */
  re: RegExp;
  /** Visit CTA ("Planifier une visite") is only valid for membership/visit intent. */
  allowsVisitCta?: boolean;
}

/**
 * Service registry — ordered most-specific → most-general so the first match
 * wins. Each entry binds a service to the department that owns its leads.
 */
export const MAA_SERVICE_REGISTRY: MaaServiceDef[] = [
  { service: "pickleball", department: "nathalie_lambert", re: /pickleball|pickle.?ball|pickelball|pickball/i },
  { service: "basketball", department: "nathalie_lambert", re: /basketball|basket\b/i },
  { service: "powerwatts", department: "nathalie_lambert", re: /powerwatts|power.?watts/i },
  { service: "cirque_aerien", department: "nathalie_lambert", re: /cirque|aerial\s+circus/i },
  { service: "triathlon", department: "nathalie_lambert", re: /triathlon|\bftp\b|\bvam\b/i },
  { service: "club_de_course", department: "nathalie_lambert", re: /club\s+de\s+course|run(?:ning)?\s+club|course\s+à\s+pied/i },
  { service: "natation", department: "nathalie_lambert", re: /natation|nage\s+libre|aqua.?hiit|programmes?\s+aquatiques?|aquatic|piscine|swim|pool/i },
  { service: "pilates_reformer", department: "elisabeth_boutin", re: /pilates\s+(?:sur\s+appareils|reformer)|reformer|pilates\s+priv|appareils?\s+de\s+pilates/i },
  { service: "cours_en_groupe", department: "nathalie_lambert", re: /cours\s+(?:en\s+|de\s+)?groupe|group\s+class|mywellness|yoga|spinning|hiit|bootcamp|cardio\s+danse|essentrics|barre|boxe.?fit|zumba/i },
  { service: "squash", department: "yvon_provencal", re: /squash/i },
  { service: "massage", department: "clinique_sportive", re: /massage|massoth[eé]rapie/i },
  { service: "physiotherapie", department: "clinique_sportive", re: /physio|physioth[eé]rapie|physiotherap/i },
  { service: "therapie_sportive", department: "clinique_sportive", re: /th[eé]rapie\s+sportive|sport\s+therap|kin[eé]si/i },
  { service: "nutrition", department: "clinique_sportive", re: /nutrition|nutritionniste|naturopath|di[eé]t[eé]ti/i },
  { service: "services_medicaux", department: "clinique_sportive", re: /m[eé]decin|m[eé]decine|doctor|services?\s+m[eé]dic|medical\s+service|endom[eé]triose|hormono/i },
  { service: "soins_infirmiers", department: "mobile_mediq", re: /soins?\s+infirmiers?|infirmi[eè]re|mobile\s+mediq|d[eé]pistage|itss|injection|pr[eé]l[eè]vement|spermogramme/i },
  { service: "spa", department: "clinique_sportive", re: /\bspa\b|sauna|hammam|bain\s+(?:vapeur|tourbillon|à\s+remous)/i },
  { service: "restaurant", department: "restaurant_1881", re: /restaurant|le\s+1881|resto|menu|table|d[eé]jeuner|brunch|commander\s+en\s+ligne/i },
  { service: "entrainement_personnel", department: "francis_bradette", re: /entra[iî]nement\s+(?:personnel|priv[eé]|en\s+duo)|personal\s+training|entra[iî]neur\s+priv/i },
  { service: "salles_entrainement", department: "francis_bradette", re: /salles?\s+d['e]?entra[iî]nement|gym\s+access|training\s+room|musculation/i },
  { service: "boutique", department: "valerie_de_vigne", re: /boutique|pro\s+shop|merch|v[eê]tements?\s+(?:du\s+club|maa)/i },
  { service: "clubs_affilies", department: "reception_poste_0", re: /clubs?\s+affili|reciprocal|r[eé]ciproque|club\s+partenaire/i },
  { service: "abonnement", department: "francis_bradette", re: /abonnement|adh[eé]sion|membership|devenir\s+membre|m['e]?abonner/i, allowsVisitCta: true },
  { service: "visite", department: "francis_bradette", re: /planifier\s+une\s+visite|visite\s+du\s+club|tour\s+of\s+the\s+club|book\s+a\s+visit|d[eé]couvrir\s+le\s+club/i, allowsVisitCta: true },
];

const DEPARTMENT_LABEL: Record<MaaDepartment, { name: string; label: string }> = {
  nathalie_lambert: { name: "Nathalie Lambert", label: "Programmation sportive" },
  clinique_sportive: { name: "Clinique sportive MAA", label: "Clinique sportive" },
  mobile_mediq: { name: "Mobile Mediq", label: "Soins infirmiers (partenaire)" },
  restaurant_1881: { name: "Restaurant Le 1881", label: "Restaurant" },
  francis_bradette: { name: "Francis Bradette", label: "Abonnements / visites" },
  elisabeth_boutin: { name: "Elisabeth Boutin", label: "Espace Pilates" },
  yvon_provencal: { name: "Yvon Provençal", label: "Squash" },
  valerie_de_vigne: { name: "Valérie De Vigne", label: "Boutique" },
  reception_poste_0: { name: "Réception", label: "Réception" },
};

export interface MaaActiveContext {
  activeService: string | null;
  activeDepartment: MaaDepartment | null;
  departmentName: string | null;
  departmentLabel: string | null;
  /** True when the current user message names no service (bare follow-up). */
  currentMessageIsBareFollowUp: boolean;
  /** True when the current message DOES name a (possibly new) service. */
  currentMessageNamesService: boolean;
  /** True when the visit CTA is appropriate (membership/visite, OR a non-member on a member-only service). */
  allowsVisitCta: boolean;
}

const BARE_FOLLOWUP_RE =
  /^(?:\s*(?:oui|ouais|ouip|yes|yep|ok|okay|sure|d['']?accord|daccord|parfait|vas[- ]?y|allez[- ]?y|go\s+ahead|svp|s['']?il\s+vous\s+pla[iî]t|please|merci|thanks|c['']?est\s+(?:bien\s+)?(?:ça|ca|bon)|exact|correct)\s*[.!?]*\s*)+$/i;

const BARE_TOPIC_QUERY_RE =
  /^(?:\s*(?:et\s+)?(?:c['']?est\s+quoi\s+)?(?:les?\s+)?(?:tarifs?|prix|co[uû]ts?|horaires?|heures?|disponibilit[eé]s?|availabilit|prices?|cost|hours?|schedule)\b[^.!?]*)$|^(?:\s*comment\s+(?:r[eé]server|réserver|m['e]?inscrire|book|reserve)\b[^.!?]*)$|^(?:\s*qui\s+(?:je\s+)?(?:dois\s+)?contact[^.!?]*)$/i;

/** Find the service named in a single text fragment, if any. */
export function detectService(text: string): MaaServiceDef | null {
  const t = text ?? "";
  for (const def of MAA_SERVICE_REGISTRY) {
    if (def.re.test(t)) return def;
  }
  return null;
}

/**
 * Services that are reserved to members. For a declared NON-MEMBER, leads on
 * these must route to Francis Bradette (membership/visite) — NOT the program
 * owner — because the visitor must JOIN before they can use the service. This
 * matches Daphné's transcript (rows 40-42: non-member natation/pickleball →
 * Francis Bradette, "options d'adhésion ou une visite").
 */
const MEMBER_RESTRICTED = new Set<string>([
  "pickleball", "basketball", "powerwatts", "cirque_aerien", "triathlon",
  "club_de_course", "natation", "cours_en_groupe", "squash", "salles_entrainement",
]);

const NON_MEMBER_RE =
  /\b(?:je\s+ne\s+suis\s+pas\s+(?:encore\s+)?membre|pas\s+(?:encore\s+)?membre|non[- ]membre|sans\s+(?:être\s+)?abonnement|i['']?m\s+not\s+a\s+member|not\s+(?:yet\s+)?a\s+member|non[- ]member)\b/i;
const MEMBER_DECLARED_RE =
  /\b(?:je\s+suis\s+(?:déjà\s+|bien\s+)?membre|oui\s+je\s+suis\s+membre|mon\s+abonnement|en\s+tant\s+que\s+membre|i['']?m\s+a\s+member|my\s+membership)\b/i;

export type MembershipStance = "member" | "non_member" | "unknown";

/** Scan current + history (most-recent-first) for an explicit membership stance. */
export function detectMembershipStance(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  currentUserMessage: string,
): MembershipStance {
  const turns = [currentUserMessage ?? "", ...history.filter((t) => t.role === "user").map((t) => t.content).reverse()];
  for (const t of turns) {
    if (MEMBER_DECLARED_RE.test(t)) return "member";
    if (NON_MEMBER_RE.test(t)) return "non_member";
  }
  return "unknown";
}

/**
 * Resolve the active conversation context. Walks the history most-recent-first
 * to find the active service; if the current message names a service, that wins
 * (topic switch). If it's a bare follow-up, we keep the prior service.
 */
export function resolveActiveContext(
  history: Array<{ role: "user" | "assistant"; content: string }>,
  currentUserMessage: string,
): MaaActiveContext {
  const trimmed = (currentUserMessage ?? "").trim();
  const currentService = detectService(trimmed);
  const isBare =
    BARE_FOLLOWUP_RE.test(trimmed) ||
    (BARE_TOPIC_QUERY_RE.test(trimmed) && !currentService);

  let active: MaaServiceDef | null = currentService;

  // Bare follow-up OR no service in current message → look back through history.
  // PRIORITY: the USER's stated intent is the source of truth. Walk USER turns
  // first (most-recent-first) — the bot's own replies often mention several
  // services ("abonnement", "1881", etc.) and would otherwise hijack the active
  // service. Only fall back to assistant turns if no user turn named a service.
  if (!active || isBare) {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i]!.role !== "user") continue;
      const found = detectService(history[i]!.content);
      if (found) { active = found; break; }
    }
    if (!active) {
      for (let i = history.length - 1; i >= 0; i--) {
        if (history[i]!.role !== "assistant") continue;
        const found = detectService(history[i]!.content);
        if (found) { active = found; break; }
      }
    }
  }

  if (!active) {
    return {
      activeService: null,
      activeDepartment: null,
      departmentName: null,
      departmentLabel: null,
      currentMessageIsBareFollowUp: isBare,
      currentMessageNamesService: currentService !== null,
      allowsVisitCta: false,
    };
  }

  // Non-member asking about a member-only service → route leads to Francis
  // Bradette (membership/visite), not the program owner. The visitor must join
  // first, so the visit CTA is appropriate here. Daphné transcript rows 40-42.
  let effectiveDepartment = active.department;
  let allowsVisitCta = active.allowsVisitCta === true;
  if (MEMBER_RESTRICTED.has(active.service) && detectMembershipStance(history, trimmed) === "non_member") {
    effectiveDepartment = "francis_bradette";
    allowsVisitCta = true;
  }

  const dept = DEPARTMENT_LABEL[effectiveDepartment];
  return {
    activeService: active.service,
    activeDepartment: effectiveDepartment,
    departmentName: dept.name,
    departmentLabel: dept.label,
    currentMessageIsBareFollowUp: isBare,
    currentMessageNamesService: currentService !== null,
    allowsVisitCta,
  };
}

/**
 * Daphné batch 8 #1 — DETERMINISTIC answer for "tarifs?" when the active service
 * is a sport INCLUDED in the membership (pickleball, basketball, group classes,
 * run club). The LLM kept dumping the full abonnement grid here; this takes it
 * out of the loop. Returns null when not applicable.
 */
const INCLUDED_IN_MEMBERSHIP = new Set([
  "pickleball", "basketball", "cours_en_groupe", "club_de_course", "salles_entrainement",
]);

export function tryAnswerIncludedServicePricing(
  ctx: MaaActiveContext,
  currentUserMessage: string,
  locale: string | undefined,
): { assistantMessage: string; followUpMode: "clarify" } | null {
  if (!ctx.activeService || !INCLUDED_IN_MEMBERSHIP.has(ctx.activeService)) return null;
  // Only when the message is a bare price question (no new service named).
  const m = (currentUserMessage ?? "").toLowerCase();
  const asksPrice = /(tarif|prix|co[uû]te?|combien|cost|price|how\s+much)/i.test(m);
  if (!asksPrice || ctx.currentMessageNamesService) return null;

  const fr = !locale || locale.startsWith("fr");
  const label: Record<string, { fr: string; en: string }> = {
    pickleball: { fr: "Le pickleball", en: "Pickleball" },
    basketball: { fr: "Le basketball", en: "Basketball" },
    cours_en_groupe: { fr: "Les cours en groupe", en: "Group classes" },
    club_de_course: { fr: "Le club de course", en: "The run club" },
    salles_entrainement: { fr: "L'accès aux salles d'entraînement", en: "Training-room access" },
  };
  const svcLabel = label[ctx.activeService]!;
  return {
    followUpMode: "clarify",
    assistantMessage: fr
      ? `${svcLabel.fr} est inclus dans l'abonnement annuel — il n'y a pas de tarif séparé pour cette activité. Pour les détails d'accès ou de réservation, ${ctx.departmentName ?? "Nathalie Lambert"} est la personne-ressource. Souhaitez-vous ses coordonnées ?`
      : `${svcLabel.en} is included with the annual membership — there's no separate fee for it. For access or booking details, ${ctx.departmentName ?? "Nathalie Lambert"} is the right contact. Would you like their details?`,
  };
}

/**
 * Build the hard prompt directive that locks the LLM onto the active context.
 * Injected into the system prompt's extra-context block.
 */
export function buildActiveContextDirective(ctx: MaaActiveContext, locale: string | undefined): string | undefined {
  if (!ctx.activeService || !ctx.activeDepartment) return undefined;
  const fr = !locale || locale.startsWith("fr");
  const svc = ctx.activeService;
  const deptName = ctx.departmentName;

  // Visit CTA is allowed for membership/visite intent, AND when a non-member
  // asks about a member-only service (joining is the path forward).
  const visitAllowed = ctx.allowsVisitCta;

  const lines: string[] = [];
  lines.push(
    fr
      ? `CONTEXTE ACTIF (verrou de conversation — batch 8). Le sujet actif est **${svc}**, géré par **${deptName}**.`
      : `ACTIVE CONTEXT (conversation lock — batch 8). The active subject is **${svc}**, owned by **${deptName}**.`,
  );
  if (ctx.currentMessageIsBareFollowUp) {
    lines.push(
      fr
        ? `Le message actuel est une réponse courte ou une question relative ("oui", "les tarifs", "disponibilités", "comment réserver", etc.). Tu DOIS la traiter dans le contexte de **${svc}** et NON revenir à un autre service ni au grille d'abonnement. Si l'utilisateur dit "oui" à une proposition, exécute exactement l'action proposée au tour précédent.`
        : `The current message is a short reply or relative question ("yes", "the prices", "availability", "how to book", etc.). You MUST handle it in the context of **${svc}** and NOT switch to another service or the membership grid. If the user says "yes" to an offer, execute exactly the action offered on the previous turn.`,
    );
  }
  if (!visitAllowed) {
    lines.push(
      fr
        ? `Le bouton/CTA "Planifier une visite" est INTERDIT pour ${svc} — propose plutôt l'action propre au service (réserver, appeler ${deptName}, envoyer le lien, etc.).`
        : `The "Schedule a visit/tour" CTA is FORBIDDEN for ${svc} — propose the service-specific action instead (book, call ${deptName}, send the link, etc.).`,
    );
  }
  lines.push(
    fr
      ? `Toute capture de lead pour ce sujet doit être routée vers **${deptName}**, jamais vers un autre département.`
      : `Any lead capture for this subject must route to **${deptName}**, never another department.`,
  );
  return lines.join(" ");
}
