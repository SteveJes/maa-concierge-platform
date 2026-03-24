import { z } from "zod";

export const LocaleSchema = z.enum(["fr-CA", "en-CA"]);

export const SourceKindSchema = z.enum(["website_page", "website_section", "pdf_document"]);
export const SourceTypeSchema = z.enum(["web_page", "pdf"]);

export const UpdateStrategySchema = z.enum(["daily", "weekly", "monthly", "manual"]);

export const ParsingModeSchema = z.enum(["html_readability", "html_structured", "pdf_text"]);

export const CrawlTargetSchema = z.object({
  url: z.string().url(),
  depth: z.number().int().min(0).max(4).default(1),
  includePatterns: z.array(z.string()).default([]),
  excludePatterns: z.array(z.string()).default([])
});

export const PdfTargetSchema = z.object({
  label: z.string().min(1),
  url: z.string().url(),
  expectedLocale: LocaleSchema
});

export const NormalizationHintsSchema = z.object({
  preserveTables: z.boolean().default(false),
  removeNavigationBoilerplate: z.boolean().default(true),
  keepContactFieldsVerbatim: z.boolean().default(true)
});

export const UploadBatchHintsSchema = z.object({
  maxChunksPerBatch: z.number().int().min(10).max(500).default(120),
  preferredBatchTag: z.string().min(1)
});

export const ApprovedSourceConfigSchema = z.object({
  key: z.string().min(1),
  section: z.enum(["homepage", "membership", "class_schedule", "aquatic", "book_a_tour", "contact", "policies"]),
  sourceUrl: z.string().url(),
  sourceKind: SourceKindSchema,
  sourceType: SourceTypeSchema.default("web_page"),
  locale: LocaleSchema,
  priority: z.number().int().min(1).max(5),
  updateStrategy: UpdateStrategySchema,
  parsingMode: ParsingModeSchema,
  approved: z.boolean().default(true),
  active: z.boolean().default(true),
  enabled: z.boolean().default(true),
  crawlTargets: z.array(CrawlTargetSchema).default([]),
  pdfTargets: z.array(PdfTargetSchema).default([]),
  normalizationHints: NormalizationHintsSchema,
  uploadBatchHints: UploadBatchHintsSchema
});

export const TenantApprovedSourceRegistrySchema = z.object({
  tenantId: z.string().min(1),
  tenantName: z.string().min(1),
  defaultLocale: LocaleSchema,
  supportedLocales: z.array(LocaleSchema).min(1),
  manifestLocale: LocaleSchema.optional(),
  sources: z.array(ApprovedSourceConfigSchema)
});

export type ApprovedSourceConfig = z.infer<typeof ApprovedSourceConfigSchema>;
export type TenantApprovedSourceRegistry = z.infer<typeof TenantApprovedSourceRegistrySchema>;
export type SourceKind = z.infer<typeof SourceKindSchema>;
