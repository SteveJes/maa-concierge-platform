/**
 * Multi-turn handoff-acceptance regression. The bug Daphné caught on 2026-05-18:
 *
 *   Turn 1 (user):     "vos horaires de nage libre?"
 *   Turn 2 (bot):      "...horaire 7h-20h... Souhaitez-vous que je vous mette
 *                       en contact avec Nathalie Lambert ou la réception ?"
 *   Turn 3 (user):     "oui svp"
 *   Turn 4 (bot — WAS):  same generic 7h-20h answer again ❌
 *
 * The fix:
 *  - `resolveShortAffirmativeFollowUp` now broadens the regex to catch "mettre
 *    en contact avec X" / "contacter X" / "souhaitez-vous que je..." as routing
 *    handoff offers, so "oui" resolves to a forward-progress message.
 *  - `detectServiceRouting` walks the conversation history when the user message
 *    is a bare affirmative, so the routing chip + lead email still target the
 *    right staff member (Nathalie / Francis / Clinique / etc.) two turns later.
 *
 * Run:  npx tsx src/scripts/test-handoff-acceptance-regression.ts
 */
import "dotenv/config";
import { answerMaaChat, detectServiceRouting } from "../services/maa-chat.js";

interface Case {
  label: string;
  history: Array<{ role: "user" | "assistant"; content: string }>;
  userMessage: string;
  locale: "fr-CA" | "en-CA";
  expectedRoutingContactId?: string;
  /** Substrings that MUST appear in the bot's reply. */
  mustInclude?: RegExp[];
  /** Substrings that MUST NOT appear in the bot's reply (e.g. the generic loop). */
  mustNotInclude?: RegExp[];
}

const CASES: Case[] = [
  {
    label: "Pool/swim — user accepts handoff to Nathalie Lambert",
    history: [
      { role: "user", content: "vos horaires de nage libre?" },
      {
        role: "assistant",
        content:
          "Pour la nage libre, l'horaire général est 7h à 20h en semaine et 7h à 17h le week-end. Souhaitez-vous que je vous mette en contact avec Nathalie Lambert, Directrice des programmes sportifs, ou la réception du Club pour les détails ?",
      },
    ],
    userMessage: "oui svp",
    locale: "fr-CA",
    expectedRoutingContactId: "nathalie_lambert",
    mustInclude: [
      // Bot must move forward — ask for contact info / confirm transmission
      /(coordonn[ée]es|nom|t[ée]l[ée]phone|courriel|email|name|phone|transmet|transmettr|reach|contact)/i,
    ],
    mustNotInclude: [
      // Bot must NOT repeat the same generic hours-only answer
      /^(?:[^]*?7\s*h\s*[à-]\s*20[^]*?7\s*h\s*[à-]\s*17[^]*)$/,
    ],
  },
  {
    label: "Restaurant — user accepts handoff to Le 1881",
    history: [
      { role: "user", content: "j'aimerais réserver une table" },
      {
        role: "assistant",
        content:
          "Avec plaisir. Pour les groupes de moins de 6 personnes, vous pouvez réserver en ligne. Pour les plus grands groupes, souhaitez-vous que je vous mette en contact avec le Restaurant Le 1881 ?",
      },
    ],
    userMessage: "oui",
    locale: "fr-CA",
    expectedRoutingContactId: "restaurant_1881",
    mustInclude: [/(coordonn[ée]es|nom|t[ée]l[ée]phone|courriel|transmet|restaurant)/i],
  },
  {
    label: "Clinique — user accepts handoff to clinique sportive",
    history: [
      { role: "user", content: "j'ai mal au dos depuis une semaine" },
      {
        role: "assistant",
        content:
          "Je comprends. Pour évaluer la meilleure orientation, souhaitez-vous que je transmette votre demande à la Clinique sportive MAA ?",
      },
    ],
    userMessage: "oui svp",
    locale: "fr-CA",
    expectedRoutingContactId: "clinique_sportive",
    mustInclude: [/(coordonn[ée]es|nom|t[ée]l[ée]phone|courriel|transmet|clinique)/i],
  },
  {
    label: "English — user accepts handoff",
    history: [
      { role: "user", content: "what's the pool schedule?" },
      {
        role: "assistant",
        content:
          "The pool is open 7 AM to 8 PM on weekdays and 7 AM to 5 PM on weekends. Would you like me to put you in touch with Nathalie Lambert, Director of Sports Programming, for the detailed schedule?",
      },
    ],
    userMessage: "yes please",
    locale: "en-CA",
    expectedRoutingContactId: "nathalie_lambert",
    mustInclude: [/(name|phone|email|contact|transmit|reach|forward)/i],
  },
];

async function runCase(c: Case): Promise<{ pass: boolean; reason?: string }> {
  // 1. Detect service routing from the affirmative + history alone
  const routing = detectServiceRouting(c.userMessage, c.history);
  if (c.expectedRoutingContactId && routing?.contactId !== c.expectedRoutingContactId) {
    return {
      pass: false,
      reason: `Expected routing.contactId="${c.expectedRoutingContactId}" — got ${routing ? `"${routing.contactId}"` : "undefined"}`,
    };
  }

  // 2. Full chat round-trip (this requires OPENAI_API_KEY + NocoDB)
  if (!process.env.OPENAI_API_KEY) {
    return { pass: true, reason: "routing-only (no OPENAI_API_KEY)" };
  }
  try {
    const res = await answerMaaChat({
      tenantCode: "maa",
      userMessage: c.userMessage,
      locale: c.locale,
      conversationHistory: c.history,
    });
    for (const re of c.mustInclude ?? []) {
      if (!re.test(res.assistantMessage)) {
        return { pass: false, reason: `Reply missing required pattern ${re}: "${res.assistantMessage.slice(0, 220)}…"` };
      }
    }
    for (const re of c.mustNotInclude ?? []) {
      if (re.test(res.assistantMessage)) {
        return { pass: false, reason: `Reply matched forbidden pattern ${re}: "${res.assistantMessage.slice(0, 220)}…"` };
      }
    }
    return { pass: true };
  } catch (err) {
    return { pass: false, reason: `answerMaaChat threw: ${err instanceof Error ? err.message : String(err)}` };
  }
}

(async () => {
  let pass = 0;
  let fail = 0;
  for (const c of CASES) {
    process.stdout.write(`  ${c.label}... `);
    const r = await runCase(c);
    if (r.pass) {
      console.log(`PASS${r.reason ? ` (${r.reason})` : ""}`);
      pass++;
    } else {
      console.log(`FAIL — ${r.reason}`);
      fail++;
    }
  }
  console.log(`\n${pass}/${pass + fail} handoff-acceptance tests passed.`);
  process.exit(fail > 0 ? 1 : 0);
})();
