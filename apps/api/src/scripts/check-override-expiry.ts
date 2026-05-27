/**
 * MAA override-layer expiry reminder (Daphné batch 2026-05-27 §9B.7).
 *
 * Scans every JSON file in apps/api/src/knowledge/maa-v2/override/, finds
 * entries with `valid_until`, and classifies them by urgency:
 *
 *   - past valid_until   → STALE  (must be refreshed immediately; the prompt
 *                          should already stop serving these as current).
 *   - within 7 days      → URGENT (Daphné receives a final ping; need new PDF
 *                          from MAA today/tomorrow).
 *   - within 14 days     → REMINDER (first heads-up; ask MAA for the next
 *                          version of the PDF).
 *   - more than 14 days  → OK     (nothing to do).
 *
 * Output:
 *   - apps/api/_alerts/maa-override-expiry-<ISO>.md (digest, always written)
 *   - optional Brevo email to LEAD_NOTIFY_EMAIL when any URGENT or STALE
 *     entries are found (controlled by --notify flag or NOTIFY_ON_EXPIRY=true).
 *
 * Designed to be run nightly via cron alongside the existing
 * cron-canary-4h.sh / cron-sentinel-daily.sh on the droplet:
 *
 *   0 5 * * * cd /var/www/concierge/apps/api && \
 *     /usr/bin/node --import tsx/esm src/scripts/check-override-expiry.ts --notify \
 *     >> /var/log/maa-expiry-cron.log 2>&1
 *
 * Usage (local):
 *   pnpm.cmd --filter @platform/api exec tsx src/scripts/check-override-expiry.ts
 *   pnpm.cmd --filter @platform/api exec tsx src/scripts/check-override-expiry.ts --notify
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { sendLeadNotificationEmail } from "../services/email-notifications.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OVERRIDE_DIR = path.resolve(__dirname, "../knowledge/maa-v2/override");
const ALERTS_DIR = path.resolve(__dirname, "../../_alerts");

type Bucket = "STALE" | "URGENT" | "REMINDER" | "OK";

interface ExpiryEntry {
  file: string;
  serviceKey: string;
  service_id?: string;
  valid_from?: string;
  valid_until: string;
  source_url?: string;
  primary_contact?: string;
  daysUntilExpiry: number;
  bucket: Bucket;
}

function bucketFor(daysUntilExpiry: number): Bucket {
  if (daysUntilExpiry < 0) return "STALE";
  if (daysUntilExpiry <= 7) return "URGENT";
  if (daysUntilExpiry <= 14) return "REMINDER";
  return "OK";
}

function daysBetween(today: Date, target: Date): number {
  const ms = target.getTime() - today.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

/**
 * Recursively walk an override JSON object and collect every leaf entry that
 * has `valid_until` set. Each leaf is a service block in the override file.
 */
