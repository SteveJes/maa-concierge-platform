import type { SearchResult } from "@platform/retrieval";

export interface MaaPricingAnswer {
  assistantMessage: string;
  followUpMode: "done" | "clarify";
  usedCitations: number[];
}

interface MembershipPriceRow {
  label: string;
  amount: string;
  billingText: string | null;
  sourceIndexes: number[];
}

interface MembershipRowConfig {
  label: string;
  patterns: RegExp[];
  billingTextWhenMonthly: string | null;
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

export function isPricingQuestion(userMessage: string): boolean {
  const text = userMessage.toLowerCase();

  return (
    text.includes("fee") ||
    text.includes("fees") ||
    text.includes("price") ||
    text.includes("prices") ||
    text.includes("cost") ||
    text.includes("costs") ||
    text.includes("membership fee") ||
    text.includes("membership fees") ||
    text.includes("membership cost") ||
    text.includes("membership costs") ||
    text.includes("pricing") ||
    text.includes("membership pricing") ||
    text.includes("annual membership")
  );
}

function findResultIndexes(
  results: SearchResult[],
  predicate: (result: SearchResult) => boolean,
): number[] {
  const indexes: number[] = [];

  results.forEach((result, index) => {
    if (predicate(result)) {
      indexes.push(index);
    }
  });

  return indexes;
}

function isMembershipSource(result: SearchResult): boolean {
  const title = (result.sourceTitle ?? "").toLowerCase();
  const url = result.citationLabel.toLowerCase();

  return title.includes("membership") || url.includes("/membership");
}

function isSpaSource(result: SearchResult): boolean {
  const title = (result.sourceTitle ?? "").toLowerCase();
  const url = result.citationLabel.toLowerCase();

  return title.includes("spa") || url.includes("/spa");
}

function extractAmountFromContent(
  content: string,
  patterns: RegExp[],
): string | null {
  for (const pattern of patterns) {
    const match = content.match(pattern);
    if (match?.[1]) {
      return `$${match[1]}`;
    }
  }

  return null;
}

function hasMonthlyQualifier(results: SearchResult[]): boolean {
  return results.some(
    (result) =>
      isMembershipSource(result) &&
      /fees\s*\(monthly\)/i.test(result.content),
  );
}

function extractMembershipRows(results: SearchResult[]): MembershipPriceRow[] {
  const monthly = hasMonthlyQualifier(results);

  const rowConfigs: MembershipRowConfig[] = [
    {
      label: "1-year membership",
      patterns: [
        /1\s*year\s*membership[\s\S]{0,40}?\$?\s*(\d+)/i,
      ],
      billingTextWhenMonthly: "per month for a 1-year term",
    },
    {
      label: "Senior membership (70+, 1-year term)",
      patterns: [
        /senior\s*yearly\s*\(?\s*70\+?\s*\)?[\s\S]{0,40}?\$?\s*(\d+)/i,
      ],
      billingTextWhenMonthly: "per month for a 1-year term",
    },
    {
      label: "Student membership (25 and under, 1-year term)",
      patterns: [
        /students?\s*yearly\s*\(?\s*25\s*and\s*under\s*\)?[\s\S]{0,40}?\$?\s*(\d+)/i,
      ],
      billingTextWhenMonthly: "per month for a 1-year term",
    },
    {
      label: "1-month membership",
      patterns: [
        /1\s*month\s*membership[\s\S]{0,40}?\$?\s*(\d+)/i,
      ],
      billingTextWhenMonthly: "per month",
    },
  ];

  const rows: MembershipPriceRow[] = [];

  for (const config of rowConfigs) {
    let foundAmount: string | null = null;
    const sourceIndexes: number[] = [];

    results.forEach((result, index) => {
      if (!isMembershipSource(result)) {
        return;
      }

      const amount = extractAmountFromContent(result.content, config.patterns);
      if (!amount) {
        return;
      }

      foundAmount = amount;
      sourceIndexes.push(index);
    });

    if (foundAmount) {
      rows.push({
        label: config.label,
        amount: foundAmount,
        billingText: monthly ? config.billingTextWhenMonthly : null,
        sourceIndexes: uniqueNumbers(sourceIndexes),
      });
    }
  }

  return rows;
}

function extractInitiationFee(results: SearchResult[]): {
  text: string | null;
  sourceIndexes: number[];
} {
  const sourceIndexes: number[] = [];

  for (const [index, result] of results.entries()) {
    if (!isMembershipSource(result)) {
      continue;
    }

    const normalized = normalizeText(result.content);
    const match = normalized.match(
      /initiation fee.*?promo free\s*\$?\s*(\d+).*?value of\s*\$?\s*(\d+)/i,
    );

    if (match) {
      sourceIndexes.push(index);
      return {
        text: `There is currently no initiation fee ($${match[1]}, a $${match[2]} value).`,
        sourceIndexes,
      };
    }
  }

  return { text: null, sourceIndexes: [] };
}

function findPoolEvidenceIndexes(results: SearchResult[]): number[] {
  return findResultIndexes(results, (result) => {
    const content = normalizeLower(result.content);

    const relevantSource = isMembershipSource(result) || isSpaSource(result);

    const poolMention =
      content.includes("swimming pool") ||
      content.includes("25m indoor pool") ||
      content.includes("pool, whirlpool") ||
      content.includes("pool access") ||
      content.includes("the pool");

    const inclusionMention =
      content.includes("included in your membership") ||
      content.includes("includes access to the swimming pool") ||
      content.includes("membership includes") ||
      content.includes("included with membership");

    return relevantSource && poolMention && inclusionMention;
  });
}

function buildMembershipAnswer(
  rows: MembershipPriceRow[],
  initiationFee: string | null,
  poolIncluded: boolean,
): string {
  const parts: string[] = [];

  if (rows.length > 0) {
    const rowText = rows
      .map((row) =>
        row.billingText
          ? `${row.label}: ${row.amount} ${row.billingText}`
          : `${row.label}: ${row.amount}`,
      )
      .join("; ");

    parts.push(`Club Sportif MAA membership pricing currently appears as follows: ${rowText}.`);
  }

  if (initiationFee) {
    parts.push(initiationFee);
  }

  if (poolIncluded) {
    parts.push("Membership includes pool access.");
  }

  return parts.join(" ");
}

export function tryAnswerPricingQuestion(
  userMessage: string,
  searchResults: SearchResult[],
): MaaPricingAnswer | null {
  if (!isPricingQuestion(userMessage)) {
    return null;
  }

  const rows = extractMembershipRows(searchResults);
  const initiation = extractInitiationFee(searchResults);
  const poolIndexes = findPoolEvidenceIndexes(searchResults);
  const poolIncluded = poolIndexes.length > 0;

  if (rows.length === 0 && !initiation.text && !poolIncluded) {
    return null;
  }

  const usedCitations = uniqueNumbers([
    ...rows.flatMap((row) => row.sourceIndexes),
    ...initiation.sourceIndexes,
    ...poolIndexes,
  ]);

  return {
    assistantMessage: buildMembershipAnswer(
      rows,
      initiation.text,
      poolIncluded,
    ),
    followUpMode: "done",
    usedCitations,
  };
}