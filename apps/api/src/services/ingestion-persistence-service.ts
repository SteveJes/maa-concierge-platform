import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  DocumentRecordWriteSchema,
  IngestionRunRecordWriteSchema,
  SourceRecordWriteSchema,
  TenantRecordWriteSchema,
  type ApprovedSourceConfig,
  type TenantApprovedSourceRegistry
} from "@platform/schemas";
import { loadApprovedSourceRegistry } from "@platform/config";
import { ingestPdfFiles, ingestWebsitePages, normalizeDocuments } from "@platform/retrieval";
import type { DocumentsRepository } from "../repositories/documents-repository.js";
import type { IngestionRunsRepository } from "../repositories/ingestion-runs-repository.js";
import type { SourcesRepository } from "../repositories/sources-repository.js";
import type { TenantsRepository } from "../repositories/tenants-repository.js";

export interface IngestionPersistenceDeps {
  tenantsRepo: TenantsRepository;
  sourcesRepo: SourcesRepository;
  documentsRepo: DocumentsRepository;
  ingestionRunsRepo: IngestionRunsRepository;
}

export interface SyncSourcesSummary {
  tenantId: string;
  syncedSources: number;
  sourceUuids: string[];
}

export interface IngestionRunSummary {
  tenantId: string;
  runUuid: string;
  syncedSources: number;
  documentsWritten: number;
  unchangedDocuments: number;
  artifactPath: string;
  status: "completed" | "failed";
}

interface RetrievalArtifactLine {
  tenantId: string;
  sourceUuid: string;
  sourceKey: string;
  section: string;
  locale: string;
  passage: string;
}

export class IngestionPersistenceService {
  constructor(private readonly deps: IngestionPersistenceDeps) {}

  async syncSources(tenantId: string): Promise<SyncSourcesSummary> {
    const registry = await loadApprovedSourceRegistry(tenantId);
    const webSources = this.getApprovedActiveWebSources(registry);
    await this.upsertTenant(registry);

    const sourceUuids: string[] = [];
    for (const source of webSources) {
      const payload = this.toSourceRecordWrite(registry, source);
      await this.deps.sourcesRepo.upsertBySourceUuid(payload);
      sourceUuids.push(payload.source_uuid);
    }

    return {
      tenantId,
      syncedSources: sourceUuids.length,
      sourceUuids
    };
  }

  async runIngestion(tenantId: string): Promise<IngestionRunSummary> {
    const syncSummary = await this.syncSources(tenantId);
    const runUuid = randomUUID();

    const started = IngestionRunRecordWriteSchema.parse({
      run_uuid: runUuid,
      tenant_uuid: tenantId,
      status: "running",
      started_at: new Date().toISOString()
    });

    await this.deps.ingestionRunsRepo.create(started);

    let documentsWritten = 0;
    let unchangedDocuments = 0;
    const artifactLines: RetrievalArtifactLine[] = [];
    const artifactPath = path.join("artifacts", "retrieval", tenantId, `run-${runUuid}.jsonl`);

    try {
      const registry = await loadApprovedSourceRegistry(tenantId);
      const webSources = this.getApprovedActiveWebSources(registry);

      for (const source of webSources) {
        const sourceUuid = `${registry.tenantId}:${source.key}`;
        const normalizedPages = await this.fetchAndNormalizeSource(source);

        for (let i = 0; i < normalizedPages.length; i += 1) {
          const normalizedText = normalizedPages[i];
          const contentHash = this.hashContent(normalizedText);
          const latest = await this.findLatestDocumentVersion(sourceUuid);

          if (latest && latest.content_hash === contentHash) {
            unchangedDocuments += 1;
            this.pushArtifactLines(artifactLines, {
              tenantId: registry.tenantId,
              sourceUuid,
              sourceKey: source.key,
              section: source.section,
              locale: source.locale,
              normalizedText: latest.normalized_text ?? normalizedText
            });
            continue;
          }

          const version = latest ? Number(latest.version ?? 1) + 1 : 1;
          const payload = DocumentRecordWriteSchema.parse({
            document_uuid: randomUUID(),
            tenant_uuid: registry.tenantId,
            source_uuid: sourceUuid,
            title: `${source.section}-${source.locale}-${i + 1}`,
            locale: source.locale,
            source_url: source.sourceUrl,
            version,
            content_hash: contentHash,
            raw_text: normalizedText,
            normalized_text: normalizedText,
            ingestion_run_uuid: runUuid
          });

          await this.deps.documentsRepo.create(payload);
          documentsWritten += 1;

          this.pushArtifactLines(artifactLines, {
            tenantId: registry.tenantId,
            sourceUuid,
            sourceKey: source.key,
            section: source.section,
            locale: source.locale,
            normalizedText
          });
        }
      }

      await this.writeRetrievalArtifact(artifactPath, artifactLines);

      const summaryJson = JSON.stringify({
        syncedSources: syncSummary.syncedSources,
        documentsWritten,
        unchangedDocuments,
        artifactPath
      });

      await this.deps.ingestionRunsRepo.updateByRunUuid(runUuid, {
        status: "completed",
        finished_at: new Date().toISOString(),
        summary_json: summaryJson
      });

      return {
        tenantId,
        runUuid,
        syncedSources: syncSummary.syncedSources,
        documentsWritten,
        unchangedDocuments,
        artifactPath,
        status: "completed"
      };
    } catch (error) {
      await this.deps.ingestionRunsRepo.updateByRunUuid(runUuid, {
        status: "failed",
        finished_at: new Date().toISOString(),
        error_message: error instanceof Error ? error.message : "Unknown ingestion error"
      });

      return {
        tenantId,
        runUuid,
        syncedSources: syncSummary.syncedSources,
        documentsWritten,
        unchangedDocuments,
        artifactPath,
        status: "failed"
      };
    }
  }

