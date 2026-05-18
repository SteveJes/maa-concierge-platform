/**
 * Daphné-replay canary.
 *
 * Six realistic multi-turn conversations against the LIVE HTTP API.
 * This is the layer Daphné actually sees — the chat endpoint, with the
 * full prompt + safety chain. The harness asserts the things she would
 * notice without reading code: no verbatim repetition across turns,
 * no topic-jumps on "oui", no off-topic CTAs.
 *
 * USE THIS BEFORE EVERY COMMIT TOUCHING THE PROMPT, REGEX, OR KB.
 *
 * Run locally:   cd apps/api && npx tsx src/scripts/daphne-replay.ts
 * Run on prod:   DAPHNE_REPLAY_URL=https://api.dubub.com npx tsx ...
 * Exit code 1 if any flow fails — gates deploy.sh.
 */
import "dotenv/config";

interface Turn { role: "user" | "assistant"; content: string }
interface Flow {
  id: string;
  label: string;
  locale: "fr-CA" | "en-CA";
  turns: Array<{
    say: string;
    expect?: { mustInclude?: RegExp[]; mustNotInclude?: RegExp[] };
  }>;
}

const BASE_URL = process.env.DAPHNE_REPLAY_URL ?? "http://localhost:4000";
const TENANT = "maa";

