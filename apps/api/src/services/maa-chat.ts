import {
  searchKnowledgeBase,
  type SearchableChunk,
  type SearchResult,
} from "@platform/retrieval";
import {
  findTenantByCode,
  listDocumentChunks,
  listDocuments,
} from "../ingestion/nocodb.js";
import { buildMaaChatSystemPrompt } from "../prompts/maa-chat-system.js";
import { buildDububChatSystemPrompt } from "../prompts/dubub-chat-system.js";
import {
  isPricingQuestion,
  tryAnswerPricingQuestion,
} from "./maa-pricing.js";
import {
  isScheduleQuestion,
  tryAnswerScheduleQuestion,
} from "./maa-schedule.js";
import {
  isPolicyQuestion,
  tryAnswerPolicyQuestion,
} from "./maa-policy.js";

export type MaaFollowUpMode =
  | "clarify"
  | "calendly"
  | "callback"
  | "vapi"
  | "done";

export interface MaaConversationHistoryTurn {
  role: "user" | "assistant";
  content: string;
}

export interface MaaChatRequest {
  userMessage: string;
  locale?: string;
  maxResults?: number;
  conversationHistory?: MaaConversationHistoryTurn[];
  userName?: string;
  tenantCode?: string;
}

export interface MaaChatCitation {
  citationLabel: string;
  sourceTitle?: string;
  chunkIndex: number;
  score: number;
}

export interface MaaChatResponse {
  assistantMessage: string;
  followUpMode: MaaFollowUpMode;
  citations: MaaChatCitation[];
  retrieval: {
    query: string;
    chunkCount: number;
    resultCount: number;
  };
  usage?: {
    model: string;
    inputTokens: number;
    outputTokens: number;
  };
}

interface OpenAiJsonResponse {
  assistantMessage: string;
  followUpMode: MaaFollowUpMode;
  usedCitations: number[];
}

interface SearchableChunkCacheEntry {
  cachedAt: number;
  chunks: SearchableChunk[];
}

const SEARCHABLE_CHUNK_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour — chunks rarely change
const MAX_HISTORY_TURNS = 8;

const searchableChunkCache = new Map<string, SearchableChunkCacheEntry>();
const searchableChunkBuilds = new Map<string, Promise<SearchableChunk[]>>();

function getOpenAiConfig(): { apiKey: string; model: string } {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  if (!apiKey) {
    throw new Error(
      "Missing OPENAI_API_KEY. Set OPENAI_API_KEY before running the MAA chat test.",
    );
  }

  return { apiKey, model };
}

function normalizeConversationHistory(
  history: MaaConversationHistoryTurn[] | undefined,
): MaaConversationHistoryTurn[] {
  if (!Array.isArray(history)) {
    return [];
  }

  return history
    .filter(
      (turn): turn is MaaConversationHistoryTurn =>
        (turn?.role === "user" || turn?.role === "assistant") &&
        typeof turn?.content === "string" &&
        turn.content.trim().length > 0,
    )
    .map((turn) => ({
      role: turn.role,
      content: turn.content.trim(),
    }))
    .slice(-MAX_HISTORY_TURNS);
}

function isFrenchLocale(locale?: string): boolean {
  return typeof locale === "string" && locale.trim().toLowerCase().startsWith("fr");
}

function buildFallbackResponse(
  userMessage: string,
  locale?: string,
): MaaChatResponse {
  const isFrench =
    locale === "fr-CA" ||
    /[àâçéèêëîïôûùüÿœ]/i.test(userMessage) ||
    /\b(piscine|abonnement|horaire|spa|visite|cours|politique)\b/i.test(userMessage);

  return {
    assistantMessage: isFrench
      ? "Je n’ai pas assez d’information fiable pour répondre correctement à cette question. Pouvez-vous préciser ce que vous voulez savoir? Je peux aussi vous orienter vers une prise de rendez-vous ou une demande de rappel."
      : "I do not have enough reliable information to answer that safely. Could you clarify what you want to know? I can also point you to booking or a callback request.",
    followUpMode: "clarify",
    citations: [],
    retrieval: {
      query: userMessage,
      chunkCount: 0,
      resultCount: 0,
    },
  };
}

function looksLikeMembershipPricingTopic(text: string): boolean {
  return /(?:membership|member|pricing|price|prices|fee|fees|cost|costs|annual|yearly|monthly|initiation|senior|student|etudiant|étudiant|abonnement|abonnements|prix|tarif|tarifs|frais|mensuel|annuel)/i.test(
    text,
  );
}

