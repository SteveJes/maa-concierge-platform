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
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
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
  FailureType,
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
  // Sentinel: the LLM judge is ENABLED BY DEFAULT for all tenants. Disable
  // with --no-judge or SENTINEL_JUDGE_DISABLED=true if you need a cheaper
  // / offline run. Disabled automatically when OPENAI_API_KEY is missing.
  const judgeDisabledByEnv =
    process.env.SENTINEL_JUDGE_DISABLED === "true" || !process.env.OPENAI_API_KEY;

  const args: CliArgs = {
    judge: !judgeDisabledByEnv,
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
    } else if (a === "--no-judge") {
      args.judge = false;
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

  const reason = failures.length > 0 ? failures.join("; ") : undefined;
  return {
    id: scenario.id,
    label: scenario.label,
    tenantCode: scenario.tenantCode,
    passed: failures.length === 0,
    assistantMessage: msg,
    followUpMode: mode,
    suppressBookingCta: suppress,
    failureReason: reason,
    failureType: reason ? inferFailureType(reason, msg, mode) : undefined,
    judgeVerdict,
    durationMs: Date.now() - t0,
  };
}

/**
 * Infer the bucket a failure belongs in. The runner reads the failureReason
 * + the assistant message + the followUpMode and picks the closest taxonomy
 * entry. This is what makes the markdown report actionable: each section is
 * a queue for a specific kind of fix.
 */
function inferFailureType(
  reason: string,
  message: string,
  mode: FollowUpMode,
): FailureType {
  const r = reason.toLowerCase();
  const m = message.toLowerCase();

  // Source-leak: bot exposed an internal data-source name to the visitor.
  if (
    /selon le pdf|pdf officiel|pdf printemps|selon le site|page publique|site public|version contradictoire|deux versions|two versions/i.test(message)
  ) {
    return "source_leak";
  }

  // Premature callback: bot opened the lead form before the visitor accepted.
  if (
    mode === "callback" &&
    /souhaitez[- ]vous|would you like|préférez[- ]vous|prefer to/i.test(message)
  ) {
    return "premature_callback";
  }

  // Repetition: bot rephrased the same answer rather than moving forward.
  if (/repetition|repeated|same answer|generic answer|loop/i.test(r)) {
    return "repetition";
  }

  // Judge said something was missing / bot didn't ground in KB
  if (/judge.*missing|invent|hallucinat|fabricat|not in (the )?evidence/i.test(r)) {
    return "model_hallucination";
  }
  if (/missing.*(?:knowledge|fact|evidence)/i.test(r)) return "missing_knowledge";
  if (/retriev|chunk|search result/i.test(r)) return "bad_retrieval";
  if (/contradict|conflict/i.test(r)) return "conflicting_kb";

  // French / Quebec localisation issue
  if (/french|fr_qc|québec|qc|localis|locale mismatch|wrong language/i.test(r)) {
    return "french_localization_issue";
  }

  // Sales quality (defensive answer, no value framing)
  if (/sales|valeur|premium|defensive|cheap|cheaper/i.test(r)) {
    return "sales_quality_issue";
  }

  // Timing
  if (/slow|timeout|latency/i.test(r)) return "slow_response";

  // UI bug — never set by this runner directly; reserved for Playwright bridge
  if (/ui_bug|frontend/i.test(r)) return "ui_bug";

  // Default: bot followed the wrong shape — almost always a prompt issue
  if (
    /forbidden pattern|required pattern|forbidfollowupmode|requirefollowupmode|suppressBookingCta|expected.*intent/i.test(r)
  ) {
    return "prompt_problem";
  }

  return "unknown";
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

  // Sentinel persistence: every run drops a timestamped report so the admin
  // dashboard and downstream pipelines can read it. One file per (tenant,
  // timestamp). Skipped if filtered to a single scenario or specific id.
  if (!args.id) {
    persistSentinelRun(results, args);
  }

  if (fail > 0) process.exit(1);
}

