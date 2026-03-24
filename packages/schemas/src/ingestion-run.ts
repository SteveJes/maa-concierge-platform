import { z } from "zod";

export const IngestionRunSchema = z.object({
  id: z.string().min(1),
  tenantId: z.string().min(1),
  sourceId: z.string().min(1),
  status: z.enum(["queued", "running", "completed", "failed"]),
  startedAt: z.string().datetime().optional(),
  completedAt: z.string().datetime().optional()
});

export type IngestionRun = z.infer<typeof IngestionRunSchema>;
