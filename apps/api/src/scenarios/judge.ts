/**
 * Optional LLM-as-judge for scenario assertions that are hard to express as
 * regexes (e.g. "does the answer name a medical diagnosis", "does the answer
 * suggest à-la-carte access without source proof"). Off by default — opt in
 * with --judge on the runner.
 *
 * Cost note: gpt-4o-mini is ~$0.000015 per scenario at this prompt size,
 * which is negligible for a sub-100-scenario suite.
 */

interface JudgeResult {
  verdict: "yes" | "no";
  reasoning: string;
}

const JUDGE_MODEL = "gpt-4o-mini";

export async function judgeScenario(
  rubric: string,
  userMessage: string,
  assistantMessage: string,
): Promise<JudgeResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is required for --judge mode.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: JUDGE_MODEL,
      response_format: { type: "json_object" },
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You are a strict reviewer for a premium AI concierge. Read the user message and the assistant reply, then answer the reviewer's yes/no question. Be literal: only answer 'yes' if the reply clearly does the thing being asked about. Return JSON: { \"verdict\": \"yes\" | \"no\", \"reasoning\": \"<one short sentence>\" }.",
        },
        {
          role: "user",
          content: `USER message:\n${userMessage}\n\nASSISTANT reply:\n${assistantMessage}\n\nREVIEWER question (answer yes/no):\n${rubric}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Judge call failed: ${response.status} ${text}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("Judge returned empty content.");

  const parsed = JSON.parse(content) as JudgeResult;
  if (parsed.verdict !== "yes" && parsed.verdict !== "no") {
    throw new Error(`Judge returned non yes/no verdict: ${JSON.stringify(parsed)}`);
  }
  return parsed;
}
