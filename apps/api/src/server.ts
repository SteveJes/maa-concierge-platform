import Fastify from "fastify";
import cors from "@fastify/cors";
import { createHmac, timingSafeEqual } from "node:crypto";
import { resolveDirectCoreFactResponse } from "./core-facts.js";
import { sendLeadNotificationEmail } from "./services/email-notifications.js";
import { TENANT_REGISTRY, getTenant, addTenant, removeTenant, slugify } from "./admin/tenants.js";
import { sendInvoiceEmail, createStripeCheckout, nextInvoiceNumber, buildInvoice } from "./admin/invoice.js";
import { buildTenantHealthReport } from "./admin/health.js";
import { loadApprovedSourceRegistry } from "@platform/config";
import {
  answerMaaChat,
  type MaaChatRequest,
  type MaaChatResponse,
} from "./services/maa-chat.js";
import {
  createCallbackRequest,
  createBookingConfig,
  createConversation,
  createMessage,
  createTenant,
  findBookingConfigForTenantLocale,
  findTenantByCode,
  isBookingConfigConfigured,
  isCallbackPersistenceConfigured,
  isChatPersistenceConfigured,
  listConversationsForAnalytics,
  listMessagesByConversationUuid,
  listRecentUserMessagesForTenant,
  newUuid,
  updateConversation,
} from "./ingestion/nocodb.js";
import { runTenantIngestion } from "./ingestion/tenant-ingestion.js";

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
  userName?: string;
};

type ChatHistoryEntry = NonNullable<MaaChatRequest["conversationHistory"]>[number];

type VapiLaunchMode = "web_call" | "phone_number" | "web_call_or_number";

interface VapiHandoffRecord {
  tenantId: string;
  conversationId: string | null;
  locale: string | null;
  createdAt: string;
  assistantId: string | null;
  publicKey: string | null;
  phoneNumber: string | null;
  launchMode: VapiLaunchMode;
  summary: string;
  lastUserMessage: string;
  recentTurns: NonNullable<MaaChatRequest["conversationHistory"]>;
}

// Pending inbound call handoffs — keyed by normalized E.164 phone number.
// When a user registers their number from the web chat, we store their context here.
// When they call Sophie's inbound number, VAPI sends assistant-request and we match by caller ID.
interface PendingInboundHandoff {
  tenantId: string;
  customerName: string | null;
  customerEmail: string | null;
  lastUserMessage: string;
  handoffSummary: string;
  locale: string;
  handoffSource: string;
  createdAtMs: number;
  expiresAtMs: number;
  status: "pending" | "matched" | "expired";
  matchedCallId: string | null;
}

const dryRunConversationHistory = new Map<string, ChatHistoryEntry[]>();
const vapiHandoffStore = new Map<string, VapiHandoffRecord>();
const pendingInboundHandoffStore = new Map<string, PendingInboundHandoff>();

function normalizePhoneE164(value: string | null): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  if (value.startsWith("+") && digits.length >= 10) return `+${digits}`;
  return null;
}

// ── OpenAI usage tracking ─────────────────────────────────────────────────────
// In-memory accumulators, reset on restart. Enough for real-time admin view.
// Pricing as of May 2026 — update if model pricing changes.
const OPENAI_PRICING: Record<string, { inputPer1M: number; outputPer1M: number }> = {
  "gpt-4o":          { inputPer1M: 2.50,  outputPer1M: 10.00 },
  "gpt-4o-mini":     { inputPer1M: 0.15,  outputPer1M: 0.60  },
  "gpt-4.1":         { inputPer1M: 2.00,  outputPer1M: 8.00  },
  "gpt-4.1-mini":    { inputPer1M: 0.40,  outputPer1M: 1.60  },
  "gpt-4.1-nano":    { inputPer1M: 0.10,  outputPer1M: 0.40  },
  "gpt-4-turbo":     { inputPer1M: 10.00, outputPer1M: 30.00 },
};

interface TenantUsage {
  tenantId: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  lastCallAt: string;
  byModel: Record<string, { calls: number; inputTokens: number; outputTokens: number; costUsd: number }>;
}

const openAiUsageStore = new Map<string, TenantUsage>();

