export interface NocoTableMap {
  tenants: string;
  sources: string;
  documents: string;
  ingestionRuns: string;
}

export function getNocoTableMapFromEnv(env = process.env): NocoTableMap {
  return {
    tenants: env.NOCO_TABLE_TENANTS ?? "tenants",
    sources: env.NOCO_TABLE_SOURCES ?? "sources",
    documents: env.NOCO_TABLE_DOCUMENTS ?? "documents",
    ingestionRuns: env.NOCO_TABLE_INGESTION_RUNS ?? "ingestion_runs"
  };
}
