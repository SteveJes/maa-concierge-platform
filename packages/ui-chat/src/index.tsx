/// <reference path="./vapi-web.d.ts" />
"use client";

import Vapi from "@vapi-ai/web";
import { useMemo, useRef, useState } from "react";

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
};

type BookingPayload = {
  enabled: boolean;
  configured: boolean;
  source: "nocodb" | "env" | null;
  mode: string | null;
  bookingUrl: string | null;
  calendlyEventTypeUri: string | null;
  allowCallbackFallback: boolean;
  confirmationTemplateKey: string | null;
  error: string | null;
};

type CallbackPersistencePayload = {
  enabled: boolean;
  saved: boolean;
  requestId: string | null;
  error: string | null;
};

type VapiPayload = {
  enabled: boolean;
  configured: boolean;
  source: "env" | "generated" | null;
  assistantId: string | null;
  publicKey: string | null;
  phoneNumber: string | null;
  handoffToken: string | null;
  handoffUrl: string | null;
  launchMode: "web_call" | "phone_number" | "web_call_or_number" | null;
  buttonLabel: string | null;
  fallbackToCallback: boolean;
  summary: string | null;
  error: string | null;
};

type ChatApiResponse = {
  tenantId: string;
  conversationId: string | null;
  assistantMessage: string;
  followUpMode: "clarify" | "calendly" | "callback" | "vapi" | "done";
  citations: number[];
  retrieval: {
    query: string;
    chunkCount: number;
    resultCount: number;
  };
  callbackPersistence: CallbackPersistencePayload;
  booking: BookingPayload;
  vapi: VapiPayload;
};

type VapiHandoffPayload = {
  tenantId: string;
  conversationId: string | null;
  locale: string | null;
  createdAt: string;
  assistantId: string | null;
  publicKey: string | null;
  phoneNumber: string | null;
  launchMode: "web_call" | "phone_number" | "web_call_or_number";
  summary: string;
  lastUserMessage: string;
  recentTurns: Array<{
    role: "user" | "assistant";
    content: string;
  }>;
};

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function detectLocale(): "fr-CA" | "en-CA" {
  if (typeof window === "undefined") {
    return "en-CA";
  }

  return window.navigator.language.toLowerCase().startsWith("fr")
    ? "fr-CA"
    : "en-CA";
}

function getApiBaseUrl(): string {
  return "http://127.0.0.1:4000";
}

function isMobileDevice(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return /android|iphone|ipad|ipod|mobile/i.test(
    window.navigator.userAgent,
  );
}

