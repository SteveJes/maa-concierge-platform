/**
 * Quick sanity check: load v2 + render the prompt + print it.
 * Usage: pnpm.cmd --filter @platform/api tsx src/scripts/preview-v2-prompt.ts [locale]
 */
import { buildMaaChatSystemPromptV2 } from "../prompts/maa-chat-system-v2.js";

const locale = process.argv[2] ?? "fr-CA";
const prompt = buildMaaChatSystemPromptV2(locale);
console.log(`# Generated v2 prompt (${locale}) — ${prompt.length} chars`);
console.log(prompt);
