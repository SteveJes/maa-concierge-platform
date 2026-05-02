# STATUS — MAA Concierge Platform

## Current branch
- `feat/maa-web-ingestion-v3`

## Live production URLs
- Web / demo: https://clients.dubub.com/demo
- API: https://api.dubub.com
- Server: DigitalOcean droplet `concierge-first` (165.227.40.198, 2vCPU/4GB, TOR1)
- Deploy: `bash /var/www/concierge/deploy.sh`
- PM2 processes: `api` (id:5), `web` (id:1)

## What's live and working

### Chat widget (packages/ui-chat)
- Full bilingual chat (FR default, EN on detection)
- Deterministic pricing, hours, address, phone, description responses
- AI fallback via OpenAI + NocoDB retrieval for complex questions
- Lead form (name, phone, email, consent) → Brevo email to club
- Dark premium UI: charcoal palette, gold gradient bubbles, MAA avatar
- Mobile: `calc(100dvh - 40px)` layout, centered demo badge
- Footer: DUBUB.ca link with AI orbital animation

### Phone (inbound Sophie call)
- User types phone number in chat → context stored server-side (30 min TTL)
- User calls Sophie's inbound number: **(438) 802-9845** — displayed formatted
- VAPI fires `assistant-request` webhook to `https://api.dubub.com/v1/vapi/server`
- Server matches caller by phone → builds topic-aware opening line
  e.g. "Je vois que vous aviez une question sur nos tarifs d'abonnements"
- Cold caller (no match): "Bonjour. Ici Sophie, du Club MAA. Comment puis-je vous aider ?"
- Sophie collects lead via `capture_lead` tool → premium HTML email to `LEAD_NOTIFY_EMAIL`
- All numbers spoken as phonetic French words ("deux cent vingt-cinq")

### Admin dashboard (/admin/dashboard)
- Multi-tenant sidebar (all tenants from registry)
- Per-tenant: health checks, VAPI call table, VAPI stats
- **OpenAI cost section**: total cost, request count, token counts (per-tenant, per-model breakdown)
- Usage tracked in memory since last server start (resets on restart — persistent DB planned)

### Admin onboarding wizard (/admin/onboarding)
- 6-step wizard: Company Info → Brand & Voice → Knowledge Sources → Voice & Phone → Plan & Billing → Review
- Plans: Essentiel $599/mo, Croissance $1,290/mo, Prestige $2,590/mo, Autre custom
- 12-month term automatically waives implementation fee
- Stripe Checkout integration (payment link returned on success)
- HTML invoice generation + Brevo email send (bilingual, QC taxes: TPS 5% + TVQ 9.975%)
- Invoice numbering: `INV-YYMM-XXXX`

## VAPI configuration (action required in VAPI dashboard)

### Sophie's assistant
- Server URL: `https://api.dubub.com/v1/vapi/server`
- Inbound phone: `+14388029845` (already in .env.local as `VAPI_PHONE_NUMBER`)
- System prompt: copy/paste from `apps/api/src/prompts/vapi-system.ts` → buildVapiSystemPrompt() output
  **This is required for fast responses — without it VAPI makes a slow tool call on every turn**

### capture_lead tool (add in VAPI dashboard)
- Tool name: `capture_lead`
- Server URL: `https://api.dubub.com/v1/vapi/tool`
- Parameters:
  - `name` (string) — caller's full name
  - `phone` (string, optional) — phone number if given
  - `email` (string, optional) — email if given
  - `note` (string) — one-sentence summary of interest
  - `locale` (string) — "fr-CA" or "en-CA"

## Environment variables needed on droplet
File: `/var/www/concierge/apps/api/.env.local`

Already present:
- `VAPI_API_KEY`, `VAPI_PHONE_NUMBER=+14388029845`
- `BREVO_API_KEY` (must be `xkeysib-...` REST key, NOT SMTP key)
- `OPENAI_API_KEY`, `NOCO_DB_TOKEN`, `ADMIN_TOKEN`

Still needed (add if not present):
- `STRIPE_SECRET_KEY=sk_live_...`
- `TAX_GST_NUMBER=...` (TPS registration number)
- `TAX_QST_NUMBER=...` (TVQ registration number)
- `DUBUB_COMPANY_NAME=DUBUB inc.`
- `DUBUB_ADDRESS=...`
- `LEAD_NOTIFY_EMAIL=...` (where lead capture emails go)
- `INVOICE_FROM_EMAIL=...` (Brevo verified sender)

## Known weak points
1. OpenAI usage resets on server restart — no persistent DB yet
2. Stripe `automatic_tax` needs a Canadian address on the customer to work correctly — verify or switch to manual QC tax line items
3. VAPI system prompt must be pasted manually into VAPI dashboard (see above)
4. Knowledge gap logging (unanswered questions → NocoDB) not yet built
5. Dashboard "Lacunes" tab not yet built
6. CI Node.js 20 deprecation warnings (non-blocking)

## Next priorities
1. Deploy current batch, verify all flows on prod
2. Add `capture_lead` tool in VAPI dashboard
3. Paste Sophie system prompt into VAPI assistant
4. Add missing env vars to droplet
5. Knowledge gap logging → NocoDB `knowledge_gaps` table
6. Dashboard "Lacunes" tab
7. Persistent OpenAI usage tracking (replace in-memory Map with DB)
8. Multi-tenant prep: second client onboarding

## Session start rule
1. Read `CLAUDE.md` + `STATUS.md`
2. Inspect `git status` and recent commits
3. Continue from highest-value remaining issue
