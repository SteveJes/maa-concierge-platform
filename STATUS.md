# STATUS — MAA Concierge Platform

## Current branch
- `feat/maa-web-ingestion-v3`

## Current operating model
- Claude is the main operator
- ChatGPT is used only for second-opinion review
- `CLAUDE.md` is the permanent project rules / product memory
- This file (`STATUS.md`) is the live project state

## Latest committed milestone
- `571300e` feat: polish booking flow, fix routing false positives, and refine concierge copy

## Latest completed work (committed in 571300e)
- MAA-branded demo page replacing dev scaffold (dark green, gold logomark, French hero)
- Verified club facts anchored in system prompt (phone, address, extension 234)
- Phone extension hallucination fixed ("poste 0" explicitly prohibited)
- Cancellation misrouting fixed: membership cancel no longer triggers massage policy
- Booking intent tightened: standalone "appointment"/"visit" no longer trigger calendly
- Hours false-positive fixed: removed hasApproxTokenSet(['your','hours'])
- Location false-positive fixed: removed hasApproxTokenSet(['where','club'])
- French offerings false-positive fixed: removed vous/avez, vous/offrez pairs
- Bilingual hours detection: French locale users writing English hours questions now routed correctly
- Call-to-confirm hedge added to all schedule answers
- Schedule and policy copy: removed all "retrieved" language
- Callback fallback button wired in UI booking flow
- 14/14 QA tests passing

## Current uncommitted work (this session — not yet committed)
- Playwright e2e suite: 13 tests in `e2e/concierge.spec.ts` + `playwright.config.ts`
- Widget accent color prop (`accentColor`) threads tenant brand color through all buttons
- Floating widget mode (`mode="floating"`) — fixed-position launcher bubble + panel
- Mobile nav overflow fix: `className="maa-nav"` + `@media (max-width:600px)` in globals.css
- French locale detection: removed loanwords (yoga/spa/gym) from EN signals; added French function words to FR signals
- `looksLikeClassScheduleQuestion` escape hatch in core-facts.ts (yoga/cours/class queries bypass generic hours response)
- `looksLikeClassScheduleQuestion` guard also added to club-description path (yoga queries bypass generic description response)
- `looksLikeBookingIntent` tightened: "schedule" requires "schedule a/an/my" (verb use only)
- Group classes PDF ingested + indexed: `MAA_CoursEnGroupe_HoraireClassifications_2070Peel_Apr6-26.pdf` (6 new chunks, doc 52)
- `NOCODB_TABLE_INGESTION_RUNS` env var fixed (was stale ID `m3qsgpqtr30suyi`, now correct `m5pw6b8u7xci85m`)

## Current product priorities
1. Strong web chat experience ✓ (functional + demo-ready shell + class schedule intelligence added)
2. Strong AI phone continuation / callback experience ✓
3. Premium concierge tone ✓ (ongoing QA)
4. No hallucinated business facts ✓
5. Reusable multi-tenant architecture (next major milestone)

## Next likely priorities
1. KPI tracking: populate `outcome`, `summary`, `needs_followup` fields on conversations in NocoDB
2. KPI analytics endpoint: conversations/day, language split, follow-up mode distribution, callback rate
3. Fix messages table field mapping (server writes `follow_up_mode`/`citations_json`/`retrieval_json` but schema may differ)
4. Commit this session's batch once stable

## Important constraints
- Default French, switch to English if user clearly uses English
- Never hallucinate pricing, schedules, availability, booking confirmations, or callback confirmations
- If pricing / schedules / availability may vary, say so and recommend confirming by phone
- Keep multi-tenant future architecture in mind
- Ignore Next.js dev noise
- Do not commit `.claude/`
- Keep `apps/web/next.config.ts` if LAN/phone testing is still needed

## Session start rule
At the start of every session:
1. Read `CLAUDE.md`
2. Read `STATUS.md`
3. Inspect `git status --short`
4. Inspect recent commits
5. Continue from the highest-value remaining issue

## Session end rule
At the end of every meaningful pass:
1. Summarize what changed
2. Summarize what passed
3. Summarize what still looks weak
4. Update `STATUS.md`
5. Recommend commit only if the batch is stable
