/**
 * Daphné batch 8 (2026-05-28) regression gate — MULTI-TURN.
 *
 * Replays the exact failure sequences from conversation_MAA_8_avec_commentaires
 * against a running API (prod by default), turn by turn, carrying conversation
 * history forward like a real chat. Asserts the Correctifs MAA 8 corrections.
 *
 * Usage: cd apps/api && npx tsx src/scripts/daphne-batch8-gate.ts [--local]
 */
const BASE = process.argv.includes("--local") ? (process.env.LOCAL_API ?? "http://localhost:4000") : "https://api.dubub.com";

interface Turn {
  say: string;
  locale?: "fr-CA" | "en-CA";
  forbid?: RegExp[];
  requireAny?: RegExp[];
  note: string;
}
interface Scenario { id: string; turns: Turn[]; }

const VISIT_CTA = /planifier une visite|schedule a (?:tour|visit)|cliquez sur le bouton ci-dessous pour planifier/i;

const SCENARIOS: Scenario[] = [
  {
    id: "context-pickleball-then-tarifs",
    turns: [
      { say: "je veux jouer au pickleball", note: "intro pickleball", requireAny: [/pickleball/i] },
      { say: "oui je suis membre", note: "member" },
      { say: "cest quoi les tarifs", note: "MUST stay pickleball, NOT dump abonnement grid + NO visit CTA",
        forbid: [/225\s*\$.*185\s*\$.*195\s*\$/is, VISIT_CTA, /casier/i, /programmes?\s+aquatiques?/i],
        requireAny: [/pickleball|inclus\s+(?:dans|avec)|Nathalie/i] },
    ],
  },
  {
    id: "context-groupclasses-not-pickleball",
    turns: [
      { say: "je veux jouer au pickleball", note: "intro pickleball", requireAny: [/pickleball/i] },
      { say: "je veux voir l'horaire des cours de groupe", note: "topic switch → group classes, NOT pickleball",
        forbid: [/pickleball/i],
        requireAny: [/cours\s+en\s+groupe|mywellness|horaire/i] },
    ],
  },
  {
    id: "pilates-private-no-visit",
    turns: [
      { say: "est-ce que je peux reserver un cours privé de pilates sur appareils?", note: "Pilates reformer → NOT visit funnel",
        forbid: [VISIT_CTA],
        requireAny: [/elisabeth|eboutin|mywellness|fliip|reformer|espace\s+pilates/i] },
    ],
  },
  {
    id: "massage-price-stable",
    turns: [
      { say: "combien coute un massage de 60 minutes", note: "exactly 120$, no member/guest split",
        forbid: [/85\s*\$\s*(?:pour|for)?\s*(?:les\s+)?invit/i, /105\s*\$\s*membre/i, /25\s*min[^.!?]{0,15}60\s*\$/i],
        requireAny: [/120\s*\$/i] },
      { say: "oui", note: "follow-up must NOT introduce a different price grid + no visit CTA",
        forbid: [/105\s*\$/i, /25\s*min[^.!?]{0,15}60\s*\$/i, VISIT_CTA] },
    ],
  },
  {
    id: "triathlon-oui-routes-nathalie-not-restaurant",
    turns: [
      { say: "le club de triatlhon inclus quoi?", note: "triathlon", requireAny: [/triathlon|Nathalie/i] },
      { say: "oui", note: "MUST NOT route to Restaurant Le 1881 callback (founding-year '1881' is fine)",
        forbid: [/restaurant\s+le\s+1881|r[eé]server?\s+(?:une\s+table|au\s+restaurant)|restaurant[^.!?]*rappel|rappel[^.!?]*restaurant/i] },
    ],
  },
  {
    id: "link-on-oui",
    turns: [
      { say: "je veux un massage suédois", note: "swedish massage", requireAny: [/su[eé]dois|120\s*\$/i] },
      { say: "oui pour acceder a la plateforme", note: "asked for platform link",
        requireAny: [/fliip|fliipapp|http|lien|plateforme/i] },
      { say: "oui", note: "MUST give a link/booking step, NOT ask for callback coordinates",
        forbid: [/nom\s+complet.*num[eé]ro.*courriel/is] },
    ],
  },
  {
    id: "endometriosis-medical-prudence",
    turns: [
      { say: "je cherche un medecin pour endometriose", note: "MUST NOT prescribe Avedian + hormonothérapie as adapted",
        forbid: [/avedian[^.!?]*(?:adapt|endom|hormono)/i, /hormonoth[eé]rapie\s+bio[- ]?identique[^.!?]*(?:adapt|endom)/i],
        requireAny: [/clinique|orienter|confirmer|514\s*845/i] },
    ],
  },
  {
    id: "weightloss-no-medical-push",
    turns: [
      { say: "mon objectif est de perdre du poids", note: "MUST NOT push Dr Avedian / hormonothérapie",
        forbid: [/avedian/i, /hormonoth[eé]rapie\s+bio[- ]?identique/i],
        requireAny: [/entra[iî]n|cours|nutrition|programme/i] },
    ],
  },
  {
    id: "doctors-directory-ok",
    turns: [
      { say: "qui sont vos medecins", note: "directory question → naming doctors is fine",
        requireAny: [/Avedian|Kanevesky|clinique|services?\s+m[eé]dic/i] },
    ],
  },
  {
    id: "en-swedish-followup",
    turns: [
      { say: "i want to book a massage", locale: "en-CA", note: "EN massage", requireAny: [/massage|120/i] },
      { say: "swedish", locale: "en-CA", note: "EN: continue swedish booking, NOT generic + NO visit CTA",
        forbid: [VISIT_CTA] },
    ],
  },
  {
    id: "nonmember-pickleball-routes-francis",
    turns: [
      { say: "je ne suis pas membre, est-ce que je peux jouer au pickleball ?", note: "non-member intro", requireAny: [/membre/i] },
      { say: "donc seulement membres ?", note: "MUST route a non-member to Francis (abonnement/visite), NOT Nathalie",
        requireAny: [/francis|bradette|abonnement|adh[eé]sion|visite/i] },
    ],
  },
];