function recordOpenAiUsage(tenantId: string, model: string, inputTokens: number, outputTokens: number): void {
  const pricing = OPENAI_PRICING[model] ?? OPENAI_PRICING["gpt-4.1-mini"]!;
  const costUsd = (inputTokens / 1_000_000) * pricing.inputPer1M + (outputTokens / 1_000_000) * pricing.outputPer1M;
  const now = new Date().toISOString();

  const existing = openAiUsageStore.get(tenantId) ?? {
    tenantId, calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, lastCallAt: now, byModel: {},
  };

  existing.calls += 1;
  existing.inputTokens += inputTokens;
  existing.outputTokens += outputTokens;
  existing.costUsd = Math.round((existing.costUsd + costUsd) * 1_000_000) / 1_000_000;
  existing.lastCallAt = now;

  const m = existing.byModel[model] ?? { calls: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
  m.calls += 1; m.inputTokens += inputTokens; m.outputTokens += outputTokens;
  m.costUsd = Math.round((m.costUsd + costUsd) * 1_000_000) / 1_000_000;
  existing.byModel[model] = m;

  openAiUsageStore.set(tenantId, existing);
}

// Token packages — data model ready, purchasing to be wired later
export interface TokenPackage {
  id: string;
  name: string;
  tokens: number;       // OpenAI tokens included
  priceUsd: number;
  pricesCad: number;
}

export const TOKEN_PACKAGES: TokenPackage[] = [
  { id: "starter",  name: "Starter",  tokens: 1_000_000,  priceUsd: 1.00,  pricesCad: 1.40  },
  { id: "growth",   name: "Growth",   tokens: 5_000_000,  priceUsd: 4.00,  pricesCad: 5.50  },
  { id: "scale",    name: "Scale",    tokens: 25_000_000, priceUsd: 15.00, pricesCad: 20.50 },
  { id: "unlimited",name: "Unlimited",tokens: 0,          priceUsd: 0,     pricesCad: 0     }, // covered by monthly plan
];

function getPendingInboundHandoff(phoneE164: string): PendingInboundHandoff | null {
  const record = pendingInboundHandoffStore.get(phoneE164);
  if (!record) return null;
  if (record.status !== "pending") return null;
  if (Date.now() > record.expiresAtMs) {
    record.status = "expired";
    return null;
  }
  return record;
}

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

function normalizeIntentText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasAnyPhrase(normalized: string, phrases: string[]): boolean {
  return phrases.some((phrase) => normalized.includes(phrase));
}

function hasAllTokens(normalized: string, tokens: string[]): boolean {
  return tokens.every((token) => normalized.includes(token));
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

  const frenchMatch =
    /(?:réserver|reserver|réservation|reservation|rendez-vous|planifier|visite|visiter|équipe des ventes|equipe des ventes|ventes)/i.test(
      normalized,
    );

  const englishMatch =
    /(?:book|booking|tour|sales team|speak with sales|talk to sales|book a call|book an appointment|schedule a|schedule an|schedule my)/i.test(
      normalized,
    );

  if (isFrenchLocale(locale)) {
    return frenchMatch || englishMatch;
  }

  return englishMatch;
}

function looksLikePhoneIntent(userMessage: string, locale: string | null): boolean {
  const normalized = normalizeIntentText(userMessage);

  if (isFrenchLocale(locale)) {
    return (
      hasAnyPhrase(normalized, [
        "continuer par telephone",
        "continuer cette conversation par telephone",
        "continuer au telephone",
        "peut on continuer par telephone",
        "peut on continuer cette conversation par telephone",
        "connecter par telephone",
        "connecter moi par telephone",
        "transferer moi a quelqu un",
        "mettre en ligne",
      ]) ||
      hasAllTokens(normalized, ["continuer", "telephone"]) ||
      hasAllTokens(normalized, ["transferer", "quelqu"]) ||
      hasAllTokens(normalized, ["mettre", "ligne"])
    );
  }

  return (
    hasAnyPhrase(normalized, [
      "continue by phone",
      "continue this by phone",
      "continue this conversation by phone",
      "can we continue by phone",
      "can we continue this by phone",
      "can we continue this conversation by phone",
      "can we contnue by phone",
      "contnue by phone",
      "connect me by phone",
      "transfer me to someone",
      "put me through",
    ]) ||
    hasAllTokens(normalized, ["continue", "phone"]) ||
    hasAllTokens(normalized, ["contnue", "phone"]) ||
    hasAllTokens(normalized, ["transfer", "someone"]) ||
    hasAllTokens(normalized, ["put", "through"])
  );
}


function buildCallbackSuccessMessage(
  locale: string | null,
  phone: string,
  preferredTimeText: string | null,
): string {
  if (isFrenchLocale(locale)) {
    return preferredTimeText
      ? `Merci - votre demande de rappel a bien été enregistrée. Un membre de l'équipe du Club Sportif MAA pourra vous rappeler au ${phone}. Plage horaire souhaitée notée : ${preferredTimeText}.`
      : `Merci - votre demande de rappel a bien été enregistrée. Un membre de l'équipe du Club Sportif MAA pourra vous rappeler au ${phone}.`;
  }

  return preferredTimeText
    ? `Thanks - your callback request has been captured. A Club Sportif MAA team member can call you back at ${phone}. Preferred time noted: ${preferredTimeText}.`
    : `Thanks - your callback request has been captured. A Club Sportif MAA team member can call you back at ${phone}.`;
}
function buildCallbackFailureMessage(locale: string | null): string {
  if (isFrenchLocale(locale)) {
    return "Merci - j'ai bien reçu vos coordonnées, mais un problème technique a empêché l'enregistrement de votre demande de rappel. Veuillez réessayer dans un instant.";
  }

  return "Thanks - I received your callback details, but a technical issue prevented the callback request from being saved. Please try again in a moment.";
}
function buildCallbackNotConfiguredMessage(locale: string | null): string {
  if (isFrenchLocale(locale)) {
    return "Merci - j'ai bien reçu votre demande de rappel, mais la persistance des rappels n'est pas configurée sur ce serveur.";
  }

  return "Thanks - I received your callback request, but callback persistence is not configured on this server.";
}
function buildDirectBookingSuccessMessage(
  locale: string | null,
  _bookingUrl: string,
  allowCallbackFallback: boolean,
): string {
  if (isFrenchLocale(locale)) {
    return allowCallbackFallback
      ? "Avec plaisir. Cliquez sur le bouton ci-dessous pour accéder à notre page de réservation. Vous préférez qu'on vous contacte ? Je peux aussi prendre vos coordonnées ici."
      : "Avec plaisir. Cliquez sur le bouton ci-dessous pour accéder à notre page de réservation.";
  }

  return allowCallbackFallback
    ? "Happy to help with that. Click the button below to visit our booking page. Prefer to have us reach out instead? I can capture your contact info here."
    : "Happy to help with that. Click the button below to visit our booking page.";
}
function buildPopupBookingSuccessMessage(
  locale: string | null,
  _bookingUrl: string,
  allowCallbackFallback: boolean,
): string {
  if (isFrenchLocale(locale)) {
    return allowCallbackFallback
      ? "Avec plaisir. Cliquez sur le bouton ci-dessous pour planifier votre visite. Vous préférez qu'on vous contacte ? Je peux aussi prendre vos coordonnées ici."
      : "Avec plaisir. Cliquez sur le bouton ci-dessous pour planifier votre visite.";
  }

  return allowCallbackFallback
    ? "Happy to help. Click the button below to visit our booking page and schedule your visit. Prefer to have us reach out instead? I can capture your contact info here."
    : "Happy to help. Click the button below to visit our booking page and schedule your visit.";
}
function buildBookingUnavailableMessage(
  locale: string | null,
  allowCallbackFallback: boolean,
): string {
  if (isFrenchLocale(locale)) {
    return allowCallbackFallback
      ? "Je peux vous orienter vers une réservation, mais aucun lien de prise de rendez-vous n'est configuré pour le moment. Si vous préférez, je peux aussi prendre une demande de rappel."
      : "Je peux vous orienter vers une réservation, mais aucun lien de prise de rendez-vous n'est configuré pour le moment.";
  }

  return allowCallbackFallback
    ? "I can direct you to booking, but no booking link is configured right now. If you prefer, I can also help capture a callback request."
    : "I can direct you to booking, but no booking link is configured right now.";
}
function buildVapiContinuationMessage(
  locale: string | null,
  fallbackToCallback: boolean,
): string {
  if (isFrenchLocale(locale)) {
    return fallbackToCallback
      ? "Bien sûr. Utilisez le bouton ci-dessous pour continuer par téléphone. Je peux aussi vous rappeler si vous préférez."
      : "Bien sûr. Utilisez le bouton ci-dessous pour continuer cette conversation par téléphone.";
  }

  return fallbackToCallback
    ? "Sure. Use the button below to continue by phone. I can also arrange a callback if you prefer."
    : "Sure. Use the button below to continue this conversation by phone.";
}

function buildVapiUnavailableMessage(
  locale: string | null,
  fallbackToCallback: boolean,
): string {
  if (isFrenchLocale(locale)) {
    return fallbackToCallback
      ? "La reprise par téléphone n'est pas disponible pour le moment. Je peux prendre vos coordonnées pour un rappel si vous voulez."
      : "La reprise par téléphone n'est pas disponible pour le moment. N'hésitez pas à nous appeler directement.";
  }

  return fallbackToCallback
    ? "Phone continuation isn't available right now. I can take your details for a callback if you'd like."
    : "Phone continuation isn't available right now. Feel free to call us directly.";
}

function humanizeAssistantMessage(
  assistantMessage: string,
  locale: string | null,
): string {
  const trimmed = assistantMessage.trim();

  if (isFrenchLocale(locale)) {
    return trimmed
      .replace(
        /Je ne dispose pas de suffisamment d'informations fiables pour répondre à cela en toute sécurité\.\s*/i,
        "Je veux bien vous aider. Pouvez-vous préciser un peu ce que vous cherchez? ",
      )
      .replace(
        /Je peux aussi vous orienter vers une réservation ou une demande de rappel\./i,
        "Je peux aussi vous aider à planifier une visite ou à demander un rappel.",
      )
      .replace(
        /^Le Club Sportif MAA est un club sportif unique offrant/i,
        "Le Club Sportif MAA est un club sportif haut de gamme au centre-ville de Montréal offrant",
      );
  }

  return trimmed
    .replace(
      /I do not have enough reliable information to answer that safely\.\s*/i,
      "I'd be happy to help. Could you tell me a bit more about what you'd like to know? ",
    )
    .replace(
      /I can also point you to booking or a callback request\./i,
      "I can also help you book a visit or arrange a callback.",
    )
    .replace(
      /^Club Sportif MAA is a unique sports club offering/i,
      "Club Sportif MAA is a premium sports club in downtown Montreal offering",
    );
}

function buildVapiRecentTurns(
  conversationHistory: MaaChatRequest["conversationHistory"],
  currentUserMessage: string,
): NonNullable<MaaChatRequest["conversationHistory"]> {
  return [
    ...(conversationHistory ?? []),
    {
      role: "user" as const,
      content: currentUserMessage,
    },
  ].slice(-8);
}

function buildVapiHandoffSummary(
  locale: string | null,
  recentTurns: NonNullable<MaaChatRequest["conversationHistory"]>,
  currentUserMessage: string,
): string {
  const recentUserTurns = recentTurns
    .filter((turn) => turn.role === "user")
    .slice(-2)
    .map((turn) => turn.content);

  const recentTopicText = recentUserTurns.join(" | ");
  const parts: string[] = [];

  if (isFrenchLocale(locale)) {
    parts.push("Continuer la même conversation Club Sportif MAA par téléphone en français.");
    parts.push("Dernière demande de l'utilisateur : " + currentUserMessage);
    if (recentTopicText) {
      parts.push("Contexte récent : " + recentTopicText);
    }
    return parts.join(" ");
  }

  parts.push("Continue the same Club Sportif MAA conversation by phone in English.");
  parts.push("Latest user request: " + currentUserMessage);
  if (recentTopicText) {
    parts.push("Recent context: " + recentTopicText);
  }
  return parts.join(" ");
}

function deriveOutcome(
  followUpMode: string,
): "answered" | "escalated" | "callback" | "booking" | "phone" {
  if (followUpMode === "vapi") return "phone";
  if (followUpMode === "calendly") return "booking";
  if (followUpMode === "callback") return "callback";
  if (followUpMode === "clarify") return "escalated";
  return "answered";
}

function deriveLanguage(locale: string | null): "fr" | "en" {
  if (!locale) return "fr";
  return locale.startsWith("fr") ? "fr" : "en";
}

function buildConversationSummary(
  userMessage: string,
  assistantMessage: string,
): string {
  const userSnippet = userMessage.slice(0, 80);
  const assistantSnippet = assistantMessage.slice(0, 120);
  return `Q: ${userSnippet} | A: ${assistantSnippet}`;
}

async function updateConversationOutcome(args: {
  uuid: string;
  tenantUuid: string;
  followUpMode: string;
  userMessage: string;
  assistantMessage: string;
  locale: string | null;
  now: string;
}): Promise<void> {
  try {
    await updateConversation(args.uuid, {
      outcome: deriveOutcome(args.followUpMode),
      summary: buildConversationSummary(args.userMessage, args.assistantMessage),
      needs_followup: args.followUpMode !== "done",
      language: deriveLanguage(args.locale),
      updated_at: args.now,
    });
  } catch {
    // Non-critical — don't fail the chat response
  }
}

function splitBuffer(buf: Buffer, sep: Buffer): Buffer[] {
  const parts: Buffer[] = [];
  let start = 0;
  while (start < buf.length) {
    const idx = buf.indexOf(sep, start);
    if (idx < 0) { parts.push(buf.slice(start)); break; }
    if (idx > start) parts.push(buf.slice(start, idx));
    start = idx + sep.length;
    if (buf[start] === 13 && buf[start + 1] === 10) start += 2;
  }
  return parts;
}

export function createServer() {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => ({ status: "ok" }));

  // ── Admin API ────────────────────────────────────────────────────────────────

  const ADMIN_SECRET = process.env.ADMIN_SECRET ?? "dubub-admin-secret-change-me";

  function signAdminToken(username: string): string {
    const payload = `${username}:${Math.floor(Date.now() / (1000 * 60 * 60 * 24 * 7))}`; // weekly rotation
    return createHmac("sha256", ADMIN_SECRET).update(payload).digest("hex") + ":" + username;
  }

  function verifyAdminToken(token: string): boolean {
    const [, username] = token.split(":");
    if (!username) return false;
    const expected = signAdminToken(username);
    try {
      return timingSafeEqual(Buffer.from(token), Buffer.from(expected));
    } catch {
      return false;
    }
  }

  function adminAuth(request: any, reply: any): boolean {
    const auth = (request.headers["x-admin-token"] as string | undefined) ?? "";
    if (!verifyAdminToken(auth)) {
      reply.code(401).send({ error: "unauthorized" });
      return false;
    }
    return true;
  }

  // POST /v1/admin/login
  app.post("/v1/admin/login", async (request, reply) => {
    const body = (request.body ?? {}) as { username?: string; password?: string };
    const adminUsername = process.env.ADMIN_USERNAME ?? "admin";
    const adminPassword = process.env.ADMIN_PASSWORD ?? "dubub2025";

    if (body.username !== adminUsername || body.password !== adminPassword) {
      return reply.code(401).send({ error: "invalid_credentials" });
    }
    const token = signAdminToken(adminUsername);
    return { token, username: adminUsername };
  });

  // GET /v1/admin/tenants
  app.get("/v1/admin/tenants", async (request, reply) => {
    if (!adminAuth(request, reply)) return;
    return TENANT_REGISTRY.map((t) => ({
      id: t.id,
      name: t.name,
      plan: t.plan,
      status: t.status,
      since: t.since,
      monthlyPriceCad: t.monthlyPriceCad,
      addons: t.addons,
      contactName: t.contactName,
      contactEmail: t.contactEmail,
      website: t.website,
      vapiEnabled: !!t.vapiAssistantId,
      notes: t.notes,
    }));
  });

  // GET /v1/admin/tenants/:tenantId/health
  app.get("/v1/admin/tenants/:tenantId/health", async (request, reply) => {
    if (!adminAuth(request, reply)) return;
    const { tenantId } = request.params as TenantRouteParams;
    const tenant = getTenant(tenantId);
    if (!tenant) return reply.code(404).send({ error: "tenant_not_found" });
    const report = await buildTenantHealthReport(tenant);
    return report;
  });

  // GET /v1/admin/tenants/:tenantId/overview
  app.get("/v1/admin/tenants/:tenantId/overview", async (request, reply) => {
    if (!adminAuth(request, reply)) return;
    const { tenantId } = request.params as TenantRouteParams;
    const tenant = getTenant(tenantId);
    if (!tenant) return reply.code(404).send({ error: "tenant_not_found" });
    const health = await buildTenantHealthReport(tenant);
    return { tenant, health };
  });

  // GET /v1/admin/usage — OpenAI cost per tenant + token packages
  app.get("/v1/admin/usage", async (request, reply) => {
    if (!adminAuth(request, reply)) return;
    return {
      tenants: Array.from(openAiUsageStore.values()),
      tokenPackages: TOKEN_PACKAGES,
      pricing: OPENAI_PRICING,
      note: "Usage resets on API restart. Persistent tracking coming soon.",
    };
  });

  // POST /v1/admin/onboarding — create a new tenant + send invoice
  app.post("/v1/admin/onboarding", async (request, reply) => {
    if (!adminAuth(request, reply)) return;
    const body = request.body as Record<string, unknown>;
    const name = typeof body.companyName === "string" ? body.companyName.trim() : "";
    if (!name) return reply.code(400).send({ error: "companyName required" });

    const id = slugify(name) || `tenant-${Date.now()}`;
    if (getTenant(id)) return reply.code(409).send({ error: "tenant_already_exists", id });

    const planRaw = typeof body.plan === "string" ? body.plan : "essentiel";
    const plan: "starter" | "professional" | "enterprise" = planRaw === "prestige" ? "enterprise"
      : planRaw === "croissance" ? "professional"
      : "starter";

    const monthlyPrice = parseFloat(typeof body.monthlyPriceCad === "string" ? body.monthlyPriceCad : "0") || 0;
    const implFee = parseFloat(typeof body.implementationFee === "string" ? body.implementationFee : "0") || 0;
    const billingTerm = typeof body.billingTerm === "string" ? body.billingTerm : "monthly";
    const clientEmail = typeof body.contactEmail === "string" ? body.contactEmail : "";
    const clientName = typeof body.contactName === "string" ? body.contactName : name;
    const sendInvoice = body.sendInvoice === true;

    addTenant({
      id,
      name,
      plan,
      status: "active",
      since: new Date().toISOString().slice(0, 10),
      notifyEmail: typeof body.notifyEmail === "string" ? body.notifyEmail : "",
      vapiAssistantId: typeof body.vapiAssistantId === "string" && body.vapiAssistantId ? body.vapiAssistantId : null,
      vapiPhoneNumberId: typeof body.vapiPhoneNumberId === "string" && body.vapiPhoneNumberId ? body.vapiPhoneNumberId : null,
      inboundPhoneNumber: typeof body.inboundPhoneNumber === "string" && body.inboundPhoneNumber ? body.inboundPhoneNumber : null,
      openAiModel: typeof body.openAiModel === "string" ? body.openAiModel : "gpt-4o",
      monthlyPriceCad: monthlyPrice,
      addons: Array.isArray(body.addons) ? (body.addons as string[]) : [],
      contactName: clientName || null,
      contactEmail: clientEmail || null,
      website: typeof body.website === "string" ? body.website : null,
      notes: typeof body.notes === "string" ? body.notes : null,
    });

    // Create NocoDB tenant row + optional booking config (non-fatal — platform functions without it)
    let nocoTenantUuid: string | null = null;
    try {
      const tenantUuid = newUuid();
      const websiteUrl = typeof body.website === "string" && body.website ? body.website : null;
      const locale = typeof body.locale === "string" && body.locale ? body.locale : "fr-CA";
      await createTenant({
        uuid: tenantUuid,
        code: id,
        name,
        status: "active",
        default_locale: locale,
        timezone: "America/Toronto",
        website_url: websiteUrl,
        support_email: clientEmail || null,
        vapi_assistant_id: typeof body.vapiAssistantId === "string" && body.vapiAssistantId ? body.vapiAssistantId : null,
        vapi_phone_number_id: typeof body.vapiPhoneNumberId === "string" && body.vapiPhoneNumberId ? body.vapiPhoneNumberId : null,
        vapi_inbound_phone: typeof body.inboundPhoneNumber === "string" && body.inboundPhoneNumber ? body.inboundPhoneNumber : null,
      });
      nocoTenantUuid = tenantUuid;
      request.log.info({ tenantId: id, uuid: tenantUuid }, "NocoDB tenant row created");

      const calendlyUrl = typeof body.calendlyUrl === "string" ? body.calendlyUrl.trim() : "";
      if (calendlyUrl) {
        await createBookingConfig({
          uuid: newUuid(),
          tenant_uuid: tenantUuid,
          locale: null,
          enabled: true,
          mode: "calendly",
          booking_url: calendlyUrl,
          allow_callback_fallback: true,
        });
        request.log.info({ tenantId: id }, "NocoDB booking_config created");
      }
    } catch (err) {
      request.log.warn({ err }, "NocoDB setup failed (non-fatal — tenant still created in registry)");
    }

    // Trigger knowledge base ingestion (non-fatal, runs in background)
    if (nocoTenantUuid) {
      const crawlerEnabled = body.crawlerEnabled !== false;
      const crawlerUrl = typeof body.crawlerUrl === "string" && body.crawlerUrl.trim() ? body.crawlerUrl.trim() : null;
      const websiteUrl = typeof body.website === "string" && body.website.trim() ? body.website.trim() : null;
      const webUrls: string[] = [];
      if (crawlerEnabled) {
        const targetUrl = crawlerUrl ?? websiteUrl;
        if (targetUrl) webUrls.push(targetUrl);
      }
      const pdfServerPaths: string[] = Array.isArray(body.uploadedPdfUrls)
        ? (body.uploadedPdfUrls as unknown[]).filter((u): u is string => typeof u === "string")
        : [];
      const tenantLocale = typeof body.locale === "string" && body.locale ? body.locale : "fr-CA";

      if (webUrls.length > 0 || pdfServerPaths.length > 0) {
        const tenantUuidCapture = nocoTenantUuid;
        void runTenantIngestion({
          tenantUuid: tenantUuidCapture,
          tenantCode: id,
          locale: tenantLocale,
          webUrls,
          pdfServerPaths,
        }).then(r => {
          request.log.info({ tenantId: id, ...r }, "Tenant ingestion complete");
        }).catch(err => {
          request.log.warn({ err, tenantId: id }, "Tenant ingestion failed (non-fatal)");
        });
      }
    }

    // Build invoice lines
    const invoiceNumber = nextInvoiceNumber();
    const today = new Date().toISOString().slice(0, 10);
    const due = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
    const planLabel = planRaw === "prestige" ? "Prestige" : planRaw === "croissance" ? "Croissance" : planRaw === "autre" ? (typeof body.planLabel === "string" ? body.planLabel : "Sur mesure") : "Essentiel";
    const termLabel = billingTerm === "annual" ? "12 mois" : "mensuel";
    const lines = [];
    if (implFee > 0) {
      lines.push({ description: `Frais d'implantation — Concierge IA ${planLabel}`, qty: 1, unitPrice: implFee });
    }
    if (monthlyPrice > 0) {
      lines.push({ description: `Abonnement Concierge IA ${planLabel} (${termLabel})`, qty: billingTerm === "annual" ? 12 : 1, unitPrice: monthlyPrice });
    }

    let stripeUrl: string | null = null;
    let invoiceResult = null;

    if (sendInvoice && clientEmail && lines.length > 0) {
      invoiceResult = buildInvoice({ invoiceNumber, issueDate: today, dueDate: due, clientName, clientEmail, clientAddress: typeof body.address === "string" ? body.address : undefined, lines, billingTerm: billingTerm as "monthly" | "annual" });

      const origin = process.env.APP_ORIGIN ?? "https://clients.dubub.com";
      stripeUrl = await createStripeCheckout({
        clientEmail, clientName, invoiceNumber, lines,
        successUrl: `${origin}/admin/dashboard?invoice=paid&id=${invoiceNumber}`,
        cancelUrl: `${origin}/admin/dashboard?invoice=cancelled`,
      }).catch(() => null);

      await sendInvoiceEmail({ invoiceNumber, issueDate: today, dueDate: due, clientName, clientEmail, clientAddress: typeof body.address === "string" ? body.address : undefined, lines, billingTerm: billingTerm as "monthly" | "annual", stripeUrl: stripeUrl ?? undefined }).catch((e: unknown) => console.error("Invoice email failed:", e));
    }

    return reply.code(201).send({
      ok: true,
      tenantId: id,
      tenantSlug: id,
      invoiceNumber: sendInvoice && lines.length > 0 ? invoiceNumber : null,
      stripeUrl,
      total: invoiceResult?.total ?? null,
    });
  });

  // DELETE /v1/admin/tenants/:id — remove tenant from registry (for re-onboarding)
  app.delete("/v1/admin/tenants/:id", async (request, reply) => {
    if (!adminAuth(request, reply)) return;
    const { id } = request.params as { id: string };
    const removed = removeTenant(id);
    if (!removed) return reply.code(404).send({ error: "tenant_not_found" });
    return reply.send({ ok: true, removedId: id });
  });

  // GET /v1/demo-config/:slug — returns tenant config for demo pages
  app.get("/v1/demo-config/:slug", async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const tenant = getTenant(slug) ?? TENANT_REGISTRY.find(t => slugify(t.name) === slug);
    if (!tenant) return reply.code(404).send({ error: "not_found" });
    const conciergeName = tenant.id === "maa" ? "Sophie" : tenant.id === "dubub" ? "SophIA" : "SophIA";
    return reply.send({
      tenantId: tenant.id,
      name: tenant.name,
      websiteUrl: tenant.website ?? null,
      conciergeName,
    });
  });

    // POST /v1/admin/onboarding/upload-pdf — save uploaded PDF to disk
  app.post("/v1/admin/onboarding/upload-pdf", { config: { rawBody: true } }, async (request, reply) => {
    if (!adminAuth(request, reply)) return;
    // Accept multipart via raw boundary parsing using built-in Node stream
    const contentType = (request.headers["content-type"] ?? "") as string;
    if (!contentType.includes("multipart/form-data")) {
      return reply.code(400).send({ error: "multipart required" });
    }
    const boundary = contentType.split("boundary=")[1]?.trim();
    if (!boundary) return reply.code(400).send({ error: "missing boundary" });

    const { createWriteStream, mkdirSync } = await import("node:fs");
    const { join } = await import("node:path");
    const uploadDir = join(process.cwd(), "uploads", "pdfs");
    mkdirSync(uploadDir, { recursive: true });

    const chunks: Buffer[] = [];
    for await (const chunk of request.raw) chunks.push(chunk as Buffer);
    const raw = Buffer.concat(chunks);

    const sep = Buffer.from(`--${boundary}`);
    const parts = splitBuffer(raw, sep);
    let savedUrl = "";

    for (const part of parts) {
      if (!part.length || part.toString().trim() === "--") continue;
      const headerEnd = part.indexOf(Buffer.from("\r\n\r\n"));
      if (headerEnd < 0) continue;
      const headers = part.slice(0, headerEnd).toString();
      const body = part.slice(headerEnd + 4);
      const trimmed = body.slice(0, body.length - 2); // strip trailing \r\n

      const nameMatch = headers.match(/name="([^"]+)"/);
      const fileMatch = headers.match(/filename="([^"]+)"/);
      if (nameMatch?.[1] === "file" && fileMatch?.[1]) {
        const safeName = fileMatch[1].replace(/[^a-zA-Z0-9._-]/g, "_");
        const dest = join(uploadDir, `${Date.now()}_${safeName}`);
        const ws = createWriteStream(dest);
        await new Promise<void>((res, rej) => { ws.write(trimmed); ws.end(); ws.on("finish", res); ws.on("error", rej); });
        savedUrl = `/uploads/pdfs/${dest.split(/[\\/]/).pop() ?? safeName}`;
      }
    }

    if (!savedUrl) return reply.code(400).send({ error: "no_pdf_found" });
    return { ok: true, url: savedUrl };
  });

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

  app.get("/v1/tenants/:tenantId/vapi-handoffs/:handoffToken", async (request, reply) => {
    const { tenantId, handoffToken } = request.params as TenantRouteParams & {
      handoffToken: string;
    };

    if (tenantId !== "maa") {
      return reply.code(404).send({
        error: "tenant_not_supported",
        message: `Unsupported tenant: ${tenantId}`,
      });
    }

    const handoff = vapiHandoffStore.get(handoffToken);

    if (!handoff || handoff.tenantId !== tenantId) {
      return reply.code(404).send({
        error: "vapi_handoff_not_found",
        message: `Vapi handoff not found: ${handoffToken}`,
      });
    }

    return handoff;
  });

  // POST /v1/tenants/:tenantId/inbound-handoff
  // Called by the web chat widget when a user registers their phone to prepare an inbound call.
  // Stores context so Sophie recognizes them when they call in.
  app.post("/v1/tenants/:tenantId/inbound-handoff", async (request, reply) => {
    const { tenantId } = request.params as TenantRouteParams;
    const body = (request.body ?? {}) as {
      phone?: string;
      name?: string;
      email?: string;
      locale?: string;
      lastUserMessage?: string;
      handoffSummary?: string;
      handoffSource?: string;
      conversationId?: string;
    };

    const normalizedPhone = normalizePhoneE164(toNullableTrimmedString(body.phone));
    if (!normalizedPhone) {
      return reply.code(400).send({ error: "invalid_phone_number" });
    }

    const locale = toNullableTrimmedString(body.locale) ?? "fr";
    const lastUserMessage = toNullableTrimmedString(body.lastUserMessage) ?? "";
    const handoffSummary = toNullableTrimmedString(body.handoffSummary) ?? lastUserMessage;
    const now = Date.now();

    pendingInboundHandoffStore.set(normalizedPhone, {
      tenantId,
      customerName: toNullableTrimmedString(body.name),
      customerEmail: toNullableTrimmedString(body.email),
      lastUserMessage,
      handoffSummary,
      locale,
      handoffSource: toNullableTrimmedString(body.handoffSource) ?? "web_inbound",
      createdAtMs: now,
      expiresAtMs: now + 30 * 60 * 1000, // 30-minute TTL
      status: "pending",
      matchedCallId: null,
    });

    // Use tenant-specific inbound phone if available, fall back to env vars (MAA default)
    const tenantForHandoff = getTenant(tenantId);
    const inboundNumber = tenantForHandoff?.inboundPhoneNumber
      ?? toNullableTrimmedString(process.env.VAPI_INBOUND_PHONE_NUMBER)
      ?? toNullableTrimmedString(process.env.VAPI_PHONE_NUMBER);
    request.log.info({ tenantId, matched: false, handoffSource: "web_inbound", hasContext: !!lastUserMessage }, "inbound-handoff registered");

    // Update conversation outcome to phone continuation in background
    const convId = typeof body.conversationId === "string" ? body.conversationId.trim() : null;
    if (convId) {
      void (async () => {
        try {
          const tenant = await findTenantByCode("maa");
          await updateConversationOutcome({
            uuid: convId,
            tenantUuid: tenant.uuid,
            followUpMode: "vapi",
            userMessage: lastUserMessage,
            assistantMessage: "Transfert vers Sophie (appel entrant)",
            locale,
            now: new Date().toISOString(),
          });
        } catch { /* non-critical */ }
      })();
    }

    return { ok: true, inboundNumber };
  });

  // POST /v1/vapi/server
  // VAPI Server URL webhook. Handles assistant-request for inbound calls.
  // Must respond within 7.5 seconds — no LLM calls in this path.
  app.post("/v1/vapi/server", async (request, reply) => {
    const body = (request.body ?? {}) as {
      message?: {
        type?: string;
        call?: {
          id?: string;
          customer?: { number?: string };
        };
      };
    };

    const msgType = body.message?.type;

    if (msgType !== "assistant-request") {
      // VAPI may send other event types (end-of-call, etc.) — acknowledge silently
      return reply.code(200).send({});
    }

    // Tenant is identified via ?tenantId= query param set in VAPI dashboard server URL.
    // E.g. https://api.dubub.com/v1/vapi/server?tenantId=dubub
    // Defaults to "maa" for backward compatibility.
    const vapiTenantId = ((request.query as Record<string, string | undefined>).tenantId ?? "maa").toLowerCase();
    const vapiTenant = getTenant(vapiTenantId);

    const rawCallerNumber = body.message?.call?.customer?.number ?? null;
    const callId = body.message?.call?.id ?? null;
    const callerE164 = normalizePhoneE164(rawCallerNumber);

    const assistantId = vapiTenant?.vapiAssistantId
      ?? toNullableTrimmedString(process.env.VAPI_INBOUND_ASSISTANT_ID)
      ?? toNullableTrimmedString(process.env.VAPI_ASSISTANT_ID);

    if (!assistantId) {
      request.log.warn({ callId }, "VAPI assistant-request: no assistantId configured");
      return reply.code(200).send({});
    }

    // Try to match a pending inbound handoff
    const handoff = callerE164 ? getPendingInboundHandoff(callerE164) : null;

    if (handoff) {
      // Mark matched immediately to prevent reuse on re-dial
      handoff.status = "matched";
      handoff.matchedCallId = callId;

      const name = handoff.customerName;
      const isFr = !handoff.locale.startsWith("en");

      // Build a topic-aware opening so Sophie sounds genuinely briefed, not generic
      const detectInboundTopic = (msg: string): { fr: string; en: string } => {
        const m = msg.toLowerCase();
        if (m.includes("tarif") || m.includes("prix") || m.includes("abonnement") || m.includes("cost") || m.includes("price") || m.includes("membership"))
          return { fr: "nos tarifs et abonnements", en: "our membership pricing" };
        if (m.includes("piscine") || m.includes("pool") || m.includes("nage"))
          return { fr: "notre piscine", en: "our pool" };
        if (m.includes("cours") || m.includes("classe") || m.includes("yoga") || m.includes("pilates") || m.includes("spinning") || m.includes("class"))
          return { fr: "nos cours de groupe", en: "our group classes" };
        if (m.includes("horaire") || m.includes("heure") || m.includes("ouvert") || m.includes("schedule") || m.includes("hours"))
          return { fr: "nos horaires", en: "our hours" };
        if (m.includes("spa") || m.includes("sauna") || m.includes("hammam"))
          return { fr: "notre espace spa", en: "our spa" };
        if (m.includes("visite") || m.includes("tour") || m.includes("rendez-vous") || m.includes("visit"))
          return { fr: "une visite du club", en: "a club visit" };
        if (m.includes("squash"))
          return { fr: "nos courts de squash", en: "our squash courts" };
        if (m.includes("etudiant") || m.includes("étudiant") || m.includes("student"))
          return { fr: "nos tarifs étudiants", en: "our student rates" };
        if (m.includes("senior") || m.includes("aîné"))
          return { fr: "nos tarifs seniors", en: "our senior rates" };
        return { fr: "", en: "" };
      };

      const topic = detectInboundTopic(handoff.lastUserMessage + " " + handoff.handoffSummary);
      const hasTopic = topic.fr.length > 0;

      const agentName = vapiTenant?.id === "dubub" ? "SophIA" : "Sophie";
      const orgName = vapiTenant?.id === "dubub" ? "DUBUB" : "Club M.A.A.";

      let firstMessage: string;
      if (isFr) {
        if (name && hasTopic)
          firstMessage = `Bonjour ${name}. Ici ${agentName}, de ${orgName}. Je vois que vous aviez une question sur ${topic.fr}. Je suis là pour vous aider.`;
        else if (name)
          firstMessage = `Bonjour ${name}. Ici ${agentName}, de ${orgName}. J'ai votre demande devant moi. Je vous écoute.`;
        else if (hasTopic)
          firstMessage = `Bonjour. Ici ${agentName}, de ${orgName}. Je vois que vous vous intéressiez à ${topic.fr}. Je vous écoute.`;
        else
          firstMessage = `Bonjour. Ici ${agentName}, de ${orgName}. J'ai votre demande devant moi. Je vous écoute.`;
      } else {
        if (name && hasTopic)
          firstMessage = `Hello ${name}. This is ${agentName} at ${orgName}. I see you had a question about ${topic.en}. I'm here to help.`;
        else if (name)
          firstMessage = `Hello ${name}. This is ${agentName} at ${orgName}. I have your request right here. Go ahead.`;
        else if (hasTopic)
          firstMessage = `Hello. This is ${agentName} at ${orgName}. I see you were asking about ${topic.en}. How can I help?`;
        else
          firstMessage = `Hello. This is ${agentName} at ${orgName}. I have your request right here. Go ahead.`;
      }

      request.log.info({
        callId,
        matched: true,
        handoffSource: handoff.handoffSource,
        handoffSummary: handoff.handoffSummary.slice(0, 80),
        locale: handoff.locale,
      }, "VAPI assistant-request: matched inbound handoff");

      return reply.code(200).send({
        assistantId,
        assistantOverrides: {
          firstMessage,
          variableValues: {
            handoff_last_user_message: handoff.lastUserMessage,
            handoff_summary: handoff.handoffSummary,
            handoff_locale: handoff.locale,
            handoff_opening_line: firstMessage,
            caller_name: handoff.customerName ?? '',
            caller_phone: callerE164 ?? '',
          },
        },
      });
    }

    // No match — cold greeting, tenant-aware
    const coldAgentName = vapiTenant?.id === "dubub" ? "SophIA" : "Sophie";
    const coldOrgName = vapiTenant?.id === "dubub" ? "DUBUB" : "Club M.A.A.";
    const coldFirstMessage = `Bonjour. Ici ${coldAgentName}, de ${coldOrgName}. Comment puis-je vous aider ?`;

    request.log.info({ callId, matched: false, callerKnown: !!callerE164 }, "VAPI assistant-request: no match, cold greeting");

    return reply.code(200).send({
      assistantId,
      assistantOverrides: {
        firstMessage: coldFirstMessage,
        variableValues: {
          handoff_last_user_message: "",
          handoff_summary: "",
          handoff_locale: "fr",
          handoff_opening_line: coldFirstMessage,
          caller_name: "",
          caller_phone: callerE164 ?? "",
        },
      },
    });
  });

  app.post("/v1/tenants/:tenantId/chat", async (request, reply) => {
    const { tenantId } = request.params as TenantRouteParams;
    const body = (request.body ?? {}) as Partial<ChatRouteBody>;

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

    // Track whether this is a brand-new conversation (no prior conversationId from client).
    // resolveVapiFollowUp also assigns conversationId, so we must capture this before those calls.
    const isNewConversation = !conversationId;

    let tenantUuid: string | null = null;

    const getTenantUuid = async (): Promise<string> => {
      if (tenantUuid) {
        return tenantUuid;
      }

      const tenant = await findTenantByCode(tenantId);
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
    const hasExplicitPhoneIntent =
      !hasCallbackPayload && looksLikePhoneIntent(trimmedMessage, locale);

    const conversationHistory = await loadConversationHistory();

    const directCoreFactResponse = resolveDirectCoreFactResponse({
      tenantId,
      userMessage: trimmedMessage,
      locale,
    });

    const userName = typeof body.userName === "string" && body.userName.trim() ? body.userName.trim() : null;

    const chatRequest: MaaChatRequest = {
      userMessage: trimmedMessage,
      locale: locale ?? undefined,
      maxResults: body.maxResults,
      conversationHistory,
      userName: userName ?? undefined,
      tenantCode: tenantId,
    };

    const result =
      directCoreFactResponse ?? (await answerMaaChat(chatRequest));

    // Track OpenAI usage per tenant for admin cost reporting
    if (result.usage && !directCoreFactResponse) {
      recordOpenAiUsage(tenantId, result.usage.model, result.usage.inputTokens, result.usage.outputTokens);
    }

    let responseAssistantMessage =
      directCoreFactResponse != null
        ? result.assistantMessage
        : humanizeAssistantMessage(result.assistantMessage, locale);

    let responseFollowUpMode = hasExplicitPhoneIntent
      ? "vapi"
      : hasExplicitBookingIntent
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

    const vapi = {
      enabled: false,
      configured: false,
      source: null as "env" | "generated" | null,
      assistantId: null as string | null,
      publicKey: null as string | null,
      phoneNumber: null as string | null,
      handoffToken: null as string | null,
      handoffUrl: null as string | null,
      launchMode: null as VapiLaunchMode | null,
      buttonLabel: isFrenchLocale(locale)
        ? "Continuer par téléphone"
        : "Continue by phone",
      fallbackToCallback: true,
      summary: null as string | null,
      error: null as string | null,
    };

    const resolveVapiFollowUp = async (): Promise<void> => {
      const shouldForcePhoneContinuation = responseFollowUpMode === "vapi";

      if (!conversationId) {
        conversationId = newUuid();
      }

      const envAssistantId = toNullableTrimmedString(process.env.VAPI_ASSISTANT_ID);
      const envPublicKey = toNullableTrimmedString(process.env.VAPI_PUBLIC_KEY);
      const envPhoneNumber = toNullableTrimmedString(process.env.VAPI_PHONE_NUMBER);
      const envLaunchMode = toNullableTrimmedString(process.env.VAPI_LAUNCH_MODE);

      const effectiveAssistantId =
        envAssistantId ?? (isDryRunPersistence ? "test-vapi-assistant" : null);
      const effectivePublicKey =
        envPublicKey ?? (isDryRunPersistence ? "test-vapi-public-key" : null);
      const effectivePhoneNumber =
        envPhoneNumber ?? (isDryRunPersistence ? "+15145550100" : null);

      let effectiveLaunchMode: VapiLaunchMode | null = null;

      if (
        envLaunchMode === "web_call" ||
        envLaunchMode === "phone_number" ||
        envLaunchMode === "web_call_or_number"
      ) {
        effectiveLaunchMode = envLaunchMode;
      } else if (effectiveAssistantId && effectivePublicKey && effectivePhoneNumber) {
        effectiveLaunchMode = "web_call_or_number";
      } else if (effectiveAssistantId && effectivePublicKey) {
        effectiveLaunchMode = "web_call";
      } else if (effectivePhoneNumber) {
        effectiveLaunchMode = "phone_number";
      }

      if (!effectiveLaunchMode) {
        vapi.error =
          "Vapi is not configured. Expected VAPI_PHONE_NUMBER and/or VAPI_ASSISTANT_ID with VAPI_PUBLIC_KEY.";

        if (shouldForcePhoneContinuation) {
          responseAssistantMessage = buildVapiUnavailableMessage(
            locale,
            vapi.fallbackToCallback,
          );
          responseCitations = [];
        }

        return;
      }

      const recentTurns = buildVapiRecentTurns(conversationHistory, trimmedMessage);
      const summary = buildVapiHandoffSummary(locale, recentTurns, trimmedMessage);
      const handoffToken = newUuid();

      vapiHandoffStore.set(handoffToken, {
        tenantId,
        conversationId,
        locale,
        createdAt: now,
        assistantId: effectiveAssistantId,
        publicKey: effectivePublicKey,
        phoneNumber: effectivePhoneNumber,
        launchMode: effectiveLaunchMode,
        summary,
        lastUserMessage: trimmedMessage,
        recentTurns,
      });

      vapi.enabled = true;
      vapi.configured = true;
      vapi.source =
        envAssistantId || envPublicKey || envPhoneNumber ? "env" : "generated";
      vapi.assistantId = effectiveAssistantId;
      vapi.publicKey = effectivePublicKey;
      vapi.phoneNumber = effectivePhoneNumber;
      vapi.handoffToken = handoffToken;
      vapi.handoffUrl = "/v1/tenants/" + tenantId + "/vapi-handoffs/" + handoffToken;
      vapi.launchMode = effectiveLaunchMode;
      vapi.summary = summary;

      if (shouldForcePhoneContinuation) {
        responseAssistantMessage = buildVapiContinuationMessage(
          locale,
          vapi.fallbackToCallback,
        );
        responseCitations = [];
      }
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

      // For DUBUB: no Calendly configured — start conversational lead capture instead
      if (tenantId === "dubub") {
        responseAssistantMessage = isFrenchLocale(locale)
          ? "Avec plaisir ! Pour vous réserver un créneau de démo, j'ai besoin de quelques informations. Quel est votre prénom ?"
          : "Absolutely! To get your demo scheduled, I just need a couple of details. What's your first name?";
      } else {
        responseAssistantMessage = buildBookingUnavailableMessage(
          locale,
          booking.allowCallbackFallback,
        );
      }
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

        // Fire lead email even in dry-run (e.g. when NocoDB not configured)
        const notifyEmailDry = process.env.LEAD_NOTIFY_EMAIL ?? "";
        if (notifyEmailDry) {
          setImmediate(() => {
            sendLeadNotificationEmail({
              name: toNullableTrimmedString(body.callback?.name),
              phone: callbackPhone!,
              email: toNullableTrimmedString(body.callback?.email),
              preferredTime: preferredTimeText,
              locale: locale ?? "fr-CA",
              questionSummary: toNullableTrimmedString(body.callback?.questionSummary) ?? trimmedMessage,
              conversationId: conversationId ?? null,
              tenantName: "Club Sportif MAA",
              notifyEmail: notifyEmailDry,
            }).catch((err) => request.log.error({ err }, "Lead email (dry-run) failed"));
          });
        }

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
          conversation_uuid: conversationId!,
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

        // Fire lead notification email in background — do not block response
        const notifyEmail = process.env.LEAD_NOTIFY_EMAIL ?? "";
        if (notifyEmail) {
          setImmediate(() => {
            sendLeadNotificationEmail({
              name: toNullableTrimmedString(body.callback?.name),
              phone: callbackPhone!,
              email: toNullableTrimmedString(body.callback?.email),
              preferredTime: preferredTimeText,
              locale: locale ?? "fr-CA",
              questionSummary: toNullableTrimmedString(body.callback?.questionSummary) ?? trimmedMessage,
              conversationId: conversationId ?? null,
              tenantName: "Club Sportif MAA",
              notifyEmail,
            }).catch((err) => request.log.error({ err }, "Lead email failed"));
          });
        }
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

    await resolveVapiFollowUp();

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
        // Fire persistence in background — do not block the response
        const capturedConversationId = conversationId ?? newUuid();
        conversationId = capturedConversationId;
        persistence.saved = true; // optimistic — errors logged only
        if (hasCallbackPayload) callbackPersistence.saved = true; // optimistic

        setImmediate(() => {
          void (async () => {
            try {
              const resolvedTenantUuid = await getTenantUuid();

              if (isNewConversation) {
                await createConversation({
                  uuid: capturedConversationId,
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
                conversation_uuid: capturedConversationId,
                role: "user",
                content: trimmedMessage,
                locale,
              });

              await persistCallbackRequest();

              await createMessage({
                uuid: newUuid(),
                tenant_uuid: resolvedTenantUuid,
                conversation_uuid: capturedConversationId,
                role: "assistant",
                content: responseAssistantMessage,
                locale,
                source_refs_json: JSON.stringify(responseCitations),
                tool_calls_json: JSON.stringify({
                  follow_up_mode: responseFollowUpMode,
                  retrieval: result.retrieval,
                }),
              });

              await updateConversationOutcome({
                uuid: capturedConversationId,
                tenantUuid: resolvedTenantUuid,
                followUpMode: responseFollowUpMode,
                userMessage: trimmedMessage,
                assistantMessage: responseAssistantMessage,
                locale,
                now,
              });
            } catch (error) {
              request.log.error(
                { err: error, tenantId, conversationId: capturedConversationId },
                "Failed to persist chat turn (background)",
              );
            }
          })();
        });
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
      vapi,
    };
  });

  app.get("/v1/tenants/:tenantId/analytics", async (request, reply) => {
    const { tenantId } = request.params as TenantRouteParams;

    if (tenantId !== "maa") {
      return reply.code(404).send({ error: "tenant_not_supported" });
    }

    if (!isChatPersistenceConfigured()) {
      return reply.code(503).send({ error: "persistence_not_configured" });
    }

    const daysParam = (request.query as Record<string, string>).days;
    const days = Math.min(Math.max(parseInt(daysParam ?? "30", 10) || 30, 1), 90);

    try {
      const tenant = await findTenantByCode("maa");
      const conversations = await listConversationsForAnalytics(tenant.uuid, days);
      const total = conversations.length;

      const byDay: Record<string, number> = {};
      const byOutcome: Record<string, number> = { answered: 0, escalated: 0, callback: 0, booking: 0, phone: 0, unknown: 0 };
      const byLanguage: Record<string, number> = { fr: 0, en: 0 };
      let needsFollowupCount = 0;

      for (const conv of conversations) {
        const day = (conv.started_at ?? "").slice(0, 10);
        if (day) byDay[day] = (byDay[day] ?? 0) + 1;

        const outcome = conv.outcome ?? "unknown";
        byOutcome[outcome] = (byOutcome[outcome] ?? 0) + 1;

        const lang = conv.language ?? (conv.locale?.startsWith("fr") ? "fr" : "en");
        byLanguage[lang] = (byLanguage[lang] ?? 0) + 1;

        if (conv.needs_followup) needsFollowupCount += 1;
      }

      const dailySeries = Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, count]) => ({ date, count }));

      return {
        tenantId,
        period: { days, from: dailySeries[0]?.date ?? null, to: dailySeries[dailySeries.length - 1]?.date ?? null },
        totals: {
          conversations: total,
          needsFollowup: needsFollowupCount,
          needsFollowupRate: total > 0 ? Math.round((needsFollowupCount / total) * 100) : 0,
        },
        byOutcome,
        byLanguage,
        languageSplit: {
          frPct: total > 0 ? Math.round(((byLanguage.fr ?? 0) / total) * 100) : 0,
          enPct: total > 0 ? Math.round(((byLanguage.en ?? 0) / total) * 100) : 0,
        },
        dailySeries,
      };
    } catch (error) {
      request.log.error({ err: error }, "Analytics query failed");
      return reply.code(500).send({ error: "analytics_failed" });
    }
  });

  app.get("/v1/tenants/:tenantId/popular-questions", async (request, reply) => {
    const { tenantId } = request.params as TenantRouteParams;

    if (tenantId !== "maa") {
      return reply.code(404).send({ error: "tenant_not_supported" });
    }

    const daysParam = (request.query as Record<string, string>).days;
    const days = Math.min(Math.max(parseInt(daysParam ?? "30", 10) || 30, 1), 90);

    // Static fallbacks used when no message history yet or persistence not configured
    const staticFallbacksFr = [
      "Quels sont vos tarifs d'abonnement ?",
      "C'est quoi les horaires de la piscine ?",
      "Offrez-vous des cours de pilates ?",
      "Comment réserver une visite ?",
      "Où êtes-vous situés ?",
    ];
    const staticFallbacksEn = [
      "What are your membership fees?",
      "What are your pool hours?",
      "Do you offer pilates classes?",
      "How do I book a tour?",
      "Where are you located?",
    ];

    if (!isChatPersistenceConfigured()) {
      return { tenantId, days, fr: staticFallbacksFr, en: staticFallbacksEn };
    }

    try {
      const tenant = await findTenantByCode("maa");
      const messages = await listRecentUserMessagesForTenant(tenant.uuid, days, 500);

      // Very short or single-word messages are noise (greetings, "ok", etc.)
      const meaningful = messages.filter((m) => (m.content ?? "").trim().split(/\s+/).length >= 4);

      // Bucket by rough topic using simple keyword matching
      const frMessages = meaningful.filter((m) => m.locale?.startsWith("fr") ?? false);
      const enMessages = meaningful.filter((m) => !(m.locale?.startsWith("fr") ?? false));

      function topN(msgs: typeof meaningful, n: number): string[] {
        // Deduplicate near-identical messages by normalizing
        const seen = new Map<string, { original: string; count: number }>();
        for (const m of msgs) {
          const key = (m.content ?? "")
            .toLowerCase()
            .replace(/[^a-zàâçéèêëîïôûùüÿœ0-9\s]/gi, "")
            .replace(/\s+/g, " ")
            .trim()
            .slice(0, 80);
          if (!key) continue;
          const existing = seen.get(key);
          if (existing) {
            existing.count += 1;
          } else {
            seen.set(key, { original: (m.content ?? "").trim(), count: 1 });
          }
        }
        return [...seen.values()]
          .sort((a, b) => b.count - a.count)
          .slice(0, n)
          .map((v) => v.original);
      }

      const topFr = topN(frMessages, 5);
      const topEn = topN(enMessages, 5);

      return {
        tenantId,
        days,
        fr: topFr.length >= 3 ? topFr : staticFallbacksFr,
        en: topEn.length >= 3 ? topEn : staticFallbacksEn,
      };
    } catch {
      return { tenantId, days, fr: staticFallbacksFr, en: staticFallbacksEn };
    }
  });

  app.post("/v1/tenants/:tenantId/call-now", async (request, reply) => {
    const { tenantId } = request.params as TenantRouteParams;

    const body = (request.body ?? {}) as {
      phone?: string;
      name?: string;
      email?: string;
      preferredTimeText?: string;
      locale?: string;
      conversationId?: string;
      questionSummary?: string;
      chatSummary?: string;
      handoffSource?: string;
      dryRunPersistence?: boolean;
    };

    const callNowTenant = getTenant(tenantId);
    if (!callNowTenant) {
      return reply.code(404).send({
        error: "tenant_not_found",
        message: `Tenant not found: ${tenantId}`,
      });
    }

    const locale = toNullableTrimmedString(body.locale);
    const rawPhone = toNullableTrimmedString(body.phone);
    const name = toNullableTrimmedString(body.name);
    const email = toNullableTrimmedString(body.email);
    const preferredTimeText = toNullableTrimmedString(body.preferredTimeText);
    const questionSummary = toNullableTrimmedString(body.questionSummary);
    const chatSummary = toNullableTrimmedString(body.chatSummary);
    const handoffSource = toNullableTrimmedString(body.handoffSource) ?? "web_call_now";

    const normalizeNorthAmericanPhone = (value: string | null): string | null => {
      if (!value) {
        return null;
      }

      const digits = value.replace(/\D/g, "");

      if (digits.length === 11 && digits.startsWith("1")) {
        return `+${digits}`;
      }

      if (digits.length === 10) {
        return `+1${digits}`;
      }

      if (value.startsWith("+") && digits.length >= 10) {
        return `+${digits}`;
      }

      return null;
    };

    const normalizedPhone = normalizeNorthAmericanPhone(rawPhone);

    if (!normalizedPhone) {
      return reply.code(400).send({
        error: "invalid_phone_number",
        message: isFrenchLocale(locale)
          ? "Un numéro de téléphone valide est requis."
          : "A valid phone number is required.",
      });
    }

    const isDryRun = body.dryRunPersistence === true;

    const assistantId = callNowTenant.vapiAssistantId
      ?? toNullableTrimmedString(process.env.VAPI_ASSISTANT_ID);
    const phoneNumberId = callNowTenant.vapiPhoneNumberId
      ?? toNullableTrimmedString(process.env.VAPI_OUTBOUND_PHONE_NUMBER_ID);
    const apiKey = toNullableTrimmedString(process.env.VAPI_API_KEY);

    const resolvedQuestionSummary =
      questionSummary ??
      (isFrenchLocale(locale)
        ? "Demande de rappel depuis le site web."
        : "Callback request from the website.");

    // ── Handoff helpers ───────────────────────────────────────────────────

    const cleanCustomerName = (raw?: string | null): string => {
      if (!raw) return "";
      return raw.trim().replace(/\s+/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
    };

    const detectHandoffTopic = (message?: string | null): { fr: string; en: string } => {
      const m = (message ?? "").toLowerCase();
      if (m.includes("tarif") || m.includes("prix") || m.includes("abonnement") || m.includes("cost") || m.includes("price") || m.includes("membership"))
        return { fr: "nos tarifs", en: "our pricing" };
      if (m.includes("piscine") || m.includes("pool") || m.includes("nage") || m.includes("swim"))
        return { fr: "la piscine", en: "the pool" };
      if (m.includes("cours") || m.includes("classe") || m.includes("yoga") || m.includes("pilates") || m.includes("spinning") || m.includes("class") || m.includes("groupe"))
        return { fr: "nos cours", en: "our classes" };
      if (m.includes("horaire") || m.includes("heure") || m.includes("ouvert") || m.includes("schedule") || m.includes("hours") || m.includes("open"))
        return { fr: "nos horaires", en: "our hours" };
      if (m.includes("spa") || m.includes("sauna") || m.includes("hammam") || m.includes("steam"))
        return { fr: "le spa", en: "the spa" };
      if (m.includes("visite") || m.includes("tour") || m.includes("rendez-vous") || m.includes("appointment"))
        return { fr: "une visite", en: "a visit" };
      if (m.includes("squash"))
        return { fr: "les courts de squash", en: "squash courts" };
      if (m.includes("personne") || m.includes("humain") || m.includes("quelqu'un") || m.includes("someone") || m.includes("human"))
        return { fr: "parler à quelqu'un", en: "speaking with someone" };
      return { fr: "votre question", en: "your question" };
    };

    const callNowAgentName = callNowTenant.id === "dubub" ? "SophIA" : "Sophie";
    const callNowOrgName = callNowTenant.id === "dubub" ? "DUBUB" : "Club M.A.A.";

    const buildOpeningLine = (): string => {
      const cleanedName = cleanCustomerName(name);
      const topic = detectHandoffTopic(questionSummary);
      const isEn = !isFrenchLocale(locale);
      if (isEn) {
        return cleanedName
          ? `Hello ${cleanedName}, this is ${callNowAgentName} from ${callNowOrgName}. You had a question about ${topic.en}?`
          : `Hello, this is ${callNowAgentName} from ${callNowOrgName}. You had a question about ${topic.en}?`;
      }
      return cleanedName
        ? `Bonjour ${cleanedName}, ici ${callNowAgentName} de ${callNowOrgName}. Vous aviez une question sur ${topic.fr}?`
        : `Bonjour, ici ${callNowAgentName} de ${callNowOrgName}. Vous aviez une question sur ${topic.fr}?`;
    };

    const BANNED_SUMMARY_PHRASES = [
      "nous vous appelons maintenant",
      "on vous appelle maintenant",
      "we are calling you now",
      "parfait, nous vous appelons",
      "calling you now",
      "appel en cours",
    ];

    const summarizeFromMessage = (message: string | null): string => {
      const m = (message ?? "").toLowerCase();
      const org = callNowTenant.name;
      if (m.includes("tarif") || m.includes("prix") || m.includes("abonnement") || m.includes("plan"))
        return `La personne veut connaître les tarifs de ${org}.`;
      if (m.includes("demo") || m.includes("démo") || m.includes("démonstration"))
        return `La personne souhaite une démonstration de ${org}.`;
      if (m.includes("piscine") || m.includes("pool"))
        return `La personne veut savoir si ${org} possède une piscine.`;
      if (m.includes("cours") || m.includes("classe") || m.includes("yoga") || m.includes("pilates"))
        return `La personne veut de l'information sur les cours de ${org}.`;
      if (m.includes("horaire") || m.includes("heure") || m.includes("ouvert"))
        return `La personne veut connaître les horaires de ${org}.`;
      if (m.includes("spa") || m.includes("sauna"))
        return `La personne veut de l'information sur le spa de ${org}.`;
      if (m.includes("personne") || m.includes("humain") || m.includes("quelqu'un"))
        return "La personne souhaite parler avec quelqu'un de l'équipe.";
      if (message) return `La personne a demandé: ${message}`;
      return "La personne a demandé un appel depuis le site web.";
    };

    const cleanHandoffSummary = (raw?: string | null): string => {
      // For call-now handoffs, never trust the raw chat summary — it contains assistant
      // upsell messages, bot status lines, and partial conversation noise. Generate a
      // clean deterministic summary purely from the last user question.
      if (handoffSource === "web_call_now") {
        return summarizeFromMessage(questionSummary);
      }
      const lines = (raw ?? "")
        .split(/[|\n]/)
        .map((l) => l.trim())
        .filter(Boolean)
        .filter((l) => !BANNED_SUMMARY_PHRASES.some((b) => l.toLowerCase().includes(b)))
        .filter((l) => !l.toLowerCase().startsWith("assistant:"));
      if (lines.length === 0) return summarizeFromMessage(questionSummary);
      return lines.slice(-2).join(" ");
    };

    const cleanedSummary = cleanHandoffSummary(chatSummary ?? questionSummary);
    const openingLine = buildOpeningLine();

    request.log.info(
      {
        handoff_last_user_message: questionSummary,
        handoff_summary_cleaned: cleanedSummary,
        handoff_opening_line: openingLine,
        handoff_locale: locale,
        customer_name: cleanCustomerName(name),
      },
      "VAPI outbound call payload",
    );

    // Inject the web chat context as a silent system message so the AI knows what was discussed
    // without speaking it aloud (which Deepgram would transcribe back with errors).
    if (!assistantId || !phoneNumberId || !apiKey) {
      if (isDryRun) {
        return {
          ok: true,
          queued: true,
          provider: "vapi",
          requestId: newUuid(),
          message: isFrenchLocale(locale)
            ? `Parfait, nous vous appellerons bientôt au ${normalizedPhone}.`
            : `Perfect, we will call you shortly at ${normalizedPhone}.`,
          dryRun: true,
        };
      }

      return reply.code(500).send({
        error: "call_now_not_configured",
        message: isFrenchLocale(locale)
          ? "L'option d'appel immédiat n'est pas configurée."
          : "The call now option is not configured.",
      });
    }

    try {
      const vapiResponse = await fetch("https://api.vapi.ai/call/phone", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          assistantId,
          phoneNumberId,
          assistantOverrides: {
            firstMessage: openingLine,
            startSpeakingPlan: {
              waitSeconds: 0.1,
            },
            variableValues: {
              customer_name: cleanCustomerName(name),
              customer_phone: normalizedPhone,
              customer_email: email ?? "",
              callback_preferred_time: preferredTimeText ?? "",
              callback_reason: resolvedQuestionSummary,
              handoff_summary: cleanedSummary,
              handoff_last_user_message: questionSummary ?? "",
              handoff_locale: locale ?? "",
              handoff_source: handoffSource,
              handoff_opening_line: openingLine,
            },
          },
          customer: {
            number: normalizedPhone,
            numberE164CheckEnabled: false,
          },
        }),
      });

      if (!vapiResponse.ok) {
        const errorText = await vapiResponse.text();

        request.log.error(
          {
            tenantId,
            normalizedPhone,
            status: vapiResponse.status,
            errorText,
          },
          "Failed to create outbound Vapi call",
        );

        return reply.code(502).send({
          error: "call_now_failed",
          message: isFrenchLocale(locale)
            ? "Nous n'avons pas pu démarrer l'appel immédiatement."
            : "We could not start the call immediately.",
        });
      }

      const payload = (await vapiResponse.json()) as { id?: string };

      return {
        ok: true,
        queued: true,
        provider: "vapi",
        requestId: payload.id ?? newUuid(),
        message: isFrenchLocale(locale)
          ? `Parfait, nous vous appelons maintenant au ${normalizedPhone}.`
          : `Perfect, we are calling you now at ${normalizedPhone}.`,
        dryRun: false,
      };
    } catch (error) {
      request.log.error(
        {
          err: error,
          tenantId,
          normalizedPhone,
        },
        "Unexpected error while creating outbound Vapi call",
      );

      return reply.code(500).send({
        error: "call_now_failed",
        message: isFrenchLocale(locale)
          ? "Nous n'avons pas pu démarrer l'appel immédiatement."
          : "We could not start the call immediately.",
      });
    }
  });

  // ─── AI Feedback / Quality review ────────────────────────────────────────────
  // In-memory store — persists for the lifetime of the process.
  // For production: replace with NocoDB writes when NOCODB_TABLE_AI_FEEDBACK is set.
  interface FeedbackRecord {
    id: string;
    tenantId: string;
    conversationId: string | null;
    userMessage: string;
    aiResponse: string;
    verdict: "correct" | "incorrect" | "custom";
    correctedResponse: string | null;
    aiAlternatives: string[];
    reviewedAt: string;
  }
  const feedbackStore: FeedbackRecord[] = [];

  app.get("/v1/tenants/:tenantId/recent-conversations", async (request, reply) => {
    const { tenantId } = request.params as TenantRouteParams;
    if (tenantId !== "maa") return reply.code(404).send({ error: "tenant_not_supported" });

    if (!isChatPersistenceConfigured()) {
      return reply.code(503).send({ error: "persistence_not_configured" });
    }

    try {
      const tenant = await findTenantByCode("maa");
      const conversations = await listConversationsForAnalytics(tenant.uuid, 7);
      const recent = conversations.slice(0, 20);

      const withMessages = await Promise.all(
        recent.map(async (conv) => {
          try {
            const msgs = await listMessagesByConversationUuid(conv.uuid ?? "", 6);
            return { ...conv, messages: msgs };
          } catch {
            return { ...conv, messages: [] };
          }
        }),
      );

      return { tenantId, conversations: withMessages };
    } catch (error) {
      request.log.error({ err: error }, "Recent conversations query failed");
      return reply.code(500).send({ error: "query_failed" });
    }
  });

  app.post("/v1/tenants/:tenantId/feedback", async (request, reply) => {
    const { tenantId } = request.params as TenantRouteParams;
    if (tenantId !== "maa") return reply.code(404).send({ error: "tenant_not_supported" });

    const body = (request.body ?? {}) as {
      conversationId?: string;
      userMessage?: string;
      aiResponse?: string;
      verdict?: "correct" | "incorrect" | "custom";
      correctedResponse?: string;
    };

    if (!body.verdict || !body.userMessage || !body.aiResponse) {
      return reply.code(400).send({ error: "verdict, userMessage and aiResponse are required" });
    }

    let aiAlternatives: string[] = [];

    // When verdict is incorrect and no custom correction, generate 2 AI alternatives
    if (body.verdict === "incorrect" && !body.correctedResponse) {
      try {
        const { generateAlternatives } = await import("./services/maa-chat.js");
        aiAlternatives = await generateAlternatives(body.userMessage, body.aiResponse);
      } catch {
        aiAlternatives = [];
      }
    }

    const record: FeedbackRecord = {
      id: newUuid(),
      tenantId,
      conversationId: body.conversationId ?? null,
      userMessage: body.userMessage,
      aiResponse: body.aiResponse,
      verdict: body.verdict,
      correctedResponse: body.correctedResponse ?? null,
      aiAlternatives,
      reviewedAt: new Date().toISOString(),
    };

    feedbackStore.push(record);
    if (feedbackStore.length > 500) feedbackStore.splice(0, feedbackStore.length - 500);

    return { ok: true, id: record.id, aiAlternatives };
  });

  app.get("/v1/tenants/:tenantId/feedback", async (request, reply) => {
    const { tenantId } = request.params as TenantRouteParams;
    if (tenantId !== "maa") return reply.code(404).send({ error: "tenant_not_supported" });
    return { tenantId, feedback: feedbackStore.slice().reverse().slice(0, 100) };
  });

  // ─── VAPI tool-call webhook ──────────────────────────────────────────────────
  // VAPI calls this endpoint when the phone AI invokes the "lookup_maa_info" tool.
  // The tool gives the phone AI access to the full MAA knowledge base, so it can
  // answer any question the chat system can answer.
  // Fast deterministic answers for the most common phone questions — no AI call needed
  function vapiQuickAnswer(question: string, locale: string): string | null {
    const q = question.toLowerCase();
    const fr = isFrenchLocale(locale);

    if (/adresse|address|located|where are you|où êtes-vous|où vous trouve/.test(q))
      return fr
        ? "Nous sommes au 2070, rue Peel, au centre-ville de Montréal, à 5 minutes à pied de la station de métro Peel."
        : "We are at 2070 Peel Street in downtown Montreal, a 5-minute walk from Peel metro station.";

    if (/téléphone|phone number|numéro|comment vous joindre|how to reach|call you/.test(q))
      return fr
        ? "Vous pouvez nous joindre au 514 845-2233, poste 234."
        : "You can reach us at (514) 845-2233, extension 234.";

    if (/fondé|fondée|founded|depuis quand|how old|1881|history|histoire|heritage/.test(q))
      return fr
        ? "Le Club Sportif MAA a été fondé en 1881. C'est l'un des clubs sportifs les plus anciens et les plus prestigieux de Montréal."
        : "Club Sportif MAA was founded in 1881, making it one of Montreal's oldest and most prestigious athletic clubs.";

    if (/(club|gym|fitness|entraînement|what do you offer|qu'est-ce que vous offrez|services?)$/.test(q) || /what is (the )?club|c'est quoi le club/.test(q))
      return fr
        ? "Le Club Sportif MAA offre l'entraînement, une piscine intérieure de 25 mètres, des cours de groupe, le squash, le spa, la massothérapie, la physiothérapie et le restaurant Le 1881."
        : "Club Sportif MAA offers fitness training, a 25m indoor pool, group classes, squash, a spa, massage therapy, physiotherapy, and restaurant Le 1881.";

    if (/heure(s)? (d[''])?ouverture|opening hours|what time do you open|when do you open|ouvrez/.test(q) && !/piscine|pool|spa|squash/.test(q))
      return fr
        ? "Le club est ouvert du lundi au vendredi de 6h à 22h, et les fins de semaine de 7h à 19h. La piscine et le spa ont des horaires différents."
        : "The club is open Monday to Friday from 6am to 10pm, and weekends from 7am to 7pm. The pool and spa have separate hours.";

    if (/piscine|pool/.test(q) && !/heure|horaire|ouvert|open|hours|schedule/.test(q))
      return fr
        ? "Oui, le Club Sportif MAA dispose d'une piscine intérieure de 25 mètres, incluse dans tous les abonnements. Elle est ouverte du lundi au vendredi de 7h à 20h, et les fins de semaine de 7h à 17h."
        : "Yes, Club Sportif MAA has a 25-metre indoor pool included with all memberships. It's open Monday to Friday from 7am to 8pm, and weekends from 7am to 5pm.";

    if (/piscine|pool/.test(q) && /heure|horaire|ouvert|open|hours|schedule/.test(q))
      return fr
        ? "La piscine est ouverte du lundi au vendredi de 7h à 20h, et les fins de semaine de 7h à 17h. Nous vous recommandons d'appeler pour confirmer."
        : "The pool is open Monday to Friday from 7am to 8pm, and weekends from 7am to 5pm. We recommend calling to confirm.";

    if (/spa/.test(q) && /heure|horaire|ouvert|open|hours|schedule/.test(q))
      return fr
        ? "Le spa est ouvert du lundi au vendredi de 9h à 19h, et les fins de semaine de 11h à 15h."
        : "The spa is open Monday to Friday from 9am to 7pm, and weekends from 11am to 3pm.";

    if (/pilates/.test(q))
      return fr
        ? "Nous offrons des cours de Pilates sur appareils dans un studio dédié — reformers, chaises et tables trapézoïdales. Les cours sont en petits groupes de 4 personnes maximum, tous niveaux, avec 8 à 10 séances par semaine."
        : "We offer equipment-based Pilates in a dedicated studio with reformers, chairs and trapeze tables. Classes run in groups of up to 4, all levels welcome, with 8 to 10 sessions per week.";

    if (/yoga/.test(q))
      return fr
        ? "Nous offrons des cours de yoga dans notre studio de cours de groupe. Consultez notre horaire en ligne ou appelez le 514 845-2233 pour les créneaux disponibles."
        : "We offer yoga classes in our group class studio. Check our schedule online or call (514) 845-2233 for available times.";

    if (/cours|classes|groupe|group|zumba|spinning|aqua/.test(q) && !/horaire|schedule|heure|hour/.test(q))
      return fr
        ? "Nous offrons plus de 50 cours de groupe par semaine : Pilates, yoga, Zumba, aquaforme, spinning, et plus encore. Tous niveaux bienvenus. Appelez le 514 845-2233 pour l'horaire complet."
        : "We offer over 50 group classes per week: Pilates, yoga, Zumba, aqua fitness, spinning, and more. All levels welcome. Call (514) 845-2233 for the full schedule.";

    if (/prix|tarif|abonnement|combien|membership|pricing|fee|cost|coute|coûte/.test(q))
      return fr
        ? "Nos abonnements annuels sont à 225 dollars par mois. Le tarif senior, pour 70 ans et plus, est de 185 dollars par mois. L'abonnement étudiant, pour 25 ans et moins, est de 195 dollars par mois. L'abonnement mensuel sans engagement est de 295 dollars par mois. Les frais d'initiation sont présentement offerts gratuitement. Les tarifs peuvent changer — nous vous recommandons d'appeler le 514 845-2233, poste 234 pour confirmer."
        : "Our annual membership is $225 per month. The senior rate, for ages 70 and up, is $185 per month. The student rate, for ages 25 and under, is $195 per month. Month-to-month is $295 per month. There is currently no initiation fee. Rates may change — we recommend calling (514) 845-2233, extension 234 to confirm.";

    return null; // No quick answer — fall through to full AI
  }

  app.post("/v1/vapi/tool", async (request, reply) => {
    type ToolCall = { id: string; function: { name: string; arguments: string | Record<string, unknown> } };
    const body = request.body as {
      message?: { toolCallList?: ToolCall[] };
      toolCallList?: ToolCall[];
      // VAPI also sends flat params directly when tool is called
      question?: string;
      locale?: string;
    };

    // Log full body so we can diagnose format mismatches
    request.log.info({ vapiToolBody: JSON.stringify(body).slice(0, 1000) }, "VAPI tool call received");

    // Flat direct call (VAPI UI-built function tools send params at root level)
    if (!body?.message?.toolCallList && !body?.toolCallList && body?.question) {
      const question = body.question ?? "";
      const locale = (body.locale as "fr-CA" | "en-CA" | undefined) ?? "fr-CA";
      const quick = vapiQuickAnswer(question, locale);
      if (quick) return reply.send({ result: quick });
      try {
        const chatResponse = await answerMaaChat({ userMessage: question, locale, maxResults: 5, conversationHistory: [] });
        const answer = chatResponse.assistantMessage.replace(/\n\n+/g, " ").replace(/\n/g, " ").replace(/[•◆\-\*] /g, "").trim().slice(0, 350);
        return reply.send({ result: answer });
      } catch {
        return reply.send({ result: locale === "fr-CA" ? "Je n'ai pas pu trouver l'information. Je vous suggère d'appeler le 514 845-2233, poste 234." : "I couldn't retrieve that. Please call (514) 845-2233, ext. 234." });
      }
    }

    const toolCalls = body?.message?.toolCallList ?? body?.toolCallList ?? [];
    if (!toolCalls.length) return reply.code(400).send({ error: "no_tool_calls" });

    const results: { toolCallId: string; result: string }[] = [];

    for (const call of toolCalls) {
      // capture_lead — called when Sophie collects contact info on the phone
      if (call.function.name === "capture_lead") {
        let args: { name?: string; phone?: string; email?: string; note?: string; locale?: string } = {};
        try {
          args = typeof call.function.arguments === "string"
            ? JSON.parse(call.function.arguments)
            : (call.function.arguments as typeof args);
        } catch { /* ok */ }

        const notifyEmail = process.env.LEAD_NOTIFY_EMAIL ?? "steve@dubub.com";
        const apiKey = process.env.BREVO_API_KEY ?? process.env.BREVO_SMTP_KEY;
        const isFr = !args.locale?.startsWith("en");

        request.log.info({ name: args.name, phone: args.phone, email: args.email, note: args.note, notifyEmail }, "capture_lead fired");

        if (!apiKey) {
          request.log.error("capture_lead: BREVO_API_KEY is missing — lead email NOT sent. Set LEAD_NOTIFY_EMAIL and BREVO_API_KEY in .env.local");
        }

        if (apiKey && (args.name || args.phone || args.email)) {
          const time = new Date().toLocaleString("fr-CA", { timeZone: "America/Montreal", dateStyle: "full", timeStyle: "short" });
          const initial = (args.name ?? "?").charAt(0).toUpperCase();
          const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Nouveau lead — Sophie</title></head>
<body style="margin:0;padding:0;background:#0d0d14;font-family:Inter,Arial,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:32px 16px">

  <!-- Header -->
  <div style="background:linear-gradient(135deg,#0e1015,#1a1a2a);border-radius:16px 16px 0 0;padding:32px 36px;border:1px solid rgba(201,168,76,0.2);border-bottom:none">
    <div style="display:inline-block;background:linear-gradient(135deg,#c9a84c,#8b6010);border-radius:8px;padding:5px 12px;font-weight:800;font-size:13px;color:#111;letter-spacing:0.08em;margin-bottom:16px">DUBUB</div>
    <div style="display:flex;align-items:center;gap:14px">
      <div style="width:52px;height:52px;border-radius:50%;background:linear-gradient(135deg,#c9a84c,#8b6010);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:800;color:#111;flex-shrink:0">${initial}</div>
      <div>
        <div style="color:#fff;font-size:22px;font-weight:800;line-height:1.2">${args.name ?? "Nouveau contact"}</div>
        <div style="color:rgba(201,168,76,0.8);font-size:12px;margin-top:4px;letter-spacing:0.06em;text-transform:uppercase">Lead capturé par Sophie · Club M.A.A.</div>
      </div>
    </div>
  </div>

  <!-- Contact info -->
  <div style="background:#fff;padding:32px 36px;border-left:1px solid #e8eaed;border-right:1px solid #e8eaed">
    <div style="display:grid;gap:0">
      ${args.phone ? `
      <div style="padding:16px 0;border-bottom:1px solid #f0f2f5">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#999;margin-bottom:6px">📞 Téléphone</div>
        <a href="tel:${args.phone}" style="font-size:26px;font-weight:800;color:#111116;text-decoration:none;letter-spacing:0.03em">${args.phone}</a>
      </div>` : ""}
      ${args.email ? `
      <div style="padding:16px 0;border-bottom:1px solid #f0f2f5">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#999;margin-bottom:6px">✉️ Courriel</div>
        <a href="mailto:${args.email}" style="font-size:16px;font-weight:600;color:#111;text-decoration:none">${args.email}</a>
      </div>` : ""}
      ${args.note ? `
      <div style="padding:16px 0;border-bottom:1px solid #f0f2f5">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#999;margin-bottom:6px">💬 Intérêt exprimé</div>
        <div style="font-size:14px;color:#444;line-height:1.6;background:#fafbfc;border-left:3px solid #c9a84c;padding:12px 14px;border-radius:0 8px 8px 0">${args.note}</div>
      </div>` : ""}
      <div style="padding:16px 0">
        <div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#999;margin-bottom:6px">⏱️ Capturé le</div>
        <div style="font-size:13px;color:#555">${time}</div>
        <div style="font-size:11px;color:#aaa;margin-top:3px">Via appel entrant · Concierge Sophie (VAPI)</div>
      </div>
    </div>
  </div>

  <!-- CTA -->
  <div style="background:linear-gradient(135deg,#c9a84c,#8b6010);padding:20px 36px;border-radius:0 0 16px 16px;text-align:center">
    ${args.phone ? `<a href="tel:${args.phone}" style="display:inline-block;background:#111116;color:#c9a84c;font-weight:800;font-size:14px;padding:12px 28px;border-radius:100px;text-decoration:none;letter-spacing:0.04em">Rappeler maintenant →</a>` : ""}
    <div style="color:rgba(0,0,0,0.5);font-size:11px;margin-top:10px">Géré par DUBUB · dubub.ca</div>
  </div>

</div>
</body></html>`;

          await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: { "api-key": apiKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              sender: { name: "Sophie — Club M.A.A.", email: process.env.BREVO_SENDER_EMAIL ?? "noreply@dubub.com" },
              to: [{ email: notifyEmail }],
              subject: `🎯 Nouveau lead — ${args.name ?? args.phone ?? "Contact"} · Club M.A.A.`,
              htmlContent: html,
            }),
          }).then(async (r) => {
            if (!r.ok) {
              const body = await r.text().catch(() => "");
              request.log.error({ status: r.status, body }, "capture_lead email send failed — Brevo rejected");
            } else {
              request.log.info({ notifyEmail }, "capture_lead email sent OK");
            }
          }).catch((e: unknown) => request.log.error({ err: e }, "capture_lead email network error"));
        }

        // Persist to NocoDB callback_requests (non-fatal)
        if (isCallbackPersistenceConfigured() && (args.name || args.phone || args.email)) {
          findTenantByCode("maa").then((tenant) => {
            return createCallbackRequest({
              uuid: newUuid(),
              tenant_uuid: tenant.uuid,
              locale: args.locale ?? "fr-CA",
              name: args.name ?? null,
              phone: args.phone ?? "—",
              email: args.email ?? null,
              question_summary: args.note ?? null,
              status: "new",
              consent_to_contact: true,
              brevo_confirmation_sent: true,
              crm_record_id: null,
              created_at: new Date().toISOString(),
            });
          }).catch((e: unknown) => request.log.warn({ err: e }, "capture_lead NocoDB persist failed"));
        }

        const confirmation = isFr
          ? "Parfait. J'ai bien noté vos coordonnées et je les transmets à l'équipe du club. Quelqu'un vous contactera très prochainement."
          : "Perfect. I've noted your contact information and I'm passing it to the club team. Someone will reach out to you very soon.";
        results.push({ toolCallId: call.id, result: confirmation });
        continue;
      }

      if (call.function.name !== "lookup_maa_info") {
        results.push({ toolCallId: call.id, result: "Unknown tool." });
        continue;
      }

      let args: { question?: string; locale?: string } = {};
      try {
        args = typeof call.function.arguments === "string"
          ? JSON.parse(call.function.arguments)
          : (call.function.arguments as { question?: string; locale?: string });
      } catch { /* ok */ }

      const question = args.question ?? "";
      const locale = (args.locale as "fr-CA" | "en-CA" | undefined) ?? "fr-CA";

      if (!question.trim()) {
        results.push({ toolCallId: call.id, result: "No question provided." });
        continue;
      }

      const quickAnswer = vapiQuickAnswer(question, locale);
      if (quickAnswer) {
        results.push({ toolCallId: call.id, result: quickAnswer });
        continue;
      }

      try {
        const chatResponse = await answerMaaChat({
          userMessage: question,
          locale,
          maxResults: 5,
          conversationHistory: [],
        });

        // Trim to phone-friendly length (no markdown, no citations)
        const answer = chatResponse.assistantMessage
          .replace(/\n\n+/g, " ")
          .replace(/\n/g, " ")
          .replace(/[•\-\*] /g, "")
          .trim()
          .slice(0, 400);

        results.push({ toolCallId: call.id, result: answer });
      } catch (err) {
        request.log.error({ err }, "VAPI tool lookup failed");
        results.push({
          toolCallId: call.id,
          result: locale === "fr-CA"
            ? "Je n'ai pas pu trouver l'information. Je vous suggère d'appeler le 514 845-2233, poste 234."
            : "I couldn't retrieve that information. I suggest calling (514) 845-2233, ext. 234.",
        });
      }
    }

    return reply.send({ results });
  });

  // Custom LLM proxy for VAPI — VAPI appends /chat/completions to the URL, so register both paths
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function vapiLlmHandler(request: any, reply: any) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return reply.code(500).send({ error: "OPENAI_API_KEY not set" });
    }

    const body = request.body as {
      messages?: { role: string; content: string }[];
      model?: string;
      temperature?: number;
      max_tokens?: number;
      stream?: boolean;
    };

    const messages = body.messages ?? [];
    const temperature = body.temperature ?? 0.3;
    const max_tokens = body.max_tokens ?? 500;

    // Detect locale from system prompt to pick the right filler
    const systemContent = messages.find(m => m.role === "system")?.content ?? "";
    const isEnglish = systemContent.includes("locale detected: en") ||
      (messages[messages.length - 1]?.content ?? "").match(/^(hi|hello|yes|ok|sure|what|how|when|where|do you|is there|can you)/i) !== null;
    const fillers = isEnglish
      ? ["Sure, ", "Absolutely, ", "Of course, "]
      : ["Oui, ", "Bien sûr, ", "Absolument, ", "Tout à fait, "];
    const filler = fillers[Math.floor(Math.random() * fillers.length)];

    const callId = `chatcmpl-${Date.now()}`;

    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");

    // Emit filler immediately — ElevenLabs starts TTS within ~500ms
    const fillerChunk = {
      id: callId,
      object: "chat.completion.chunk",
      choices: [{ index: 0, delta: { role: "assistant", content: filler }, finish_reason: null }],
    };
    reply.raw.write(`data: ${JSON.stringify(fillerChunk)}\n\n`);

    try {
      const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          temperature,
          max_tokens,
          stream: true,
        }),
      });

      if (!upstream.ok || !upstream.body) {
        reply.raw.write(`data: [DONE]\n\n`);
        reply.raw.end();
        return;
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            reply.raw.write(line + "\n\n");
          }
        }
      }
    } catch (err) {
      request.log.error({ err }, "VAPI custom LLM upstream error");
    }

    reply.raw.write("data: [DONE]\n\n");
    reply.raw.end();
  }

  app.post("/v1/vapi/llm", vapiLlmHandler);
  app.post("/v1/vapi/llm/chat/completions", vapiLlmHandler);

  // Embed snippet endpoint — returns ready-to-install HTML/JS for the client's website
  app.get("/v1/tenants/:tenantId/embed-snippet", async (request, reply) => {
    const { tenantId } = request.params as TenantRouteParams;
    if (tenantId !== "maa") return reply.code(404).send({ error: "tenant_not_found" });

    const widgetOrigin = process.env.WIDGET_ORIGIN ?? "https://concierge.dubub.ai";

    const snippet = `<!-- DUBUB Concierge Widget — Club Sportif MAA -->
<script>
  (function() {
    var s = document.createElement('script');
    s.src = '${widgetOrigin}/embed.js';
    s.setAttribute('data-tenant', 'maa');
    s.setAttribute('data-accent', '#c9a84c');
    s.defer = true;
    document.head.appendChild(s);
  })();
</script>
<!-- End DUBUB Concierge Widget -->`;

    const iframe = `<!-- DUBUB Concierge — iframe embed (alternative) -->
<iframe
  src="${widgetOrigin}/embed/maa"
  style="position:fixed;bottom:0;right:0;width:420px;height:680px;border:none;z-index:9999;"
  allow="microphone"
  title="Concierge MAA"
></iframe>`;

    return reply.type("application/json").send({
      tenant: tenantId,
      widgetOrigin,
      snippet,
      iframeEmbed: iframe,
      instructions: [
        "Paste the snippet just before </body> on every page of your website.",
        "The widget loads asynchronously and will not affect page performance.",
        "For WordPress: paste into Appearance > Theme Editor > footer.php, or use a Header & Footer plugin.",
        "For Squarespace/Wix: use the custom code injection in site settings.",
        "The widget is fully bilingual (FR/EN) and adapts to the visitor's language automatically.",
        "Contact DUBUB to configure a custom domain, accent color, or white-label branding.",
      ],
    });
  });

  return app;
}
