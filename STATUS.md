# STATUS — MAA Concierge Platform

## Current branch
- `feat/maa-web-ingestion-v3`

## Live production URLs
- Web / demo: https://clients.dubub.com (and `/demo/maa`, `/demo/dubub`)
- API: https://api.dubub.com
- Server: DigitalOcean droplet `concierge-first` (165.227.40.198, 2vCPU/4GB, TOR1)
- Deploy: `ssh root@165.227.40.198 "bash /var/www/concierge/deploy.sh"`
- PM2 processes: `api` (id:5), `web` (id:1)

## Owners and tenants
- DUBUB inc. owns the platform — Steve, Daphné, Claude.
- Tenant 1: **MAA** (Club Sportif MAA, Montreal) — paying client.
- Tenant 2: **DUBUB** itself — concierge "SophIA" runs the inbound sales funnel.

## What's live and working

### Safety layer (shared across all tenants)
- `apps/api/src/prompts/shared-safety.ts` — Daphné's 13 rules included by every tenant prompt
- `apps/api/src/prompts/generic-tenant-chat-system.ts` — auto-generates prompt for new tenants from the wizard with shared-safety baked in
- `apps/api/src/services/maa-chat.ts`:
  - `detectCriticalIntent()` recognizes 11 intents: cancellation, guarantee, reservation_problem, reserve_now, executive_contact, holiday_hours, privacy, identity, prompt_injection, human_now, negotiation
  - `safeFollowUpModeForIntent()` forces `followUpMode` away from `calendly` for those intents → `server.ts` booking-template override can no longer fire on protected intents
  - `buildIntentSafetyContext()` injects per-intent guidance into the AI prompt (belt + suspenders)

### LLM observability — Langfuse
- Every OpenAI call (MAA + DUBUB + future tenants) traced with `tenantCode`, `locale`, input, output, token usage
- Failures recorded with `level: "ERROR"` and the error message
- Dashboard: `https://us.cloud.langfuse.com`
- No-op when keys missing (CI, local dev without keys)

### Product analytics — PostHog
- Pageviews + page-leave automatic on every web route via `apps/web/src/components/PostHogProvider.tsx`
- Custom events (chat_opened, chat_first_message, lead_captured) — TODO, hook up in widget
- Dashboard: `https://us.posthog.com`

### Automated UI regression — Playwright
- `e2e/daphne-regression.spec.ts` — 21 cases from `daphne-second-run.md` running against the rendered chat
- Both `forbid` and `require` regex patterns assert against the actual user-visible reply
- Booking-CTA visibility checked separately (`forbidBookingCta`)
- Run live: `pnpm.cmd e2e:daphne:prod`
- Run local: `pnpm.cmd e2e:daphne` (web dev server must be up on :3000)

### CodeRabbit
- Installed via Steve's GitHub account — auto-reviews every PR

### Chat widget (packages/ui-chat)
- Full bilingual chat (FR default, EN on detection)
- Deterministic pricing, hours, address, phone, description responses (skipped for critical intents)
- AI fallback via OpenAI + NocoDB retrieval for complex questions
- Lead form (name, phone, email, consent) → Brevo email to club
- Dark premium UI: charcoal palette, gold gradient bubbles, MAA avatar
- Mobile: `calc(100dvh - 40px)` layout, centered demo badge

### Phone (inbound Sophie call)
- VAPI assistant Sophie, inbound `+14388029845`
- `assistant-request` webhook routes to `https://api.dubub.com/v1/vapi/server`
- Topic-aware opening line; `capture_lead` tool emails `LEAD_NOTIFY_EMAIL`

### Admin dashboard (/admin/dashboard)
- Multi-tenant sidebar
- Per-tenant: health checks, VAPI call table, OpenAI cost tracking
- Onboarding wizard captures the 7 prompt-config fields → new tenants inherit shared safety automatically

## Test status
- API regression `test-maa-intent-regression.ts`: **23/23 PASS** (local)
- API regression `test-dubub-intent-regression.ts`: **12/12 PASS** (local)
- Playwright `daphne-regression.spec.ts`: **63 cases** scaffolded across 3 desktop browsers — pending live run

## Known weak points
1. PostHog custom funnel events (chat_opened, lead_captured) not yet wired into the widget — only autopageviews active
2. Vitest migration of regression scripts deferred (current tsx scripts work but don't integrate with CI's test runner)
3. Zod validation at HTTP boundary not yet added — `/v1/chat`, `/admin/onboarding`, `/v1/vapi/*` accept loosely-typed bodies
4. OpenAI usage resets on server restart (no persistent DB yet)
5. Knowledge gap logging (unanswered questions → NocoDB) not built
6. Dashboard "Lacunes" tab not built

## Next priorities (ranked)
1. Run `pnpm.cmd e2e:daphne:prod` against the live deploy to validate the booking-template fix end-to-end
2. Add Zod schemas at HTTP boundary
3. Wire chat_opened / lead_captured events to PostHog
4. Vitest migration of regression scripts + GitHub Actions workflow that runs them on every PR
5. Move OpenAI usage tracking to NocoDB (persistent)
6. Knowledge gap logging → NocoDB `knowledge_gaps` table

## Session start rule
1. Read `CLAUDE.md` + `STATUS.md`
2. Inspect `git status` and recent commits
3. Check Langfuse dashboard if a recent regression is reported
4. Continue from highest-value remaining issue
