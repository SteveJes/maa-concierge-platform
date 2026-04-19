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