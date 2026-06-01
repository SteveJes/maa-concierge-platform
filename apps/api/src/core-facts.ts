import type { MaaChatResponse } from "./services/maa-chat.js";
import tenantCoreFacts from "./tenant-core-facts.json" with { type: "json" };

function normalizeIntentText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(normalized: string): string[] {
  return normalized.split(" ").filter(Boolean);
}

function hasAnyPhrase(normalized: string, phrases: string[]): boolean {
  return phrases.some((phrase) => normalized.includes(phrase));
}

function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array.from({ length: b.length + 1 }, () => 0),
  );

  for (let i = 0; i <= a.length; i += 1) {
    dp[i][0] = i;
  }

  for (let j = 0; j <= b.length; j += 1) {
    dp[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;

      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }

  return dp[a.length][b.length];
}

function fuzzyTokenMatch(token: string, target: string): boolean {
  if (token === target) {
    return true;
  }

  const distance = levenshteinDistance(token, target);

  if (target.length <= 4) {
    return distance <= 1;
  }

  return distance <= 2;
}

function hasApproxToken(normalized: string, targets: string[]): boolean {
  const tokens = tokenize(normalized);
  return targets.some((target) =>
    tokens.some((token) => fuzzyTokenMatch(token, target)),
  );
}

function hasApproxTokenSet(normalized: string, targets: string[]): boolean {
  return targets.every((target) => hasApproxToken(normalized, [target]));
}

function isFrenchLocale(locale: string | null): boolean {
  if (!locale) {
    return false;
  }

  const normalized = locale.trim().toLowerCase();
  return normalized === "fr" || normalized.startsWith("fr-");
}

type TenantCoreFacts = {
  phoneNumberEn: string;
  phoneNumberFr: string;
  addressEn: string;
  addressFr: string;
  descriptionEn: string;
  descriptionFr: string;
  hoursEn: string;
  hoursFr: string;
  brandNameEn: string;
  brandNameFr: string;
  phoneLeadEn: string;
  phoneLeadFr: string;
  locationLeadEn: string;
  locationLeadFr: string;
  descriptionLeadEn: string;
  descriptionLeadFr: string;
  hoursLeadEn: string;
  hoursLeadFr: string;
};

function getTenantCoreFacts(tenantId: string): TenantCoreFacts | null {
  const record = (tenantCoreFacts as Record<string, TenantCoreFacts>)[tenantId];
  return record ?? null;
}

function buildCoreFactMessage(
  facts: TenantCoreFacts,
  kind: "phone" | "location" | "description" | "hours",
  locale: string | null,
): string {
  const french = isFrenchLocale(locale);

  if (kind === "phone") {
    return french ? facts.phoneNumberFr : facts.phoneNumberEn;
  }

  if (kind === "location") {
    return french ? facts.addressFr : facts.addressEn;
  }

  if (kind === "description") {
    return french ? facts.descriptionFr : facts.descriptionEn;
  }

  return french ? facts.hoursFr : facts.hoursEn;
}