function isContextDependentFollowUp(userMessage: string): boolean {
  const normalized = userMessage.trim().toLowerCase();

  if (normalized.length <= 24) {
    return true;
  }

  return /^(and|what about|how about|ok|okay|so|then|that|those|it|they|them)\b/i.test(
    normalized,
  ) || /^(et|pis|alors|ok|okay|ça|cela|ceux|celles|qu'en est-il|et la|et le|et les)\b/i.test(
    normalized,
  );
}

function resolveMembershipFollowUpIntent(
  userMessage: string,
  locale: string | undefined,
  conversationHistory: MaaConversationHistoryTurn[],
): string {
  if (!isContextDependentFollowUp(userMessage) || conversationHistory.length === 0) {
    return userMessage;
  }

  const recentUserText = conversationHistory
    .filter((turn) => turn.role === "user")
    .slice(-2)
    .map((turn) => turn.content)
    .join("\n");

  if (!looksLikeMembershipPricingTopic(recentUserText)) {
    return userMessage;
  }

  if (/\b(pool|piscine)\b/i.test(userMessage)) {
    return isFrenchLocale(locale)
      ? "L'abonnement inclut-il l'accès à la piscine ?"
      : "Does membership include pool access?";
  }

  if (/\b(spa|massage|massothérapie|massotherapie)\b/i.test(userMessage)) {
    return isFrenchLocale(locale)
      ? "L'abonnement inclut-il l'accès au spa ou aux massages ?"
      : "Does membership include spa or massage access?";
  }

  if (/\b(class|classes|cours)\b/i.test(userMessage)) {
    return isFrenchLocale(locale)
      ? "Quels cours sont inclus avec l'abonnement ?"
      : "Which classes are included with membership?";
  }

  return userMessage;
}

const SHORT_AFFIRMATIVES = /^(oui|yes|ok|okay|sure|pourquoi pas|why not|allez|allons-y|bien sûr|d'accord|daccord|go ahead|go|yep|yup|absolument|parfait|super|génial|great|sounds good|cool|let's go|lets go|dis-moi|dis moi|tell me more|en savoir plus|j'écoute|je veux savoir|interessant|intéressant|vraiment|really|ah bon|ah oui|c'est quoi|c'est quand|c'est combien)[\s!?.]*$/i;

const DUBUB_BOOKING_COLLECTION_SIGNAL = /entreprise|courriel|email|t[ée]l[ée]phone|nom de famille|pr[ée]nom|confirmer votre cr[ée]neau|cr[ée]neau d[ée]mo|pour planifier|pour r[ée]server|votre num[ée]ro/i;

function resolveDububShortAffirmative(
  userMessage: string,
  conversationHistory: MaaConversationHistoryTurn[],
  locale: string | undefined,
): string {
  if (!SHORT_AFFIRMATIVES.test(userMessage.trim())) return userMessage;

  const lastAssistant = [...conversationHistory].reverse().find((t) => t.role === "assistant");
  if (!lastAssistant) return userMessage;

  const ctx = lastAssistant.content.toLowerCase();
  const fr = isFrenchLocale(locale);

  // "oui" after scheduling/demo offer → trigger booking
  if (/planifier|démo|demo|rendez-vous|rdv|échange|créneau|rencontre|meeting|schedule/.test(ctx)) {
    return fr ? "Je voudrais planifier une démo." : "I'd like to schedule a demo.";
  }
  if (/tarif|plan|prix|essentiel|croissance|prestige|forfait/.test(ctx)) {
    return fr ? "Pouvez-vous m'en dire plus sur vos plans ?" : "Can you tell me more about your plans?";
  }
  return fr ? "Pouvez-vous m'en dire plus ?" : "Can you tell me more?";
}

