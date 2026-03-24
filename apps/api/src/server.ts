import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadApprovedSourceRegistry } from "@platform/config";
import {
  buildIngestionExecutionPlan,
  ingestPdfFiles,
  ingestWebsitePages,
  normalizeDocuments,
  prepareChunks,
  prepareForOpenAIFileSearch
} from "@platform/retrieval";

export function createServer() {
  const app = Fastify({ logger: true });

  app.register(cors, {
    origin: true
  });

  app.get("/health", async () => ({ status: "ok" }));

  app.get("/v1/tenants/:tenantId/sources", async (request) => {
    const tenantId = (request.params as { tenantId: string }).tenantId;
    const registry = await loadApprovedSourceRegistry(tenantId);

    return {
      tenantId: registry.tenantId,
      tenantName: registry.tenantName,
      defaultLocale: registry.defaultLocale,
      supportedLocales: registry.supportedLocales,
      sources: registry.sources
    };
  });

  app.get("/v1/tenants/:tenantId/ingestion/plan", async (request) => {
    const tenantId = (request.params as { tenantId: string }).tenantId;
    const registry = await loadApprovedSourceRegistry(tenantId);
    const plan = buildIngestionExecutionPlan(registry);

    return {
      status: "planned",
      tenantId,
      plan
    };
  });

  app.post("/v1/tenants/:tenantId/ingestion/prepare", async (request) => {
    const tenantId = (request.params as { tenantId: string }).tenantId;
    const registry = await loadApprovedSourceRegistry(tenantId);

    const uploadPreview = [] as Array<{ sourceKey: string; count: number }>;

    for (const source of registry.sources.filter((item) => item.enabled)) {
      const rawDocs = source.sourceKind.startsWith("website") ? await ingestWebsitePages(source) : await ingestPdfFiles(source);
      const normalized = normalizeDocuments(rawDocs);
      const chunks = prepareChunks(normalized);
      const uploadItems = prepareForOpenAIFileSearch(chunks, source.key);

      uploadPreview.push({ sourceKey: source.key, count: uploadItems.length });
    }

    return {
      status: "prepared",
      tenantId,
      uploadPreview,
      message: "Scaffolding only. No external APIs called."
    };
  });

  return app;
}
