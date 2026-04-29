# STATUS — MAA Concierge Platform

## Current branch
- `feat/maa-web-ingestion-v3`

## Live production URLs
- Web / demo: https://clients.dubub.com/demo
- API: https://api.dubub.com
- Server: DigitalOcean droplet `concierge-first` (165.227.40.198, 2vCPU/4GB, TOR1)
- Deploy: `bash /var/www/concierge/deploy.sh`

## Latest committed state
- Branch tip: `e1c1e49` (2026-04-28)
- Both pm2 processes stable: `api` (id:5) and `web` (id:1), 0 unexpected restarts

## What's live and working
- Full bilingual chat (FR default, EN on detection)
- Deterministic pricing, hours, address, phone, description responses
- AI fallback via OpenAI + NocoDB retrieval for complex questions
- Lead form (name, phone, email, consent) → triggers email via Brevo HTTP API
- Outbound AI call via VAPI (passes last user message + conversation summary as variables)
- Dashboard at `/dashboard` with password gate ("dubub2025"), quality review UI, feedback flow
- KPI analytics endpoint + dashboard charts (conversation outcomes, language split)
- pm2 auto-restart + `deploy.sh` for one-command deploys

## UI state (packages/ui-chat)
- Dark charcoal header (no green — all greens replaced with #1a1a22 / #2a2a38 palette)
- Gold gradient user bubbles, white assistant bubbles with MAA avatar
- Loading: three animated gold dots + "Un instant…" (clean, premium)
- Conseil Privilège nudge: distinct gold info card (not a chat bubble)
- Name capture card: appears after first AI response, persists to localStorage
- Lead form: pinned below messages, messages area fixed at 300px (no shrink)
- Demo badge: `left:0 right:0 margin:auto` (reliably centered, desktop + mobile)
- Mobile: chat fills `calc(100dvh - 40px)` from top:40px, badge always visible

## VAPI state
- Tool endpoint: `https://api.dubub.com/v1/vapi/tool`
- `vapiQuickAnswer` covers: address, phone, founding, description, general hours, pool hours, spa hours, Pilates, yoga, group classes, pricing — returns in <50ms
- `handoff_last_user_message`, `handoff_summary`, `handoff_locale` passed on every outbound call
- **Delay issue**: VAPI LLM still takes ~4-6s total (LLM decision + TTS). Fix requires pasting the fat system prompt into VAPI dashboard. File: `apps/api/src/prompts/vapi-system.ts`
- **Action needed**: paste Sophie system prompt into VAPI assistant → System Prompt field

## Email state
- Switched from nodemailer/SMTP to Brevo HTTP API (avoids DigitalOcean SMTP port block)
- Uses `BREVO_API_KEY` (xkeysib-...) — NOT the SMTP key
- **Action needed**: confirm `BREVO_API_KEY=xkeysib-...` is in `/var/www/concierge/apps/api/dist/apps/api/.env.local` (symlinked from apps/api/.env.local)

## Known weak points
1. VAPI response speed: ~5-6s — fix is VAPI dashboard system prompt (Sophie prompt ready)
2. Email: needs correct Brevo REST API key (`xkeysib-...` not `xsmtpsib-...`)
3. CI Node.js 20 deprecation warnings (non-blocking, jobs still pass)
4. Dashboard Quality Review: INCORRECT flow rebuilt but not fully QA'd end-to-end

## Next session priorities
1. Confirm email works with correct Brevo API key
2. Paste Sophie VAPI system prompt → test phone call speed drops to ~2s
3. Knowledge gap logging: when VAPI/chat can't answer → log to NocoDB `knowledge_gaps` table
4. Dashboard "Lacunes" tab showing unanswered questions
5. Multi-tenant prep (DUBUB website, Transport Bourassa)

## Session start rule
At the start of every session:
1. Read `CLAUDE.md`
2. Read `STATUS.md`
3. Inspect `git status --short` and recent commits
4. Continue from the highest-value remaining issue

## Session end rule
1. Summarize what changed
2. Summarize what passed
3. Summarize what still looks weak
4. Update `STATUS.md`
5. Recommend commit only if the batch is stable
