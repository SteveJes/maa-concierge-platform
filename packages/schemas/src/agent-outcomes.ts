import { z } from "zod";

export const AgentOutcomeSchema = z.object({
  status: z.enum(["answered", "needs_clarification", "offer_calendly", "offer_callback", "offer_vapi"]),
  reason: z.string().optional()
});

export type AgentOutcome = z.infer<typeof AgentOutcomeSchema>;
