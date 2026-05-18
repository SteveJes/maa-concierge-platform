/**
 * Bullet-proof scenario harness — type contract.
 *
 * Each scenario describes a single user-facing situation we never want to
 * regress on. The runner verifies the SERVICE-LAYER return value (intent,
 * followUpMode, suppressBookingCta) AND the message text against a regex
 * matrix AND (optionally) asks an LLM judge a yes/no rubric.
 *
 * Tenant separation is structural: each scenario must declare its
 * tenantCode. The runner dispatches per-tenant so MAA scenarios never
 * touch the DUBUB system prompt and vice versa.
 */

export type FollowUpMode = "calendly" | "callback" | "vapi" | "clarify" | "done";

export type TenantCode = "maa" | "dubub";

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * What we check after `answerMaaChat` returns. Every field is optional —
 * a scenario only declares what's relevant to it. Empty assertions = run
 * a smoke check (no crash) but don't enforce anything.
 */
export interface ScenarioAssertions {
  /** Expected critical-intent detection result (e.g. "pickleball_reservation" is NOT
   *  a critical intent so we'd leave this undefined; "price_contradiction" is). */
  expectIntent?: string | undefined;
  /** followUpMode must NOT be in this set. */
  forbidFollowUpModes?: FollowUpMode[];
  /** followUpMode must be in this set (if provided). */
  requireFollowUpMode?: FollowUpMode[];
  /** assistantMessage must NOT match any of these regexes. */
  forbidPatterns?: RegExp[];
  /** assistantMessage must match all of these regexes (AND). */
  requirePatterns?: RegExp[];
  /** assistantMessage must match at least one of these regexes (OR). */
  requireAnyPattern?: RegExp[];
  /** When set, `result.suppressBookingCta` must equal this value. */
  requireSuppressBookingCta?: boolean;
  /** Coarse language heuristic — fr/en. */
  expectLanguage?: "fr" | "en";
  /** Optional LLM-as-judge rubric. A single yes/no question, e.g.
   *  "Does the assistant name a medical diagnosis (arthrite, syndrome
   *  patello-fémoral, etc.)?" The judge must answer NO for the test to pass. */
  judgeRubric?: {
    question: string;
    /** "no" if the rubric is "did the bad thing happen?" — typical case.
     *  "yes" if the rubric is "did the good thing happen?" */
    expected: "yes" | "no";
  };
}

export interface Scenario extends ScenarioAssertions {
  /** Unique ID — keep stable across runs so reports can be diffed. */
  id: string;
  /** Human-readable label shown in the runner output. */
  label: string;
  tenantCode: TenantCode;
  locale: "fr-CA" | "en-CA";
  /** Prior turns in the conversation. The runner sends this to
   *  `conversationHistory`. Use this to test multi-turn flows like
   *  "oui after clinical handoff" or "no I meant pickleball, not pickle slice". */
  history?: ChatTurn[];
  /** The user's final message to test. */
  userMessage: string;
  /** From Daphné's pass — used for filtering in CLI (--phase 1 etc.). */
  phase?: 1 | 2 | 3 | 4;
  /** Optional source reference (e.g. "Daphné sixth-pass #1"). */
  source?: string;
}

/**
 * Failure-type taxonomy — the buckets every failed scenario must fit into.
 * Daphné's 2026-05-18 ask: classify failures so the team can route them to
 * the right fix (prompt vs KB vs UI vs model vs French vs sales quality).
 *
 * The harness infers this from the assertion that fired:
 *  - source_leak / repetition / fr_qc_issue / sales_quality_issue come from
 *    targeted regex patterns
 *  - missing_knowledge / bad_retrieval come from the judge rubric verdict
 *  - prompt_problem is the default bucket when none of the above match
 */
export type FailureType =
  | "prompt_problem"
  | "missing_knowledge"
  | "bad_retrieval"
  | "conflicting_kb"
  | "model_hallucination"
  | "ui_bug"
  | "slow_response"
  | "sales_quality_issue"
  | "french_localization_issue"
  | "source_leak"
  | "repetition"
  | "premature_callback"
  | "unknown";

export interface ScenarioResult {
  id: string;
  label: string;
  tenantCode: TenantCode;
  passed: boolean;
  assistantMessage: string;
  followUpMode: FollowUpMode;
  suppressBookingCta: boolean;
  failureReason?: string;
  failureType?: FailureType;
  judgeVerdict?: { verdict: "yes" | "no"; reasoning: string };
  durationMs: number;
}
