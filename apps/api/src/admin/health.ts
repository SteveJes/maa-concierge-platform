/**
 * Health aggregator — fetches live data for a tenant and produces a
 * structured health report used by the admin dashboard API.
 */

import { sendLeadNotificationEmail } from "../services/email-notifications.js";
import type { TenantConfig } from "./tenants.js";

// ── Alert deduplication ───────────────────────────────────────────────────────
// In-memory: survives process restarts poorly but avoids a DB dependency for now.
const alertSentAt = new Map<string, number>();
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

function shouldSendAlert(key: string): boolean {
  const last = alertSentAt.get(key) ?? 0;
  return Date.now() - last > ALERT_COOLDOWN_MS;
}

function markAlertSent(key: string): void {
  alertSentAt.set(key, Date.now());
}

// ── VAPI fetcher ──────────────────────────────────────────────────────────────

export interface VapiCallSummary {
  id: string;
  startedAt: string | null;
  endedAt: string | null;
  durationSeconds: number | null;
  turnLatencyAverage: number | null;
  modelLatencyAverage: number | null;
  voiceLatencyAverage: number | null;
  transcriberLatencyAverage: number | null;
  endpointingLatencyAverage: number | null;
  status: "completed" | "failed" | "in-progress" | "unknown";
  cost: number | null;
}

