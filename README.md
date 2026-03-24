# AI Customer-Service Platform Monorepo

Production-oriented scaffold for a reusable, OpenAI-first customer-service platform.

## Install & run (exact commands)

```bash
pnpm install
pnpm dev
```

Other common commands:

```bash
pnpm build
pnpm lint
pnpm test
pnpm typecheck
```

## Phase 1 scope: MAA web ingestion into NocoDB + local retrieval artifact

This phase does the following for tenant `maa`:

1. Loads approved source manifests from:
   - `clients/maa/approved-sources.fr.json`
   - `clients/maa/approved-sources.en.json`
2. Validates with Zod and filters approved + active `web_page` sources only.
3. Upserts `tenants` and `sources` in NocoDB.
4. Creates an `ingestion_runs` row.
5. Fetches and normalizes approved web pages.
6. Hashes content and writes new `documents` versions only when content changed.
7. Writes local retrieval artifact JSONL under `artifacts/retrieval/maa/`.
8. Marks the ingestion run completed or failed with a summary.

## Required env vars for this phase

- `NOCO_API_URL`
- `NOCO_API_TOKEN`
- `NOCO_TABLE_TENANTS` (default `tenants`)
- `NOCO_TABLE_SOURCES` (default `sources`)
- `NOCO_TABLE_DOCUMENTS` (default `documents`)
- `NOCO_TABLE_INGESTION_RUNS` (default `ingestion_runs`)

## Commands

Run ingestion:

```bash
pnpm ingest:maa:web
```

Run local retrieval smoke check (returns relevant passages for known topics):

```bash
pnpm ingest:maa:web:smoke
```

## API endpoints (ingestion)

- `POST /v1/tenants/:tenantId/ingestion/sync-sources`
  - syncs approved+active `web_page` sources to NocoDB control-plane tables.
- `POST /v1/tenants/:tenantId/ingestion/run`
  - executes Phase 1 web ingestion and persists versioned documents.
- `GET /v1/tenants/:tenantId/ingestion/plan`
  - returns planned crawl/pdf/normalization/batch hints from manifests.
- `POST /v1/tenants/:tenantId/ingestion/prepare`
  - **web-page-only in Phase 1**; explicitly rejects PDF sources with `PDF_INGESTION_OUT_OF_SCOPE_PHASE1`.

## What phase comes next

Phase 2 will add:
- robust crawler/parser adapters and retryable async jobs
- stronger reconciliation/versioning strategies
- retrieval integration wiring (still no chatbot runtime)
