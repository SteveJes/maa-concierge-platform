/// <reference path="./vapi-web.d.ts" />
"use client";

import Vapi from "@vapi-ai/web";
import { useEffect, useMemo, useRef, useState } from "react";

// Rotating proactive nudge messages — fired every 35s during inactivity
const PROACTIVE_NUDGES_FR = [
  "Saviez-vous que nos membres bénéficient d'un accès complet à la piscine, au spa et à plus de 50 cours de groupe par semaine ? Je peux vous aider à trouver la formule idéale.",
  "Le Club Sportif MAA est l'un des clubs les plus prestigieux de Montréal, fondé en 1881. Souhaitez-vous en savoir plus sur nos installations ou nos tarifs ?",
  "Notre piscine intérieure de 25 mètres, notre spa et nos courts de squash sont parmi les meilleures installations du centre-ville. Puis-je répondre à vos questions ?",
  "Vous pensez à l'abonnement ? Je peux vous donner un aperçu de nos formules et vous aider à choisir la meilleure option selon vos besoins.",
  "Besoin d'un coup de pouce ? Je suis disponible pour vous aider avec les tarifs, les horaires, les cours ou pour planifier une visite des installations.",
];
const PROACTIVE_NUDGES_EN = [
  "Did you know our members enjoy full access to the pool, spa, and over 50 group classes per week? I can help you find the perfect plan.",
  "Club Sportif MAA has been a Montreal landmark since 1881. Would you like to learn more about our facilities or membership options?",
  "Our 25m indoor pool, full spa, and squash courts are among the finest facilities in downtown Montreal. Can I answer any questions for you?",
  "Thinking about membership? I can walk you through our plans and help you find the best fit for your lifestyle.",
  "Need a hand? I'm here to help with pricing, hours, group classes, or to schedule a tour of the club.",
];

const GYM_SERVICES_FR = [
  "Piscine intérieure 25m",
  "Yoga & Pilates",
  "Squash",
  "Spa & Massothérapie",
  "Nutrition",
  "Cours de groupe",
  "Physiothérapie",
  "Club Triathlon",
  "Cirque aérien",
  "Restaurant Le 1881",
];

const GYM_SERVICES_EN = [
  "Indoor Pool 25m",
  "Yoga & Pilates",
  "Squash Courts",
  "Spa & Massage Therapy",
  "Nutrition Services",
  "Group Classes",
  "Physiotherapy",
  "Triathlon Club",
  "Aerial Circus",
  "Restaurant Le 1881",
];

function GymLoadingIndicator({ locale }: { locale: string }) {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: 14,
        background: "#ffffff",
        border: "1px solid #e8eaed",
        boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
        display: "flex",
        alignItems: "center",
        gap: 10,
        maxWidth: "75%",
      }}
    >
      {/* Three animated gold dots */}
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "var(--accent-gradient)",
              animation: `maa-dot-bounce 1.2s ease-in-out ${i * 0.18}s infinite`,
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 12, color: "#9a9ab0", fontStyle: "italic", letterSpacing: "0.01em" }}>
        {locale === "fr-CA" ? "Un instant…" : "One moment…"}
      </span>
    </div>
  );
}

// Minimalist geometric bullet shapes — no emoji, purely typographic
const BULLET_SHAPES = ["◆", "◆", "◆", "◆", "◆", "◆", "◆", "◆", "◆", "◆"];

function getBulletIcon(index: number): string {
  return BULLET_SHAPES[index % BULLET_SHAPES.length]!;
}

const PHONE_RE = /(\+?1?[\s.\-]?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}(?:\s*(?:ext|poste|x)[\s.]?\d{1,4})?)/gi;

// Render assistant message text with:
// - bullet points (lines starting with •, -, *, or numbered) → gym icon + styled line
// - phone numbers → clickable tel: links
function RichMessageText({ text }: { text: string }) {
  const lines = text.split("\n");

  const elements: React.ReactNode[] = [];
  let bulletIndex = 0;
  let pendingParagraph: string[] = [];

  function flushParagraph() {
    if (pendingParagraph.length === 0) return;
    const raw = pendingParagraph.join(" ").trim();
    if (raw) elements.push(<span key={elements.length}>{renderInline(raw)}<br /></span>);
    pendingParagraph = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();
    const bulletMatch = /^([•\-\*]|\d+[.)]) (.+)/.exec(trimmed);

    if (bulletMatch) {
      flushParagraph();
      const content = bulletMatch[2]!;
      const icon = getBulletIcon(bulletIndex++);
      elements.push(
        <div key={elements.length} style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "4px 0" }}>
          <span style={{ fontSize: 7, color: "var(--accent)", flexShrink: 0, position: "relative", top: -1, letterSpacing: 0 }}>{icon}</span>
          <span style={{ lineHeight: 1.55, color: "inherit" }}>{renderInline(content)}</span>
        </div>
      );
    } else if (trimmed === "") {
      flushParagraph();
      if (elements.length > 0) elements.push(<br key={elements.length} />);
    } else {
      pendingParagraph.push(trimmed);
    }
  }
  flushParagraph();

  return <>{elements}</>;
}

function renderInline(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  const re = new RegExp(PHONE_RE.source, "gi");
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const raw = match[0]!;
    const tel = raw.replace(/[^\d+]/g, "");
    parts.push(
      <a
        key={match.index}
        href={`tel:${tel}`}
        style={{ color: "#1a6e3c", fontWeight: 600, textDecoration: "none", borderBottom: "1px solid rgba(26,110,60,0.3)" }}
      >
        {raw}
      </a>
    );
    last = match.index + raw.length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  text: string;
  kind?: "nudge";
  /**
   * When true, the post-pricing booking CTA below this message MUST stay hidden,
   * regardless of whether the message text mentions "$" or "abonnement". Set from
   * the API's suppressBookingCta flag for cancellation, policy, laundry, menu,
   * spa-package, and other non-pricing replies. Daphné's third pass.
   */
  suppressBookingCta?: boolean;
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
  /**
   * Backend authority on whether to render the post-pricing booking CTA.
   * When true, the widget MUST hide "Prochaine étape ? → Planifier une visite"
   * even if the assistant message contains "$" or "abonnement". Set whenever
   * a critical intent (cancellation, policy, etc.) was detected, when the
   * follow-up mode is callback/vapi, or when the question targets a specific
   * service rather than membership.
   */
  suppressBookingCta?: boolean;
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
    "bonjour", "salut", "bonsoir", "allo", "coucou",
    "merci", "svp", "sil", "plaît",
    "je", "mon", "ma", "mes", "ce", "cette", "ces",
    "pour", "le", "la", "les", "un", "une", "des", "du", "au",
    "et", "est", "pas", "ne", "qui", "que", "quand", "avec", "sans",
    "en", "sur", "dans", "par",
    "ou", "quoi", "quels", "quelles", "quel", "quelle", "comment",
    "combien", "pourquoi",
    "vous", "votre", "vos", "pouvez",
    "piscine", "cours", "rappel", "appel", "stationnement",
    "pres", "proche", "plus", "adresse", "horaire", "horaires",
    "abonnement", "tarif", "prix", "annulation",
  ];

  const englishSignals = [
    "hello", "hi", "hey", "thanks", "please",
    "what", "where", "how", "are", "is", "do", "can",
    "near", "nearby", "closest", "exactly", "there", "from",
    "station", "parking",
    "phone", "call", "callback", "address",
    "pool", "guys", "offer", "hours", "open",
    "membership", "fee", "price", "cost", "cancel", "policy", "guest",
    "book", "booking", "tour", "want", "would", "like", "need",
    "my", "your", "appointment", "class",
  ];

  const countMatches = (signals: string[]): number =>
    signals.reduce((count, signal) => count + (tokens.includes(signal) ? 1 : 0), 0);

  const frenchScore = countMatches(frenchSignals);
  const englishScore = countMatches(englishSignals);

  if (englishScore > frenchScore) return "en-CA";
  if (frenchScore > englishScore) return "fr-CA";
  return previousLocale;
}

