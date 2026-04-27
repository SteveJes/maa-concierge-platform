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
    text.includes("ferme") ||
    // "if I arrive at 5am is it open?" style questions
    /\b(arrive|arriver|viens|là)\b.*\b\d{1,2}h?\b/i.test(userMessage) ||
    /\b\d{1,2}(h|am|pm)\b.*\b(open|ouvert|fermé|closed|encore)/i.test(userMessage)
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
    text.includes("squash") ||
    text.includes("plateaux d’entraînement") ||
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
  // Strip nav/footer bleed-in from scraped pages
  text = text.replace(/\s*joindre l['']équipe[\s\S]*/i, "");
  text = text.replace(/\s*cliquez sur le nom[\s\S]*/i, "");
  text = text.replace(/\s*envoyez un courriel[\s\S]*/i, "");
  text = text.replace(/\s*appelez[\s\S]*/i, "");
  text = text.replace(/\s*contact us[\s\S]*/i, "");
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
    if (kind === "club") return "du club";
    if (kind === "pool") return "de la piscine";
    return "du spa";
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

// Parse a time string like "6h", "6h00", "6:00 AM", "22h" into minutes since midnight
function parseTimeToMinutes(t: string): number | null {
  const m24 = /(\d{1,2})\s*h(\d{2})?/.exec(t);
  if (m24) return parseInt(m24[1]!, 10) * 60 + parseInt(m24[2] ?? "0", 10);
  const m12 = /(\d{1,2}):(\d{2})\s*(AM|PM)/i.exec(t);
  if (m12) {
    let h = parseInt(m12[1]!, 10);
    const min = parseInt(m12[2]!, 10);
    if (/PM/i.test(m12[3]!) && h !== 12) h += 12;
    if (/AM/i.test(m12[3]!) && h === 12) h = 0;
    return h * 60 + min;
  }
  return null;
}

// Extract the earliest opening time across blocks (e.g., club opens at 6h)
function earliestOpeningMinutes(blocks: ScheduleBlock[]): number | null {
  const times: number[] = [];
  for (const block of blocks) {
    const m = /(?:lundi|monday|lun).*?(\d{1,2}\s*h\d{0,2}|\d{1,2}:\d{2}\s*(?:AM|PM))/i.exec(block.text);
    if (m) {
      const t = parseTimeToMinutes(m[1]!);
      if (t !== null) times.push(t);
    }
  }
  return times.length > 0 ? Math.min(...times) : null;
}

// Detect "if I arrive at X am/pm" pattern and return minutes, or null
function extractArrivalTime(userMessage: string): number | null {
  const patterns = [
    /(?:arrive?|come|show up|get there|viens?|arrive|arriver?|suis là|là).*?(?:at|à|vers|around)?\s*(\d{1,2})[h:]?(\d{2})?\s*(am|pm|h)?/i,
    /(?:at|à|vers)\s*(\d{1,2})[h:]?(\d{2})?\s*(am|pm|h)?/i,
    /(\d{1,2})[h:](\d{2})?\s*(am|pm)?.*(?:open|ouvert|fermé|closed)/i,
  ];
  for (const pat of patterns) {
    const m = pat.exec(userMessage);
    if (m) {
      let h = parseInt(m[1]!, 10);
      const min = parseInt(m[2] ?? "0", 10);
      const suffix = (m[3] ?? "").toLowerCase();
      if (suffix === "pm" && h !== 12) h += 12;
      if (suffix === "am" && h === 12) h = 0;
      if (h >= 0 && h <= 23) return h * 60 + min;
    }
  }
  return null;
}

