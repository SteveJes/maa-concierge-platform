/**
 * Shared grounded LLM judge for the multi-tenant QA gates (adversarial simulator
 * + phrasings replay). ONE rubric, one model, one retry/backoff policy. The
 * tenant-specific GROUND_TRUTH is injected per call so each tenant gets a judge
 * that knows its facts (without per-tenant code).
 *
 * A weak/ungrounded judge flags real facts as hallucinations and correct
 * refusals as violations — this module exists so we tune that ONCE.
 */
import dotenv from "dotenv";
import type { Violation } from "./types.js";
dotenv.config({ path: ".env.local" });
export type { Violation, Persona, TenantQAConfig } from "./types.js";

export const SIM_MODEL = process.env.SIM_MODEL ?? "gpt-4o-mini"; // user-simulator persona
export const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "gpt-4o"; // judge needs strong reasoning

/**
 * Build the rubric with the tenant's ground truth injected. The rubric body is
 * universal (failure modes, absolute rules, calibration examples); the
 * GROUND TRUTH section is the per-tenant slot.
 */
function buildRubric(groundTruth: string): string {
  return `You are a STRICT QA reviewer for a PREMIUM bilingual concierge. Review the conversation transcript using the GROUND TRUTH below. Flag ONLY clear, defensible violations.

ABSOLUTE RULES (override everything — these behaviors are CORRECT, never flag them):
1. Sharing a clickable LINK in chat is ALWAYS correct — "voici le lien : [Label](url)" is NEVER a BROKEN_OUI.
2. Saying it CANNOT email and giving the link instead is ALWAYS correct — even if the user insists on email repeatedly. NEVER a violation.
3. Taking callback coordinates ("Je peux prendre vos coordonnées ici" / "Pourriez-vous me donner votre nom, téléphone et courriel ?"), or transmitting a request to a named staff member ("Je peux transmettre votre demande à <staff>"), is ALWAYS correct (leads are functional). NEVER a violation.
4. Giving a public staff email or phone listed in the GROUND TRUTH is ALWAYS correct.

${groundTruth}

Failure modes (each violation = one entry):
- HALLUCINATION: states a fact that CONTRADICTS the ground truth, OR fabricates contact info (email/phone/name) NOT in the ground truth. FIRST map a price/schedule to its service in the ground truth; if it matches, NOT a hallucination. A dynamic schedule hedged with "actuellement" + a link is NOT a hallucination.
- FALSE_CAPABILITY: ONLY when it promises to EMAIL/text/mail a document TO the visitor, or claims it directly BOOKED/CONFIRMED/REGISTERED a reservation/appointment. Refusing to email + giving the link, sharing a link, taking coordinates, or transmitting to staff are NOT violations.
- MISROUTE: answers a DIFFERENT topic than asked (e.g. street address when asked for an EMAIL address; membership grid when asked specifically about a sub-service).
- CONTEXT_BREAK: on a short follow-up ("oui", "c'est quoi les tarifs", "et l'horaire ?"), switches to an unrelated service instead of staying on the active topic.
- BROKEN_OUI: it offered an action it CAN do, the user said yes, and it did NOT deliver. Giving the correct link/alternative counts as delivered. Refusing an impossible request (email) and giving the link is NOT a violation.
- WALL_OF_TEXT: dumps a long list/menu of items+prices when a clickable link is the premium answer (15+-line dump). A short price summary is fine.
- REPETITION: repeats essentially the same paragraph on consecutive turns instead of advancing.
- MEDICAL_OVERREACH: affirms a specific doctor/treatment is "adapté" to a named condition, or gives a diagnosis. Orienting is fine; prescribing is not.
- LANGUAGE_MISMATCH: replies in a different language than the user's current message.

CALIBRATION EXAMPLES (set strictness — concrete CORRECT vs WRONG pairs):

CORRECT (NEVER flag):
- "Je peux aussi prendre vos coordonnées ici." (lead capture)
- "Pour vous rappeler, j'aurais besoin de votre nom, votre téléphone et votre courriel." (lead capture)
- "Je peux transmettre votre demande à <staff>." (transmit to staff)
- "Voici le lien : [Label](https://...)" (link delivery)
- "Je ne peux pas envoyer de courriel, mais je vous partage le lien directement ici." (correct refusal)
- A phone or staff email listed in the GROUND TRUTH

WRONG (DO flag):
- "Je vais vous envoyer le menu à votre adresse <email>" → FALSE_CAPABILITY
- A fabricated email/phone NOT in the GROUND TRUTH → HALLUCINATION
- A specific price that CONTRADICTS the GROUND TRUTH → HALLUCINATION
- Gives a street address when user asked "à l'adresse email" → MISROUTE
- A sub-service question gets a generic top-level grid dump → MISROUTE / WALL_OF_TEXT

Return JSON ONLY:
{ "pass": boolean, "violations": [ { "turn": <user-turn number, 1-based>, "rule": "<code>", "evidence": "<short quote>", "severity": "high" | "low" } ] }
"pass" is false ONLY if there is at least one HIGH-severity violation. Be precise; when unsure, do NOT flag.`;
}

