import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadApprovedSourceRegistry } from "@platform/config";
import type { ApprovedSourceConfig } from "@platform/schemas";

export interface MaaWebIngestionOptions {
  smoke: boolean;
  repoRoot?: string;
}

function isApprovedActiveWebSource(source: ApprovedSourceConfig): boolean {
  return source.enabled && source.sourceKind === "website_page";
}

export async function runMaaWebIngestion(
  options: MaaWebIngestionOptions,
): Promise<void> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  // apps/api/src/ingestion -> repo root
  const repoRoot =
    options.repoRoot ?? path.resolve(__dirname, "../../../../");

  const registry = await loadApprovedSourceRegistry("maa", repoRoot);

  const webSources = registry.sources.filter(isApprovedActiveWebSource);
  const selected = options.smoke ? webSources.slice(0, 2) : webSources;

  const summary = selected.map((source, index) => ({
    index: index + 1,
    key: source.key,
    section: source.section,
    locale: source.locale,
    url: source.sourceUrl,
  }));

  console.log(
    JSON.stringify(
      {
        tenantCode: "maa",
        mode: options.smoke ? "smoke" : "full",
        repoRoot,
        totalApprovedWebSources: webSources.length,
        selectedCount: selected.length,
        selectedSources: summary,
      },
      null,
      2,
    ),
  );
}