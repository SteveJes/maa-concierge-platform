/**
 * Daphné phrasings replay — replays her EXACT question wording (typos, slang,
 * Québec French, English) from her annotated conversation transcripts against
 * the live bot, then judges the result with the shared grounded judge. This is
 * the "works no matter how she writes it" gate, complementing the free-form
 * adversarial simulator.
 *
 * Usage:
 *   cd apps/api && npx tsx src/scripts/daphne-phrasings-replay.ts            # prod
 *   ... --local                                                             # localhost:4000
 *   ... --file _inbox/daphne-2026-05-28/conversation_maa_8_avec_commentaires.md
 *   ... --window 8                                                          # judge window size
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { askBot, judgeTranscript, type Violation } from "../qa/grounded-judge.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.argv.includes("--local") ? (process.env.LOCAL_API ?? "http://localhost:4000") : "https://api.dubub.com";
const WINDOW = (() => { const i = process.argv.indexOf("--window"); return i >= 0 ? Number(process.argv[i + 1]) : 8; })();
const FILE = (() => {
  const i = process.argv.indexOf("--file");
  return i >= 0 ? process.argv[i + 1]! : "_inbox/daphne-2026-05-28/conversation_maa_8_avec_commentaires.md";
})();

/** English-ish heuristic so the bot's language routing gets the right locale signal. */
function looksEnglish(s: string): boolean {
  return /\b(how much|i want|can i|swedish|do you|what is|the menu|book|hours|price|where)\b/i.test(s) &&
    !/[éèêàùçâî]/.test(s);
}

/** Extract Daphné's exact user questions in order from a rendered conversation md. */
async function loadQuestions(absFile: string): Promise<string[]> {
  const raw = await fs.readFile(absFile, "utf8");
  const out: string[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^- \[A\]\s+(.+)$/);
    if (m) {
      const q = m[1]!.trim();
      if (q && !/^question/i.test(q)) out.push(q); // skip the header cell
    }
  }
  return out;
}

async function main(): Promise<void> {
  const absFile = path.isAbsolute(FILE) ? FILE : path.resolve(__dirname, "../../", FILE);
  const questions = await loadQuestions(absFile);
  console.log(`\n🗣️  Daphné phrasings replay → ${BASE}\n   file: ${path.basename(absFile)}  (${questions.length} turns, judge window ${WINDOW})\n`);
  if (questions.length === 0) { console.error("No [A] questions parsed — check the file format."); process.exit(1); }

  const transcript: Array<{ role: string; content: string }> = [];
  let cid: string | null = null;
  for (const q of questions) {
    const locale = looksEnglish(q) ? "en-CA" : "fr-CA";
    try {
      const { reply, conversationId } = await askBot(BASE, q, locale, cid);
      cid = conversationId;
      transcript.push({ role: "user", content: q }, { role: "assistant", content: reply });
    } catch (e) {
      console.error(`turn "${q}" → ERROR ${e instanceof Error ? e.message : e}`);
    }
    await new Promise((r) => setTimeout(r, 2000));
  }

  // Judge in overlapping windows so the judge keeps local context without
  // drowning in a 50-turn transcript.
  const allViolations: Violation[] = [];
  for (let i = 0; i < transcript.length; i += WINDOW * 2) {
    const slice = transcript.slice(i, i + WINDOW * 2);
    const { violations } = await judgeTranscript(slice, undefined, i / 2);
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
