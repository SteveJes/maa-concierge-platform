/**
 * Vitest wrapper around the standalone tsx regression scripts.
 *
 * The tsx scripts (test-maa-intent-regression, test-dubub-intent-regression) remain the
 * single source of truth for test cases — useful as standalone debugging tools.
 * This wrapper makes them CI-runnable via `pnpm.cmd --filter @platform/api test`.
 *
 * Skipped automatically when OPENAI_API_KEY is missing (CI without secrets, local
 * dev without keys) — vitest reports the test as skipped rather than failed.
 */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import dotenv from "dotenv";

const currentFile = fileURLToPath(import.meta.url);
const apiRoot = path.resolve(path.dirname(currentFile), "../..");
const repoRoot = path.resolve(apiRoot, "../..");

// Load env so the spawned tsx process inherits OPENAI_API_KEY/NOCO_DB_TOKEN.
for (const envFile of [
  path.join(apiRoot, ".env.local"),
  path.join(apiRoot, ".env"),
  path.join(repoRoot, ".env.local"),
  path.join(repoRoot, ".env"),
]) {
  dotenv.config({ path: envFile, override: false });
}

const hasOpenAiKey = Boolean(process.env.OPENAI_API_KEY);

function runScript(scriptName: string): { stdout: string; status: number } {
  const result = spawnSync("npx", ["tsx", `src/scripts/${scriptName}`], {
    cwd: apiRoot,
    encoding: "utf8",
    shell: true,
    env: process.env,
  });
  return { stdout: (result.stdout ?? "") + (result.stderr ?? ""), status: result.status ?? 1 };
}

describe.skipIf(!hasOpenAiKey)("MAA + DUBUB intent regression (live OpenAI)", () => {
  it("MAA intent regression — 23 cases", () => {
    const { stdout, status } = runScript("test-maa-intent-regression.ts");
    if (status !== 0) {
      console.error(stdout);
    }
    expect(status, stdout.split("\n").slice(-30).join("\n")).toBe(0);
  });

  it("DUBUB intent regression — 12 cases", () => {
    const { stdout, status } = runScript("test-dubub-intent-regression.ts");
    if (status !== 0) {
      console.error(stdout);
    }
    expect(status, stdout.split("\n").slice(-30).join("\n")).toBe(0);
  });
});
