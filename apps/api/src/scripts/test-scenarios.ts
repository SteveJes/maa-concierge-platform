/**
 * Bullet-proof scenario harness — entry point.
 *
 * What it does (and why it matters):
 *  - Runs every scenario in apps/api/src/scenarios/* against the actual
 *    service layer (answerMaaChat), one tenant at a time.
 *  - Asserts on STRUCTURED fields (intent, followUpMode, suppressBookingCta)
 *    in addition to text — regex-only assertions miss tone/policy bugs.
 *  - Supports multi-turn histories so we can verify the "oui after clinical
 *    handoff" kind of stateful behavior.
 *  - Optional --judge mode runs an LLM-as-judge rubric per scenario for the
 *    semantic checks regex can't cleanly express.
 *  - --live mode hits the deployed HTTP API to verify the LAYER DAPHNÉ SEES,
 *    not just the service-layer in-process.
 *
 * Usage:
 *   pnpm.cmd --filter @platform/api tsx src/scripts/test-scenarios.ts
 *   pnpm.cmd --filter @platform/api tsx src/scripts/test-scenarios.ts --phase 1
 *   pnpm.cmd --filter @platform/api tsx src/scripts/test-scenarios.ts --tenant maa
 *   pnpm.cmd --filter @platform/api tsx src/scripts/test-scenarios.ts --judge
 *   pnpm.cmd --filter @platform/api tsx src/scripts/test-scenarios.ts --live --url https://...
 *   pnpm.cmd --filter @platform/api tsx src/scripts/test-scenarios.ts --id maa-6.1
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import dotenv from "dotenv";

import {
  answerMaaChat,
  detectCriticalIntent,
} from "../services/maa-chat.js";
import type { MaaChatRequest } from "../services/maa-chat.js";
import { MAA_SCENARIOS } from "../scenarios/maa.js";
import { DUBUB_SCENARIOS } from "../scenarios/dubub.js";
import type {
  Scenario,
  ScenarioResult,
  FollowUpMode,
  TenantCode,
} from "../scenarios/types.js";
import { judgeScenario } from "../scenarios/judge.js";

interface CliArgs {
  phase?: 1 | 2 | 3 | 4;
  tenant?: TenantCode;
  judge: boolean;
  live: boolean;
  liveUrl: string;
  id?: string;
  /** Continue after first failure (useful for full audit). Default: false. */
  bail: boolean;
  /** Write JSON report to this path. */
  outFile?: string;
}

function parseCli(argv: string[]): CliArgs {
  const args: CliArgs = {
    judge: false,
    live: false,
    // Default to the prod API base URL. The runner appends
    // /v1/tenants/{tenantCode}/chat per scenario. Override via --url.
    liveUrl: "https://api.dubub.com",
    bail: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--phase") {
      const v = Number(argv[++i]);
      if (![1, 2, 3, 4].includes(v)) throw new Error(`Invalid --phase: ${v}`);
      args.phase = v as 1 | 2 | 3 | 4;
    } else if (a === "--tenant") {
      const v = argv[++i] as TenantCode;
      if (v !== "maa" && v !== "dubub") throw new Error(`Invalid --tenant: ${v}`);
      args.tenant = v;
    } else if (a === "--judge") {
      args.judge = true;
    } else if (a === "--live") {
      args.live = true;
    } else if (a === "--url") {
      args.liveUrl = argv[++i];
    } else if (a === "--id") {
      args.id = argv[++i];
    } else if (a === "--bail") {
      args.bail = true;
    } else if (a === "--out") {
      args.outFile = argv[++i];
    }
  }
  return args;
}

function loadEnvFiles(): void {
  const currentFile = fileURLToPath(import.meta.url);
  const scriptsDir = path.dirname(currentFile);
  const apiRoot = path.resolve(scriptsDir, "../..");
  const repoRoot = path.resolve(apiRoot, "../..");
  for (const envFile of [
    path.join(apiRoot, ".env.local"),
    path.join(apiRoot, ".env"),
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, ".env"),
  ]) {
    dotenv.config({ path: envFile, override: false });
  }
}

