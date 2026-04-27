import type { SearchResult } from "@platform/retrieval";

export interface MaaPolicyAnswer {
  assistantMessage: string;
  followUpMode: "done" | "clarify";
  usedCitations: number[];
}

interface MassagePolicyFacts {
  healthForm: boolean;
  arriveTenMinutesEarly: boolean;
  insuranceReceipt: boolean;
  notice24Hours: boolean;
  sourceIndexes: number[];
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeLower(value: string): string {
  return normalizeText(value).toLowerCase();
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

function uniqueNumbers(values: number[]): number[] {
  return [...new Set(values)].sort((a, b) => a - b);
}

function isFrenchMessage(userMessage: string): boolean {
  const text = normalizeLower(userMessage);

  return (
    /[àâçéèêëîïôûùüÿœ]/i.test(userMessage) ||
    text.includes("politique") ||
    text.includes("annulation") ||
    text.includes("annuler") ||
    text.includes("massothérapie") ||
    text.includes("formulaire de santé") ||
    text.includes("reçu") ||
    text.includes("invité") ||
    text.includes("visiteur")
  );
}

export function isPolicyQuestion(userMessage: string): boolean {
  const text = normalizeLower(userMessage);

  return (
    text.includes("policy") ||
    text.includes("policies") ||
    text.includes("cancellation") ||
    text.includes("cancel") ||
    text.includes("notice") ||
    text.includes("health form") ||
    text.includes("insurance receipt") ||
    text.includes("guest policy") ||
    text.includes("visitor policy") ||
    text.includes("politique") ||
    text.includes("politiques") ||
    text.includes("annulation") ||
    text.includes("annuler") ||
    text.includes("formulaire de santé") ||
    text.includes("reçu") ||
    text.includes("invité") ||
    text.includes("visiteur")
  );
}

function wantsGuestPolicy(userMessage: string): boolean {
  const text = normalizeLower(userMessage);

  return (
    text.includes("guest") ||
    text.includes("visitor") ||
    text.includes("invité") ||
    text.includes("visiteur")
  );
}

function wantsCancellationPolicy(userMessage: string): boolean {
  const text = normalizeLower(userMessage);

  const hasCancelWord =
    text.includes("cancellation") ||
    text.includes("cancel") ||
    text.includes("annulation") ||
    text.includes("annuler");

  if (!hasCancelWord) {
    return false;
  }

  // Only intercept cancellation questions that are clearly about massage/spa appointments,
  // not membership cancellation or other unrelated topics.
  const hasMassageContext =
    text.includes("massage") ||
    text.includes("appointment") ||
    text.includes("rendez-vous") ||
    text.includes("séance") ||
    text.includes("seance") ||
    text.includes("spa") ||
    text.includes("session");

  return hasMassageContext;
}

function looksLikeMassagePolicyContent(result: SearchResult): boolean {
  const content = decodeBasicHtmlEntities(normalizeLower(result.content));
  const title = normalizeLower(result.sourceTitle ?? "");
  const url = normalizeLower(result.citationLabel);

  const hasPolicySection =
    content.includes("massage therapy policies") ||
    content.includes("politiques pour les massages") ||
    content.includes("formulaire de santé") ||
    content.includes("health form") ||
    content.includes("24-hour notice") ||
    content.includes("24 heures");

  const relevantSource =
    title.includes("massage") ||
    title.includes("spa") ||
    url.includes("/massage") ||
    url.includes("/spa") ||
    url.includes("massotherapie");

  return hasPolicySection || relevantSource;
}

function extractMassagePolicyFacts(results: SearchResult[]): MassagePolicyFacts {
  const facts: MassagePolicyFacts = {
    healthForm: false,
    arriveTenMinutesEarly: false,
    insuranceReceipt: false,
    notice24Hours: false,
    sourceIndexes: [],
  };

  results.forEach((result, index) => {
    const content = decodeBasicHtmlEntities(normalizeLower(result.content));

    if (!looksLikeMassagePolicyContent(result)) {
      return;
    }

    let matched = false;

    if (
      content.includes("health form") ||
      content.includes("formulaire de santé")
    ) {
      facts.healthForm = true;
      matched = true;
    }

    if (
      content.includes("please come 10 minutes before your session") ||
      content.includes("veuillez prévoir 10 minutes avant votre séance")
    ) {
      facts.arriveTenMinutesEarly = true;
      matched = true;
    }

    if (
      content.includes("receipt for your insurance") ||
      content.includes("reçu pour vos assurances")
    ) {
      facts.insuranceReceipt = true;
      matched = true;
    }

    if (
      content.includes("24-hour notice is required") ||
      content.includes("24 hours est requis") ||
      content.includes("24 heures est requis") ||
      content.includes("for cancellations or time changes") ||
      content.includes("annuler sans frais") ||
      content.includes("modifier l’heure")
    ) {
      facts.notice24Hours = true;
      matched = true;
    }

    if (matched) {
      facts.sourceIndexes.push(index);
    }
  });

  facts.sourceIndexes = uniqueNumbers(facts.sourceIndexes);

  return facts;
}

function buildGuestPolicyClarify(userMessage: string): string {
  return isFrenchMessage(userMessage)
    ? "Je n’ai pas de politique confirmée sur les invités ou visiteurs. Pour les politiques de massage ou spa, je peux vous aider. Sinon, contactez le Club directement pour confirmer."
    : "I don’t have confirmed guest or visitor policy details on hand. I can help with massage or spa policies. Otherwise, the Club team can confirm directly.";
}

function buildGenericPolicyClarify(userMessage: string): string {
  return isFrenchMessage(userMessage)
    ? "Je n’ai pas assez d’information confirmée pour répondre à cette question de politique. Si vous cherchez les politiques de massage ou spa, je peux vous aider."
    : "I don’t have enough confirmed policy details to answer that one. If you’re asking about massage or spa policies, I can help with those.";
}

function buildCancellationAnswer(
  userMessage: string,
  facts: MassagePolicyFacts,
): string {
  const isFrench = isFrenchMessage(userMessage);

  if (facts.notice24Hours) {
    return isFrench
      ? "Un avis de 24 heures est requis pour annuler sans frais un rendez-vous de massage ou en modifier l’heure."
      : "A 24-hour notice is required to cancel a massage appointment without charge or to change the time.";
  }

  return buildGenericPolicyClarify(userMessage);
}

function buildMassagePolicyAnswer(
  userMessage: string,
  facts: MassagePolicyFacts,
): string {
  const isFrench = isFrenchMessage(userMessage);
  const parts: string[] = [];

  if (facts.healthForm) {
    parts.push(
      isFrench
        ? "vous devez remplir un formulaire de santé lors de votre première visite"
        : "you must complete a health form on your first visit",
    );
  }

  if (facts.arriveTenMinutesEarly) {
    parts.push(
      isFrench
        ? "vous devez prévoir 10 minutes avant la séance pour le compléter et profiter du temps complet"
        : "you should arrive 10 minutes before your session to complete it and keep your full treatment time",
    );
  }

  if (facts.insuranceReceipt) {
    parts.push(
      isFrench
        ? "un reçu pour vos assurances peut être remis avec votre facture"
        : "an insurance receipt can be provided with your invoice",
    );
  }

  if (facts.notice24Hours) {
    parts.push(
      isFrench
        ? "un avis de 24 heures est requis pour annuler sans frais un rendez-vous ou en modifier l’heure"
        : "a 24-hour notice is required to cancel without charge or change the appointment time",
    );
  }

  if (parts.length === 0) {
    return buildGenericPolicyClarify(userMessage);
  }

  const joined = parts.join("; ");

  return isFrench
    ? `Voici ce que nous demandons pour les massages : ${joined}.`
    : `Here's what to know for your massage appointment: ${joined}.`;
}

function hasMassageOrSpaContext(userMessage: string): boolean {
  const text = normalizeLower(userMessage);

  return (
    text.includes("massage") ||
    text.includes("spa") ||
    text.includes("appointment") ||
    text.includes("rendez-vous") ||
    text.includes("séance") ||
    text.includes("seance") ||
    text.includes("session") ||
    text.includes("health form") ||
    text.includes("formulaire de sante") ||
    text.includes("insurance") ||
    text.includes("assurance")
  );
}

export function tryAnswerPolicyQuestion(
  userMessage: string,
  searchResults: SearchResult[],
): MaaPolicyAnswer | null {
  if (!isPolicyQuestion(userMessage)) {
    return null;
  }

  // Only intercept if the question is clearly about massage, spa, or appointment policies.
  // Generic cancellation questions (e.g. "cancel my membership") go to the AI.
  if (!wantsGuestPolicy(userMessage) && !hasMassageOrSpaContext(userMessage)) {
    return null;
  }

  if (wantsGuestPolicy(userMessage)) {
    return {
      assistantMessage: buildGuestPolicyClarify(userMessage),
      followUpMode: "clarify",
      usedCitations: [],
    };
  }

  const facts = extractMassagePolicyFacts(searchResults);

  if (
    !facts.healthForm &&
    !facts.arriveTenMinutesEarly &&
    !facts.insuranceReceipt &&
    !facts.notice24Hours
  ) {
    return {
      assistantMessage: buildGenericPolicyClarify(userMessage),
      followUpMode: "clarify",
      usedCitations: [],
    };
  }

  const assistantMessage = wantsCancellationPolicy(userMessage)
    ? buildCancellationAnswer(userMessage, facts)
    : buildMassagePolicyAnswer(userMessage, facts);

  return {
    assistantMessage,
    followUpMode: "done",
    usedCitations: facts.sourceIndexes,
  };
}