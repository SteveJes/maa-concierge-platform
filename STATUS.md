# STATUS — MAA Concierge Platform

## Current branch
- `feat/maa-web-ingestion-v3`

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
- **Scenario harness `test-scenarios.ts`** (NEW sixth pass): **39/39 PASS** in-process — 35 MAA + 4 DUBUB. Runner asserts on structured fields (intent, followUpMode, suppressBookingCta) + regex + optional LLM judge + multi-turn `history`. Catches things regex-only tests miss (price contradictions saying "around", inclusion-list having restaurant in same sentence, callback-default when user said "no form"). Run: `pnpm.cmd --filter @platform/api test:scenarios`.
- Playwright `daphne-regression.spec.ts` against **prod** (`Desktop Chrome`): **19/21 PASS + 2 flaky** (#1, #16) — flaky cases pass on retry; AI nondeterminism on edge phrasings, not bypass bugs
- Mobile device matrix: iPhone 15 Pro Max, iPhone 14, iPhone SE, Pixel 7, Pixel 5, Galaxy S23, Galaxy S9+, Xiaomi Redmi Note 12 — runnable via `pnpm.cmd e2e:daphne:mobile:prod`
- Mobile Daphné regression on prod (`iPhone 14`, `iPhone SE`, `Pixel 7`, `Galaxy S23` × 21 cases): **82/84 passed** + 1 flaky + 1 brittle pattern (#1 cheapest price). Safety overrides hold across all surfaces.
- Lightweight intent unit check (no AI): `pnpm.cmd --filter @platform/api exec tsx src/scripts/check-intent-unit.ts` — verifies regex/derive logic in <1s.

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
