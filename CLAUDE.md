# MAA Concierge Platform

You are continuing an active engineering and product build. Do not restart from scratch. Do not re-suggest already completed work unless a real bug requires it.

## Project identity
- Project: MAA Concierge Platform
- First tenant: Club Sportif MAA, Montreal
- Goal: premium bilingual AI concierge for web chat and voice, with future multi-tenant expansion

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

## Monorepo structure
- `apps/api`
- `apps/web`
- `packages/ui-chat`

## Important files
- `apps/api/src/server.ts`
- `apps/api/src/core-facts.ts`
- `apps/api/src/prompts/maa-chat-system.ts`
- `apps/api/src/services/maa-chat.ts`
- `apps/api/src/services/maa-pricing.ts`
- `apps/api/src/tenant-core-facts.json`
- `packages/ui-chat/src/index.tsx`

## Important environment note
- Actual env file: `apps/api/.env.local`

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