// 6 flows — each one models a real Daphné-style mini-conversation.
// Designed to catch the bug class Steve flagged on 2026-05-18.
const FLOWS: Flow[] = [
  {
    id: "maagazine-handoff",
    label: "MAAgazine: 'alors oui svp' must move forward, NOT loop the same answer",
    locale: "fr-CA",
    turns: [
      { say: "je vois que vous avez un maagazine, c'est quoi au juste?" },
      {
        say: "alors oui svp",
        expect: {
          mustInclude: [/(coordonn[éè]es|courriel|transmet|maagazine|clubsportifmaa\.com|email)/i],
          mustNotInclude: [/Le MAAgazine est une publication exclusive du Club/i],
        },
      },
      {
        say: "oui",
        expect: {
          mustNotInclude: [/planifier\s+une\s+visite/i],
        },
      },
    ],
  },
  {
    id: "pool-hours-handoff",
    label: "Pool hours: 'oui svp' to Nathalie offer must advance to contact-info ask",
    locale: "fr-CA",
    turns: [
      { say: "vos horaires de nage libre?" },
      {
        say: "oui svp",
        expect: {
          mustInclude: [/(nathalie|coordonn[éè]es|nom|t[éè]l[éè]phone|courriel|transmet)/i],
        },
      },
    ],
  },
  {
    id: "restaurant-link",
    label: "Restaurant menu: must include a clickable link",
    locale: "fr-CA",
    turns: [
      {
        say: "pouvez-vous m'envoyer le menu du restaurant ?",
        expect: {
          mustInclude: [/\[.+\]\(https?:\/\/|clubsportifmaa\.com|libroreserve|resto1881/i],
        },
      },
    ],
  },
  {
    id: "non-member-class",
    label: "Non-member asking about a class — must mention Francis and explain membership tie",
    locale: "fr-CA",
    turns: [
      { say: "je veux essayer un cours de yoga" },
      { say: "non, je ne suis pas membre" },
      {
        say: "donc oui je suis intéressé",
        expect: {
          mustInclude: [/(francis|bradette|abonnement|visite|adh[éè]sion)/i],
          mustNotInclude: [/\bje\s+(?:vous\s+)?(?:r[éè]serve|inscris)\b/i],
        },
      },
    ],
  },
  {
    id: "price-objection-en",
    label: "EN price objection: reply must stay in English",
    locale: "en-CA",
    turns: [
      {
        say: "Why is it $225/month? That seems expensive.",
        expect: {
          mustInclude: [/(pool|spa|class|restaurant|1881|squash|amenit|include)/i],
          mustNotInclude: [/\b(votre|équipe|n['’]?hésitez|souhaitez-vous|notre)\b/i],
        },
      },
    ],
  },
  {
    id: "spa-non-member",
    label: "Spa for a non-member — never bluntly refuse, must route warmly",
    locale: "fr-CA",
    turns: [
      { say: "est-ce que je peux utiliser le sauna sans être membre ?" },
      {
        say: "donc je dois être membre c'est ça ?",
        expect: {
          mustInclude: [/(francis|bradette|abonnement|visite|adh[éè]sion)/i],
          mustNotInclude: [/\bnon[,\s]+(?:c['’]?est|on\s+ne)\b/i],
        },
      },
    ],
  },
];

async function postChat(message: string, locale: string, conversationId: string | null): Promise<{
  assistantMessage: string;
  conversationId: string | null;
}> {
  const url = `${BASE_URL.replace(/\/$/, "")}/v1/tenants/${TENANT}/chat`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, locale, conversationId }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { assistantMessage: string; conversationId: string | null };
  return data;
}

function longestCommonSubstring(a: string, b: string): string {
  if (!a || !b) return "";
  let best = "";
  for (let i = 0; i < a.length; i++) {
    for (let j = 0; j < b.length; j++) {
      let k = 0;
      while (i + k < a.length && j + k < b.length && a[i + k] === b[j + k]) k++;
      if (k > best.length) best = a.slice(i, i + k);
    }
  }
  return best;
}

async function runFlow(flow: Flow): Promise<{ id: string; passed: boolean; failureReason?: string; transcript: string[] }> {
  const transcript: string[] = [];
  let conversationId: string | null = null;
  const priorBotReplies: string[] = [];
  for (const [i, turn] of flow.turns.entries()) {
    transcript.push(`USER ${i + 1}: ${turn.say}`);
    let reply: string;
    try {
      const res = await postChat(turn.say, flow.locale, conversationId);
      conversationId = res.conversationId;
      reply = res.assistantMessage;
    } catch (err) {
      return { id: flow.id, passed: false, failureReason: `HTTP error at turn ${i + 1}: ${(err as Error).message}`, transcript };
    }
    transcript.push(`BOT  ${i + 1}: ${reply.replace(/\s+/g, " ").slice(0, 200)}${reply.length > 200 ? "..." : ""}`);

    if (turn.expect) {
      for (const re of turn.expect.mustInclude ?? []) {
        if (!re.test(reply)) {
          return { id: flow.id, passed: false, failureReason: `Turn ${i + 1}: reply missing required pattern ${re}`, transcript };
        }
      }
      for (const re of turn.expect.mustNotInclude ?? []) {
        if (re.test(reply)) {
          return { id: flow.id, passed: false, failureReason: `Turn ${i + 1}: reply matched FORBIDDEN pattern ${re}`, transcript };
        }
      }
    }

    const currentReplyNormalized = reply.replace(/\s+/g, " ").trim();
    for (const prev of priorBotReplies) {
      const overlap = longestCommonSubstring(currentReplyNormalized, prev);
      if (overlap.length > 0 && overlap.length / Math.max(currentReplyNormalized.length, 1) >= 0.8) {
        return {
          id: flow.id,
          passed: false,
          failureReason: `Turn ${i + 1}: bot repeated a prior reply verbatim (${overlap.length}/${currentReplyNormalized.length} chars match)`,
          transcript,
        };
      }
    }
    priorBotReplies.push(currentReplyNormalized);
  }
  return { id: flow.id, passed: true, transcript };
}

(async () => {
  console.log(`[daphne-replay] base=${BASE_URL} flows=${FLOWS.length}\n`);
  const results = [];
  for (const flow of FLOWS) {
    process.stdout.write(`  ${flow.id.padEnd(28)} ${flow.label}\n`);
    const r = await runFlow(flow);
    results.push(r);
    if (r.passed) {
      console.log(`    PASS`);
    } else {
      console.log(`    FAIL — ${r.failureReason}`);
      for (const line of r.transcript) console.log(`      ${line}`);
    }
    console.log();
  }
  const failed = results.filter((r) => !r.passed);
  console.log(`\n[daphne-replay] ${results.length - failed.length}/${results.length} flows passed`);
  if (failed.length > 0) {
    console.log(`[daphne-replay] FAILED flows: ${failed.map((f) => f.id).join(", ")}`);
    process.exit(1);
  }
})();
