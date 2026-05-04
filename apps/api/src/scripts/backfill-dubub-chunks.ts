/**
 * One-shot script: chunk the existing DUBUB document (Id=53) that was
 * created during onboarding but never indexed due to the uuid-loss bug.
 * Run once on the droplet after deploying the fix.
 */
import { prepareDocumentChunks } from "@platform/retrieval";
import {
  computeSourceHash,
  createDocumentChunk,
  listDocumentChunksByDocumentUuid,
  newUuid,
  updateDocumentById,
} from "../ingestion/nocodb.js";

const DUBUB_DOC = {
  Id: 53,
  uuid: "f062f19a-c579-47a4-acbe-aea849234cc4",
  tenant_uuid: "6d49f611-1ced-477c-b4aa-cb354417dbb7",
  source_uuid: "2d704d54-34bc-4abe-b237-7008cc2c529f",
  locale: "fr-CA",
  citation_label: "https://dubub.ca/",
  approved: true,
};

async function main() {
  const existing = await listDocumentChunksByDocumentUuid(DUBUB_DOC.uuid);
  if (existing.length > 0) {
    console.log(`Already chunked: ${existing.length} chunks found. Nothing to do.`);
    return;
  }

  // Fetch the raw_text from NocoDB (we have it in the record above but let's re-fetch to be safe)
  const res = await fetch(
    `${process.env.NOCODB_BASE_URL}/api/v2/tables/${process.env.NOCODB_TABLE_DOCUMENTS}/records?where=(uuid,eq,${DUBUB_DOC.uuid})`,
    { headers: { "xc-token": process.env.NOCODB_API_TOKEN ?? "" } },
  );
  const data = await res.json() as { list: Array<{ raw_text: string }> };
  const rawText = data.list[0]?.raw_text;
  if (!rawText) throw new Error("Could not fetch raw_text for DUBUB document");

  const chunks = prepareDocumentChunks(rawText, { maxChars: 1200, overlapChars: 150 });
  console.log(`Creating ${chunks.length} chunks for DUBUB document...`);

  for (const chunk of chunks) {
    await createDocumentChunk({
      uuid: newUuid(),
      tenant_uuid: DUBUB_DOC.tenant_uuid,
      source_uuid: DUBUB_DOC.source_uuid,
      document_uuid: DUBUB_DOC.uuid,
      locale: DUBUB_DOC.locale,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      content_hash: computeSourceHash(chunk.content),
      char_count: chunk.charCount,
      citation_label: DUBUB_DOC.citation_label,
      approved: DUBUB_DOC.approved,
      active: true,
    });
  }

  await updateDocumentById(DUBUB_DOC.Id, {
    indexed: true,
    indexed_at: new Date().toISOString(),
  });

  console.log(`Done. Created ${chunks.length} chunks. Document marked indexed.`);
}

main().catch(e => { console.error(e); process.exit(1); });
