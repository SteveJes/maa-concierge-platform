import { z } from "zod";

export const DocumentSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  sourceId: z.string().min(1),
  title: z.string().min(1),
  rawText: z.string().default(""),
  normalizedText: z.string().default(""),
  locale: z.enum(["fr-CA", "en-CA"])
});

export type Document = z.infer<typeof DocumentSchema>;