function resolveShortAffirmativeFollowUp(
  userMessage: string,
  conversationHistory: MaaConversationHistoryTurn[],
  locale: string | undefined,
): string {
  if (!SHORT_AFFIRMATIVES.test(userMessage.trim())) return userMessage;
  if (conversationHistory.length === 0) {
    // No context to anchor to — expand to a warm general intro query
    return isFrenchLocale(locale)
      ? "Parlez-moi du Club Sportif MAA et de ce que vous offrez."
      : "Tell me about Club Sportif MAA and what you offer."
  }

  // Look at the last assistant message to infer topic context
  const lastAssistant = [...conversationHistory]
    .reverse()
    .find((t) => t.role === "assistant");
  if (!lastAssistant) return userMessage;

  const ctx = lastAssistant.content.toLowerCase();
  const fr = isFrenchLocale(locale);

  if (/piscine|pool|swim|natation/.test(ctx))
    return fr ? "Parlez-moi de la piscine et des services inclus dans l'abonnement." : "Tell me about the pool and what's included in the membership.";
  if (/spa|massage|massothérapie|soin/.test(ctx))
    return fr ? "Quels services de spa sont inclus dans l'abonnement ?" : "What spa services are included with membership?";
  if (/cours|class|pilates|yoga|cardio|50/.test(ctx))
    return fr ? "Quels cours de groupe sont disponibles et sont-ils inclus dans l'abonnement ?" : "What group classes are available and are they included in membership?";
  if (/prix|tarif|abonnement|membership|fee|pricing|cost|\$/.test(ctx))
    return fr ? "Quels sont vos tarifs d'abonnement ?" : "What are your membership rates?";
  if (/horaire|heure|ouvert|schedule|hours|open/.test(ctx))
    return fr ? "Quels sont vos horaires d'ouverture ?" : "What are your opening hours?";
  if (/squash/.test(ctx))
    return fr ? "Parlez-moi des courts de squash." : "Tell me about the squash courts.";
  if (/visite|tour|visit|book/.test(ctx))
    return fr ? "Je voudrais planifier une visite." : "I'd like to book a visit.";
  if (/appel|call|rappel|callback|téléphone|phone/.test(ctx))
    return fr ? "Je voudrais être rappelé." : "I'd like a callback.";

  // Generic: ask to continue about whatever the assistant was discussing
  return fr
    ? "Pouvez-vous m'en dire plus ?"
    : "Can you tell me more?";
}

function expandSearchQueryForMembershipPricing(
  userMessage: string,
  locale: string | undefined,
): string {
  if (isFrenchLocale(locale)) {
    return [
      userMessage,
      "abonnement prix tarifs frais mensuel annuel senior étudiant initiation piscine accès inclus",
    ].join("\n");
  }

  return [
    userMessage,
    "membership pricing fees monthly yearly annual senior student initiation fee pool access included",
  ].join("\n");
}

