import { readFile } from "node:fs/promises";
import path from "node:path";
import { TenantApprovedSourceRegistrySchema, type TenantApprovedSourceRegistry } from "@platform/schemas";

export async function loadApprovedSourceRegistry(tenantId: string, repoRoot = process.cwd()): Promise<TenantApprovedSourceRegistry> {
  const registryPath = path.join(repoRoot, "clients", tenantId, "approved-sources.json");
  const raw = await readFile(registryPath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  return TenantApprovedSourceRegistrySchema.parse(parsed);
}
