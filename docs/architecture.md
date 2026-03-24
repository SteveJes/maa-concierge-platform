# Architecture (MAA Inventory + Ingestion Planning)

## Current architecture slice

- `apps/web`: Next.js shell.
- `apps/api`: Fastify endpoints for source inventory, ingestion planning, and ingestion preparation preview.
- `packages/schemas`: typed contracts for source metadata, approved source registry, documents, and ingestion runs.
- `packages/config`: tenant + approved source registry loaders.
- `packages/retrieval`: ingestion scaffolding and execution-plan shaping (crawl/pdf/normalization/upload hints).

## Execution path (scaffold)

`clients/<tenant>/approved-sources.json` -> `config loader` -> `api /ingestion/plan` -> retrieval planning output.

No real API integrations are active in this slice.
