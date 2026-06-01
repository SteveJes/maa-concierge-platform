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

  // 2026-06-01 Steve live: "avez-vous un déjeuner ?" / "brunch sunday?" was
  // hitting the LLM, which then INVENTED dish names and prices ("Le Classique
  // 19 $", "Chakchouka 20 $") — Daphné's #1 rule violated. Treat any
  // breakfast/brunch mention in restaurant context as a menu-link request.
  const mentionsMenu = /\bmenus?\b|carte\s+des\s+vins|version\s+pdf|\bd[eé]jeuner\b|\bbrunch\b|\bpetit[- ]d[eé]jeuner\b/i.test(m);
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
 * Staff contact (2026-06-01, Steve live).
 *
 * WHY: When the user asks for a staff member's phone or email by name
 * ("courriel de Nathalie", "téléphone de Francis"), the LLM was returning
 * the WRONG extension — defaulting to 234 (clinic) instead of the person's
 * actual extension. Worse, my URL-wrap guard corrupted nlambert@clubsportifmaa.com
 * into 'nlambert@Site MAA' (the corruption fix is in maa-chat.ts; this
 * handler removes the LLM from the loop entirely).
 *
 * Returns the verified contact straight from contacts.json data.
 */
interface MaaStaff {
  match: RegExp;
  name: string;
  role: string;
  ext: string | null;
  email: string | null;
  phone: string;
}

const STAFF_DIRECTORY: MaaStaff[] = [
  {
    match: /\b(nathalie|lambert)\b/i,
    name: "Nathalie Lambert",
    role: "Directrice des programmes sportifs et des communications",
    ext: "231",
    email: "nlambert@clubsportifmaa.com",
    phone: "514 845-2233",
  },
  {
    match: /\b(francis|bradette)\b/i,
    name: "Francis Bradette",
    role: "Directeur des ventes (abonnements et visites)",
    ext: "228",
    email: "fbradette@clubsportifmaa.com",
    phone: "514 845-2233",
  },
  {
    match: /\b(elisabeth|boutin)\b/i,
    name: "Elisabeth Boutin",
    role: "Espace Pilates",
    ext: null,
    email: "eboutin@clubsportifmaa.com",
    phone: "514 845-2233",
  },
  {
    match: /\b(yvon|provençal|provencal)\b/i,
    name: "Yvon Provençal",
    role: "Directeur de squash et pro en chef",
    ext: null,
    email: "yprovencal@clubsportifmaa.com",
    phone: "514 845-2233",
  },
  {
    match: /\b(val[eé]rie|de\s+vigne|devigne)\b/i,
    name: "Valérie De Vigne",
    role: "Responsable de la boutique MAA",
    ext: null,
    email: null,
    phone: "514 845-2233",
  },
];

const STAFF_CONTACT_INTENT_RE =
  /\b(courriel|e[- ]?mail|email|t[eé]l[eé]phone|phone|num[eé]ro|number|coordonn[eé]es|contact|joindre|reach|how\s+(?:to\s+)?(?:reach|contact))\b/i;

