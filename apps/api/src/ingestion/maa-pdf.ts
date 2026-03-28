import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadApprovedSourceRegistry } from "@platform/config";
import type { ApprovedSourceConfig } from "@platform/schemas";
import { extractText, getDocumentProxy } from "unpdf";
import {
  computeSourceHash,
  createDocument,
  createIngestionRun,
  findOrCreateSource,
  findTenantByCode,
  getNextDocumentVersion,
  newUuid,
  updateDocumentById,
  updateIngestionRunById,
  updateSourceById,
} from "./nocodb.js";

export interface MaaPdfIngestionOptions {
  smoke: boolean;
  repoRoot?: string;
}

function isApprovedActivePdfSource(source: ApprovedSourceConfig): boolean {
  return source.enabled && source.sourceKind === "pdf_document";
}

async function fetchPdfBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to fetch PDF ${url}: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}

function normalizePdfText(text: string): string {
  return text
    .replace(/\u0000/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

async function extractPdfRawText(
  pdfBytes: Uint8Array,
): Promise<{ rawText: string; totalPages: number }> {
  const pdf = await getDocumentProxy(pdfBytes);
  const { text, totalPages } = await extractText(pdf, { mergePages: true });

  return {
    rawText: normalizePdfText(text),
    totalPages,
  };
}

export async function runMaaPdfIngestion(
  options: MaaPdfIngestionOptions,
): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot =
    options.repoRoot ?? path.resolve(__dirname, "../../../../");

  const registry = await loadApprovedSourceRegistry("maa", repoRoot);
  const pdfSources = registry.sources.filter(isApprovedActivePdfSource);
  const selected = options.smoke ? pdfSources.slice(0, 2) : pdfSources;

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
      ? "Smoke run: PDF ingestion started."
      : "Full run: PDF ingestion started.",
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
        source_type: "pdf",
        title: source.key,
        canonical_url: source.sourceUrl,
        file_url: source.sourceUrl,
        source_hash: null,
        approved: true,
        active: true,
        last_synced_at: now,
        notes: options.smoke
          ? `Smoke run PDF source seed: ${source.key}`
          : `Full run PDF source seed: ${source.key}`,
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

      const pdfBytes = await fetchPdfBytes(source.sourceUrl);
      const { rawText, totalPages } = await extractPdfRawText(pdfBytes);
      const currentHash = computeSourceHash(rawText);
      const previousHash = sourceResult.row.source_hash ?? null;
      const changed = previousHash !== currentHash;

      await updateSourceById(sourceResult.row.Id, {
        source_hash: currentHash,
        last_synced_at: now,
        notes: changed
          ? `PDF changed or hash initialized: ${source.key}`
          : `No PDF content change detected: ${source.key}`,
      });

      if (!changed) {
        documentResults.push({
          key: source.key,
          locale: source.locale,
          sourceUuid: sourceResult.row.uuid,
          skipped: true,
          reason: "unchanged",
          rawTextLength: rawText.length,
          totalPages,
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
        doc_type: "pdf",
        raw_text: rawText,
        extracted_json: null,
        citation_label: source.sourceUrl,
        approved: true,
        indexed: false,
        indexed_at: null,
        effective_from: now,
        effective_to: null,
      });

      if (document.Id) {
        await updateDocumentById(document.Id, {
          indexed: true,
          indexed_at: now,
        });
      }

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
        totalPages,
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
        ? `Completed PDF smoke run. Created ${createdDocumentCount} documents. Errors: ${errorCount}.`
        : `Completed full PDF run. Created ${createdDocumentCount} documents. Errors: ${errorCount}.`,
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