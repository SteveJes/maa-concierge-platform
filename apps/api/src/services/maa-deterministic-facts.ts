/**
 * MAA deterministic confirmed-fact answers (2026-05-29).
 *
 * WHY: two flows stayed LLM-flaky after batch 8 because the model either hedged
 * on a CONFIRMED fact or failed to emit a link:
 *   - buanderie: price is a confirmed 25 $/mois (abonnement.json extras), but the
 *     LLM kept appending a "validez au 514 845-2233" trailer instead of stating it.
 *   - restaurant menu: the LLM sometimes recited dish names/prices (hallucination
 *     risk) and sometimes forgot the link. Daphné's principle is "liens = boutons
 *     cliquables", not improvised menus.
 *
 * These return the ONE authoritative answer with the canonical links — no LLM,
 * no hedge, no invented dishes. Return null when not applicable.
 */

function isFr(locale: string | undefined): boolean {
  return !locale || locale.startsWith("fr");
}

/** "avez-vous un service de buanderie ?" / "combien coûte la buanderie ?" */
export function tryAnswerLaundry(
  userMessage: string,
  locale: string | undefined,
): { assistantMessage: string; followUpMode: "clarify" } | null {
  const m = userMessage ?? "";
  if (!/\b(buanderie|laundry|lavage\s+(?:de\s+)?(?:linge|v[eê]tements?))\b/i.test(m)) return null;

  return {
    followUpMode: "clarify",
    assistantMessage: isFr(locale)
      ? "Oui — le Club Sportif MAA offre un service de buanderie à 25 $/mois (taxes en sus). Souhaitez-vous que je vous oriente vers la réception pour l'ajouter à votre abonnement ?"
      : "Yes — Club Sportif MAA offers a laundry service at $25/month (plus tax). Would you like me to point you to the front desk to add it to your membership?",
  };
}

/**
 * Restaurant menu requests → always deliver LINKS (never a wall of dishes, never
 * an "I'll email it to you" false promise). Daphné Review p.37: she praised the
 * link-based menu answer. Fires on any menu/carte/pdf request in restaurant
 * context, including specific menus ("menu du midi", "menu principal"), a
 * "version pdf" follow-up, or an email-delivery request (which we honestly
 * decline — the concierge cannot email, it shares the link in chat).
 */
export function tryAnswerRestaurantMenu(
  userMessage: string,
  activeService: string | null,
  locale: string | undefined,
): { assistantMessage: string; followUpMode: "clarify" } | null {
  const m = userMessage ?? "";
  const restaurantContext =
    activeService === "restaurant" || /\b(restaurant|le\s+1881|resto|1881)\b/i.test(m);
  if (!restaurantContext) return null;

  const mentionsMenu = /\bmenus?\b|carte\s+des\s+vins|version\s+pdf/i.test(m);
  // A request to see/receive/select the menu — verbs, delivery words, or a
  // specific menu name. Excludes pure musings ("le menu change-t-il souvent ?").
  const isRequest =
    /\b(envoyer?|envoie|envoyez|montre[rz]?|voir|consulter|avoir|donne[rz]?|partage[rz]?|acc[eé]der|recevoir|c['']?est\s+quoi|quel|aimerais|veux|voudrais|svp|s['']?il\s+vous\s+pla[iî]t|please|send|show|see|view)\b/i.test(m) ||
    /\b(pdf|courriel|e[- ]?mail|email|version)\b/i.test(m) ||
    /\b(midi|d[eî]ner|d[eé]jeuner|principal|soir|souper|vins)\b/i.test(m) ||
    /\ble\s+menu\b/i.test(m);
  // In restaurant context, an email/PDF delivery request (e.g. "oui par email à
  // X svp", "envoyez-le moi par courriel") is almost always about the menu —
  // the restaurant's only deliverable. Fire even without the word "menu" so the
  // LLM can't invent an email address or claim it will email the document.
  const restaurantDeliveryRequest =
    /\b(?:par\s+(?:e[- ]?mail|email|courriel)|version\s+pdf|le\s+pdf)\b/i.test(m) ||
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(m);
  if (!((mentionsMenu && isRequest) || restaurantDeliveryRequest)) return null;

  const fr = isFr(locale);
  const wantsEmail = /\b(courriel|e[- ]?mail|email)\b/i.test(m);

  const links = fr
    ? [
        "- [Menu principal](https://www.clubsportifmaa.com/wp-content/uploads/2025/10/1881_Menu1_Fr_Oct2025.pdf)",
        "- [Menu déjeuner](https://www.clubsportifmaa.com/wp-content/uploads/2025/10/1881_Menu2_Fr_Oct2025.pdf)",
        "- [Carte des vins](https://www.clubsportifmaa.com/wp-content/uploads/2023/09/1881_Menu_CarteDesVins.pdf)",
      ]
    : [
        "- [Main menu](https://www.clubsportifmaa.com/wp-content/uploads/2025/10/1881_Menu1_Fr_Oct2025.pdf)",
        "- [Lunch menu](https://www.clubsportifmaa.com/wp-content/uploads/2025/10/1881_Menu2_Fr_Oct2025.pdf)",
        "- [Wine list](https://www.clubsportifmaa.com/wp-content/uploads/2023/09/1881_Menu_CarteDesVins.pdf)",
      ];

  const intro = wantsEmail
    ? (fr
        ? "Je ne peux pas envoyer de courriel, mais je vous partage les menus du Restaurant Le 1881 directement ici — il suffit de cliquer :"
        : "I can't send emails, but here are the Restaurant Le 1881 menus right here — just click:")
    : (fr
        ? "Avec plaisir — voici les menus du Restaurant Le 1881 :"
        : "With pleasure — here are the Restaurant Le 1881 menus:");

  const outro = fr
    ? "Vous pouvez aussi [commander en ligne](https://clubsportifmaa.clusterpos.com/menu). Souhaitez-vous de l'aide pour réserver une table ?"
    : "You can also [order online](https://clubsportifmaa.clusterpos.com/menu). Would you like help reserving a table?";

  return { followUpMode: "clarify", assistantMessage: [intro, ...links, outro].join("\n") };
}