function looksLikePhoneNumberQuestion(
  userMessage: string,
  locale: string | null,
): boolean {
  const normalized = normalizeIntentText(userMessage);

  // 2026-05-19 demo bug: 'je voudrais me joindre à votre gym' fired this
  // detector because of the word 'joindre'. But the visitor means JOIN
  // (membership), not CONTACT. Same for prospect-goal phrasings.
  // Bail out before the canned phone-number reply takes over.
  // 2026-06-01 Steve live (worst yet): "ma femme et moi voudrons joindre le
  // club" was read as "contact us" instead of "JOIN the club" because my
  // regex required 'à' between 'joindre' and the noun. In casual Quebec
  // French, "joindre le club" (sans à) is common. Broaden to catch:
  //   - "joindre le/la/votre/notre/un/une (gym|club|centre|équipe)"
  //   - "joindre au club" / "se joindre au club"
  //   - couple/family signals adjacent to 'joindre/devenir membre' too
  const joinIntentSignals =
    // "joindre le/la/votre/un club", "joindre au club", "se joindre au club"
    /\b(?:me\s+|se\s+|vous\s+)?joindre\s+(?:au?x?|à\s+(?:la\s+|le\s+|l[' ])?|aux?\s+)?(?:votre|le|la|notre|un|une)?\s*(?:gym|club|centre|[eé]quipe)\b/.test(normalized) ||
    /\bjoin\s+(?:your|the)\s+(?:gym|club|centre|center|team)\b/.test(normalized) ||
    /\b(?:devenir|deveni)\s+membre\b/.test(normalized) ||
    /\b(?:embonpoint|perdre\s+du\s+poids|remise\s+en\s+forme|me\s+remettre\s+en\s+forme|weight\s+loss|get\s+in\s+shape)\b/.test(normalized) ||
    /\b(?:m['']?abonner|m['']?inscrire|adherer|adhérer)\b/.test(normalized) ||
    // 2026-06-01: couple/family + join signal
    /\b(?:ma\s+femme|mon\s+mari|mon\s+conjoint|ma\s+conjointe|en\s+couple|family|couple)\b.{0,40}\b(?:joindre|join|abonn|inscrire|devenir\s+membre|rabais)\b/.test(normalized);
  if (joinIntentSignals) return false;

  // 2026-06-01 Steve live: "téléphone de Nathalie" was firing the canned
  // "514 845-2233, poste 234" deflection BEFORE tryAnswerStaffContact had a
  // chance to return Nathalie's correct ext 231. When the user names a
  // specific staff member, bail out so the staff handler takes over.
  const namesStaff =
    /\b(nathalie|lambert|francis|bradette|elisabeth|boutin|yvon|provencal|provençal|valerie|valérie|de\s+vigne|devigne)\b/i.test(userMessage);
  if (namesStaff) return false;

  if (isFrenchLocale(locale)) {
    return (
      hasAnyPhrase(normalized, [
        "numero de telephone",
        "num de telephone",
        "telephone",
        "joindre",
        "vous appeler",
      ]) ||
      hasApproxTokenSet(normalized, ["numero", "telephone"]) ||
      hasApproxTokenSet(normalized, ["num", "telephone"]) ||
      hasApproxToken(normalized, ["telephone"])
    );
  }

  return (
    hasAnyPhrase(normalized, [
      "phone number",
      "telephone number",
      "contact number",
      "number to call",
      "how can i reach you",
    ]) ||
    hasApproxTokenSet(normalized, ["phone", "number"]) ||
    hasApproxTokenSet(normalized, ["telephone", "number"]) ||
    hasApproxTokenSet(normalized, ["reach", "you"]) ||
    (hasApproxToken(normalized, ["phone", "telephone"]) &&
      hasApproxToken(normalized, ["number", "numbre"]))
  );
}

function looksLikeLocationQuestion(
  userMessage: string,
  locale: string | null,
): boolean {
  const normalized = normalizeIntentText(userMessage);

  // Guard: "adresse email / courriel", "email address", or any message that
  // contains an actual email address must NEVER trip the street-address
  // detector. The substring "adresse"/"address" inside "adresse email" / "email
  // address" was short-circuiting to the club's physical address (2070 Peel).
  // NOTE: substring (not \b) — normalizeIntentText strips the apostrophe so
  // "à l'adresse" becomes "ladresse", and \badresse\b would miss it (same word-
  // boundary trap the rest of this file hit with accents).
  if (
    (/(?:adresse|address)/.test(normalized) && /(?:e[- ]?mail|email|courriel|\bmail\b)/.test(normalized)) ||
    /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(userMessage)
  ) {
    return false;
  }

  if (isFrenchLocale(locale)) {
    // Guard: short messages mentioning clothing / dress code must never trip
    // the address detector. "dress" Levenshtein-distance 2 from "adresse"
    // was wrongly matching the fuzzy token check.
    if (/\b(dress code|tenue|code vestimentaire|vetement|habill)\b/.test(normalized)) {
      return false;
    }

    return (
      hasAnyPhrase(normalized, [
        "ou etes vous",
        "ou etes vous situes",
        "adresse",
        "ou etes vous localises",
        "ou est le club",
      ]) ||
      hasApproxTokenSet(normalized, ["ou", "etes", "vous"]) ||
      // Drop the fuzzy single-token "adresse" match — too loose. The substring
      // check above already covers exact + typo variants like "ladresse".
      normalized === "adresse"
    );
  }

  return (
    hasAnyPhrase(normalized, [
      "where are you located",
      "where are you",
      "what is your address",
      "where is the club located",
      "where is the club",
      "address",
    ]) ||
    hasApproxTokenSet(normalized, ["where", "located"]) ||
    hasApproxTokenSet(normalized, ["your", "address"]) ||
    normalized === "address"
  );
}

function looksLikeClassScheduleQuestion(userMessage: string): boolean {
  // Questions about specific class types or programme schedules should go to AI+retrieval,
  // not the generic hours deterministic path.
  const normalized = normalizeIntentText(userMessage);
  return (
    normalized.includes("yoga") ||
    normalized.includes("pilates") ||
    normalized.includes("cours") ||
    normalized.includes("class") ||
    normalized.includes("classes") ||
    normalized.includes("programme") ||
    normalized.includes("program") ||
    normalized.includes("spinning") ||
    normalized.includes("zumba") ||
    normalized.includes("aqua") ||
    normalized.includes("natation") ||
    normalized.includes("swimming")
  );
}

function looksLikeHoursQuestion(
  userMessage: string,
  locale: string | null,
): boolean {
  // Let class/programme schedule questions pass through to AI+retrieval.
  if (looksLikeClassScheduleQuestion(userMessage)) {
    return false;
  }

  const normalized = normalizeIntentText(userMessage);

  const frenchMatch =
    hasAnyPhrase(normalized, [
      "heures d ouverture",
      "horaire",
      "horaires",
      "quand etes vous ouverts",
      "etes vous ouverts",
    ]) ||
    hasApproxToken(normalized, ["horaire", "horaires"]) ||
    hasApproxTokenSet(normalized, ["heures", "ouverture"]);

  const englishMatch =
    hasAnyPhrase(normalized, [
      "opening hours",
      "business hours",
      "what are your hours",
      "when are you open",
      "hours",
    ]) ||
    hasApproxTokenSet(normalized, ["opening", "hours"]);

  if (isFrenchLocale(locale)) {
    return frenchMatch || englishMatch;
  }

  return englishMatch;
}

function looksLikeGreetingOnly(
  userMessage: string,
  locale: string | null,
): boolean {
  const normalized = normalizeIntentText(userMessage);
  const tokens = tokenize(normalized);

  if (tokens.length > 4) {
    return false;
  }

  if (isFrenchLocale(locale)) {
    return [
      "salut",
      "bonjour",
      "bonsoir",
      "allo",
      "coucou",
      "quoi de neuf",
    ].includes(normalized);
  }

  return [
    "hi",
    "hello",
    "hey",
    "whats up",
    "what s up",
    "sup",
    "yo",
  ].includes(normalized);
}

function looksLikeOfferingsQuestion(
  userMessage: string,
  locale: string | null,
): boolean {
  const normalized = normalizeIntentText(userMessage);

  if (isFrenchLocale(locale)) {
    return (
      hasAnyPhrase(normalized, [
        "qu est ce que vous offrez",
        "qu offrez vous",
        "qu est ce que vous avez",
        "quels services",
        "quels cours",
        "est ce qu il y a une piscine",
        "est ce plus une piscine ou un gym",
        "parlez moi de vos services",
      ]) ||
      hasApproxTokenSet(normalized, ["quels", "services"])
    );
  }

  return (
    hasAnyPhrase(normalized, [
      "what do you offer",
      "what do you guys offer",
      "what do you have",
      "what services do you offer",
      "what facilities do you have",
      "what amenities do you have",
      "tell me more about the gym",
      "more info about the gym",
      "is it a yoga place or a pool",
      "is it more a pool or a gym",
      "do you have a pool",
      "what is this place",
    ]) ||
    hasApproxTokenSet(normalized, ["what", "offer"]) ||
    hasApproxTokenSet(normalized, ["what", "have"]) ||
    hasApproxTokenSet(normalized, ["facilities", "have"]) ||
    hasApproxTokenSet(normalized, ["amenities", "have"]) ||
    hasApproxTokenSet(normalized, ["about", "gym"])
  );
}

function looksLikePricingIntent(userMessage: string): boolean {
  const normalized = normalizeIntentText(userMessage);
  return (
    normalized.includes("tarif") ||
    normalized.includes("prix") ||
    normalized.includes("cout") ||
    normalized.includes("abonnement") ||
    normalized.includes("abonement") ||
    normalized.includes("combien") ||
    normalized.includes("frais") ||
    normalized.includes("mensuel") ||
    normalized.includes("etudiant") ||
    normalized.includes("senior") ||
    normalized.includes("rabais") ||
    normalized.includes("reduction") ||
    normalized.includes("fee") ||
    normalized.includes("price") ||
    normalized.includes("cost") ||
    normalized.includes("discount") ||
    normalized.includes("membership")
  );
}

function looksLikeClubDescriptionQuestion(
  userMessage: string,
  locale: string | null,
): boolean {
  const normalized = normalizeIntentText(userMessage);

  if (isFrenchLocale(locale)) {
    return (
      hasAnyPhrase(normalized, [
        "quel genre de club",
        "quel type de club",
        "quel genre de gym",
        "quel type de gym",
        "parlez moi du club",
        "c est quel genre d endroit",
        "parlez moi du gym",
        "decrivez le club",
      ]) ||
      hasApproxTokenSet(normalized, ["genre", "club"]) ||
      hasApproxTokenSet(normalized, ["type", "club"]) ||
      hasApproxTokenSet(normalized, ["genre", "gym"]) ||
      hasApproxTokenSet(normalized, ["parlez", "club"])
    );
  }

  return (
    hasAnyPhrase(normalized, [
      "what kind of gym are you",
      "what kind of gim are you",
      "what kind of club are you",
      "tell me about the club",
      "what type of gym is this",
      "what type of gim is this",
      "what kind of place is this",
      "tell me about the gym",
      "describe the club",
    ]) ||
    hasApproxTokenSet(normalized, ["kind", "gym"]) ||
    hasApproxTokenSet(normalized, ["kind", "gim"]) ||
    hasApproxTokenSet(normalized, ["kind", "club"]) ||
    hasApproxTokenSet(normalized, ["about", "club"]) ||
    hasApproxTokenSet(normalized, ["about", "gym"])
  );
}

function looksLikeCallMeRequest(userMessage: string, locale: string | null): boolean {
  const normalized = normalizeIntentText(userMessage);
  const tokens = tokenize(normalized);
  const hasExactToken = (target: string) => tokens.includes(target);

  if (isFrenchLocale(locale)) {
    // Guard: short clarifying questions about names/services must never trip
    // the call-me detector. "comment ca s appelle" shouldn't fuzzy-match "appelez moi".
    if (/\b(comment ca s appelle|comment ca s appellent|comment ca s appellera|qu est ce que c est)\b/.test(normalized)) {
      return false;
    }

    return (
      hasAnyPhrase(normalized, [
        "pouvez vous m appeler",
        "pouvez-vous m appeler",
        "appelez moi",
        "appelez-moi",
        "je voudrais un rappel",
        "je veux un rappel",
        "vous pouvez m appeler",
        "pouvez vous rappeler",
        "voudrais etre rappele",
        "voudrais etre rappelle",
        "rappelez moi",
        "rappelez-moi",
        "je prefere un appel",
        "prefere parler au telephone",
        "parler a quelqu un",
        "parler a une personne",
      ]) ||
      // Exact-token requirements — fuzzy matching on short tokens like "moi" / "appelle"
      // produced false positives ("mon ami" ≈ "moi", "ca s appelle" ≈ "appeler").
      (hasExactToken("appelez") && hasExactToken("moi")) ||
      (hasExactToken("rappelez") && hasExactToken("moi")) ||
      (hasExactToken("rappel") && (hasExactToken("moi") || hasExactToken("me")))
    );
  }
  return (
    hasAnyPhrase(normalized, [
      "call me",
      "can you call me",
      "please call me",
      "i want a callback",
      "i d like a callback",
      "request a callback",
      "give me a call",
      "call me back",
      "speak to someone",
      "talk to someone",
      "talk to a person",
      "prefer to talk",
      "prefer a call",
    ]) ||
    hasApproxTokenSet(normalized, ["call", "me"]) ||
    hasApproxTokenSet(normalized, ["callback", "please"])
  );
}

export function resolveDirectCoreFactResponse(args: {
  tenantId: string;
  userMessage: string;
  locale: string | null;
  lastAssistantText?: string | null;
}): MaaChatResponse | null {
  const facts = getTenantCoreFacts(args.tenantId);

  if (!facts) {
    return null;
  }

  // 2026-06-01 Steve live: bot mentioned Nathalie Lambert in a prior turn,
  // user followed up with "comment la rejoindre?" — no staff name in current
  // message but the pronoun "la" references the prior turn's Nathalie. Bail
  // out of the generic phone/location resolver so the LLM (or staff handler
  // in answerMaaChat) can pick up the contextual reference.
  const priorTurnNamedStaff = args.lastAssistantText
    ? /\b(nathalie|lambert|francis|bradette|elisabeth|boutin|yvon|provencal|provençal|valerie|valérie|de\s+vigne|devigne)\b/i.test(args.lastAssistantText)
    : false;
  const currentMessagePronoun = /\b(la|le|lui|elle|her|him|them|they|its?)\b/i.test(args.userMessage);
  if (priorTurnNamedStaff && currentMessagePronoun) {
    return null;
  }

  if (looksLikeCallMeRequest(args.userMessage, args.locale)) {
    return {
      assistantMessage: isFrenchLocale(args.locale)
        ? "Absolument. Entrez votre numéro ci-dessous et notre concierge IA vous rappellera dans quelques secondes, avec le contexte de cette conversation."
        : "Absolutely. Enter your number below and our AI concierge will call you back in seconds, with full context from this conversation.",
      followUpMode: "callback",
      citations: [],
      retrieval: {
        query: "direct:call_me",
        chunkCount: 0,
        resultCount: 0,
      },
    };
  }

  if (looksLikeGreetingOnly(args.userMessage, args.locale)) {
    return {
      assistantMessage: isFrenchLocale(args.locale)
        ? "Bonjour, comment puis-je vous aider aujourd'hui avec le Club Sportif MAA ?"
        : "Hello, how can I help you today with Club Sportif MAA?",
      followUpMode: "done",
      citations: [],
      retrieval: {
        query: "direct:greeting",
        chunkCount: 0,
        resultCount: 0,
      },
    };
  }

  if (looksLikePhoneNumberQuestion(args.userMessage, args.locale)) {
    return {
      assistantMessage: buildCoreFactMessage(facts, "phone", args.locale),
      followUpMode: "done",
      citations: [],
      retrieval: {
        query: "direct:phone_number",
        chunkCount: 0,
        resultCount: 0,
      },
    };
  }

  // Arrival-time questions ("si j'arrive à 5h...") must not be caught by the location detector.
  // "du" fuzzy-matches "ou" with Levenshtein distance 1, triggering a false positive.
  const isArrivalTimeQuestion =
    /arriv[eéèêerons]*/i.test(args.userMessage) ||
    /viens\b/i.test(args.userMessage) ||
    (/\d{1,2}\s*(h|am|pm|heure)/i.test(args.userMessage) &&
      /\b(ouvert|ouverts|open|etes.vous|êtes.vous)\b/i.test(args.userMessage));

  if (!isArrivalTimeQuestion && looksLikeLocationQuestion(args.userMessage, args.locale)) {
    return {
      assistantMessage: buildCoreFactMessage(facts, "location", args.locale),
      followUpMode: "done",
      citations: [],
      retrieval: {
        query: "direct:location",
        chunkCount: 0,
        resultCount: 0,
      },
    };
  }

  // English general hours questions → deterministic response to avoid French-formatted AI answers.
  // French hours questions go to AI+retrieval (schedule service handles them better).
  if (!isFrenchLocale(args.locale) && looksLikeHoursQuestion(args.userMessage, args.locale)) {
    return {
      assistantMessage: buildCoreFactMessage(facts, "hours", args.locale),
      followUpMode: "done",
      citations: [],
      retrieval: { query: "direct:hours", chunkCount: 0, resultCount: 0 },
    };
  }

  return null;
}