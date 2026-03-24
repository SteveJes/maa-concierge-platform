import { z } from "zod";
import { LocaleSchema, ParsingModeSchema, SourceKindSchema, UpdateStrategySchema } from "./approved-source-config.js";

export const SourceSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  key: z.string().min(1),
  section: z.string().min(1),
  sourceUrl: z.string().url(),
  sourceKind: SourceKindSchema,
  locale: LocaleSchema,
  priority: z.number().int().min(1).max(5),
  updateStrategy: UpdateStrategySchema,
  parsingMode: ParsingModeSchema,
  enabled: z.boolean().default(true),
  status: z.enum(["active", "paused"]).default("active")
});

export type Source = z.infer<typeof SourceSchema>;