export function ChatShell() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const locale = useMemo(() => detectLocale(), []);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLaunchingPhone, setIsLaunchingPhone] = useState(false);
  const [showPhoneFallback, setShowPhoneFallback] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: newId(),
      role: "system",
      text:
        locale === "fr-CA"
          ? "Bonjour. Je suis la concierge du Club Sportif MAA."
          : "Hello. I'm the Club Sportif MAA concierge.",
    },
  ]);
  const [lastResponse, setLastResponse] = useState<ChatApiResponse | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);
  const vapiRef = useRef<Vapi | null>(null);

  async function sendMessage(): Promise<void> {
    const trimmed = input.trim();

    if (!trimmed || isSending) {
      return;
    }

    setErrorText(null);
    setIsSending(true);

    setMessages((current) => [
      ...current,
      {
        id: newId(),
        role: "user",
        text: trimmed,
      },
    ]);

    setInput("");

    try {
      const response = await fetch(`${apiBaseUrl}/v1/tenants/maa/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          locale,
          conversationId,
          dryRunPersistence: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with HTTP ${response.status}`);
      }

      const body = (await response.json()) as ChatApiResponse;

      setConversationId(body.conversationId);
      setLastResponse(body);

      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "assistant",
          text: body.assistantMessage,
        },
      ]);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown chat error";

      setErrorText(message);

      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "system",
          text:
            locale === "fr-CA"
              ? `Erreur: ${message}`
              : `Error: ${message}`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function handleContinueByPhone(): Promise<void> {
    if (!lastResponse?.vapi?.handoffUrl || isLaunchingPhone) {
      return;
    }

    setIsLaunchingPhone(true);
    setErrorText(null);
    setShowPhoneFallback(false);

    try {
      const handoffResponse = await fetch(
        `${apiBaseUrl}${lastResponse.vapi.handoffUrl}`,
      );

      if (!handoffResponse.ok) {
        throw new Error(
          `Vapi handoff fetch failed with HTTP ${handoffResponse.status}`,
        );
      }

      const handoff = (await handoffResponse.json()) as Record<string, unknown>;

      const { publicKey, assistantId, phoneNumber, launchMode } = lastResponse.vapi;

      if (
        (launchMode === "phone_number" || launchMode === "web_call_or_number") &&
        !publicKey &&
        phoneNumber
      ) {
        if (isMobileDevice()) {
          window.location.href = `tel:${phoneNumber}`;
        } else {
          setShowPhoneFallback(true);
        }

        return;
      }

      if (!publicKey || !assistantId) {
        throw new Error(
          locale === "fr-CA"
            ? "Configuration Vapi incomplÃ¨te."
            : "Incomplete Vapi configuration.",
        );
      }

      if (!vapiRef.current) {
        vapiRef.current = new Vapi(publicKey);

        vapiRef.current.on?.("error", () => {
          setErrorText(
            locale === "fr-CA"
              ? "L'appel web n'est pas disponible pour le moment."
              : "Web calling is not available right now.",
          );

          setMessages((current) => [
            ...current,
            {
              id: newId(),
              role: "system",
              text:
                locale === "fr-CA"
                  ? "Je n'ai pas pu démarrer l'appel web. J'essaie le numéro de téléphone."
                  : "I couldn't start the web call. Trying the phone number instead.",
            },
          ]);

          if (
            phoneNumber &&
            (launchMode === "phone_number" || launchMode === "web_call_or_number")
          ) {
            if (isMobileDevice()) {
              window.location.href = `tel:${phoneNumber}`;
            } else {
              setShowPhoneFallback(true);
            }
          }
        });
      }

      try {
        await vapiRef.current.start(assistantId);
      } catch (error) {
        console.error("Vapi start threw:", error);

        if (
          phoneNumber &&
          (launchMode === "phone_number" || launchMode === "web_call_or_number")
        ) {
          if (isMobileDevice()) {
            window.location.href = `tel:${phoneNumber}`;
          } else {
            setShowPhoneFallback(true);
          }

          return;
        }

        throw error;
      }

    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown Vapi launch error";

      setErrorText(message);

      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "system",
          text:
            locale === "fr-CA"
              ? "Je n'ai pas pu démarrer l'appel pour le moment."
              : "I couldn't start the phone connection right now.",
        },
      ]);
    } finally {
      setIsLaunchingPhone(false);
    }
  }

  const showBookingButton =
    lastResponse?.followUpMode === "calendly" &&
    lastResponse.booking?.bookingUrl;

  const showPhoneButton =
    lastResponse?.followUpMode === "vapi" && lastResponse.vapi?.enabled;

  return (
    <section
      style={{
        border: "1px solid #d1d5db",
        borderRadius: 16,
        padding: 16,
        background: "white",
        maxWidth: 860,
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <strong>
          {locale === "fr-CA"
            ? "Concierge IA MAA"
            : "MAA AI Concierge"}
        </strong>
      </div>

      <div
        style={{
          border: "1px solid #e5e7eb",
          borderRadius: 12,
          padding: 12,
          minHeight: 320,
          background: "#fafafa",
          marginBottom: 12,
        }}
      >
        {messages.map((message) => (
          <div
            key={message.id}
            style={{
              marginBottom: 10,
              display: "flex",
              justifyContent:
                message.role === "user" ? "flex-end" : "flex-start",
            }}
          >
            <div
              style={{
                maxWidth: "80%",
                padding: "10px 12px",
                borderRadius: 12,
                background:
                  message.role === "user"
                    ? "#111827"
                    : message.role === "assistant"
                      ? "#e5f3ff"
                      : "#f3f4f6",
                color: message.role === "user" ? "white" : "#111827",
                whiteSpace: "pre-wrap",
              }}
            >
              {message.text}
            </div>
          </div>
        ))}
      </div>

      {showBookingButton ? (
        <div style={{ marginBottom: 12 }}>
          <a
            href={lastResponse!.booking.bookingUrl!}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              padding: "10px 14px",
              borderRadius: 10,
              background: "#0f766e",
              color: "white",
              textDecoration: "none",
              marginRight: 8,
            }}
          >
            {locale === "fr-CA" ? "Planifier une visite" : "Book a tour"}
          </a>
        </div>
      ) : null}

      {showPhoneButton ? (
        <div style={{ marginBottom: 12 }}>
          <button
            type="button"
            onClick={handleContinueByPhone}
            disabled={isLaunchingPhone}
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#1d4ed8",
              color: "white",
              border: "none",
              cursor: isLaunchingPhone ? "default" : "pointer",
            }}
          >
            {isLaunchingPhone
              ? locale === "fr-CA"
                ? "Lancement..."
                : "Launching..."
              : lastResponse?.vapi?.buttonLabel ??
                (locale === "fr-CA"
                  ? "Continuer par tÃ©lÃ©phone"
                  : "Continue by phone")}
          </button>
        </div>
      ) : null}

      {showPhoneFallback && lastResponse?.vapi?.phoneNumber ? (
        <div style={{ marginBottom: 12 }}>
          <a
            href={`tel:${lastResponse.vapi.phoneNumber}`}
            style={{
              display: "inline-block",
              padding: "10px 14px",
              borderRadius: 10,
              background: "#0f766e",
              color: "white",
              textDecoration: "none",
            }}
          >
            {locale === "fr-CA" ? "Appeler maintenant" : "Call now"}
          </a>
        </div>
      ) : null}

      {errorText ? (
        <div style={{ color: "#b91c1c", marginBottom: 12 }}>{errorText}</div>
      ) : null}

      <div style={{ display: "flex", gap: 8 }}>
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void sendMessage();
            }
          }}
          placeholder={
            locale === "fr-CA"
              ? "Posez votre question..."
              : "Ask your question..."
          }
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: 10,
            border: "1px solid #d1d5db",
          }}
        />
        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={isSending}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "none",
            background: "#111827",
            color: "white",
            cursor: isSending ? "default" : "pointer",
          }}
        >
          {isSending
            ? locale === "fr-CA"
              ? "Envoi..."
              : "Sending..."
            : locale === "fr-CA"
              ? "Envoyer"
              : "Send"}
        </button>
      </div>
    </section>
  );
}