async function fetchVapiCalls(
  assistantId: string,
  apiKey: string,
  limit = 20,
): Promise<VapiCallSummary[]> {
  const res = await fetch(
    `https://api.vapi.ai/call?assistantId=${assistantId}&limit=${limit}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  );
  if (!res.ok) return [];

  const data = (await res.json()) as unknown[];
  const calls = Array.isArray(data) ? data : ((data as { results?: unknown[] }).results ?? []);

  return (calls as Record<string, unknown>[]).map((c) => {
    const metrics = (c.artifact as Record<string, unknown> | undefined)?.performanceMetrics as Record<string, number> | undefined;
    const startedAt = c.startedAt as string | null ?? null;
    const endedAt = c.endedAt as string | null ?? null;
    const durationSeconds =
      startedAt && endedAt
        ? Math.round((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000)
        : null;

    let status: VapiCallSummary["status"] = "unknown";
    const endedReason = (c.endedReason as string | undefined)?.toLowerCase() ?? "";
    if (endedAt) status = endedReason.includes("error") || endedReason.includes("fail") ? "failed" : "completed";
    else if (startedAt) status = "in-progress";

    return {
      id: c.id as string,
      startedAt,
      endedAt,
      durationSeconds,
      turnLatencyAverage: metrics?.turnLatencyAverage ?? null,
      modelLatencyAverage: metrics?.modelLatencyAverage ?? null,
      voiceLatencyAverage: metrics?.voiceLatencyAverage ?? null,
      transcriberLatencyAverage: metrics?.transcriberLatencyAverage ?? null,
      endpointingLatencyAverage: metrics?.endpointingLatencyAverage ?? null,
      status,
      cost: typeof c.cost === "number" ? c.cost : null,
    };
  });
}

// ── Health report ─────────────────────────────────────────────────────────────

export type HealthLevel = "ok" | "warn" | "critical" | "unknown";

export interface HealthCheck {
  key: string;
  label: string;
  status: HealthLevel;
  value: string;
  detail: string | null;
}

export interface TenantHealthReport {
  tenantId: string;
  generatedAt: string;
  overallStatus: HealthLevel;
  checks: HealthCheck[];
  vapiCalls: VapiCallSummary[];
  vapiStats: {
    callCount24h: number;
    completedCount24h: number;
    failedCount24h: number;
    avgTurnLatencyMs: number | null;
    avgModelLatencyMs: number | null;
    avgVoiceLatencyMs: number | null;
    totalCostUsd: number;
  };
}

export async function buildTenantHealthReport(
  tenant: TenantConfig,
): Promise<TenantHealthReport> {
  const vapiKey = process.env.VAPI_PRIVATE_KEY ?? process.env.VAPI_API_KEY ?? "";
  const checks: HealthCheck[] = [];
  let vapiCalls: VapiCallSummary[] = [];

  // ── VAPI health ──────────────────────────────────────────────────────────
  if (tenant.vapiAssistantId && vapiKey) {
    vapiCalls = await fetchVapiCalls(tenant.vapiAssistantId, vapiKey);

    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    const recent = vapiCalls.filter(
      (c) => c.startedAt && new Date(c.startedAt).getTime() > cutoff,
    );
    const completed = recent.filter((c) => c.status === "completed");
    const failed = recent.filter((c) => c.status === "failed");

    const latencies = completed
      .map((c) => c.turnLatencyAverage)
      .filter((v): v is number => v !== null);
    const avgTurn = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;

    const modelLatencies = completed.map((c) => c.modelLatencyAverage).filter((v): v is number => v !== null);
    const avgModel = modelLatencies.length > 0 ? Math.round(modelLatencies.reduce((a, b) => a + b, 0) / modelLatencies.length) : null;

    const voiceLatencies = completed.map((c) => c.voiceLatencyAverage).filter((v): v is number => v !== null);
    const avgVoice = voiceLatencies.length > 0 ? Math.round(voiceLatencies.reduce((a, b) => a + b, 0) / voiceLatencies.length) : null;

    const totalCost = vapiCalls.reduce((sum, c) => sum + (c.cost ?? 0), 0);
    const failRate = recent.length > 0 ? failed.length / recent.length : 0;

    // Latency check
    if (avgTurn === null) {
      checks.push({ key: "vapi_latency", label: "VAPI Call Latency", status: "unknown", value: "No data", detail: "No completed calls found" });
    } else if (avgTurn > 3000) {
      checks.push({ key: "vapi_latency", label: "VAPI Call Latency", status: "critical", value: `${avgTurn}ms avg`, detail: "Turn latency exceeds 3000ms — callers experiencing significant delay" });
    } else if (avgTurn > 2200) {
      checks.push({ key: "vapi_latency", label: "VAPI Call Latency", status: "warn", value: `${avgTurn}ms avg`, detail: "Turn latency above 2200ms target" });
    } else {
      checks.push({ key: "vapi_latency", label: "VAPI Call Latency", status: "ok", value: `${avgTurn}ms avg`, detail: null });
    }

    // Failure rate check
    if (recent.length >= 3 && failRate > 0.5) {
      checks.push({ key: "vapi_failures", label: "VAPI Call Success Rate", status: "critical", value: `${Math.round((1 - failRate) * 100)}%`, detail: `${failed.length}/${recent.length} calls failed in last 24h` });
    } else if (failed.length > 0) {
      checks.push({ key: "vapi_failures", label: "VAPI Call Success Rate", status: "warn", value: `${Math.round((1 - failRate) * 100)}%`, detail: `${failed.length} failed call(s) in last 24h` });
    } else {
      checks.push({ key: "vapi_failures", label: "VAPI Call Success Rate", status: recent.length === 0 ? "unknown" : "ok", value: recent.length === 0 ? "No calls" : "100%", detail: recent.length === 0 ? "No calls in last 24h" : null });
    }

    // Voice latency
    if (avgVoice !== null && avgVoice > 1200) {
      checks.push({ key: "vapi_tts", label: "TTS Latency", status: "warn", value: `${avgVoice}ms`, detail: "ElevenLabs TTS above 1200ms" });
    } else if (avgVoice !== null) {
      checks.push({ key: "vapi_tts", label: "TTS Latency", status: "ok", value: `${avgVoice}ms`, detail: null });
    }

    const vapiStats = {
      callCount24h: recent.length,
      completedCount24h: completed.length,
      failedCount24h: failed.length,
      avgTurnLatencyMs: avgTurn,
      avgModelLatencyMs: avgModel,
      avgVoiceLatencyMs: avgVoice,
      totalCostUsd: Math.round(totalCost * 10000) / 10000,
    };

    // ── Auto-alert ────────────────────────────────────────────────────────
    const alertKey = `${tenant.id}:vapi_latency`;
    if (avgTurn !== null && avgTurn > 3000 && shouldSendAlert(alertKey)) {
      void sendLeadNotificationEmail({
        name: null,
        phone: "n/a",
        email: null,
        preferredTime: null,
        locale: "fr-CA",
        questionSummary: `⚠️ VAPI latency critique: turnLatencyAverage = ${avgTurn}ms (seuil: 3000ms). ${recent.length} appels dans les dernières 24h.`,
        conversationId: null,
        tenantName: tenant.name,
        notifyEmail: "steve@dubub.com",
      }).then((sent) => {
        if (sent) markAlertSent(alertKey);
      });
    }

    const failAlertKey = `${tenant.id}:vapi_failures`;
    if (recent.length >= 3 && failRate > 0.5 && shouldSendAlert(failAlertKey)) {
      void sendLeadNotificationEmail({
        name: null,
        phone: "n/a",
        email: null,
        preferredTime: null,
        locale: "fr-CA",
        questionSummary: `🔴 VAPI taux d'échec critique: ${failed.length}/${recent.length} appels échoués dans les dernières 24h pour ${tenant.name}.`,
        conversationId: null,
        tenantName: tenant.name,
        notifyEmail: "steve@dubub.com",
      }).then((sent) => {
        if (sent) markAlertSent(failAlertKey);
      });
    }

    // Store stats on the report object below
    const overallStatus: HealthLevel =
      checks.some((c) => c.status === "critical")
        ? "critical"
        : checks.some((c) => c.status === "warn")
        ? "warn"
        : "ok";

    return { tenantId: tenant.id, generatedAt: new Date().toISOString(), overallStatus, checks, vapiCalls: vapiCalls.slice(0, 10), vapiStats };
  }

  // No VAPI configured
  checks.push({ key: "vapi_config", label: "VAPI Configuration", status: "warn", value: "Not configured", detail: "Set VAPI_ASSISTANT_ID and VAPI_PRIVATE_KEY" });

  return {
    tenantId: tenant.id,
    generatedAt: new Date().toISOString(),
    overallStatus: "warn",
    checks,
    vapiCalls: [],
    vapiStats: { callCount24h: 0, completedCount24h: 0, failedCount24h: 0, avgTurnLatencyMs: null, avgModelLatencyMs: null, avgVoiceLatencyMs: null, totalCostUsd: 0 },
  };
}
