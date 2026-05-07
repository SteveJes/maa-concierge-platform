# MAA Concierge Platform

You are continuing an active engineering and product build. Do not restart from scratch. Do not re-suggest already completed work unless a real bug requires it.

## Required startup behavior
At the start of every session:
1. Read `CLAUDE.md`
2. Read `STATUS.md`
3. Inspect current git state
4. Continue from the current project state, not from scratch

## Required session wrap-up
After each meaningful pass:
1. Update `STATUS.md`
2. Summarize what changed
3. Summarize what passed
4. Summarize what still looks weak
5. Recommend a commit only if the batch is stable

## Project identity
- Project: MAA Concierge Platform
- Owners: Steve, Daphné, and Claude (DUBUB inc.)
- First paying tenant: Club Sportif MAA, Montreal
- Second tenant: DUBUB itself (concierge name "SophIA") — runs the sales funnel for new tenants
- Goal: premium bilingual AI concierge for web chat and voice, sold as a multi-tenant SaaS by DUBUB
- Strategic ambition: showcase Claude Code internationally — flagship product

## Language behavior
- Default French (Quebec/Canada)
- Switch to English if the user clearly uses English
- Stay consistent in the chosen language unless the user switches

## Product priorities
1. Strong web chat experience
2. Strong AI phone continuation / callback experience
3. Premium concierge tone
4. No hallucinated business facts
5. Reusable multi-tenant architecture

## Critical product rules
- Do not treat direct club dialing as the main phone UX.
- Preferred phone UX:
  - FR: "Laissez l’IA vous appeler"
  - EN: "Let the AI call you"
- A raw `tel:` call is only a secondary/manual fallback.
- Never hallucinate pricing, schedules, availability, booking confirmations, or callback confirmations.
- If pricing, schedules, or availability may vary, say so and recommend confirming by phone.

## Repo / workflow
- Repo: `maa-concierge-platform`
- Common active branch: `feat/maa-web-ingestion-v3`
- GitHub is source of truth
- Windows + PowerShell + GitKraken
- Use `pnpm.cmd` in PowerShell

## Common commands
- `pnpm.cmd --filter @platform/web dev`
- `pnpm.cmd --filter @platform/api dev`
- `pnpm.cmd --filter @platform/api typecheck`
- `pnpm.cmd --filter @platform/web typecheck`
- API regression: `cd apps/api && npx tsx src/scripts/test-maa-intent-regression.ts` (23 cases) and `... test-dubub-intent-regression.ts` (12 cases)
- Live-UI regression: `pnpm.cmd e2e:daphne` (local) / `pnpm.cmd e2e:daphne:prod` (live)

## Monorepo structure
- `apps/api`
- `apps/web`
- `packages/ui-chat`

## Important files
- `apps/api/src/server.ts` — HTTP layer; **booking-template override** lives in `resolveBookingFollowUp()` and is gated on `followUpMode === "calendly"`
- `apps/api/src/services/maa-chat.ts` — `answerMaaChat()`, `detectCriticalIntent()`, `safeFollowUpModeForIntent()`, `buildIntentSafetyContext()`
- `apps/api/src/prompts/shared-safety.ts` — `buildSharedSafetyRules()` — included by every tenant prompt
- `apps/api/src/prompts/generic-tenant-chat-system.ts` — auto-generated prompt for new tenants from the wizard
- `apps/api/src/prompts/maa-chat-system.ts` / `dubub-chat-system.ts`
- `apps/api/src/lib/langfuse.ts` — LLM observability (no-op when keys missing)
- `apps/api/src/services/maa-pricing.ts`
- `apps/api/src/tenant-core-facts.json`
- `packages/ui-chat/src/index.tsx`
- `e2e/daphne-regression.spec.ts` — 21 cases run against the **live UI** (the layer Daphné sees)
- `apps/web/src/components/PostHogProvider.tsx`

## Architectural invariant — safety is structural, not optional
Every tenant prompt builder MUST include `buildSharedSafetyRules({ tunnelCtaFr, tunnelCtaEn })`. The generic builder enforces this for new tenants automatically. `detectCriticalIntent()` runs in `answerMaaChat` and **forces `followUpMode` away from `calendly`** for: cancellation, guarantee, reservation_problem, reserve_now, executive_contact, holiday_hours, privacy, identity, prompt_injection, human_now, negotiation. This prevents the HTTP layer's booking-template override from firing on those intents. **Never delete this enforcement** without replacing it.

## Test the layer the user sees
Daphné's failures persisted because we only tested `answerMaaChat()` — but the user sees the HTTP+UI rendering. Always extend `e2e/daphne-regression.spec.ts` for new safety rules and run against the live URL: `pnpm.cmd e2e:daphne:prod`.

