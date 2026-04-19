import type { SearchResult } from "@platform/retrieval";

export interface MaaScheduleAnswer {
  assistantMessage: string;
  followUpMode: "done" | "clarify";
  usedCitations: number[];
}

type ScheduleKind = "club" | "pool" | "spa";

interface ScheduleBlock {
  kind: ScheduleKind;
  text: string;
  sourceIndexes: number[];
}

interface ScheduleConfig {
  kind: ScheduleKind;
  patterns: RegExp[];
  allowGenericHoursSource?: boolean;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLower(value: string): string {
  return normalizeText(value).toLowerCase();
}

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&rsquo;|&#8217;/gi, "'")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;|&#038;/gi, "&")
    .replace(/&eacute;/gi, "é")
    .replace(/&egrave;/gi, "è")
    .replace(/&ecirc;/gi, "ê")
    .replace(/&agrave;/gi, "à")
    .replace(/&ccedil;/gi, "ç");
}

function isFrenchMessage(userMessage: string): boolean {
  const text = normalizeLower(userMessage);

  return (
    /[àâçéèêëîïôûùüÿœ]/i.test(userMessage) ||
    text.includes("horaire") ||
    text.includes("horaires") ||
    text.includes("heure") ||
    text.includes("heures") ||
    text.includes("ouvert") ||
    text.includes("ouverte") ||
    text.includes("fermé") ||
    text.includes("ferme") ||
    text.includes("piscine")
  );
}

export function isScheduleQuestion(userMessage: string): boolean {
  const text = normalizeLower(userMessage);

  return (
    text.includes("hour") ||
    text.includes("hours") ||
    text.includes("open") ||
    text.includes("opening") ||
    text.includes("closing") ||
    text.includes("schedule") ||
    text.includes("horaire") ||
    text.includes("horaires") ||
    text.includes("heure") ||
    text.includes("heures") ||
    text.includes("ouvert") ||
    text.includes("ouverte") ||
    text.includes("fermé") ||
    text.includes("ferme")
  );
}

function wantsPool(userMessage: string): boolean {
  const text = normalizeLower(userMessage);

  return (
    text.includes("pool") ||
    text.includes("swimming pool") ||
    text.includes("pool and terrace") ||
    text.includes("piscine")
  );
}

function wantsSpa(userMessage: string): boolean {
  const text = normalizeLower(userMessage);

  return (
    text.includes("spa") ||
    text.includes("sauna") ||
    text.includes("steam bath") ||
    text.includes("hot tub") ||
    text.includes("whirlpool") ||
    text.includes("massage") ||
    text.includes("bain vapeur") ||
    text.includes("tourbillon")
  );
}

function wantsClub(userMessage: string): boolean {
  const text = normalizeLower(userMessage);

  return (
    text.includes("club") ||
    text.includes("gym") ||
    text.includes("fitness") ||
    text.includes("facility") ||
    text.includes("training center") ||
    text.includes("plateaux d'entraînement") ||
    text.includes("plateaux d’entraînement")
  );
}

function isHoursSource(result: SearchResult): boolean {
  const haystack = `${result.sourceTitle ?? ""} ${result.citationLabel}`.toLowerCase();

  return (
    haystack.includes("hours") ||
    haystack.includes("horaire") ||
    haystack.includes("pool") ||
    haystack.includes("piscine") ||
    haystack.includes("spa") ||
    haystack.includes("visit") ||
    haystack.includes("book-a-tour") ||
    haystack.includes("contact") ||
    haystack.includes("planifier-une-visite") ||
    haystack.includes("nous-joindre")
  );
}

function looksLikeHoursText(value: string): boolean {
  const text = normalizeLower(value);

  const hasDay =
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i.test(
      text,
    );

  const hasTime =
    /(\b\d{1,2}:\d{2}\b|\b\d{1,2}\s*(?:a\.?m\.?|p\.?m\.?|am|pm)\b|\b\d{1,2}\s*h(?:\s*\d{2})?\b)/i.test(
      text,
    );

  return hasDay && hasTime;
}