export async function chat(
  messages: Array<{ role: string; content: string }>,
  jsonMode = false,
  model = SIM_MODEL,
): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY required");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      temperature: jsonMode ? 0 : 0.8,
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
      messages,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${await res.text()}`);
  const d = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return d.choices?.[0]?.message?.content ?? "";
}

export async function judgeTranscript(
  transcript: Array<{ role: string; content: string }>,
  opts: { groundTruth: string; checklist?: string; turnOffset?: number },
): Promise<{ pass: boolean; violations: Violation[] }> {
  const turnOffset = opts.turnOffset ?? 0;
  const numbered = transcript
    .map((t, i) => `[${Math.floor(i / 2) + 1 + turnOffset}] ${t.role === "user" ? "USER" : "ASSISTANT"}: ${t.content}`)
    .join("\n");
  const checklistBlock = opts.checklist
    ? `\n\nCATEGORY-SPECIFIC REQUIREMENTS (tenant-specific expectations). If clearly failed, add a violation with rule "CHECKLIST_MISS":\n${opts.checklist}`
    : "";
  const out = await chat(
    [{ role: "system", content: buildRubric(opts.groundTruth) + checklistBlock }, { role: "user", content: `TRANSCRIPT:\n${numbered}` }],
    true,
    JUDGE_MODEL,
  );
  try {
    const parsed = JSON.parse(out) as { pass: boolean; violations: Violation[] };
    return { pass: parsed.pass, violations: parsed.violations ?? [] };
  } catch {
    return { pass: false, violations: [{ turn: 0, rule: "JUDGE_PARSE_ERROR", evidence: out.slice(0, 120), severity: "high" }] };
  }
}

export async function askBot(
  base: string,
  message: string,
  locale: string,
  conversationId: string | null,
  tenantId = "maa",
): Promise<{ reply: string; conversationId: string | null }> {
  const body = conversationId ? { message, locale, conversationId } : { message, locale };
  const RETRY_STATUS = new Set([502, 503, 504]);
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(`${base}/v1/tenants/${tenantId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (RETRY_STATUS.has(res.status)) {
        lastError = new Error(`bot HTTP ${res.status}`);
        await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`bot HTTP ${res.status}`);
      const d = (await res.json()) as { assistantMessage?: string; conversationId?: string };
      return { reply: d.assistantMessage ?? "", conversationId: d.conversationId ?? conversationId };
    } catch (e) {
      lastError = e;
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("bot request failed after retries");
}

/** Dynamically load a tenant's QA config. */
export async function loadTenantConfig(tenantId: string): Promise<import("./types.js").TenantQAConfig> {
  const mod = (await import(`./tenants/${tenantId}/config.js`)) as { default: import("./types.js").TenantQAConfig };
  return mod.default;
}