## Important environment note
- API env file: `apps/api/.env.local` (must include `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_SECRET_KEY`, `LANGFUSE_BASE_URL`)
- Web env file: `apps/web/.env.local` (must include `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`)
- On the droplet (`/var/www/concierge/...`) the same env files are required before each deploy. Re-add new vars manually — they don't sync from local.

## Deploy
- `ssh root@165.227.40.198 "bash /var/www/concierge/deploy.sh"`
- PM2 processes: `api` (id:5), `web` (id:1)

## Observability and analytics
- **Langfuse Cloud (US)** — every OpenAI call traced with `tenantCode`, `locale`, prompt input, output, and token usage. View at `https://us.cloud.langfuse.com`.
- **PostHog** — pageviews and demo funnel. Key in `apps/web/.env.local`.
- **CodeRabbit** — installed on GitHub repo, reviews every PR.

## Current working state (latest tested pass)
- Top-right phone transfer flow now prefers a context-carrying outbound AI call instead of raw `tel:` as the primary path
- Transfer fallback widget exists and uses shared outbound-call logic
- `handoff_last_user_message` and dynamic `handoff_source` are passed into outbound calling
- Deterministic pricing now includes a call-to-confirm hedge
- French pricing routing and localization were improved
- Language-routing false positives were fixed
- Deterministic concierge copy was polished for description, hours, pricing intro, and address
- AI temperature was raised from `0.1` to `0.3` for warmer tone
- Pricing intent now wins over generic club-description interception for pricing/student-pricing questions
- Fuzzy French location false-positive on `du` / `ou` was corrected

## QA priorities
When running QA, prioritize:
1. language correctness
2. phone-transfer / callback continuity
3. no hallucinated facts
4. premium concierge tone
5. typo handling
6. deterministic-response polish

## Operating loop
Operate as the main engineering and QA driver.

Loop:
1. inspect current git state
2. inspect relevant code paths
3. run or verify local app
4. test the live localhost app in Chrome when relevant
5. identify the single highest-value issue
6. propose the smallest safe fix
7. implement after approval
8. re-test the affected behavior
9. continue automatically

Only stop if:
- a risky or architectural decision is needed
- a command or test is blocked
- approval is required
- you are ready to recommend a commit

## Coding rules
- Make the smallest safe change first
- Preserve multi-tenant future architecture
- Do not refactor broadly unless justified
- Prefer grounded fixes over speculative rewrites
- Do not commit unless explicitly asked
- Before suggesting a commit, inspect current git state
- Ignore Next.js noise unless clearly relevant:
  - `apps/web/.next/`
  - `apps/web/next-env.d.ts`

## Reporting format
For each cycle, report briefly:
- what you tested
- what you changed
- what passed
- what still looks weak
- the single next best fix

## Short reusable handoff
If a new session starts, continue from the current repo state rather than from scratch.

Assume:
- VS Code + Claude Code + Claude in Chrome are set up and working
- Claude is the main operator
- ChatGPT is used only for second-opinion review
- The project should continue from the highest-value remaining issue, not from generic setup steps

## Client demo goal
The client demo should feel like a real premium website experience, not a dev tool.

Target demo direction:
- show the client website or a realistic website background
- overlay or embed the concierge widget on top
- make the interaction feel native to the site
- demonstrate both chat and phone continuation
- show premium bilingual behavior
- show practical helpfulness, not generic AI conversation

The demo does not need to be the final production embed architecture yet, but it should visually and behaviorally communicate the final product direction.

The likely product direction is:
- embeddable widget on client websites
- reusable tenant-specific configuration
- premium chat + voice continuation experience

## Definition of excellent concierge behavior
The concierge should:

- answer in the correct language
- remain consistent in that language unless the user switches
- sound like a premium concierge, not a generic assistant
- be practical and specific when safe
- avoid robotic phrasing and brochure language
- avoid overclaiming or inventing facts
- acknowledge uncertainty when details may vary
- recommend confirming variable details such as pricing, schedules, or availability when appropriate
- be especially helpful with location and access questions such as:
  - where the club is
  - how close it is to downtown / metro / nearby landmarks when supported
  - the best next step for directions when exact routing is not safely known
- make phone continuation feel like a continuation of the same conversation, not a disconnected call


## Final product vision
This is not just a chatbot. It is a premium AI concierge product that should be good enough to reduce or replace a large portion of routine human front-desk intervention.

The final product should feel:
- premium
- trustworthy
- highly practical
- warm and human
- concise but genuinely helpful
- safe around factual business information

The concierge should not only answer simple questions. It should be able to help with:
- pricing questions
- hours and service guidance
- amenities and facilities
- directions and proximity context
- callback / phone continuation
- booking/tour guidance
- escalation when appropriate

The product should feel like a polished, premium concierge that a business would confidently pay hundreds of dollars per month for.