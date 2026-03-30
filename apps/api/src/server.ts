import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadApprovedSourceRegistry } from "@platform/config";
import {
  answerMaaChat,
  type MaaChatRequest,
  type MaaChatResponse,
} from "./services/maa-chat.js";

type TenantRouteParams = {
  tenantId: string;
};

type ChatRouteBody = {
  message: string;
  locale?: string;
  maxResults?: number;
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

    const chatRequest: MaaChatRequest = {
      userMessage: body.message.trim(),
      locale: body.locale,
      maxResults: body.maxResults,
    };

    const result: MaaChatResponse = await answerMaaChat(chatRequest);

    return {
      tenantId,
      assistantMessage: result.assistantMessage,
      followUpMode: result.followUpMode,
      citations: result.citations,
      retrieval: result.retrieval,
    };
  });

  return app;
}