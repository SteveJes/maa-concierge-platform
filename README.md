# AI Customer-Service Platform Monorepo

Production-oriented structural scaffold for a reusable, OpenAI-first customer-service platform.

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

## Monorepo decisions

- **Package manager:** `pnpm` workspaces for deterministic installs and faster monorepo linking.
- **Task orchestrator:** `turbo` for pipeline execution and cache-ready CI.
- **Apps:**
  - `apps/web` = Next.js shell for tenant-facing chat.
  - `apps/api` = Fastify API shell for orchestration/runtime endpoints.
- **Packages:** split by concern (`schemas`, `prompts`, `agent-runtime`, `retrieval`, `ui-chat`, `config`, `shared`).
- **Client overlays:** `clients/<tenant>` for tenant defaults, policy notes, and approved source registries.

## Current MVP scope (inventory + ingestion planning)

- Workspace and pipeline setup.
- Typed schemas for source inventory, source metadata, and ingestion runs.
- Real MAA source inventory for Club Sportif MAA (`fr-CA` + `en-CA`) organized by operational sections.
- Ingestion execution planning (`crawl targets`, `pdf targets`, `normalization hints`, `upload batching hints`).
- Retrieval upload payload preparation only (no OpenAI API connections yet).

## MAA real source inventory

MAA now has a structured inventory for:
- homepage
- membership
- class schedule
- aquatic/pool programming
- book-a-tour
- contact
- policies/PDFs

See:
- `clients/maa/approved-sources.json`
- `clients/maa/source-manifest.md`

## How ingestion works (current scaffold)

1. `apps/api` loads tenant source registry from `clients/<tenant>/approved-sources.json`.
2. `/v1/tenants/:tenantId/sources` returns approved source definitions with metadata.
3. `/v1/tenants/:tenantId/ingestion/plan` returns crawl/pdf + normalization/upload hint planning output.
4. `/v1/tenants/:tenantId/ingestion/prepare` builds upload-preview counts (still placeholder extraction).
5. No external APIs are called yet.

## Next task after this slice

Implement execution + persistence:
- persist source inventory snapshots and ingestion runs
- implement actual page/PDF fetch and parser adapters
- run chunk generation and batching as asynchronous jobs
- add storage-backed retry/recovery for failed ingestion runs

## Repository layout

```txt
.
├─ apps/
│  ├─ web/                 # Next.js app shell
│  └─ api/                 # Fastify API shell
├─ packages/
│  ├─ schemas/             # Canonical contracts
│  ├─ prompts/             # Prompt templates + render helpers
│  ├─ agent-runtime/       # Agent orchestration interfaces
│  ├─ retrieval/           # Retrieval provider contracts + ingestion prep placeholders
│  ├─ ui-chat/             # Reusable chat UI primitives (placeholder)
│  ├─ config/              # Tenant/config loaders
│  └─ shared/              # Generic non-domain utilities
├─ n8n/workflows/
├─ nocodb/schema/
├─ prompts/
├─ tests/evals/
├─ clients/maa/
└─ docs/
```
