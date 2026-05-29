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
