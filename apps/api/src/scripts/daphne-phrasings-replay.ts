/**
 * Multi-tenant phrasings replay. Replays the EXACT user wording (typos, slang,
 * Québec French, English) from a tenant's annotated conversation transcript
 * against the live bot, then judges with the shared grounded judge. The "works
 * no matter how it's written" gate, complementing the free-form adversarial sim.
 *
 * Usage:
 *   cd apps/api && npx tsx src/scripts/daphne-phrasings-replay.ts                    # tenant=maa, prod
 *   cd apps/api && npx tsx src/scripts/daphne-phrasings-replay.ts --tenant dubub
 *   ... --local                                                                       # localhost:4000
 *   ... --file <relative-md-path>                                                     # override the tenant config
 *   ... --window 8                                                                    # judge window size
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { askBot, judgeTranscript, loadTenantConfig, type Violation } from "../qa/grounded-judge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv.includes("--local") ? (process.env.LOCAL_API ?? "http://localhost:4000") : "https://api.dubub.com";
const TENANT = (() => { const i = process.argv.indexOf("--tenant"); return i >= 0 ? process.argv[i + 1]! : "maa"; })();
const WINDOW = (() => { const i = process.argv.indexOf("--window"); return i >= 0 ? Number(process.argv[i + 1]) : 8; })();
const FILE_OVERRIDE = (() => { const i = process.argv.indexOf("--file"); return i >= 0 ? process.argv[i + 1]! : undefined; })();

function looksEnglish(s: string): boolean {
  return /\b(how much|i want|can i|swedish|do you|what is|the menu|book|hours|price|where)\b/i.test(s) && !/[éèêàùçâî]/.test(s);
}

async function loadQuestions(absFile: string): Promise<string[]> {
  const raw = await fs.readFile(absFile, "utf8");
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^- \[A\]\s+(.+)$/);
    if (m) {
      const q = m[1]!.trim();
      if (q && !/^question/i.test(q)) out.push(q);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const tenantConfig = await loadTenantConfig(TENANT);
  const fileRel = FILE_OVERRIDE ?? tenantConfig.phrasingsFile;
  if (!fileRel) {
    console.error(`Tenant ${TENANT} has no phrasingsFile in config and no --file override was given.`);
    process.exit(1);
  }
  const absFile = path.isAbsolute(fileRel) ? fileRel : path.resolve(__dirname, "../../", fileRel);
  const questions = await loadQuestions(absFile);
  console.log(`\n🗣️  Phrasings replay → ${BASE}  tenant=${TENANT}\n   file: ${path.basename(absFile)}  (${questions.length} turns, judge window ${WINDOW})\n`);
  if (questions.length === 0) { console.error("No [A] questions parsed — check the file format."); process.exit(1); }

  const transcript: Array<{ role: string; content: string }> = [];
  let cid: string | null = null;
  for (const q of questions) {
    const locale = looksEnglish(q) ? "en-CA" : "fr-CA";
    try {
      const { reply, conversationId } = await askBot(BASE, q, locale, cid, TENANT);
      cid = conversationId;
      transcript.push({ role: "user", content: q }, { role: "assistant", content: reply });
    } catch (e) {
      console.error(`turn "${q}" → ERROR ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Judge in overlapping windows so the judge stays sharp on long transcripts.
  const allViolations: Violation[] = [];
  for (let i = 0; i < transcript.length; i += WINDOW * 2) {
    const slice = transcript.slice(i, i + WINDOW * 2);
    const { violations } = await judgeTranscript(slice, { groundTruth: tenantConfig.groundTruth, turnOffset: i / 2 });
    allViolations.push(...violations);
  }

  const highs = allViolations.filter((v) => v.severity === "high");
  for (const v of allViolations) {
    const icon = v.severity === "high" ? "❌" : "🟡";
    console.log(`  ${icon} [t${v.turn}] ${v.rule}: ${v.evidence}`);
  }
  console.log(`\n📊 ${highs.length} high-severity, ${allViolations.length - highs.length} low across ${questions.length} turns\n`);
  process.exit(highs.length > 0 ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(1); });
