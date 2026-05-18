# Golden test set — Daphné-editable YAML

This directory holds **human-editable** scenario YAML files that Daphné, Steve, or any
non-engineer reviewer can add to or revise without touching TypeScript.

Each YAML file produces ONE scenario. The loader at
`apps/api/src/scenarios/golden/loader.ts` reads every `*.yml` in this directory,
converts it to the canonical `Scenario` type used by the Sentinel runner, and
appends the result to the existing in-code scenario list. That means a golden
YAML scenario runs through the same harness, the same LLM judge, the same
markdown report — no new infrastructure to learn.

## File naming

`{tenant}-{category}-{nnn}.yml` — e.g. `maa-pricing-007.yml`,
`maa-sales-objection-003.yml`, `dubub-pricing-001.yml`. The numeric suffix
makes sorting deterministic; the category is free-form but should match one
of the Sentinel categories (`pricing`, `sales_objection`, `french_qc`,
`hallucination_trap`, `safety_privacy`, `lead_capture`, `memory_context`).

## Schema

```yaml
id: qc-pricing-001                    # globally unique
tenant: maa                           # maa | dubub
language: fr-CA                       # fr-CA | en-CA
persona: "Client potentiel au Québec" # human-readable scenario protagonist
category: pricing_objection           # routing tag
phase: 3                              # optional 1..4 (Daphné's pass)

# Prior turns (optional) — use when testing multi-turn behaviour
history:
  - role: assistant
    content: "Pour la nage libre, l'horaire est..."
  - role: user
    content: "Quelqu'un peut-il me donner les détails ?"

# The user's FINAL message we're testing
message: "Pourquoi votre service coûte 1700$ CAD?"

# What the bot MUST do
expected_facts:
  - "Explains value beyond a basic chatbot"
  - "Mentions customization, knowledge base, automation, setup/support"
  - "Does not promise guaranteed revenue"

# Tone targets — graded by the LLM judge
tone:
  - professional
  - confident
  - quebec_friendly

# Phrases the bot must NEVER produce
forbidden:
  - "sounds cheap"
  - "just ChatGPT"
  - "guaranteed revenue"

# Optional structural assertions
followup_mode_required: [clarify, done]   # bot must end in clarify/done
followup_mode_forbidden: [callback, vapi] # bot must not auto-open lead form

# LLM judge rubric — yes/no. Expected answer is the GOOD outcome.
judge_rubric:
  question: "Does the answer justify the price with concrete capabilities?"
  expected: yes

# Minimum overall score from the LLM judge (0..1)
pass_threshold: 0.85
```

## Language coverage — FR-Quebec + EN + bilingual switching

Every category must have coverage in all three flavours. The concierge serves
French-Canadian visitors first, but the platform is sold as bilingual — an
English-only visitor must get the same premium experience, and a visitor who
starts in one language and switches mid-conversation must be followed cleanly.

For each new category, target this matrix:

| Variant | Filename suffix | What it checks |
|---|---|---|
| FR-Quebec only | `-fr-qc` | Daphné's tone, Québec vocabulary, accents render cleanly. |
| EN-Canada only | `-en` | Natural Quebec-English (not UK/US), no French leakage, /en/ URL preference. |
| FR → EN switch | `-switch-fr-to-en` | User opens in FR, then writes a turn in EN — bot switches and stays. |
| EN → FR switch | `-switch-en-to-fr` | Mirror of the above. |

The harness reads each YAML's `language` field, sets that locale on the
request, and the judge rubric assertions are language-aware (`tone.quebec_friendly`
on FR, `tone.quebec_english_natural` on EN).

Forbidden phrases to watch for in EN replies:
- French leakage: any `\béquipe\b`, `\bvotre\b`, `\bn'hésitez pas\b` showing up.
- UK English: "whilst", "amongst", "colour", "centre" — we use US-Canadian.
- France-French translations slipped through: "courriel" / "magasin" — keep EN as EN.

Forbidden phrases to watch for in FR replies:
- English leakage: any uncommented "the", "and", "with", "please" tokens.
- France-French in a QC reply: "courriel" is fine, but watch for "magasin", "soixante-dix" (numeric is fine), "weekend" (we say "fin de semaine" in QC).
- Anglicisms in lead-capture prompts: never say "bookez", always "réservez".

Translation anchors live in `apps/api/src/prompts/maa-chat-system-v2.ts::bilingualBlock()`.
When a Daphné FR instruction has no EN counterpart, the YAML scenario itself
encodes the expected EN behaviour so the bot never falls back to a translated
French paragraph.

## Source flow — what to base scenarios on

1. **Daphné's manual test logs** — every time she catches a bot regression
   in production, capture the conversation as a YAML scenario. Don't lose
   the test that found a real bug.
2. **Production conversation queue** — anonymised real chats classified as
   low-confidence / bad-tone / safety-flag by the live monitor (when we wire
   it up). Daphné approves which ones become permanent regression tests.
3. **Failure-type buckets** — every time the markdown report shows a
   `source_leak` / `premature_callback` / `french_localization_issue` we
   didn't already have a YAML scenario for, write one.

## When to write a YAML scenario vs an in-code one

- **YAML (this folder)**: anything Daphné or a non-engineer should be able
  to author and review. Pricing objections, tone tests, French-QC checks,
  category routing, hallucination traps.
- **In-code (`apps/api/src/scenarios/maa.ts`, `dubub.ts`)**: anything that
  needs custom RegExp logic, programmatic test generation, or coupling to
  internal types. Keep this list small.

## Running

```
pnpm.cmd --filter @platform/api test:scenarios            # all scenarios
pnpm.cmd --filter @platform/api test:scenarios --tenant maa
pnpm.cmd --filter @platform/api test:scenarios --judge    # adds LLM judge
pnpm.cmd --filter @platform/api test:scenarios --live --url https://api.dubub.com
```

Every run drops a JSON + Markdown report in `_sentinel-runs/` AND surfaces in
the admin dashboard's Sentinel panel.