function persistSentinelRun(results: ScenarioResult[], args: CliArgs): void {
  const currentFile = fileURLToPath(import.meta.url);
  const apiRoot = path.resolve(path.dirname(currentFile), "../..");
  const runsDir = path.join(apiRoot, "_sentinel-runs");
  if (!existsSync(runsDir)) mkdirSync(runsDir, { recursive: true });

  // Group results by tenant so each tenant has its own file (clean isolation
  // in the dashboard — MAA never sees DUBUB's results and vice versa).
  const byTenant = new Map<TenantCode, ScenarioResult[]>();
  for (const r of results) {
    const arr = byTenant.get(r.tenantCode) ?? [];
    arr.push(r);
    byTenant.set(r.tenantCode, arr);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  for (const [tenantCode, tenantResults] of byTenant) {
    const total = tenantResults.length;
    const passed = tenantResults.filter((r) => r.passed).length;
    const summary: SentinelRunSummary = {
      tenantCode,
      timestamp: new Date().toISOString(),
      mode: args.live ? "live" : "in-process",
      judge: args.judge,
      total,
      passed,
      failed: total - passed,
      passRate: total > 0 ? Number(((passed / total) * 100).toFixed(1)) : 0,
      filters: {
        phase: args.phase,
        tenant: args.tenant,
      },
      results: tenantResults,
    };
    const filePath = path.join(runsDir, `${tenantCode}-${timestamp}.json`);
    writeFileSync(filePath, JSON.stringify(summary, null, 2));
    console.log(`[sentinel] persisted ${tenantCode} run → ${path.basename(filePath)}`);

    // Markdown twin — Daphné-readable, drops next to the JSON. Sections
    // grouped by failure type so a fix-pass is a single read-and-route.
    const mdPath = path.join(runsDir, `${tenantCode}-${timestamp}.md`);
    writeFileSync(mdPath, renderMarkdownReport(summary));
    console.log(`[sentinel] persisted ${tenantCode} report → ${path.basename(mdPath)}`);
  }
}

interface SentinelRunSummary {
  tenantCode: TenantCode;
  timestamp: string;
  mode: "live" | "in-process";
  judge: boolean;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  filters: { phase?: number; tenant?: string };
  results: ScenarioResult[];
}

function renderMarkdownReport(s: SentinelRunSummary): string {
  const failures = s.results.filter((r) => !r.passed);
  const byType = new Map<FailureType, ScenarioResult[]>();
  for (const f of failures) {
    const t = f.failureType ?? "unknown";
    const arr = byType.get(t) ?? [];
    arr.push(f);
    byType.set(t, arr);
  }
  const orderedTypes: FailureType[] = [
    "source_leak",
    "premature_callback",
    "repetition",
    "model_hallucination",
    "missing_knowledge",
    "bad_retrieval",
    "conflicting_kb",
    "french_localization_issue",
    "sales_quality_issue",
    "prompt_problem",
    "slow_response",
    "ui_bug",
    "unknown",
  ];

  const lines: string[] = [];
  lines.push(`# Concierge QA Report — ${s.tenantCode.toUpperCase()}`);
  lines.push("");
  lines.push(`Run: ${s.timestamp}`);
  lines.push(`Mode: ${s.mode} · Judge: ${s.judge ? "on" : "off"}`);
  if (s.filters.phase) lines.push(`Phase filter: ${s.filters.phase}`);
  lines.push("");
  lines.push("## Summary");
  lines.push(`- Scenarios: **${s.total}**`);
  lines.push(`- Passed: **${s.passed}**`);
  lines.push(`- Failed: **${s.failed}**`);
  lines.push(`- Pass rate: **${s.passRate}%**`);
  lines.push("");

  if (failures.length === 0) {
    lines.push("All scenarios passed. Nothing to triage.");
    return lines.join("\n");
  }

  lines.push("## Failures by category");
  lines.push("");
  for (const t of orderedTypes) {
    const arr = byType.get(t);
    if (!arr || arr.length === 0) continue;
    lines.push(`### ${prettyFailureType(t)} (${arr.length})`);
    lines.push("");
    for (const f of arr) {
      lines.push(`- **${f.id}** — ${f.label}`);
      if (f.failureReason) lines.push(`  - Reason: ${f.failureReason}`);
      const preview = f.assistantMessage.replace(/\s+/g, " ").slice(0, 220);
      lines.push(`  - Reply: ${preview}${f.assistantMessage.length > 220 ? "…" : ""}`);
      if (f.judgeVerdict) lines.push(`  - Judge: ${f.judgeVerdict.verdict} — ${f.judgeVerdict.reasoning}`);
      lines.push(`  - Suggested owner: ${suggestedOwner(t)}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function prettyFailureType(t: FailureType): string {
  switch (t) {
    case "source_leak": return "🔒 Source leak (visitor saw an internal source name)";
    case "premature_callback": return "📋 Premature callback (lead form opened before visitor accepted)";
    case "repetition": return "🔁 Repetition (bot looped on same answer)";
    case "model_hallucination": return "👻 Model hallucination (invented facts)";
    case "missing_knowledge": return "📚 Missing knowledge (KB gap)";
    case "bad_retrieval": return "🔍 Bad retrieval (right doc not pulled)";
    case "conflicting_kb": return "⚖️ Conflicting KB (two sources disagree)";
    case "french_localization_issue": return "🇫🇷 French / Québec localisation";
    case "sales_quality_issue": return "💰 Sales quality (premium framing missing)";
    case "prompt_problem": return "📝 Prompt problem (shape / followUpMode / forbidden CTA)";
    case "slow_response": return "🐌 Slow response";
    case "ui_bug": return "🖥️ UI bug";
    case "unknown": return "❓ Unclassified";
  }
}

function suggestedOwner(t: FailureType): string {
  switch (t) {
    case "source_leak":
    case "premature_callback":
    case "prompt_problem":
    case "repetition":
    case "sales_quality_issue":
    case "french_localization_issue":
      return "prompt (apps/api/src/prompts/) — `/eval-test-designer` or `/fr-qc-reviewer`";
    case "missing_knowledge":
    case "bad_retrieval":
    case "conflicting_kb":
      return "knowledge base (apps/api/src/knowledge/maa-v2/) — `/kb-editor`";
    case "model_hallucination":
      return "safety layer + KB — `/rag-failure-analyst`";
    case "ui_bug":
      return "widget (packages/ui-chat/) — `/playwright-qa-engineer`";
    case "slow_response":
    case "unknown":
      return "Steve / Claude triage";
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
