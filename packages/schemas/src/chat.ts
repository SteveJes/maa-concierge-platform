import { z } from "zod";

export const ChatRequestSchema = z.object({
  tenantId: z.string().min(1),
  sessionId: z.string().min(1),
  userMessage: z.string().min(1),
  locale: z.string().optional()
});

export const ChatResponseSchema = z.object({
  sessionId: z.string(),
  assistantMessage: z.string(),
  followUpMode: z.enum(["clarify", "calendly", "callback", "vapi", "done"])
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatResponse = z.infer<typeof ChatResponseSchema>;
