import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadApprovedSourceRegistry } from "@platform/config";
import {
  answerMaaChat,
  type MaaChatRequest,
  type MaaChatResponse,
} from "./services/maa-chat.js";
import {
  createConversation,
  createMessage,
  findTenantByCode,
  isChatPersistenceConfigured,
  newUuid,
} from "./ingestion/nocodb.js";

type TenantRouteParams = {
  tenantId: string;
};

type ChatRouteBody = {
  message: string;
  locale?: string;
  maxResults?: number;
  conversationId?: string;
};

export function createServer() {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/v1/tenants/:tenantId/sources", async (request, reply) => {
    const { tenantId } = request.params as TenantRouteParams;

    if (tenantId !== "maa") {
      return reply.code(404).send({
        error: "tenant_not_supported",
        message: `Unsupported tenant: ${tenantId}`,
      });
    }

    const registry = await loadApprovedSourceRegistry(tenantId);

    return {
      tenantId: registry.tenantId,
      tenantName: registry.tenantName,
      defaultLocale: registry.defaultLocale,
      supportedLocales: registry.supportedLocales,
      sources: registry.sources,
    };
  });

  app.post("/v1/tenants/:tenantId/chat", async (request, reply) => {
    const { tenantId } = request.params as TenantRouteParams;
    const body = (request.body ?? {}) as Partial<ChatRouteBody>;

    if (tenantId !== "maa") {
      return reply.code(404).send({
        error: "tenant_not_supported",
        message: `Unsupported tenant: ${tenantId}`,
      });
    }

    if (!body.message || typeof body.message !== "string" || !body.message.trim()) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "Body.message is required.",
      });
    }

    const trimmedMessage = body.message.trim();
    const chatRequest: MaaChatRequest = {
      userMessage: trimmedMessage,
      locale: body.locale,
      maxResults: body.maxResults,
    };

    const result: MaaChatResponse = await answerMaaChat(chatRequest);

    let conversationId =
      typeof body.conversationId === "string" && body.conversationId.trim().length > 0
        ? body.conversationId.trim()
        : null;

    const persistence = {
      enabled: isChatPersistenceConfigured(),
      saved: false,
      error: null as string | null,
    };

    if (persistence.enabled) {
      try {
        const tenant = await findTenantByCode("maa");
        const now = new Date().toISOString();
        const locale = body.locale ?? null;

        if (!conversationId) {
          conversationId = newUuid();

          await createConversation({
            uuid: conversationId,
            tenant_uuid: tenant.uuid,
            channel: "web_chat",
            locale,
            status: "open",
            started_at: now,
            updated_at: now,
          });
        }

        await createMessage({
          uuid: newUuid(),
          tenant_uuid: tenant.uuid,
          conversation_uuid: conversationId,
          role: "user",
          content: trimmedMessage,
          locale,
          created_at: now,
        });

        await createMessage({
          uuid: newUuid(),
          tenant_uuid: tenant.uuid,
          conversation_uuid: conversationId,
          role: "assistant",
          content: result.assistantMessage,
          locale,
          follow_up_mode: result.followUpMode,
          citations_json: JSON.stringify(result.citations),
          retrieval_json: JSON.stringify(result.retrieval),
          created_at: now,
        });

        persistence.saved = true;
      } catch (error) {
        persistence.error =
          error instanceof Error ? error.message : "Unknown persistence error";

        request.log.error(
          {
            err: error,
            tenantId,
            conversationId,
          },
          "Failed to persist chat turn",
        );
      }
    }

    return {
      tenantId,
      conversationId,
      assistantMessage: result.assistantMessage,
      followUpMode: result.followUpMode,
      citations: result.citations,
      retrieval: result.retrieval,
      persistence,
    };
  });

  return app;
}