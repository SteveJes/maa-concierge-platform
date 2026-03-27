export type TenantCode = "maa";

export interface NocoConfig {
  baseUrl: string | undefined;
  apiToken: string | undefined;
  projectId: string | undefined;
  tenantsTableId: string | undefined;
  sourcesTableId: string | undefined;
  documentsTableId: string | undefined;
  ingestionRunsTableId: string | undefined;
}

export interface TenantRow {
  Id?: number;
  uuid: string;
  code: string;
  name?: string;
}

export interface IngestionRunRow {
  Id?: number;
  uuid?: string;
  tenant_uuid: string;
  run_type: "manual";
  status: "started";
  source_count: number;
  document_count: number;
  error_count: number;
  started_at: string;
  finished_at?: string | null;
  notes?: string | null;
}

export interface SourceRow {
  Id?: number;
  uuid?: string | null;
  tenant_uuid: string;
  locale: string;
  source_type: "web_page";
  title: string;
  canonical_url: string;
  file_url?: string | null;
  source_hash?: string | null;
  approved: boolean;
  active: boolean;
  last_synced_at?: string | null;
  notes?: string | null;
}

export interface DocumentRow {
  Id?: number;
  uuid?: string;
  tenant_uuid: string;
  source_uuid: string;
  locale: string;
  version: number;
  title: string;
  doc_type: "page";
  raw_text: string;
  extracted_json?: unknown;
  citation_label: string;
  approved: boolean;
  indexed: boolean;
  indexed_at?: string | null;
  effective_from: string;
  effective_to?: string | null;
}

export function getNocoConfig(): NocoConfig {
  return {
    baseUrl: process.env.NOCODB_BASE_URL,
    apiToken: process.env.NOCODB_API_TOKEN,
    projectId: process.env.NOCODB_PROJECT_ID,
    tenantsTableId: process.env.NOCODB_TABLE_TENANTS,
    sourcesTableId: process.env.NOCODB_TABLE_SOURCES,
    documentsTableId: process.env.NOCODB_TABLE_DOCUMENTS,
    ingestionRunsTableId: process.env.NOCODB_TABLE_INGESTION_RUNS,
  };
}

export function assertNocoConfigPresent(): NocoConfig {
  const cfg = getNocoConfig();

  if (
    !cfg.baseUrl ||
    !cfg.apiToken ||
    !cfg.projectId ||
    !cfg.tenantsTableId ||
    !cfg.sourcesTableId ||
    !cfg.documentsTableId ||
    !cfg.ingestionRunsTableId
  ) {
    throw new Error(
      "Missing NocoDB env vars. Expected NOCODB_BASE_URL, NOCODB_API_TOKEN, NOCODB_PROJECT_ID, NOCODB_TABLE_TENANTS, NOCODB_TABLE_SOURCES, NOCODB_TABLE_DOCUMENTS, and NOCODB_TABLE_INGESTION_RUNS.",
    );
  }

  return cfg;
}

async function nocoRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const cfg = assertNocoConfigPresent();

  const response = await fetch(`${cfg.baseUrl}${path}`, {
    ...init,
    headers: {
      "xc-token": cfg.apiToken!,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`NocoDB request failed: ${response.status} ${text}`);
  }

  return (await response.json()) as T;
}

function pickRecords(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    if (Array.isArray(obj.list)) return obj.list;
    if (Array.isArray(obj.records)) return obj.records;
  }
  return [];
}

export function newUuid(): string {
  return crypto.randomUUID();
}

export async function findTenantByCode(code: TenantCode): Promise<TenantRow> {
  const cfg = assertNocoConfigPresent();

  const payload = await nocoRequest<unknown>(
    `/api/v2/tables/${cfg.tenantsTableId}/records?where=(code,eq,${code})&limit=1`,
    { method: "GET" },
  );

  const rows = pickRecords(payload) as TenantRow[];
  const tenant = rows[0];

  if (!tenant?.uuid) {
    throw new Error(`Tenant not found for code "${code}"`);
  }

  return tenant;
}

export async function createIngestionRun(
  input: IngestionRunRow,
): Promise<unknown> {
  const cfg = assertNocoConfigPresent();

  return nocoRequest(
    `/api/v2/tables/${cfg.ingestionRunsTableId}/records`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
}

export async function listSources(): Promise<SourceRow[]> {
  const cfg = assertNocoConfigPresent();

  const payload = await nocoRequest<unknown>(
    `/api/v2/tables/${cfg.sourcesTableId}/records?limit=200`,
    { method: "GET" },
  );

  return pickRecords(payload) as SourceRow[];
}

export async function findSourceByNaturalKey(
  tenantUuid: string,
  locale: string,
  canonicalUrl: string,
): Promise<SourceRow | undefined> {
  const rows = await listSources();

  return rows.find(
    (row) =>
      row.tenant_uuid === tenantUuid &&
      row.locale === locale &&
      row.canonical_url === canonicalUrl,
  );
}

export async function createSource(input: SourceRow): Promise<SourceRow> {
  const cfg = assertNocoConfigPresent();

  const payload = await nocoRequest<SourceRow>(
    `/api/v2/tables/${cfg.sourcesTableId}/records`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return payload;
}

export async function findOrCreateSource(
  input: SourceRow,
): Promise<{ row: SourceRow; created: boolean }> {
  const existing = await findSourceByNaturalKey(
    input.tenant_uuid,
    input.locale,
    input.canonical_url,
  );

  if (existing) {
    return { row: existing, created: false };
  }

  const created = await createSource(input);
  return { row: created, created: true };
}

export async function listDocuments(): Promise<DocumentRow[]> {
  const cfg = assertNocoConfigPresent();

  const payload = await nocoRequest<unknown>(
    `/api/v2/tables/${cfg.documentsTableId}/records?limit=200`,
    { method: "GET" },
  );

  return pickRecords(payload) as DocumentRow[];
}

export async function getNextDocumentVersion(
  sourceUuid: string,
): Promise<number> {
  const rows = await listDocuments();
  const versions = rows
    .filter((row) => row.source_uuid === sourceUuid)
    .map((row) => row.version);

  if (versions.length === 0) {
    return 1;
  }

  return Math.max(...versions) + 1;
}

export async function createDocument(
  input: DocumentRow,
): Promise<DocumentRow> {
  const cfg = assertNocoConfigPresent();

  const payload = await nocoRequest<DocumentRow>(
    `/api/v2/tables/${cfg.documentsTableId}/records`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return payload;
}