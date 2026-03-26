export type TenantCode = "maa";

export interface NocoConfig {
  baseUrl: string | undefined;
  apiToken: string | undefined;
  projectId: string | undefined;
}

export function getNocoConfig(): NocoConfig {
  return {
    baseUrl: process.env.NOCODB_BASE_URL,
    apiToken: process.env.NOCODB_API_TOKEN,
    projectId: process.env.NOCODB_PROJECT_ID,
  };
}

export function assertNocoConfigPresent(): void {
  const cfg = getNocoConfig();

  if (!cfg.baseUrl || !cfg.apiToken || !cfg.projectId) {
    throw new Error(
      "Missing NocoDB env vars. Expected NOCODB_BASE_URL, NOCODB_API_TOKEN, and NOCODB_PROJECT_ID.",
    );
  }
}