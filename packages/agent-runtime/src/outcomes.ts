export type OutcomeKind =
  | "answered"
  | "needs_clarification"
  | "offer_calendly"
  | "offer_callback"
  | "offer_vapi";

export interface AgentOutcome {
  kind: OutcomeKind;
  note?: string;
}
