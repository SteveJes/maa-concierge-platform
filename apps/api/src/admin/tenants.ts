/**
 * Tenant registry for the DUBUB admin dashboard.
 * Add a new entry here whenever a new client is onboarded.
 */

export interface TenantConfig {
  id: string;
  name: string;
  plan: "starter" | "professional" | "enterprise";
  status: "active" | "trial" | "suspended";
  since: string; // ISO date
  notifyEmail: string;
  vapiAssistantId: string | null;
  vapiPhoneNumberId: string | null;
  /** Human-readable E.164 inbound phone number shown to users (e.g. "+14385551234") */
  inboundPhoneNumber: string | null;
  openAiModel: string;
  monthlyPriceCad: number;
  addons: string[];
  contactName: string | null;
  contactEmail: string | null;
  website: string | null;
  notes: string | null;

  // ── Prompt configuration — used by the generic system prompt builder ──────
  /** Name of the AI concierge (e.g. "SophIA", "Maxime"). Defaults to "Concierge IA". */
  conciergeName?: string;
  /** Short description of the business (1-2 sentences for the AI's self-introduction). */
  description?: string;
  /** Business sector / industry (e.g. "fitness", "hospitality", "retail"). */
  industry?: string;
  /** Primary public contact phone number displayed to users. */
  primaryContactPhone?: string;
  /** Primary public contact email displayed to users. */
  primaryContactEmail?: string;
  /** Primary booking/demo CTA label in French. Injected into the anti-tunnel rule. */
  tunnelCtaFr?: string;
  /** Primary booking/demo CTA label in English. Injected into the anti-tunnel rule. */
  tunnelCtaEn?: string;
  /**
   * Default response language.
   * "fr" = French only, "en" = English only, "bilingual" = detect from user input.
   * Defaults to "bilingual".
   */
  defaultLanguage?: "fr" | "en" | "bilingual";
}

export const TENANT_REGISTRY: TenantConfig[] = [
  {
    id: "maa",
    name: "Club Sportif MAA",
    plan: "professional",
    status: "active",
    since: "2025-01-01",
    notifyEmail: "info@clubsportifmaa.com",
    vapiAssistantId: process.env.VAPI_ASSISTANT_ID ?? "ec272999-2782-4e57-9068-55a3bacd4915",
    vapiPhoneNumberId: process.env.VAPI_OUTBOUND_PHONE_NUMBER_ID ?? null,
    inboundPhoneNumber: process.env.VAPI_INBOUND_PHONE_NUMBER ?? process.env.VAPI_PHONE_NUMBER ?? null,
    openAiModel: "gpt-4o-mini",
    monthlyPriceCad: 955,
    addons: ["voice-concierge", "bilingual", "lead-capture", "analytics"],
    contactName: "Club Sportif MAA",
    contactEmail: "info@clubsportifmaa.com",
    website: "https://www.clubsportifmaa.com",
    notes: null,
  },
];

export function getTenant(id: string): TenantConfig | undefined {
  return TENANT_REGISTRY.find((t) => t.id === id);
}

export function addTenant(config: TenantConfig): void {
  TENANT_REGISTRY.push(config);
}

export function removeTenant(id: string): boolean {
  const idx = TENANT_REGISTRY.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  TENANT_REGISTRY.splice(idx, 1);
  return true;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
