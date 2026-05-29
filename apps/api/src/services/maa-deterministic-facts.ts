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

/** "pouvez-vous m'envoyer le menu du restaurant ?" / "le menu du 1881" */
export function tryAnswerRestaurantMenu(
  userMessage: string,
  activeService: string | null,
  locale: string | undefined,
): { assistantMessage: string; followUpMode: "clarify" } | null {
  const m = userMessage ?? "";
  const mentionsMenu = /\bmenu\b|carte\s+(?:des\s+vins|du\s+restaurant)/i.test(m);
  const restaurantContext =
    activeService === "restaurant" || /\b(restaurant|le\s+1881|resto|1881)\b/i.test(m);
  // Only fire when the visitor is clearly asking to SEE/RECEIVE the menu (not,
  // e.g., "le menu change-t-il ?" handled fine by the LLM) — require a request verb
  // or a bare "menu du restaurant".
  const asksForMenu =
    mentionsMenu &&
    restaurantContext &&
    /\b(envoyer?|envoie|montre[rz]?|voir|consulter|avoir|donne[rz]?|partage[rz]?|acc[eé]der|c['']?est\s+quoi|quel)\b|m['']?envoyer|le\s+menu\s+du\s+restaurant/i.test(m);
  if (!asksForMenu) return null;

  const fr = isFr(locale);
  const lines = fr
    ? [
        "Avec plaisir — voici les menus du Restaurant Le 1881 :",
        "- [Menu principal](https://www.clubsportifmaa.com/wp-content/uploads/2025/10/1881_Menu1_Fr_Oct2025.pdf)",
        "- [Menu déjeuner](https://www.clubsportifmaa.com/wp-content/uploads/2025/10/1881_Menu2_Fr_Oct2025.pdf)",
        "- [Carte des vins](https://www.clubsportifmaa.com/wp-content/uploads/2023/09/1881_Menu_CarteDesVins.pdf)",
        "Vous pouvez aussi [commander en ligne](https://clubsportifmaa.clusterpos.com/menu). Souhaitez-vous de l'aide pour réserver une table ?",
      ]
    : [
        "With pleasure — here are the Restaurant Le 1881 menus:",
        "- [Main menu](https://www.clubsportifmaa.com/wp-content/uploads/2025/10/1881_Menu1_Fr_Oct2025.pdf)",
        "- [Lunch menu](https://www.clubsportifmaa.com/wp-content/uploads/2025/10/1881_Menu2_Fr_Oct2025.pdf)",
        "- [Wine list](https://www.clubsportifmaa.com/wp-content/uploads/2023/09/1881_Menu_CarteDesVins.pdf)",
        "You can also [order online](https://clubsportifmaa.clusterpos.com/menu). Would you like help reserving a table?",
      ];

  return { followUpMode: "clarify", assistantMessage: lines.join("\n") };
}
