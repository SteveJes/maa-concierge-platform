/// <reference path="./vapi-web.d.ts" />
"use client";

import Vapi from "@vapi-ai/web";
import React, { useEffect, useMemo, useRef, useState } from "react";

// Rotating proactive nudge messages — fired every 35s during inactivity.
// The widget picks a fresh one each surfacing using a Fisher-Yates shuffle
// so visitors never see the same Conseil Privilège twice in a row.
const PROACTIVE_NUDGES_FR = [
  "Saviez-vous que nos membres bénéficient d'un accès complet à la piscine, au spa et à plus de 50 cours de groupe par semaine ? Je peux vous aider à trouver la formule idéale.",
  "Le Club Sportif MAA est l'un des clubs les plus prestigieux de Montréal, fondé en 1881 — l'un des plus vieux clubs sportifs en Amérique du Nord. Souhaitez-vous en apprendre davantage sur son héritage ?",
  "Notre piscine intérieure de 25 mètres et notre Espace O sur le toit comptent parmi les plus beaux du centre-ville. Curieux de connaître l'horaire de la nage libre ?",
  "Vous pensez à l'abonnement ? Je peux vous donner un aperçu des formules annuelles, étudiantes et aînées, et vous orienter selon votre rythme.",
  "Besoin d'un coup de pouce ? Je suis disponible pour les tarifs, les horaires, les cours ou pour planifier une visite des installations.",
  "Le restaurant Le 1881, situé à l'intérieur du Club, propose une cuisine raffinée de style bistro. Souhaitez-vous consulter le menu ou réserver une table ?",
  "Notre clinique sportive offre massothérapie, physiothérapie, ostéopathie et nutrition — tous sur place au cœur du Mille carré doré. Une question particulière sur ces services ?",
  "Vous aimez le pickleball ? Nos courts dédiés sont accessibles aux membres avec un horaire publié chaque semaine. Souhaitez-vous voir comment réserver ?",
  "Nos cours spécialisés — cirque aérien, PowerWatts, Pilates Reformer — sont guidés par des instructeurs reconnus. Lequel pique votre curiosité ?",
  "Pour une introduction tout en douceur au Club, je peux organiser une visite guidée des installations avec un membre de l'équipe.",
  "Plus de 50 cours de groupe par semaine — yoga, spinning, HIIT, aquaforme, Pilates. Voulez-vous voir l'horaire d'aujourd'hui ?",
  "Pour les membres, le Club offre aussi une buanderie, des casiers privés et un service de spa complet — bain tourbillon, sauna, hammam. Curieux d'en savoir plus ?",
];
const PROACTIVE_NUDGES_EN = [
  "Did you know our members enjoy full access to the pool, spa, and over 50 group classes per week? I can help you find the perfect plan.",
  "Club Sportif MAA has been a Montreal landmark since 1881 — one of the oldest sports clubs in North America. Would you like to hear about its heritage?",
  "Our 25-metre indoor pool and rooftop Espace O are among the finest downtown. Curious about the open-swim schedule?",
  "Thinking about membership? I can walk you through annual, student, and senior plans and help you find what fits your rhythm.",
  "Need a hand? I'm here to help with pricing, hours, group classes, or to schedule a tour of the club.",
  "Le 1881 restaurant, right inside the Club, serves refined bistro cuisine. Would you like the menu or to book a table?",
  "Our sports clinic offers massage, physio, osteopathy and nutrition — all on site in the heart of the Golden Square Mile. Any specific service you're curious about?",
  "Love pickleball? Our dedicated courts are open to members with a weekly published schedule. Want to see how to reserve a slot?",
  "Our specialty programs — aerial circus, PowerWatts, Pilates Reformer — are led by top instructors. Which one interests you?",
  "For a gentle introduction to the Club, I can arrange a guided tour of the facilities with a team member.",
  "More than 50 group classes a week — yoga, spinning, HIIT, aqua-fit, Pilates. Want today's schedule?",
  "Members also enjoy laundry service, private lockers and a full spa — whirlpool, sauna, steam room. Curious to hear more?",
];

/** Fisher-Yates shuffle copy. Used to rotate proactive nudges so visitors
 *  don't see the same Conseil Privilège twice in a session. */
function shuffleNudges<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

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

/**
 * Luxurious one-shot tooltip that announces the call-Sophie feature.
 * Fades in elegantly after the chat opens, holds for ~7 s (long enough to
 * be read without rushing the eye), then fades out. Never shown twice in
 * the same session. Pairs with a tiny pointer caret aimed at the phone
 * chip + a delicate sheen sweep so the visitor's eye lands on the icon.
 */
function SophieCallTooltip({ locale, canCall }: { locale: string; canCall: boolean }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!canCall) return;
    if (typeof window === "undefined") return;
    const seenKey = "dubub_call_tooltip_seen";
    try {
      if (window.sessionStorage.getItem(seenKey) === "1") return;
    } catch { /* sessionStorage blocked — show anyway */ }

    // Slower reveal cadence: 1.1s wait → 7.2s hold → 0.9s fade-out tail.
    // Reads "deliberate" rather than "notification". Daphné 2026-05-19
    // brief: more visibility for a winning feature, still never naggy.
    const fadeInTimer = setTimeout(() => setVisible(true), 1100);
    const fadeOutTimer = setTimeout(() => {
      setVisible(false);
      try { window.sessionStorage.setItem(seenKey, "1"); } catch { /* ok */ }
    }, 8300);

    return () => {
      clearTimeout(fadeInTimer);
      clearTimeout(fadeOutTimer);
    };
  }, [canCall]);

  if (!canCall) return null;
  const isFr = !locale.startsWith("en");
  const msg = isFr
    ? "Préférez la voix ? Sophie peut vous appeler."
    : "Prefer voice? Sophie can call you.";

  return (
    <div
      aria-hidden={!visible}
      style={{
        position: "absolute",
        // Anchor the tooltip above and slightly to the RIGHT of the avatar
        // so its little caret points down at the phone chip (bottom-right
        // corner of the avatar). Keeps the visual flow intentional.
        top: -46,
        left: 32,
        background: "linear-gradient(135deg, rgba(44,36,22,0.98), rgba(28,22,14,0.98))",
        border: "1px solid rgba(212,175,95,0.62)",
        borderRadius: 14,
        padding: "8px 13px",
        fontSize: 11.5,
        color: "#f8efdd",
        whiteSpace: "nowrap",
        fontWeight: 500,
        fontStyle: "italic",
        fontFamily: "Georgia, 'Times New Roman', serif",
        letterSpacing: "0.01em",
        boxShadow:
          "0 10px 28px rgba(0,0,0,0.55), 0 0 0 1px rgba(212,175,95,0.28), 0 0 18px rgba(212,175,95,0.22)",
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(6px)",
        transition: "opacity 0.7s ease, transform 0.7s ease",
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      <span style={{ marginRight: 6 }}>📞</span>
      {msg}
      {/* Tiny gold caret pointing down toward the phone chip. */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: -6,
          left: 14,
          width: 10,
          height: 10,
          background: "linear-gradient(135deg, rgba(44,36,22,0.98), rgba(28,22,14,0.98))",
          borderRight: "1px solid rgba(212,175,95,0.62)",
          borderBottom: "1px solid rgba(212,175,95,0.62)",
          transform: "rotate(45deg)",
        }}
      />
    </div>
  );
}

function GymLoadingIndicator({ locale, floating = false }: { locale: string; floating?: boolean }) {
  return (
    <div
      style={{
        padding: "12px 16px",
        borderRadius: floating ? "4px 20px 20px 20px" : 14,
        background: floating
          ? "linear-gradient(135deg, rgba(30,26,20,0.95), rgba(22,20,16,0.95))"
          : "#ffffff",
        border: floating ? "1px solid rgba(212,175,95,0.22)" : "1px solid #e8eaed",
        boxShadow: floating
          ? "0 2px 10px rgba(0,0,0,0.35)"
          : "0 1px 4px rgba(0,0,0,0.06)",
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
              background: floating
                ? "linear-gradient(135deg, #d4af5f, #8b6e3e)"
                : "var(--accent-gradient)",
              animation: `maa-dot-bounce 1.2s ease-in-out ${i * 0.18}s infinite`,
              boxShadow: floating ? "0 0 6px rgba(212,175,95,0.45)" : "none",
            }}
          />
        ))}
      </div>
      <span style={{
        fontSize: 12,
        color: floating ? "#cfc8b3" : "#9a9ab0",
        fontStyle: "italic",
        letterSpacing: "0.01em",
      }}>
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

/**
 * Premium CTA icon picker — matches a quick-action question to a relevant
 * inline SVG, gold-tinted. Keeps the chat panel's CTA buttons looking like
 * Daphné's mockup. Falls back to a generic chevron-bell when no match.
 */
