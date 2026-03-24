import { getNocoDbConfigFromEnv, HttpNocoDbClient } from "../infrastructure/nocodb-client.js";
import { getNocoTableMapFromEnv } from "../infrastructure/nocodb-tables.js";
import { DocumentsRepository } from "../repositories/documents-repository.js";
import { IngestionRunsRepository } from "../repositories/ingestion-runs-repository.js";
import { SourcesRepository } from "../repositories/sources-repository.js";
import { TenantsRepository } from "../repositories/tenants-repository.js";
import { IngestionPersistenceService } from "./ingestion-persistence-service.js";

export function createIngestionPersistenceService(env = process.env) {
  const nocoConfig = getNocoDbConfigFromEnv(env);
  const tables = getNocoTableMapFromEnv(env);
  const client = new HttpNocoDbClient(nocoConfig);

  return new IngestionPersistenceService({
    tenantsRepo: new TenantsRepository(client, tables.tenants),
    sourcesRepo: new SourcesRepository(client, tables.sources),
    documentsRepo: new DocumentsRepository(client, tables.documents),
    ingestionRunsRepo: new IngestionRunsRepository(client, tables.ingestionRuns)
  });
}
