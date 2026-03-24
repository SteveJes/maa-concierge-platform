import { z } from "zod";

export const ToolInvocationSchema = z.object({
  tenantId: z.string(),
  toolName: z.string(),
  payload: z.record(z.unknown())
});

export type ToolInvocation = z.infer<typeof ToolInvocationSchema>;
