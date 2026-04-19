import type { SearchResult } from "@platform/retrieval";

export interface MaaPricingAnswer {
  assistantMessage: string;
  followUpMode: "done" | "clarify";
  usedCitations: number[];
}

interface MembershipPriceRow {
  label: string;
  labelFr: string;
  amount: string;
  billingText: string | null;
  billingTextFr: string | null;
  sourceIndexes: number[];
}

interface MembershipRowConfig {
  label: string;
  labelFr: string;
  patterns: RegExp[];
  billingTextWhenMonthly: string | null;
  billingTextWhenMonthlyFr: string | null;
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
    text.includes("annual membership") ||
    text.includes("abonnement") ||
    text.includes("abonement") ||
    text.includes("tarif") ||
    text.includes("combien") ||
    text.includes("frais") ||
    text.includes("mensuel") ||
    text.includes("annuel") ||
    text.includes("discount") ||
    text.includes("rabais") ||
    text.includes("étudiant") ||
    text.includes("senior") ||
    text.includes("reduction") ||
    text.includes("réduction")
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
      labelFr: "Abonnement 1 an",
      patterns: [
        /1\s*year\s*membership[\s\S]{0,40}?\$?\s*(\d+)/i,
      ],
      billingTextWhenMonthly: "per month for a 1-year term",
      billingTextWhenMonthlyFr: "par mois pour un terme de 1 an",
    },
    {
      label: "Senior membership (70+, 1-year term)",
      labelFr: "Abonnement senior (70 ans et plus, terme de 1 an)",
      patterns: [
        /senior\s*yearly\s*\(?\s*70\+?\s*\)?[\s\S]{0,40}?\$?\s*(\d+)/i,
      ],
      billingTextWhenMonthly: "per month for a 1-year term",
      billingTextWhenMonthlyFr: "par mois pour un terme de 1 an",
    },
    {
      label: "Student membership (25 and under, 1-year term)",
      labelFr: "Abonnement étudiant (25 ans et moins, terme de 1 an)",
      patterns: [
        /students?\s*yearly\s*\(?\s*25\s*and\s*under\s*\)?[\s\S]{0,40}?\$?\s*(\d+)/i,
      ],
      billingTextWhenMonthly: "per month for a 1-year term",
      billingTextWhenMonthlyFr: "par mois pour un terme de 1 an",
    },
    {
      label: "1-month membership",
      labelFr: "Abonnement mensuel",
      patterns: [
        /1\s*month\s*membership[\s\S]{0,40}?\$?\s*(\d+)/i,
      ],
      billingTextWhenMonthly: "per month",
      billingTextWhenMonthlyFr: "par mois",
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
        labelFr: config.labelFr,
        amount: foundAmount,
        billingText: monthly ? config.billingTextWhenMonthly : null,
        billingTextFr: monthly ? config.billingTextWhenMonthlyFr : null,
        sourceIndexes: uniqueNumbers(sourceIndexes),
      });
    }
  }

  return rows;
}

function extractInitiationFee(results: SearchResult[]): {
  amount: string | null;
  value: string | null;
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
        amount: match[1] ?? null,
        value: match[2] ?? null,
        sourceIndexes,
      };
    }
  }

  return { amount: null, value: null, sourceIndexes: [] };
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
  initiationFee: { amount: string | null; value: string | null },
  poolIncluded: boolean,
  locale?: string | null,
): string {
  const fr = locale != null && (locale === "fr" || locale.startsWith("fr-"));
  const parts: string[] = [];

  if (rows.length > 0) {
    const rowText = rows
      .map((row) => {
        const label = fr ? row.labelFr : row.label;
        const billing = fr ? row.billingTextFr : row.billingText;
        const sep = fr ? " : " : ": ";
        return billing ? `${label}${sep}${row.amount} ${billing}` : `${label}${sep}${row.amount}`;
      })
      .join("; ");

    parts.push(
      fr
        ? `Voici nos tarifs d'abonnement actuels : ${rowText}.`
        : `Here's what membership looks like right now: ${rowText}.`,
    );
  }

  if (initiationFee.amount !== null && initiationFee.value !== null) {
    parts.push(
      fr
        ? `Les frais d'initiation sont présentement offerts gratuitement (0 $, une valeur de ${initiationFee.value} $).`
        : `There is currently no initiation fee ($${initiationFee.amount}, a $${initiationFee.value} value).`,
    );
  }

  if (poolIncluded) {
    parts.push(
      fr
        ? "L'adhésion comprend l'accès à la piscine."
        : "Membership includes pool access.",
    );
  }

  parts.push(
    fr
      ? "Les tarifs et promotions peuvent changer — nous vous recommandons d'appeler pour confirmer les prix actuels."
      : "Rates and promotions may change — we recommend calling us to confirm current pricing.",
  );

  return parts.join(" ");
}

export function tryAnswerPricingQuestion(
  userMessage: string,
  searchResults: SearchResult[],
  locale?: string | null,
): MaaPricingAnswer | null {
  if (!isPricingQuestion(userMessage)) {
    return null;
  }

  const rows = extractMembershipRows(searchResults);
  const initiation = extractInitiationFee(searchResults);
  const poolIndexes = findPoolEvidenceIndexes(searchResults);
  const poolIncluded = poolIndexes.length > 0;

  if (rows.length === 0 && initiation.amount === null && !poolIncluded) {
    return null;
  }

  const usedCitations = uniqueNumbers([
    ...rows.flatMap((row) => row.sourceIndexes),
    ...initiation.sourceIndexes,
    ...poolIndexes,
  ]);

  return {
    assistantMessage: buildMembershipAnswer(rows, initiation, poolIncluded, locale),
    followUpMode: "done",
    usedCitations,
  };
}