function iconForCta(text: string): React.ReactNode {
  const t = text.toLowerCase();
  const stroke = "currentColor";
  const props = { width: 20, height: 20, viewBox: "0 0 24 24", fill: "none", stroke, strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

  // Private training / personal trainer / entraînement → dumbbell
  if (/entra[îi]nement|personal|trainer|private session|fitness/.test(t)) {
    return (
      <svg {...props}>
        <path d="M6 8v8M9 6v12M15 6v12M18 8v8M3 11h2M19 11h2M3 13h2M19 13h2"/>
      </svg>
    );
  }
  // Pickleball / racket → paddle
  if (/pickleball|pickle|squash|tennis|racquet|racket/.test(t)) {
    return (
      <svg {...props}>
        <circle cx="10" cy="10" r="6"/>
        <path d="M14.2 14.2L21 21M10 6l-2 4M10 10l-3 1M11 13l-1-3"/>
      </svg>
    );
  }
  // Schedule visit / tour → calendar
  if (/visit|tour|visite|club tour|d[ée]couverte/.test(t)) {
    return (
      <svg {...props}>
        <rect x="3" y="5" width="18" height="16" rx="2"/>
        <path d="M3 9h18M8 3v4M16 3v4"/>
        <circle cx="8" cy="14" r="0.8" fill={stroke}/>
        <circle cx="12" cy="14" r="0.8" fill={stroke}/>
        <circle cx="16" cy="14" r="0.8" fill={stroke}/>
      </svg>
    );
  }
  // Compare memberships / pricing → credit card
  if (/compar|abonnement|membership|tarif|pricing|prix/.test(t)) {
    return (
      <svg {...props}>
        <rect x="2.5" y="5" width="19" height="14" rx="2"/>
        <path d="M2.5 10h19M6 15h4"/>
      </svg>
    );
  }
  // Spa / wellness / detente → lotus
  if (/spa|d[ée]tente|relax|massage|bien[- ]?[êe]tre/.test(t)) {
    return (
      <svg {...props}>
        <path d="M12 3c2 3 2 6 0 9-2-3-2-6 0-9z"/>
        <path d="M12 12c-3-1-5-3-6-6 3 0 5 2 6 5"/>
        <path d="M12 12c3-1 5-3 6-6-3 0-5 2-6 5"/>
        <path d="M6 14c0 3 3 6 6 7 3-1 6-4 6-7"/>
      </svg>
    );
  }
  // Call / phone
  if (/call|appel|t[ée]l[ée]phone|phone/.test(t)) {
    return (
      <svg {...props}>
        <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>
      </svg>
    );
  }
  // Default — concierge bell
  return (
    <svg {...props}>
      <path d="M12 3a3 3 0 0 1 3 3v.6a6 6 0 0 1 4 5.6V15l1.4 2H3.6L5 15v-2.8a6 6 0 0 1 4-5.6V6a3 3 0 0 1 3-3z"/>
      <path d="M10 19a2 2 0 0 0 4 0"/>
    </svg>
  );
}

// Render assistant message text with:
// - bullet points (lines starting with •, -, *, or numbered) → gym icon + styled line
// - phone numbers → clickable tel: links
function RichMessageText({ text, onPreviewLink }: { text: string; onPreviewLink?: (url: string) => void }) {
  const lines = text.split("\n");

  const elements: React.ReactNode[] = [];
  let bulletIndex = 0;
  let pendingParagraph: string[] = [];

  function flushParagraph() {
    if (pendingParagraph.length === 0) return;
    const raw = pendingParagraph.join(" ").trim();
    if (raw) elements.push(<span key={elements.length}>{renderInline(raw, onPreviewLink)}<br /></span>);
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
          <span style={{ lineHeight: 1.55, color: "inherit" }}>{renderInline(content, onPreviewLink)}</span>
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

function renderInline(text: string, onPreviewLink?: (url: string) => void): React.ReactNode[] {
  // Scan once and match (in priority order) markdown links, bare URLs, then
  // phone numbers. Anything not matched is plain text. Daphné's fourth pass:
  // restaurant menu URLs need to be clickable, ideally with a friendly label
  // ("Menu", "Petit-déjeuner", "Carte des vins") rather than the raw URL.
  const parts: React.ReactNode[] = [];

  // Markdown link: [label](url) — label can include spaces/accents/punct.
  const MD_LINK_RE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g;
  // Bare URL fallback for messages the AI emitted without markdown formatting.
  const URL_RE = /https?:\/\/[^\s<>"]+/g;
  // Reuse the existing phone regex but stripped of flags so we can rebuild it.
  const PHONE_GLOBAL = new RegExp(PHONE_RE.source, "gi");

  interface Span { start: number; end: number; node: React.ReactNode }
  const spans: Span[] = [];

  // 1. Markdown links (highest priority — they consume the URL inside).
  for (let m: RegExpExecArray | null; (m = MD_LINK_RE.exec(text)); ) {
    const [whole, label, url] = m as unknown as [string, string, string];
    spans.push({
      start: m.index,
      end: m.index + whole.length,
      node: onPreviewLink ? (
        <button
          key={`md-${m.index}`}
          type="button"
          onClick={() => onPreviewLink(url)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            margin: 0,
            font: "inherit",
            color: "var(--accent)",
            fontWeight: 600,
            textDecoration: "underline",
            textUnderlineOffset: 2,
            cursor: "pointer",
            display: "inline",
          }}
        >
          {label}
        </button>
      ) : (
        <a
          key={`md-${m.index}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline" }}
        >
          {label}
        </a>
      ),
    });
  }
  const consumedByMd = (idx: number, end: number): boolean =>
    spans.some((s) => idx >= s.start && end <= s.end);

  // 2. Bare URLs that are NOT inside a markdown link span.
  for (let m: RegExpExecArray | null; (m = URL_RE.exec(text)); ) {
    const start = m.index;
    const end = start + m[0].length;
    if (consumedByMd(start, end)) continue;
    // Trim trailing punctuation that's almost never part of a URL ( . , ! ? ) ).
    let url = m[0];
    let trailing = "";
    while (url.length > 0 && /[.,!?)]/.test(url[url.length - 1]!)) {
      trailing = url.slice(-1) + trailing;
      url = url.slice(0, -1);
    }
    spans.push({
      start,
      end: start + url.length,
      node: onPreviewLink ? (
        <button
          key={`url-${start}`}
          type="button"
          onClick={() => onPreviewLink(url)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            margin: 0,
            font: "inherit",
            color: "var(--accent)",
            fontWeight: 600,
            textDecoration: "underline",
            textUnderlineOffset: 2,
            cursor: "pointer",
            display: "inline",
            wordBreak: "break-all",
          }}
        >
          {url}
        </button>
      ) : (
        <a
          key={`url-${start}`}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "underline", wordBreak: "break-all" }}
        >
          {url}
        </a>
      ),
    });
    if (trailing) {
      // The trailing punctuation will be picked up by the plain-text emitter.
    }
  }

  // 3. Phone numbers — last priority, only outside other spans.
  for (let m: RegExpExecArray | null; (m = PHONE_GLOBAL.exec(text)); ) {
    const start = m.index;
    const end = start + m[0].length;
    if (spans.some((s) => start < s.end && end > s.start)) continue;
    const raw = m[0];
    const tel = raw.replace(/[^\d+]/g, "");
    spans.push({
      start,
      end,
      node: (
        <a
          key={`tel-${start}`}
          href={`tel:${tel}`}
          style={{ color: "#1a6e3c", fontWeight: 600, textDecoration: "none", borderBottom: "1px solid rgba(26,110,60,0.3)" }}
        >
          {raw}
        </a>
      ),
    });
  }

  // 4. Stitch together: walk the text in order, emitting plain-text slices
  //    between consumed spans and the matched nodes.
  spans.sort((a, b) => a.start - b.start);
  let cursor = 0;
  for (const span of spans) {
    if (span.start < cursor) continue; // skip overlapping (lower-priority) entries
    if (span.start > cursor) parts.push(text.slice(cursor, span.start));
    parts.push(span.node);
    cursor = span.end;
  }
  if (cursor < text.length) parts.push(text.slice(cursor));

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
  routing?: {
    intent: string;
    contactId: string;
    contactName: string;
    departmentLabel: string;
  };
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

/** Dark variant for floating-mode forms — matches the luxury panel theme. */
const darkPillInput = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: "10px 14px",
  borderRadius: 20,
  border: "1px solid rgba(212,175,95,0.3)",
  background: "rgba(20,18,14,0.7)",
  color: "#f0e8d2",
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
  onConciergeLink,
  onOpenChange,
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
  /**
   * When the host page provides this callback (split-screen demo layout), the
   * widget hands off every link click to the host instead of opening its
   * internal LEFT preview panel. The host can then navigate its own iframe so
   * the visitor stays in context and continues browsing while chatting.
   */
  onConciergeLink?: (url: string) => void;
  /**
   * Optional open/close notification — the host page uses this to resize the
   * surrounding layout (e.g. shrink an iframe to make room for the panel).
   */
  onOpenChange?: (isOpen: boolean) => void;
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
  // Notify the host when the panel opens/closes so it can resize its layout
  // (split-screen demo shrinks its iframe to make room for the chat).
  useEffect(() => {
    onOpenChange?.(isOpen);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);
  // Hand off link clicks to the host page when running in split-screen mode.
  // Falls back to the internal LEFT preview panel when onConciergeLink is
  // not provided (e.g. embedded on a third-party site).
  const linkClickHandler = useMemo(
    () => (url: string) => (onConciergeLink ? onConciergeLink(url) : setPreviewUrl(url)),
    [onConciergeLink],
  );
  const [isCallingNow, setIsCallingNow] = useState(false);
  // In floating mode, links in concierge replies open an in-context preview
  // panel that slides in to the LEFT of the chat slider, keeping the user on
  // the same page (no external tab).
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  // When a cross-origin destination refuses embedding (MyWellness widget,
  // FLiiP, Libro, etc.), the iframe just shows a blank/error page and onLoad
  // may never fire. We can't programmatically detect the X-Frame-Options
  // block from the parent frame, but we can use a timeout: if the iframe
  // hasn't reported `load` after 4.5s, surface a polite banner suggesting
  // "Open in new tab".
  const [previewStalled, setPreviewStalled] = useState(false);
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

  // Show the spinner while a previewed page is loading; close preview when
  // the chat itself closes (the LEFT preview panel only makes sense alongside
  // the chat slider).
  useEffect(() => {
    if (!previewUrl) {
      setPreviewStalled(false);
      return;
    }
    setPreviewLoading(true);
    setPreviewStalled(false);
    track("concierge_preview_opened", { url: previewUrl });
    const stall = setTimeout(() => setPreviewStalled(true), 4500);
    return () => clearTimeout(stall);
  }, [previewUrl]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!isOpen && previewUrl) setPreviewUrl(null);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

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
  // Lock a per-session shuffled order so visitors never see the same nudge
  // twice in a session and never see the same one first across reloads.
  const nudgeOrderRef = useRef<{ fr: number[]; en: number[] } | null>(null);
  if (nudgeOrderRef.current === null) {
    const indices = (arr: unknown[]) => Array.from({ length: arr.length }, (_, i) => i);
    nudgeOrderRef.current = {
      fr: shuffleNudges(indices(nudgesFr)),
      en: shuffleNudges(indices(nudgesEn)),
    };
  }

  useEffect(() => {
    if (!isSending) {
      setShowLoadingAnimation(false);
      return;
    }
    const timer = setTimeout(() => setShowLoadingAnimation(true), 700);
    return () => clearTimeout(timer);
  }, [isSending]);

  // Rotating proactive nudges during inactivity — first at 25s, then every 35s.
  // Surface up to 6 nudges per session, walking through a per-session shuffled
  // order so visitors never see the same Conseil Privilège twice.
  useEffect(() => {
    if (messages.length > 1 || nudgeIndex >= 6) return;
    const delay = nudgeIndex === 0 ? 25000 : 35000;
    const timer = setTimeout(() => {
      const nudges = locale === "fr-CA" ? nudgesFr : nudgesEn;
      const order = nudgeOrderRef.current
        ? (locale === "fr-CA" ? nudgeOrderRef.current.fr : nudgeOrderRef.current.en)
        : null;
      const idx = order && order.length > 0
        ? order[nudgeIndex % order.length]!
        : nudgeIndex % nudges.length;
      const text = nudges[idx]!;
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
            // Per-staff routing — the chat API surfaced the best contact on
            // the previous reply (Francis for abonnements, Nathalie for cours,
            // restaurant for menu/réservation, clinique for spa/massage…).
            // We forward it so the lead email goes straight to that team.
            routingContactId: lastResponse?.routing?.contactId,
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
        background: mode === "floating" ? "transparent" : (darkMode ? "#0a0f0a" : "#f7f8f9"),
        borderRadius: mode === "floating" ? 0 : 20,
        overflow: "hidden",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
        border: mode === "floating" ? "none" : "1px solid #d0d5dd",
        boxShadow: mode === "floating" ? "none" : "0 8px 32px rgba(0,0,0,0.12)",
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        // In floating mode the section must fill its parent panel container
        // (which spans top:0 to bottom:0) so the flex spacer can push the
        // input + footer to the very bottom of the screen.
        height: mode === "floating" ? "100%" : undefined,
        flex: mode === "floating" ? "1 1 auto" : undefined,
        minHeight: mode === "floating" ? 0 : undefined,
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

      {/* ── PREMIUM HEADER (floating mode) — Sophie portrait + brand line ──── */}
      {mode === "floating" ? (
        <div
          style={{
            background:
              "linear-gradient(180deg, #0f0f14 0%, #14141a 60%, #181820 100%)",
            borderBottom: "1px solid rgba(201,168,76,0.18)",
            // Extra top padding so the fixed-positioned close ✕ (at viewport
            // top:24, height:44 → bottom edge 68) clears the brand line AND
            // the italic "Sophie vous accueille" portrait header line. Daphné
            // mobile screenshot 2026-05-19 caught the overlap.
            padding: "40px 22px 20px",
            position: "relative",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          {/* Brand line at the very top — clearance for the fixed close ✕ at
              viewport top:24/right:24 (width:44 → 68px from right edge). */}
          <div
            style={{
              fontSize: 10,
              letterSpacing: "0.22em",
              color: "#d4af5f",
              fontWeight: 700,
              marginBottom: 16,
              paddingRight: 76,
            }}
          >
            {locale === "en-CA" ? "AI CONCIERGE BY DUBUB" : "CONCIERGE IA PAR DUBUB"}
          </div>

          {/* Portrait + identity row — phone button now sits attached to the
              avatar (bottom-right of the gold ring) where Steve asked. */}
          <div style={{ display: "flex", alignItems: "center", gap: 14, position: "relative" }}>

            {/* ── Avatar + integrated phone call button ──────────────────
                Phone is anchored as a small premium chip at the bottom-right
                of Sophie's portrait. On open, a luxurious tooltip "bubble"
                fades in for ~3.5s announcing the call-me feature, then fades
                out so it never feels nagging. Daphné 2026-05-19 brief. */}
            <div style={{ position: "relative", flexShrink: 0 }}>
              <SophieCallTooltip locale={locale} canCall={canTransferCurrentChatByPhone} />
            {/* Premium Sophie avatar — gold ring + soft inner glow + monogram */}
            <div
              style={{
                width: 64,
                height: 64,
                flexShrink: 0,
                borderRadius: "50%",
                background:
                  "radial-gradient(circle at 30% 30%, #c0a87a 0%, #8b6e3e 55%, #4a3a1f 100%)",
                border: "2px solid #d4af5f",
                boxShadow:
                  "0 0 0 1px rgba(212,175,95,0.4), 0 0 18px rgba(212,175,95,0.32), inset 0 2px 4px rgba(255,255,255,0.18)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#1c1410",
                fontWeight: 700,
                fontSize: 26,
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontStyle: "italic",
                letterSpacing: "-0.02em",
              }}
              aria-hidden="true"
            >
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none">
                <path d="M12 12.5c2.6 0 4.6-2.1 4.6-4.7S14.6 3 12 3 7.4 5.2 7.4 7.8 9.4 12.5 12 12.5z" fill="#1c1410"/>
                <path d="M4 21c0-3.9 3.6-7 8-7s8 3.1 8 7" stroke="#1c1410" strokeWidth="1.6" strokeLinecap="round" fill="#1c1410"/>
              </svg>
            </div>

            {/* Phone chip attached to the avatar's bottom-right corner.
                Slightly larger (34 px) + soft pulsing gold halo so it
                reads as a premium, deliberate feature instead of a
                decoration. The halo breathes 0.3 → 0.9 opacity over
                ~2.4s, infinite. Daphné 2026-05-19 brief: more focus
                without screaming. */}
            {canTransferCurrentChatByPhone ? (
              <div style={{ position: "absolute", bottom: -4, right: -4, width: 34, height: 34 }}>
                {/* Outer pulsing halo — purely decorative, drawn behind the chip. */}
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    inset: -6,
                    borderRadius: "50%",
                    background: "radial-gradient(circle, rgba(212,175,95,0.55) 0%, rgba(212,175,95,0) 70%)",
                    animation: "maa-call-pulse 2.4s ease-in-out infinite",
                    pointerEvents: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => { setShowInlineCallForm(true); setShowPhoneFallback(false); }}
                  title={locale === "en-CA" ? "Have Sophie call you — full conversation context" : "Faites-vous rappeler par Sophie — avec tout le contexte"}
                  aria-label={locale === "en-CA" ? "Call Sophie" : "Appeler Sophie"}
                  style={{
                    position: "relative",
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    background: "radial-gradient(circle at 30% 30%, #f0d188 0%, #c89d3f 55%, #6b4f1a 100%)",
                    border: "2px solid #14141a",
                    boxShadow:
                      "0 0 0 1px rgba(255,225,160,0.7), 0 4px 14px rgba(212,175,95,0.55), inset 0 1px 2px rgba(255,255,255,0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#1c1410",
                    cursor: "pointer",
                    padding: 0,
                    transition: "transform 0.18s ease, box-shadow 0.18s ease, filter 0.18s ease",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "scale(1.12)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow =
                      "0 0 0 1px rgba(255,235,180,0.95), 0 6px 18px rgba(212,175,95,0.7), inset 0 1px 2px rgba(255,255,255,0.55)";
                    (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1.08)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.transform = "scale(1)";
                    (e.currentTarget as HTMLButtonElement).style.boxShadow =
                      "0 0 0 1px rgba(255,225,160,0.7), 0 4px 14px rgba(212,175,95,0.55), inset 0 1px 2px rgba(255,255,255,0.4)";
                    (e.currentTarget as HTMLButtonElement).style.filter = "brightness(1)";
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>
                  </svg>
                </button>
              </div>
            ) : null}
            </div>

            {/* Name + title + status */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 20,
                  fontStyle: "italic",
                  fontWeight: 600,
                  color: "#f8efdd",
                  lineHeight: 1.15,
                  marginBottom: 4,
                  fontFamily: "Georgia, 'Times New Roman', serif",
                }}
              >
                {locale === "en-CA" ? "Sophie welcomes you" : "Sophie vous accueille"}
              </div>
              <div
                style={{
                  fontSize: 9.5,
                  letterSpacing: "0.18em",
                  color: "#d4af5f",
                  fontWeight: 700,
                  marginBottom: 6,
                }}
              >
                {locale === "en-CA" ? "AI CONCIERGE" : "CONCIERGE IA"}
                <span style={{ color: "#a0a090" }}> · </span>
                {clientName.toUpperCase()}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: "#a0a090",
                  display: "flex",
                  alignItems: "center",
                  gap: 7,
                  fontWeight: 500,
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#3dd17a",
                    boxShadow: "0 0 8px rgba(61,209,122,0.7)",
                    animation: "maa-pulse-green 2.2s ease-in-out infinite",
                  }}
                />
                {locale === "en-CA" ? "Available now" : "Disponible maintenant"}
              </div>
            </div>
          </div>

          {/* Hairline divider */}
          <div
            style={{
              marginTop: 18,
              height: 1,
              background:
                "linear-gradient(90deg, transparent 0%, rgba(212,175,95,0.4) 50%, transparent 100%)",
            }}
          />
        </div>
      ) : null}

      {/* ── Header (inline mode original) ──────────────────────────────────── */}
      {mode !== "floating" ? (
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
      ) : null}

      {/* ── Subtitle bar (hidden in floating mode — premium header carries the brand) */}
      {mode !== "floating" ? (
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
      ) : null}

      {/* ── Messages area ──────────────────────────────────────────────────── */}
      <div
        data-msg-count={messages.length}
        style={{
          background: mode === "floating"
            ? "linear-gradient(180deg, #0e0e14 0%, #14141a 100%)"
            : (darkMode ? "#0a0f0a" : "#f7f8f9"),
          padding: mode === "floating"
            ? (messages.length === 1 ? "0" : "8px 22px 16px")
            : 16,
          // In floating-mode INITIAL state (no user input yet), don't flex-grow
          // an empty messages container — let the welcome + CTAs flow naturally
          // and fill the panel via their own margins. Once the conversation
          // starts, the messages area takes full available height.
          flex: mode === "floating" && messages.length === 1 ? "0 0 auto" : 1,
          minHeight: 0,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}
      >
        {/* Spacer: pushes messages toward the bottom when chat is sparse */}
        <div style={{ flex: 1 }} />
        {messages.map((message, idx) => {
          // In floating mode, hide the initial AI greeting — the premium
          // header + welcome paragraph above the CTAs replace it.
          if (mode === "floating" && idx === 0 && message.role === "assistant" && messages.length === 1) {
            return null;
          }
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
            //
            // Daphné seventh-pass #7: when the widget is locale=fr-CA but the
            // bot's reply is in English (because the user wrote in English),
            // the CTA "Prochaine étape ? → Planifier une visite" was leaking
            // a French CTA into an English reply. Detect per-message language
            // and suppress the CTA on a locale mismatch — premium concierge
            // never mixes languages in the final turn.
            const messageLooksEnglish =
              !/[àâçéèêëîïôûùüÿœ]/i.test(message.text) &&
              !/\b(le|la|les|une?|des|nos|notre|votre|équipe|abonnement|piscine|cours|c'est|est-ce|n'est)\b/i.test(message.text) &&
              /\b(the|and|with|for|membership|monthly|annual|please|team|club)\b/i.test(message.text);
            const localeIsFrench = locale === "fr-CA";
            const ctaLocaleMismatch = localeIsFrench && messageLooksEnglish;

            const hasPricingSignal =
              !message.suppressBookingCta &&
              !ctaLocaleMismatch &&
              (message.text.includes("$") ||
                message.text.toLowerCase().includes("abonnement") ||
                message.text.toLowerCase().includes("membership"));

            // Nudge = distinct info card, visually separate from AI conversation
            if (isNudge) {
              const isFloating = mode === "floating";
              return (
                <div
                  key={message.id}
                  data-role="assistant"
                  data-message-text={message.text}
                  style={{
                    marginBottom: 12,
                    animation: isFloating
                      ? "maa-nudge-reveal 0.7s cubic-bezier(0.16, 1, 0.3, 1) both"
                      : "maa-msg-in 0.3s ease",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      borderRadius: isFloating ? 22 : 14,
                      background: isFloating
                        ? "linear-gradient(135deg, rgba(82,68,42,0.96) 0%, rgba(60,50,32,0.96) 100%)"
                        : `linear-gradient(135deg, rgba(var(--accent-rgb),0.07) 0%, rgba(var(--accent-rgb),0.03) 100%)`,
                      border: isFloating
                        ? "1px solid rgba(225,190,110,0.65)"
                        : `1px solid rgba(var(--accent-rgb),0.25)`,
                      boxShadow: isFloating
                        ? "0 8px 24px rgba(0,0,0,0.45), 0 0 28px rgba(225,190,110,0.22), inset 0 1px 0 rgba(255,255,255,0.06)"
                        : `0 2px 8px rgba(var(--accent-rgb),0.10)`,
                      overflow: "hidden",
                    }}
                  >
                    {/* Subtle gold sheen sweep — slides left → right on reveal */}
                    {isFloating && (
                      <span
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          inset: 0,
                          background:
                            "linear-gradient(115deg, transparent 30%, rgba(212,175,95,0.18) 50%, transparent 70%)",
                          animation: "maa-nudge-sheen 1.4s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both",
                          pointerEvents: "none",
                        }}
                      />
                    )}
                    {/* Card header */}
                    <div
                      style={{
                        position: "relative",
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: isFloating ? "10px 16px 8px" : "8px 14px 6px",
                        borderBottom: isFloating
                          ? "1px solid rgba(212,175,95,0.22)"
                          : `1px solid rgba(var(--accent-rgb),0.15)`,
                        background: isFloating
                          ? "linear-gradient(180deg, rgba(212,175,95,0.10) 0%, rgba(212,175,95,0.02) 100%)"
                          : `rgba(var(--accent-rgb),0.06)`,
                      }}
                    >
                      <span style={{ fontSize: 10, color: isFloating ? "#e6c977" : undefined }}>✦</span>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 800,
                          letterSpacing: "0.16em",
                          textTransform: "uppercase",
                          color: isFloating ? "#e6c977" : "var(--accent)",
                          textShadow: isFloating ? "0 0 8px rgba(212,175,95,0.4)" : undefined,
                        }}
                      >
                        {locale === "fr-CA" ? nudgeLabelFr : nudgeLabelEn}
                      </span>
                      <span
                        style={{
                          marginLeft: "auto",
                          fontSize: 9,
                          color: isFloating ? "rgba(232,225,200,0.55)" : `rgba(var(--accent-rgb),0.7)`,
                          fontStyle: "italic",
                          fontWeight: 500,
                        }}
                      >
                        {locale === "fr-CA" ? nudgeSubLabelFr : nudgeSubLabelEn}
                      </span>
                    </div>
                    {/* Card body */}
                    <div
                      style={{
                        position: "relative",
                        padding: isFloating ? "12px 16px 14px" : "10px 14px",
                        color: isFloating ? "#fff6dc" : darkMode ? "#c8d8c0" : "#3a3a4a",
                        fontSize: 13.5,
                        lineHeight: 1.6,
                        fontStyle: "italic",
                        fontWeight: isFloating ? 500 : 400,
                        textShadow: isFloating ? "0 1px 1px rgba(0,0,0,0.35)" : undefined,
                      }}
                    >
                      <RichMessageText text={message.text} onPreviewLink={isFloating ? linkClickHandler : undefined} />
                    </div>
                    {hasPricingSignal && (
                      <div style={{ position: "relative", padding: "0 16px 12px" }}>
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
                            background: "none",
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            fontSize: 12,
                            color: isFloating ? "#e6c977" : "var(--accent)",
                            fontWeight: 600,
                            textDecoration: "underline",
                            textUnderlineOffset: 2,
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
                  {/* Mini avatar — in floating mode, dark gold-ring circle to match Sophie */}
                  <div
                    style={{
                      width: mode === "floating" ? 28 : 26,
                      height: mode === "floating" ? 28 : 26,
                      marginLeft: mode === "floating" ? 10 : 0,
                      borderRadius: mode === "floating" ? "50%" : 8,
                      background: mode === "floating"
                        ? "radial-gradient(circle at 30% 30%, #c0a87a 0%, #8b6e3e 60%, #4a3a1f 100%)"
                        : (logoUrl ? "#ffffff" : "var(--accent-gradient)"),
                      border: mode === "floating"
                        ? "1px solid rgba(212,175,95,0.65)"
                        : "1px solid rgba(var(--accent-rgb),0.2)",
                      boxShadow: mode === "floating"
                        ? "0 0 12px rgba(212,175,95,0.3), inset 0 1px 2px rgba(255,255,255,0.18)"
                        : "0 1px 4px rgba(var(--accent-rgb),0.15)",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      padding: mode === "floating" ? 0 : (logoUrl ? 3 : 0),
                    }}
                  >
                    {mode === "floating" ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 12.5c2.6 0 4.6-2.1 4.6-4.7S14.6 3 12 3 7.4 5.2 7.4 7.8 9.4 12.5 12 12.5z" fill="#1c1410"/>
                        <path d="M4 21c0-3.9 3.6-7 8-7s8 3.1 8 7" stroke="#1c1410" strokeWidth="1.6" strokeLinecap="round" fill="#1c1410"/>
                      </svg>
                    ) : logoUrl ? (
                      <img src={logoUrl} alt={clientName} style={{ width: 20, height: 20, objectFit: "contain" }} />
                    ) : (
                      <span style={{ color: "var(--accent-text)", fontWeight: 800, fontSize: 11 }}>{clientName.charAt(0)}</span>
                    )}
                  </div>
                  <div
                    style={{
                      maxWidth: "80%",
                      padding: mode === "floating" ? "12px 16px" : "10px 14px",
                      borderRadius: "4px 20px 20px 20px",
                      background: mode === "floating"
                        ? "linear-gradient(135deg, rgba(30,26,20,0.95), rgba(22,20,16,0.95))"
                        : (darkMode ? "#141a14" : "#ffffff"),
                      border: mode === "floating"
                        ? "1px solid rgba(212,175,95,0.22)"
                        : (darkMode ? "1px solid rgba(255,255,255,0.07)" : "1px solid #e8eaed"),
                      boxShadow: mode === "floating"
                        ? "0 2px 10px rgba(0,0,0,0.35)"
                        : (darkMode ? "none" : "0 1px 4px rgba(0,0,0,0.08)"),
                      color: mode === "floating"
                        ? "#f0e8d2"
                        : (darkMode ? "#d8e8d0" : "#1a1a1a"),
                      fontSize: 14,
                      lineHeight: 1.55,
                    }}
                  >
                    <RichMessageText
                      text={message.text}
                      onPreviewLink={mode === "floating" ? linkClickHandler : undefined}
                    />
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
              width: mode === "floating" ? 28 : 26,
              height: mode === "floating" ? 28 : 26,
              marginLeft: mode === "floating" ? 10 : 0,
              borderRadius: mode === "floating" ? "50%" : 8,
              background: mode === "floating"
                ? "radial-gradient(circle at 30% 30%, #c0a87a 0%, #8b6e3e 60%, #4a3a1f 100%)"
                : (logoUrl ? "#ffffff" : "var(--accent-gradient)"),
              border: mode === "floating"
                ? "1px solid rgba(212,175,95,0.65)"
                : "1px solid rgba(var(--accent-rgb),0.2)",
              boxShadow: mode === "floating"
                ? "0 0 12px rgba(212,175,95,0.3), inset 0 1px 2px rgba(255,255,255,0.18)"
                : "0 1px 4px rgba(var(--accent-rgb),0.15)",
              flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
              overflow: "hidden",
              padding: mode === "floating" ? 0 : (logoUrl ? 3 : 0),
            }}>
              {mode === "floating" ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M12 12.5c2.6 0 4.6-2.1 4.6-4.7S14.6 3 12 3 7.4 5.2 7.4 7.8 9.4 12.5 12 12.5z" fill="#1c1410"/>
                  <path d="M4 21c0-3.9 3.6-7 8-7s8 3.1 8 7" stroke="#1c1410" strokeWidth="1.6" strokeLinecap="round" fill="#1c1410"/>
                </svg>
              ) : logoUrl ? (
                <img src={logoUrl} alt={clientName} style={{ width: 20, height: 20, objectFit: "contain" }} />
              ) : (
                <span style={{ color: "var(--accent-text)", fontWeight: 800, fontSize: 11 }}>{clientName.charAt(0)}</span>
              )}
            </div>
            <GymLoadingIndicator locale={locale} floating={mode === "floating"} />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Welcome paragraph (floating mode only, before CTAs) ────────────── */}
      {mode === "floating" && messages.length === 1 && (
        <div
          style={{
            margin: "18px 22px 4px",
            color: "#e8e3d0",
            fontSize: 14,
            lineHeight: 1.55,
            fontFamily: "Inter, system-ui, sans-serif",
            animation: "maa-msg-in 0.45s ease 0.2s both",
          }}
        >
          <div style={{ color: "#d4af5f", fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
            {locale === "en-CA" ? "Hello and welcome" : "Bonjour et bienvenue"}
          </div>
          <div style={{ color: "#cfc8b3", fontSize: 13.5, lineHeight: 1.55 }}>
            {locale === "en-CA"
              ? `I'm Sophie, your AI concierge. I'm here to support you at ${clientName}.`
              : `Je suis Sophie, votre concierge IA. Je suis là pour vous accompagner au ${clientName}.`}
          </div>
        </div>
      )}

      {/* ── Suggested questions (shown only on first message) ─────────────── */}
      {messages.length === 1 && suggestedQuestions.length > 0 && (
        <div
          style={{
            margin: mode === "floating" ? "18px 22px 14px" : "4px 16px 14px",
            display: "flex",
            flexDirection: "column",
            gap: mode === "floating" ? 12 : 10,
            animation: "maa-msg-in 0.4s ease",
          }}
        >
          <div
            style={{
              fontSize: mode === "floating" ? 13 : 11,
              color: mode === "floating" ? "#d4af5f" : "#c9a84c",
              letterSpacing: mode === "floating" ? "0.02em" : "0.08em",
              fontWeight: 600,
              paddingLeft: 2,
              marginBottom: mode === "floating" ? 8 : 4,
            }}
          >
            {locale === "fr-CA" ? "Comment puis-je vous aider aujourd'hui ?" : "How can I help you today?"}
          </div>
          {suggestedQuestions.map((q, idx) => (
            <button
              key={q}
              type="button"
              onClick={() => {
                setInput(q);
                setTimeout(() => {
                  const sendBtn = document.querySelector<HTMLButtonElement>("[data-send-btn]");
                  sendBtn?.click();
                }, 30);
              }}
              style={{
                background: "linear-gradient(135deg, rgba(35,30,22,0.95), rgba(28,24,18,0.95))",
                border: "1px solid rgba(201,168,76,0.35)",
                borderRadius: 12,
                color: "#f4eedd",
                fontSize: 13,
                fontWeight: 500,
                padding: mode === "floating" ? "14px 16px" : "13px 16px",
                textAlign: "left",
                cursor: "pointer",
                transition: "border-color 0.2s, background 0.2s, transform 0.15s, box-shadow 0.2s",
                lineHeight: 1.35,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
                animation: `maa-cta-in 0.55s cubic-bezier(0.22, 1, 0.36, 1) ${0.55 + idx * 0.08}s both`,
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(212,175,95,0.95)";
                (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(135deg, rgba(48,40,28,0.98), rgba(38,32,22,0.98))";
                (e.currentTarget as HTMLButtonElement).style.transform = "translateX(-3px)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 16px rgba(0,0,0,0.4), 0 0 12px rgba(212,175,95,0.18)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(201,168,76,0.35)";
                (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(135deg, rgba(35,30,22,0.95), rgba(28,24,18,0.95))";
                (e.currentTarget as HTMLButtonElement).style.transform = "translateX(0)";
                (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 2px 8px rgba(0,0,0,0.25)";
              }}
            >
              {mode === "floating" ? (
                <span style={{ flexShrink: 0, color: "#d4af5f", display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26 }} aria-hidden="true">
                  {iconForCta(q)}
                </span>
              ) : null}
              <span style={{ flex: 1 }}>{q}</span>
              <span aria-hidden="true" style={{ color: "#d4af5f", fontSize: 20, fontWeight: 300, lineHeight: 1, opacity: 0.75 }}>
                ›
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Flex spacer — in floating-initial state, pushes input + footer to the
          bottom of the panel so the welcome + CTAs feel anchored to the top
          without sticking to the input. The panel reads as 'a full experience'
          rather than a cramped chat. */}
      {mode === "floating" && messages.length === 1 ? (
        <div style={{ flex: "1 1 auto", minHeight: 0 }} aria-hidden="true" />
      ) : null}

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

      {/* Booking button — routes through the host onConciergeLink hook OR the
          internal LEFT preview panel so visitors stay on the page (no new tab).
          Falls back to a real anchor only when no handler is available. */}
      {showBookingButton ? (
        <div style={{ margin: "0 16px 12px", display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            type="button"
            onClick={() => linkClickHandler(lastResponse!.booking.bookingUrl!)}
            style={{
              display: "inline-block",
              padding: "10px 18px",
              borderRadius: 20,
              background: "linear-gradient(135deg, #0f766e, #0d5c55)",
              color: "white",
              textDecoration: "none",
              fontWeight: 600,
              fontSize: 14,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {locale === "fr-CA" ? "Planifier une visite" : "Book a tour"}
          </button>
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

      {/* Phone button (before inline form) — premium styling in floating mode */}
      {showPhoneButton && !showInlineCallForm ? (
        <div style={{ margin: mode === "floating" ? "0 22px 14px" : "0 16px 12px" }}>
          <button
            type="button"
            onClick={() => { setShowInlineCallForm(true); setShowPhoneFallback(false); }}
            style={mode === "floating" ? {
              padding: "14px 18px",
              borderRadius: 12,
              background: "linear-gradient(135deg, rgba(50,42,28,0.95), rgba(38,32,22,0.95))",
              border: "1px solid rgba(212,175,95,0.45)",
              color: "#f8efdd",
              fontWeight: 600,
              fontSize: 14,
              cursor: "pointer",
              width: "100%",
              boxShadow: "0 4px 16px rgba(0,0,0,0.35), 0 0 16px rgba(212,175,95,0.18)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              transition: "background 0.2s, border-color 0.2s, transform 0.15s",
            } : {
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
            onMouseEnter={mode === "floating" ? (e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(135deg, rgba(64,54,36,0.98), rgba(48,40,28,0.98))";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(212,175,95,0.85)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-1px)";
            } : undefined}
            onMouseLeave={mode === "floating" ? (e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "linear-gradient(135deg, rgba(50,42,28,0.95), rgba(38,32,22,0.95))";
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(212,175,95,0.45)";
              (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)";
            } : undefined}
          >
            {mode === "floating" ? (
              <span aria-hidden="true" style={{ color: "#d4af5f", display: "flex", alignItems: "center", justifyContent: "center", width: 22, height: 22 }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>
                </svg>
              </span>
            ) : null}
            <span>{mode === "floating"
              ? (locale === "fr-CA"
                  ? "Souhaitez-vous que l'IA vous appelle ?"
                  : "Would you like the AI to call you?")
              : (lastResponse?.vapi?.buttonLabel ??
                  (locale === "fr-CA" ? "📞 Continuer par téléphone" : "📞 Continue by phone"))}</span>
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
        <div
          style={{
            margin: mode === "floating" ? "0 22px 14px" : "0 16px 12px",
            padding: mode === "floating" ? 18 : 16,
            borderRadius: mode === "floating" ? 14 : 16,
            background: mode === "floating"
              ? "linear-gradient(135deg, rgba(30,26,20,0.96), rgba(22,20,16,0.96))"
              : "#ffffff",
            border: mode === "floating"
              ? "1px solid rgba(212,175,95,0.4)"
              : "1px solid rgba(201,168,76,0.35)",
            boxShadow: mode === "floating"
              ? "0 4px 18px rgba(0,0,0,0.45), 0 0 24px rgba(212,175,95,0.12)"
              : "0 1px 8px rgba(201,168,76,0.08)",
            animation: "maa-msg-in 0.25s ease",
          }}
        >
          <div style={{ color: mode === "floating" ? "#d4af5f" : "var(--accent)", fontWeight: 700, fontSize: 14, marginBottom: 4 }}>
            {locale === "fr-CA" ? "Laissez-nous vos coordonnées" : "Leave us your contact info"}
          </div>
          <div style={{ color: mode === "floating" ? "#a8a090" : "#6a6a80", fontSize: 11.5, marginBottom: 12, lineHeight: 1.5 }}>
            {locale === "fr-CA" ? `Un membre de l'équipe ${clientName} vous contactera sous peu.` : `A ${clientName} team member will reach out shortly.`}
          </div>
          {lastResponse?.routing ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                marginBottom: 14,
                borderRadius: 12,
                background: mode === "floating"
                  ? "linear-gradient(135deg, rgba(212,175,95,0.14) 0%, rgba(160,120,48,0.06) 100%)"
                  : "linear-gradient(135deg, rgba(201,168,76,0.10) 0%, rgba(201,168,76,0.04) 100%)",
                border: mode === "floating"
                  ? "1px solid rgba(212,175,95,0.45)"
                  : "1px solid rgba(201,168,76,0.30)",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  background: "rgba(212,175,95,0.18)",
                  color: mode === "floating" ? "#e6c977" : "#8b6010",
                  flexShrink: 0,
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2 11 13" />
                  <path d="m22 2-7 20-4-9-9-4 20-7z" />
                </svg>
              </span>
              <div style={{ flex: 1, minWidth: 0, lineHeight: 1.35 }}>
                <div style={{ fontSize: 10.5, letterSpacing: "0.10em", textTransform: "uppercase", fontWeight: 700, color: mode === "floating" ? "#d4af5f" : "#8b6010" }}>
                  {locale === "fr-CA" ? "Transmis à" : "Routed to"}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: mode === "floating" ? "#f0e8d2" : "#1a1a1a" }}>
                  {lastResponse.routing.contactName}
                </div>
                <div style={{ fontSize: 11, color: mode === "floating" ? "rgba(232,225,200,0.65)" : "#6a6a80" }}>
                  {lastResponse.routing.departmentLabel}
                </div>
              </div>
            </div>
          ) : null}
          <div style={{ display: "grid", gap: 8 }}>
            <input
              value={callbackName}
              onChange={(e) => setCallbackName(e.target.value)}
              placeholder={locale === "fr-CA" ? "Votre nom (optionnel)" : "Your name (optional)"}
              style={mode === "floating" ? darkPillInput() : pillInput()}
            />
            <input
              value={callbackPhone}
              onChange={(e) => setCallbackPhone(e.target.value)}
              placeholder={locale === "fr-CA" ? "Téléphone *" : "Phone *"}
              type="tel"
              style={mode === "floating" ? darkPillInput() : pillInput()}
            />
            <input
              value={callbackEmail}
              onChange={(e) => setCallbackEmail(e.target.value)}
              placeholder={locale === "fr-CA" ? "Courriel (optionnel)" : "Email (optional)"}
              style={mode === "floating" ? darkPillInput() : pillInput()}
            />
            <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 12, color: mode === "floating" ? "#a0998a" : "#8a8aa0", cursor: "pointer" }}>
              <input type="checkbox" checked={callbackConsent} onChange={(e) => setCallbackConsent(e.target.checked)} style={{ accentColor: "#d4af5f" }} />
              <span>{locale === "fr-CA" ? `J'accepte d'être contacté par ${clientName}.` : `I agree to be contacted by ${clientName}.`}</span>
            </label>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => void submitCallbackRequest()}
                disabled={isSubmittingCallback || !callbackPhone.trim() || !callbackConsent}
                style={{
                  padding: "10px 20px",
                  borderRadius: 20,
                  border: mode === "floating" ? "1px solid rgba(212,175,95,0.6)" : "none",
                  background: mode === "floating"
                    ? "linear-gradient(135deg, #d4af5f 0%, #8b6e3e 100%)"
                    : "var(--accent-gradient)",
                  color: mode === "floating" ? "#1c1410" : "var(--accent-text)",
                  textShadow: accentTextColor === "#fff" ? "0 1px 3px rgba(0,0,0,0.35)" : "none",
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: isSubmittingCallback || !callbackPhone.trim() || !callbackConsent ? "default" : "pointer",
                  opacity: isSubmittingCallback || !callbackPhone.trim() || !callbackConsent ? 0.5 : 1,
                  boxShadow: mode === "floating" ? "0 4px 14px rgba(212,175,95,0.35)" : "none",
                }}
              >
                {isSubmittingCallback ? (locale === "fr-CA" ? "Envoi..." : "Sending...") : (locale === "fr-CA" ? "Envoyer" : "Send")}
              </button>
              <button
                type="button"
                onClick={() => setShowLeadForm(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: mode === "floating" ? "#8a8270" : "#5a5a70",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
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
          padding: mode === "floating" ? "14px 22px" : "12px 16px",
          background: mode === "floating"
            ? "linear-gradient(180deg, #14141a 0%, #0e0e14 100%)"
            : (darkMode ? "#0d120d" : "#ffffff"),
          borderTop: mode === "floating"
            ? "1px solid rgba(201,168,76,0.18)"
            : (darkMode ? "1px solid rgba(255,255,255,0.06)" : "1px solid #e0e3e8"),
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
            padding: mode === "floating" ? "13px 20px" : "12px 18px",
            borderRadius: 24,
            border: mode === "floating"
              ? "1px solid rgba(201,168,76,0.32)"
              : (darkMode ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e0e3e8"),
            background: mode === "floating"
              ? "rgba(30,28,22,0.85)"
              : (darkMode ? "#1a221a" : "#ffffff"),
            color: mode === "floating"
              ? "#f4eedd"
              : (darkMode ? "#e0eeda" : "#1a1a1a"),
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

      {/* ── PREMIUM FOOTER (floating mode) — DUBUB shield + service note ──── */}
      {mode === "floating" ? (
        <div
          style={{
            padding: "14px 22px 16px",
            background: "linear-gradient(180deg, #14141a 0%, #0e0e14 100%)",
            borderTop: "1px solid rgba(201,168,76,0.18)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <a
            href="https://dubub.ca"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
              textDecoration: "none",
              borderRadius: 8,
              transition: "background 0.2s",
              padding: "4px 6px",
              margin: "-4px -6px",
            }}
            title={locale === "en-CA" ? "Discover DUBUB — premium AI concierges for your business" : "Découvrez DUBUB — concierges IA premium pour votre entreprise"}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(212,175,95,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "transparent";
            }}
          >
            <span
              aria-hidden="true"
              style={{
                width: 26,
                height: 26,
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#d4af5f",
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6l8-3z" fill="currentColor" fillOpacity="0.15"/>
                <path d="M12 2.5l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10v-6l8-3z"/>
                <path d="M8.5 12l2.5 2.5L16 9.5"/>
              </svg>
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "#e0d8c0", fontWeight: 600, lineHeight: 1.3 }}>
                {locale === "en-CA" ? "Powered by DUBUB AI" : "Service propulsé par l'IA DUBUB"}
              </div>
              <div style={{ fontSize: 10, color: "#90867a", letterSpacing: "0.02em", lineHeight: 1.3 }}>
                {locale === "en-CA" ? "Confidential and secure" : "Confidentiel et sécurisé"}
              </div>
            </div>
          </a>
          <button
            type="button"
            onClick={() => { setShowLeadForm((v) => !v); setShowInlineCallForm(false); setShowPhoneFallback(false); }}
            style={{
              flexShrink: 0,
              background: "none",
              border: "1px solid rgba(212,175,95,0.4)",
              padding: "6px 12px",
              borderRadius: 999,
              cursor: "pointer",
              color: "#d4af5f",
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.04em",
              transition: "border-color 0.2s, background 0.2s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(212,175,95,0.85)";
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(212,175,95,0.08)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(212,175,95,0.4)";
              (e.currentTarget as HTMLButtonElement).style.background = "none";
            }}
          >
            {locale === "en-CA" ? "Get a callback" : "Être recontacté"}
          </button>
        </div>
      ) : (
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
      )}
    </section>
  );

  if (mode === "floating") {
    const isFr = locale !== "en-CA";
    const greetingTitle = isFr ? "Sophie vous accueille" : "Sophie welcomes you";
    const conciergeBrand = isFr ? "CONCIERGE IA PAR DUBUB" : "AI CONCIERGE BY DUBUB";
    const availableNow = isFr ? "Disponible maintenant" : "Available now";

    return (
      <div>
        {/* Right-edge anchor bar — full-height vertical strip that the launcher
            tab visually morphs OUT OF. Same gradient + border as the launcher
            so the tab reads as a rounded extension of the bar, not a floating
            pill. Always present (closed AND open). */}
        {!isOpen && (
          <div
            aria-hidden="true"
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: 14,
              background:
                "linear-gradient(180deg, #1c1c22 0%, #14141a 50%, #1a1a1f 100%)",
              borderLeft: "1px solid rgba(201,168,76,0.55)",
              boxShadow:
                "inset 1px 0 0 rgba(201,168,76,0.25), -6px 0 22px rgba(0,0,0,0.4)",
              zIndex: 9998,
              pointerEvents: "none",
            }}
          />
        )}

        {/* Premium folder-tab launcher — narrow vertical strip pulling out of
            the right-edge bar. Bell icon on top + vertical-written brand line
            + green dot at the bottom. Daphné's "folder tab" feel. */}
        {!isOpen && (
          <button
            type="button"
            aria-label={isFr ? "Ouvrir le concierge" : "Open the concierge"}
            onClick={() => setIsOpen(true)}
            className="maa-launcher-tab"
            style={{
              position: "fixed",
              top: "50%",
              right: -1,
              transform: "translateY(-50%)",
              width: 58,
              minHeight: 220,
              padding: "16px 8px",
              borderTopLeftRadius: 22,
              borderBottomLeftRadius: 22,
              borderTopRightRadius: 0,
              borderBottomRightRadius: 0,
              borderTop: "1px solid rgba(201,168,76,0.55)",
              borderBottom: "1px solid rgba(201,168,76,0.55)",
              borderLeft: "1px solid rgba(201,168,76,0.55)",
              borderRight: "none",
              background:
                "linear-gradient(135deg, #1c1c22 0%, #14141a 50%, #1a1a1f 100%)",
              boxShadow:
                "0 18px 50px rgba(0,0,0,0.6), 0 0 32px rgba(201,168,76,0.22), inset 0 1px 0 rgba(255,255,255,0.04)",
              zIndex: 9999,
              cursor: "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              color: "#f4eedd",
              transition:
                "transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease, border-radius 0.35s ease, width 0.35s ease",
              fontFamily: "Inter, system-ui, sans-serif",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.transform = "translateY(-50%) translateX(-8px)";
              el.style.boxShadow =
                "0 22px 60px rgba(0,0,0,0.7), 0 0 44px rgba(201,168,76,0.38), inset 0 1px 0 rgba(255,255,255,0.06)";
              el.style.borderTopLeftRadius = "28px";
              el.style.borderBottomLeftRadius = "28px";
              el.style.width = "64px";
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.transform = "translateY(-50%)";
              el.style.boxShadow =
                "0 18px 50px rgba(0,0,0,0.6), 0 0 32px rgba(201,168,76,0.22), inset 0 1px 0 rgba(255,255,255,0.04)";
              el.style.borderTopLeftRadius = "22px";
              el.style.borderBottomLeftRadius = "22px";
              el.style.width = "58px";
            }}
          >
            {/* Concierge bell — top of the tab */}
            <span
              aria-hidden="true"
              style={{
                flexShrink: 0,
                width: 32,
                height: 32,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#d4af5f",
                filter: "drop-shadow(0 0 8px rgba(212,175,95,0.55))",
                animation: "maa-launcher-bell-breathe 3.6s ease-in-out infinite",
              }}
            >
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3a3 3 0 0 1 3 3v.6a6 6 0 0 1 4 5.6V15l1.4 2H3.6L5 15v-2.8a6 6 0 0 1 4-5.6V6a3 3 0 0 1 3-3z" fill="currentColor" fillOpacity="0.18"/>
                <path d="M12 3a3 3 0 0 1 3 3v.6a6 6 0 0 1 4 5.6V15l1.4 2H3.6L5 15v-2.8a6 6 0 0 1 4-5.6V6a3 3 0 0 1 3-3z"/>
                <path d="M10 19a2 2 0 0 0 4 0"/>
              </svg>
            </span>

            {/* Vertical-written greeting — reads bottom-to-top like a folder tab */}
            <span
              style={{
                writingMode: "vertical-rl",
                transform: "rotate(180deg)",
                fontSize: 13,
                fontStyle: "italic",
                fontWeight: 500,
                color: "#f8efdd",
                letterSpacing: "0.08em",
                lineHeight: 1.2,
                fontFamily: "Georgia, 'Times New Roman', serif",
                textShadow: "0 1px 4px rgba(0,0,0,0.5)",
                whiteSpace: "nowrap",
              }}
            >
              {greetingTitle}
            </span>

            {/* Green availability pulse — bottom of the tab */}
            <span
              aria-hidden="true"
              style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#3dd17a",
                boxShadow: "0 0 10px rgba(61,209,122,0.8)",
                animation: "maa-pulse-green 2.2s ease-in-out infinite",
                flexShrink: 0,
              }}
            />
          </button>
        )}

        {/* Close button — visible only when open. Top:14 + size 38 sits
            comfortably above the floating header's first content line on
            mobile, no more overlap. */}
        {isOpen && (
          <button
            type="button"
            aria-label={isFr ? "Fermer le concierge" : "Close the concierge"}
            onClick={() => setIsOpen(false)}
            style={{
              position: "fixed",
              top: 14,
              right: 18,
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "rgba(26,26,31,0.9)",
              border: "1px solid rgba(201,168,76,0.4)",
              color: "#c9a84c",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
              zIndex: 10001,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
            }}
          >
            ✕
          </button>
        )}

        {/* Backdrop with blur — only when the host page does NOT manage its
            own LEFT pane (i.e. classic embed mode). In split-screen demo mode
            the iframe IS the left content and the visitor must be able to
            keep interacting with it, so we skip the backdrop. */}
        {isOpen && !onConciergeLink ? (
          <div
            aria-hidden="true"
            onClick={() => setIsOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9997,
              background: "rgba(8,8,12,0.45)",
              backdropFilter: "blur(6px)",
              WebkitBackdropFilter: "blur(6px)",
              animation: "maa-backdrop-in 0.45s cubic-bezier(0.16, 1, 0.3, 1) both",
            }}
          />
        ) : null}

        {/* In-page preview panel — opens to the LEFT of the chat slider when
            the concierge surfaces a page (booking, MAA pages, etc.). Keeps the
            visitor on the same page; no external tab. Closes when chat closes. */}
        {isOpen && previewUrl ? (
          <div
            role="dialog"
            aria-label={isFr ? "Aperçu de la page" : "Page preview"}
            style={{
              position: "fixed",
              top: 0,
              bottom: 0,
              right: "min(460px, 92vw)",
              width: "min(820px, calc(100vw - min(460px, 92vw) - 24px))",
              zIndex: 9998,
              background: "linear-gradient(180deg, #14141a 0%, #1a1a22 100%)",
              borderLeft: "1px solid rgba(201,168,76,0.32)",
              borderRight: "1px solid rgba(201,168,76,0.55)",
              boxShadow:
                "-12px 0 40px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(212,175,95,0.12)",
              display: "flex",
              flexDirection: "column",
              animation: "maa-preview-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) both",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "12px 16px",
                background: "linear-gradient(180deg, rgba(20,20,26,0.95) 0%, rgba(26,26,32,0.95) 100%)",
                borderBottom: "1px solid rgba(212,175,95,0.25)",
                color: "#f0e8d2",
                fontFamily: "Inter, system-ui, sans-serif",
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 26,
                  height: 26,
                  borderRadius: 8,
                  background: "rgba(212,175,95,0.12)",
                  color: "#e6c977",
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10 14 21 3" />
                  <path d="M15 3h6v6" />
                  <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
                </svg>
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 10, letterSpacing: "0.18em", color: "#d4af5f", fontWeight: 700 }}>
                  {isFr ? "APERÇU — RESTEZ DANS LA CONVERSATION" : "PREVIEW — STAY IN THE CONVERSATION"}
                </div>
                <div
                  title={previewUrl}
                  style={{
                    fontSize: 12,
                    color: "rgba(232,225,200,0.7)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {previewUrl}
                </div>
              </div>
              <a
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 11,
                  color: "#e6c977",
                  textDecoration: "none",
                  border: "1px solid rgba(212,175,95,0.45)",
                  padding: "6px 12px",
                  borderRadius: 999,
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                }}
              >
                {isFr ? "Ouvrir dans un onglet" : "Open in new tab"}
              </a>
              <button
                type="button"
                aria-label={isFr ? "Fermer l'aperçu" : "Close preview"}
                onClick={() => setPreviewUrl(null)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "rgba(26,26,31,0.9)",
                  border: "1px solid rgba(201,168,76,0.4)",
                  color: "#e6c977",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </div>
            <div style={{ position: "relative", flex: 1, minHeight: 0, background: "#f7f7f5" }}>
              {previewLoading && (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 1,
                    background: "rgba(20,20,26,0.92)",
                    color: "#e6c977",
                    fontSize: 12,
                    letterSpacing: "0.06em",
                    fontFamily: "Inter, system-ui, sans-serif",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        border: "2px solid rgba(212,175,95,0.25)",
                        borderTopColor: "#e6c977",
                        animation: "spin 0.8s linear infinite",
                      }}
                    />
                    {isFr ? "Chargement de la page…" : "Loading page…"}
                  </span>
                </div>
              )}
              <iframe
                key={previewUrl}
                src={previewUrl}
                title={isFr ? "Aperçu" : "Preview"}
                onLoad={() => {
                  setPreviewLoading(false);
                  setPreviewStalled(false);
                }}
                onError={() => setPreviewLoading(false)}
                style={{ width: "100%", height: "100%", border: "none", background: "#f7f7f5" }}
              />
              {/* Cross-origin embed fallback. Plenty of MAA partners (MyWellness,
                  FLiiP, Libro) refuse embedding via X-Frame-Options; the parent
                  frame can't detect that reliably, so we show a polite banner
                  after a stall + a prominent "Open in new tab" CTA. */}
              {previewStalled && previewLoading && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    bottom: 0,
                    padding: "14px 18px",
                    background: "linear-gradient(180deg, rgba(20,20,26,0.94) 0%, rgba(20,20,26,1) 100%)",
                    borderTop: "1px solid rgba(212,175,95,0.35)",
                    color: "#f0e8d2",
                    fontFamily: "Inter, system-ui, sans-serif",
                    display: "flex",
                    alignItems: "center",
                    gap: 14,
                    zIndex: 2,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: "rgba(212,175,95,0.18)",
                      color: "#e6c977",
                      flexShrink: 0,
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </span>
                  <div style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>
                      {isFr
                        ? "Cette page semble bloquer l'aperçu intégré."
                        : "This page seems to block embedded previews."}
                    </div>
                    <div style={{ fontSize: 11.5, color: "rgba(232,225,200,0.65)" }}>
                      {isFr
                        ? "Ouvrez-la dans un nouvel onglet pour la consulter en plein écran."
                        : "Open it in a new tab to view it full screen."}
                    </div>
                  </div>
                  <a
                    href={previewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flexShrink: 0,
                      padding: "9px 16px",
                      borderRadius: 999,
                      background: "linear-gradient(135deg, #d4af5f 0%, #8b6e3e 100%)",
                      color: "#1c1410",
                      fontWeight: 700,
                      fontSize: 12,
                      textDecoration: "none",
                      boxShadow: "0 4px 14px rgba(212,175,95,0.35)",
                    }}
                  >
                    {isFr ? "Ouvrir dans un onglet" : "Open in new tab"}
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Premium opened panel — slides from right with spring + gold border glow */}
        {isOpen ? (
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(460px, 92vw)",
              zIndex: 9998,
              background: "linear-gradient(180deg, #14141a 0%, #1a1a22 50%, #14141a 100%)",
              boxShadow: "-30px 0 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(201,168,76,0.25), inset 1px 0 0 rgba(201,168,76,0.18)",
              display: "flex",
              flexDirection: "column",
              animation: "maa-panel-slide 0.9s cubic-bezier(0.16, 1, 0.3, 1) both, maa-panel-border-glow 1.6s ease-out 0.7s both",
              transformOrigin: "right center",
              willChange: "transform, opacity",
            }}
          >
            {/* Subtle gold light-sweep that crosses the panel once on open */}
            <div
              aria-hidden="true"
              style={{
                position: "absolute",
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                pointerEvents: "none",
                background: "linear-gradient(115deg, transparent 30%, rgba(201,168,76,0.10) 50%, transparent 70%)",
                animation: "maa-panel-sheen 1.5s cubic-bezier(0.16, 1, 0.3, 1) 0.35s both",
                zIndex: 1,
              }}
            />
            <div style={{ position: "relative", zIndex: 2, display: "flex", flexDirection: "column", height: "100%" }}>
              {widget}
            </div>
          </div>
        ) : null}

        <style>{`
          @keyframes maa-backdrop-in {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes maa-panel-slide {
            /* Luxury drawer pull — slower, weightier, with a brief settle */
            0% { transform: translateX(110%) scaleX(0.96); opacity: 0; }
            18% { opacity: 1; }
            65% { transform: translateX(-10px) scaleX(1.008); }
            82% { transform: translateX(3px) scaleX(0.998); }
            100% { transform: translateX(0) scaleX(1); opacity: 1; }
          }
          @keyframes maa-panel-border-glow {
            0% { box-shadow: -30px 0 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(201,168,76,0.25), inset 1px 0 0 rgba(201,168,76,0.18); }
            40% { box-shadow: -30px 0 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(212,175,95,1), 0 0 60px rgba(212,175,95,0.45), inset 1px 0 0 rgba(212,175,95,0.7); }
            100% { box-shadow: -30px 0 80px rgba(0,0,0,0.65), 0 0 0 1px rgba(201,168,76,0.25), inset 1px 0 0 rgba(201,168,76,0.18); }
          }
          @keyframes maa-panel-sheen {
            0% { transform: translateX(-100%); opacity: 0; }
            40% { opacity: 1; }
            100% { transform: translateX(100%); opacity: 0; }
          }
          @keyframes maa-cta-in {
            0% { transform: translateY(14px) scale(0.97); opacity: 0; }
            100% { transform: translateY(0) scale(1); opacity: 1; }
          }
          @keyframes maa-launcher-bell-breathe {
            0%, 100% { transform: scale(1) rotate(0deg); filter: drop-shadow(0 0 8px rgba(212,175,95,0.55)); }
            50% { transform: scale(1.08) rotate(-2deg); filter: drop-shadow(0 0 14px rgba(212,175,95,0.85)); }
          }
          @keyframes maa-pulse-green {
            0%, 100% { box-shadow: 0 0 8px rgba(61,209,122,0.7), 0 0 0 0 rgba(61,209,122,0.5); }
            50% { box-shadow: 0 0 12px rgba(61,209,122,0.9), 0 0 0 4px rgba(61,209,122,0); }
          }
          @keyframes maa-call-pulse {
            0%, 100% { opacity: 0.35; transform: scale(0.94); }
            50% { opacity: 0.85; transform: scale(1.18); }
          }
          @keyframes maa-nudge-reveal {
            0% { transform: translateX(-22px) scale(0.97); opacity: 0; border-radius: 999px; }
            55% { transform: translateX(0) scale(1.005); opacity: 1; border-radius: 26px; }
            100% { transform: translateX(0) scale(1); opacity: 1; border-radius: 22px; }
          }
          @keyframes maa-nudge-sheen {
            0% { transform: translateX(-100%); opacity: 0; }
            35% { opacity: 1; }
            100% { transform: translateX(120%); opacity: 0; }
          }
          @keyframes maa-preview-in {
            0% { transform: translateX(40px) scale(0.985); opacity: 0; }
            60% { opacity: 1; }
            100% { transform: translateX(0) scale(1); opacity: 1; }
          }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return widget;
}
