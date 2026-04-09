import crypto from "node:crypto";

export type TenantCode = "maa";

export interface NocoConfig {
  baseUrl: string | undefined;
  apiToken: string | undefined;
  projectId: string | undefined;
  tenantsTableId: string | undefined;
  sourcesTableId: string | undefined;
  documentsTableId: string | undefined;
  ingestionRunsTableId: string | undefined;
  documentChunksTableId: string | undefined;
  conversationsTableId: string | undefined;
  messagesTableId: string | undefined;
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

export interface IngestionRunPatch {
  status?: "completed" | "failed";
  document_count?: number;
  error_count?: number;
  finished_at?: string | null;
  notes?: string | null;
}

export interface SourceRow {
  Id?: number;
  uuid?: string | null;
  tenant_uuid: string;
  locale: string;
  source_type: "web_page" | "pdf" | "manual_faq";
  title: string;
  canonical_url: string;
  file_url?: string | null;
  source_hash?: string | null;
  approved: boolean;
  active: boolean;
  last_synced_at?: string | null;
  notes?: string | null;
}

export interface SourcePatch {
  source_hash?: string | null;
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
  doc_type: "page" | "pdf";
  raw_text: string;
  extracted_json?: unknown;
  citation_label: string;
  approved: boolean;
  indexed: boolean;
  indexed_at?: string | null;
  effective_from: string;
  effective_to?: string | null;
}

export interface DocumentPatch {
  indexed?: boolean;
  indexed_at?: string | null;
}

export interface DocumentChunkRow {
  Id?: number;
  uuid?: string;
  tenant_uuid: string;
  source_uuid: string;
  document_uuid: string;
  locale: string;
  chunk_index: number;
  content: string;
  content_hash: string;
  char_count: number;
  citation_label: string;
  approved: boolean;
  active: boolean;
  created_at?: string | null;
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
    documentChunksTableId: process.env.NOCODB_TABLE_DOCUMENT_CHUNKS,
    conversationsTableId: process.env.NOCODB_TABLE_CONVERSATIONS,
    messagesTableId: process.env.NOCODB_TABLE_MESSAGES,
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
    !cfg.ingestionRunsTableId ||
    !cfg.documentChunksTableId
  ) {
    throw new Error(
      "Missing NocoDB env vars. Expected NOCODB_BASE_URL, NOCODB_API_TOKEN, NOCODB_PROJECT_ID, NOCODB_TABLE_TENANTS, NOCODB_TABLE_SOURCES, NOCODB_TABLE_DOCUMENTS, NOCODB_TABLE_INGESTION_RUNS, and NOCODB_TABLE_DOCUMENT_CHUNKS.",
    );
  }

  return cfg;
}

async function nocoRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const cfg = assertNocoConfigPresent();
  const maxAttempts = 6;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetch(`${cfg.baseUrl}${path}`, {
      ...init,
      headers: {
        "xc-token": cfg.apiToken!,
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });

    if (response.ok) {
      return (await response.json()) as T;
    }

    if (response.status === 429 && attempt < maxAttempts) {
      const retryAfterHeader = response.headers.get("retry-after");
      const retryAfterMs =
        retryAfterHeader && !Number.isNaN(Number(retryAfterHeader))
          ? Number(retryAfterHeader) * 1000
          : attempt * 2000;

      await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
      continue;
    }

    const text = await response.text();
    throw new Error(`NocoDB request failed: ${response.status} ${text}`);
  }

  throw new Error("NocoDB request failed after retries.");
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

export function computeSourceHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
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

  return {
    ...input,
    ...payload,
    uuid: payload?.uuid ?? input.uuid ?? null,
  };
}

export async function updateSourceById(
  id: number,
  patch: SourcePatch,
): Promise<unknown> {
  const cfg = assertNocoConfigPresent();

  return nocoRequest(
    `/api/v2/tables/${cfg.sourcesTableId}/records`,
    {
      method: "PATCH",
      body: JSON.stringify({
        Id: id,
        ...patch,
      }),
    },
  );
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

export async function listDocuments(limit = 500): Promise<DocumentRow[]> {
  const cfg = assertNocoConfigPresent();

  const payload = await nocoRequest<unknown>(
    `/api/v2/tables/${cfg.documentsTableId}/records?limit=${limit}`,
    { method: "GET" },
  );

  return pickRecords(payload) as DocumentRow[];
}

export async function findDocumentByUuid(
  documentUuid: string,
): Promise<DocumentRow | undefined> {
  const rows = await listDocuments(1000);
  return rows.find((row) => row.uuid === documentUuid);
}

export async function listDocumentChunks(
  limit = 5000,
): Promise<DocumentChunkRow[]> {
  const cfg = assertNocoConfigPresent();

  const allRows: DocumentChunkRow[] = [];
  const pageSize = 100;

  for (let offset = 0; offset < limit; offset += pageSize) {
    const payload = await nocoRequest<unknown>(
      `/api/v2/tables/${cfg.documentChunksTableId}/records?limit=${pageSize}&offset=${offset}`,
      { method: "GET" },
    );

    const rows = pickRecords(payload) as DocumentChunkRow[];

    if (rows.length === 0) {
      break;
    }

    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }
  }

  return allRows.slice(0, limit);
}

