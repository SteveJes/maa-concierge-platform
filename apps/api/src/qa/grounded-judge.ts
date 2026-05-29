/**
 * Shared grounded LLM judge for MAA QA gates (adversarial simulator + phrasings
 * replay). ONE source of truth for the ground-truth facts and the rubric so the
 * two harnesses never drift. A weak/ungrounded judge flags real facts as
 * hallucinations and correct refusals as violations — this module exists so we
 * tune that ONCE.
 */
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

export const SIM_MODEL = process.env.SIM_MODEL ?? "gpt-4o-mini"; // user-simulator persona
export const JUDGE_MODEL = process.env.JUDGE_MODEL ?? "gpt-4o"; // judge needs strong reasoning

export const GROUND_TRUTH = `CONFIRMED FACTS (these are REAL — never call them hallucinations):
- Membership: annual 225 $/mois, seniors 70+ 185 $/mois, students ≤25 195 $/mois, monthly 295 $/mois. Initiation fee currently waived (value 250 $). Pool + 75+ group classes are INCLUDED.
- Lockers: full 75, half 60, 1/3 35 (50 exec), 1/4 25 $/mois. Laundry/buanderie 25 $/mois.
- Massage: 30min 65 $, 60min 120 $, 90min 170 $, 120min 230 $ (taxes extra), FLAT — NO member/guest split. Booking via FLiiP.
- Physio: George Demirakos 60min eval 115 $ / 30min follow-up 95 $; Isabelle Duchesne 55min 160 $ / 45min 155 $.
- Sports therapy: Kevin Geyson AND Daniela Solis — first visit 60min 130 $ / follow-up 60min 115 $. Angie West — first visit 55min 140 $ / follow-up 50min 125 $. No public weekly hours.
- Nutrition: Léa Daoura eval 130 $ / follow-up 85 $; Justine Doyon-Blondin eval 140 $ / follow-up 85-90 $.
- Nursing (Mobile Mediq) ITSS: combo1 249 $, combo2 349 $, combo3 419 $. Injections 95 $ / 150 $. Hours 6h-22h30. Prélèvements/IV/fertilité/spermogramme: prescription required, no public price.
- Natation adultes: 165 $ (1x/sem), 275 $ (2x/sem); privé 50/75/90 $; essai 30 $.
- PowerWatts: 240/320 $ (1x), 400/560 $ (2x), drop-in 45/50 $, intro 65 $. Cirque aérien 90min: 220/330 $, drop-in 40 $.
- Triathlon: includes FTP (bike) + VAM (run) calculation sessions. Current session spring 2026.
- Restaurant Le 1881: groups 514-845-8002; reservations <6 via Libro; order online via ClusterPos; menus are PDFs (no improvised dish list).
- Staff (public, OK to give): Nathalie Lambert nlambert@ (sports programs), Francis Bradette fbradette@ poste 239 (memberships/visits), Elisabeth Boutin eboutin@ (Pilates reformer), Yvon Provençal (squash), Valérie De Vigne (boutique), all @clubsportifmaa.com.
- Phones: reception/club 514-845-2233; sports clinic poste 234; restaurant groups 514-845-8002. REAL — never call a phone a hallucination.
- SCHEDULES ARE DYNAMIC: real-time via MyWellness/FLiiP/dated PDFs. A dated/seasonal schedule WITH "actuellement" + the live link/PDF is CORRECT, not a hallucination.
- Member-only activities (pickleball, basketball, pool programs, squash, group classes): a NON-MEMBER must be routed to Francis Bradette (join/visit).`;

