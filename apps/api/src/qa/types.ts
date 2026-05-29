/** Shared types for the grounded adversarial QA system (multi-tenant). */

export interface Persona {
  id: string;
  /** Instruction to the user-simulator LLM. */
  goal: string;
  /** Tenant-specific expectations the judge enforces in addition to universal rules. */
  checklist?: string;
  /** Conversation locale sent to the bot. Default fr-CA. */
  locale?: "fr-CA" | "en-CA";
}

export interface Violation {
  turn: number;
  rule: string;
  evidence: string;
  severity: "high" | "low";
}

/**
 * Per-tenant QA configuration. Each tenant exports one of these so the same
 * simulator/phrasings harnesses work for any tenant without code changes.
 */
export interface TenantQAConfig {
  tenantId: string;
  /** Markdown describing confirmed facts (prices, staff, phones, schedules-are-dynamic, etc.). */
  groundTruth: string;
  /** Adversarial personas covering this tenant's surface area. */
  personas: Persona[];
  /** Optional rendered conversation transcript (md path relative to apps/api) for phrasings replay. */
  phrasingsFile?: string;
}
