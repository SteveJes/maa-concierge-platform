/**
 * Tenant registry for the DUBUB admin dashboard.
 * Add a new entry here whenever a new client is onboarded.
 *
 * Persistence: edits made via /admin/dashboard PATCH /v1/admin/tenants/:id
 * are persisted to apps/api/data/tenants-overrides.json and merged on top
 * of the hardcoded defaults below at process boot. See tenant-overrides.ts.
 */
import { applyOverridesToRegistry } from "./tenant-overrides.js";

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

  // ── VAPI Transfer-to-Human ──────────────────────────────────────────────────
  /**
   * Transfer-to-human is OPT-IN per tenant. When enabled, the VAPI assistant
   * (Sophie / SophIA / etc.) can transfer a caller to this phone number — but
   * ONLY when the caller explicitly asks AND confirms. The assistant never
   * offers transfer proactively.
   *
   * Outside business hours, the request falls back to capturing a lead instead
   * of attempting to transfer.
   */
  transferToHumanEnabled?: boolean;
  /** E.164 phone number to dial when transferring (e.g. "+15148452233"). */
  transferToHumanPhone?: string | null;
  /**
   * Business hours window during which transfers are allowed. Outside this
   * window the assistant captures a lead and informs the caller the team will
   * call back.
   *
   * `days` is a 7-element boolean array: [Sun, Mon, Tue, Wed, Thu, Fri, Sat].
   * `startHour`/`endHour` are in 24h local time (timezone field). Both
   * `endHour` exclusive — e.g. start 9, end 17 means 9:00am-4:59pm.
   */
  transferBusinessHours?: {
    days: boolean[]; // length 7, Sun=0..Sat=6
    startHour: number; // 0-23
    endHour: number;   // 1-24, exclusive
    timezone: string;  // IANA tz, e.g. "America/Montreal"
  };

  // ── Restaurant menu links (per tenant) ──────────────────────────────────────
  /**
   * When the tenant has a restaurant on-site, store the public PDF/web URLs here
   * so the concierge can link to them with clean, named link text instead of
   * pasting raw URLs. Daphné's fourth pass — MAA's restaurant Le 1881 has
   * separate PDFs for the main menu, breakfast menu, and wine list.
   *
   * The chat widget renders these as markdown links ([Menu](...)). Voice agents
   * use the labels (without the URL) and direct the caller to the website.
   *
   * Editable from the dashboard Settings panel so MAA staff can update the
   * URLs whenever they refresh the PDFs.
   */
  restaurantMenuLinks?: {
    menuUrl?: string | null;
    breakfastMenuUrl?: string | null;
    wineListUrl?: string | null;
    /** Optional take-out / online ordering URL (e.g. clusterpos). */
    orderingUrl?: string | null;
    /** Online reservation widget for small parties (LibroReserve, OpenTable, etc.). */
    reservationUrl?: string | null;
    /** Maximum party size accepted via online reservation (the form blocks larger groups). */
    reservationMaxPartySize?: number | null;
    /** Phone number to call for group reservations / corporate events. */
    groupReservationsPhone?: string | null;
    /** Free-form note about the conference room / private dining capacity (e.g. "10 people"). */
    groupReservationsCapacity?: string | null;
  };
}

export const TENANT_REGISTRY: TenantConfig[] = [
  {
    id: "maa",
    name: "Club Sportif MAA",
    plan: "professional",
    status: "active",
    since: "2025-01-01",
    // While MAA is in pre-launch testing: lead notifications go to DUBUB owners only.
    // To restore real club recipient: change to "info@clubsportifmaa.com" (or use the
    // Settings panel in /admin/dashboard once that ships in this PR).
    notifyEmail: "steve@dubub.com,daphne@dubub.com",
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
    // Transfer-to-human is OFF by default for MAA until the club provides a
    // dedicated transfer-line phone number. Edit via dashboard Settings panel.
    transferToHumanEnabled: false,
    transferToHumanPhone: null,
    transferBusinessHours: {
      // Mon-Fri default. Sun + Sat off.
      days: [false, true, true, true, true, true, false],
      startHour: 9,
      endHour: 17,
      timezone: "America/Montreal",
    },
    // Restaurant Le 1881 — current menu PDFs (October 2025 edition). Editable
    // via dashboard Settings panel so MAA staff can rotate the PDFs without code
    // changes. The concierge presents these as named markdown links.
    restaurantMenuLinks: {
      menuUrl: "https://www.clubsportifmaa.com/wp-content/uploads/2025/10/1881_Menu1_En_Oct2025.pdf",
      breakfastMenuUrl: "https://www.clubsportifmaa.com/wp-content/uploads/2025/10/1881_Menu2_En_Oct25.pdf",
      wineListUrl: "https://www.clubsportifmaa.com/wp-content/uploads/2023/09/1881_Menu_CarteDesVins.pdf",
      orderingUrl: "https://clubsportifmaa.clusterpos.com/menu",
      reservationUrl: "https://widgets.libroreserve.com/WEB/QC016934055076/book",
      reservationMaxPartySize: 6,
      groupReservationsPhone: "(514) 845-8002",
      groupReservationsCapacity: "salle de conférence jusqu'à 10 personnes",
    },
  },
];

// Hydrate dashboard-driven overrides on top of the hardcoded defaults at boot.
// Subsequent reads via getTenant / TENANT_REGISTRY see the merged view.
applyOverridesToRegistry(TENANT_REGISTRY);

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
