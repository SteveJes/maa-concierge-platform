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

export interface MaaChatRequest {
  userMessage: string;
  locale?: string;
  maxResults?: number;
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

function trimEvidenceContent(content: string, maxLength = 1400): string {
  const trimmed = content.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength).trim()}…`;
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

async function callOpenAiForAnswer(
  userMessage: string,
  locale: string | undefined,
  searchResults: SearchResult[],
): Promise<OpenAiJsonResponse> {
  const { apiKey, model } = getOpenAiConfig();

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
            `User question: ${userMessage}`,
            "",
            "Evidence snippets:",
            buildEvidenceBlock(searchResults),
            "",
            "Answer only from the evidence above.",
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

  const requiresDeterministicFloor =
    isPricingQuestion(request.userMessage) ||
    isScheduleQuestion(request.userMessage) ||
    isPolicyQuestion(request.userMessage);

  const effectiveMaxResults = requiresDeterministicFloor
    ? Math.max(request.maxResults ?? 5, 12)
    : request.maxResults ?? 5;

  const searchResults = await searchKnowledgeBase(
    {
      tenantId: tenant.uuid,
      query: request.userMessage,
      maxResults: effectiveMaxResults,
      locale: request.locale,
    },
    searchableChunks,
  );

  if (searchResults.length === 0) {
    return buildFallbackResponse(request.userMessage, request.locale);
  }

  const pricingAnswer = tryAnswerPricingQuestion(
    request.userMessage,
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
        query: request.userMessage,
        chunkCount: searchableChunks.length,
        resultCount: searchResults.length,
      },
    };
  }

  const scheduleAnswer = tryAnswerScheduleQuestion(
    request.userMessage,
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
        query: request.userMessage,
        chunkCount: searchableChunks.length,
        resultCount: searchResults.length,
      },
    };
  }

  const policyAnswer = tryAnswerPolicyQuestion(
    request.userMessage,
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
        query: request.userMessage,
        chunkCount: searchableChunks.length,
        resultCount: searchResults.length,
      },
    };
  }

  const modelResponse = await callOpenAiForAnswer(
    request.userMessage,
    request.locale,
    searchResults,
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
    assistantMessage: modelResponse.assistantMessage,
    followUpMode: modelResponse.followUpMode,
    citations,
    retrieval: {
      query: request.userMessage,
      chunkCount: searchableChunks.length,
      resultCount: searchResults.length,
    },
  };
}