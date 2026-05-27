# MAA override layer

Created 2026-05-27 from Daphné's batch (`apps/web/public/DAPHNE 27 05 2026/`).

## Why this exists

Per Daphné's `PROMPT POUR CLAUDE _ MAA.pdf` (32 pages):

> Ne jamais modifier, supprimer ou réécrire directement l'ancienne base de connaissances MAA.
> Créer ou renforcer une couche prioritaire appelée `maa_override_layer`.

Files in `../sections/` describe the **product** (descriptive, brand voice, categories,
general context). They must never be edited to "fix prices".

Files in **this folder** carry the operational ground truth that changes over time:
prices, schedules, contacts, URLs, session dates, member-vs-guest access. When the
override contradicts the base, the override wins for operational answers.

## Shape

Each entry uses these fields (subset of `MaaSourceRegistryItem` in the main prompt):

```json
{
  "service_id": "massotherapie",
  "tenant_id": "maa",
  "schedule_status": "DATED_CONTENT",
  "source_type": "PDF_SEASONAL",
  "source_url": "...",
  "booking_url": "...",
  "valid_from": "2026-04-23",
  "valid_until": null,
  "last_reviewed_at": "2026-05-27",
  "confidence_level": "high",
  "primary_contact": "clinique_sportive",
  "allowed_cta": ["book_fliip"],
  "forbidden_cta": ["visit_club"],
  "fallback_rule": "Si Fliip indisponible, poste 234",
  "data": { ... }
}
```

`schedule_status` values (from Daphné's section 9):
- `LIVE_DATED` — schedule valid for a precise window; serve only inside the window.
- `STATIC_PUBLISHED` — published on a page; serve as reference, not real availability.
- `REALTIME_EXTERNAL` — availability must be checked on an external platform; never invent.
- `NO_SCHEDULE_PUBLISHED` — no reliable schedule; route to contact, never say "je ne sais pas".
- `DATED_CONTENT` — useful but dated (menu, PDF grid); flag if stale.
- `STALE` — past `valid_until`; do not present as current.
- `UNKNOWN` — undetermined.

## Status (Phase 1 — 2026-05-27)

Data is written; **not yet wired into the loader**. The override-aware reader and
RAG filter come in Phase 2. Until then the existing v2 base still serves answers,
unchanged.