function getApiBaseUrl(): string {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:4000";
  }
  const host = window.location.hostname;
  if (host === "clients.dubub.com" || host === "dubub.com") {
    return "https://api.dubub.com";
  }
  return `http://${host}:4000`;
}

// Format an E.164 phone for display: +14388029845 → (438) 802-9845
function formatPhoneDisplay(raw: string | null): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  // North American: 11 digits starting with 1, or 10 digits
  const local = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits.length === 10 ? digits : null;
  if (local && local.length === 10) return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  return raw; // fallback to raw if format unknown
}

// Pill-style input shared style helper
const pillInput = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: "8px 14px",
  borderRadius: 20,
  border: "1px solid #d0d5dd",
  background: "#ffffff",
  color: "#1a1a1a",
  fontSize: 13,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
  ...extra,
});

// ---------------------------------------------------------------------------
// DUBUB intro animation — shown once when the chat first opens (darkMode only)
// ---------------------------------------------------------------------------
const DUBUB_INTRO_KEYFRAMES = `
@keyframes dubub-fade-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
@keyframes dubub-expand   { from { opacity:0; letter-spacing:0.04em; } to { opacity:1; letter-spacing:0.22em; } }
@keyframes dubub-bow      { 0%{transform:translateY(0)} 40%{transform:translateY(9px)} 70%{transform:translateY(-3px)} 100%{transform:translateY(0)} }
@keyframes dubub-out      { from { opacity:1; transform:scale(1); } to { opacity:0; transform:scale(0.97); } }
`;

function DububIntroAnimation({ accentColor, onDone }: { accentColor: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3400);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <>
      <style>{DUBUB_INTRO_KEYFRAMES}</style>
      <div style={{
        position: "absolute", inset: 0, zIndex: 200,
        background: "#080d08",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        gap: 0,
        animation: "dubub-out 0.6s 2.8s both",
        pointerEvents: "none",
      }}>
        {/* BONJOUR */}
        <div style={{
          fontSize: 11, fontWeight: 700, letterSpacing: "0.28em",
          color: "rgba(255,255,255,0.28)", marginBottom: 24,
          animation: "dubub-fade-in 0.5s 0.2s both",
        }}>
          BONJOUR
        </div>

        {/* ICI SOPH·IA */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 0 }}>
          <span style={{
            fontSize: 42, fontWeight: 800, letterSpacing: "0.12em",
            color: "#fff", lineHeight: 1,
            animation: "dubub-fade-in 0.5s 0.5s both",
          }}>SOPH</span>

          {/* I with animated dot */}
          <span style={{
            position: "relative", display: "inline-block",
            fontSize: 42, fontWeight: 800,
            color: accentColor, lineHeight: 1, letterSpacing: "0.12em",
            animation: "dubub-fade-in 0.5s 0.8s both",
          }}>
            {/* Dot that bows */}
            <span style={{
              position: "absolute", top: -3, left: "50%",
              transform: "translateX(-50%)",
              width: 7, height: 7, borderRadius: "50%",
              background: accentColor,
              animation: "dubub-bow 0.7s 1.4s ease-in-out both",
            }} />
            {"I"}
          </span>
          <span style={{
            fontSize: 42, fontWeight: 800, letterSpacing: "0.12em",
            color: accentColor, lineHeight: 1,
            animation: "dubub-fade-in 0.5s 0.8s both",
          }}>A</span>
        </div>

        {/* Intelligence Artificielle */}
        <div style={{
          fontSize: 10, fontWeight: 600,
          color: accentColor, marginTop: 14, opacity: 0,
          animation: "dubub-expand 0.7s 1.1s both",
          overflow: "hidden", whiteSpace: "nowrap",
        }}>
          Intelligence Artificielle
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: 9, fontWeight: 500, letterSpacing: "0.18em",
          color: "rgba(255,255,255,0.22)", marginTop: 32,
          animation: "dubub-fade-in 0.5s 1.5s both",
          textTransform: "uppercase",
        }}>
          Technologie développée par DUBUB
        </div>
      </div>
    </>
  );
}

