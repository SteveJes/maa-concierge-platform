# MAA Knowledge Base v2 — Daphné edition

**Authoritative structured knowledge for the MAA tenant.** Replaces the old crawler output + `tenant-core-facts.json` data. Source: Daphné's manual compilation (PDF + email), processed page-by-page.

## Why v2 exists

The v1 ingestion pipeline (crawler + `unpdf` flat text extraction) lost almost everything that matters for a premium concierge: table structure, hyperlinks, staff names, role-to-email mapping, instructional flow. The bot ended up knowing <5% of what's actually on the MAA website. Daphné rebuilt the knowledge base by hand from the source pages. This folder encodes her work in a format the concierge can reason over.

## Shape

```
maa-v2/
├── index.json          ← table of contents, page map, last-updated, version
├── sections/           ← one JSON per topical section
│     hours.json
│     services.json
│     pricing.json
│     amenities.json
│     access.json
│     pickleball.json
│     restaurant.json
│     fitness-classes.json
│     wellness.json
│     ... (expanded as the PDF is processed)
├── staff.json          ← name → role → email + when to route a lead to them
├── links.json          ← every URL Daphné references + intent ("book a tour", "menu PDF", "schedule grid")
└── tables/             ← structured tables (pickleball weekly grid, class schedule, price matrix)
```

## Lead routing — TEMPORARY

While we calibrate, every staff email in `staff.json` is shadow-routed to **stevejes@gmail.com + Daphné** instead of the real recipient. This prevents premature noise inside MAA. We flip to real recipients once Daphné signs off.

## How to read this folder

The concierge consults this folder via the retrieval layer (TODO: rewire). Every claim in a concierge answer should be traceable to one section/staff/link/table entry — that's the citation contract.

## Not finalized yet

This folder is being populated section-by-section as Claude reads Daphné's PDF. Until `index.json` has `status: "complete"`, treat the bot's grounding as partial.
