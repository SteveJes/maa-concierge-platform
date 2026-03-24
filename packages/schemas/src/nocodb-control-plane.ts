import { z } from "zod";

export const TenantRecordWriteSchema = z.object({
  tenant_uuid: z.string().min(1),
  name: z.string().min(1),
  default_locale: z.string().min(2)
});

export const SourceRecordWriteSchema = z.object({
  source_uuid: z.string().min(1),
  tenant_uuid: z.string().min(1),
  source_key: z.string().min(1),
  section: z.string().min(1),
  source_url: z.string().url(),
  source_kind: z.string().min(1),
  source_type: z.enum(["web_page", "pdf"]).default("web_page"),
  locale: z.string().min(2),
  priority: z.number().int().min(1),
  update_strategy: z.string().min(1),
  parsing_mode: z.string().min(1),
  approved: z.boolean().default(true),
  active: z.boolean().default(true),
  enabled: z.boolean(),
  status: z.string().default("active")
});

export const IngestionRunRecordWriteSchema = z.object({
  run_uuid: z.string().min(1),
  tenant_uuid: z.string().min(1),
  source_uuid: z.string().min(1).optional(),
  status: z.enum(["queued", "running", "completed", "failed"]),
  started_at: z.string().optional(),
  finished_at: z.string().optional(),
  summary_json: z.string().optional(),
  error_message: z.string().optional()
});

export const DocumentRecordWriteSchema = z.object({
  document_uuid: z.string().min(1),
  tenant_uuid: z.string().min(1),
  source_uuid: z.string().min(1),
  title: z.string().min(1),
  locale: z.string().min(2),
  source_url: z.string().url().optional(),
  version: z.number().int().min(1).default(1),
  content_hash: z.string().min(16),
  raw_text: z.string().default(""),
  normalized_text: z.string().default(""),
  ingestion_run_uuid: z.string().min(1)
});

export type TenantRecordWrite = z.infer<typeof TenantRecordWriteSchema>;
export type SourceRecordWrite = z.infer<typeof SourceRecordWriteSchema>;
export type IngestionRunRecordWrite = z.infer<typeof IngestionRunRecordWriteSchema>;
export type DocumentRecordWrite = z.infer<typeof DocumentRecordWriteSchema>;