export function ChatShell({
  accentColor = "#c9a84c",
  accentGradient = "linear-gradient(135deg, #c9a84c, #a07830)",
  accentRgb = "201,168,76",
  accentTextColor = "#fff",
  darkMode = false,
  mode = "inline",
  tenantId = "maa",
  conciergeName = "Sophie",
  clientName = "Club Sportif MAA",
  logoUrl = "https://www.clubsportifmaa.com/wp-content/uploads/2021/01/club-sportif-maa-logo.svg",
  headerTitle,
  nudgesFr = PROACTIVE_NUDGES_FR,
  nudgesEn = PROACTIVE_NUDGES_EN,
  nudgeLabelFr = "Conseil Privilège",
  nudgeLabelEn = "Concierge Insight",
  nudgeSubLabelFr = "Information du club",
  nudgeSubLabelEn = "Club information",
  suggestedQuestionsFr,
  suggestedQuestionsEn,
  tenantPhone,
  pricingCtaFr = "→ Planifier une visite",
  pricingCtaEn = "→ Schedule a tour",
  pricingCtaMessageFr = "Je souhaite planifier une visite des installations.",
  pricingCtaMessageEn = "I'd like to schedule a tour of the facilities.",
  injectMessage,
}: {
  accentColor?: string;
  accentGradient?: string;
  accentRgb?: string;
  accentTextColor?: string;
  darkMode?: boolean;
  mode?: "inline" | "floating";
  tenantId?: string;
  conciergeName?: string;
  clientName?: string;
  logoUrl?: string | null;
  headerTitle?: string;
  nudgesFr?: string[];
  nudgesEn?: string[];
  nudgeLabelFr?: string;
  nudgeLabelEn?: string;
  nudgeSubLabelFr?: string;
  nudgeSubLabelEn?: string;
  suggestedQuestionsFr?: string[];
  suggestedQuestionsEn?: string[];
  tenantPhone?: string | null;
  pricingCtaFr?: string;
  pricingCtaEn?: string;
  pricingCtaMessageFr?: string;
  pricingCtaMessageEn?: string;
  injectMessage?: string;
} = {}) {

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
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isCallingNow, setIsCallingNow] = useState(false);
  const [showIntro, setShowIntro] = useState(darkMode); // DUBUB only: show on first open

  // Dynamic suggested questions — fetched from API, fallback to static
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  useEffect(() => {
    // Use prop-provided questions directly if given
    if (suggestedQuestionsFr || suggestedQuestionsEn) {
      const qs = locale === "fr-CA" ? (suggestedQuestionsFr ?? []) : (suggestedQuestionsEn ?? []);
      setSuggestedQuestions(qs.slice(0, 4));
      return;
    }
    // Otherwise try to fetch from API
    fetch(`${apiBaseUrl}/v1/tenants/${tenantId}/popular-questions?days=30`)
      .then((r) => r.json())
      .then((data: { fr?: string[]; en?: string[] }) => {
        const questions = locale === "fr-CA" ? (data.fr ?? []) : (data.en ?? []);
        if (questions.length > 0) setSuggestedQuestions(questions.slice(0, 4));
      })
      .catch(() => {
        setSuggestedQuestions([]);
      });
  }, [locale, tenantId, suggestedQuestionsFr, suggestedQuestionsEn, apiBaseUrl]);

  // PostHog tracking — uses window.posthog if the host page initialized it.
  // No-op when PostHog is not loaded (CI, embeds without analytics).
  function track(event: string, properties?: Record<string, unknown>): void {
    try {
      const ph = (window as unknown as { posthog?: { capture: (e: string, p?: object) => void } }).posthog;
      ph?.capture(event, { tenantId, ...properties });
    } catch {
      /* analytics never break product */
    }
  }

  // Fire once per widget mount.
  useEffect(() => {
    track("concierge_chat_opened", { locale });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Name capture state — persisted in localStorage per tenant
  const STORAGE_KEY = "maa_concierge_user";

  const [userName, setUserNameState] = useState<string | null>(null);
  const [showNameCapture, setShowNameCapture] = useState(false);
  const [nameInput, setNameInput] = useState("");

  const defaultGreeting = locale === "fr-CA"
    ? `Bonjour, bienvenue à ${clientName}. Je suis ${conciergeName}, votre concierge IA. Comment puis-je vous aider aujourd'hui ?`
    : `Hello, welcome to ${clientName}. I'm ${conciergeName}, your AI concierge. How can I help you today?`;

  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: newId(), role: "assistant", text: defaultGreeting },
  ]);

  // Read localStorage only after mount to avoid SSR/client hydration mismatch
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const stored = JSON.parse(raw) as { name?: string; locale?: string };
      if (stored.name) {
        setUserNameState(stored.name);
        const returningGreeting = locale === "fr-CA"
          ? `Bon retour, ${stored.name} ! Comment puis-je vous aider aujourd'hui ?`
          : `Welcome back, ${stored.name}! How can I help you today?`;
        setMessages([{ id: newId(), role: "assistant", text: returningGreeting }]);
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setUserName(name: string | null) {
    setUserNameState(name);
    if (name && !callbackName.trim()) setCallbackName(name);
    try {
      if (name) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, locale }));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch { /* ignore */ }
  }

  const [lastResponse, setLastResponse] = useState<ChatApiResponse | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  // Pre-fill callback form fields as we learn more about the user
  useEffect(() => {
    if (userName && !callbackName.trim()) setCallbackName(userName);
  }, [userName]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const userTexts = messages.filter((m) => m.role === "user").map((m) => m.text).join(" ");
    if (!callbackPhone.trim()) {
      const phoneMatch = userTexts.match(/(\+?1?\s*\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4})/);
      if (phoneMatch) setCallbackPhone(phoneMatch[1]!.replace(/\s+/g, " ").trim());
    }
    if (!callbackEmail.trim()) {
      const emailMatch = userTexts.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
      if (emailMatch) setCallbackEmail(emailMatch[0]!);
    }
  }, [messages]); // eslint-disable-line react-hooks/exhaustive-deps

  const canTransferCurrentChatByPhone = Boolean(lastResponse?.vapi?.handoffUrl);
  const [showLoadingAnimation, setShowLoadingAnimation] = useState(false);
  const [showInlineCallForm, setShowInlineCallForm] = useState(false);
  const [inboundReadyNumber, setInboundReadyNumber] = useState<string | null>(null); // Sophie's inbound number shown after context registration
  const [isRegisteringInbound, setIsRegisteringInbound] = useState(false);
  const [nudgeIndex, setNudgeIndex] = useState(0);

  useEffect(() => {
    if (!isSending) {
      setShowLoadingAnimation(false);
      return;
    }
    const timer = setTimeout(() => setShowLoadingAnimation(true), 700);
    return () => clearTimeout(timer);
  }, [isSending]);

  // Rotating proactive nudges during inactivity — first at 25s, then every 35s, max 5 total
  useEffect(() => {
    if (messages.length > 1 || nudgeIndex >= 5) return;
    const delay = nudgeIndex === 0 ? 25000 : 35000;
    const timer = setTimeout(() => {
      const nudges = locale === "fr-CA" ? nudgesFr : nudgesEn;
      const text = nudges[nudgeIndex % nudges.length]!;
      setMessages((current) => [...current, { id: newId(), role: "assistant", text, kind: "nudge" }]);
      setNudgeIndex((i) => i + 1);
    }, delay);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudgeIndex, locale]);

  // Trigger name capture after first AI reply to user
  useEffect(() => {
    if (messages.length === 3 && !userName) {
      setShowNameCapture(true);
    }
  }, [messages.length]);

  const vapiRef = useRef<Vapi | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isSending]);

  useEffect(() => {
    if (!injectMessage) return;
    setInput(injectMessage);
    setTimeout(() => {
      document.querySelector<HTMLButtonElement>("[data-send-btn]")?.click();
    }, 80);
  }, [injectMessage]);

  async function sendMessage(): Promise<void> {
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const requestLocale = detectMessageLocale(trimmed, locale);
    setLocale(requestLocale);
    setErrorText(null);
    setIsSending(true);
    setShowPhoneFallback(false);
    setPendingHandoffContext(null);

    // Funnel: first user message in this widget session.
    const priorUserMessageCount = messages.filter((m) => m.role === "user").length;
    if (priorUserMessageCount === 0) {
      track("concierge_first_message", { locale: requestLocale, length: trimmed.length });
    }

    setMessages((current) => [
      ...current,
      { id: newId(), role: "user", text: trimmed },
    ]);
    setInput("");

    try {
      const response = await fetch(`${apiBaseUrl}/v1/tenants/${tenantId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          locale: requestLocale,
          conversationId,
          dryRunPersistence: false,
          userName: userName ?? undefined,
        }),
      });

      if (!response.ok) {
        throw new Error(`Chat request failed with HTTP ${response.status}`);
      }

      const body = (await response.json()) as ChatApiResponse;

      // Only override the AI's reply with the generic callback-form template when the AI did
      // not return a substantive message (empty, very short, or itself a generic acknowledgement).
      // For critical intents (cancellation, guarantee, identity, executive contact, etc.) the AI
      // returns a careful reply via the safety layer — keep it intact.
      const aiMessage = body.assistantMessage?.trim() ?? "";
      const isGenericCallbackAck =
        aiMessage.length === 0 ||
        /^(ok|d'accord|sure|bien s[uû]r\.?|okay|yes|noted)\.?$/i.test(aiMessage);
      const assistantText =
        body.followUpMode === "callback" && !body.callbackPersistence.saved && isGenericCallbackAck
          ? requestLocale === "fr-CA"
            ? `Bien sûr — remplissez le formulaire ci-dessous et un membre de l'équipe ${clientName} vous contactera.`
            : `Of course — fill in the form below and a ${clientName} team member will get back to you.`
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
          // Honor the backend's authority on the booking CTA. When true, the
          // post-pricing "Prochaine étape ? → Planifier une visite" link below
          // this assistant bubble stays hidden — even if the reply mentions $ /
          // abonnement / membership in passing.
          suppressBookingCta: body.suppressBookingCta === true,
        },
      ]);

      // Sentiment routing: if user seems frustrated after 3+ turns, proactively offer callback
      if (
        body.followUpMode !== "callback" &&
        body.followUpMode !== "vapi" &&
        messages.filter((m) => m.role === "user").length >= 3
      ) {
        const frustrationSignals = [
          "je ne comprends pas", "i don't understand", "c'est pas clair",
          "not helpful", "pas utile", "can you just", "dites-moi juste",
          "ça ne répond pas", "that doesn't answer",
        ];
        const lowerMsg = trimmed.toLowerCase();
        if (frustrationSignals.some((s) => lowerMsg.includes(s))) {
          setMessages((current) => [
            ...current,
            {
              id: newId(),
              role: "system",
              text: requestLocale === "fr-CA"
                ? "Souhaitez-vous qu'un membre de l'équipe vous rappelle pour répondre à vos questions ?"
                : "Would you like a team member to call you back to answer your questions?",
            },
          ]);
          setShowInlineCallForm(true);
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown chat error";
      setErrorText(message);
      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "system",
          text: requestLocale === "fr-CA" ? `Erreur: ${message}` : `Error: ${message}`,
        },
      ]);
    } finally {
      setIsSending(false);
    }
  }

  async function handleContinueByPhone(): Promise<void> {
    if (!lastResponse?.vapi?.handoffUrl || isLaunchingPhone) return;

    setIsLaunchingPhone(true);
    setErrorText(null);
    setShowPhoneFallback(false);
    setPendingHandoffContext(null);

    try {
      const handoffResponse = await fetch(`${apiBaseUrl}${lastResponse.vapi.handoffUrl}`);

      if (!handoffResponse.ok) {
        throw new Error(`Vapi handoff fetch failed with HTTP ${handoffResponse.status}`);
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
              text: locale === "fr-CA"
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
            handoff_summary: typeof handoff.summary === "string" ? handoff.summary : "",
            handoff_locale: typeof handoff.locale === "string" ? handoff.locale : locale,
            handoff_last_user_message: typeof handoff.lastUserMessage === "string" ? handoff.lastUserMessage : "",
            handoff_recent_turns: Array.isArray(handoff.recentTurns)
              ? handoff.recentTurns.map((turn) => `${turn.role}: ${turn.content}`).join(" | ")
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
            text: locale === "fr-CA"
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
          text: locale === "fr-CA"
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
    if (!callbackPhone.trim() || !callbackConsent || isSubmittingCallback) return;

    setIsSubmittingCallback(true);
    setErrorText(null);
    setShowPhoneFallback(false);

    const lastUserQuestion =
      [...messages].reverse().find((message) => message.role === "user")?.text ?? "";

    try {
      const response = await fetch(`${apiBaseUrl}/v1/tenants/${tenantId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: locale === "fr-CA" ? "Je souhaite un rappel." : "I would like a callback.",
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
        { id: newId(), role: "assistant", text: body.assistantMessage },
      ]);

      // Funnel: lead capture confirmed.
      if (body.callbackPersistence?.saved) {
        track("concierge_lead_captured", {
          locale,
          hasEmail: callbackEmail.trim().length > 0,
          hasPreferredTime: callbackPreferredTime.trim().length > 0,
        });
      }

      setCallbackName("");
      setCallbackPhone("");
      setCallbackEmail("");
      setCallbackPreferredTime("");
      setCallbackConsent(false);
      setShowLeadForm(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown callback error";
      setErrorText(message);
      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "system",
          text: locale === "fr-CA" ? `Erreur: ${message}` : `Error: ${message}`,
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
    const response = await fetch(`${apiBaseUrl}/v1/tenants/${tenantId}/call-now`, {
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

  async function registerInboundHandoff(): Promise<void> {
    if (!callbackPhone.trim() || !callbackConsent || isRegisteringInbound) return;
    setIsRegisteringInbound(true);
    try {
      const lastUserQuestion = [...messages].reverse().find((m) => m.role === "user")?.text ?? "";
      const recentMessages = messages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .slice(-6)
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
        .join(" | ");

      const res = await fetch(`${apiBaseUrl}/v1/tenants/${tenantId}/inbound-handoff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: callbackPhone.trim(),
          name: callbackName.trim() || undefined,
          email: callbackEmail.trim() || undefined,
          locale,
          lastUserMessage: lastUserQuestion || undefined,
          handoffSummary: recentMessages || undefined,
          handoffSource: "web_inbound",
          conversationId: conversationId ?? undefined,
        }),
      });
      const data = (await res.json()) as { ok?: boolean; inboundNumber?: string };
      const displayNumber = data.inboundNumber ?? lastResponse?.vapi?.phoneNumber ?? tenantPhone ?? null;
      setInboundReadyNumber(displayNumber);
      setShowInlineCallForm(false);
    } catch {
      setInboundReadyNumber(lastResponse?.vapi?.phoneNumber ?? tenantPhone ?? null);
      setShowInlineCallForm(false);
    } finally {
      setIsRegisteringInbound(false);
    }
  }

  async function submitCallNowRequest(): Promise<void> {
    if (!callbackPhone.trim() || !callbackConsent || isCallingNow) return;

    setIsCallingNow(true);
    setErrorText(null);
    setShowPhoneFallback(false);

    const recentMessages = messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-6)
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
      .join(" | ");

    const lastUserQuestion =
      [...messages].reverse().find((m) => m.role === "user")?.text ?? "";

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
      const message = error instanceof Error ? error.message : "Unknown call now error";
      setErrorText(message);
      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "system",
          text: locale === "fr-CA"
            ? "Je n'ai pas pu démarrer l'appel immédiat pour le moment."
            : "I couldn't start the immediate call right now.",
        },
      ]);
    } finally {
      setIsCallingNow(false);
    }
  }

  async function submitTransferCallNow(): Promise<void> {
    if (!callbackPhone.trim() || !callbackConsent || isTransferCalling || !pendingHandoffContext) return;

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
      const message = error instanceof Error ? error.message : "Unknown transfer call error";
      setErrorText(message);
      setMessages((current) => [
        ...current,
        {
          id: newId(),
          role: "system",
          text: pendingHandoffContext.locale === "fr-CA"
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

  // ── Keyframe CSS injected once ──────────────────────────────────────────────
  const globalCss = `
    @keyframes maa-msg-in {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes maa-pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
    @keyframes maa-lift {
      0%   { transform: translateY(0px) rotate(0deg); }
      30%  { transform: translateY(-5px) rotate(-4deg); }
      50%  { transform: translateY(-7px) rotate(0deg); }
      70%  { transform: translateY(-5px) rotate(4deg); }
      100% { transform: translateY(0px) rotate(0deg); }
    }
    @keyframes maa-fade-in {
      from { opacity: 0; transform: translateY(4px); }
      to   { opacity: 0.85; transform: translateY(0); }
    }
    @keyframes maa-dot-bounce {
      0%, 80%, 100% { transform: translateY(0); opacity: 0.5; }
      40%           { transform: translateY(-5px); opacity: 1; }
    }
    @keyframes maa-ai-orbit {
      0%   { transform: rotate(0deg) translateX(4px) rotate(0deg); opacity: 0.7; }
      100% { transform: rotate(360deg) translateX(4px) rotate(-360deg); opacity: 0.7; }
    }
    @keyframes maa-ai-pulse {
      0%, 100% { opacity: 0.35; transform: scale(1); }
      50%      { opacity: 0.85; transform: scale(1.3); }
    }
  `;

  const widget = (
    <section
      style={{
        "--accent": accentColor,
        "--accent-gradient": accentGradient,
        "--accent-rgb": accentRgb,
        "--accent-text": accentTextColor,
        position: "relative",
        background: darkMode ? "#0a0f0a" : "#f7f8f9",
        borderRadius: 20,
        overflow: "hidden",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
        border: "1px solid #d0d5dd",
        boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
      } as React.CSSProperties}
    >
      <style>{globalCss}</style>

      {/* DUBUB intro animation — shown once on first open */}
      {showIntro && (
        <DububIntroAnimation
          accentColor={accentColor}
          onDone={() => setShowIntro(false)}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(135deg, #111116 0%, #1a1a22 100%)",
          borderBottom: "1px solid #1e1e2a",
          padding: "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Left: badge + text */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              background: "#ffffff",
              boxShadow: "0 2px 12px rgba(201,168,76,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              overflow: "hidden",
              padding: 4,
            }}
          >
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={clientName}
                style={{ width: 34, height: 34, objectFit: "contain" }}
              />
            ) : (
              <div style={{ width: 34, height: 34, borderRadius: 8, background: "var(--accent-gradient)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent-text)", fontWeight: 900, fontSize: 16 }}>
                {clientName.charAt(0)}
              </div>
            )}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span style={{ color: "#f0f0f6", fontWeight: 700, fontSize: 14, letterSpacing: "0.02em" }}>
              {headerTitle ?? (locale === "fr-CA" ? `Concierge · ${clientName}` : `${clientName} Concierge`)}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: "50%",
                  background: "#4caf7a",
                  animation: "maa-pulse 2s infinite",
                  flexShrink: 0,
                }}
              />
              <span style={{ color: "#4caf7a", fontSize: 11 }}>
                {locale === "fr-CA" ? "En ligne" : "Online"}
              </span>
            </div>
          </div>
        </div>

        {/* Right: phone transfer button */}
        {canTransferCurrentChatByPhone ? (
          <button
            type="button"
            onClick={() => { setShowInlineCallForm(true); setShowPhoneFallback(false); }}
            style={{
              borderRadius: 20,
              padding: "7px 14px",
              background: "linear-gradient(135deg, #2a2a38, #3a3a4a)",
              border: "1px solid #3a3a4a",
              color: "white",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {locale === "fr-CA" ? "📞 Appel IA" : "📞 AI Call"}
          </button>
        ) : null}
      </div>

      {/* ── Subtitle bar ───────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "5px 16px 5px",
          background: darkMode ? "#0a0f0a" : "#f7f8f9",
          color: darkMode ? "rgba(255,255,255,0.3)" : "#8a90a0",
          fontSize: 10,
          letterSpacing: "0.08em",
          borderTop: darkMode ? "1px solid rgba(255,255,255,0.05)" : "1px solid #eaecf0",
        }}
      >
        {locale === "fr-CA"
          ? "Votre concierge IA est disponible 24h/24, 7j/7."
          : "Your AI concierge is available 24/7."}
      </div>

      {/* ── Messages area ──────────────────────────────────────────────────── */}
      <div
        data-msg-count={messages.length}
        style={{
          background: darkMode ? "#0a0f0a" : "#f7f8f9",
          padding: 16,
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {/* Spacer: pushes messages toward the bottom when chat is sparse */}
        <div style={{ flex: 1 }} />
        {messages.map((message) => {
          if (message.role === "user") {
            return (
              <div
                key={message.id}
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginBottom: 8,
                  animation: "maa-msg-in 0.25s ease",
                }}
              >
                <div
                  style={{
                    maxWidth: "75%",
                    padding: "10px 16px",
                    borderRadius: "20px 20px 4px 20px",
                    background: "var(--accent-gradient)",
                    color: "var(--accent-text)",
                    textShadow: accentTextColor === "#fff" ? "0 1px 3px rgba(0,0,0,0.25)" : "none",
                    fontSize: 14,
                    fontWeight: 500,
                    lineHeight: 1.4,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {message.text}
                </div>
              </div>
            );
          }

          if (message.role === "assistant") {
            const isNudge = message.kind === "nudge";
            // Detect price-flavored replies, then defer to the backend's
            // suppressBookingCta flag if it's set. The backend knows about
            // intent (cancellation, policy, laundry…) — the UI should not
            // re-derive that from token spotting.
            const hasPricingSignal =
              !message.suppressBookingCta &&
              (message.text.includes("$") ||
                message.text.toLowerCase().includes("abonnement") ||
                message.text.toLowerCase().includes("membership"));

            // Nudge = distinct info card, visually separate from AI conversation
            if (isNudge) {
              return (
                <div key={message.id} data-role="assistant" data-message-text={message.text} style={{ marginBottom: 10, animation: "maa-msg-in 0.3s ease" }}>
                  <div style={{
                    borderRadius: 14,
                    background: `linear-gradient(135deg, rgba(var(--accent-rgb),0.07) 0%, rgba(var(--accent-rgb),0.03) 100%)`,
                    border: `1px solid rgba(var(--accent-rgb),0.25)`,
                    boxShadow: `0 2px 8px rgba(var(--accent-rgb),0.10)`,
                    overflow: "hidden",
                  }}>
                    {/* Card header */}
                    <div style={{
                      display: "flex", alignItems: "center", gap: 6,
                      padding: "8px 14px 6px",
                      borderBottom: `1px solid rgba(var(--accent-rgb),0.15)`,
                      background: `rgba(var(--accent-rgb),0.06)`,
                    }}>
                      <span style={{ fontSize: 10 }}>✦</span>
                      <span style={{
                        fontSize: 9, fontWeight: 800, letterSpacing: "0.14em",
                        textTransform: "uppercase", color: "var(--accent)",
                      }}>
                        {locale === "fr-CA" ? nudgeLabelFr : nudgeLabelEn}
                      </span>
                      <span style={{ marginLeft: "auto", fontSize: 9, color: `rgba(var(--accent-rgb),0.7)`, fontStyle: "italic", fontWeight: 500 }}>
                        {locale === "fr-CA" ? nudgeSubLabelFr : nudgeSubLabelEn}
                      </span>
                    </div>
                    {/* Card body */}
                    <div style={{ padding: "10px 14px", color: darkMode ? "#c8d8c0" : "#3a3a4a", fontSize: 13, lineHeight: 1.55, fontStyle: "italic" }}>
                      <RichMessageText text={message.text} />
                    </div>
                    {hasPricingSignal && (
                      <div style={{ padding: "0 14px 10px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            const bookingText = locale === "fr-CA"
                              ? pricingCtaMessageFr
                              : pricingCtaMessageEn;
                            setInput(bookingText);
                            setTimeout(() => {
                              const sendBtn = document.querySelector<HTMLButtonElement>("[data-send-btn]");
                              sendBtn?.click();
                            }, 30);
                          }}
                          style={{
                            background: "none", border: "none", padding: 0,
                            cursor: "pointer", fontSize: 12, color: "var(--accent)",
                            fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 2,
                          }}
                        >
                          {locale === "fr-CA" ? pricingCtaFr : pricingCtaEn}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            }

            // Regular AI message
            return (
              <div key={message.id} data-role="assistant" data-message-text={message.text}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 8,
                    marginBottom: hasPricingSignal ? 2 : 8,
                    animation: "maa-msg-in 0.25s ease",
                  }}
                >
                  {/* Mini avatar */}
                  <div
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 8,
                      background: logoUrl ? "#ffffff" : "var(--accent-gradient)",
                      border: "1px solid rgba(var(--accent-rgb),0.2)",
                      boxShadow: "0 1px 4px rgba(var(--accent-rgb),0.15)",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      padding: logoUrl ? 3 : 0,
                    }}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt={clientName} style={{ width: 20, height: 20, objectFit: "contain" }} />
                    ) : (
                      <span style={{ color: "var(--accent-text)", fontWeight: 800, fontSize: 11 }}>{clientName.charAt(0)}</span>
                    )}
                  </div>
                  <div
                    style={{
                      maxWidth: "80%",
                      padding: "10px 14px",
                      borderRadius: "4px 20px 20px 20px",
                      background: darkMode ? "#141a14" : "#ffffff",
                      border: darkMode ? "1px solid rgba(255,255,255,0.07)" : "1px solid #e8eaed",
                      boxShadow: darkMode ? "none" : "0 1px 4px rgba(0,0,0,0.08)",
                      color: darkMode ? "#d8e8d0" : "#1a1a1a",
                      fontSize: 14,
                      lineHeight: 1.5,
                    }}
                  >
                    <RichMessageText text={message.text} />
                  </div>
                </div>
                {/* Smart post-pricing CTA */}
                {hasPricingSignal ? (
                  <div style={{ marginLeft: 34, marginBottom: 8 }}>
                    <button
                      type="button"
                      onClick={() => {
                        const bookingText = locale === "fr-CA" ? pricingCtaMessageFr : pricingCtaMessageEn;
                        setInput(bookingText);
                        setTimeout(() => {
                          const sendBtn = document.querySelector<HTMLButtonElement>("[data-send-btn]");
                          sendBtn?.click();
                        }, 30);
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        padding: "2px 0",
                        cursor: "pointer",
                        fontSize: 12,
                        color: "var(--accent)",
                        textDecoration: "none",
                      }}
                    >
                      {locale === "fr-CA"
                        ? `Prochaine étape ? ${pricingCtaFr}`
                        : `Next step? ${pricingCtaEn}`}
                    </button>
                  </div>
                ) : null}
              </div>
            );
          }

          // system
          return (
            <div
              key={message.id}
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  padding: "4px 12px",
                  borderRadius: 20,
                  background: "#f0f2f5",
                  border: "1px solid #e0e3e8",
                  color: "#7a8a96",
                  fontSize: 11,
                  fontStyle: "italic",
                }}
              >
                {message.text}
              </span>
            </div>
          );
        })}

        {showLoadingAnimation && (
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 8 }}>
            <div style={{
              width: 26, height: 26, borderRadius: 8,
              background: logoUrl ? "#ffffff" : "var(--accent-gradient)",
              border: "1px solid rgba(var(--accent-rgb),0.2)",
              boxShadow: "0 1px 4px rgba(var(--accent-rgb),0.15)",
              flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden", padding: logoUrl ? 3 : 0,
            }}>
              {logoUrl ? (
                <img src={logoUrl} alt={clientName} style={{ width: 20, height: 20, objectFit: "contain" }} />
              ) : (
                <span style={{ color: "var(--accent-text)", fontWeight: 800, fontSize: 11 }}>{clientName.charAt(0)}</span>
              )}
            </div>
            <GymLoadingIndicator locale={locale} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Suggested questions (shown only on first message) ─────────────── */}
      {messages.length === 1 && suggestedQuestions.length > 0 && (
        <div
          style={{
            margin: "0 16px 10px",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            animation: "maa-msg-in 0.4s ease",
          }}
        >
          <div style={{ fontSize: 10, color: "#8a90a0", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600, paddingLeft: 2, marginBottom: 2 }}>
            {locale === "fr-CA" ? "Questions fréquentes" : "Popular questions"}
          </div>
          {suggestedQuestions.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setInput(q);
                // Let React update input state, then submit
                setTimeout(() => {
                  const sendBtn = document.querySelector<HTMLButtonElement>("[data-send-btn]");
                  sendBtn?.click();
                }, 30);
              }}
              style={{
                background: "#f0f2f5",
                border: "1px solid #e0e3e8",
                borderRadius: 10,
                color: "#1a1a1a",
                fontSize: 12,
                padding: "7px 12px",
                textAlign: "left",
                cursor: "pointer",
                transition: "border-color 0.2s, background 0.2s",
                lineHeight: 1.4,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(201,168,76,0.5)";
                (e.currentTarget as HTMLButtonElement).style.background = "#e8ebe0";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "#e0e3e8";
                (e.currentTarget as HTMLButtonElement).style.background = "#f0f2f5";
              }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* ── Name capture card ──────────────────────────────────────────────── */}
      {showNameCapture && !userName ? (
        <div
          style={{
            margin: "0 16px 12px",
            padding: "14px 16px",
            borderRadius: 16,
            background: "#ffffff",
            border: "1px solid rgba(201,168,76,0.4)",
            boxShadow: "0 1px 6px rgba(201,168,76,0.1)",
            animation: "maa-msg-in 0.3s ease",
          }}
        >
          <div style={{ color: "var(--accent)", fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
            {locale === "fr-CA"
              ? "Au fait, quel est votre prénom ?"
              : "By the way, what's your name?"}
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              style={{ ...pillInput(), flex: 1 }}
              placeholder={locale === "fr-CA" ? "Votre prénom..." : "Your first name..."}
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nameInput.trim()) {
                  const name = nameInput.trim();
                  setUserName(name);
                  setShowNameCapture(false);
                  setNameInput("");
                  setMessages((m) => [
                    ...m,
                    {
                      id: newId(),
                      role: "assistant",
                      text:
                        locale === "fr-CA"
                          ? `Merci, ${name} ! N'hésitez pas à me poser vos questions.`
                          : `Nice to meet you, ${name}! Feel free to ask me anything.`,
                    },
                  ]);
                }
              }}
            />
            <button
              type="button"
              onClick={() => {
                const name = nameInput.trim();
                if (!name) return;
                setUserName(name);
                setShowNameCapture(false);
                setNameInput("");
                setMessages((m) => [
                  ...m,
                  {
                    id: newId(),
                    role: "assistant",
                    text:
                      locale === "fr-CA"
                        ? `Merci, ${name} ! N'hésitez pas à me poser vos questions.`
                        : `Nice to meet you, ${name}! Feel free to ask me anything.`,
                  },
                ]);
              }}
              style={{
                padding: "8px 16px",
                borderRadius: 20,
                background: "var(--accent-gradient)",
                border: "none",
                color: "#111116",
                fontWeight: 700,
                fontSize: 13,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {locale === "fr-CA" ? "Continuer" : "Continue"}
            </button>
            <button
              type="button"
              onClick={() => setShowNameCapture(false)}
              style={{
                background: "none",
                border: "none",
                color: "#5a5a70",
                fontSize: 12,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {locale === "fr-CA" ? "Passer" : "Skip"}
            </button>
          </div>
        </div>
      ) : null}

      {/* ── Action area ────────────────────────────────────────────────────── */}

      {/* Booking button */}
      {showBookingButton ? (
        <div style={{ margin: "0 16px 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>
          <a
            href={lastResponse!.booking.bookingUrl!}
            target="_blank"
            rel="noreferrer"
            style={{
              display: "inline-block",
              padding: "10px 18px",
              borderRadius: 20,
              background: "linear-gradient(135deg, #0f766e, #0d5c55)",
              color: "white",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
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
                color: "#7a7a90",
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

      {/* Phone button (before inline form) */}
      {showPhoneButton && !showInlineCallForm ? (
        <div style={{ margin: "0 16px 12px" }}>
          <button
            type="button"
            onClick={() => { setShowInlineCallForm(true); setShowPhoneFallback(false); }}
            style={{
              padding: 12,
              borderRadius: 12,
              background: "linear-gradient(135deg, #2a2a38, #3a3a4a)",
              border: "none",
              color: "white",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              width: "100%",
            }}
          >
            {lastResponse?.vapi?.buttonLabel ??
              (locale === "fr-CA" ? "📞 Continuer par téléphone" : "📞 Continue by phone")}
          </button>
        </div>
      ) : null}

      {/* Inline call form */}
      {(showPhoneButton || canTransferCurrentChatByPhone) && showInlineCallForm && !inboundReadyNumber ? (
        <div
          style={{
            margin: "0 16px 12px",
            padding: "18px 16px",
            borderRadius: 18,
            background: "linear-gradient(160deg, #111116 0%, #1a1a2a 100%)",
            border: `1px solid rgba(var(--accent-rgb),0.25)`,
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 18 }}>📞</span>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>
              {locale === "fr-CA" ? `Parler à ${conciergeName}` : `Speak with ${conciergeName}`}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginBottom: 14, lineHeight: 1.5 }}>
            {locale === "fr-CA"
              ? `Entrez votre numéro — ${conciergeName} connaîtra déjà votre demande dès le début de l'appel.`
              : `Enter your number — ${conciergeName} will be briefed on your request before you call.`}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={callbackName}
              onChange={(e) => setCallbackName(e.target.value)}
              placeholder={locale === "fr-CA" ? "Votre nom (optionnel)" : "Your name (optional)"}
              style={pillInput({ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" })}
            />
            <input
              value={callbackPhone}
              onChange={(e) => setCallbackPhone(e.target.value)}
              placeholder={locale === "fr-CA" ? "Votre numéro de téléphone *" : "Your phone number *"}
              type="tel"
              style={pillInput({ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff" })}
            />
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "rgba(255,255,255,0.4)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={callbackConsent}
                onChange={(e) => setCallbackConsent(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              <span>
                {locale === "fr-CA"
                  ? `J'accepte d'être contacté par ${clientName}.`
                  : `I agree to be contacted by ${clientName}.`}
              </span>
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                type="button"
                onClick={() => void registerInboundHandoff()}
                disabled={isRegisteringInbound || !callbackPhone.trim() || !callbackConsent}
                style={{
                  flex: 1,
                  padding: "11px 18px",
                  borderRadius: 20,
                  border: "none",
                  background: isRegisteringInbound || !callbackPhone.trim() || !callbackConsent
                    ? `rgba(var(--accent-rgb),0.3)`
                    : "var(--accent-gradient)",
                  color: "var(--accent-text)",
                  textShadow: accentTextColor === "#fff" ? "0 1px 3px rgba(0,0,0,0.35)" : "none",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: isRegisteringInbound || !callbackPhone.trim() || !callbackConsent ? "default" : "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s",
                }}
              >
                {isRegisteringInbound
                  ? (locale === "fr-CA" ? "Préparation..." : "Preparing...")
                  : (locale === "fr-CA" ? "Préparer mon appel →" : "Prepare my call →")}
              </button>
              <button
                type="button"
                onClick={() => { setShowInlineCallForm(false); setCallbackPhone(""); setCallbackName(""); setCallbackConsent(false); }}
                style={{ background: "none", border: "none", color: "rgba(255,255,255,0.35)", fontSize: 12, cursor: "pointer" }}
              >
                {locale === "fr-CA" ? "Annuler" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Inbound ready — show concierge number after context registration */}
      {inboundReadyNumber ? (
        <div
          style={{
            margin: "0 16px 12px",
            padding: "20px 18px",
            borderRadius: 18,
            background: "linear-gradient(160deg, #111116 0%, #1a1a2a 100%)",
            border: `1px solid rgba(var(--accent-rgb),0.35)`,
            boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.9)", fontWeight: 600, marginBottom: 4 }}>
            {locale === "fr-CA" ? `${conciergeName} est prête à vous recevoir` : `${conciergeName} is ready for your call`}
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 14, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {locale === "fr-CA" ? "Elle connaît déjà votre demande" : "She already knows your request"}
          </div>
          <a
            href={`tel:${inboundReadyNumber}`}
            style={{
              display: "block",
              background: "var(--accent-gradient)",
              color: "var(--accent-text)",
              textShadow: accentTextColor === "#fff" ? "0 1px 4px rgba(0,0,0,0.4)" : "none",
              fontWeight: 800,
              fontSize: 22,
              padding: "14px 24px",
              borderRadius: 14,
              textDecoration: "none",
              letterSpacing: "0.05em",
              marginBottom: 10,
            }}
          >
            {formatPhoneDisplay(inboundReadyNumber)}
          </a>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,0.3)" }}>
            {locale === "fr-CA"
              ? "Contexte valide 30 minutes · Appui sur le numéro pour composer"
              : "Context valid 30 minutes · Tap to dial"}
          </div>
          <button
            type="button"
            onClick={() => { setInboundReadyNumber(null); setCallbackPhone(""); setCallbackName(""); setCallbackConsent(false); }}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.6)", fontSize: 11, cursor: "pointer", marginTop: 10, textDecoration: "underline", textUnderlineOffset: 2, letterSpacing: "0.04em" }}
          >
            {locale === "fr-CA" ? "Fermer" : "Close"}
          </button>
        </div>
      ) : null}

      {/* Phone fallback — outbound AI calls have been removed from product.
          The only callback path is the lead form below. If a direct number is
          available we surface it as a simple tel: link. */}
      {showPhoneFallback && lastResponse?.vapi?.phoneNumber ? (
        <div
          style={{
            margin: "0 16px 12px",
            padding: 16,
            borderRadius: 16,
            background: "#ffffff",
            border: "1px solid #e0e3e8",
            boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ color: "#1a1a1a", fontSize: 13 }}>
            {locale === "fr-CA"
              ? "Pour parler à un membre de l'équipe directement :"
              : "To speak with a team member directly:"}
            {" "}
            <a href={`tel:${lastResponse.vapi.phoneNumber}`} style={{ color: "var(--accent)", fontWeight: 700 }}>
              {lastResponse.vapi.phoneNumber}
            </a>
          </div>
        </div>
      ) : null}

      {/* Callback form */}
      {showCallbackForm ? (
        <div
          style={{
            margin: "0 16px 12px",
            padding: 16,
            borderRadius: 16,
            background: "#ffffff",
            border: "1px solid #e0e3e8",
            boxShadow: "0 1px 6px rgba(0,0,0,0.06)",
          }}
        >
          <div style={{ color: "#1a1a1a", fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
            {locale === "fr-CA" ? "Demander un rappel" : "Request a callback"}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={callbackName}
              onChange={(e) => setCallbackName(e.target.value)}
              placeholder={locale === "fr-CA" ? "Nom (optionnel)" : "Name (optional)"}
              style={pillInput()}
            />
            <input
              value={callbackPhone}
              onChange={(e) => setCallbackPhone(e.target.value)}
              placeholder={locale === "fr-CA" ? "Téléphone *" : "Phone *"}
              type="tel"
              style={pillInput()}
            />
            <input
              value={callbackEmail}
              onChange={(e) => setCallbackEmail(e.target.value)}
              placeholder={locale === "fr-CA" ? "Courriel (optionnel)" : "Email (optional)"}
              style={pillInput()}
            />
            <input
              value={callbackPreferredTime}
              onChange={(e) => setCallbackPreferredTime(e.target.value)}
              placeholder={
                locale === "fr-CA"
                  ? "Moment préféré pour le rappel (optionnel)"
                  : "Preferred callback time (optional)"
              }
              style={pillInput()}
            />
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#8a8aa0", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={callbackConsent}
                onChange={(e) => setCallbackConsent(e.target.checked)}
              />
              <span>
                {locale === "fr-CA"
                  ? `J'accepte d'être contacté par l'équipe ${clientName}.`
                  : `I agree to be contacted by the ${clientName} team.`}
              </span>
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => void submitCallbackRequest()}
                disabled={isSubmittingCallback || !callbackPhone.trim() || !callbackConsent}
                style={{
                  padding: "10px 18px",
                  borderRadius: 20,
                  border: "none",
                  background: "var(--accent-gradient)",
                  color: "var(--accent-text)",
                  textShadow: accentTextColor === "#fff" ? "0 1px 3px rgba(0,0,0,0.35)" : "none",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: isSubmittingCallback || !callbackPhone.trim() || !callbackConsent ? "default" : "pointer",
                  opacity: isSubmittingCallback || !callbackPhone.trim() || !callbackConsent ? 0.6 : 1,
                  whiteSpace: "nowrap",
                }}
              >
                {isSubmittingCallback
                  ? (locale === "fr-CA" ? "Envoi..." : "Submitting...")
                  : (locale === "fr-CA" ? "Envoyer la demande" : "Send request")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Persistent lead capture form */}
      {showLeadForm && !lastResponse?.callbackPersistence?.saved ? (
        <div style={{ margin: "0 16px 12px", padding: 16, borderRadius: 16, background: "#ffffff", border: "1px solid rgba(201,168,76,0.35)", boxShadow: "0 1px 8px rgba(201,168,76,0.08)", animation: "maa-msg-in 0.25s ease" }}>
          <div style={{ color: "var(--accent)", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            {locale === "fr-CA" ? "Laissez-nous vos coordonnées" : "Leave us your contact info"}
          </div>
          <div style={{ color: "#6a6a80", fontSize: 11, marginBottom: 12 }}>
            {locale === "fr-CA" ? `Un membre de l'équipe ${clientName} vous contactera sous peu.` : `A ${clientName} team member will reach out shortly.`}
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            <input value={callbackName} onChange={(e) => setCallbackName(e.target.value)} placeholder={locale === "fr-CA" ? "Votre nom (optionnel)" : "Your name (optional)"} style={pillInput()} />
            <input value={callbackPhone} onChange={(e) => setCallbackPhone(e.target.value)} placeholder={locale === "fr-CA" ? "Téléphone *" : "Phone *"} type="tel" style={pillInput()} />
            <input value={callbackEmail} onChange={(e) => setCallbackEmail(e.target.value)} placeholder={locale === "fr-CA" ? "Courriel (optionnel)" : "Email (optional)"} style={pillInput()} />
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: "#8a8aa0", cursor: "pointer" }}>
              <input type="checkbox" checked={callbackConsent} onChange={(e) => setCallbackConsent(e.target.checked)} />
              <span>{locale === "fr-CA" ? `J'accepte d'être contacté par ${clientName}.` : `I agree to be contacted by ${clientName}.`}</span>
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => void submitCallbackRequest()}
                disabled={isSubmittingCallback || !callbackPhone.trim() || !callbackConsent}
                style={{ padding: "10px 18px", borderRadius: 20, border: "none", background: "var(--accent-gradient)", color: "var(--accent-text)", textShadow: accentTextColor === "#fff" ? "0 1px 3px rgba(0,0,0,0.35)" : "none", fontWeight: 700, fontSize: 13, cursor: isSubmittingCallback || !callbackPhone.trim() || !callbackConsent ? "default" : "pointer", opacity: isSubmittingCallback || !callbackPhone.trim() || !callbackConsent ? 0.6 : 1 }}
              >
                {isSubmittingCallback ? (locale === "fr-CA" ? "Envoi..." : "Sending...") : (locale === "fr-CA" ? "Envoyer" : "Send")}
              </button>
              <button type="button" onClick={() => setShowLeadForm(false)} style={{ background: "none", border: "none", color: "#5a5a70", fontSize: 12, cursor: "pointer" }}>
                {locale === "fr-CA" ? "Fermer" : "Close"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Error display */}
      {errorText ? (
        <div
          style={{
            margin: "0 16px 8px",
            padding: "8px 12px",
            borderRadius: 10,
            background: "#1f0f0f",
            border: "1px solid rgba(232,122,107,0.2)",
            color: "#e87a6b",
            fontSize: 13,
          }}
        >
          {errorText}
        </div>
      ) : null}

      {/* ── Input area ─────────────────────────────────────────────────────── */}
      <div
        style={{
          padding: "12px 16px",
          background: darkMode ? "#0d120d" : "#ffffff",
          borderTop: darkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid #e0e3e8",
          display: "flex",
          gap: 8,
          alignItems: "center",
        }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void sendMessage();
            }
          }}
          onFocus={(e) => {
            // Android: scroll input into view after keyboard opens (~300ms delay)
            setTimeout(() => e.target.scrollIntoView({ behavior: "smooth", block: "nearest" }), 320);
          }}
          placeholder={locale === "fr-CA" ? "Votre message..." : "Your message..."}
          inputMode="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="sentences"
          style={{
            flex: 1,
            padding: "12px 18px",
            borderRadius: 24,
            border: darkMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e0e3e8",
            background: darkMode ? "#1a221a" : "#ffffff",
            color: darkMode ? "#e0eeda" : "#1a1a1a",
            fontSize: 16, // 16px prevents iOS auto-zoom, better Android too
            outline: "none",
            minWidth: 0,
            WebkitAppearance: "none",
          }}
        />
        <button
          type="button"
          data-send-btn
          onClick={() => void sendMessage()}
          disabled={isSending}
          style={{
            width: 46,
            height: 46,
            borderRadius: "50%",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            cursor: isSending ? "default" : "pointer",
            background: isSending
              ? "#e0e3e8"
              : "var(--accent-gradient)",
            color: isSending ? "#aab0bc" : "var(--accent-text)",
            textShadow: isSending ? "none" : (accentTextColor === "#fff" ? "0 1px 3px rgba(0,0,0,0.3)" : "none"),
            fontSize: 18,
            transition: "background 0.2s",
          }}
        >
          →
        </button>
      </div>

      {/* ── Footer: lead capture link + DUBUB ─────────────────────────────── */}
      <div style={{ padding: "6px 16px 8px", background: darkMode ? "#0a0f0a" : "#f7f8f9", borderTop: darkMode ? "1px solid rgba(255,255,255,0.05)" : "1px solid #e8eaed", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <button
          type="button"
          onClick={() => { setShowLeadForm((v) => !v); setShowInlineCallForm(false); setShowPhoneFallback(false); }}
          style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: darkMode ? "rgba(255,255,255,0.55)" : "var(--accent)", fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", textDecoration: "underline", textUnderlineOffset: 2 }}
        >
          {locale === "fr-CA" ? "Laisser mes coordonnées" : "Leave my contact info"}
        </button>
        <a
          href="https://dubub.ca"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#aab0bc", fontSize: 10, letterSpacing: "0.06em", textDecoration: "none", display: "flex", alignItems: "center", gap: 5 }}
        >
          {/* Subtle AI orbit animation */}
          <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 12, height: 12 }}>
            <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--accent)", display: "block", animation: "maa-ai-pulse 2.2s ease-in-out infinite" }} />
            <span style={{ position: "absolute", width: 3, height: 3, borderRadius: "50%", background: "rgba(201,168,76,0.6)", animation: "maa-ai-orbit 3s linear infinite" }} />
            <span style={{ position: "absolute", width: 2, height: 2, borderRadius: "50%", background: "rgba(201,168,76,0.4)", animation: "maa-ai-orbit 3s linear infinite", animationDelay: "-1.5s" }} />
          </span>
          Concierge IA par{" "}
          <strong style={{ color: "#7a82a0", fontWeight: 700 }}>DUBUB</strong>
          <span style={{ color: "var(--accent)", fontWeight: 700 }}>.ca</span>
        </a>
      </div>
    </section>
  );

  if (mode === "floating") {
    return (
      <div>
        {/* Launcher button */}
        <button
          type="button"
          aria-label={isOpen ? "Fermer le concierge" : "Ouvrir le concierge"}
          onClick={() => setIsOpen((v) => !v)}
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "var(--accent-gradient)",
            border: "2px solid rgba(201,168,76,0.3)",
            boxShadow: "0 4px 24px rgba(201,168,76,0.35)",
            zIndex: 9999,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            lineHeight: 1,
          }}
        >
          {isOpen ? (
            <span style={{ color: "#111116", fontSize: 20, fontWeight: 700, lineHeight: 1 }}>✕</span>
          ) : (
            <span style={{ color: "#111116", fontWeight: 900, fontSize: 22, lineHeight: 1 }}>M</span>
          )}
        </button>

        {/* Floating panel */}
        {isOpen ? (
          <div
            style={{
              position: "fixed",
              bottom: 96,
              right: 24,
              width: "min(420px, calc(100vw - 48px))",
              maxHeight: "calc(100vh - 128px)",
              zIndex: 9998,
              borderRadius: 20,
              overflow: "auto",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.15)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {widget}
          </div>
        ) : null}
      </div>
    );
  }

  return widget;
}
