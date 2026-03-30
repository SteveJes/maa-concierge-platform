import { searchKnowledgeBase, type SearchableChunk } from "@platform/retrieval";
import {
  findDocumentByUuid,
  findTenantByCode,
  listDocumentChunks,
} from "../ingestion/nocodb.js";

async function main(): Promise<void> {
  const query = process.argv.slice(2).join(" ").trim();

  if (!query) {
    throw new Error('Please provide a search query, for example: pnpm --filter @platform/api search:maa:knowledge -- "membership pool"');
  }

  const tenant = await findTenantByCode("maa");
  const chunkRows = await listDocumentChunks();

  const searchableChunks: SearchableChunk[] = [];

  for (const chunk of chunkRows) {
    if (
      chunk.tenant_uuid !== tenant.uuid ||
      chunk.active !== true ||
      chunk.approved !== true ||
      typeof chunk.uuid !== "string" ||
      typeof chunk.document_uuid !== "string" ||
      typeof chunk.source_uuid !== "string"
    ) {
      continue;
    }

    const document = await findDocumentByUuid(chunk.document_uuid);

    searchableChunks.push({
      chunkId: chunk.uuid,
      tenantId: chunk.tenant_uuid,
      documentId: chunk.document_uuid,
      sourceId: chunk.source_uuid,
      locale: chunk.locale,
      content: chunk.content,
      citationLabel: chunk.citation_label,
      chunkIndex: chunk.chunk_index,
      sourceTitle: document?.title,
    });
  }

  const results = await searchKnowledgeBase(
    {
      tenantId: tenant.uuid,
      query,
      maxResults: 5,
    },
    searchableChunks,
  );

  console.log(
    JSON.stringify(
      {
        tenantCode: "maa",
        tenantUuid: tenant.uuid,
        query,
        chunkCount: searchableChunks.length,
        resultCount: results.length,
        results,
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