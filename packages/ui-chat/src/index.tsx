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

function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function detectMessageLocale(
  message: string,
  previousLocale: "fr-CA" | "en-CA",
): "fr-CA" | "en-CA" {
  const normalized = message
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = normalized.split(" ").filter(Boolean);

  const frenchSignals = [
    "bonjour",
    "salut",
    "bonsoir",
    "allo",
    "coucou",
    "merci",
    "svp",
    "vous",
    "votre",
    "vos",
    "quoi",
    "ou",
    "comment",
    "pouvez",
    "rappel",
    "piscine",
    "cours",
    "metro",
    "appel",
    "stationnement",
    "pres",
    "proche",
    "plus",
    "quelle",
    "quel",
    "adresse",
  ];

  const englishSignals = [
    "hello",
    "hi",
    "hey",
    "thanks",
    "please",
    "what",
    "where",
    "how",
    "can",
    "do",
    "offer",
    "callback",
    "call",
    "phone",
    "guys",
    "pool",
    "yoga",
    "metro",
    "are",
    "near",
    "exactly",
    "is",
    "there",
    "parking",
    "nearby",
    "closest",
    "station",
    "from",
    "address",
  ];

  const countMatches = (signals: string[]): number =>
    signals.reduce((count, signal) => {
      return count + (tokens.includes(signal) ? 1 : 0);
    }, 0);

  const frenchScore = countMatches(frenchSignals);
  const englishScore = countMatches(englishSignals);

  if (englishScore > frenchScore) {
    return "en-CA";
  }

  if (frenchScore > englishScore) {
    return "fr-CA";
  }

  return previousLocale;
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
  const [locale, setLocale] = useState<"fr-CA" | "en-CA">("fr-CA");

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLaunchingPhone, setIsLaunchingPhone] = useState(false);
  const [showPhoneFallback, setShowPhoneFallback] = useState(false);

  const [callbackName, setCallbackName] = useState("");
  const [callbackPhone, setCallbackPhone] = useState("");
  const [callbackEmail, setCallbackEmail] = useState("");
  const [callbackPreferredTime, setCallbackPreferredTime] = useState("");
  const [callbackConsent, setCallbackConsent] = useState(false);
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: newId(),
      role: "system",
      text: "Bonjour. Je suis la concierge du Club Sportif MAA.",
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

    const requestLocale = detectMessageLocale(trimmed, locale);

    setLocale(requestLocale);
    setErrorText(null);
    setIsSending(true);
    setShowPhoneFallback(false);

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
          locale: requestLocale,
          conversationId,
          dryRunPersistence: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with HTTP ${response.status}`);
      }

      const body = (await response.json()) as ChatApiResponse;

      const assistantText =
        body.followUpMode === "callback" && !body.callbackPersistence.saved
          ? requestLocale === "fr-CA"
            ? "Bien sûr — remplissez le formulaire de rappel ci-dessous et un membre de l'équipe du Club Sportif MAA vous contactera."
            : "Of course — fill in the callback form below and a Club Sportif MAA team member will get back to you."
          : body.assistantMessage;

      setConversationId(body.conversationId);
      setLastResponse(body);

      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "assistant",
          text: assistantText,
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
            requestLocale === "fr-CA"
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

      await handoffResponse.json();

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
            ? "Configuration Vapi incomplète."
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
      } catch {
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

        throw new Error(
          locale === "fr-CA"
            ? "Impossible de démarrer l'appel."
            : "Unable to start the call.",
        );
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

  async function submitCallbackRequest(): Promise<void> {
    if (!callbackPhone.trim() || !callbackConsent || isSubmittingCallback) {
      return;
    }

    setIsSubmittingCallback(true);
    setErrorText(null);
    setShowPhoneFallback(false);

    const lastUserQuestion =
      [...messages]
        .reverse()
        .find((message) => message.role === "user")?.text ?? "";

    try {
      const response = await fetch(`${apiBaseUrl}/v1/tenants/maa/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message:
            locale === "fr-CA"
              ? "Je souhaite un rappel."
              : "I would like a callback.",
          locale,
          conversationId,
          dryRunPersistence: true,
          callback: {
            name: callbackName.trim() || undefined,
            phone: callbackPhone.trim(),
            email: callbackEmail.trim() || undefined,
            preferredTimeText: callbackPreferredTime.trim() || undefined,
            questionSummary: lastUserQuestion || undefined,
            consentToContact: true,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Callback request failed with HTTP ${response.status}`);
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

      setCallbackName("");
      setCallbackPhone("");
      setCallbackEmail("");
      setCallbackPreferredTime("");
      setCallbackConsent(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown callback error";

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
      setIsSubmittingCallback(false);
    }
  }

  const showBookingButton =
    lastResponse?.followUpMode === "calendly" &&
    lastResponse.booking?.bookingUrl;

  const showPhoneButton =
    lastResponse?.followUpMode === "vapi" && lastResponse.vapi?.enabled;

  const showCallbackForm =
    lastResponse?.followUpMode === "callback" &&
    !lastResponse.callbackPersistence?.saved;

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
        <strong>{locale === "fr-CA" ? "Concierge IA MAA" : "MAA AI Concierge"}</strong>
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
                  ? "Continuer par téléphone"
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

      {showCallbackForm ? (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#fafafa",
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 10 }}>
            {locale === "fr-CA" ? "Demander un rappel" : "Request a callback"}
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={callbackName}
              onChange={(event) => setCallbackName(event.target.value)}
              placeholder={locale === "fr-CA" ? "Nom (optionnel)" : "Name (optional)"}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
              }}
            />

            <input
              value={callbackPhone}
              onChange={(event) => setCallbackPhone(event.target.value)}
              placeholder={locale === "fr-CA" ? "Téléphone *" : "Phone *"}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
              }}
            />

            <input
              value={callbackEmail}
              onChange={(event) => setCallbackEmail(event.target.value)}
              placeholder={
                locale === "fr-CA"
                  ? "Courriel (optionnel)"
                  : "Email (optional)"
              }
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
              }}
            />

            <input
              value={callbackPreferredTime}
              onChange={(event) => setCallbackPreferredTime(event.target.value)}
              placeholder={
                locale === "fr-CA"
                  ? "Moment préféré pour le rappel (optionnel)"
                  : "Preferred callback time (optional)"
              }
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #d1d5db",
              }}
            />

            <label style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <input
                type="checkbox"
                checked={callbackConsent}
                onChange={(event) => setCallbackConsent(event.target.checked)}
              />
              <span>
                {locale === "fr-CA"
                  ? "J'accepte d'être contacté par l'équipe du Club Sportif MAA."
                  : "I agree to be contacted by the Club Sportif MAA team."}
              </span>
            </label>

            <button
              type="button"
              onClick={() => void submitCallbackRequest()}
              disabled={
                isSubmittingCallback || !callbackPhone.trim() || !callbackConsent
              }
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "none",
                background: "#0f766e",
                color: "white",
                cursor:
                  isSubmittingCallback || !callbackPhone.trim() || !callbackConsent
                    ? "default"
                    : "pointer",
                width: "fit-content",
              }}
            >
              {isSubmittingCallback
                ? locale === "fr-CA"
                  ? "Envoi..."
                  : "Submitting..."
                : locale === "fr-CA"
                  ? "Envoyer la demande"
                  : "Send request"}
            </button>
          </div>
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