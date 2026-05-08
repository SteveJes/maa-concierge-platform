/**
 * Business-hours window check for VAPI transfer-to-human.
 *
 * The window is configured per-tenant (TenantConfig.transferBusinessHours) as:
 *   - days: 7-element boolean array, index 0 = Sunday, 6 = Saturday
 *   - startHour / endHour: 24h hours in the tenant's timezone (endHour exclusive)
 *   - timezone: IANA name, e.g. "America/Montreal"
 *
 * The check happens server-side at the moment Sophie's transfer tool is invoked,
 * so it always reflects the live config (including overrides from the dashboard).
 */
import type { TenantConfig } from "./tenants.js";

export type TransferDecision =
  | { action: "transfer"; destination: string }
  | { action: "capture_lead"; reason: "outside_hours" | "disabled" | "no_phone" };

/**
 * Decide what should happen when the VAPI assistant invokes the transfer tool.
 * Returns either { action: "transfer", destination } or a capture_lead fallback
 * with the reason so the caller-facing message can be specific.
 */
export function decideTransfer(
  tenant: TenantConfig,
  now: Date = new Date(),
): TransferDecision {
  if (!tenant.transferToHumanEnabled) {
    return { action: "capture_lead", reason: "disabled" };
  }

  const phone = (tenant.transferToHumanPhone ?? "").trim();
  if (!phone) {
    return { action: "capture_lead", reason: "no_phone" };
  }

  if (!isWithinBusinessHours(tenant.transferBusinessHours, now)) {
    return { action: "capture_lead", reason: "outside_hours" };
  }

  return { action: "transfer", destination: phone };
}

/**
 * True iff `now` falls within the configured business hours window.
 * Defaults to "always closed" if the window is missing — explicit opt-in only.
 */
export function isWithinBusinessHours(
  window: TenantConfig["transferBusinessHours"],
  now: Date = new Date(),
): boolean {
  if (!window) return false;

  const tz = window.timezone || "America/Montreal";

  // Use the locale's parts to extract weekday + hour in the configured tz.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "numeric",
    hour12: false,
  }).formatToParts(now);

  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";
  const hourRaw = parts.find((p) => p.type === "hour")?.value ?? "0";

  // Map weekday short name to index. Intl uses Sun..Sat ordering.
  const weekdayIndex: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const dayIdx = weekdayIndex[weekday];
  if (dayIdx === undefined) return false;

  if (window.days.length !== 7 || !window.days[dayIdx]) return false;

  // hour-23 in 24h. The "24" edge case from formatToParts is normalized to 0.
  const hour = parseInt(hourRaw, 10);
  const normalizedHour = Number.isFinite(hour) ? (hour % 24) : -1;
  if (normalizedHour < 0) return false;

  return normalizedHour >= window.startHour && normalizedHour < window.endHour;
}
