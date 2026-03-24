import type { ApprovedSourceConfig, TenantApprovedSourceRegistry } from "@platform/schemas";

export interface PlannedCrawlTarget {
  sourceKey: string;
  locale: "fr-CA" | "en-CA";
  targets: ApprovedSourceConfig["crawlTargets"];
}

export interface PlannedPdfTarget {
  sourceKey: string;
  locale: "fr-CA" | "en-CA";
  targets: ApprovedSourceConfig["pdfTargets"];
}

export interface IngestionExecutionPlan {
  tenantId: string;
  crawlPlan: PlannedCrawlTarget[];
  pdfPlan: PlannedPdfTarget[];
  normalizationHints: Array<{ sourceKey: string; hints: ApprovedSourceConfig["normalizationHints"] }>;
  uploadBatchHints: Array<{ sourceKey: string; hints: ApprovedSourceConfig["uploadBatchHints"] }>;
}

export function buildIngestionExecutionPlan(registry: TenantApprovedSourceRegistry): IngestionExecutionPlan {
  const enabledSources = registry.sources.filter((source) => source.enabled);

  return {
    tenantId: registry.tenantId,
    crawlPlan: enabledSources
      .filter((source) => source.crawlTargets.length > 0)
      .map((source) => ({ sourceKey: source.key, locale: source.locale, targets: source.crawlTargets })),
    pdfPlan: enabledSources
      .filter((source) => source.pdfTargets.length > 0)
      .map((source) => ({ sourceKey: source.key, locale: source.locale, targets: source.pdfTargets })),
    normalizationHints: enabledSources.map((source) => ({ sourceKey: source.key, hints: source.normalizationHints })),
    uploadBatchHints: enabledSources.map((source) => ({ sourceKey: source.key, hints: source.uploadBatchHints }))
  };
}
