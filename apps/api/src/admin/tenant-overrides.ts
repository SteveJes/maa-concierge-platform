/**
 * Local-file persistence for tenant config edits made from the admin dashboard.
 *
 * The TENANT_REGISTRY is a hardcoded array in tenants.ts (the source of truth
 * for new tenants and code-level defaults). When a user PATCHes a tenant
 * through the dashboard, we layer the changes on top via this file so they
 * survive server restarts.
 *
 * Storage: apps/api/data/tenants-overrides.json — JSON map of `{ tenantId:
 * Partial<TenantConfig> }`. The file is created on first write; missing values
 * fall through to the hardcoded defaults.
 *
 * Why not NocoDB yet: the NocoDB tenants table doesn't have columns for our
 * 8 prompt-config fields. Adding those columns is a separate schema migration
 * — local-file is the smallest persistent step that unblocks the dashboard.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { TenantConfig } from "./tenants.js";

const currentFile = fileURLToPath(import.meta.url);
const apiRoot = join(dirname(currentFile), "..", "..");

// In dev, this resolves to apps/api/data. In prod (compiled to dist/), it
// resolves to apps/api/dist/apps/api/data which is fine — the file is local
// to the running server in either case.
const DATA_DIR = join(apiRoot, "data");
const OVERRIDES_FILE = join(DATA_DIR, "tenants-overrides.json");

type OverridesMap = Record<string, Partial<TenantConfig>>;

function ensureDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Read the overrides file. Returns an empty map if the file doesn't exist
 * or is malformed (logged as a warning — overrides are not critical).
 */
export function loadTenantOverrides(): OverridesMap {
  if (!existsSync(OVERRIDES_FILE)) return {};
  try {
    const raw = readFileSync(OVERRIDES_FILE, "utf-8");
    const parsed = JSON.parse(raw) as OverridesMap;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (err) {
    console.warn(`[tenant-overrides] Failed to read ${OVERRIDES_FILE}:`, err);
    return {};
  }
}

/**
 * Merge a tenant's override into the file. Existing fields for that tenant
 * are preserved unless explicitly overwritten.
 */
export function saveTenantOverride(tenantId: string, partial: Partial<TenantConfig>): void {
  ensureDir();
  const current = loadTenantOverrides();
  current[tenantId] = { ...(current[tenantId] ?? {}), ...partial };
  writeFileSync(OVERRIDES_FILE, JSON.stringify(current, null, 2), "utf-8");
}

/**
 * Apply file overrides on top of the hardcoded TENANT_REGISTRY. Called once
 * at server boot so subsequent reads see the merged view.
 */
export function applyOverridesToRegistry(registry: TenantConfig[]): void {
  const overrides = loadTenantOverrides();
  for (const tenant of registry) {
    const ov = overrides[tenant.id];
    if (ov) {
      Object.assign(tenant, ov);
    }
  }
}