  private getApprovedActiveWebSources(registry: TenantApprovedSourceRegistry) {
    return registry.sources.filter((source) => source.sourceType === "web_page" && source.approved && source.active);
  }

  private async upsertTenant(registry: TenantApprovedSourceRegistry): Promise<void> {
    const payload = TenantRecordWriteSchema.parse({
      tenant_uuid: registry.tenantId,
      name: registry.tenantName,
      default_locale: registry.defaultLocale
    });

    await this.deps.tenantsRepo.upsertByTenantUuid(payload);
  }

  private toSourceRecordWrite(registry: TenantApprovedSourceRegistry, source: ApprovedSourceConfig) {
    return SourceRecordWriteSchema.parse({
      source_uuid: `${registry.tenantId}:${source.key}`,
      tenant_uuid: registry.tenantId,
      source_key: source.key,
      section: source.section,
      source_url: source.sourceUrl,
      source_kind: source.sourceKind,
      source_type: source.sourceType,
      locale: source.locale,
      priority: source.priority,
      update_strategy: source.updateStrategy,
      parsing_mode: source.parsingMode,
      approved: source.approved,
      active: source.active,
      enabled: source.enabled,
      status: source.active ? "active" : "paused"
    });
  }

  private async fetchAndNormalizeSource(source: ApprovedSourceConfig): Promise<string[]> {
    const adapterRaw = source.sourceKind.startsWith("website") ? await ingestWebsitePages(source) : await ingestPdfFiles(source);
    const pages = adapterRaw.length > 0 ? adapterRaw : [await this.fetchWebPageText(source.sourceUrl)];
    return normalizeDocuments(pages);
  }

  private async fetchWebPageText(url: string): Promise<string> {
    const response = await fetch(url, { method: "GET" });
    if (!response.ok) {
      throw new Error(`Failed to fetch source URL ${url}: ${response.status}`);
    }

    const html = await response.text();
    const stripped = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    return stripped.slice(0, 30000);
  }

  private hashContent(content: string): string {
    return createHash("sha256").update(content).digest("hex");
  }

  private async findLatestDocumentVersion(sourceUuid: string): Promise<{ version?: unknown; content_hash?: string; normalized_text?: string } | undefined> {
    const docs = await this.deps.documentsRepo.listBySourceUuid(sourceUuid);

    return docs
      .slice()
      .sort((a, b) => Number(b.version ?? 0) - Number(a.version ?? 0))[0] as
      | { version?: unknown; content_hash?: string; normalized_text?: string }
      | undefined;
  }

  private pushArtifactLines(
    lines: RetrievalArtifactLine[],
    params: { tenantId: string; sourceUuid: string; sourceKey: string; section: string; locale: string; normalizedText: string }
  ) {
    for (const passage of this.toPassages(params.normalizedText)) {
      lines.push({
        tenantId: params.tenantId,
        sourceUuid: params.sourceUuid,
        sourceKey: params.sourceKey,
        section: params.section,
        locale: params.locale,
        passage
      });
    }
  }

  private toPassages(text: string): string[] {
    const cleaned = text.trim();
    if (!cleaned) return [];

    const passages: string[] = [];
    const chunkSize = 500;
    for (let i = 0; i < cleaned.length; i += chunkSize) {
      passages.push(cleaned.slice(i, i + chunkSize));
    }

    return passages;
  }

  private async writeRetrievalArtifact(artifactPath: string, lines: RetrievalArtifactLine[]) {
    const absolute = path.join(process.cwd(), artifactPath);
    await mkdir(path.dirname(absolute), { recursive: true });
    const jsonl = lines.map((line) => JSON.stringify(line)).join("\n");
    await writeFile(absolute, `${jsonl}\n`, "utf8");
  }
}
