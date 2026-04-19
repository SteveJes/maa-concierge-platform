# STATUS — MAA Concierge Platform

## Current branch
- `feat/maa-web-ingestion-v3`

## Current operating model
- Claude is the main operator
- ChatGPT is used only for second-opinion review
- `CLAUDE.md` is the permanent project rules / product memory
- This file (`STATUS.md`) is the live project state

## Latest committed milestone
- `eea00fd` feat: polish booking flow, fix routing false positives, and refine concierge copy

## Latest completed work (committed in eea00fd)
- Book-a-tour message no longer exposes raw URLs — points to button below
- Booking callback fallback toggle wired in UI ("Prefer a callback instead?")
- Fuzzy false positives fixed: `there`→`where`, `your`→`hours` (both caused wrong routing)
- `abonement` one-n typo recognized as pricing intent
- Schedule answers: removed "retrieved" phrasing, added call-to-confirm hedge
- Policy answers: removed all "retrieved evidence" language
- System prompt strengthened: banned phrase list, correct club name rule
- Pool/location routing re-verified
- Both typechecks passed

## Current uncommitted work (demo polish pass)
- `apps/web/src/app/page.tsx` — replaced dev scaffold with branded MAA demo page
  - Dark green premium theme (#0d1f17) matching MAA brand
  - Sticky header with gold MAA logomark + nav links
  - Hero section with French tagline and club address
  - Widget centered in dark branded layout
  - Footer with club address and phone
- `apps/web/src/app/layout.tsx` — title "Club Sportif MAA — Concierge IA", lang="fr", Next.js Metadata type
- `apps/web/src/app/globals.css` — dark color scheme, antialiased text
- `packages/ui-chat/src/index.tsx`:
  - Initial message: changed from system→assistant role, now warm French welcome
  - Transfer button subtitle: concierge copy instead of dev instruction

## Current product priorities
1. Strong web chat experience ✓ (functional + demo-ready shell)
2. Strong AI phone continuation / callback experience ✓
3. Premium concierge tone ✓ (ongoing QA)
4. No hallucinated business facts ✓
5. Reusable multi-tenant architecture (next major milestone)

## Next likely priorities
1. Commit demo polish batch
2. QA the full live demo page in browser (visual + interaction)
3. Vapi continuation message copy polish
4. Mid-conversation language switch verification
5. Consider: widget accent color prop per tenant (multi-tenant prep)
6. Consider: floating/overlay embed mode vs full-page embed

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
