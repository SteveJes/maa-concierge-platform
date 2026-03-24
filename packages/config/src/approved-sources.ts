import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { TenantApprovedSourceRegistrySchema, type TenantApprovedSourceRegistry } from "@platform/schemas";

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function loadApprovedSourceRegistry(tenantId: string, repoRoot = process.cwd()): Promise<TenantApprovedSourceRegistry> {
  const tenantDir = path.join(repoRoot, "clients", tenantId);
  const frPath = path.join(tenantDir, "approved-sources.fr.json");
  const enPath = path.join(tenantDir, "approved-sources.en.json");

  const hasFr = await exists(frPath);
  const hasEn = await exists(enPath);

  if (hasFr || hasEn) {
    const registries: TenantApprovedSourceRegistry[] = [];
    for (const filePath of [frPath, enPath]) {
      if (!(await exists(filePath))) continue;
      const raw = await readFile(filePath, "utf8");
      registries.push(TenantApprovedSourceRegistrySchema.parse(JSON.parse(raw)));
    }

    if (registries.length === 0) {
      throw new Error(`No approved source manifests found for tenant ${tenantId}`);
    }

    const base = registries[0];
    return {
      tenantId: base.tenantId,
      tenantName: base.tenantName,
      defaultLocale: base.defaultLocale,
      supportedLocales: base.supportedLocales,
      sources: registries.flatMap((entry) => entry.sources)
    };
  }

  const registryPath = path.join(tenantDir, "approved-sources.json");
  const raw = await readFile(registryPath, "utf8");
  return TenantApprovedSourceRegistrySchema.parse(JSON.parse(raw));
}
