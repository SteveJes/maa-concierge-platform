/**
 * Langfuse client — LLM observability for OpenAI calls.
 *
 * Returns null when env vars are missing (local dev without keys, CI). All call sites
 * MUST tolerate a null client — wrap with `if (langfuse) { ... }` or use the helpers.
 *
 * Why not langfuse-openai? We call the OpenAI HTTP API via raw fetch (not the SDK),
 * so we instrument manually with `generation()` + `update()` spans.
 *
 * Cleanup: nothing to do at process exit — Fastify keeps the process alive and the
 * SDK flushes on its own interval. For one-shot scripts, call `await langfuse.flushAsync()`.
 */
import { Langfuse } from "langfuse";

let cached: Langfuse | null | undefined;

export function getLangfuse(): Langfuse | null {
  if (cached !== undefined) return cached;

  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const baseUrl = process.env.LANGFUSE_BASE_URL ?? "https://cloud.langfuse.com";

  if (!secretKey || !publicKey) {
    cached = null;
    return null;
  }

  cached = new Langfuse({
    secretKey,
    publicKey,
    baseUrl,
    flushAt: 5,
    flushInterval: 5_000,
  });
  return cached;
}

export interface TraceInput {
  tenantCode: string | undefined;
  locale: string | undefined;
  userMessage: string;
  /** Stable identifier for the conversation/session, if available. */
  sessionId?: string | undefined;
  /** Used for filtering in the Langfuse dashboard. */
  userId?: string | undefined;
}

/**
 * Convenience wrapper: open a trace + generation span for an OpenAI call,
 * then return a `complete()` callback to record the response and usage.
 * No-ops cleanly when Langfuse is not configured.
 */
export function startOpenAiGeneration(
  input: TraceInput,
  options: {
    name: string;
    model: string;
    prompt: unknown;
  },
): {
  complete: (output: {
    assistantMessage: string;
    followUpMode: string;
    usage?: { inputTokens: number; outputTokens: number };
  }) => void;
  fail: (error: unknown) => void;
} {
  const lf = getLangfuse();
  if (!lf) {
    return { complete: () => {}, fail: () => {} };
  }

  const trace = lf.trace({
    name: options.name,
    input: { userMessage: input.userMessage },
    metadata: {
      tenantCode: input.tenantCode ?? "unknown",
      locale: input.locale ?? "unknown",
    },
    sessionId: input.sessionId,
    userId: input.userId,
  });

  const generation = trace.generation({
    name: options.name,
    model: options.model,
    input: options.prompt,
    startTime: new Date(),
  });

  return {
    complete: ({ assistantMessage, followUpMode, usage }) => {
      generation.end({
        output: { assistantMessage, followUpMode },
        usage: usage
          ? {
              input: usage.inputTokens,
              output: usage.outputTokens,
              unit: "TOKENS",
            }
          : undefined,
      });
      trace.update({ output: { assistantMessage, followUpMode } });
    },
    fail: (error) => {
      generation.end({
        output: null,
        level: "ERROR",
        statusMessage: error instanceof Error ? error.message : String(error),
      });
    },
  };
}
