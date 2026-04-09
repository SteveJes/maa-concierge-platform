import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadApprovedSourceRegistry } from "@platform/config";
import {
  answerMaaChat,
  type MaaChatRequest,
  type MaaChatResponse,
} from "./services/maa-chat.js";
import {
  createCallbackRequest,
  createConversation,
  createMessage,
  findTenantByCode,
  isCallbackPersistenceConfigured,
  isChatPersistenceConfigured,
  newUuid,
} from "./ingestion/nocodb.js";

type TenantRouteParams = {
  tenantId: string;
};

type CallbackCaptureBody = {
  name?: string;
  phone: string;
  email?: string;
  preferredTimeText?: string;
  questionSummary?: string;
  consentToContact?: boolean;
};

type ChatRouteBody = {
  message: string;
  locale?: string;
  maxResults?: number;
  conversationId?: string;
  callback?: CallbackCaptureBody;
};

function toNullableTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

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

    const hasCallbackPayload = typeof body.callback !== "undefined";

    if (
      hasCallbackPayload &&
      (!body.callback || typeof body.callback !== "object" || Array.isArray(body.callback))
    ) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "Body.callback must be an object when provided.",
      });
    }

    const callbackPhone = toNullableTrimmedString(body.callback?.phone);

    if (hasCallbackPayload && !callbackPhone) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "Body.callback.phone is required when callback is provided.",
      });
    }

    if (hasCallbackPayload && body.callback?.consentToContact !== true) {
      return reply.code(400).send({
        error: "invalid_request",
        message: "Body.callback.consentToContact must be true when callback is provided.",
      });
    }

    const trimmedMessage = body.message.trim();
    const locale = toNullableTrimmedString(body.locale);
    const now = new Date().toISOString();

    const chatRequest: MaaChatRequest = {
      userMessage: trimmedMessage,
      locale: locale ?? undefined,
      maxResults: body.maxResults,
    };

    const result: MaaChatResponse = await answerMaaChat(chatRequest);

    let conversationId =
      typeof body.conversationId === "string" && body.conversationId.trim().length > 0
        ? body.conversationId.trim()
        : null;

    let tenantUuid: string | null = null;

    const getTenantUuid = async (): Promise<string> => {
      if (tenantUuid) {
        return tenantUuid;
      }

      const tenant = await findTenantByCode("maa");
      tenantUuid = tenant.uuid;
      return tenantUuid;
    };

    const persistence = {
      enabled: isChatPersistenceConfigured(),
      saved: false,
      error: null as string | null,
    };

    const callbackPersistence = {
      enabled: isCallbackPersistenceConfigured(),
      saved: false,
      requestId: null as string | null,
      error: null as string | null,
    };

    if (persistence.enabled) {
      try {
        const resolvedTenantUuid = await getTenantUuid();

        if (!conversationId) {
          conversationId = newUuid();

          await createConversation({
            uuid: conversationId,
            tenant_uuid: resolvedTenantUuid,
            channel: "web_chat",
            locale,
            status: "open",
            started_at: now,
            updated_at: now,
          });
        }

        await createMessage({
          uuid: newUuid(),
          tenant_uuid: resolvedTenantUuid,
          conversation_uuid: conversationId,
          role: "user",
          content: trimmedMessage,
          locale,
          created_at: now,
        });

        await createMessage({
          uuid: newUuid(),
          tenant_uuid: resolvedTenantUuid,
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

    if (hasCallbackPayload) {
      if (callbackPersistence.enabled) {
        try {
          const resolvedTenantUuid = await getTenantUuid();
          const callbackRequestId = newUuid();

          await createCallbackRequest({
            uuid: callbackRequestId,
            tenant_uuid: resolvedTenantUuid,
            conversation_uuid: conversationId,
            locale,
            name: toNullableTrimmedString(body.callback?.name),
            phone: callbackPhone!,
            email: toNullableTrimmedString(body.callback?.email),
            preferred_time_text: toNullableTrimmedString(body.callback?.preferredTimeText),
            question_summary:
              toNullableTrimmedString(body.callback?.questionSummary) ?? trimmedMessage,
            status: "new",
            consent_to_contact: true,
            brevo_confirmation_sent: false,
            crm_record_id: null,
            created_at: now,
          });

          callbackPersistence.saved = true;
          callbackPersistence.requestId = callbackRequestId;
        } catch (error) {
          callbackPersistence.error =
            error instanceof Error ? error.message : "Unknown callback persistence error";

          request.log.error(
            {
              err: error,
              tenantId,
              conversationId,
            },
            "Failed to persist callback request",
          );
        }
      } else {
        callbackPersistence.error =
          "Callback persistence is not configured. Expected NOCODB_TABLE_CALLBACK_REQUESTS.";
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
      callbackPersistence,
    };
  });

  return app;
}