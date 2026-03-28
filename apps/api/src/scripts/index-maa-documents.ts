import { prepareDocumentChunks } from "@platform/retrieval";
import {
  computeSourceHash,
  createDocumentChunk,
  findTenantByCode,
  listDocumentChunksByDocumentUuid,
  listDocuments,
  newUuid,
  updateDocumentById,
} from "../ingestion/nocodb.js";

async function main(): Promise<void> {
  const smoke = process.argv.includes("--smoke");
  const tenant = await findTenantByCode("maa");
  const allDocuments = await listDocuments();

  const eligibleDocuments = allDocuments.filter(
    (document) =>
      document.tenant_uuid === tenant.uuid &&
      document.approved === true &&
      typeof document.raw_text === "string" &&
      document.raw_text.trim().length > 0 &&
      typeof document.uuid === "string" &&
      document.uuid.length > 0 &&
      typeof document.source_uuid === "string" &&
      document.source_uuid.length > 0,
  );

  const selectedDocuments = smoke
    ? eligibleDocuments.slice(0, 2)
    : eligibleDocuments;

  const now = new Date().toISOString();
  const documentResults = [];
  let indexedDocumentCount = 0;
  let createdChunkCount = 0;
  let skippedDocumentCount = 0;
  let errorCount = 0;

  for (const document of selectedDocuments) {
    try {
      const existingChunks = await listDocumentChunksByDocumentUuid(
        document.uuid!,
      );

      if (existingChunks.length > 0) {
        skippedDocumentCount += 1;

        documentResults.push({
          documentId: document.Id ?? null,
          documentUuid: document.uuid,
          title: document.title,
          locale: document.locale,
          skipped: true,
          reason: "already_chunked",
          existingChunkCount: existingChunks.length,
        });

        continue;
      }

      const chunks = prepareDocumentChunks(document.raw_text, {
        maxChars: 1200,
        overlapChars: 150,
      });

      if (chunks.length === 0) {
        skippedDocumentCount += 1;

        documentResults.push({
          documentId: document.Id ?? null,
          documentUuid: document.uuid,
          title: document.title,
          locale: document.locale,
          skipped: true,
          reason: "no_chunks_created",
        });

        continue;
      }

      for (const chunk of chunks) {
        await createDocumentChunk({
          uuid: newUuid(),
          tenant_uuid: document.tenant_uuid,
          source_uuid: document.source_uuid,
          document_uuid: document.uuid!,
          locale: document.locale,
          chunk_index: chunk.chunkIndex,
          content: chunk.content,
          content_hash: computeSourceHash(chunk.content),
          char_count: chunk.charCount,
          citation_label: document.citation_label,
          approved: document.approved,
          active: true,
        });
      }

      if (document.Id) {
        await updateDocumentById(document.Id, {
          indexed: true,
          indexed_at: now,
        });
      }

      indexedDocumentCount += 1;
      createdChunkCount += chunks.length;

      documentResults.push({
        documentId: document.Id ?? null,
        documentUuid: document.uuid,
        title: document.title,
        locale: document.locale,
        indexed: true,
        createdChunkCount: chunks.length,
        firstChunkLength: chunks[0]?.charCount ?? 0,
        lastChunkLength: chunks[chunks.length - 1]?.charCount ?? 0,
      });
    } catch (error) {
      errorCount += 1;

      documentResults.push({
        documentId: document.Id ?? null,
        documentUuid: document.uuid ?? null,
        title: document.title,
        locale: document.locale,
        failed: true,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        tenantCode: "maa",
        tenantUuid: tenant.uuid,
        mode: smoke ? "smoke" : "full",
        selectedDocumentCount: selectedDocuments.length,
        indexedDocumentCount,
        skippedDocumentCount,
        createdChunkCount,
        errorCount,
        documentResults,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});