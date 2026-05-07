import { z } from "zod";

/**
 * Body schema for POST /v1/tenants/:tenantId/chat — the live chat endpoint.
 * Mirrors the shape that server.ts has historically validated by hand.
 *
 * Owns the source-of-truth for what fields are accepted, their types, and which
 * are optional. Errors come back as a structured ZodError list so the API
 * returns precise, field-level 400s.
 */
export const ChatCallbackBodySchema = z.object({
  name: z.string().trim().optional(),
  phone: z.string().trim().min(1),
  email: z.string().trim().email().optional(),
  consentToContact: z.literal(true),
  preferredTime: z.string().trim().optional(),
  preferredTimeText: z.string().trim().optional(),
  questionSummary: z.string().trim().optional(),
});

export const TenantChatRouteBodySchema = z
  .object({
    message: z.string().trim().min(1, "message is required"),
    locale: z.string().trim().optional(),
    maxResults: z.number().int().positive().max(20).optional(),
    conversationId: z.string().trim().optional(),
    callback: ChatCallbackBodySchema.optional(),
    dryRunPersistence: z.boolean().optional(),
    userName: z.string().trim().optional(),
  })
  .strict();

export type TenantChatRouteBody = z.infer<typeof TenantChatRouteBodySchema>;
export type ChatCallbackBody = z.infer<typeof ChatCallbackBodySchema>;

/**
 * Schema for POST /v1/admin/onboarding (tenant wizard).
 * Validates the 7 prompt-config fields + tenant identity fields.
 */
export const OnboardingBodySchema = z
  .object({
    companyName: z.string().trim().min(1),
    contactEmail: z.string().trim().email(),
    contactName: z.string().trim().optional(),
    plan: z.enum(["essentiel", "croissance", "prestige", "autre"]).optional(),
    planLabel: z.string().trim().optional(),
    monthlyPriceCad: z.string().trim().optional(),
    implementationFee: z.string().trim().optional(),
    billingTerm: z.enum(["monthly", "annual"]).optional(),
    sendInvoice: z.boolean().optional(),

    // Prompt-config (all optional — `buildGenericTenantChatSystemPrompt` has defaults)
    conciergeName: z.string().trim().optional(),
    description: z.string().trim().optional(),
    industry: z.string().trim().optional(),
    primaryContactPhone: z.string().trim().optional(),
    tunnelCtaFr: z.string().trim().optional(),
    tunnelCtaEn: z.string().trim().optional(),
    defaultLanguage: z.enum(["fr", "en", "bilingual"]).optional(),

    // Tenant infrastructure
    notifyEmail: z.string().trim().optional(),
    vapiAssistantId: z.string().trim().optional(),
    vapiPhoneNumberId: z.string().trim().optional(),
    inboundPhoneNumber: z.string().trim().optional(),
    openAiModel: z.string().trim().optional(),
    addons: z.array(z.string()).optional(),
    website: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    locale: z.string().trim().optional(),
    address: z.string().trim().optional(),
    calendlyUrl: z.string().trim().optional(),
    crawlerEnabled: z.boolean().optional(),
    crawlerUrl: z.string().trim().optional(),
    uploadedPdfUrls: z.array(z.string()).optional(),
  })
  .passthrough(); // Accept extra fields for forward compatibility — wizard adds frequently.

export type OnboardingBody = z.infer<typeof OnboardingBodySchema>;

/**
 * Service-layer chat response shape (what answerMaaChat returns to the HTTP layer).
 * Used as a guard against drift between the service and HTTP serialization.
 */
export const ChatResponseSchema = z.object({
  sessionId: z.string().optional(),
  assistantMessage: z.string(),
  followUpMode: z.enum(["clarify", "calendly", "callback", "vapi", "done"]),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;
