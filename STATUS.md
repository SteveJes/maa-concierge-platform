# STATUS — MAA Concierge Platform

## Current branch
- `feat/maa-web-ingestion-v3`

## 2026-05-14 — MAA Knowledge Base v2 rebuild (Daphné PDF source)

**Major architectural shift.** v1 ingestion (crawler + `unpdf` flat text into `tenant-core-facts.json`) captured ~5% of MAA's actual website content. Daphné manually compiled the **full** website into a 203-page PDF + canonical-link email and dropped them at `apps/api/_inbox/daphne-maa-v1.pdf` (gitignored). We're rebuilding the MAA brain from her source as structured JSON.

### Encoded so far (META layer + first batch of operational sheets)

`apps/api/src/knowledge/maa-v2/`:
- **META** — `rules.json` (4-tier confidence model + forbidden+replacement phrases + concierge identity + master 7-step conversation rule), `intents.json` (8 intents), `clarifications.json` (10 vague words), `confusion-zones.json` (10 ambiguities incl. pool-hours contradiction + restaurant-phone mismatch), `ctas.json` (10 soft CTAs), `contacts.json` (12 contacts), `staff.json` (shadow routing to stevejes@gmail.com), `sources-vivantes.json` (hours + 17 prices with confidence), `links.json` (canonical URLs), `voice-tone.json` (Daphné's full tone guide), `categories.json` (per-category playbook for 9 services)
- **Sections** — `sections/abonnement.json`, `sections/cours-en-groupe.json`, `sections/cours-specialite.json` (Cirque/Fitness aérien/Natation adulte/PowerWatts full pricing), `sections/sports.json` (basketball schedule, pickleball 28 timeslots, run club, triathlon, personal training, aquatic programs, training rooms, squash, Pilates reformer)
- **Bilingual independence**: every visitor-facing field is `{ fr, en }` BiString. Daphné is not sending an English version — we translated intelligently ourselves. `pickLocalized(b, locale)` in the loader picks per locale.

### Consumption layer
- `apps/api/src/knowledge/maa-v2/loader.ts` — typed reader + `resolveLeadRecipients` shadow router.
- `apps/api/src/prompts/maa-chat-system-v2.ts` — full v2 prompt (58 KB) consuming everything above.
- Feature flag in `apps/api/src/services/maa-chat.ts:resolveTenantSystemPrompt`: `KNOWLEDGE_VERSION=v2` switches MAA to v2. **Off by default** — v1 stays live until v2 is fully encoded.

### Tooling
- `apps/api/src/scripts/ingest-daphne-pdf.ts` — Phase A extractor: 203 pages, 387 hyperlinks, 48 pages auto-flagged as needing vision-based extraction.
- `apps/api/src/scripts/inspect-daphne-pdf.ts` + `dump-daphne-pages.ts` — navigation helpers.
- `apps/api/src/scripts/compare-v1-v2.ts` — side-by-side prompt comparison (FR + EN). Persisted: `_inbox/_extracted/v1-v2-comparison-2026-05-14.txt`.

### Validation — v1 vs v2 comparison results
- v2 demonstrably beats v1 on: vague-word handling ("Je veux réserver" → v2 asks Daphné's clarification question; v1 dumps assumptions), English bilingual ("I need care" → v2 asks "massage, physio, osteo, nutrition, medical, nursing?" in natural English; v1 dumps services), soft CTAs (proper end-of-reply by service).
- v2 ties with v1 on cases that hit deterministic short-circuits — NOT v2 failures, just paths where v1 wins before the prompt fires:
  - Pricing: `tryAnswerPricingQuestion()` in `apps/api/src/services/maa-pricing.ts` short-circuits the prompt. Future pass: point at v2/sources-vivantes.
  - Pool hours (contradictory): RAG retrieval has the 7h-20h fact from old crawled data; LLM trusts evidence over v2's "this is contradictory" warning. Future pass: retire old hours retrieval; v2 META owns pool hours.

### What's not yet encoded from the PDF
Pages 32-203 (~170 pages of operational content): clinique-spa-détente, restaurant detail, demo schedule (May 18-21 2026), pool detail, more class details, pickleball detail page, Pilates Reformer, clinique services breakdown (thérapie sportive / massothérapie / ostéopathie / physiothérapie / nutrition / médical / nursing), community, history, boutique, media, affiliated clubs (~100 clubs worldwide), restaurant menus, suggested responses by intent, master link list.

### What's not yet wired (next-session work)
- Phase B vision-render for the 48 flagged table pages (schedule grids + price tables)
- Point `maa-pricing.ts` short-circuit at v2 sources-vivantes
- Retire old hours retrieval — v2 META takes over with contradiction handling
- Lead-routing pipeline: visitor accepts soft CTA → capture name+email+question → email to stevejes@gmail.com (shadow recipient)
- VAPI parity: regenerate Sophie-MAA + SophIA voice prompts once v2 is stable; paste into VAPI dashboard
- Retire v1 ingestion (`apps/api/src/ingestion/maa-pdf.ts` + `tenant-core-facts.json`) once v2 is fully live

## 2026-05-14 — Demo-ready milestone (v2 LIVE on prod, premium UI shipped)

`KNOWLEDGE_VERSION=v2` is now the default in `resolveTenantSystemPrompt` — MAA on production runs from the v2 brain. No env override needed; set `KNOWLEDGE_VERSION=v1` for emergency rollback.

### Premium UI shipped (commits c6f6876, 088ea02, 82e83f3)

`packages/ui-chat/src/index.tsx`:
- **Peeking launcher tab** anchored to the right edge — gold-bordered card with bell icon, "CONCIERGE IA PAR DUBUB" brand line, "Sophie vous accueille" greeting, green-pulse "Disponible maintenant", chevron. Bilingual.
- **5-layer "out of this world" open animation**: backdrop blur (450ms) → panel spring-slide with overshoot (650ms cubic-bezier) → gold border glow pulse on arrival (900ms) → diagonal gold light-sweep crosses panel once (1.5s) → 5 CTA buttons stagger-fade-in 80ms apart.
- **Suggested-question CTAs restyled** as premium dark cards with gold borders + chevrons.
- **MAA quick-action CTAs** match the mockup: Réserver un entraînement privé / Horaire de pickleball / Réserver une visite du club / Comparer les abonnements / Services du spa (FR + EN).

### Sections encoded for demo (commits 6f08794, 0c0ee81, 82e83f3)

`apps/api/src/knowledge/maa-v2/sections/`:
- abonnement.json — membership rates + inclusions + extras + promotions
- cours-en-groupe.json — group class families + 75+/week rule + class types
- cours-specialite.json — Cirque, Fitness aérien, Natation adulte, PowerWatts with full pricing
- sports.json — basketball schedule, pickleball 28 timeslots, run club, triathlon, personal training, aquatic, training rooms, squash, Pilates reformer
- restaurant.json — full menu (entrées/salades/plats/desserts/brunch/extras/boissons), chef Gary Rizk, wine-list rule
- clinique-spa-detente.json — 3 entities (clinic / Mobile Mediq / spa) with price-table-confusion warning
- pool.json — Espace O Spring 2026 schedule with site/PDF hours contradiction made explicit
- visite-club.json — booking-visit flow + sales angle
- clinique-services.json — 8 sub-services with practitioners, prices, safety rules

### Loader fix (commit 088ea02)
Production runs API from `dist/`, but tsc doesn't copy JSON. Loader now strips `/dist/apps/api` from `__dirname` so prod reads JSON from the deployed `src/` tree.

### Live-verified on https://api.dubub.com
- FR pickleball CTA → 28 timeslots, Nathalie Lambert poste 231, soft CTA ✅
- FR spa CTA → bain à remous on toit, terrasse, bain vapeur, sauna finlandais, premium tone ✅
- FR memberships CTA → 225/185/195/295 with "actuellement" + inclusions ✅
- EN "I need care" → Daphné's clarification in natural English ✅

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
- API regression `test-maa-intent-regression.ts`: **57/57 PASS** (local) — includes 12 third-pass + 10 fourth-pass + 10 fifth-pass cases (sixth-pass case #15 updated for new no-form behavior)
- API regression `test-dubub-intent-regression.ts`: **12/12 PASS** (local)
- **Sentinel scenario harness** (sixth + seventh pass): **48/48 PASS** in-process with LLM judge enabled by default — 44 MAA + 4 DUBUB. Runner asserts on structured fields (intent, followUpMode, suppressBookingCta) + regex + LLM judge + multi-turn `history`. Persists every run per tenant to `_sentinel-runs/`. Catches semantic bugs regex misses (price contradictions saying "around", restaurant in inclusion sentence, callback-default after "no form", grammar-broken opener "Daphné est situé"). Run: `pnpm.cmd --filter @platform/api sentinel:run`.
- Playwright `daphne-regression.spec.ts` against **prod** (`Desktop Chrome`): **19/21 PASS + 2 flaky** (#1, #16) — flaky cases pass on retry; AI nondeterminism on edge phrasings, not bypass bugs
- Mobile device matrix: iPhone 15 Pro Max, iPhone 14, iPhone SE, Pixel 7, Pixel 5, Galaxy S23, Galaxy S9+, Xiaomi Redmi Note 12 — runnable via `pnpm.cmd e2e:daphne:mobile:prod`
- Mobile Daphné regression on prod (`iPhone 14`, `iPhone SE`, `Pixel 7`, `Galaxy S23` × 21 cases): **82/84 passed** + 1 flaky + 1 brittle pattern (#1 cheapest price). Safety overrides hold across all surfaces.
- Lightweight intent unit check (no AI): `pnpm.cmd --filter @platform/api exec tsx src/scripts/check-intent-unit.ts` — verifies regex/derive logic in <1s.

## Daphné seventh pass — 2026-05-11 (polish + Sentinel product launch)
Daphné's `apps/web/public/daphne-seventh.md` is the polish round before manual conversational QA. She's impressed with overall progress. Two tracks landed in one ship:

**Track A — Conversational polish:**
- **Pickleball schedule routing** (#4) — Daphné's screenshot of the actual schedule is now encoded in the MAA prompt as authoritative: 28 timeslots/week, member-only, 2-4 players, day-by-day grid, paddle rental at reception. `isPickleballScheduleQuestion` bypasses the deterministic hours handler so the bot no longer answers with club / pool / spa hours.
- **Yoga / discount / pickleball / group-class CTA gating** (#5, #6) — `deriveSuppressBookingCta` extended: à-la-carte / drop-in / sans-abonnement / group-class names (yoga, pilates, spin, HIIT, etc.) / pickleball-schedule / gym-access / multi-category discount / quick-info-no-form all suppress the visit CTA.
- **English CTA in fr-CA widget** (#7) — `packages/ui-chat` detects message-language mismatch and hides the CTA when the bot answers in English on a French-locale widget.
- **Vague-topic clarification** (#1) — new detector `isVagueTopicRequest` fires for "j'ai une demande concernant X"; injects a context that demands one short clarification question, never a generic fiche.
- **Broken-grammar guard** (#8) — bot used to start with "Daphné est bien situé sur place..." (user name as inanimate-object subject). userNameLine instruction strengthened + `fixBrokenGrammarSubject` post-process strips/rewrites the broken opener.
- **Repetitive ending strip** — `stripDuplicateRestaurantSeparation` removes duplicate "Le restaurant Le 1881 est disponible sur place, payé séparément." appends.
- **Natural uncertainty wording** (Rule 5) — `softenUncertaintyWording` replaces "Je ne vois pas d'X confirmé dans mes sources actuelles" with warmer phrasings.
- **Gym access membership-unknown** (#10) — bot was leading with "Vous pouvez accéder" without qualifying. New `isGymAccessMembershipUnknown` detector + context: "Si vous êtes membre, vous avez accès... Pour un accès non-membre ou invité, l'équipe pourra confirmer."
- **9 new seventh-pass scenarios** added — 48/48 scenarios pass.

**Track B — Sentinel product launch:**
- Premium AI-quality watchdog product, included by default for every tenant.
- **LLM judge enabled by default** — opt out with `--no-judge` or `SENTINEL_JUDGE_DISABLED=true`. Auto-disabled when OPENAI_API_KEY missing.
- **Auto-generator** (`apps/api/src/scripts/sentinel-generate.ts`) — OpenAI proposes N edge-case scenarios per tenant, anchored on existing scenarios + safety rules + recent failures. Outputs to `apps/api/src/scenarios/generated/{tenant}-{date}.ts` (gitignored, human review only).
- **Run persistence** — every test-scenarios run writes one JSON file per tenant to `apps/api/_sentinel-runs/`.
- **Admin API endpoint** — `GET /v1/admin/sentinel/runs?tenant=<code>&limit=N` returns run history with summary stats + failure list.
- **Dashboard panel** — `SentinelPanel` in the admin dashboard. Per-tenant view: last run, pass rate, scenarios passed/total, failed, mode, judge state, run history with expandable failures.
- **Tenant isolation** is structural: tenantCode on every scenario, every run file, every admin filter.
- **French marketing copy** at `apps/web/public/sentinel-description-fr.md` for Daphné / sales conversations.

## Daphné sixth pass — 2026-05-11 (pre-demo final)
Daphné's `apps/web/public/daphne-sixth.md` was the final ChatGPT-assisted review before manual conversational QA. The biggest remaining demo blocker was pickleball booking ("booker un terrain de pickelball pour demain soir") still collapsing into the visit-template. Highlights of what shipped:

- **Pickleball typo coverage** in `server.ts` `looksLikeBookingIntent` — `pickelball|pickball|pickle[- ]?ball` now match the serviceSpecific exclusion. The leak was that maa-chat.ts had these typos but server.ts didn't, so `hasExplicitBookingIntent` came back true and overrode the AI's careful answer.
- **`suppressBookingCta` is now AUTHORITATIVE** in `server.ts` — the safety net that flips `calendly → clarify` no longer requires `!hasExplicitBookingIntent`. Backend-derived flag wins. This is the structural invariant for the booking-CTA gating.
- **New `price_contradiction` critical intent** (Daphné #2) — detects "j'ai vu 215 $ mais tu m'as dit 225 $", routes to `clarify`, gives an intent context demanding exact source price + acknowledged discrepancy. Post-process guard strips "autour de"/"around"/"environ"/"approximately" so the bot states exact values.
- **New `clinical_pain` critical intent** (Daphné #5) — detects pain/injury queries (mal au genou, douleur dos, etc.) AND physio/trainer triage questions. Intent context FORBIDS named diagnoses. Post-process guard hard-replaces the message if any of these slip through: arthrite, syndrome patello-fémoral, tendinite, hernie discale, sciatique, capsulite, chondromalacie, ACL/MCL/LCL, ménisque déchiré, etc.
- **`membership_downgrade` regex bug fix** — `/\bchang\b/` failed to match "changer" because `\b` doesn't sit between 'g' and 'e'. Now `chang\w*|baiss\w*|r[eé]duir\w*|diminu\w*|modifi\w*`. Same trap on `\bcorporati\b` (didn't match "corporatifs") — fixed.
- **Course count source lock** (Daphné #3) — MAA prompt now states "more than 75 classes per week" as authoritative. Post-process guard rewrites any AI-emitted `175 cours|classes|séances` to `plus de 75 cours par semaine` automatically (works across all tenants).
- **Multi-category discount bypass** (Daphné #8) — when the user asks about discounts across multiple categories in one message (rabais étudiants/corporatifs/familiaux), the deterministic pricing handler is bypassed and the AI gets a context that demands each category get its own sentence — confirmed (student/senior) and not-confirmed-in-source (corporate/family).
- **Quick-info / no-form bypass** (Daphné #7) — `juste savoir vite|pas remplir un formulaire|no form|quick (answer|question)|just want to know` skips deterministic handlers + hard-overrides any callback/calendly mode back to clarify. The user's preference is respected.
- **Restaurant inclusion distinction** (Daphné #15) — MAA prompt now explicitly states the restaurant Le 1881 is on-site (paid separately), NEVER in the inclusion list. Post-process guard `stripRestaurantFromInclusionList` surgically removes restaurant fragments from any sentence containing `inclut|comprend|includes|donne accès|y compris` AND adds a separate sentence "Le restaurant Le 1881 est disponible sur place, payé séparément."
- **Yoga à-la-carte tightened** (Daphné #4) — MAA prompt now states group classes REQUIRE membership; source does NOT confirm à-la-carte access. Forbidden phrasings: "il semble que ce soit possible", "you might be able to drop in", etc.
- **Fitness-program massage filter** (Daphné #13) — pure weight-loss queries (no pain context) get massothérapie/physiothérapie surgically stripped from the answer so trainer/nutrition/classes lead.
- **`stripRestaurantFromInclusionList` + `stripMassageFromFitnessAnswer` + `applyPostProcessGuards`** form a 3-step guard chain run after EVERY AI response, for BOTH MAA and DUBUB tenants. Tenant-agnostic invariant: a temperature-0.3 slip-up never reaches the user.
- **Shared safety + voice rules mirrored** for every sixth-pass rule (PICKLEBALL RESERVATION ≠ VISIT BOOKING, PRICE CONTRADICTION, CLINICAL PAIN, COURSE-COUNT SOURCE LOCK, MULTI-CATEGORY DISCOUNT, FITNESS PROGRAM PRIORITY, RESTAURANT INCLUSION DISTINCTION, QUICK-INFO / NO-FORM, GYM ACCESS MEMBERSHIP UNKNOWN).
- **NEW: bullet-proof scenario harness** (`apps/api/src/scenarios/` + `apps/api/src/scripts/test-scenarios.ts`) — 39 scenarios with structured assertions (intent, followUpMode, suppressBookingCta, forbid/require regex, language, optional LLM-as-judge). Multi-turn `history` support. Tenant-isolated. Run: `pnpm.cmd --filter @platform/api test:scenarios`.

## Daphné fifth pass — 2026-05-11
Daphné's `apps/web/public/daphne-fifth.md` flagged the third-pass guard over-firing: it was rewriting the AI's correct retrieved-evidence answers for buanderie/pickleball back to "Je ne vois pas...". Highlights of what shipped:
- **Evidence-aware override**: `findUnknownServiceGuard` now checks `searchResults` chunk content before rewriting. If the retrieved evidence mentions the service, the AI's affirmation flows through. Buanderie + pickleball were also REMOVED from the UNKNOWN_SERVICE_GUARDS list entirely — they are now TIER 2 (known but conditions vary).
- **Three-tier service model** in the MAA prompt: TIER 1 = confirmed, TIER 2 = exists but exact conditions to validate (laundry, pickleball, Technogym Checkup, guest passes, mother's day packages, à la carte drop-in), TIER 3 = truly unknown (sports clinic, child care, towel service, locker sizes). TIER 2 uses the new cautious wording: "Ce service est bien offert au Club, mais les conditions exactes (horaire, prix, accès) doivent être confirmées avec l'équipe."
- **Typo tolerance** across the included/specific-service detector, `serviceKeywords`, and `looksLikeBookingIntent` exclusions: `buandrie`, `pickball`, `pickelball`, `pickle ball`, `lavage`, `salles d'entraînement`, `créneau`, `booker`.
- **New `membership_downgrade` critical intent** (Daphné #7) — routes to `callback` with explicit "memberships team validates from your file + contract" wording. Stops the bot from blurting "Bien sûr. Utilisez le bouton ci-dessous pour continuer par téléphone."
- **`looksLikeBookingIntent` exclusions** extended (Daphné #6, #23): gym-access / créneau questions and explicit no-visit preferences ("pas faire une visite", "je veux juste m'entraîner") no longer collapse to the booking template.
- **`resolveShortAffirmativeFollowUp` clinical branch** (Daphné #8, #9): when the prior assistant message offered to transmit a clinical request, "oui" is resolved as "yes, proceed — what info do you need?" so the AI captures contact details instead of repeating the physio/sports-therapy triage paragraph.
- **Shared safety prompt gained**: MEMBERSHIP DOWNGRADE, NO-VISIT PREFERENCE, CLINICAL CAUTION + "oui" advancement, PRICING UNITS preservation, LINKS-MUST-BE-REAL, KNOWN-SERVICE-WITH-UNCLEAR-DETAILS wording. Voice version mirrors them.
- **Spa amenities detector** also accepts plain "spa" (not just sauna/vapeur/bain tourbillon), fixing Daphné #1 where "je veux aller au spa avec ma mère, sans abonnement" was still falling into the pricing handler.
- **À-la-carte / non-member access** explicit caution: never affirm drop-in access without source confirmation. Use the cautious "L'abonnement semble inclure X; pour l'option à la carte ou non-membre, confirmer avec l'équipe" wording (Daphné #13).

## Daphné fourth pass — 2026-05-08
Daphné's `apps/web/public/daphne-fourth.md` showed the deterministic pricing handler hijacking specific-service questions. Highlights of what shipped:
- **New gate `detectIncludedOrSpecificServiceQuestion`** in `apps/api/src/services/maa-chat.ts` — recognizes "Est-ce que X est inclus?", "ça donne accès à X", or any specific-service keyword (Technogym, sauna, vapeur, bain tourbillon, illimité courses, entraîneur, spécialiste, programme remise en forme). When matched, deterministic handlers are skipped, the AI gets a "answer ONLY about X, NEVER recite the price grid" prompt fragment, and `suppressBookingCta` is forced true.
- **English multi-intent fix** (Daphné #6) — `looksLikeBookingIntent` now bails when the message also has pricing trigger words. "What are your prices and can I book in English?" now stays in the AI flow and gets BOTH parts answered in English instead of being collapsed to the booking template.
- **Per-tenant `restaurantMenuLinks`** — new `TenantConfig.restaurantMenuLinks` shape with menu PDFs, take-out, LibroReserve reservation URL + party-size cap, and group-reservations phone. Editable from the dashboard Settings panel. Multi-tenant by design — future tenants populate the same shape. The chat prompt picks them up via `buildRestaurantMenuBlock()` and emits `[Menu](url)` markdown links. Voice prompt picks them up via `buildVoiceRestaurantMenuBlock()` and references the website by name.
- **Chat widget renders markdown links + bare URLs** — `renderInline()` now handles `[label](url)` (priority), bare https URLs, then phones. Daphné #13 (link not clickable) is fixed.
- **Shared safety prompt gained**: `IS-X-INCLUDED RULE` (answer X only, never the price grid), `CLASS RESERVATION ≠ VISIT BOOKING`, `TRAINER / SPECIALIST APPOINTMENT ≠ VISIT BOOKING`, `MULTI-INTENT RULE` (price + booking), `LINK FORMATTING RULE` (markdown links), `CHANNEL CONSISTENCY` (chat = phone). Voice mirror added too.
- **MAA prompt** — explicit "Is X included?" handling block; Technogym moved to UNKNOWN list (never affirm, never deny); spa amenities, class reservation, trainer appointment guidance.
- **VAPI prompt** — restaurant block rebuilt to cover menu PDFs + LibroReserve reservation widget + take-out + group reservations + restaurant direct phone.
- **LEADS HTTP 500 fixed** — NocoDB rejected `2026-04-08T18:41:10.404Z` ISO format with HTTP 422. Now formatted as `2026-04-08 18:41:10` (no T, no ms, no Z) which NocoDB accepts.

## Daphné third pass — 2026-05-08
Daphné's `apps/web/public/daphne-third.md` documented 25 cases on the chat surface plus phone notes. Highlights of what shipped:
- **`hasPricingSignal` no longer drives the booking CTA** — the backend now derives `suppressBookingCta` definitively (`apps/api/src/services/maa-chat.ts → deriveSuppressBookingCta`) and the chat widget honors it on each assistant bubble. Cancellation, policy, laundry, menu, and spa-package replies stop triggering "Prochaine étape ? → Planifier une visite".
- **Cancellation regex now catches `lannuler` / `l'annuler` / `mannuler`** via `ANNUL_STEM_RE`. Previously the `\b` boundary missed contractions without apostrophes — a real Daphné failure (#16).
- **Three new critical intents**: `cancellation_policy` (passive policy question), `urgent_callback` (specific delay), `external_price_claim` (friend/Google/etc. quote). Each routes off `calendly` and adds intent-specific prompt context.
- **`looksLikeBookingIntent` now skips** when the user message includes service-specific keywords (menus, buanderie, pickleball, forfait spa, cirque…) so "puis-je réserver?" inside a spa-package question no longer collapses to the visit-booking template.
- **MAA prompt now includes the restaurant menu URL** (`https://clubsportifmaa.clusterpos.com/menu`) and a structured "Confirmed vs UNKNOWN services" list that forbids both affirming AND denying pickleball/laundry/clinic without retrieved evidence.
- **VAPI prompt — pronunciation hardened** ("Em - A - A", three short equal letters) plus payment-pause / guest-trial / clinic uncertainty / restaurant menu URL rules.
- **CORS bug fixed**: `@fastify/cors` v11 default rejected PATCH preflights → dashboard "Save tenant" returned `Failed to fetch`. The cors register now lists `methods` and `allowedHeaders` explicitly.
- **Shared safety prompt** gained: `INTENT COMPREHENSION` (ask if ambiguous, preserve topic on correction), `CANCELLATION POLICY`, `SERVICE-EXISTENCE UNCERTAINTY`, `MEMBER-ONLY-VS-PUBLIC`, `URGENT CALLBACK`, `BILLING / PAYMENT-PAUSE`. Voice version mirrors the rules. Multi-tenant: every tenant prompt picks them up automatically.

## Bug history this pass (all fixed)
- `server.ts` `looksLikeBookingIntent()` was forcing `followUpMode='calendly'` even when the service layer had set `'callback'` → booking-template re-fired for #3, #13. Fixed: gate the heuristic on `detectCriticalIntent()`.
- `ui-chat` callback mode wiped the AI's nuanced reply with `'Bien sûr — remplissez le formulaire'` → #1, #8, #9, #14 lost their proper answers. Fixed: only fall back to that template when the AI returns empty/generic text.
- `core-facts.ts` `looksLikeCallMeRequest()` fuzzy-matched `'comment ça s'appelle'` as `'appelez moi'` (mon ≈ moi, appelle ≈ appeler) → #14 got the call-me template. Fixed: replaced `hasApproxTokenSet` with exact-token checks for short tokens.
- `detectCriticalIntent()` negotiation regex matched `'l'abonnement le moins cher'` (innocent price question). Fixed: require an explicit threat/conditional keyword.
- `chat widget` name-capture popup intercepted multi-turn second messages as a name (e.g. `'Piscine'` → `'Merci, Piscine !'`). Fixed in tests: pre-seed `localStorage` with a known user.
- Original (pre-pass): `server.ts` `resolveBookingFollowUp` overwrote AI message with the booking template when `followUpMode === 'calendly'`. Now neutralized by the safety override forcing critical intents off `'calendly'`.

## Known weak points
1. PostHog custom funnel events (chat_opened, lead_captured) not yet wired into the widget — only autopageviews active
2. Vitest migration of regression scripts deferred (current tsx scripts work but don't integrate with CI's test runner)
3. Zod validation at HTTP boundary not yet added — `/v1/chat`, `/admin/onboarding`, `/v1/vapi/*` accept loosely-typed bodies
4. OpenAI usage resets on server restart (no persistent DB yet)
5. Knowledge gap logging (unanswered questions → NocoDB) not built
6. Dashboard "Lacunes" tab not built

## Next priorities (ranked)
1. **Deploy sixth-pass changes** — `ssh root@165.227.40.198 "bash /var/www/concierge/deploy.sh"` so the new intents (price_contradiction, clinical_pain), the post-process guards, the multi-category discount and quick-info bypasses, and the scenario harness all reach prod.
2. **Re-paste VAPI prompts** — `_vapi-prompts/sophie-maa.txt` (25,847 chars) and `_vapi-prompts/sophia-dubub.txt` (16,229 chars) into the VAPI dashboard so the voice safety rules match the chat rules.
3. Run `pnpm.cmd --filter @platform/api test:scenarios:live` against the live deploy to validate every sixth-pass case end-to-end.
4. Run `pnpm.cmd --filter @platform/api test:scenarios:judge` for the LLM-rubric semantic checks on the price/clinical/yoga/restaurant scenarios.
5. Run `pnpm.cmd e2e:daphne:prod` for the UI rendering layer (markdown links, callback form behavior).
6. Wire chat_opened / lead_captured events to PostHog
7. Vitest migration of regression scripts + GitHub Actions workflow that runs `test:scenarios` on every PR (CI gate against regression).
8. Move OpenAI usage tracking to NocoDB (persistent)
9. Knowledge gap logging → NocoDB `knowledge_gaps` table
10. Finish DUBUB tenant polish, then onboard new tenant(s)

## Session start rule
1. Read `CLAUDE.md` + `STATUS.md`
2. Inspect `git status` and recent commits
3. Check Langfuse dashboard if a recent regression is reported
4. Continue from highest-value remaining issue