/**
 * "où puis-je voir la liste des instructeurs ?" / "vos entraîneurs personnels"
 * Daphné Review #5 (p.23): the concierge must point to the official experts pages
 * so the visitor can click each person for their VERIFIED profile — safer than
 * the LLM naming instructors + specialties (which it sometimes invents).
 */
export function tryAnswerExpertsDirectory(
  userMessage: string,
  locale: string | undefined,
): { assistantMessage: string; followUpMode: "clarify" } | null {
  const m = userMessage ?? "";
  const mentionsExpert = /\b(instructeurs?|instructors?|entra[iî]neurs?|trainers?|coachs?)\b/i.test(m);
  const wantsList =
    /\b(liste|voir|consulter|o[uù]\s+(?:puis|peux|trouver)|qui\s+sont|tous\s+les|toutes\s+les|sp[eé]cialit|specialties|list|see|view|profils?|noms?)\b/i.test(m) ||
    /\bqui\s+(?:sont|est)\b/i.test(m);
  if (!mentionsExpert || !wantsList) return null;

  const fr = isFr(locale);
  let label: string;
  let url: string;
  let noun: string;
  if (/\bpersonnels?\b|\bpersonal\b/i.test(m)) {
    label = fr ? "Entraîneurs personnels MAA" : "MAA personal trainers";
    url = "https://www.clubsportifmaa.com/fr/experts/entraineurs-personnels/";
    noun = fr ? "entraîneurs personnels" : "personal trainers";
  } else if (/\bdu\s+club\b|\bclub\s+trainers?\b/i.test(m)) {
    label = fr ? "Entraîneurs du club MAA" : "MAA club trainers";
    url = "https://www.clubsportifmaa.com/fr/experts/entraineurs-de-clubs/";
    noun = fr ? "entraîneurs du club" : "club trainers";
  } else {
    label = fr ? "Instructeurs MAA" : "MAA instructors";
    url = "https://www.clubsportifmaa.com/fr/experts/instructeurs/";
    noun = fr ? "instructeurs" : "instructors";
  }

  return {
    followUpMode: "clarify",
    assistantMessage: fr
      ? `Avec plaisir — vous pouvez voir tous nos ${noun} et leurs spécialités ici : [${label}](${url}). Cliquez sur une personne pour consulter son profil détaillé. Souhaitez-vous que je vous oriente vers une spécialité en particulier ?`
      : `With pleasure — you can see all our ${noun} and their specialties here: [${label}](${url}). Click on a person to view their detailed profile. Would you like me to point you toward a particular specialty?`,
  };
}

/**
 * Visit-clarifying-question follow-up (2026-05-31, Steve live).
 *
 * WHY: When the bot asks "souhaitez-vous visiter en tant que futur membre ou
 * pour découvrir un service spécifique comme le spa, la piscine, les cours ?"
 * and the user answers "pour le spa svp" / "pour la piscine svp" / etc., the
 * LLM was dropping the VISIT intent and dumping a brochure for the named
 * service (long massotherapy price list, pool-area description, etc.). The
 * user wanted a *focused visit*, not a service brochure.
 *
 * This handler detects that exact pattern (prior assistant turn = visit-or-
 * service clarifying question + current message names a service area) and
 * emits a short lead-capture reply that books a focused visit through Francis
 * Bradette.
 */
