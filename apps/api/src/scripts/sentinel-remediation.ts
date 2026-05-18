/**
 * Sentinel remediation drafter.
 *
 * Reads the most recent Sentinel run JSON, classifies every failure by
 * `failureType`, and emits a Markdown remediation plan grouped by the right
 * fix owner (prompt / KB / scenario / UI). The plan is intentionally
 * actionable — each entry includes the scenario id, the offending pattern,
 * and a concrete suggested fix that a human (Daphné, Steve) or a Claude Code
 * subagent (/kb-editor, /eval-test-designer) can apply.
 *
 * Self-healing pipeline (Daphné's 2026-05-18 ask):
 *   1. Nightly cron runs Sentinel with judge on (04:00 server time).
 *   2. This script runs immediately after, draws a REMEDIATION-*.md file.
 *   3. The admin dashboard surfaces the pending plan ("3 fixes recommended").
 *   4. Steve / Daphné click "Approve" → the proposed fix is staged as a PR.
 *   5. Once the PR merges, the next nightly Sentinel proves the fix worked.
 *
 * Goal: pass-rate climbs toward 100% automatically across all tenants.
 *
 * Run: cd apps/api && npx tsx src/scripts/sentinel-remediation.ts [--tenant maa]
 */
import { readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

interface SentinelResult {
  id: string;
  label: string;
  tenantCode: string;
  passed: boolean;
  assistantMessage: string;
  followUpMode: string;
  suppressBookingCta: boolean;
  failureReason?: string;
  failureType?: string;
  judgeVerdict?: { verdict: "yes" | "no"; reasoning: string };
}

interface SentinelRun {
  tenantCode: string;
  timestamp: string;
  mode: string;
  judge: boolean;
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  results: SentinelResult[];
}

const FIX_TEMPLATES: Record<string, { owner: string; suggested: (r: SentinelResult) => string }> = {
  source_leak: {
    owner: "/eval-test-designer + prompt review",
    suggested: (r) =>
      `Add a stricter \`forbidPatterns\` to scenario **${r.id}** covering the exact leaked phrase. Then audit \`maa-chat-system-v2.ts::SOURCE PRIVACY\` — the bot is bypassing the existing block. Likely needs the same leaked phrase appended to the forbidden-phrase list.`,
  },
  premature_callback: {
    owner: "/kb-editor + prompt review",
    suggested: (r) =>
      `The bot set \`followUpMode='callback'\` while still asking a question. Verify the FOLLOW-UP MODE rule in \`maa-chat-system-v2.ts\` is being followed. If the bot keeps regressing, tighten the acceptance regex in \`resolveShortAffirmativeFollowUp\` (services/maa-chat.ts).`,
  },
  repetition: {
    owner: "/rag-failure-analyst",
    suggested: (r) =>
      `Bot looped on the same answer. Inspect \`resolveShortAffirmativeFollowUp\` — does the user's message resolve to a fresh intent, or does it collapse back to the previous topic? Add a forwarding sentinel scenario after this one to lock in the fix.`,
  },
  model_hallucination: {
    owner: "/rag-failure-analyst → /kb-editor",
    suggested: (r) =>
      `Bot invented a fact. Compare the assistant message against the inlined section JSON for ${r.tenantCode}. If the fact is missing from the KB, add it (\`/kb-editor\`). If it's present but the bot ignored it, audit the SECTION RULES directive in the prompt.`,
  },
  missing_knowledge: {
    owner: "/kb-editor",
    suggested: (r) =>
      `KB gap detected. Read the assistant reply: "${(r.assistantMessage || "").slice(0, 180)}…". Find the matching section JSON under \`apps/api/src/knowledge/maa-v2/sections/\`. Add the missing fact with the correct confidence level.`,
  },
  bad_retrieval: {
    owner: "/rag-failure-analyst",
    suggested: (r) =>
      `Bot didn't retrieve the right section even though the KB has it. Check \`relevantSectionsForMessage\` in \`maa-chat-system-v2.ts\` — the regex may not match the user's wording. Add the missing keyword/synonym.`,
  },
  conflicting_kb: {
    owner: "/kb-editor",
    suggested: (r) =>
      `Two KB facts disagreed. Reconcile in \`sources-vivantes.json\` or the matching section. Daphné's PDF Spring 2026 is authoritative when it conflicts with the public site.`,
  },
  french_localization_issue: {
    owner: "/fr-qc-reviewer",
    suggested: (r) =>
      `Language drift detected (FR ↔ EN bleed). Check the BILINGUAL POLICY block in \`maa-chat-system-v2.ts\` and the language-switch scenarios in maa.ts.`,
  },
  sales_quality_issue: {
    owner: "/fr-qc-reviewer + prompt review",
    suggested: (r) =>
      `Bot's pricing/sales response was defensive or apologetic. Check the UPSELL RULES + STYLE BY RESPONSE LENGTH blocks. The bot may need a stronger value-framing pattern; consider adding it to \`voice-tone.json::upsellRules.examples\`.`,
  },
  prompt_problem: {
    owner: "Prompt author (Claude/Steve)",
    suggested: (r) =>
      `Generic prompt-shape failure: \`${r.failureReason ?? "no reason"}\`. Likely a missing directive in \`maa-chat-system-v2.ts\` — re-run \`/rag-failure-analyst\` on this single failure for a precise location.`,
  },
  slow_response: {
    owner: "Performance review",
    suggested: () => `Bot was slow. Investigate token-count growth, redundant retrieval, or judge timeout.`,
  },
  ui_bug: {
    owner: "/playwright-qa-engineer",
    suggested: () => `UI rendering bug. Add a Playwright spec to capture it and propose a widget fix.`,
  },
  unknown: {
    owner: "Manual triage",
    suggested: (r) =>
      `Unclassified failure. Reason: \`${r.failureReason ?? "n/a"}\`. Have a human read the reply and tag the failure_type by hand, then dispatch the matching subagent.`,
  },
};

function findLatestRunFile(runsDir: string, tenant?: string): string | null {
  if (!existsSync(runsDir)) return null;
  const files = readdirSync(runsDir)
    .filter((f) => f.endsWith(".json") && !f.startsWith("."))
    .sort()
    .reverse();
  for (const f of files) {
    try {
      const data = JSON.parse(readFileSync(path.join(runsDir, f), "utf8")) as { tenantCode?: string };
      if (!tenant || data.tenantCode === tenant) return f;
    } catch {
      // skip malformed
    }
  }
  return null;
}

function buildMarkdown(run: SentinelRun): string {
  const failures = run.results.filter((r) => !r.passed);
  if (failures.length === 0) {
    return [
      `# Remediation plan — ${run.tenantCode.toUpperCase()}`,
      ``,
      `Run: ${run.timestamp}`,
      `Pass rate: **${run.passRate}%** (${run.passed}/${run.total})`,
      ``,
      `✅ All scenarios passed. No remediation needed.`,
      ``,
    ].join("\n");
  }

  const groups = new Map<string, SentinelResult[]>();
  for (const f of failures) {
    const t = f.failureType ?? "unknown";
    const arr = groups.get(t) ?? [];
    arr.push(f);
    groups.set(t, arr);
  }

  const out: string[] = [];
  out.push(`# Remediation plan — ${run.tenantCode.toUpperCase()}`);
  out.push("");
  out.push(`Run: ${run.timestamp}`);
  out.push(`Pass rate: **${run.passRate}%** (${run.passed}/${run.total} passed)`);
  out.push(`Failures: **${failures.length}** across ${groups.size} categories`);
  out.push("");
  out.push("## Auto-suggested fixes (in priority order)");
  out.push("");

  // Stable ordering: source_leak first (visitor-visible), then premature_callback, etc.
  const ordering = [
    "source_leak", "premature_callback", "model_hallucination", "repetition",
    "missing_knowledge", "bad_retrieval", "conflicting_kb", "french_localization_issue",
    "sales_quality_issue", "prompt_problem", "slow_response", "ui_bug", "unknown",
  ];
  const sortedTypes = [...groups.keys()].sort((a, b) => ordering.indexOf(a) - ordering.indexOf(b));

  for (const type of sortedTypes) {
    const arr = groups.get(type)!;
    const tpl = FIX_TEMPLATES[type] ?? FIX_TEMPLATES.unknown!;
    out.push(`### ${type} (${arr.length} failure${arr.length === 1 ? "" : "s"})`);
    out.push(``);
    out.push(`Suggested owner: ${tpl.owner}`);
    out.push(``);
    for (const r of arr) {
      out.push(`- **${r.id}** — ${r.label}`);
      if (r.failureReason) out.push(`  - Reason: \`${r.failureReason}\``);
      if (r.judgeVerdict) out.push(`  - Judge: ${r.judgeVerdict.verdict} — ${r.judgeVerdict.reasoning}`);
      out.push(`  - Fix: ${tpl.suggested(r)}`);
    }
    out.push("");
  }

  out.push("---");
  out.push("");
  out.push("## How to apply");
  out.push("");
  out.push("1. Review each suggested fix above with Daphné.");
  out.push("2. For mechanical fixes (forbidden patterns, missing aliases), dispatch the named subagent.");
  out.push("3. For prompt directive gaps, edit `apps/api/src/prompts/maa-chat-system-v2.ts` directly.");
  out.push("4. For KB gaps, edit the matching JSON under `apps/api/src/knowledge/maa-v2/`.");
  out.push("5. Re-run Sentinel via the dashboard `▶ Test complet avec juge IA` button. Pass rate should climb.");
  out.push("");
  return out.join("\n");
}

function main(): void {
  const args = process.argv.slice(2);
  let tenant: string | undefined;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tenant" && args[i + 1]) tenant = args[++i];
  }

  const currentFile = fileURLToPath(import.meta.url);
  const scriptsDir = path.dirname(currentFile);
  const apiRoot = path.resolve(scriptsDir, "../..").replace(/[\\/]dist[\\/]apps[\\/]api$/, "");
  const runsDir = path.join(apiRoot, "_sentinel-runs");

  const file = findLatestRunFile(runsDir, tenant);
  if (!file) {
    console.error(`No Sentinel run found for tenant=${tenant ?? "all"}.`);
    process.exit(1);
  }

  const run = JSON.parse(readFileSync(path.join(runsDir, file), "utf8")) as SentinelRun;
  const md = buildMarkdown(run);
  const outPath = path.join(runsDir, `REMEDIATION-${file.replace(/\.json$/, ".md")}`);
  if (!existsSync(runsDir)) mkdirSync(runsDir, { recursive: true });
  writeFileSync(outPath, md);
  console.log(`✓ Remediation plan written: ${path.basename(outPath)}`);
  console.log(`  Source run: ${file}`);
  console.log(`  ${run.passed}/${run.total} passed (${run.passRate}%)`);
  console.log(`  ${run.failed} failure${run.failed === 1 ? "" : "s"} grouped into ${md.match(/^### /gm)?.length ?? 0} categor${(md.match(/^### /gm)?.length ?? 0) === 1 ? "y" : "ies"}`);
}

main();
