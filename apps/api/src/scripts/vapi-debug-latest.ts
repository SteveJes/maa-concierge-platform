import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// ── Env ──────────────────────────────────────────────────────────────────────

function loadEnv(): void {
  const dir = path.dirname(fileURLToPath(import.meta.url));
  const apiRoot = path.resolve(dir, "../..");
  const repoRoot = path.resolve(apiRoot, "../..");
  for (const f of [
    path.join(apiRoot, ".env.local"),
    path.join(apiRoot, ".env"),
    path.join(repoRoot, ".env.local"),
    path.join(repoRoot, ".env"),
  ]) {
    dotenv.config({ path: f, override: false });
  }
}

loadEnv();

// ── Args ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const jsonMode = args.includes("--json");
const ASSISTANT_ID = "ec272999-2782-4e57-9068-55a3bacd4915";

// ── VAPI types (minimal) ─────────────────────────────────────────────────────

interface VapiMessage {
  role: string;
  message?: string;
  secondsFromStart?: number;
  duration?: number;
}

interface VapiMetrics {
  modelLatencyAverage?: number;
  voiceLatencyAverage?: number;
  transcriberLatencyAverage?: number;
  endpointingLatencyAverage?: number;
  turnLatencyAverage?: number;
  [key: string]: number | undefined;
}

interface VapiCall {
  id: string;
  assistantId?: string;
  startedAt?: string;
  endedAt?: string;
  transcript?: string;
  artifact?: {
    messages?: VapiMessage[];
    performanceMetrics?: VapiMetrics;
  };
  costBreakdown?: Record<string, number>;
  costs?: Record<string, number>;
  assistantOverrides?: {
    firstMessage?: string;
    variableValues?: Record<string, string>;
  };
}

// ── Fetch ────────────────────────────────────────────────────────────────────

