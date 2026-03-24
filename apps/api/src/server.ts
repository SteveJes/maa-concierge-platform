import Fastify from "fastify";
import cors from "@fastify/cors";
import { loadApprovedSourceRegistry } from "@platform/config";
import {
  buildIngestionExecutionPlan,
  ingestWebsitePages,
  normalizeDocuments,
  prepareChunks,
  prepareForOpenAIFileSearch
} from "@platform/retrieval";
import { createIngestionPersistenceService } from "./services/create-ingestion-persistence-service.js";

export function createServer() {
  const app = Fastify({ logger: true });
  const ingestionService = createIngestionPersistenceService(process.env);

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

  app.post("/v1/tenants/:tenantId/ingestion/sync-sources", async (request) => {
    const tenantId = (request.params as { tenantId: string }).tenantId;
    const summary = await ingestionService.syncSources(tenantId);

    return {
      status: "synced",
      ...summary
    };
  });

  app.post("/v1/tenants/:tenantId/ingestion/run", async (request) => {
    const tenantId = (request.params as { tenantId: string }).tenantId;
    const summary = await ingestionService.runIngestion(tenantId);

    return summary;
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

  app.post("/v1/tenants/:tenantId/ingestion/prepare", async (request, reply) => {
    const tenantId = (request.params as { tenantId: string }).tenantId;
    const registry = await loadApprovedSourceRegistry(tenantId);

    const enabledSources = registry.sources.filter((item) => item.enabled && item.active && item.approved);
    const nonWebSources = enabledSources.filter((item) => item.sourceType !== "web_page");

    if (nonWebSources.length > 0) {
      return reply.status(400).send({
        status: "phase1_scope_error",
        tenantId,
        error: {
          code: "PDF_INGESTION_OUT_OF_SCOPE_PHASE1",
          message: "PDF ingestion is out of scope for Phase 1. Only approved active web_page sources are allowed.",
          rejectedSourceKeys: nonWebSources.map((source) => source.key)
        }
      });
    }

    const uploadPreview = [] as Array<{ sourceKey: string; count: number }>;

    for (const source of enabledSources) {
      const rawDocs = await ingestWebsitePages(source);
      const normalized = normalizeDocuments(rawDocs);
      const chunks = prepareChunks(normalized);
      const uploadItems = prepareForOpenAIFileSearch(chunks, source.key);

      uploadPreview.push({ sourceKey: source.key, count: uploadItems.length });
    }

    return {
      status: "prepared",
      tenantId,
      uploadPreview,
      message: "Phase 1 web-page preparation only. No external APIs called."
    };
  });

  return app;
}