const VISIT_AREA_RE =
  /\b(spa|sauna|hammam|piscine|pool|cours|classes?|salles?\s+d['e]?entra[iî]nement|gym|musculation|squash|pickleball|basket|restaurant|le\s+1881|cliniqu|massage|tennis|terrasse)\b/i;

const PRIOR_VISIT_QUESTION_RE =
  /(souhaitez[- ]vous|voulez[- ]vous|would\s+you\s+like|do\s+you\s+want)[^.?!]*\b(visite[r]?|visit|tour|d[eé]couvrir|discover)\b[^.?!]*\?/i;

const PRIOR_VISIT_BRANCHES_RE =
  /\b(?:adh[eé]sion|membership|membre[s]?|future[s]?\s+membre[s]?|prospective\s+member|service\s+sp[eé]cifique|specific\s+service|d[eé]couvrir\s+un\s+service|discover\s+a\s+(?:specific\s+)?service)\b/i;

export function tryAnswerVisitForArea(
  userMessage: string,
  lastAssistantText: string | undefined,
  locale: string | undefined,
): { assistantMessage: string; followUpMode: "callback" } | null {
  const u = (userMessage ?? "").trim();
  const a = (lastAssistantText ?? "").trim();
  if (!u || !a) return null;
  // Prior assistant turn must have asked the visit-or-service clarifying question.
  if (!PRIOR_VISIT_QUESTION_RE.test(a) || !PRIOR_VISIT_BRANCHES_RE.test(a)) return null;
  // Current message must be short and name a service area, without explicitly
  // declaring "membership" (which would route to the abonnement flow instead).
  if (u.length > 120) return null;
  if (/\b(adh[eé]sion|abonnement|membership|m['e]?abonner|devenir\s+membre|become\s+a\s+member)\b/i.test(u)) return null;
  const m = VISIT_AREA_RE.exec(u);
  if (!m) return null;

  const fr = isFr(locale);
  const area = m[0]!.toLowerCase();
  const areaLabelFr: Record<string, string> = {
    spa: "le spa", sauna: "le spa", hammam: "le spa", piscine: "la piscine",
    pool: "la piscine", cours: "les cours", classes: "les cours",
    squash: "le squash", pickleball: "le pickleball", basket: "le basketball",
    restaurant: "le restaurant", "le 1881": "le Restaurant Le 1881",
    cliniqu: "la clinique sportive", massage: "la clinique (massothérapie)",
    tennis: "le tennis", terrasse: "la terrasse",
  };
  const areaLabelEn: Record<string, string> = {
    spa: "the spa", sauna: "the spa", hammam: "the spa", piscine: "the pool",
    pool: "the pool", cours: "group classes", classes: "group classes",
    squash: "squash", pickleball: "pickleball", basket: "basketball",
    restaurant: "the restaurant", cliniqu: "the sports clinic",
    massage: "the clinic (massage)", tennis: "tennis", terrasse: "the terrace",
  };
  const labelFr = areaLabelFr[area] ?? "cet espace";
  const labelEn = areaLabelEn[area] ?? "this area";

  return {
    followUpMode: "callback",
    assistantMessage: fr
      ? `Avec plaisir — je peux organiser une visite axée sur ${labelFr}. Laissez-moi votre nom, votre courriel et un moment qui vous convient, et Francis Bradette (Abonnements / visites) vous écrira pour confirmer le rendez-vous.`
      : `With pleasure — I can arrange a visit focused on ${labelEn}. Share your name, your email, and a time that works for you, and Francis Bradette (Memberships / visits) will write to confirm.`,
  };
}

/**
 * Boutique brand/product inquiry (2026-05-31, Steve live).
 *
 * WHY: "vendez-vous du lululemon ?" got "Le Club n'offre pas Lululemon
 * actuellement. Souhaitez-vous que je vous mette en contact avec elle ?" —
 * a self-contradicting lead-capture loop. The honest answer is: the pro shop
 * carries mostly MAA-branded apparel/accessories, and the current selection
 * changes; the reception (514 845-2233, poste 0) can confirm with Valérie De
 * Vigne directly. No lead capture — phone routing.
 */
const BOUTIQUE_QUERY_RE =
  /\b(vend(?:ez|s|ent)|carry|carrying|carries|do\s+you\s+(?:sell|have|carry|stock)|avez[- ]vous|y\s+a[- ]t[- ]il|est[- ]ce\s+que\s+vous\s+(?:vendez|avez)|sell)\b/i;

const BOUTIQUE_SUBJECT_RE =
  /\b(boutique|pro\s*shop|lululemon|nike|adidas|under\s+armour|new\s+balance|asics|reebok|on\s+running|hoka|puma|brooks|saucony|hokas?|prot[eé]ines?|protein\s+powder|supplements?|suppl[eé]ments?|vitamines?|maillots?\s+de\s+bain|bouteille[s]?\s+d['e]?eau|water\s+bottles?|raquettes?(?!\s+(?:de\s+location|à\s+louer))|chaussures?|shoes?|t[- ]?shirts?|short[s]?|legging[s]?|sac[s]?\s+de\s+sport|gym\s+bags?|accessoires?|articles?|v[eê]tements?|apparel|merch|merchandise|gear)\b/i;

const BOUTIQUE_CLUB_LOGO_RE =
  /\b(maa|du\s+club|club\s+sportif|logot[eé]|club[- ]branded|club\s+logo)\b/i;

export function tryAnswerBoutiqueBrand(
  userMessage: string,
  locale: string | undefined,
): { assistantMessage: string; followUpMode: "callback" } | null {
  const m = (userMessage ?? "").trim();
  if (m.length === 0 || m.length > 220) return null;
  if (!BOUTIQUE_QUERY_RE.test(m)) return null;
  if (!BOUTIQUE_SUBJECT_RE.test(m)) return null;
  // If the visitor is asking about logoed MAA gear specifically, that's a
  // legitimate "yes we carry it" question — let the LLM/RAG answer.
  if (BOUTIQUE_CLUB_LOGO_RE.test(m)) return null;

  const fr = isFr(locale);
  return {
    followUpMode: "callback",
    assistantMessage: fr
      ? "Le pro shop du Club Sportif MAA propose surtout des articles aux couleurs du club (vêtements et accessoires logotés MAA) — la sélection des marques externes change selon les arrivages, je préfère ne pas inventer ce qui s'y trouve aujourd'hui. La réception au (514) 845-2233, poste 0, peut confirmer la sélection actuelle avec Valérie De Vigne, responsable de la boutique."
      : "The Club Sportif MAA pro shop carries primarily MAA-branded apparel and accessories — the selection of outside brands varies with each shipment, so I'd rather not guess at what's in stock today. Reception at (514) 845-2233 ext. 0 can confirm the current selection with Valérie De Vigne, the boutique manager.",
  };
}

/**
 * Dynamic-schedule services (2026-05-31 schedule stress).
 *
 * WHY: For services where the schedule lives in a dated PDF (cirque aérien,
 * PowerWatts, Pilates Reformer, triathlon, pool, group classes), the LLM was
 * either refusing ("Je n'ai pas l'horaire") or worse, inventing specific
 * timeslots and instructor names ("HIIT vendredi 18h35 avec Laura"). Both are
 * wrong: the PDF link IS the authoritative answer. Deliver it cleanly with a
 * "dated PDF — confirm with reception" hedge, no LLM in the loop.
 *
 * NOT covered: basketball (no PDF available from Daphné), squash, FLiiP-only
 * services. Those still route via the LLM/RAG path.
 */
interface ScheduleService {
  id: string;
  labelFr: string;
  labelEn: string;
  url: string;
  match: RegExp;
}

const SCHEDULE_SERVICES: ScheduleService[] = [
  {
    id: "cirque_aerien",
    labelFr: "Cirque aérien — horaire printemps 2026",
    labelEn: "Aerial circus — Spring 2026 schedule",
    url: "https://www.clubsportifmaa.com/wp-content/uploads/2026/03/MAA_Aerial-Circus_Spring2026.pdf",
    match: /\bcirque(?:\s+a[eé]rien)?\b|\baerial\s+circus\b/i,
  },
  {
    id: "powerwatts",
    labelFr: "PowerWatts — horaire",
    labelEn: "PowerWatts — schedule",
    url: "https://www.clubsportifmaa.com/wp-content/uploads/2026/04/MAA_PowerWatts_Hiver-Spring2026.pdf",
    match: /\bpowerwatts\b|\bpower[- ]?watts\b/i,
  },
  {
    id: "pilates_reformer",
    labelFr: "Pilates Reformer — horaire",
    labelEn: "Pilates Reformer — schedule",
    url: "https://www.clubsportifmaa.com/wp-content/uploads/2026/04/MAA_Pilates_Reformer_Horaire-Schedule_May4-26.pdf",
    match: /\bpilates(?:\s+(?:reformer|sur\s+appareils|priv[eé]))?\b|\breformer\b/i,
  },
  {
    id: "triathlon",
    labelFr: "Programmation triathlon",
    labelEn: "Triathlon program",
    url: "https://www.clubsportifmaa.com/wp-content/uploads/2026/01/MAA_ClubTriathlon_Programme-Offres-FR_Jan26.pdf",
    match: /\btriathlon\b/i,
  },
  {
    id: "pool",
    labelFr: "Horaire piscine — printemps 2026",
    labelEn: "Pool schedule — Spring 2026",
    url: "https://www.clubsportifmaa.com/wp-content/uploads/2026/04/MAA_Piscine_Pool_Printemps2026_04-07-26.pdf",
    match: /\b(piscine|pool|nage\s+libre|espace\s+o)\b/i,
  },
];

const SCHEDULE_INTENT_RE =
  /\b(horaire[s]?|heure[s]?|programme[s]?|session[s]?|s[eé]ance[s]?|cours|classes?|quand|when|schedule|hours?|times?|days?|jours?|semaine|week|aujourd['']?hui|today|demain|tomorrow|ce\s+soir|tonight|ce\s+matin|this\s+morning|tonight|qui\s+(?:donne|enseign)|who\s+teach|instructeur[s]?|instructor[s]?)\b/i;

export function tryAnswerDynamicScheduleService(
  userMessage: string,
  locale: string | undefined,
): { assistantMessage: string; followUpMode: "clarify" } | null {
  const m = (userMessage ?? "").trim();
  if (m.length === 0 || m.length > 220) return null;
  if (!SCHEDULE_INTENT_RE.test(m)) return null;

  const svc = SCHEDULE_SERVICES.find((s) => s.match.test(m));
  if (!svc) return null;

  // Avoid swallowing tarif/price questions that happen to mention the service.
  if (/\b(tarif|prix|co[uû]te?|combien|cost|price|how\s+much)\b/i.test(m)) return null;

  const fr = isFr(locale);
  return {
    followUpMode: "clarify",
    assistantMessage: fr
      ? `L'horaire ${svc.id === "triathlon" ? "et la programmation" : "officiel"} se trouve dans le document du Club — je vous le partage directement : [${svc.labelFr}](${svc.url}). Ce document est daté ; pour confirmer une plage ou un instructeur précis avant de vous déplacer, la réception (514 845-2233, poste 0) peut le valider en direct. Souhaitez-vous que je vous oriente vers le bon contact pour vous inscrire ?`
      : `The official ${svc.id === "triathlon" ? "program and schedule" : "schedule"} lives in the Club's reference document — here it is: [${svc.labelEn}](${svc.url}). It's dated; for a specific slot or instructor, reception at (514) 845-2233 ext. 0 can confirm live. Would you like me to point you to the right contact to sign up?`,
  };
}

/**
 * Basketball schedule (2026-05-31 schedule stress).
 *
 * WHY: Bot was inventing a fake basketball grid ("Lundi 19h-21h, Vendredi
 * 19h-21h, Samedi 17h-18h30, Dimanche 15h-18h30") because there is NO
 * published basketball schedule in the KB. There is no PDF. The honest
 * answer is to route to Nathalie Lambert (programmation sportive) for the
 * current schedule and access conditions (members-only sport).
 */
export function tryAnswerBasketballSchedule(
  userMessage: string,
  locale: string | undefined,
): { assistantMessage: string; followUpMode: "callback" } | null {
  const m = (userMessage ?? "").trim();
  if (m.length === 0 || m.length > 220) return null;
  if (!/\b(basketball|basket\b)/i.test(m)) return null;
  if (!SCHEDULE_INTENT_RE.test(m)) return null;
  if (/\b(tarif|prix|co[uû]te?|combien|cost|price|how\s+much)\b/i.test(m)) return null;

  const fr = isFr(locale);
  return {
    followUpMode: "callback",
    assistantMessage: fr
      ? "L'horaire détaillé du basketball n'est pas publié en ligne — il évolue selon les sessions et l'affluence des membres. Nathalie Lambert (Programmation sportive) tient l'horaire à jour ; je peux lui transmettre vos coordonnées et votre préférence de moment, et elle vous écrira avec les plages disponibles. C'est un sport réservé aux membres du Club."
      : "The detailed basketball schedule isn't published online — it shifts with the session and member demand. Nathalie Lambert (Sports programming) keeps the live schedule; I can share your contact and preferred time, and she'll write back with the available slots. Basketball is members-only at the Club.",
  };
}