export function tryAnswerStaffContact(
  userMessage: string,
  locale: string | undefined,
): { assistantMessage: string; followUpMode: "clarify" } | null {
  const m = (userMessage ?? "").trim();
  if (m.length === 0 || m.length > 240) return null;
  if (!STAFF_CONTACT_INTENT_RE.test(m)) return null;

  const staff = STAFF_DIRECTORY.find((s) => s.match.test(m));
  if (!staff) return null;

  const fr = isFr(locale);
  const wantsEmail = /\b(courriel|e[- ]?mail|email)\b/i.test(m);
  const wantsPhone = /\b(t[eé]l[eé]phone|phone|num[eé]ro|number)\b/i.test(m);

  // Format the answer based on what was asked specifically.
  if (wantsEmail && staff.email) {
    return {
      followUpMode: "clarify",
      assistantMessage: fr
        ? `Voici le courriel de ${staff.name} (${staff.role}) : ${staff.email}. N'hésitez pas à lui écrire — pour une réponse plus rapide, vous pouvez aussi l'appeler au ${staff.phone}${staff.ext ? `, poste ${staff.ext}` : ""}.`
        : `Here's ${staff.name}'s email (${staff.role}): ${staff.email}. Feel free to write — for a faster reply, you can also call ${staff.phone}${staff.ext ? `, ext. ${staff.ext}` : ""}.`,
    };
  }
  if (wantsEmail && !staff.email) {
    return {
      followUpMode: "clarify",
      assistantMessage: fr
        ? `Le courriel direct de ${staff.name} (${staff.role}) n'est pas publié. Le meilleur point de contact est le téléphone : ${staff.phone}${staff.ext ? `, poste ${staff.ext}` : ", poste 0"}.`
        : `${staff.name}'s direct email (${staff.role}) isn't published. The best way to reach them is by phone: ${staff.phone}${staff.ext ? `, ext. ${staff.ext}` : ", ext. 0"}.`,
    };
  }
  if (wantsPhone) {
    return {
      followUpMode: "clarify",
      assistantMessage: fr
        ? `Vous pouvez joindre ${staff.name} (${staff.role}) au ${staff.phone}${staff.ext ? `, poste ${staff.ext}` : ", poste 0 — la réception transférera l'appel"}.${staff.email ? ` Son courriel : ${staff.email}.` : ""}`
        : `You can reach ${staff.name} (${staff.role}) at ${staff.phone}${staff.ext ? `, ext. ${staff.ext}` : ", ext. 0 — reception will transfer the call"}.${staff.email ? ` Their email: ${staff.email}.` : ""}`,
    };
  }
  // Generic "contact / coordonnées" — give both when available.
  const lines: string[] = [];
  lines.push(staff.phone + (staff.ext ? (fr ? `, poste ${staff.ext}` : `, ext. ${staff.ext}`) : ""));
  if (staff.email) lines.push(staff.email);
  return {
    followUpMode: "clarify",
    assistantMessage: fr
      ? `Voici comment joindre ${staff.name} (${staff.role}) — ${lines.join(" ou ")}.`
      : `Here's how to reach ${staff.name} (${staff.role}) — ${lines.join(" or ")}.`,
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
): { assistantMessage: string; followUpMode: "clarify" } | null {
  const m = (userMessage ?? "").trim();
  if (m.length === 0 || m.length > 220) return null;
  if (!BOUTIQUE_QUERY_RE.test(m)) return null;
  if (!BOUTIQUE_SUBJECT_RE.test(m)) return null;
  // If the visitor is asking about logoed MAA gear specifically, that's a
  // legitimate "yes we carry it" question — let the LLM/RAG answer.
  if (BOUTIQUE_CLUB_LOGO_RE.test(m)) return null;

  const fr = isFr(locale);
  return {
    // 2026-06-01 Steve live: was "callback" → callback form auto-popped after
    // the answer, which is confusing UX for a complete info reply (we gave
    // the phone). Use "clarify" so the form stays hidden; the user can still
    // click "Être recontacté" if they want a callback.
    followUpMode: "clarify",
    assistantMessage: fr
      ? "Le pro shop du Club Sportif MAA propose surtout des articles aux couleurs du club (vêtements et accessoires logotés MAA) — la sélection des marques externes change selon les arrivages, je préfère ne pas inventer ce qui s'y trouve aujourd'hui. La réception au (514) 845-2233, poste 0, peut confirmer la sélection actuelle avec Valérie De Vigne, responsable de la boutique."
      : "The Club Sportif MAA pro shop carries primarily MAA-branded apparel and accessories — the selection of outside brands varies with each shipment, so I'd rather not guess at what's in stock today. Reception at (514) 845-2233 ext. 0 can confirm the current selection with Valérie De Vigne, the boutique manager.",
  };
}

/**
 * Group-classes schedule (2026-05-31 schedule stress).
 *
 * WHY: Bot keeps inventing specific class+time+instructor combinations:
 * "HIIT Circuit vendredi 18h35", "Spinning Intervals 17h30-18h15", etc. The
 * REAL group-class schedule lives in MyWellness (live) + a monthly PDF. Just
 * deliver both links — the visitor will get the authoritative answer.
 *
 * Fires on any group-class keyword (yoga, HIIT, spinning, pilates, danse,
 * boxe, barre, essentrics, bootcamp, aqua, cours en groupe) when paired
 * with a schedule intent or specific-day/time question.
 */
const GROUP_CLASS_KEYWORDS_RE =
  /\b(cours\s+(?:en\s+|de\s+)?groupe|group\s+class(?:es)?|yoga|spinning|spin\b|hiit|bootcamp|cardio\s+danse|essentrics|barre\b|boxe.?fit|boxing\s+fit|zumba|aqua[- ]?hiit|aqua\s+hiit|aqua\s+gym|aquagym|danse\b|dance\s+class)\b/i;

const SPECIFIC_DAY_OR_TIME_RE =
  /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday|aujourd['']?hui|today|demain|tomorrow|ce\s+soir|tonight|ce\s+matin|this\s+morning|\d{1,2}\s*h\s*\d{0,2}|\d{1,2}\s*(?:am|pm))\b/i;

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
 * Restaurant Le 1881 — currently open or closed? (2026-05-31, Steve live.)
 *
 * WHY: Bot was telling users on Sunday at 17h30 that the restaurant was
 * "actuellement ouvert selon ses heures habituelles" — but the restaurant
 * closes at 16h on Sundays. The visitor literally said "ça dit que c'est
 * fermé" (the website shows it as closed) and the bot disagreed. Hours are
 * firm enough to answer deterministically:
 *   Mon–Fri 7h–22h, Sat 8h–22h, Sun 8h–16h.
 *
 * Triggers only when the visitor asks about right-now state — "ouvert
 * maintenant", "still open", "ça dit que c'est fermé", "open right now", etc.
 */
