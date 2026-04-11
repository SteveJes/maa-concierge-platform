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
};

function getTenantCoreFacts(tenantId: string): TenantCoreFacts | null {
  const record = (tenantCoreFacts as Record<string, TenantCoreFacts>)[tenantId];
  return record ?? null;
}

function looksLikePhoneNumberQuestion(
  userMessage: string,
  locale: string | null,
): boolean {
  const normalized = normalizeIntentText(userMessage);

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

  if (isFrenchLocale(locale)) {
    return (
      hasAnyPhrase(normalized, [
        "ou etes vous",
        "ou etes vous situes",
        "adresse",
        "ou etes vous localises",
      ]) ||
      hasApproxTokenSet(normalized, ["ou", "etes", "vous"]) ||
      hasApproxToken(normalized, ["adresse"])
    );
  }

  return (
    hasAnyPhrase(normalized, [
      "where are you located",
      "where are you",
      "what is your address",
      "where is the club located",
    ]) ||
    hasApproxTokenSet(normalized, ["where", "located"]) ||
    hasApproxTokenSet(normalized, ["your", "address"]) ||
    hasApproxTokenSet(normalized, ["where", "locatd"]) ||
    normalized === "address"
  );
}

function looksLikeHoursQuestion(
  userMessage: string,
  locale: string | null,
): boolean {
  const normalized = normalizeIntentText(userMessage);

  if (isFrenchLocale(locale)) {
    return (
      hasAnyPhrase(normalized, [
        "heures d ouverture",
        "horaire",
        "horaires",
        "quand etes vous ouverts",
        "etes vous ouverts",
      ]) ||
      hasApproxToken(normalized, ["horaire", "horaires"]) ||
      hasApproxTokenSet(normalized, ["heures", "ouverture"])
    );
  }

  return (
    hasAnyPhrase(normalized, [
      "opening hours",
      "business hours",
      "what are your hours",
      "when are you open",
      "hours",
    ]) ||
    hasApproxTokenSet(normalized, ["opening", "hours"]) ||
    hasApproxTokenSet(normalized, ["your", "hours"]) ||
    hasApproxToken(normalized, ["hours"])
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
      ]) ||
      hasApproxTokenSet(normalized, ["genre", "club"]) ||
      hasApproxTokenSet(normalized, ["type", "club"]) ||
      hasApproxTokenSet(normalized, ["genre", "gym"])
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
    ]) ||
    hasApproxTokenSet(normalized, ["kind", "gym"]) ||
    hasApproxTokenSet(normalized, ["kind", "gim"]) ||
    hasApproxTokenSet(normalized, ["kind", "club"]) ||
    hasApproxTokenSet(normalized, ["about", "club"])
  );
}

export function resolveDirectCoreFactResponse(args: {
  tenantId: string;
  userMessage: string;
  locale: string | null;
}): MaaChatResponse | null {
  const facts = getTenantCoreFacts(args.tenantId);

  if (!facts) {
    return null;
  }

  if (looksLikePhoneNumberQuestion(args.userMessage, args.locale)) {
    return {
      assistantMessage: isFrenchLocale(args.locale)
        ? facts.phoneNumberFr
        : facts.phoneNumberEn,
      followUpMode: "done",
      citations: [],
      retrieval: {
        query: "direct:phone_number",
        chunkCount: 0,
        resultCount: 0,
      },
    };
  }

  if (looksLikeLocationQuestion(args.userMessage, args.locale)) {
    return {
      assistantMessage: isFrenchLocale(args.locale)
        ? facts.addressFr
        : facts.addressEn,
      followUpMode: "done",
      citations: [],
      retrieval: {
        query: "direct:location",
        chunkCount: 0,
        resultCount: 0,
      },
    };
  }

  if (looksLikeHoursQuestion(args.userMessage, args.locale)) {
    return {
      assistantMessage: isFrenchLocale(args.locale)
        ? facts.hoursFr
        : facts.hoursEn,
      followUpMode: "done",
      citations: [],
      retrieval: {
        query: "direct:hours",
        chunkCount: 0,
        resultCount: 0,
      },
    };
  }

  if (looksLikeClubDescriptionQuestion(args.userMessage, args.locale)) {
    return {
      assistantMessage: isFrenchLocale(args.locale)
        ? facts.descriptionFr
        : facts.descriptionEn,
      followUpMode: "done",
      citations: [],
      retrieval: {
        query: "direct:club_description",
        chunkCount: 0,
        resultCount: 0,
      },
    };
  }

  return null;
}