async function fetchLatestCall(): Promise<VapiCall> {
  const apiKey = process.env.VAPI_PRIVATE_KEY ?? process.env.VAPI_API_KEY;
  if (!apiKey) throw new Error("VAPI_PRIVATE_KEY not set in environment");

  const url = `https://api.vapi.ai/call?assistantId=${ASSISTANT_ID}&limit=10&sortOrder=desc`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Vapi API error ${res.status}: ${body}`);
  }

  const data = (await res.json()) as VapiCall[] | { results?: VapiCall[] };
  const calls = Array.isArray(data) ? data : (data.results ?? []);

  if (calls.length === 0) throw new Error("No calls found for this assistant.");

  // Pick latest completed call first, else latest of any status
  const completed = calls.find((c) => c.endedAt);
  return completed ?? calls[0]!;
}

// ── Diagnosis ─────────────────────────────────────────────────────────────────

interface DiagnosisItem {
  flag: string;
  recommendation: string;
}

function diagnose(metrics: VapiMetrics, variableValues: Record<string, string>): DiagnosisItem[] {
  const issues: DiagnosisItem[] = [];

  if ((metrics.modelLatencyAverage ?? 0) > 1000)
    issues.push({
      flag: `🔴 Model is slow (${metrics.modelLatencyAverage}ms avg)`,
      recommendation: "Use native OpenAI gpt-4o-mini, reduce system prompt length, or raise max_tokens limit.",
    });

  if ((metrics.voiceLatencyAverage ?? 0) > 1000)
    issues.push({
      flag: `🔴 Voice/TTS is slow (${metrics.voiceLatencyAverage}ms avg)`,
      recommendation: "Shorten responses (1–2 sentences max). Lower inputMinCharacters. Consider switching ElevenLabs voice or testing Cartesia.",
    });

  if ((metrics.transcriberLatencyAverage ?? 0) > 700)
    issues.push({
      flag: `🟡 Transcriber is slow (${metrics.transcriberLatencyAverage}ms avg)`,
      recommendation: "Check Deepgram endpointing timeout. Compare Deepgram Nova-2 vs Gladia. Inspect endpointing settings.",
    });

  if ((metrics.endpointingLatencyAverage ?? 0) > 400)
    issues.push({
      flag: `🟡 Endpointing is slow (${metrics.endpointingLatencyAverage}ms avg)`,
      recommendation: "Lower endpointingTimeout in VAPI dashboard. Enable smartEndpointing if available.",
    });

  if ((metrics.turnLatencyAverage ?? 0) > 2200)
    issues.push({
      flag: `🔴 Overall turn latency is too slow (${metrics.turnLatencyAverage}ms avg)`,
      recommendation: "Sum of transcriber + model + TTS exceeds 2.2s target. Address slowest component above.",
    });

  const summary = variableValues.handoff_summary ?? "";
  if (summary.toLowerCase().includes("assistant:") || summary.toLowerCase().includes("nous vous appelons"))
    issues.push({
      flag: "🔴 handoff_summary is dirty — contains bot messages",
      recommendation: "Check cleanHandoffSummary() in server.ts. Ensure web_call_now path skips rawSummary.",
    });

  if (issues.length === 0)
    issues.push({ flag: "✅ All latency metrics look healthy", recommendation: "" });

  return issues;
}

// ── Format ───────────────────────────────────────────────────────────────────

function ms(val?: number): string {
  if (val === undefined || val === null) return "n/a";
  return `${Math.round(val)}ms`;
}

function printReport(call: VapiCall): void {
  const vars = call.assistantOverrides?.variableValues ?? {};
  const metrics = call.artifact?.performanceMetrics ?? {};
  const messages = call.artifact?.messages ?? [];
  const issues = diagnose(metrics, vars);

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  VAPI CALL DEBUG — Club Sportif MAA / Sophie");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  console.log("📞 CALL");
  console.log(`  id          : ${call.id}`);
  console.log(`  startedAt   : ${call.startedAt ?? "n/a"}`);
  console.log(`  endedAt     : ${call.endedAt ?? "n/a"}`);

  console.log("\n🎙️  HANDOFF CONTEXT");
  console.log(`  firstMessage              : ${call.assistantOverrides?.firstMessage ?? "n/a"}`);
  console.log(`  handoff_opening_line      : ${vars.handoff_opening_line ?? "n/a"}`);
  console.log(`  handoff_last_user_message : ${vars.handoff_last_user_message ?? "n/a"}`);
  console.log(`  handoff_summary           : ${vars.handoff_summary ?? "n/a"}`);
  console.log(`  handoff_locale            : ${vars.handoff_locale ?? "n/a"}`);
  console.log(`  customer_name             : ${vars.customer_name ?? "n/a"}`);

  console.log("\n⚡ PERFORMANCE METRICS");
  console.log(`  modelLatencyAverage        : ${ms(metrics.modelLatencyAverage)}`);
  console.log(`  voiceLatencyAverage        : ${ms(metrics.voiceLatencyAverage)}`);
  console.log(`  transcriberLatencyAverage  : ${ms(metrics.transcriberLatencyAverage)}`);
  console.log(`  endpointingLatencyAverage  : ${ms(metrics.endpointingLatencyAverage)}`);
  console.log(`  turnLatencyAverage         : ${ms(metrics.turnLatencyAverage)}`);

  if (call.costBreakdown ?? call.costs) {
    console.log("\n💰 COST BREAKDOWN");
    const costs = call.costBreakdown ?? call.costs ?? {};
    for (const [k, v] of Object.entries(costs)) {
      console.log(`  ${k.padEnd(28)}: $${typeof v === "number" ? v.toFixed(5) : v}`);
    }
  }

  if (messages.length > 0) {
    console.log("\n💬 MESSAGE TIMELINE");
    for (const m of messages) {
      const t = m.secondsFromStart !== undefined ? `+${m.secondsFromStart.toFixed(2)}s` : "     ";
      const dur = m.duration !== undefined ? ` (${m.duration.toFixed(2)}s)` : "";
      const role = (m.role ?? "unknown").padEnd(11);
      const text = (m.message ?? "").slice(0, 120);
      console.log(`  ${t.padStart(8)} ${role} ${dur.padEnd(10)} ${text}`);
    }
  }

  if (call.transcript) {
    console.log("\n📝 TRANSCRIPT");
    console.log(
      call.transcript
        .split("\n")
        .map((l) => `  ${l}`)
        .join("\n"),
    );
  }

  console.log("\n🔍 DIAGNOSIS");
  for (const { flag, recommendation } of issues) {
    console.log(`  ${flag}`);
    if (recommendation) console.log(`     → ${recommendation}`);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const call = await fetchLatestCall();

  if (jsonMode) {
    // Redact secrets — never print API keys
    const safe = JSON.parse(JSON.stringify(call)) as Record<string, unknown>;
    const overrides = safe.assistantOverrides as Record<string, unknown> | undefined;
    if (overrides?.variableValues) {
      const v = overrides.variableValues as Record<string, unknown>;
      delete v.customer_email;
      delete v.customer_phone;
    }
    console.log(JSON.stringify(safe, null, 2));
    return;
  }

  printReport(call);
}

main().catch((err) => {
  console.error("Error:", (err as Error).message);
  process.exit(1);
});
