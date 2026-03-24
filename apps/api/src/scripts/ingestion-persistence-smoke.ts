import { createIngestionPersistenceService } from "../services/create-ingestion-persistence-service.js";

async function main() {
  const tenantId = process.argv[2] ?? "maa";
  const service = createIngestionPersistenceService(process.env);

  const sync = await service.syncSources(tenantId);
  const run = await service.runIngestion(tenantId);

  console.log(JSON.stringify({ sync, run }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
