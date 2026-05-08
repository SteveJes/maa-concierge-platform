/**
 * Lightweight, no-AI unit check for detectCriticalIntent + deriveSuppressBookingCta.
 * Useful for fast iteration on the regex/derivation logic — the full regression suite
 * makes real OpenAI calls per case.
 *
 * Run: pnpm.cmd --filter @platform/api exec tsx src/scripts/check-intent-unit.ts
 */
import { detectCriticalIntent, deriveSuppressBookingCta } from "../services/maa-chat.js";

interface IntentCase {
  msg: string;
  expect: ReturnType<typeof detectCriticalIntent>;
}

interface SuppressCase {
  msg: string;
  mode: "clarify" | "calendly" | "callback" | "vapi" | "done";
  expect: boolean;
}

const intentCases: IntentCase[] = [
  { msg: "javais un abonnement annuel a 225$ mais je veux lannuler", expect: "cancellation" },
  { msg: "j'avais un abonnement à 225$ mais je veux l'annuler", expect: "cancellation" },
  { msg: "JE VEUX ANNULER", expect: "cancellation" },
  { msg: "Je veux annuler mon abonnement", expect: "cancellation" },
  { msg: "Quelle est votre politique d'annulation ?", expect: "cancellation_policy" },
  { msg: "cancellation policies", expect: "cancellation_policy" },
  { msg: "rappelez-moi dans 5 minutes", expect: "urgent_callback" },
  { msg: "Mon ami m'a dit que c'était 150$ par mois", expect: "external_price_claim" },
  { msg: "avez vous un service de buanderie ?", expect: undefined },
  { msg: "l'abonnement le moins cher", expect: undefined },
  { msg: "Je veux annuler mon rendez-vous", expect: "cancellation" },
];

const suppressCases: SuppressCase[] = [
  { msg: "avez vous un service de buanderie ?", mode: "clarify", expect: true },
  { msg: "avez-vous un terrain de pickleball", mode: "clarify", expect: true },
  { msg: "menu du restaurant cette semaine", mode: "clarify", expect: true },
  { msg: "JE VEUX ANNULER", mode: "callback", expect: true },
  { msg: "quel est le prix?", mode: "done", expect: false },
];

let fail = 0;

for (const c of intentCases) {
  const got = detectCriticalIntent(c.msg);
  const ok = got === c.expect;
  if (!ok) fail += 1;
  console.log(`${ok ? "  ok " : "FAIL "}${JSON.stringify(c.msg)} -> ${got} (expected ${c.expect})`);
}

console.log("---");

for (const c of suppressCases) {
  const got = deriveSuppressBookingCta(c.msg, c.mode);
  const ok = got === c.expect;
  if (!ok) fail += 1;
  console.log(`${ok ? "  ok " : "FAIL "}${JSON.stringify(c.msg)} (mode=${c.mode}) -> ${got} (expected ${c.expect})`);
}

if (fail === 0) {
  console.log("\nAll intent/derive unit checks passed.");
  process.exit(0);
} else {
  console.error(`\n${fail} failure(s).`);
  process.exit(1);
}
