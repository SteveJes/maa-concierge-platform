import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadApprovedSourceRegistry } from "@platform/config";
import type { ApprovedSourceConfig } from "@platform/schemas";
import {
  computeSourceHash,
  createDocument,
  createIngestionRun,
  findOrCreateSource,
  findTenantByCode,
  getNextDocumentVersion,
  newUuid,
  updateIngestionRunById,
  updateSourceById,
} from "./nocodb.js";

export interface MaaWebIngestionOptions {
  smoke: boolean;
  repoRoot?: string;
}

function isApprovedActiveWebSource(source: ApprovedSourceConfig): boolean {
  return source.enabled && source.sourceKind === "website_page";
}

async function fetchPageHtml(url: string): Promise<string> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  return response.text();
}

function normalizeHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function runMaaWebIngestion(
  options: MaaWebIngestionOptions,
): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot =
    options.repoRoot ?? path.resolve(__dirname, "../../../../");

  const registry = await loadApprovedSourceRegistry("maa", repoRoot);
  const webSources = registry.sources.filter(isApprovedActiveWebSource);
  const selected = options.smoke ? webSources.slice(0, 2) : webSources;

  const tenant = await findTenantByCode("maa");

  const run = await createIngestionRun({
    tenant_uuid: tenant.uuid,
    run_type: "manual",
    status: "started",
    source_count: selected.length,
    document_count: 0,
    error_count: 0,
    started_at: new Date().toISOString(),
    finished_at: null,
    notes: options.smoke
      ? "Smoke run: tenant resolved and ingestion run created."
      : "Full run: tenant resolved and ingestion run created.",
  });

  const now = new Date().toISOString();
  const sourceResults = [];
  const documentResults = [];
  let createdDocumentCount = 0;
  let errorCount = 0;

  for (const source of selected) {
    try {
      const sourceResult = await findOrCreateSource({
        uuid: newUuid(),
        tenant_uuid: tenant.uuid,
        locale: source.locale,
        source_type: "web_page",
        title: source.key,
        canonical_url: source.sourceUrl,
        file_url: null,
        source_hash: null,
        approved: true,
        active: true,
        last_synced_at: now,
        notes: options.smoke
          ? `Smoke run source seed: ${source.key}`
          : `Full run source seed: ${source.key}`,
      });

      sourceResults.push({
        key: source.key,
        locale: source.locale,
        url: source.sourceUrl,
        created: sourceResult.created,
        sourceId: sourceResult.row.Id ?? null,
        sourceUuid: sourceResult.row.uuid ?? null,
        previousHash: sourceResult.row.source_hash ?? null,
      });

      if (!sourceResult.row.uuid) {
        throw new Error(
          `Source row for ${source.sourceUrl} is missing uuid. Please fill the uuid field in NocoDB sources table.`,
        );
      }

      if (!sourceResult.row.Id) {
        throw new Error(
          `Source row for ${source.sourceUrl} is missing Id. Cannot update source hash.`,
        );
      }

      const html = await fetchPageHtml(source.sourceUrl);
      const rawText = normalizeHtmlToText(html);
      const currentHash = computeSourceHash(rawText);
      const previousHash = sourceResult.row.source_hash ?? null;
      const changed = previousHash !== currentHash;

      await updateSourceById(sourceResult.row.Id, {
        source_hash: currentHash,
        last_synced_at: now,
        notes: changed
          ? `Content changed or hash initialized: ${source.key}`
          : `No content change detected: ${source.key}`,
      });

      if (!changed) {
        documentResults.push({
          key: source.key,
          locale: source.locale,
          sourceUuid: sourceResult.row.uuid,
          skipped: true,
          reason: "unchanged",
          rawTextLength: rawText.length,
        });
        continue;
      }

      const version = await getNextDocumentVersion(sourceResult.row.uuid);

      const document = await createDocument({
        uuid: newUuid(),
        tenant_uuid: tenant.uuid,
        source_uuid: sourceResult.row.uuid,
        locale: source.locale,
        version,
        title: source.key,
        doc_type: "page",
        raw_text: rawText,
        extracted_json: null,
        citation_label: source.sourceUrl,
        approved: true,
        indexed: false,
        indexed_at: null,
        effective_from: now,
        effective_to: null,
      });

      createdDocumentCount += 1;

      documentResults.push({
        key: source.key,
        locale: source.locale,
        sourceUuid: sourceResult.row.uuid,
        changed: true,
        previousHash,
        currentHash,
        version,
        documentId: document.Id ?? null,
        documentUuid: document.uuid ?? null,
        rawTextLength: rawText.length,
      });
    } catch (error) {
      errorCount += 1;

      documentResults.push({
        key: source.key,
        locale: source.locale,
        url: source.sourceUrl,
        failed: true,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if ((run as { Id?: number }).Id) {
    await updateIngestionRunById((run as { Id?: number }).Id!, {
      status: "completed",
      document_count: createdDocumentCount,
      error_count: errorCount,
      finished_at: new Date().toISOString(),
      notes: options.smoke
        ? `Completed smoke run. Created ${createdDocumentCount} documents. Errors: ${errorCount}.`
        : `Completed full run. Created ${createdDocumentCount} documents. Errors: ${errorCount}.`,
    });
  }

  console.log(
    JSON.stringify(
      {
        tenantCode: "maa",
        tenantUuid: tenant.uuid,
        mode: options.smoke ? "smoke" : "full",
        selectedCount: selected.length,
        ingestionRun: run,
        sourceResults,
        documentResults,
      },
      null,
      2,
    ),
  );
}