/**
 * Generate a 1-2 sentence AI summary of a chat or voice session, attached to
 * lead notification emails so Steve / Daphné / the tenant team see what the
 * lead asked about at a glance — without opening the full conversation.
 *
 * Cost-conscious: uses gpt-4o-mini, max 80 output tokens. Returns null when
 * OPENAI_API_KEY is missing or the call fails — the email still goes out
 * without a summary in those cases (no hard dependency).
 */
import { getLangfuse } from "../lib/langfuse.js";

export interface ConversationTurn {
  role: "user" | "assistant" | "system";
  content: string;
}

export async function summarizeLeadConversation(
  turns: ConversationTurn[],
  locale: "fr-CA" | "en-CA" | string = "fr-CA",
): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  // Drop the system messages — we only want the user/assistant exchange.
  const dialog = turns
    .filter((t) => t.role === "user" || t.role === "assistant")
    .slice(-12) // last 12 turns is plenty for a summary
    .map((t) => `${t.role === "user" ? "Visiteur" : "Concierge"}: ${t.content}`)
    .join("\n");

  if (dialog.trim().length === 0) return null;

  const isFr = String(locale).startsWith("fr");
  const systemPrompt = isFr
    ? "Tu résumes en 1 à 2 phrases courtes ce que le visiteur cherchait dans la conversation ci-dessous. Va droit au but : sujet principal + intention. Utilise un ton professionnel. Ne mentionne pas le nom du concierge."
    : "Summarize in 1-2 short sentences what the visitor was looking for in the conversation below. Be direct: main topic + intent. Use a professional tone. Don't mention the concierge's name.";

  const lf = getLangfuse();
  const trace = lf?.trace({
    name: "lead-summary",
    input: { dialog: dialog.slice(0, 200) + "...", locale },
  });
  const generation = trace?.generation({
    name: "lead-summary",
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
        max_tokens: 100,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: dialog },
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
    const summary = json.choices?.[0]?.message?.content?.trim() ?? null;
    generation?.end({ output: summary });
    return summary && summary.length > 0 ? summary : null;
  } catch {
    generation?.end({ output: null, level: "ERROR", statusMessage: "fetch_failed" });
    return null;
  }
}
