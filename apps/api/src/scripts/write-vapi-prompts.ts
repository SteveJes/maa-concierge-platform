/**
 * Write both VAPI system prompts to files in `_vapi-prompts/` at the repo root,
 * so you can open them in an editor and copy/paste into the VAPI dashboard.
 *
 * Run: pnpm.cmd --filter @platform/api exec tsx src/scripts/write-vapi-prompts.ts
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { buildVapiSystemPrompt } from "../prompts/vapi-system.js";
import { buildDububVapiSystemPrompt } from "../prompts/dubub-vapi-system.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../..");
const outDir = path.join(repoRoot, "_vapi-prompts");

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const sophie = buildVapiSystemPrompt();
const sophia = buildDububVapiSystemPrompt();

const sophiePath = path.join(outDir, "sophie-maa.txt");
const sophiaPath = path.join(outDir, "sophia-dubub.txt");

fs.writeFileSync(sophiePath, sophie, "utf8");
fs.writeFileSync(sophiaPath, sophia, "utf8");

console.log(`Wrote ${sophiePath} (${sophie.length} chars)`);
console.log(`Wrote ${sophiaPath} (${sophia.length} chars)`);