export async function listDocumentChunksByDocumentUuid(
  documentUuid: string,
  limit = 500,
): Promise<DocumentChunkRow[]> {
  const cfg = assertNocoConfigPresent();
  const where = encodeURIComponent(`(document_uuid,eq,${documentUuid})`);

  const payload = await nocoRequest<unknown>(
    `/api/v2/tables/${cfg.documentChunksTableId}/records?where=${where}&limit=${limit}`,
    { method: "GET" },
  );

  return pickRecords(payload) as DocumentChunkRow[];
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

export async function createDocumentChunk(
  input: DocumentChunkRow,
): Promise<DocumentChunkRow> {
  const cfg = assertNocoConfigPresent();

  const payload = await nocoRequest<DocumentChunkRow>(
    `/api/v2/tables/${cfg.documentChunksTableId}/records`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return {
    ...input,
    ...payload,
    uuid: payload?.uuid ?? input.uuid,
  };
}

export async function updateIngestionRunById(
  id: number,
  patch: IngestionRunPatch,
): Promise<unknown> {
  const cfg = assertNocoConfigPresent();

  return nocoRequest(
    `/api/v2/tables/${cfg.ingestionRunsTableId}/records`,
    {
      method: "PATCH",
      body: JSON.stringify({
        Id: id,
        ...patch,
      }),
    },
  );
}

export async function updateDocumentById(
  id: number,
  patch: DocumentPatch,
): Promise<unknown> {
  const cfg = assertNocoConfigPresent();

  return nocoRequest(
    `/api/v2/tables/${cfg.documentsTableId}/records`,
    {
      method: "PATCH",
      body: JSON.stringify({
        Id: id,
        ...patch,
      }),
    },
  );
}


export interface ConversationRow {
  Id?: number;
  uuid?: string;
  tenant_uuid: string;
  channel: "web_chat";
  locale?: string | null;
  status: "open";
  started_at: string;
  updated_at: string;
}

export interface MessageRow {
  Id?: number;
  uuid?: string;
  tenant_uuid: string;
  conversation_uuid: string;
  role: "user" | "assistant";
  content: string;
  locale?: string | null;
  follow_up_mode?: string | null;
  citations_json?: string | null;
  retrieval_json?: string | null;
  created_at: string;
}

function assertChatPersistenceConfigPresent(): {
  conversationsTableId: string;
  messagesTableId: string;
} {
  const cfg = getNocoConfig();

  if (!cfg.conversationsTableId || !cfg.messagesTableId) {
    throw new Error(
      "Missing chat persistence env vars. Expected NOCODB_TABLE_CONVERSATIONS and NOCODB_TABLE_MESSAGES.",
    );
  }

  return {
    conversationsTableId: cfg.conversationsTableId,
    messagesTableId: cfg.messagesTableId,
  };
}

export function isChatPersistenceConfigured(): boolean {
  const cfg = getNocoConfig();
  return Boolean(cfg.conversationsTableId && cfg.messagesTableId);
}

export async function createConversation(
  input: ConversationRow,
): Promise<ConversationRow> {
  const cfg = assertChatPersistenceConfigPresent();

  const payload = await nocoRequest<ConversationRow>(
    `/api/v2/tables/${cfg.conversationsTableId}/records`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return {
    ...input,
    ...payload,
    uuid: payload?.uuid ?? input.uuid,
  };
}

export async function createMessage(
  input: MessageRow,
): Promise<MessageRow> {
  const cfg = assertChatPersistenceConfigPresent();

  const payload = await nocoRequest<MessageRow>(
    `/api/v2/tables/${cfg.messagesTableId}/records`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );

  return {
    ...input,
    ...payload,
    uuid: payload?.uuid ?? input.uuid,
  };
}