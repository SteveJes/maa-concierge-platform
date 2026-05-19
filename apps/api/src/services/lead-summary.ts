/**
 * Generate a STAFF-READY RECAP of a chat or voice session, attached to lead
 * notification emails so the responsible team member (Francis / Nathalie /
 * Clinique / etc.) has everything they need to call the visitor back without
 * opening the full conversation.
 *
 * Daphné's email line 56-57: "prendre la demande-question et la transmettre
 * automatiquement par email à la personne responsable et lui transmettre un
 * résumé complet". The "résumé complet" means: a 1-2 sentence summary PLUS
 * structured action items, key topics asked, and a suggested next step.
 *
 * Cost-conscious: uses gpt-4o-mini, max 280 output tokens. Returns null when
 * OPENAI_API_KEY is missing or the call fails — the email still goes out
 * without a summary in those cases (no hard dependency).
 */
import { getLangfuse } from "../lib/langfuse.js";

export interface ConversationTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface RichLeadSummary {
  /** 1-2 sentence high-level summary. */
  summary: string;
  /** Concrete to-dos for the staff member: things the visitor needs / wants. */
  actionItems: string[];
  /** Topics the visitor specifically asked about (hours, prices, pickleball, etc.). */
  topicsAsked: string[];
  /** Suggested next step for the staff member ("Confirmer disponibilité du forfait spa pour 2 personnes"). */
  suggestedNextStep: string;
}

export async function summarizeLeadConversation(
  turns: ConversationTurn[],
  locale: "fr-CA" | "en-CA" | string = "fr-CA",
): Promise<string | null> {
  const rich = await summarizeLeadConversationRich(turns, locale);
  return rich?.summary ?? null;
}

/**
 * Richer version of the lead summary: returns structured intent + action items
 * + suggested next step. Used by the lead email template so staff get a
 * scannable, fully actionable recap (Daphné's "résumé complet" requirement).
 */
export async function summarizeLeadConversationRich(
  turns: ConversationTurn[],
  locale: "fr-CA" | "en-CA" | string = "fr-CA",
): Promise<RichLeadSummary | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const dialog = turns
    .filter((t) => t.role === "user" || t.role === "assistant")
    .slice(-16)
    .map((t) => `${t.role === "user" ? "Visiteur" : "Concierge"}: ${t.content}`)
    .join("\n");

  if (dialog.trim().length === 0) return null;

  const isFr = String(locale).startsWith("fr");
  const systemPrompt = isFr
    ? "Tu prépares un RÉSUMÉ COMPLET pour la personne du Club qui va rappeler ce visiteur. Ton public est interne (Francis Bradette, Nathalie Lambert, équipe clinique, etc.). Ton concis et professionnel. Réponds en JSON strict avec ces clés : summary (1-2 phrases sur l'intention principale), actionItems (liste de 1-4 to-dos très concrets que la personne doit traiter), topicsAsked (liste des sujets précis abordés par le visiteur), suggestedNextStep (1 phrase: la meilleure prochaine action). Ne mentionne PAS le nom du concierge IA."
    : "You prepare a COMPLETE STAFF RECAP for the Club staff member who will call this visitor back. Audience is internal (Francis Bradette, Nathalie Lambert, clinic team, etc.). Concise, professional tone. Respond in strict JSON with these keys: summary (1-2 sentences on main intent), actionItems (list of 1-4 concrete to-dos for the staff member), topicsAsked (list of specific topics the visitor raised), suggestedNextStep (1 sentence: the best next action). Do NOT mention the AI concierge's name.";

  const userPrompt = isFr
    ? `Conversation à résumer:\n\n${dialog}\n\nRéponds en JSON strict avec les clés : summary, actionItems (array de strings), topicsAsked (array de strings), suggestedNextStep.`
    : `Conversation to summarize:\n\n${dialog}\n\nRespond in strict JSON with keys: summary, actionItems (array of strings), topicsAsked (array of strings), suggestedNextStep.`;

  const lf = getLangfuse();
  const trace = lf?.trace({
    name: "lead-summary-rich",
    input: { dialog: dialog.slice(0, 200) + "...", locale },
  });
  const generation = trace?.generation({
    name: "lead-summary-rich",
    model: "gpt-4o-mini",
    input: { dialog, locale },
    startTime: new Date(),
  });

  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 320,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!res.ok) {
      generation?.end({ output: null, level: "ERROR", statusMessage: `HTTP ${res.status}` });
      return null;
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = json.choices?.[0]?.message?.content?.trim() ?? null;
    if (!raw) {
      generation?.end({ output: null, level: "ERROR", statusMessage: "empty_response" });
      return null;
    }

    let parsed: Partial<RichLeadSummary> = {};
    try {
      parsed = JSON.parse(raw) as Partial<RichLeadSummary>;
    } catch {
      generation?.end({ output: raw, level: "ERROR", statusMessage: "json_parse_failed" });
      return null;
    }

    const result: RichLeadSummary = {
      summary: typeof parsed.summary === "string" ? parsed.summary.trim() : "",
      actionItems: Array.isArray(parsed.actionItems)
        ? parsed.actionItems.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 6)
        : [],
      topicsAsked: Array.isArray(parsed.topicsAsked)
        ? parsed.topicsAsked.filter((x): x is string => typeof x === "string" && x.trim().length > 0).slice(0, 8)
        : [],
      suggestedNextStep: typeof parsed.suggestedNextStep === "string" ? parsed.suggestedNextStep.trim() : "",
    };

    generation?.end({ output: result });

    if (result.summary.length === 0 && result.actionItems.length === 0) return null;
    return result;
  } catch {
    generation?.end({ output: null, level: "ERROR", statusMessage: "fetch_failed" });
    return null;
  }
}
