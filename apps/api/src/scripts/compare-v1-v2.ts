/**
 * Side-by-side v1 vs v2 comparison for the MAA concierge.
 *
 * Runs the same set of visitor questions through answerMaaChat with
 * KNOWLEDGE_VERSION=v1 and KNOWLEDGE_VERSION=v2, prints both answers
 * side-by-side. Eyeball test only — not a regression gate.
 *
 * Usage:
 *   pnpm.cmd --filter @platform/api tsx src/scripts/compare-v1-v2.ts
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { answerMaaChat } from "../services/maa-chat.js";

(function loadEnvFiles(): void {
  const currentFile = fileURLToPath(import.meta.url);
  const apiRoot = path.resolve(path.dirname(currentFile), "../..");
  const repoRoot = path.resolve(apiRoot, "../..");
  for (const envFile of [
    path.join(apiRoot, ".env.local"),
    path.join(apiRoot, ".env"),
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, ".env"),
  ]) {
    dotenv.config({ path: envFile, override: false });
  }
})();

interface TestQuestion {
  id: string;
  locale: "fr-CA" | "en-CA";
  message: string;
  why: string;
}

const QUESTIONS: TestQuestion[] = [
  {
    id: "fr-clarify-reserve",
    locale: "fr-CA",
    message: "Je veux réserver",
    why: "[FR] Vague word 'réserver' — v2 should ASK clarification (table / visite / clinique / cours / activité / salle)",
  },
  {
    id: "fr-contradictory-pool",
    locale: "fr-CA",
    message: "À quelle heure la piscine ouvre le matin ?",
    why: "[FR] Contradictory data: site 7h vs PDF 6h30. v2 should not pick one — orient toward confirmation",
  },
  {
    id: "fr-membership-price",
    locale: "fr-CA",
    message: "C'est combien l'abonnement annuel ?",
    why: "[FR] Confirmed 225 $/mois — v2 should give it with 'actuellement' + soft CTA (visit)",
  },
  {
    id: "en-clarify-care",
    locale: "en-CA",
    message: "I need care",
    why: "[EN bilingual test] Vague 'care' — v2 should ASK massage/physio/osteo/nutrition/medical/nursing in natural English",
  },
  {
    id: "en-nursing",
    locale: "en-CA",
    message: "I want a blood test at home",
    why: "[EN bilingual test] Nursing intent — v2 should route to Mobile Mediq 514 543-2121, in natural English, never diagnose",
  },
];

function shorten(s: string, n = 600): string {
  return s.length > n ? s.slice(0, n) + "…" : s;
}

async function ask(version: "v1" | "v2", q: TestQuestion): Promise<{ message: string; followUpMode: string; suppressBookingCta?: boolean }> {
  process.env.KNOWLEDGE_VERSION = version;
  const result = await answerMaaChat({
    userMessage: q.message,
    locale: q.locale,
    tenantCode: "maa",
    conversationHistory: [],
  });
  return {
    message: result.assistantMessage ?? "",
    followUpMode: result.followUpMode ?? "—",
    suppressBookingCta: result.suppressBookingCta,
  };
}

async function main(): Promise<void> {
  for (const q of QUESTIONS) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`[${q.id}] (${q.locale}) ${q.message}`);
    console.log(`  why: ${q.why}`);
    console.log(`${"=".repeat(80)}`);

    try {
      const v1 = await ask("v1", q);
      console.log(`\n--- v1 [followUpMode=${v1.followUpMode}, suppressCta=${v1.suppressBookingCta}] ---`);
      console.log(shorten(v1.message));
    } catch (err) {
      console.log(`v1 ERROR: ${(err as Error).message}`);
    }

    try {
      const v2 = await ask("v2", q);
      console.log(`\n--- v2 [followUpMode=${v2.followUpMode}, suppressCta=${v2.suppressBookingCta}] ---`);
      console.log(shorten(v2.message));
    } catch (err) {
      console.log(`v2 ERROR: ${(err as Error).message}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
