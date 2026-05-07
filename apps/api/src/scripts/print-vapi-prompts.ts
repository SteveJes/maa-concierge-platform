/**
 * Print both VAPI system prompts (Sophie for MAA, SophIA for DUBUB) so you can
 * copy them into the VAPI dashboard.
 *
 * Run: pnpm.cmd --filter @platform/api vapi:prompts
 *      or: cd apps/api && npx tsx src/scripts/print-vapi-prompts.ts
 *
 * Single-prompt mode:
 *   npx tsx src/scripts/print-vapi-prompts.ts maa
 *   npx tsx src/scripts/print-vapi-prompts.ts dubub
 */
import { buildVapiSystemPrompt } from "../prompts/vapi-system.js";
import { buildDububVapiSystemPrompt } from "../prompts/dubub-vapi-system.js";

const which = (process.argv[2] ?? "all").toLowerCase();

function divider(label: string): void {
  const bar = "=".repeat(80);
  console.log(`\n${bar}\n${label}\n${bar}\n`);
}

if (which === "all" || which === "maa") {
  divider("MAA — Sophie (paste into VAPI assistant: clubmaa-sophie)");
  console.log(buildVapiSystemPrompt());
}

if (which === "all" || which === "dubub") {
  divider("DUBUB — SophIA (paste into VAPI assistant: dubub-sophia)");
  console.log(buildDububVapiSystemPrompt());
}

if (!["all", "maa", "dubub"].includes(which)) {
  console.error(`Unknown tenant: ${which}. Use 'maa', 'dubub', or omit for both.`);
  process.exit(1);
}
