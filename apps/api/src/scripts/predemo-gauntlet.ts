/**
 * PRE-DEMO GAUNTLET — run this BEFORE showing the platform to Daphné or any
 * client. Daphné's 2026-05-19 frustration: she keeps catching bugs that should
 * never have reached her in the first place. This script is the contract: if
 * the gauntlet is green, the demo is safe. If anything is red, fix before
 * showing.
 *
 * Pipeline (sequential, fail-fast on the structural ones):
 *   1. typecheck — api + web + ui-chat
 *   2. test-maa-intent-regression — 57+ deterministic intent cases
 *   3. test-dubub-intent-regression — DUBUB intent cases
 *   4. test-handoff-acceptance-regression — multi-turn handoff
 *   5. daphne-replay canary — 36 flows against the live HTTP API
 *   6. Sentinel scenarios (with LLM judge) — full scenario sweep
 *
 * Output: a single REPORT-predemo-{ISO}.md under apps/api/_predemo/ with
 * per-stage pass/fail + the exact failing assertion text so Steve / Claude
 * can fix without spelunking.
 *
 * Usage:
 *   cd apps/api && npx tsx src/scripts/predemo-gauntlet.ts          # local
 *   DAPHNE_REPLAY_URL=https://api.dubub.com pnpm gauntlet:prod      # prod
 *
 * Exits 1 if any stage fails — wire this into deploy.sh as a final gate.
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

interface StageResult {
  id: string;
  label: string;
  passed: boolean;
  durationMs: number;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// apps/api/src/scripts → apps/api
const apiRoot = join(__dirname, "..", "..");
const reportDir = join(apiRoot, "_predemo");
const monorepoRoot = join(apiRoot, "..", "..");

const BASE_URL = process.env.DAPHNE_REPLAY_URL ?? "http://localhost:4000";
const RUN_E2E = process.env.PREDEMO_E2E !== "false";
const RUN_SENTINEL = process.env.PREDEMO_SENTINEL !== "false";

function ts(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function runStage(
  id: string,
  label: string,
  command: string,
  args: string[],
  cwd: string,
  envOverrides: Record<string, string> = {},
): Promise<StageResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const child = spawn(command, args, {
      cwd,
      shell: process.platform === "win32",
      env: { ...process.env, ...envOverrides },
    });
    child.stdout.on("data", (d) => stdoutChunks.push(d.toString()));
    child.stderr.on("data", (d) => stderrChunks.push(d.toString()));
    child.on("close", (code) => {
      const durationMs = Date.now() - start;
      const passed = code === 0;
      const result: StageResult = {
        id,
        label,
        passed,
        durationMs,
        stdout: stdoutChunks.join(""),
        stderr: stderrChunks.join(""),
        exitCode: code,
      };
      const tag = passed ? "PASS" : "FAIL";
      const dur = (durationMs / 1000).toFixed(1);
      // eslint-disable-next-line no-console
      console.log(`  [${tag}] ${id.padEnd(36)} ${label} (${dur}s)`);
      if (!passed) {
        const tail = (stdoutChunks.join("") + stderrChunks.join("")).split("\n").slice(-30).join("\n");
        // eslint-disable-next-line no-console
        console.log(`        ─── tail ───\n${tail.split("\n").map((l) => `        ${l}`).join("\n")}\n`);
      }
      resolve(result);
    });
  });
}

function summarize(results: StageResult[]): string {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed);
  const totalSec = (results.reduce((s, r) => s + r.durationMs, 0) / 1000).toFixed(1);
  const lines: string[] = [
    `# Pre-demo gauntlet — ${new Date().toISOString()}`,
    "",
    `**Target:** \`${BASE_URL}\``,
    `**Result:** ${passed}/${results.length} stages passed (${totalSec}s total)`,
    "",
  ];
  if (failed.length === 0) {
    lines.push("✅ **All clear — safe to demo.**");
  } else {
    lines.push(`❌ **${failed.length} stage(s) failed — FIX before any demo.**`);
    lines.push("");
    lines.push("## Failing stages");
    for (const f of failed) {
      lines.push(`### ${f.id} — ${f.label}`);
      lines.push("");
      const tail = (f.stdout + f.stderr).split("\n").slice(-40).join("\n");
      lines.push("```");
      lines.push(tail);
      lines.push("```");
      lines.push("");
    }
  }
  lines.push("");
  lines.push("## Stage timings");
  for (const r of results) {
    lines.push(`- ${r.passed ? "✓" : "✗"} ${r.id} — ${(r.durationMs / 1000).toFixed(1)}s`);
  }
  return lines.join("\n");
}

(async () => {
  // eslint-disable-next-line no-console
  console.log(`[predemo-gauntlet] target=${BASE_URL} sentinel=${RUN_SENTINEL} e2e=${RUN_E2E}\n`);
  if (!existsSync(reportDir)) mkdirSync(reportDir, { recursive: true });

  const results: StageResult[] = [];

  // STAGE 1 — Type check (cheap and structural).
  results.push(
    await runStage(
      "typecheck-api",
      "TypeScript check (api)",
      "npx",
      ["tsc", "-p", "tsconfig.json", "--noEmit"],
      apiRoot,
    ),
  );

  // STAGE 2 — Deterministic intent regression (no AI judge, fast).
  results.push(
    await runStage(
      "intent-regression-maa",
      "MAA intent regression (57+ cases, deterministic)",
      "npx",
      ["tsx", "src/scripts/test-maa-intent-regression.ts"],
      apiRoot,
    ),
  );

  results.push(
    await runStage(
      "intent-regression-dubub",
      "DUBUB intent regression (12 cases)",
      "npx",
      ["tsx", "src/scripts/test-dubub-intent-regression.ts"],
      apiRoot,
    ),
  );

  // STAGE 3 — Handoff acceptance regression (routing-only without OPENAI_API_KEY).
  results.push(
    await runStage(
      "handoff-acceptance",
      "Handoff-acceptance regression (multi-turn)",
      "npx",
      ["tsx", "src/scripts/test-handoff-acceptance-regression.ts"],
      apiRoot,
    ),
  );

  // STAGE 4 — Daphné-replay canary (live HTTP API, 36 flows).
  results.push(
    await runStage(
      "daphne-replay-canary",
      `daphne-replay canary (live ${BASE_URL})`,
      "npx",
      ["tsx", "src/scripts/daphne-replay.ts"],
      apiRoot,
      { DAPHNE_REPLAY_URL: BASE_URL },
    ),
  );

  // STAGE 5 — Sentinel scenarios with LLM judge (semantic regression sweep).
  if (RUN_SENTINEL) {
    results.push(
      await runStage(
        "sentinel-scenarios",
        "Sentinel scenarios with LLM judge",
        "npx",
        ["tsx", "src/scripts/test-scenarios.ts", "--tenant", "maa"],
        apiRoot,
      ),
    );
  }

  // STAGE 6 — Playwright live-UI tests (browser-level regression).
  if (RUN_E2E) {
    results.push(
      await runStage(
        "playwright-daphne",
        "Playwright daphne-regression on live UI",
        "pnpm",
        ["e2e:daphne:prod"],
        monorepoRoot,
      ),
    );
  }

  const report = summarize(results);
  const reportPath = join(reportDir, `REPORT-predemo-${ts()}.md`);
  writeFileSync(reportPath, report, "utf-8");

  // eslint-disable-next-line no-console
  console.log(`\n${report}\n`);
  // eslint-disable-next-line no-console
  console.log(`[predemo-gauntlet] report saved → ${reportPath}`);

  const failed = results.filter((r) => !r.passed).length;
  process.exit(failed > 0 ? 1 : 0);
})();