function buildScheduleAnswer(
  userMessage: string,
  blocks: ScheduleBlock[],
): string {
  const isFrench = isFrenchMessage(userMessage);

  const hedge = isFrench
    ? "\n\nLes horaires peuvent varier selon la période. Nous vous recommandons d’appeler au 514 845-2233, poste 234 pour confirmer."
    : "\n\nHours may vary. We recommend calling at (514) 845-2233, ext. 234 to confirm current times.";

  // Detect "will I be in time / is it open at X?" and answer directly
  const arrivalMinutes = extractArrivalTime(userMessage);
  if (arrivalMinutes !== null) {
    const openingMinutes = earliestOpeningMinutes(blocks);
    if (openingMinutes !== null) {
      const arrivalH = Math.floor(arrivalMinutes / 60);
      const arrivalM = arrivalMinutes % 60;
      const openH = Math.floor(openingMinutes / 60);
      const arrivalStr = `${arrivalH}h${arrivalM > 0 ? String(arrivalM).padStart(2, "0") : ""}`;
      const openStr = `${openH}h`;
      const isClosed = arrivalMinutes < openingMinutes;
      const directAnswer = isClosed
        ? isFrench
          ? `Non, à ${arrivalStr} le club n’est pas encore ouvert — le premier espace disponible ouvre à ${openStr}. Voici les horaires complets :`
          : `No, at ${arrivalStr} the club is not yet open — the earliest opening is at ${openStr}. Here are the full hours:`
        : isFrench
          ? `Oui, à ${arrivalStr} vous pouvez entrer — voici les horaires complets :`
          : `Yes, at ${arrivalStr} the club is open — here are the full hours:`;

      const lines = blocks.map((b) => `• ${getLabel(b.kind, isFrench)} : ${b.text}`).join("\n");
      return `${directAnswer}\n\n${lines}${hedge}`;
    }
  }

  if (blocks.length === 1) {
    const block = blocks[0]!;
    const answer = isFrench
      ? `Voici les horaires ${getFacilityPhrase(block.kind, true)} :\n\n${block.text}`
      : `Here are the ${getFacilityPhrase(block.kind, false)} hours:\n\n${block.text}`;
    return answer + hedge;
  }

  const lines = blocks.map((b) => `• ${getLabel(b.kind, isFrench)} : ${b.text}`).join("\n");
  const intro = isFrench
    ? "Voici nos horaires par espace :"
    : "Here are our hours by area:";

  return `${intro}\n\n${lines}${hedge}`;
}

function buildScheduleClarifyAnswer(userMessage: string): string {
  return isFrenchMessage(userMessage)
    ? "Les horaires varient selon l’espace. Précisez si vous cherchez les horaires du club, de la piscine ou du spa, ou appelez-nous pour les heures à jour."
    : "Hours vary by area. Let me know if you want club, pool, or spa hours, or give us a call for the most current schedule.";
}

// If the user is asking about a specific activity/class type, the deterministic
// schedule handler cannot help — it only knows club/pool/spa hours. Let AI+retrieval
// handle these so the pilates schedule PDF chunks can be surfaced correctly.
function isActivitySpecificScheduleQuestion(userMessage: string): boolean {
  const text = normalizeLower(userMessage);

  return /\b(pilates|yoga|spinning|spin|zumba|barre|hiit|aerobic|aqua|natation|cardio|stretching|crossfit|boxing|kickboxing|circus|aérien|trapèze|reformer|cardio-vélo|powerwatts|triathlon|aquaforme|aquafit)\b/i.test(
    text,
  );
}

export function tryAnswerScheduleQuestion(
  userMessage: string,
  searchResults: SearchResult[],
): MaaScheduleAnswer | null {
  if (!isScheduleQuestion(userMessage)) {
    return null;
  }

  // Activity-specific schedule questions must go to AI+retrieval — we don't have
  // deterministic data for individual class types (pilates, yoga, etc.)
  if (isActivitySpecificScheduleQuestion(userMessage)) {
    return null;
  }

  const extractedBlocks = extractScheduleBlocks(searchResults);
  const relevantBlocks = selectRelevantBlocks(userMessage, extractedBlocks);

  if (relevantBlocks.length === 0) {
    // If the user specified a facility (pool/spa/club/squash) but we couldn't find
    // that block in the search results, let AI+retrieval handle it — don't confuse
    // the user with a generic "which area?" clarify.
    const askedSpecific =
      wantsPool(userMessage) || wantsSpa(userMessage) || wantsClub(userMessage);
    if (askedSpecific) {
      return null;
    }

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