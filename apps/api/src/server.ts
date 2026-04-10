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
  findBookingConfigForTenantLocale,
  findTenantByCode,
  isBookingConfigConfigured,
  isCallbackPersistenceConfigured,
  isChatPersistenceConfigured,
  listMessagesByConversationUuid,
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
  dryRunPersistence?: boolean;
};

type ChatHistoryEntry = NonNullable<MaaChatRequest["conversationHistory"]>[number];

const dryRunConversationHistory = new Map<string, ChatHistoryEntry[]>();

function getDryRunConversationHistory(
  conversationId: string | null,
): MaaChatRequest["conversationHistory"] {
  if (!conversationId) {
    return [];
  }

  const history = dryRunConversationHistory.get(conversationId) ?? [];
  return history.map((entry) => ({ ...entry }));
}

function appendDryRunConversationMessage(
  conversationId: string | null,
  role: ChatHistoryEntry["role"],
  content: string,
): void {
  if (!conversationId) {
    return;
  }

  const history = dryRunConversationHistory.get(conversationId) ?? [];
  history.push({ role, content });

  if (history.length > 8) {
    history.splice(0, history.length - 8);
  }

  dryRunConversationHistory.set(conversationId, history);
}

function toNullableTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isFrenchLocale(locale: string | null): boolean {
  if (!locale) {
    return false;
  }

  const normalized = locale.trim().toLowerCase();
  return normalized === "fr" || normalized.startsWith("fr-");
}

function looksLikeBookingIntent(userMessage: string, locale: string | null): boolean {
  const normalized = userMessage.trim().toLowerCase();

  if (isFrenchLocale(locale)) {
    return /(?:rÃƒÂ©server|reserver|rÃƒÂ©servation|reservation|rendez-vous|planifier|visite|visiter|ÃƒÂ©quipe des ventes|equipe des ventes|ventes)/i.test(
      normalized,
    );
  }

  return /(?:book|booking|schedule|appointment|tour|visit|sales team|speak with sales|talk to sales|book a call)/i.test(
    normalized,
  );
}

function buildCallbackSuccessMessage(
  locale: string | null,
  phone: string,
  preferredTimeText: string | null,
): string {
  if (isFrenchLocale(locale)) {
    return preferredTimeText
      ? `Merci Ã¢â‚¬â€ votre demande de rappel a bien ÃƒÂ©tÃƒÂ© enregistrÃƒÂ©e. Un membre de lÃ¢â‚¬â„¢ÃƒÂ©quipe du Club Sportif MAA pourra vous rappeler au ${phone}. Plage horaire souhaitÃƒÂ©e notÃƒÂ©e : ${preferredTimeText}.`
      : `Merci Ã¢â‚¬â€ votre demande de rappel a bien ÃƒÂ©tÃƒÂ© enregistrÃƒÂ©e. Un membre de lÃ¢â‚¬â„¢ÃƒÂ©quipe du Club Sportif MAA pourra vous rappeler au ${phone}.`;
  }

  return preferredTimeText
    ? `Thanks Ã¢â‚¬â€ your callback request has been captured. A Club Sportif MAA team member can call you back at ${phone}. Preferred time noted: ${preferredTimeText}.`
    : `Thanks Ã¢â‚¬â€ your callback request has been captured. A Club Sportif MAA team member can call you back at ${phone}.`;
}

function buildCallbackFailureMessage(locale: string | null): string {
  if (isFrenchLocale(locale)) {
    return "Merci Ã¢â‚¬â€ jÃ¢â‚¬â„¢ai bien reÃƒÂ§u vos coordonnÃƒÂ©es, mais un problÃƒÂ¨me technique a empÃƒÂªchÃƒÂ© lÃ¢â‚¬â„¢enregistrement de votre demande de rappel. Veuillez rÃƒÂ©essayer dans un instant.";
  }

  return "Thanks Ã¢â‚¬â€ I received your callback details, but a technical issue prevented the callback request from being saved. Please try again in a moment.";
}

function buildCallbackNotConfiguredMessage(locale: string | null): string {
  if (isFrenchLocale(locale)) {
    return "Merci Ã¢â‚¬â€ jÃ¢â‚¬â„¢ai bien reÃƒÂ§u votre demande de rappel, mais la persistance des rappels nÃ¢â‚¬â„¢est pas configurÃƒÂ©e sur ce serveur.";
  }

  return "Thanks Ã¢â‚¬â€ I received your callback request, but callback persistence is not configured on this server.";
}

function buildDirectBookingSuccessMessage(
  locale: string | null,
  bookingUrl: string,
  allowCallbackFallback: boolean,
): string {
  if (isFrenchLocale(locale)) {
    return allowCallbackFallback
      ? `Pour planifier avec un membre de lÃ¢â‚¬â„¢ÃƒÂ©quipe du Club Sportif MAA, utilisez ce lien : ${bookingUrl}. Si vous prÃƒÂ©fÃƒÂ©rez, je peux aussi prendre une demande de rappel.`
      : `Pour planifier avec un membre de lÃ¢â‚¬â„¢ÃƒÂ©quipe du Club Sportif MAA, utilisez ce lien : ${bookingUrl}.`;
  }

  return allowCallbackFallback
    ? `To book with a Club Sportif MAA team member, please use this link: ${bookingUrl}. If you prefer, I can also help capture a callback request.`
    : `To book with a Club Sportif MAA team member, please use this link: ${bookingUrl}.`;
}