// Reuse ONE conversationId per scenario — the server carries context server-side
// (in-memory buffer + NocoDB) keyed by conversationId, exactly like the real
// widget. It does NOT read conversationHistory from the body, so threading our
// own history was a no-op (every turn was contextless). First turn sends no
// conversationId; the server mints one and we reuse it for the rest of the turns.
async function send(message: string, locale: string, conversationId: string | null): Promise<{ reply: string; conversationId: string | null }> {
  const res = await fetch(`${BASE}/v1/tenants/maa/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(conversationId ? { message, locale, conversationId } : { message, locale }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const d = (await res.json()) as { assistantMessage?: string; reply?: string; conversationId?: string };
  return { reply: d.assistantMessage ?? d.reply ?? "", conversationId: d.conversationId ?? conversationId };
}

async function main(): Promise<void> {
  console.log(`\nDaphné batch 8 multi-turn gate → ${BASE}\n`);
  let pass = 0, fail = 0;
  for (const sc of SCENARIOS) {
    let convId: string | null = null;
    let scenarioOk = true;
    const failNotes: string[] = [];
    for (const turn of sc.turns) {
      const locale = turn.locale ?? "fr-CA";
      let reply = "";
      try { const r = await send(turn.say, locale, convId); reply = r.reply; convId = r.conversationId; }
      catch (e) { scenarioOk = false; failNotes.push(`"${turn.say}" → ERROR ${e instanceof Error ? e.message : e}`); break; }
      for (const re of turn.forbid ?? []) {
        if (re.test(reply)) { scenarioOk = false; failNotes.push(`[${turn.note}] FORBID matched ${re.source}\n      reply: ${reply.slice(0, 220)}`); }
      }
      if (turn.requireAny && !turn.requireAny.some((re) => re.test(reply))) {
        scenarioOk = false; failNotes.push(`[${turn.note}] no requireAny matched\n      reply: ${reply.slice(0, 220)}`);
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
    if (scenarioOk) { pass++; console.log(`  ✅ ${sc.id}`); }
    else { fail++; console.log(`  🔴 ${sc.id}`); for (const n of failNotes) console.log(`      ${n}`); }
  }
  console.log(`\n📊 ${pass}/${pass + fail} scenarios passed\n`);
  process.exit(fail > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
