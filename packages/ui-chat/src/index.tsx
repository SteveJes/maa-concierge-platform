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

type CallNowApiResponse = {
  ok: boolean;
  queued: boolean;
  provider: string;
  requestId: string;
  message: string;
  dryRun?: boolean;
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
    signals.reduce((count, signal) => count + (tokens.includes(signal) ? 1 : 0), 0);

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
  if (typeof window === "undefined") {
    return "http://127.0.0.1:4000";
  }

  const host = window.location.hostname;
  return `http://${host}:4000`;
}


export function ChatShell() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const [locale, setLocale] = useState<"fr-CA" | "en-CA">("fr-CA");

  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLaunchingPhone, setIsLaunchingPhone] = useState(false);
  const [showPhoneFallback, setShowPhoneFallback] = useState(false);
  const [pendingHandoffContext, setPendingHandoffContext] = useState<{
    summary: string;
    lastUserMessage: string;
    locale: string;
  } | null>(null);
  const [isTransferCalling, setIsTransferCalling] = useState(false);

  const [callbackName, setCallbackName] = useState("");
  const [callbackPhone, setCallbackPhone] = useState("");
  const [callbackEmail, setCallbackEmail] = useState("");
  const [callbackPreferredTime, setCallbackPreferredTime] = useState("");
  const [callbackConsent, setCallbackConsent] = useState(false);
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);
  const [showBookingCallbackFallback, setShowBookingCallbackFallback] = useState(false);
  const [isCallingNow, setIsCallingNow] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: newId(),
      role: "system",
      text: "Bonjour. Je suis la concierge du Club Sportif MAA.",
    },
  ]);

  const [lastResponse, setLastResponse] = useState<ChatApiResponse | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const canTransferCurrentChatByPhone = Boolean(lastResponse?.vapi?.handoffUrl);

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
    setPendingHandoffContext(null);

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
          dryRunPersistence: false,
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
      setShowBookingCallbackFallback(false);

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
    setPendingHandoffContext(null);

    try {
      const handoffResponse = await fetch(
        `${apiBaseUrl}${lastResponse.vapi.handoffUrl}`,
      );

      if (!handoffResponse.ok) {
        throw new Error(
          `Vapi handoff fetch failed with HTTP ${handoffResponse.status}`,
        );
      }

      const handoff = (await handoffResponse.json()) as {
        summary?: string;
        locale?: string;
        lastUserMessage?: string;
        recentTurns?: Array<{ role: string; content: string }>;
      };

      const { publicKey, assistantId, launchMode } = lastResponse.vapi;

      if (
        (launchMode === "phone_number" || launchMode === "web_call_or_number") &&
        !publicKey
      ) {
        setPendingHandoffContext({
          summary: typeof handoff.summary === "string" ? handoff.summary : "",
          lastUserMessage: typeof handoff.lastUserMessage === "string" ? handoff.lastUserMessage : "",
          locale: typeof handoff.locale === "string" ? handoff.locale : locale,
        });
        setShowPhoneFallback(true);

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
                  ? "Je n'ai pas pu démarrer l'appel web. Je vous propose un appel IA."
                  : "I couldn't start the web call. I'll connect you via an AI call instead.",
            },
          ]);

          setPendingHandoffContext({
            summary: typeof handoff.summary === "string" ? handoff.summary : "",
            lastUserMessage: typeof handoff.lastUserMessage === "string" ? handoff.lastUserMessage : "",
            locale: typeof handoff.locale === "string" ? handoff.locale : locale,
          });
          setShowPhoneFallback(true);
        });
      }

      try {
        const assistantOverrides = {
          variableValues: {
            handoff_summary:
              typeof handoff.summary === "string" ? handoff.summary : "",
            handoff_locale:
              typeof handoff.locale === "string" ? handoff.locale : locale,
            handoff_last_user_message:
              typeof handoff.lastUserMessage === "string"
                ? handoff.lastUserMessage
                : "",
            handoff_recent_turns: Array.isArray(handoff.recentTurns)
              ? handoff.recentTurns
                  .map((turn) => `${turn.role}: ${turn.content}`)
                  .join(" | ")
              : "",
          },
        };

        await vapiRef.current.start(assistantId, assistantOverrides);
      } catch {
        setMessages((current) => [
          ...current,
          {
            id: newId(),
            role: "system",
            text:
              locale === "fr-CA"
                ? "Je n'ai pas pu démarrer l'appel web. Je vous propose un appel IA."
                : "I couldn't start the web call. I'll connect you via an AI call instead.",
          },
        ]);
        setPendingHandoffContext({
          summary: typeof handoff.summary === "string" ? handoff.summary : "",
          lastUserMessage: typeof handoff.lastUserMessage === "string" ? handoff.lastUserMessage : "",
          locale: typeof handoff.locale === "string" ? handoff.locale : locale,
        });
        setShowPhoneFallback(true);
      }
    } catch {
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

      setShowPhoneFallback(true);
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
      setShowBookingCallbackFallback(false);

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

  async function requestOutboundCall(params: {
    phone: string;
    name?: string;
    email?: string;
    preferredTimeText?: string;
    callLocale: string;
    questionSummary?: string;
    chatSummary?: string;
    handoffSource: string;
  }): Promise<void> {
    const response = await fetch(`${apiBaseUrl}/v1/tenants/maa/call-now`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phone: params.phone,
        name: params.name,
        email: params.email,
        preferredTimeText: params.preferredTimeText,
        locale: params.callLocale,
        conversationId,
        questionSummary: params.questionSummary,
        chatSummary: params.chatSummary,
        handoffSource: params.handoffSource,
        dryRunPersistence: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Call now request failed with HTTP ${response.status}`);
    }

    const result = (await response.json()) as CallNowApiResponse;

    setMessages((current) => [
      ...current,
      { id: newId(), role: "assistant", text: result.message },
    ]);
  }

  async function submitCallNowRequest(): Promise<void> {
    if (!callbackPhone.trim() || !callbackConsent || isCallingNow) {
      return;
    }

    setIsCallingNow(true);
    setErrorText(null);
    setShowPhoneFallback(false);

    const recentMessages = messages
      .filter((message) => message.role === "user" || message.role === "assistant")
      .slice(-6)
      .map((message) => `${message.role === "user" ? "User" : "Assistant"}: ${message.text}`)
      .join(" | ");

    const lastUserQuestion =
      [...messages].reverse().find((message) => message.role === "user")?.text ?? "";

    try {
      await requestOutboundCall({
        phone: callbackPhone.trim(),
        name: callbackName.trim() || undefined,
        email: callbackEmail.trim() || undefined,
        preferredTimeText: callbackPreferredTime.trim() || undefined,
        callLocale: locale,
        questionSummary: lastUserQuestion || undefined,
        chatSummary: recentMessages || undefined,
        handoffSource: "web_call_now",
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown call now error";

      setErrorText(message);

      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "system",
          text:
            locale === "fr-CA"
              ? "Je n'ai pas pu démarrer l'appel immédiat pour le moment."
              : "I couldn't start the immediate call right now.",
        },
      ]);
    } finally {
      setIsCallingNow(false);
    }
  }

  async function submitTransferCallNow(): Promise<void> {
    if (!callbackPhone.trim() || !callbackConsent || isTransferCalling || !pendingHandoffContext) {
      return;
    }

    setIsTransferCalling(true);
    setErrorText(null);

    try {
      await requestOutboundCall({
        phone: callbackPhone.trim(),
        callLocale: pendingHandoffContext.locale,
        questionSummary: pendingHandoffContext.lastUserMessage || undefined,
        chatSummary: pendingHandoffContext.summary || undefined,
        handoffSource: "web_transfer_phone",
      });

      setPendingHandoffContext(null);
      setShowPhoneFallback(false);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown transfer call error";

      setErrorText(message);

      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "system",
          text:
            pendingHandoffContext.locale === "fr-CA"
              ? "Je n'ai pas pu démarrer l'appel pour le moment."
              : "I couldn't start the call right now.",
        },
      ]);
    } finally {
      setIsTransferCalling(false);
    }
  }

  const showBookingButton =
    lastResponse?.followUpMode === "calendly" &&
    lastResponse.booking?.bookingUrl;

  const showPhoneButton =
    lastResponse?.followUpMode === "vapi" && lastResponse.vapi?.enabled;

  const showCallbackForm =
    (lastResponse?.followUpMode === "callback" ||
      (lastResponse?.followUpMode === "calendly" &&
        lastResponse.booking?.allowCallbackFallback &&
        showBookingCallbackFallback)) &&
    !lastResponse?.callbackPersistence?.saved;

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          marginBottom: 8,
        }}
      >
        <strong>{locale === "fr-CA" ? "Concierge IA MAA" : "MAA AI Concierge"}</strong>

        <button
          type="button"
          onClick={() => void handleContinueByPhone()}
          disabled={!canTransferCurrentChatByPhone || isLaunchingPhone}
          style={{
            padding: "10px 14px",
            borderRadius: 10,
            border: "none",
            background: "#1d4ed8",
            color: "white",
            cursor:
              !canTransferCurrentChatByPhone || isLaunchingPhone ? "default" : "pointer",
            opacity: !canTransferCurrentChatByPhone || isLaunchingPhone ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {isLaunchingPhone
            ? locale === "fr-CA"
              ? "Lancement..."
              : "Launching..."
            : locale === "fr-CA"
              ? "Transférer au téléphone"
              : "Transfer to phone"}
        </button>
      </div>

      <div
        style={{
          fontSize: 13,
          color: "#6b7280",
          marginBottom: 12,
        }}
      >
        {locale === "fr-CA"
          ? "Pour transférer cette conversation au téléphone, commencez le clavardage puis cliquez sur le bouton."
          : "To transfer this conversation to a phone call, start the chat, then click the button."}
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
          {lastResponse!.booking.allowCallbackFallback && !showBookingCallbackFallback ? (
            <button
              type="button"
              onClick={() => setShowBookingCallbackFallback(true)}
              style={{
                background: "none",
                border: "none",
                color: "#6b7280",
                fontSize: 13,
                cursor: "pointer",
                padding: "10px 4px",
                textDecoration: "underline",
              }}
            >
              {locale === "fr-CA" ? "Vous préférez qu'on vous appelle ?" : "Prefer a callback instead?"}
            </button>
          ) : null}
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

      {showPhoneFallback ? (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            border: "1px solid #e5e7eb",
            borderRadius: 12,
            background: "#fafafa",
          }}
        >
          {pendingHandoffContext ? (
            <>
              <div style={{ fontWeight: 600, marginBottom: 10 }}>
                {locale === "fr-CA" ? "Laissez l'IA vous appeler" : "Let the AI call you"}
              </div>

              <div style={{ display: "grid", gap: 8 }}>
                <input
                  value={callbackPhone}
                  onChange={(event) => setCallbackPhone(event.target.value)}
                  placeholder={locale === "fr-CA" ? "Votre numéro de téléphone *" : "Your phone number *"}
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
                  onClick={() => void submitTransferCallNow()}
                  disabled={isTransferCalling || !callbackPhone.trim() || !callbackConsent}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "none",
                    background: "#1d4ed8",
                    color: "white",
                    cursor:
                      isTransferCalling || !callbackPhone.trim() || !callbackConsent
                        ? "default"
                        : "pointer",
                  }}
                >
                  {isTransferCalling
                    ? locale === "fr-CA"
                      ? "Appel en cours..."
                      : "Calling now..."
                    : locale === "fr-CA"
                      ? "Appelez-moi maintenant"
                      : "Call me now"}
                </button>

                {lastResponse?.vapi?.phoneNumber ? (
                  <a
                    href={`tel:${lastResponse.vapi.phoneNumber}`}
                    style={{ fontSize: 13, color: "#6b7280", textAlign: "center" }}
                  >
                    {locale === "fr-CA" ? "Ou composer directement" : "Or dial directly"}
                  </a>
                ) : null}
              </div>
            </>
          ) : (
            <div style={{ color: "#b91c1c" }}>
              {locale === "fr-CA"
                ? "Le contexte du transfert est manquant."
                : "Transfer context is unavailable."}
              {lastResponse?.vapi?.phoneNumber ? (
                <>
                  {" "}
                  <a href={`tel:${lastResponse.vapi.phoneNumber}`}>
                    {locale === "fr-CA" ? "Composer directement" : "Dial directly"}
                  </a>
                </>
              ) : null}
            </div>
          )}
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

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
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

              <button
                type="button"
                onClick={() => void submitCallNowRequest()}
                disabled={isCallingNow || !callbackPhone.trim() || !callbackConsent}
                style={{
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: "none",
                  background: "#1d4ed8",
                  color: "white",
                  cursor:
                    isCallingNow || !callbackPhone.trim() || !callbackConsent
                      ? "default"
                      : "pointer",
                }}
              >
                {isCallingNow
                  ? locale === "fr-CA"
                    ? "Appel en cours..."
                    : "Calling now..."
                  : locale === "fr-CA"
                    ? "Appelez-moi maintenant"
                    : "Call me now"}
              </button>
            </div>
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