function trimEvidenceContent(content: string, maxLength = 1400): string {
  const trimmed = content.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trim()}…`;
}

async function buildSearchableChunksForTenant(
  tenantUuid: string,
): Promise<SearchableChunk[]> {
  const chunkRows = await listDocumentChunks();
  const documents = await listDocuments(1000);

  const documentMap = new Map(
    documents
      .filter((document) => typeof document.uuid === "string")
      .map((document) => [document.uuid as string, document]),
  );

  const searchableChunks: SearchableChunk[] = [];

  for (const chunk of chunkRows) {
    if (
      chunk.tenant_uuid !== tenantUuid ||
      chunk.active !== true ||
      chunk.approved !== true ||
      typeof chunk.uuid !== "string" ||
      typeof chunk.document_uuid !== "string" ||
      typeof chunk.source_uuid !== "string" ||
      typeof chunk.content !== "string" ||
      chunk.content.trim().length === 0
    ) {
      continue;
    }

    const document = documentMap.get(chunk.document_uuid);

    searchableChunks.push({
      chunkId: chunk.uuid,
      tenantId: chunk.tenant_uuid,
      documentId: chunk.document_uuid,
      sourceId: chunk.source_uuid,
      locale: chunk.locale,
      content: chunk.content,
      citationLabel: chunk.citation_label,
      chunkIndex: chunk.chunk_index,
      sourceTitle: document?.title,
    });
  }

  return searchableChunks;
}

async function getSearchableChunksForTenant(
  tenantUuid: string,
): Promise<SearchableChunk[]> {
  const now = Date.now();
  const cached = searchableChunkCache.get(tenantUuid);

  if (cached && now - cached.cachedAt < SEARCHABLE_CHUNK_CACHE_TTL_MS) {
    return cached.chunks;
  }

  const inflight = searchableChunkBuilds.get(tenantUuid);
  if (inflight) {
    return inflight;
  }

  const buildPromise = buildSearchableChunksForTenant(tenantUuid)
    .then((chunks) => {
      searchableChunkCache.set(tenantUuid, {
        cachedAt: Date.now(),
        chunks,
      });
      searchableChunkBuilds.delete(tenantUuid);
      return chunks;
    })
    .catch((error) => {
      searchableChunkBuilds.delete(tenantUuid);
      throw error;
    });

  searchableChunkBuilds.set(tenantUuid, buildPromise);

  return buildPromise;
}

export async function warmupSearchableChunks(tenantUuid: string): Promise<void> {
  try {
    await getSearchableChunksForTenant(tenantUuid);
  } catch {
    // warmup failure is non-fatal
  }
}

function buildEvidenceBlock(results: SearchResult[]): string {
  return results
    .map(
      (result, index) =>
        [
          `[${index}]`,
          `title: ${result.sourceTitle ?? "unknown"}`,
          `url: ${result.citationLabel}`,
          `locale: ${result.locale}`,
          `score: ${result.score}`,
          `chunkIndex: ${result.chunkIndex}`,
          `content: ${trimEvidenceContent(result.content)}`,
        ].join("\n"),
    )
    .join("\n\n");
}

function buildConversationHistoryBlock(
  conversationHistory: MaaConversationHistoryTurn[],
): string {
  if (conversationHistory.length === 0) {
    return "No prior conversation context.";
  }

  return conversationHistory
    .map((turn, index) => `${index + 1}. ${turn.role}: ${turn.content}`)
    .join("\n");
}

function stripCitationMarkersFromAssistantMessage(message: string): string {
  return message
    .replace(/\s*\[\d+\]/g, "")
    // Replace em-dashes with a comma or colon depending on context
    .replace(/\s*—\s*/g, ", ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function callOpenAiForAnswer(
  originalUserMessage: string,
  resolvedUserMessage: string,
  locale: string | undefined,
  searchResults: SearchResult[],
  conversationHistory: MaaConversationHistoryTurn[],
  userName?: string,
  tenantCode?: string,
  extraContext?: string,
): Promise<OpenAiJsonResponse> {
  const { apiKey, model } = getOpenAiConfig();

  const resolvedIntentLine =
    resolvedUserMessage !== originalUserMessage
      ? `Resolved follow-up intent: ${resolvedUserMessage}`
      : "Resolved follow-up intent: same as user question";

  const isFollowUp = conversationHistory.length > 0;

  const userNameLine = userName
    ? `The user's name is ${userName}. Address them by name naturally once in this response if appropriate${isFollowUp ? " — but do NOT greet them again (no Bonjour/Hello/Hi)" : ""}.`
    : isFollowUp
      ? "This is a follow-up message — do NOT use any greeting (no Bonjour, Hello, Hi, Salut). Answer directly."
      : "";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "maa_chat_response",
          strict: true,
          schema: {
            type: "object",
            properties: {
              assistantMessage: { type: "string" },
              followUpMode: {
                type: "string",
                enum: ["clarify", "calendly", "callback", "vapi", "done"],
              },
              usedCitations: {
                type: "array",
                items: {
                  type: "integer",
                  minimum: 0,
                },
              },
            },
            required: ["assistantMessage", "followUpMode", "usedCitations"],
            additionalProperties: false,
          },
        },
      },
      messages: [
        {
          role: "system",
          content: tenantCode === "dubub"
            ? buildDububChatSystemPrompt(locale)
            : buildMaaChatSystemPrompt(locale),
        },
        {
          role: "user",
          content: [
            `User question: ${originalUserMessage}`,
            resolvedIntentLine,
            userNameLine,
            "",
            "Recent conversation context:",
            buildConversationHistoryBlock(conversationHistory),
            "",
            "Evidence snippets:",
            buildEvidenceBlock(searchResults),
            "",
            "Answer only from the evidence above.",
            "Use the conversation context only to resolve what the user is referring to.",
            "If the evidence already answers the question, answer directly and cite the supporting evidence indexes.",
            "Important: preserve pricing qualifiers exactly, especially words like monthly, yearly, promo, initiation fee, senior, and student.",
            "Do not rewrite a table row into a different pricing meaning.",
            "Do not invent policies or restrictions that are not explicitly supported by the evidence.",
            "Only choose calendly, callback, or vapi if the evidence is insufficient or the user clearly wants a human handoff.",
            ...(extraContext ? [extraContext] : []),
          ].join("\n"),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`OpenAI chat request failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    model?: string;
  };

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI chat response did not include message content.");
  }

  const parsed = JSON.parse(content) as OpenAiJsonResponse;
  return {
    ...parsed,
    _usage: {
      model: payload.model ?? model,
      inputTokens: payload.usage?.prompt_tokens ?? 0,
      outputTokens: payload.usage?.completion_tokens ?? 0,
    },
  } as OpenAiJsonResponse & { _usage: { model: string; inputTokens: number; outputTokens: number } };
}

export async function answerMaaChat(
  request: MaaChatRequest,
): Promise<MaaChatResponse> {
  const tenant = await findTenantByCode(request.tenantCode ?? "maa");
  const searchableChunks = await getSearchableChunksForTenant(tenant.uuid);
  const conversationHistory = normalizeConversationHistory(
    request.conversationHistory,
  );

  const isDubub = request.tenantCode === "dubub";

  const affirmativeResolved = isDubub
    ? resolveDububShortAffirmative(request.userMessage, conversationHistory, request.locale)
    : resolveShortAffirmativeFollowUp(request.userMessage, conversationHistory, request.locale);

  const resolvedUserMessage = isDubub
    ? affirmativeResolved
    : resolveMembershipFollowUpIntent(affirmativeResolved, request.locale, conversationHistory);

  // DUBUB: skip RAG entirely — system prompt has all knowledge, RAG adds latency with no benefit.
  if (isDubub) {
    // Detect post-capture state: if the assistant already confirmed "Notre équipe vous contacte",
    // the lead is captured. Switch to consultation mode — stop pushing demo, answer freely.
    const leadAlreadyCaptured = conversationHistory.some(
      (m) => m.role === "assistant" && /Notre[- ]équipe vous contacte|our team will contact/i.test(m.content),
    );

    const isFr = !request.locale?.startsWith("en");
    const postCaptureContext = leadAlreadyCaptured
      ? isFr
        ? "ÉTAT: Ce visiteur est un lead confirmé — la démo est déjà planifiée avec notre équipe. " +
          "NE propose PLUS jamais de démo ou de rendez-vous dans cette conversation. " +
          "Réponds à ses questions directement et complètement comme un conseiller chaleureux. " +
          "NE termine PAS chaque réponse par une mention de la démo — c'est répétitif et agaçant. " +
          "Utilise followUpMode: 'clarify' pour tous les messages restants."
        : "STATE: This visitor is a confirmed lead — the demo is already scheduled with our team. " +
          "NEVER suggest booking a demo or meeting again in this conversation. " +
          "Answer questions directly and fully as a warm consultant. " +
          "Do NOT end every response with a mention of the upcoming demo — it is repetitive. " +
          "Use followUpMode: 'clarify' for all remaining messages."
      : undefined;

    const openAiResult = await callOpenAiForAnswer(
      resolvedUserMessage,
      resolvedUserMessage,
      request.locale,
      [],
      conversationHistory,
      request.userName,
      request.tenantCode,
      postCaptureContext,
    );
    return {
      assistantMessage: openAiResult.assistantMessage,
      followUpMode: openAiResult.followUpMode,
      citations: [],
      retrieval: { query: resolvedUserMessage, chunkCount: 0, resultCount: 0 },
      usage: (openAiResult as typeof openAiResult & { _usage?: { model: string; inputTokens: number; outputTokens: number } })._usage,
    };
  }

  const shouldExpandMembershipPricingSearch =
    !isDubub &&
    (isPricingQuestion(resolvedUserMessage) || looksLikeMembershipPricingTopic(resolvedUserMessage));

  // Normalize casual hours queries so the vector search finds relevant chunks
  const looksLikeHoursQuery = !isDubub && /heure|horaire|ouv(re|ert|erts|rir)|ferm(e|é)|open|close|closing|hours|schedule/i.test(resolvedUserMessage);

  const searchQuery = shouldExpandMembershipPricingSearch
    ? expandSearchQueryForMembershipPricing(resolvedUserMessage, request.locale)
    : looksLikeHoursQuery
      ? `${resolvedUserMessage}\nhoraires heures ouverture fermeture schedule hours`
      : resolvedUserMessage;

  const requiresDeterministicFloor =
    !isDubub && (
      isPricingQuestion(resolvedUserMessage) ||
      isScheduleQuestion(resolvedUserMessage) ||
      isPolicyQuestion(resolvedUserMessage)
    );

  const effectiveMaxResults = requiresDeterministicFloor
    ? Math.max(request.maxResults ?? 5, 12)
    : looksLikeHoursQuery
      ? Math.max(request.maxResults ?? 5, 8)
      : request.maxResults ?? 5;

  const searchResults = await searchKnowledgeBase(
    {
      tenantId: tenant.uuid,
      query: searchQuery,
      maxResults: effectiveMaxResults,
      locale: request.locale,
    },
    searchableChunks,
  );

  if (searchResults.length === 0) {
    return buildFallbackResponse(request.userMessage, request.locale);
  }

  const pricingAnswer = !isDubub && tryAnswerPricingQuestion(
    resolvedUserMessage,
    searchResults,
    request.locale,
  );

  if (pricingAnswer) {
    const citations = pricingAnswer.usedCitations.map((index) => {
      const result = searchResults[index]!;

      return {
        citationLabel: result.citationLabel,
        sourceTitle: result.sourceTitle,
        chunkIndex: result.chunkIndex,
        score: result.score,
      };
    });

    return {
      assistantMessage: pricingAnswer.assistantMessage,
      followUpMode: pricingAnswer.followUpMode,
      citations,
      retrieval: {
        query: searchQuery,
        chunkCount: searchableChunks.length,
        resultCount: searchResults.length,
      },
    };
  }

  const scheduleAnswer = !isDubub && tryAnswerScheduleQuestion(
    resolvedUserMessage,
    searchResults,
  );

  if (scheduleAnswer) {
    const citations = scheduleAnswer.usedCitations.map((index) => {
      const result = searchResults[index]!;

      return {
        citationLabel: result.citationLabel,
        sourceTitle: result.sourceTitle,
        chunkIndex: result.chunkIndex,
        score: result.score,
      };
    });

    return {
      assistantMessage: scheduleAnswer.assistantMessage,
      followUpMode: scheduleAnswer.followUpMode,
      citations,
      retrieval: {
        query: searchQuery,
        chunkCount: searchableChunks.length,
        resultCount: searchResults.length,
      },
    };
  }

  const policyAnswer = !isDubub && tryAnswerPolicyQuestion(
    resolvedUserMessage,
    searchResults,
  );

  if (policyAnswer) {
    const citations = policyAnswer.usedCitations.map((index) => {
      const result = searchResults[index]!;

      return {
        citationLabel: result.citationLabel,
        sourceTitle: result.sourceTitle,
        chunkIndex: result.chunkIndex,
        score: result.score,
      };
    });

    return {
      assistantMessage: policyAnswer.assistantMessage,
      followUpMode: policyAnswer.followUpMode,
      citations,
      retrieval: {
        query: searchQuery,
        chunkCount: searchableChunks.length,
        resultCount: searchResults.length,
      },
    };
  }

  const modelResponse = await callOpenAiForAnswer(
    request.userMessage,
    resolvedUserMessage,
    request.locale,
    searchResults,
    conversationHistory,
    request.userName,
    request.tenantCode,
  );

  const cleanedAssistantMessage = stripCitationMarkersFromAssistantMessage(
    modelResponse.assistantMessage,
  );

  const validCitationIndexes = (modelResponse.usedCitations ?? []).filter(
    (index) =>
      Number.isInteger(index) &&
      index >= 0 &&
      index < searchResults.length,
  );

  const citations = validCitationIndexes.map((index) => {
    const result = searchResults[index]!;

    return {
      citationLabel: result.citationLabel,
      sourceTitle: result.sourceTitle,
      chunkIndex: result.chunkIndex,
      score: result.score,
    };
  });

  const usageData = (modelResponse as { _usage?: { model: string; inputTokens: number; outputTokens: number } })._usage;

  return {
    assistantMessage: cleanedAssistantMessage,
    followUpMode: modelResponse.followUpMode,
    citations,
    retrieval: {
      query: searchQuery,
      chunkCount: searchableChunks.length,
      resultCount: searchResults.length,
    },
    usage: usageData ? {
      model: usageData.model,
      inputTokens: usageData.inputTokens,
      outputTokens: usageData.outputTokens,
    } : undefined,
  };
}

/** Generate 2 alternative phrasings for a flagged AI response. Used by the feedback system. */
export async function generateAlternatives(
  userMessage: string,
  badResponse: string,
): Promise<string[]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return [];

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.5,
        max_tokens: 300,
        messages: [
          {
            role: "system",
            content: "You are a quality-control assistant for Club Sportif MAA's AI concierge. Given a user question and a flagged AI response, provide exactly 2 improved alternative responses. Return JSON: { \"alternatives\": [\"...\", \"...\"] }",
          },
          {
            role: "user",
            content: `User question: ${userMessage}\n\nFlagged AI response: ${badResponse}\n\nProvide 2 better alternatives.`,
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const parsed = JSON.parse(json.choices?.[0]?.message?.content ?? "{}") as { alternatives?: string[] };
    return Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 2) : [];
  } catch {
    return [];
  }
}