function detectLanguage(text: string): "fr" | "en" {
  // Cheap heuristic: accented chars or common FR function words → fr.
  if (/[àâçéèêëîïôûùüÿœ]/i.test(text)) return "fr";
  if (/\b(le|la|les|une?|des|nous|vous|notre|votre|équipe|abonnement|piscine|cours)\b/i.test(text)) return "fr";
  return "en";
}

interface ChatResponseShape {
  assistantMessage: string;
  followUpMode: FollowUpMode;
  suppressBookingCta?: boolean;
}

async function callLive(baseUrl: string, scenario: Scenario): Promise<ChatResponseShape> {
  // Live endpoint convention is /v1/tenants/{tenantCode}/chat. If the caller
  // passed a full path with {tenantCode} placeholder, honor it; otherwise
  // append the standard path to the base URL.
  const url = baseUrl.includes("{tenantCode}")
    ? baseUrl.replace("{tenantCode}", scenario.tenantCode)
    : `${baseUrl.replace(/\/$/, "")}/v1/tenants/${scenario.tenantCode}/chat`;

  // Live-mode caveat: the HTTP endpoint loads conversation history from its
  // own store keyed by conversationId, so multi-turn `history` scenarios
  // can't be replayed faithfully against prod. Single-turn scenarios still
  // work, and the harness already skips the in-process intent assertion in
  // live mode.
  const body = {
    message: scenario.userMessage,
    locale: scenario.locale,
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Live HTTP ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as ChatResponseShape;
  return data;
}

async function callInProcess(scenario: Scenario): Promise<ChatResponseShape> {
  const req: MaaChatRequest = {
    userMessage: scenario.userMessage,
    locale: scenario.locale,
    tenantCode: scenario.tenantCode,
    conversationHistory: scenario.history ?? [],
  };
  const result = await answerMaaChat(req);
  return {
    assistantMessage: result.assistantMessage,
    followUpMode: result.followUpMode,
    suppressBookingCta: result.suppressBookingCta,
  };
}

async function runOne(
  scenario: Scenario,
  args: CliArgs,
): Promise<ScenarioResult> {
  const t0 = Date.now();
  let response: ChatResponseShape;
  try {
    response = args.live
      ? await callLive(args.liveUrl, scenario)
      : await callInProcess(scenario);
  } catch (err) {
    return {
      id: scenario.id,
      label: scenario.label,
      tenantCode: scenario.tenantCode,
      passed: false,
      assistantMessage: "",
      followUpMode: "done",
      suppressBookingCta: false,
      failureReason: `Request error: ${(err as Error).message}`,
      durationMs: Date.now() - t0,
    };
  }

  const msg = response.assistantMessage;
  const mode = response.followUpMode;
  const suppress = Boolean(response.suppressBookingCta);
  const failures: string[] = [];

  // 1. Intent assertion — only meaningful in-process (we re-run the detector).
  if (scenario.expectIntent !== undefined && !args.live) {
    const actual = detectCriticalIntent(scenario.userMessage);
    if (actual !== scenario.expectIntent) {
      failures.push(
        `expectIntent='${scenario.expectIntent}' but detectCriticalIntent returned '${actual ?? "undefined"}'`,
      );
    }
  }

  // 2. followUpMode assertions
  if (scenario.forbidFollowUpModes?.includes(mode)) {
    failures.push(`followUpMode='${mode}' is FORBIDDEN`);
  }
  if (scenario.requireFollowUpMode && !scenario.requireFollowUpMode.includes(mode)) {
    failures.push(
      `followUpMode='${mode}' but expected one of [${scenario.requireFollowUpMode.join(", ")}]`,
    );
  }

  // 3. Text regex assertions
  for (const pat of scenario.forbidPatterns ?? []) {
    if (pat.test(msg)) failures.push(`forbidden pattern matched: ${pat}`);
  }
  for (const pat of scenario.requirePatterns ?? []) {
    if (!pat.test(msg)) failures.push(`required pattern missing: ${pat}`);
  }
  if (scenario.requireAnyPattern && scenario.requireAnyPattern.length > 0) {
    if (!scenario.requireAnyPattern.some((p) => p.test(msg))) {
      failures.push(
        `none of the requireAnyPattern alternates matched: [${scenario.requireAnyPattern.join(", ")}]`,
      );
    }
  }

  // 4. suppressBookingCta
  if (scenario.requireSuppressBookingCta === true && suppress !== true) {
    failures.push(`requireSuppressBookingCta=true but got ${suppress}`);
  }
  if (scenario.requireSuppressBookingCta === false && suppress !== false) {
    failures.push(`requireSuppressBookingCta=false but got ${suppress}`);
  }

  // 5. Language
  if (scenario.expectLanguage) {
    const actualLang = detectLanguage(msg);
    if (actualLang !== scenario.expectLanguage) {
      failures.push(`expectLanguage='${scenario.expectLanguage}' but reply looks ${actualLang}`);
    }
  }

  // 6. LLM judge (opt-in)
  let judgeVerdict: ScenarioResult["judgeVerdict"];
  if (args.judge && scenario.judgeRubric) {
    try {
      const v = await judgeScenario(
        scenario.judgeRubric.question,
        scenario.userMessage,
        msg,
      );
      judgeVerdict = v;
      if (v.verdict !== scenario.judgeRubric.expected) {
        failures.push(
          `judge verdict='${v.verdict}' but expected '${scenario.judgeRubric.expected}' — ${v.reasoning}`,
        );
      }
    } catch (err) {
      failures.push(`judge error: ${(err as Error).message}`);
    }
  }

  return {
    id: scenario.id,
    label: scenario.label,
    tenantCode: scenario.tenantCode,
    passed: failures.length === 0,
    assistantMessage: msg,
    followUpMode: mode,
    suppressBookingCta: suppress,
    failureReason: failures.length > 0 ? failures.join("; ") : undefined,
    judgeVerdict,
    durationMs: Date.now() - t0,
  };
}

function filterScenarios(
  scenarios: Scenario[],
  args: CliArgs,
): Scenario[] {
  return scenarios.filter((s) => {
    if (args.id && s.id !== args.id) return false;
    if (args.phase && s.phase !== args.phase) return false;
    if (args.tenant && s.tenantCode !== args.tenant) return false;
    return true;
  });
}

async function main(): Promise<void> {
  loadEnvFiles();
  const args = parseCli(process.argv.slice(2));

  const all: Scenario[] = [...MAA_SCENARIOS, ...DUBUB_SCENARIOS];
  const filtered = filterScenarios(all, args);

  console.log(
    `\nBullet-proof scenario harness — ${filtered.length} scenario(s)` +
      (args.phase ? `, phase=${args.phase}` : "") +
      (args.tenant ? `, tenant=${args.tenant}` : "") +
      (args.id ? `, id=${args.id}` : "") +
      (args.live ? ` [LIVE: ${args.liveUrl}]` : ` [in-process]`) +
      (args.judge ? " [+ judge]" : "") +
      "\n",
  );

  const results: ScenarioResult[] = [];
  let pass = 0;
  let fail = 0;

  for (const s of filtered) {
    process.stdout.write(`  [${s.tenantCode}] ${s.id.padEnd(14)} ${s.label.slice(0, 70).padEnd(70)} `);
    const r = await runOne(s, args);
    results.push(r);
    if (r.passed) {
      pass++;
      console.log(`PASS  (${r.durationMs}ms)`);
    } else {
      fail++;
      console.log(`FAIL  (${r.durationMs}ms)`);
      console.log(`        reason: ${r.failureReason}`);
      console.log(`        reply: ${r.assistantMessage.slice(0, 220).replace(/\n/g, " ")}`);
      if (r.judgeVerdict) {
        console.log(`        judge: ${r.judgeVerdict.verdict} — ${r.judgeVerdict.reasoning}`);
      }
      if (args.bail) break;
    }
  }

  console.log(`\n${pass}/${pass + fail} scenarios passed.`);

  if (args.outFile) {
    writeFileSync(args.outFile, JSON.stringify(results, null, 2));
    console.log(`Report written to ${args.outFile}`);
  }

  if (fail > 0) process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