const RESTAURANT_CONTEXT_RE =
  /\b(restaurant|le\s+1881|resto(?!s)|1881)\b/i;
const REALTIME_OPEN_QUERY_RE =
  /\b(ouvert|ferm[eé]|open|closed|encore\s+ouvert|still\s+open|right\s+now|maintenant|en\s+ce\s+moment|currently|present|pr[eé]sentement|c['']?est\s+ferm[eé]|cest\s+ferm|its?\s+closed)\b/i;

interface RestaurantStatus {
  isOpen: boolean;
  todayLabelFr: string;
  todayLabelEn: string;
  todayHoursFr: string;
  todayHoursEn: string;
  nowFr: string;
  nowEn: string;
  nextOpenFr: string;
  nextOpenEn: string;
}

function computeRestaurantStatus(nowOverride?: Date): RestaurantStatus {
  const now = nowOverride ?? new Date();
  // Resolve Montreal-local weekday + HH:MM via Intl.DateTimeFormat parts to
  // avoid locale-string format drift (en-US sometimes returns "Sunday 17:56"
  // without the comma we previously assumed).
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Montreal",
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const dayLabelEn = (parts.find((p) => p.type === "weekday")?.value ?? "Sunday").toLowerCase();
  const hh = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
  const mm = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0", 10);
  const minutes = hh * 60 + mm;

  const FR_DAY: Record<string, string> = {
    monday: "lundi", tuesday: "mardi", wednesday: "mercredi", thursday: "jeudi",
    friday: "vendredi", saturday: "samedi", sunday: "dimanche",
  };

  // Hours: mon-fri 7h-22h (420-1320), sat 8h-22h (480-1320), sun 8h-16h (480-960).
  let openMin = 7 * 60, closeMin = 22 * 60;
  let hoursFr = "7h à 22h", hoursEn = "7am to 10pm";
  if (dayLabelEn === "saturday") {
    openMin = 8 * 60; closeMin = 22 * 60;
    hoursFr = "8h à 22h"; hoursEn = "8am to 10pm";
  } else if (dayLabelEn === "sunday") {
    openMin = 8 * 60; closeMin = 16 * 60;
    hoursFr = "8h à 16h"; hoursEn = "8am to 4pm";
  }
  const isOpen = minutes >= openMin && minutes < closeMin;

  // Next open: if currently closed and before today's open → today opens at X.
  // If past today's close → tomorrow at tomorrow's open.
  let nextOpenFr: string, nextOpenEn: string;
  if (!isOpen && minutes < openMin) {
    nextOpenFr = `aujourd'hui à ${Math.floor(openMin / 60)}h`;
    nextOpenEn = `today at ${Math.floor(openMin / 60)}am`;
  } else {
    const order = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const idx = order.indexOf(dayLabelEn);
    const nextDayEn = order[(idx + 1) % 7]!;
    const nextDayFr = FR_DAY[nextDayEn]!;
    let nextOpen = 7 * 60;
    if (nextDayEn === "saturday" || nextDayEn === "sunday") nextOpen = 8 * 60;
    nextOpenFr = `demain (${nextDayFr}) à ${Math.floor(nextOpen / 60)}h`;
    nextOpenEn = `tomorrow (${nextDayEn[0]!.toUpperCase() + nextDayEn.slice(1)}) at ${Math.floor(nextOpen / 60)}am`;
  }

  return {
    isOpen,
    todayLabelFr: FR_DAY[dayLabelEn] ?? dayLabelEn,
    todayLabelEn: dayLabelEn[0]!.toUpperCase() + dayLabelEn.slice(1),
    todayHoursFr: hoursFr,
    todayHoursEn: hoursEn,
    nowFr: `${hh}h${String(mm).padStart(2, "0")}`,
    nowEn: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`,
    nextOpenFr,
    nextOpenEn,
  };
}

export function tryAnswerRestaurantOpenNow(
  userMessage: string,
  locale: string | undefined,
): { assistantMessage: string; followUpMode: "clarify" } | null {
  const m = (userMessage ?? "").trim();
  if (m.length === 0 || m.length > 240) return null;
  if (!RESTAURANT_CONTEXT_RE.test(m)) return null;
  if (!REALTIME_OPEN_QUERY_RE.test(m)) return null;
  // Skip pure menu/reservation queries (handled elsewhere).
  if (/\b(menu|carte|r[eé]serv(?:er|ation)|booking|book\s+a\s+table)\b/i.test(m) && !REALTIME_OPEN_QUERY_RE.test(m)) return null;
  // 2026-06-01 schedule-stress: bot was answering "ouvert en ce moment
  // (lundi 7h à 22h)" when the user asked about Saturday evening or Sunday
  // at 17h. Those are SPECIFIC-DIFFERENT-DAY questions, not realtime —
  // don't fire the realtime handler. Let the LLM (armed with the time-
  // awareness rule) compute the correct answer for the asked day.
  const namesSpecificDay =
    /\b(lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche|monday|tuesday|wednesday|thursday|friday|saturday|sunday|demain|tomorrow|hier|yesterday)\b/i.test(m);
  if (namesSpecificDay) return null;

  const status = computeRestaurantStatus();
  const fr = isFr(locale);

  if (status.isOpen) {
    return {
      followUpMode: "clarify",
      assistantMessage: fr
        ? `Oui — selon les horaires affichés, le Restaurant Le 1881 est ouvert en ce moment (${status.todayLabelFr} ${status.todayHoursFr}). Souhaitez-vous voir le menu ou réserver une table ?`
        : `Yes — per the posted hours, Restaurant Le 1881 is open right now (${status.todayLabelEn} ${status.todayHoursEn}). Want to see the menu or book a table?`,
    };
  }

  return {
    followUpMode: "clarify",
    assistantMessage: fr
      ? `Selon les horaires affichés, le Restaurant Le 1881 est fermé en ce moment — le ${status.todayLabelFr}, il est ouvert de ${status.todayHoursFr}. Il rouvre ${status.nextOpenFr}. Voulez-vous que je vous partage le menu ou que je vous aide à réserver une table pour la prochaine ouverture ?`
      : `Per the posted hours, Restaurant Le 1881 is closed right now — on ${status.todayLabelEn}, it's open ${status.todayHoursEn}. It reopens ${status.nextOpenEn}. Want me to share the menu or help you book a table for the next opening?`,
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
export function tryAnswerGroupClassesSchedule(
  userMessage: string,
  locale: string | undefined,
): { assistantMessage: string; followUpMode: "clarify" } | null {
  const m = (userMessage ?? "").trim();
  if (m.length === 0 || m.length > 240) return null;
  if (!GROUP_CLASS_KEYWORDS_RE.test(m)) return null;
  if (!SCHEDULE_INTENT_RE.test(m) && !SPECIFIC_DAY_OR_TIME_RE.test(m)) return null;
  if (/\b(tarif|prix|co[uû]te?|combien|cost|price|how\s+much|inclus|included)\b/i.test(m)) return null;
  if (/\bpilates\s+(?:reformer|sur\s+appareils)\b|\breformer\b/i.test(m)) return null;

  const fr = isFr(locale);
  return {
    followUpMode: "clarify",
    assistantMessage: fr
      ? "L'horaire des cours en groupe vit en temps réel sur MyWellness — c'est la source la plus fiable pour vérifier un cours précis, un instructeur ou un moment, et pour réserver sa place. Voici les deux liens : [Horaire MyWellness — temps réel](https://widgets.mywellness.com/facility/ac1088953) et [Horaire des cours en groupe PDF](https://www.clubsportifmaa.com/wp-content/uploads/2026/05/MAA_CoursEnGroupe_HoraireClassifications_2070Peel_May05-26.pdf). Souhaitez-vous que je vous oriente vers Nathalie Lambert (Programmation sportive) pour une question précise ?"
      : "The group-class schedule lives in real time on MyWellness — that's the most reliable source for a specific class, instructor, or time, and for booking your spot. Two links: [MyWellness — real-time schedule](https://widgets.mywellness.com/facility/ac1088953) and [Group-class schedule PDF](https://www.clubsportifmaa.com/wp-content/uploads/2026/05/MAA_CoursEnGroupe_HoraireClassifications_2070Peel_May05-26.pdf). Want me to connect you with Nathalie Lambert (Sports programming) for a specific question?",
  };
}

export function tryAnswerBasketballSchedule(
  userMessage: string,
  locale: string | undefined,
): { assistantMessage: string; followUpMode: "callback" } | null {
  const m = (userMessage ?? "").trim();
  if (m.length === 0 || m.length > 220) return null;
  if (!/\b(basketball|basket\b)/i.test(m)) return null;
  // Schedule intent OR a specific day-of-week (otherwise the LLM invents a
  // grid for "basketball le dimanche?").
  if (!SCHEDULE_INTENT_RE.test(m) && !SPECIFIC_DAY_OR_TIME_RE.test(m)) return null;
  if (/\b(tarif|prix|co[uû]te?|combien|cost|price|how\s+much)\b/i.test(m)) return null;

  const fr = isFr(locale);
  return {
    followUpMode: "callback",
    assistantMessage: fr
      ? "L'horaire détaillé du basketball n'est pas publié en ligne — il évolue selon les sessions et l'affluence des membres. Nathalie Lambert (Programmation sportive) tient l'horaire à jour ; je peux lui transmettre vos coordonnées et votre préférence de moment, et elle vous écrira avec les plages disponibles. C'est un sport réservé aux membres du Club."
      : "The detailed basketball schedule isn't published online — it shifts with the session and member demand. Nathalie Lambert (Sports programming) keeps the live schedule; I can share your contact and preferred time, and she'll write back with the available slots. Basketball is members-only at the Club.",
  };
}