function cleanExtractedHoursText(value: string): string {
  let text = decodeBasicHtmlEntities(normalizeText(value));

  text = text.replace(/^[:\-–—\s]+/, "");
  text = text.replace(
    /^(?:opening hours\s*)?(?:maa at 2070 peel street\s*)?(?:club|fitness|gym|training center|pool|pool and terrace|swimming pool|piscine|piscine et terrasse|spa|massage therapy|sauna|steam bath|hot tub|whirlpool|bain vapeur|tourbillon)\s*(?:hours?)?\s*[:\-]?\s*/i,
    "",
  );
  text = text.replace(
    /^heures?\s+d['’]ouverture\s*[:\-]?\s*/i,
    "",
  );
  text = text.replace(
    /^(?:maa au 2070,\s*rue peel\s*)?(?:plateaux d['’]entraînement|piscine et terrasse|piscine)\s*[:\-]?\s*/i,
    "",
  );
  text = text.replace(
    /^horaire(?:s)?\s+(?:du\s+club|de\s+la\s+piscine|du\s+spa)\s*[:\-]?\s*/i,
    "",
  );
  text = text.replace(/[;,\-–—:\s]+$/, "");

  return normalizeText(text);
}

function extractGenericHoursText(content: string): string | null {
  const normalized = decodeBasicHtmlEntities(normalizeText(content));

  const patterns: RegExp[] = [
    /((?:monday|lundi)[\s\S]{0,220}?(?:saturday|samedi)[\s\S]{0,80}?(?:sunday|dimanche)[\s\S]{0,80}?)/i,
    /((?:monday|lundi)[\s\S]{0,180}?(?:friday|vendredi)[\s\S]{0,120}?)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const extracted = match?.[1];

    if (!extracted) {
      continue;
    }

    const cleaned = cleanExtractedHoursText(extracted);

    if (looksLikeHoursText(cleaned)) {
      return cleaned;
    }
  }

  return null;
}

const scheduleConfigs: ScheduleConfig[] = [
  {
    kind: "club",
    allowGenericHoursSource: false,
    patterns: [
      /opening hours[\s\S]{0,80}?training center\s*([\s\S]{0,160}?)(?=pool and terrace|membership|programming|sports clinic|spa|maagazine|the club restaurant|restaurant|contact us|communicate with our team|$)/i,
      /heures?\s+d['’]ouverture[\s\S]{0,80}?plateaux d['’]entraînement\s*([\s\S]{0,160}?)(?=piscine et terrasse|abonnement|programmation|clinique sportive|maagazine|le club restaurant|restaurant|contactez-nous|$)/i,
      /(?:club|fitness|gym|training center)\s+hours?\s*[:\-]?\s*([\s\S]{0,220}?)(?=(?:pool|pool and terrace|swimming pool|piscine|piscine et terrasse|spa|massage therapy|sauna|steam bath|hot tub|whirlpool|bain vapeur|tourbillon|squash|studio)\s+hours?|$)/i,
      /horaire(?:s)?\s+du\s+club\s*[:\-]?\s*([\s\S]{0,220}?)(?=(?:horaire(?:s)?\s+de\s+la\s+piscine|horaire(?:s)?\s+du\s+spa|$))/i,
    ],
  },
  {
    kind: "pool",
    allowGenericHoursSource: false,
    patterns: [
      /opening hours[\s\S]{0,160}?pool and terrace\s*([\s\S]{0,160}?)(?=membership|programming|sports clinic|spa|maagazine|the club restaurant|restaurant|contact us|communicate with our team|$)/i,
      /heures?\s+d['’]ouverture[\s\S]{0,160}?piscine et terrasse\s*([\s\S]{0,160}?)(?=abonnement|programmation|clinique sportive|maagazine|le club restaurant|restaurant|contactez-nous|$)/i,
      /(?:pool\s+and\s+terrace|pool|swimming pool|piscine et terrasse|piscine)\s*(?:hours?)?\s*[:\-]?\s*([\s\S]{0,220}?)(?=(?:club|fitness|gym|training center|plateaux d['’]entraînement|spa|massage therapy|sauna|steam bath|hot tub|whirlpool|bain vapeur|tourbillon|squash|studio)\s+hours?|$)/i,
      /horaire(?:s)?\s+de\s+la\s+piscine\s*[:\-]?\s*([\s\S]{0,220}?)(?=(?:horaire(?:s)?\s+du\s+club|horaire(?:s)?\s+du\s+spa|$))/i,
    ],
  },
  {
    kind: "spa",
    allowGenericHoursSource: true,
    patterns: [
      /heures?\s+d['’]ouverture\s*([\s\S]{0,160}?)(?=réserver|reserve|politiques|policies|$)/i,
      /(?:spa|massage therapy)\s+hours?\s*[:\-]?\s*([\s\S]{0,220}?)(?=(?:reserve|réserver|policies|politiques|$))/i,
      /(?:spa|sauna|steam bath|hot tub|whirlpool|bain vapeur|tourbillon)\s+hours?\s*[:\-]?\s*([\s\S]{0,220}?)(?=(?:club|fitness|gym|pool|pool and terrace|swimming pool|piscine|squash|studio)\s+hours?|$)/i,
      /horaire(?:s)?\s+du\s+spa\s*[:\-]?\s*([\s\S]{0,220}?)(?=(?:horaire(?:s)?\s+du\s+club|horaire(?:s)?\s+de\s+la\s+piscine|$))/i,
    ],
  },
];

function extractBlockTextFromResult(
  result: SearchResult,
  config: ScheduleConfig,
): string | null {
  const normalized = decodeBasicHtmlEntities(normalizeText(result.content));

  for (const pattern of config.patterns) {
    const match = normalized.match(pattern);
    const extracted = match?.[1];

    if (!extracted) {
      continue;
    }

    const cleaned = cleanExtractedHoursText(extracted);

    if (looksLikeHoursText(cleaned)) {
      return cleaned;
    }
  }

  if (config.allowGenericHoursSource && isHoursSource(result)) {
    return extractGenericHoursText(normalized);
  }

  return null;
}

function extractScheduleBlocks(results: SearchResult[]): ScheduleBlock[] {
  const blocks: ScheduleBlock[] = [];

  for (const config of scheduleConfigs) {
    let blockText: string | null = null;
    const sourceIndexes: number[] = [];

    results.forEach((result, index) => {
      const extracted = extractBlockTextFromResult(result, config);

      if (!extracted) {
        return;
      }

      if (!blockText) {
        blockText = extracted;
        sourceIndexes.push(index);
        return;
      }

      if (extracted === blockText) {
        sourceIndexes.push(index);
      }
    });

    if (blockText) {
      blocks.push({
        kind: config.kind,
        text: blockText,
        sourceIndexes: uniqueNumbers(sourceIndexes),
      });
    }
  }

  return blocks;
}

function getLabel(kind: ScheduleKind, isFrench: boolean): string {
  if (isFrench) {
    if (kind === "club") return "Horaires du club";
    if (kind === "pool") return "Horaires de la piscine";
    return "Horaires du spa";
  }

  if (kind === "club") return "Club hours";
  if (kind === "pool") return "Pool hours";
  return "Spa hours";
}

function getFacilityPhrase(kind: ScheduleKind, isFrench: boolean): string {
  if (isFrench) {
    if (kind === "club") return "le club";
    if (kind === "pool") return "la piscine";
    return "le spa";
  }

  if (kind === "club") return "club";
  if (kind === "pool") return "pool";
  return "spa";
}

function selectRelevantBlocks(
  userMessage: string,
  blocks: ScheduleBlock[],
): ScheduleBlock[] {
  if (wantsPool(userMessage)) {
    return blocks.filter((block) => block.kind === "pool");
  }

  if (wantsSpa(userMessage)) {
    return blocks.filter((block) => block.kind === "spa");
  }

  if (wantsClub(userMessage)) {
    return blocks.filter((block) => block.kind === "club");
  }

  return blocks;
}

function buildScheduleAnswer(
  userMessage: string,
  blocks: ScheduleBlock[],
): string {
  const isFrench = isFrenchMessage(userMessage);

  const hedge = isFrench
    ? " Les horaires peuvent varier — nous vous recommandons d’appeler pour confirmer."
    : " Hours may vary — we recommend calling to confirm current times.";

  if (blocks.length === 1) {
    const block = blocks[0]!;

    const answer = isFrench
      ? `Voici les horaires de ${getFacilityPhrase(block.kind, true)} : ${block.text}.`
      : `Here are the ${getFacilityPhrase(block.kind, false)} hours on file: ${block.text}.`;

    return answer + hedge;
  }

  const joined = blocks
    .map((block) => `${getLabel(block.kind, isFrench)}: ${block.text}`)
    .join("; ");

  const answer = isFrench
    ? `Voici les horaires : ${joined}.`
    : `Here are the hours on file: ${joined}.`;

  return answer + hedge;
}

function buildScheduleClarifyAnswer(userMessage: string): string {
  return isFrenchMessage(userMessage)
    ? "Les horaires varient selon l’espace. Précisez si vous cherchez les horaires du club, de la piscine ou du spa — ou appelez-nous pour les heures à jour."
    : "Hours vary by area. Let me know if you want club, pool, or spa hours — or give us a call for the most current schedule.";
}

export function tryAnswerScheduleQuestion(
  userMessage: string,
  searchResults: SearchResult[],
): MaaScheduleAnswer | null {
  if (!isScheduleQuestion(userMessage)) {
    return null;
  }

  const extractedBlocks = extractScheduleBlocks(searchResults);
  const relevantBlocks = selectRelevantBlocks(userMessage, extractedBlocks);

  if (relevantBlocks.length === 0) {
    return {
      assistantMessage: buildScheduleClarifyAnswer(userMessage),
      followUpMode: "clarify",
      usedCitations: [],
    };
  }

  return {
    assistantMessage: buildScheduleAnswer(userMessage, relevantBlocks),
    followUpMode: "done",
    usedCitations: uniqueNumbers(
      relevantBlocks.flatMap((block) => block.sourceIndexes),
    ),
  };
}