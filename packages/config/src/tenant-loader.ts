export interface TenantConfig {
  id: string;
  defaultLocale: string;
  supportedLocales: string[];
}

export async function loadTenantConfig(tenantId: string): Promise<TenantConfig> {
  return {
    id: tenantId,
    defaultLocale: "fr-CA",
    supportedLocales: ["fr-CA", "en-CA"]
  };
}
