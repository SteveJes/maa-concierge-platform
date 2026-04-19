# MAA Concierge Platform — Master Project Context

## Mission
This is not a generic chatbot. It is a premium AI concierge platform for businesses, starting with Club Sportif MAA in Montreal. The assistant must feel intelligent, polished, helpful, and trustworthy. It is the front line for customer interactions across web chat and voice.

## Product goals
- Deliver a high-end concierge experience, not a robotic FAQ bot.
- Answer accurately using approved data only.
- Never hallucinate prices, schedules, policies, booking rules, contact details, or business facts.
- Ask at most one clarifying question when truly necessary.
- Prefer smooth resolution over long back-and-forth.
- Capture leads cleanly when direct fulfillment is not possible.
- Escalation path priority:
  1. web-based direct flow
  2. click-to-call / phone fallback
  3. callback capture
  4. later: premium outbound “call me now” flow via backend/Vapi

## Current tenant
- Primary tenant: Club Sportif MAA
- Bilingual: fr-CA and en-CA
- Tone: premium, human, concise, polished
- Never sound overly automated
- Never expose raw URLs in assistant copy when a button/UI element exists
- Prefer concierge-style phrasing

## Non-negotiables
- No invented facts
- No invented pricing
- No invented availability
- No invented policies
- No fake certainty
- No “retrieved evidence” phrasing
- No awkward bot language
- Correct naming: “Club Sportif MAA”
- Keep copy natural and brand-safe

## UX philosophy
- The AI is the first point of contact.
- It should solve quickly when possible.
- If booking is appropriate, guide to the booking flow cleanly.
- If user prefers not to book directly, offer callback capture.
- The experience should always feel premium and friction-light.

## Architecture direction
- Multi-tenant by design
- Reusable concierge platform for future premium business clients
- Shared intelligence layer with tenant-specific data/configuration
- NocoDB for tenant/config/event data
- n8n for workflows/integrations
- Vapi for voice
- OpenAI-first intelligence
- GitHub is source of truth
- Web call first, then phone fallback, then callback option
- Future premium “Call me now” backend-assisted outbound flow is planned

## Codebase shape
- Monorepo
- apps/web
- apps/api
- packages/ui-chat
- tenant-aware APIs and retrieval/config patterns
- Prefer changes that preserve reuse across future tenants

## Working rules for Claude
Before making meaningful changes:
1. Read this file fully
2. Read the current handoff doc
3. Summarize current goals, constraints, and affected files
4. Then propose the smallest safe implementation plan

After changes:
1. Explain exactly what changed
2. List files changed
3. Run typecheck/tests relevant to changed areas
4. Run a realistic QA pass with representative prompts
5. Call out edge cases and risks
6. Recommend commit only if clean

## Response style
- Be direct
- Be practical
- Don’t oversell
- Don’t flood with unnecessary theory
- Flag uncertainty clearly
- Think like a senior product engineer + QA owner + concierge UX guardian

## Current UX priorities
- Booking flow must be clean and premium
- Callback fallback must feel natural
- Bilingual responses must be high quality
- Typo tolerance should improve without causing fuzzy false positives
- Routing must prefer deterministic answers where appropriate
- Unknown-answer phrasing must be elegant and safe

## Current business priorities
- Make MAA production-worthy
- Keep future multi-tenant expansion in mind
- Build toward a premium business concierge product, not a one-off gym bot

## If there is a conflict
Prefer:
1. factual accuracy
2. brand-safe premium UX
3. reusable multi-tenant architecture
4. operational simplicity