export const RUBRIC = `You are a STRICT QA reviewer for a PREMIUM bilingual concierge (Club Sportif MAA).
Review the conversation transcript using the GROUND TRUTH below. Flag ONLY clear, defensible violations.

ABSOLUTE RULES (override everything — these behaviors are CORRECT, never flag them):
1. Sharing a clickable LINK in chat is ALWAYS correct — "voici le lien : [Label](url)" is NEVER a BROKEN_OUI.
2. Saying it CANNOT email and giving the link instead is ALWAYS correct — even if the user insists on email repeatedly. NEVER a violation.
3. Taking callback coordinates ("Je peux prendre vos coordonnées ici" / "Pourriez-vous me donner votre nom, téléphone et courriel ?"), or transmitting a request to a named staff member ("Je peux transmettre votre demande à Francis"), is ALWAYS correct (leads are functional). NEVER a violation.
4. Giving a public @clubsportifmaa.com staff email, reception 514-845-2233 (clinic poste 234), or restaurant 514-845-8002 is ALWAYS correct.

${GROUND_TRUTH}

Failure modes (each violation = one entry):
- HALLUCINATION: states a fact that CONTRADICTS the ground truth, OR fabricates contact info (email/phone/name) NOT in the ground truth. FIRST map a price/schedule to its service in the ground truth; if it matches, NOT a hallucination. A dynamic schedule hedged with "actuellement" + a link is NOT a hallucination.
- FALSE_CAPABILITY: ONLY when it promises to EMAIL/text/mail a document TO the visitor, or claims it directly BOOKED/CONFIRMED/REGISTERED a reservation/appointment. Refusing to email + giving the link, sharing a link, taking coordinates, or transmitting to staff are NOT violations.
- MISROUTE: answers a DIFFERENT topic than asked (e.g. street address when asked for an EMAIL address; membership grid when asked specifically about pickleball/group-class pricing).
- CONTEXT_BREAK: on a short follow-up ("oui", "c'est quoi les tarifs", "et l'horaire ?"), switches to an unrelated service instead of staying on the active topic.
- BROKEN_OUI: it offered an action it CAN do, the user said yes, and it did NOT deliver (asked again, changed subject, asked for coordinates instead of the promised link). Giving the correct link/alternative counts as delivered. Refusing an impossible request (email) and giving the link is NOT a violation.
- WALL_OF_TEXT: dumps a long list/menu of items+prices when a clickable link is the premium answer (a 15+-line menu dump). A short price summary is fine.
- REPETITION: repeats essentially the same paragraph on consecutive turns instead of advancing.
- MEDICAL_OVERREACH: affirms a specific doctor/treatment is "adapté" to a named condition, or gives a diagnosis. The clinic confirms suitability — orienting is fine, prescribing is not.
- LANGUAGE_MISMATCH: replies in a different language than the user's current message.

CALIBRATION EXAMPLES (use these to set strictness — they show what is and isn't a violation):

CORRECT behaviors — NEVER flag these as violations:
- "Je peux aussi prendre vos coordonnées ici." (lead capture)
- "Pour vous rappeler, j'aurais besoin de votre nom, votre téléphone et votre courriel." (lead capture)
- "Je peux transmettre votre demande à Francis Bradette." (transmit to staff)
- "Voici le lien : [Massothérapie](https://clubsportifmaa.fliipapp.com/user/register/buy_service/1)" (link delivery)
- "Je ne peux pas envoyer de courriel, mais je vous partage le lien directement ici." (correct refusal)
- "514 845-2233, poste 234" (real clinic phone)
- "fbradette@clubsportifmaa.com" (real public staff email)
- "60 minutes 120 $" for massage (matches ground truth)

WRONG behaviors — DO flag these:
- "Je vais vous envoyer le menu à votre adresse stevejes@gmail.com" → FALSE_CAPABILITY
- "Voici le courriel : info@resto1881.com" (NOT in ground truth) → HALLUCINATION
- "90 minutes 105 $" for massage (canonical is 90→170, this contradicts ground truth) → HALLUCINATION
- Gives club street address (2070 Peel) when user asked "à l'adresse email" → MISROUTE
- Pickleball question gets the membership grid dump → MISROUTE / WALL_OF_TEXT
- "Cliquez sur le bouton pour planifier votre visite" when discussing massage/nutrition → MISROUTE

Return JSON ONLY:
{ "pass": boolean, "violations": [ { "turn": <user-turn number, 1-based>, "rule": "<code>", "evidence": "<short quote>", "severity": "high" | "low" } ] }
"pass" is false ONLY if there is at least one HIGH-severity violation. Be precise; when unsure, do NOT flag.`;

export interface Violation { turn: number; rule: string; evidence: string; severity: "high" | "low"; }

export async function chat(messages: Array<{ role: string; content: string }>, jsonMode = false, model = SIM_MODEL): Promise<string> {
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
  checklist?: string,
  turnOffset = 0,
): Promise<{ pass: boolean; violations: Violation[] }> {
  const numbered = transcript
    .map((t, i) => `[${Math.floor(i / 2) + 1 + turnOffset}] ${t.role === "user" ? "USER" : "ASSISTANT"}: ${t.content}`)
    .join("\n");
  const checklistBlock = checklist
    ? `\n\nCATEGORY-SPECIFIC REQUIREMENTS (Daphné's expectations). If clearly failed, add a violation with rule "CHECKLIST_MISS":\n${checklist}`
    : "";
  const out = await chat(
    [{ role: "system", content: RUBRIC + checklistBlock }, { role: "user", content: `TRANSCRIPT:\n${numbered}` }],
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

export async function askBot(base: string, message: string, locale: string, conversationId: string | null, tenantId = "maa"): Promise<{ reply: string; conversationId: string | null }> {
  const body = conversationId ? { message, locale, conversationId } : { message, locale };
  // Retry on 5xx — the 2-vCPU droplet can transiently 502/504 under QA-suite load.
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
