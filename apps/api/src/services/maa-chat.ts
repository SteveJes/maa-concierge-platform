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

const SEARCHABLE_CHUNK_CACHE_TTL_MS = 5 * 60 * 1000;
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
  return /(?:membership|member|pricing|price|prices|fee|fees|cost|costs|annual|yearly|monthly|initiation|senior|student|abonnement|abonnements|prix|tarif|tarifs|frais|mensuel|annuel)/i.test(
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
    .replace(/\s{2,}/g, " ")
    .trim();
}

async function callOpenAiForAnswer(
  originalUserMessage: string,
  resolvedUserMessage: string,
  locale: string | undefined,
  searchResults: SearchResult[],
  conversationHistory: MaaConversationHistoryTurn[],
): Promise<OpenAiJsonResponse> {
  const { apiKey, model } = getOpenAiConfig();

  const resolvedIntentLine =
    resolvedUserMessage !== originalUserMessage
      ? `Resolved follow-up intent: ${resolvedUserMessage}`
      : "Resolved follow-up intent: same as user question";

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
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
          content: buildMaaChatSystemPrompt(locale),
        },
        {
          role: "user",
          content: [
            `User question: ${originalUserMessage}`,
            resolvedIntentLine,
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
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("OpenAI chat response did not include message content.");
  }

  return JSON.parse(content) as OpenAiJsonResponse;
}

export async function answerMaaChat(
  request: MaaChatRequest,
): Promise<MaaChatResponse> {
  const tenant = await findTenantByCode("maa");
  const searchableChunks = await getSearchableChunksForTenant(tenant.uuid);
  const conversationHistory = normalizeConversationHistory(
    request.conversationHistory,
  );

  const resolvedUserMessage = resolveMembershipFollowUpIntent(
    request.userMessage,
    request.locale,
    conversationHistory,
  );

  const shouldExpandMembershipPricingSearch =
    isPricingQuestion(resolvedUserMessage) ||
    looksLikeMembershipPricingTopic(resolvedUserMessage);

  const searchQuery = shouldExpandMembershipPricingSearch
    ? expandSearchQueryForMembershipPricing(resolvedUserMessage, request.locale)
    : resolvedUserMessage;

  const requiresDeterministicFloor =
    isPricingQuestion(resolvedUserMessage) ||
    isScheduleQuestion(resolvedUserMessage) ||
    isPolicyQuestion(resolvedUserMessage);

  const effectiveMaxResults = requiresDeterministicFloor
    ? Math.max(request.maxResults ?? 5, 12)
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

  const pricingAnswer = tryAnswerPricingQuestion(
    resolvedUserMessage,
    searchResults,
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

  const scheduleAnswer = tryAnswerScheduleQuestion(
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

  const policyAnswer = tryAnswerPolicyQuestion(
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

  return {
    assistantMessage: cleanedAssistantMessage,
    followUpMode: modelResponse.followUpMode,
    citations,
    retrieval: {
      query: searchQuery,
      chunkCount: searchableChunks.length,
      resultCount: searchResults.length,
    },
  };
}