function buildPopupBookingSuccessMessage(
  locale: string | null,
  bookingUrl: string,
  allowCallbackFallback: boolean,
): string {
  if (isFrenchLocale(locale)) {
    return allowCallbackFallback
      ? `Pour rÃƒÂ©server une visite, ouvrez cette page : ${bookingUrl}. Ensuite, cliquez sur Ã‚Â« PLANIFIER UNE VISITE Ã‚Â» pour lancer la fenÃƒÂªtre de rÃƒÂ©servation. Si vous prÃƒÂ©fÃƒÂ©rez rester ici, je peux aussi prendre une demande de rappel.`
      : `Pour rÃƒÂ©server une visite, ouvrez cette page : ${bookingUrl}. Ensuite, cliquez sur Ã‚Â« PLANIFIER UNE VISITE Ã‚Â» pour lancer la fenÃƒÂªtre de rÃƒÂ©servation.`;
  }

  return allowCallbackFallback
    ? `To book a tour, open this page: ${bookingUrl}. Then click "Book a tour" to launch the booking widget. If you prefer to stay here, I can also capture a callback request.`
    : `To book a tour, open this page: ${bookingUrl}. Then click "Book a tour" to launch the booking widget.`;
}

function buildBookingUnavailableMessage(
  locale: string | null,
  allowCallbackFallback: boolean,
): string {
  if (isFrenchLocale(locale)) {
    return allowCallbackFallback
      ? "Je peux vous orienter vers une rÃƒÂ©servation, mais aucun lien de prise de rendez-vous nÃ¢â‚¬â„¢est configurÃƒÂ© pour le moment. Si vous prÃƒÂ©fÃƒÂ©rez, je peux aussi prendre une demande de rappel."
      : "Je peux vous orienter vers une rÃƒÂ©servation, mais aucun lien de prise de rendez-vous nÃ¢â‚¬â„¢est configurÃƒÂ© pour le moment.";
  }

  return allowCallbackFallback
    ? "I can direct you to booking, but no booking link is configured right now. If you prefer, I can also help capture a callback request."
    : "I can direct you to booking, but no booking link is configured right now.";
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
    const isDryRunPersistence = body.dryRunPersistence === true;

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

    const loadConversationHistory = async (): Promise<
      MaaChatRequest["conversationHistory"]
    > => {
      if (!conversationId) {
        return [];
      }

      if (isDryRunPersistence) {
        return getDryRunConversationHistory(conversationId);
      }

      if (!isChatPersistenceConfigured()) {
        return [];
      }

      try {
        const rows = await listMessagesByConversationUuid(conversationId, 8);

        return rows.map((row) => ({
          role: row.role,
          content: row.content,
        }));
      } catch (error) {
        request.log.error(
          {
            err: error,
            tenantId,
            conversationId,
          },
          "Failed to load conversation history",
        );

        return [];
      }
    };

    const hasExplicitBookingIntent =
      !hasCallbackPayload && looksLikeBookingIntent(trimmedMessage, locale);

    const conversationHistory = await loadConversationHistory();

    const chatRequest: MaaChatRequest = {
      userMessage: trimmedMessage,
      locale: locale ?? undefined,
      maxResults: body.maxResults,
      conversationHistory,
    };

    const result: MaaChatResponse = await answerMaaChat(chatRequest);

    let responseAssistantMessage = result.assistantMessage;
    let responseFollowUpMode = hasExplicitBookingIntent
      ? "calendly"
      : result.followUpMode;
    let responseCitations = result.citations;

    const persistence = {
      enabled: isDryRunPersistence ? true : isChatPersistenceConfigured(),
      saved: false,
      error: null as string | null,
    };

    const callbackPersistence = {
      enabled: isDryRunPersistence ? true : isCallbackPersistenceConfigured(),
      saved: false,
      requestId: null as string | null,
      error: null as string | null,
    };

    const booking = {
      enabled: false,
      configured: false,
      source: null as "nocodb" | "env" | null,
      mode: null as string | null,
      bookingUrl: null as string | null,
      calendlyEventTypeUri: null as string | null,
      allowCallbackFallback: false,
      confirmationTemplateKey: null as string | null,
      error: null as string | null,
    };

    const resolveBookingFollowUp = async (): Promise<void> => {
      if (responseFollowUpMode !== "calendly") {
        return;
      }

      const envBookingUrl = toNullableTrimmedString(process.env.CALENDLY_URL);

      try {
        if (isBookingConfigConfigured()) {
          const resolvedTenantUuid = await getTenantUuid();
          const config = await findBookingConfigForTenantLocale(
            resolvedTenantUuid,
            locale,
          );

          if (config) {
            booking.configured = true;
            booking.enabled = config.enabled === true;
            booking.mode = toNullableTrimmedString(config.mode);
            booking.calendlyEventTypeUri = toNullableTrimmedString(
              config.calendly_event_type_uri,
            );
            booking.bookingUrl = toNullableTrimmedString(config.booking_url);
            booking.allowCallbackFallback = config.allow_callback_fallback === true;
            booking.confirmationTemplateKey = toNullableTrimmedString(
              config.confirmation_template_key,
            );
          }
        }
      } catch (error) {
        booking.error =
          error instanceof Error ? error.message : "Unknown booking configuration error";
      }

      let effectiveBookingUrl: string | null = null;

      if (booking.enabled && booking.bookingUrl) {
        effectiveBookingUrl = booking.bookingUrl;
        booking.source = "nocodb";
      } else if (envBookingUrl) {
        effectiveBookingUrl = envBookingUrl;
        booking.enabled = true;
        booking.configured = true;
        booking.source = "env";
        booking.bookingUrl = envBookingUrl;
        booking.mode = booking.mode ?? "calendly";
      }

      if (effectiveBookingUrl) {
        responseAssistantMessage =
          booking.mode === "leadconnector_popup"
            ? buildPopupBookingSuccessMessage(
                locale,
                effectiveBookingUrl,
                booking.allowCallbackFallback,
              )
            : buildDirectBookingSuccessMessage(
                locale,
                effectiveBookingUrl,
                booking.allowCallbackFallback,
              );

        responseCitations = [];
        return;
      }

      if (!booking.error) {
        if (booking.configured && booking.enabled) {
          booking.error = "Booking URL is missing for this tenant/locale.";
        } else if (booking.configured && !booking.enabled) {
          booking.error = "Booking is disabled for this tenant/locale.";
        } else {
          booking.error =
            "Booking is not configured. Expected an enabled booking_configs row or CALENDLY_URL.";
        }
      }

      responseAssistantMessage = buildBookingUnavailableMessage(
        locale,
        booking.allowCallbackFallback,
      );
      responseCitations = [];
    };

    const persistCallbackRequest = async (): Promise<void> => {
      if (!hasCallbackPayload) {
        return;
      }

      const preferredTimeText = toNullableTrimmedString(body.callback?.preferredTimeText);

      if (isDryRunPersistence) {
        callbackPersistence.saved = true;
        callbackPersistence.requestId = newUuid();
        responseAssistantMessage = buildCallbackSuccessMessage(
          locale,
          callbackPhone!,
          preferredTimeText,
        );
        responseFollowUpMode = "callback";
        responseCitations = [];
        return;
      }

      if (!callbackPersistence.enabled) {
        callbackPersistence.error =
          "Callback persistence is not configured. Expected NOCODB_TABLE_CALLBACK_REQUESTS.";
        responseAssistantMessage = buildCallbackNotConfiguredMessage(locale);
        responseFollowUpMode = "callback";
        responseCitations = [];
        return;
      }

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
          preferred_time_text: preferredTimeText,
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
        responseAssistantMessage = buildCallbackSuccessMessage(
          locale,
          callbackPhone!,
          preferredTimeText,
        );
        responseFollowUpMode = "callback";
        responseCitations = [];
      } catch (error) {
        callbackPersistence.error =
          error instanceof Error ? error.message : "Unknown callback persistence error";
        responseAssistantMessage = buildCallbackFailureMessage(locale);
        responseFollowUpMode = "callback";
        responseCitations = [];

        request.log.error(
          {
            err: error,
            tenantId,
            conversationId,
          },
          "Failed to persist callback request",
        );
      }
    };

    await resolveBookingFollowUp();

    if (persistence.enabled) {
      if (isDryRunPersistence) {
        if (!conversationId) {
          conversationId = newUuid();
        }

        appendDryRunConversationMessage(conversationId, "user", trimmedMessage);
        await persistCallbackRequest();
        appendDryRunConversationMessage(
          conversationId,
          "assistant",
          responseAssistantMessage,
        );
        persistence.saved = true;
      } else {
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

          await persistCallbackRequest();

          await createMessage({
            uuid: newUuid(),
            tenant_uuid: resolvedTenantUuid,
            conversation_uuid: conversationId,
            role: "assistant",
            content: responseAssistantMessage,
            locale,
            follow_up_mode: responseFollowUpMode,
            citations_json: JSON.stringify(responseCitations),
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
    } else if (hasCallbackPayload) {
      await persistCallbackRequest();
    }

    return {
      tenantId,
      conversationId,
      assistantMessage: responseAssistantMessage,
      followUpMode: responseFollowUpMode,
      citations: responseCitations,
      retrieval: result.retrieval,
      persistence,
      callbackPersistence,
      booking,
    };
  });

  return app;
}