function collectExpiryLeaves(file: string, json: unknown, parentKey = ""): ExpiryEntry[] {
  if (!json || typeof json !== "object") return [];
  const out: ExpiryEntry[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (const [key, value] of Object.entries(json as Record<string, unknown>)) {
    if (!value || typeof value !== "object") continue;
    const v = value as Record<string, unknown>;
    if (typeof v.valid_until === "string" && v.valid_until.length > 0) {
      const target = new Date(v.valid_until);
      if (Number.isNaN(target.getTime())) continue;
      target.setHours(0, 0, 0, 0);
      const days = daysBetween(today, target);
      out.push({
        file,
        serviceKey: parentKey ? `${parentKey}.${key}` : key,
        service_id: typeof v.service_id === "string" ? v.service_id : undefined,
        valid_from: typeof v.valid_from === "string" ? v.valid_from : undefined,
        valid_until: v.valid_until,
        source_url: typeof v.source_url === "string" ? v.source_url : undefined,
        primary_contact: typeof v.primary_contact === "string" ? v.primary_contact : undefined,
        daysUntilExpiry: days,
        bucket: bucketFor(days),
      });
    }
    // Recurse one level (most overrides nest service blocks at top level only).
    out.push(...collectExpiryLeaves(file, value, parentKey ? `${parentKey}.${key}` : key));
  }
  return out;
}

function bucketEmoji(b: Bucket): string {
  return b === "STALE" ? "🔴" : b === "URGENT" ? "🟠" : b === "REMINDER" ? "🟡" : "🟢";
}

function formatDigest(entries: ExpiryEntry[], runDate: Date): string {
  const grouped: Record<Bucket, ExpiryEntry[]> = { STALE: [], URGENT: [], REMINDER: [], OK: [] };
  for (const e of entries) grouped[e.bucket].push(e);

  const lines: string[] = [];
  lines.push(`# MAA override-layer expiry digest — ${runDate.toISOString().slice(0, 10)}`);
  lines.push("");
  lines.push(`Scanned: \`${OVERRIDE_DIR}\``);
  lines.push("");
  lines.push(`- 🔴 STALE (past valid_until): **${grouped.STALE.length}**`);
  lines.push(`- 🟠 URGENT (≤ 7 days): **${grouped.URGENT.length}**`);
  lines.push(`- 🟡 REMINDER (≤ 14 days): **${grouped.REMINDER.length}**`);
  lines.push(`- 🟢 OK (> 14 days): **${grouped.OK.length}**`);
  lines.push("");

  for (const b of ["STALE", "URGENT", "REMINDER", "OK"] as const) {
    if (grouped[b].length === 0) continue;
    lines.push(`## ${bucketEmoji(b)} ${b}`);
    lines.push("");
    for (const e of grouped[b]) {
      const days =
        e.daysUntilExpiry < 0
          ? `**${Math.abs(e.daysUntilExpiry)} days ago**`
          : e.daysUntilExpiry === 0
            ? "**TODAY**"
            : `in ${e.daysUntilExpiry} days`;
      lines.push(`- **${e.serviceKey}** (${e.file})`);
      lines.push(`  - valid_until: \`${e.valid_until}\` (${days})`);
      if (e.service_id) lines.push(`  - service_id: \`${e.service_id}\``);
      if (e.source_url) lines.push(`  - source: ${e.source_url}`);
      if (e.primary_contact) lines.push(`  - primary_contact: \`${e.primary_contact}\``);
      lines.push("");
    }
  }
  if (grouped.STALE.length === 0 && grouped.URGENT.length === 0 && grouped.REMINDER.length === 0) {
    lines.push("");
    lines.push("_Nothing requires attention. Next scan tomorrow._");
  } else {
    lines.push("---");
    lines.push("");
    lines.push("**Action**: ask Daphné / MAA staff for the next version of any STALE or URGENT PDF; update the corresponding override JSON's `valid_from` / `valid_until` and re-deploy. The prompt automatically stops serving expired schedules as current.");
  }
  return lines.join("\n");
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const notify = args.has("--notify") || process.env.NOTIFY_ON_EXPIRY === "true";

  await fs.mkdir(ALERTS_DIR, { recursive: true });
  const files = await fs.readdir(OVERRIDE_DIR);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  const allEntries: ExpiryEntry[] = [];
  for (const f of jsonFiles) {
    const raw = await fs.readFile(path.join(OVERRIDE_DIR, f), "utf8");
    const json = JSON.parse(raw);
    allEntries.push(...collectExpiryLeaves(f, json));
  }

  const runDate = new Date();
  const digest = formatDigest(allEntries, runDate);
  const outPath = path.join(ALERTS_DIR, `maa-override-expiry-${runDate.toISOString().replace(/[:.]/g, "-")}.md`);
  await fs.writeFile(outPath, digest, "utf8");

  console.log(digest);
  console.log(`\nDigest written to: ${outPath}`);

  const actionable = allEntries.filter((e) => e.bucket === "STALE" || e.bucket === "URGENT");
  if (notify && actionable.length > 0) {
    const recipients = process.env.LEAD_NOTIFY_EMAIL || "stevejes@gmail.com";
    const subject = `🔔 MAA override-layer: ${actionable.length} source(s) need refresh`;
    const sent = await sendLeadNotificationEmail({
      name: null,
      phone: "n/a",
      email: null,
      preferredTime: null,
      locale: "fr-CA",
      questionSummary: subject,
      aiSummary: `Le cron de vérification de la couche override MAA a trouvé ${actionable.length} source(s) à rafraîchir aujourd'hui. Voir le digest complet ci-dessous.`,
      richSummary: null,
      transcript: null,
      conversationId: null,
      tenantName: "MAA Override Cron",
      notifyEmail: recipients,
      routing: null,
    }).catch((err) => {
      console.error("[expiry-cron] notify email failed:", err);
      return false;
    });
    console.log(`[expiry-cron] notify ${sent ? "sent" : "failed/skipped"} to ${recipients}`);
  } else if (actionable.length === 0) {
    console.log("[expiry-cron] no STALE or URGENT entries — no notification sent.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
