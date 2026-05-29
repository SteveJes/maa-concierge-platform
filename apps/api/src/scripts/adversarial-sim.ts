/**
 * Multi-tenant adversarial conversation simulator + grounded LLM judge.
 *
 * WHY: scripted regex gates miss the bugs that actually embarrass us — bot
 * inventing an email, dumping a menu wall, answering the street address on
 * "adresse email", promising to email a PDF. Those only surface on UNSCRIPTED
 * multi-turn conversations. This harness has an LLM play a demanding client
 * who explores multi-turn against the LIVE bot, then a STRICT gpt-4o judge
 * reviews the whole transcript for universal failure modes using the
 * tenant-specific GROUND TRUTH.
 *
 * Multi-tenant: tenant facts and personas live in `src/qa/tenants/<id>/config.ts`.
 * The harness is generic and works for any tenant.
 *
 * Usage:
 *   cd apps/api && npx tsx src/scripts/adversarial-sim.ts                       # tenant=maa, prod
 *   cd apps/api && npx tsx src/scripts/adversarial-sim.ts --tenant dubub        # other tenant
 *   ... --local                                                                  # localhost:4000
 *   ... --persona restaurant-explorer                                            # run one persona
 *   ... --turns 8                                                                # max user turns
 */
import { askBot, chat, judgeTranscript, loadTenantConfig, type Persona, type Violation } from "../qa/grounded-judge.js";

const BASE = process.argv.includes("--local")
  ? (process.env.LOCAL_API ?? "http://localhost:4000")
  : "https://api.dubub.com";
const tenantArg = (() => { const i = process.argv.indexOf("--tenant"); return i >= 0 ? process.argv[i + 1]! : "maa"; })();
const personaArg = (() => { const i = process.argv.indexOf("--persona"); return i >= 0 ? process.argv[i + 1] : undefined; })();
const MAX_TURNS = (() => { const i = process.argv.indexOf("--turns"); return i >= 0 ? Number(process.argv[i + 1]) : 7; })();

async function nextUserMessage(persona: Persona, transcript: Array<{ role: string; content: string }>): Promise<string> {
  const isEn = persona.locale === "en-CA";
  const sys = isEn
    ? `You play a DEMANDING visitor testing a sports-club AI concierge, in casual English (small typos ok). ${persona.goal}
Rules: one short reply at a time (real chat). Never play the concierge. Advance per your goal. When done, write exactly "[FIN]".`
    : `Tu joues un VISITEUR exigeant qui teste un concierge IA, en français québécois, ton naturel et un peu pressé (petites fautes ok). ${persona.goal}
Règles: une seule réplique courte à la fois (comme un vrai chat). Ne joue jamais le concierge. Avance la conversation selon ton objectif. Si tu as fini ton objectif, écris exactement "[FIN]".`;
  const convo = transcript.map((t) => `${t.role === "user" ? (isEn ? "ME" : "MOI") : "CONCIERGE"}: ${t.content}`).join("\n");
  const content = transcript.length === 0
    ? (isEn ? "Start the conversation with your first question." : "Commence la conversation par ta première question.")
    : (isEn ? `Conversation so far:\n${convo}\n\nWrite your next reply (or "[FIN]").` : `Conversation jusqu'ici:\n${convo}\n\nÉcris ta prochaine réplique (ou "[FIN]").`);
  const out = await chat([{ role: "system", content: sys }, { role: "user", content }]);
  return out.trim();
}

async function runPersona(
  persona: Persona,
  tenantId: string,
  groundTruth: string,
): Promise<{ pass: boolean; violations: Violation[]; transcript: Array<{ role: string; content: string }> }> {
  const transcript: Array<{ role: string; content: string }> = [];
  let cid: string | null = null;
  for (let turn = 0; turn < MAX_TURNS; turn++) {
    const userMsg = await nextUserMessage(persona, transcript);
    if (/\[FIN\]/i.test(userMsg) || !userMsg) break;
    transcript.push({ role: "user", content: userMsg });
    const { reply, conversationId } = await askBot(BASE, userMsg, persona.locale ?? "fr-CA", cid, tenantId);
    cid = conversationId;
    transcript.push({ role: "assistant", content: reply });
    // Throttle so 24 personas don't tip the 2-vCPU droplet.
    await new Promise((r) => setTimeout(r, 2500));
  }
  const verdict = await judgeTranscript(transcript, { groundTruth, checklist: persona.checklist });
  return { ...verdict, transcript };
}

async function main(): Promise<void> {
  const tenantConfig = await loadTenantConfig(tenantArg);
  const personas = personaArg ? tenantConfig.personas.filter((p) => p.id === personaArg) : tenantConfig.personas;
  console.log(`\n🤖 Adversarial simulator → ${BASE}  tenant=${tenantArg}  (${personas.length} persona(s), max ${MAX_TURNS} turns)\n`);
  let pass = 0, fail = 0;
  const failures: string[] = [];
  for (const persona of personas) {
    try {
      const { pass: ok, violations, transcript } = await runPersona(persona, tenantArg, tenantConfig.groundTruth);
      const highs = violations.filter((v) => v.severity === "high");
      if (ok && highs.length === 0) {
        pass++;
        console.log(`  ✅ ${persona.id}  (${transcript.length / 2} turns)`);
        for (const v of violations) console.log(`      🟡 [t${v.turn}] ${v.rule}: ${v.evidence}`);
      } else {
        fail++;
        console.log(`  🔴 ${persona.id}`);
        for (const v of violations) {
          const icon = v.severity === "high" ? "❌" : "🟡";
          console.log(`      ${icon} [t${v.turn}] ${v.rule}: ${v.evidence}`);
          if (v.severity === "high") failures.push(`${persona.id} t${v.turn} ${v.rule}: ${v.evidence}`);
        }
      }
    } catch (e) {
      fail++;
      console.log(`  🔴 ${persona.id} — ERROR ${e instanceof Error ? e.message : e}`);
    }
  }
  console.log(`\n📊 ${pass}/${pass + fail} personas clean (no high-severity violations)\n`);
  if (failures.length) console.log("High-severity:\n" + failures.map((f) => "  - " + f).join("\n") + "\n");
  process.exit(fail > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
