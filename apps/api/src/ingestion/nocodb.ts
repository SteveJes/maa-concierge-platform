import crypto from "node:crypto";

export type TenantCode = string;

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
  callbackRequestsTableId: string | undefined;
  bookingConfigsTableId: string | undefined;
}

export interface TenantRow {
  Id?: number;
  uuid: string;
  code: string;
  name?: string;
  status?: string;
  default_locale?: string;
  timezone?: string;
  website_url?: string | null;
  support_email?: string | null;
  vapi_assistant_id?: string | null;
  vapi_phone_number_id?: string | null;
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

export interface ConversationRow {
  Id?: number;
  uuid?: string;
  tenant_uuid: string;
  channel: "web_chat";
  locale?: string | null;
  status: "open" | "closed";
  started_at: string;
  updated_at: string;
  ended_at?: string | null;
  outcome?: "answered" | "escalated" | "callback" | "booking" | "phone" | null;
  summary?: string | null;
  needs_followup?: boolean | null;
  message_count?: number | null;
  language?: "fr" | "en" | null;
}

export interface MessageRow {
  Id?: number;
  uuid?: string;
  tenant_uuid: string;
  conversation_uuid: string;
  role: "user" | "assistant";
  content: string;
  locale?: string | null;
  source_refs_json?: string | null;
  tool_calls_json?: string | null;
  token_in?: number | null;
  token_out?: number | null;
  created_at?: string | null;
}

export interface CallbackRequestRow {
  Id?: number;
  uuid?: string;
  tenant_uuid: string;
  conversation_uuid?: string | null;
  locale?: string | null;
  name?: string | null;
  phone: string;
  email?: string | null;
  preferred_time_text?: string | null;
  question_summary?: string | null;
  status?: string | null;
  consent_to_contact: boolean;
  brevo_confirmation_sent: boolean;
  crm_record_id?: string | null;
  created_at: string;
}

export interface BookingConfigRow {
  Id?: number;
  uuid?: string | null;
  tenant_uuid: string;
  locale?: string | null;
  enabled?: boolean | null;
  mode?: string | null;
  calendly_event_type_uri?: string | null;
  booking_url?: string | null;
  allow_callback_fallback?: boolean | null;
  confirmation_template_key?: string | null;
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
    callbackRequestsTableId: process.env.NOCODB_TABLE_CALLBACK_REQUESTS,
    bookingConfigsTableId: process.env.NOCODB_TABLE_BOOKING_CONFIGS,
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

function normalizeLocaleForMatch(locale: string | null | undefined): string | null {
  if (typeof locale !== "string") {
    return null;
  }

  const trimmed = locale.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

export function newUuid(): string {
  return crypto.randomUUID();
}

export function computeSourceHash(content: string): string {
  return crypto.createHash("sha256").update(content, "utf8").digest("hex");
}

// In-process cache for tenant lookups — tenants are static, safe to cache indefinitely
const tenantCache = new Map<string, TenantRow>();

export async function findTenantByCode(code: TenantCode): Promise<TenantRow> {
  const cached = tenantCache.get(code);
  if (cached) return cached;

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

  tenantCache.set(code, tenant);
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

  // NocoDB POST returns only { Id } — merge with input to preserve uuid and other fields
  return { ...input, ...payload, uuid: payload?.uuid ?? input.uuid };
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

export function isBookingConfigConfigured(): boolean {
  const cfg = getNocoConfig();
  return Boolean(cfg.bookingConfigsTableId);
}

let bookingConfigCache: BookingConfigRow[] | null = null;

export async function listBookingConfigs(limit = 200): Promise<BookingConfigRow[]> {
  if (bookingConfigCache !== null) return bookingConfigCache;

  const cfg = getNocoConfig();

  if (!cfg.bookingConfigsTableId) {
    bookingConfigCache = [];
    return [];
  }

  const payload = await nocoRequest<unknown>(
    `/api/v2/tables/${cfg.bookingConfigsTableId}/records?limit=${limit}`,
    { method: "GET" },
  );

  bookingConfigCache = pickRecords(payload) as BookingConfigRow[];
  return bookingConfigCache;
}

export async function findBookingConfigForTenantLocale(
  tenantUuid: string,
  locale?: string | null,
): Promise<BookingConfigRow | null> {
  const rows = (await listBookingConfigs(200)).filter(
    (row) => row.tenant_uuid === tenantUuid,
  );

  if (rows.length === 0) {
    return null;
  }

  const requestedLocale = normalizeLocaleForMatch(locale);

  if (!requestedLocale) {
    const defaultRow = rows.find((row) => normalizeLocaleForMatch(row.locale) === null);
    return defaultRow ?? rows[0] ?? null;
  }

  const exactMatch = rows.find(
    (row) => normalizeLocaleForMatch(row.locale) === requestedLocale,
  );

  if (exactMatch) {
    return exactMatch;
  }

  const requestedLanguage = requestedLocale.split("-")[0]!;
  const languageMatch = rows.find((row) => {
    const rowLocale = normalizeLocaleForMatch(row.locale);
    return rowLocale !== null && rowLocale.split("-")[0] === requestedLanguage;
  });

  if (languageMatch) {
    return languageMatch;
  }

  const defaultRow = rows.find((row) => normalizeLocaleForMatch(row.locale) === null);
  return defaultRow ?? rows[0] ?? null;
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

function assertCallbackPersistenceConfigPresent(): {
  callbackRequestsTableId: string;
} {
  const cfg = getNocoConfig();

  if (!cfg.callbackRequestsTableId) {
    throw new Error(
      "Missing callback persistence env var. Expected NOCODB_TABLE_CALLBACK_REQUESTS.",
    );
  }

  return {
    callbackRequestsTableId: cfg.callbackRequestsTableId,
  };
}

export function isChatPersistenceConfigured(): boolean {
  const cfg = getNocoConfig();
  return Boolean(cfg.conversationsTableId && cfg.messagesTableId);
}

export function isCallbackPersistenceConfigured(): boolean {
  const cfg = getNocoConfig();
  return Boolean(cfg.callbackRequestsTableId);
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

export async function updateConversation(
  uuid: string,
  patch: Partial<ConversationRow>,
): Promise<void> {
  const cfg = assertChatPersistenceConfigPresent();
  const where = encodeURIComponent(`(uuid,eq,${uuid})`);

  const list = await nocoRequest<unknown>(
    `/api/v2/tables/${cfg.conversationsTableId}/records?where=${where}&limit=1`,
    { method: "GET" },
  );

  const rows = pickRecords(list) as ConversationRow[];

  if (rows.length === 0 || rows[0]?.Id == null) {
    return;
  }

  await nocoRequest<unknown>(
    `/api/v2/tables/${cfg.conversationsTableId}/records`,
    {
      method: "PATCH",
      body: JSON.stringify({ Id: rows[0].Id, ...patch }),
    },
  );
}

export async function listConversationsForAnalytics(
  tenantUuid: string,
  days = 30,
): Promise<ConversationRow[]> {
  const cfg = assertChatPersistenceConfigPresent();
  const where = encodeURIComponent(`(tenant_uuid,eq,${tenantUuid})`);
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  const payload = await nocoRequest<unknown>(
    `/api/v2/tables/${cfg.conversationsTableId}/records?where=${where}&limit=500&sort=-CreatedAt`,
    { method: "GET" },
  );

  const rows = pickRecords(payload) as ConversationRow[];

  // Filter by date in-memory to avoid NocoDB DateTime filter format issues
  return rows.filter((row) => {
    const ts = row.started_at ? Date.parse(row.started_at) : 0;
    return ts >= since;
  });
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

export async function listMessagesByConversationUuid(
  conversationUuid: string,
  limit = 12,
): Promise<MessageRow[]> {
  const cfg = assertChatPersistenceConfigPresent();
  const where = encodeURIComponent(`(conversation_uuid,eq,${conversationUuid})`);

  const payload = await nocoRequest<unknown>(
    `/api/v2/tables/${cfg.messagesTableId}/records?where=${where}&limit=${Math.max(limit, 50)}`,
    { method: "GET" },
  );

  const rows = pickRecords(payload) as MessageRow[];

  rows.sort((a, b) => {
    const aTime = a.created_at ? Date.parse(a.created_at) || 0 : 0;
    const bTime = b.created_at ? Date.parse(b.created_at) || 0 : 0;

    if (aTime !== bTime) {
      return aTime - bTime;
    }

    return (a.Id ?? 0) - (b.Id ?? 0);
  });

  return rows.slice(-limit);
}

export async function listRecentUserMessagesForTenant(
  tenantUuid: string,
  days = 30,
  limit = 500,
): Promise<MessageRow[]> {
  const cfg = assertChatPersistenceConfigPresent();
  const where = encodeURIComponent(`(tenant_uuid,eq,${tenantUuid})~and(role,eq,user)`);

  const payload = await nocoRequest<unknown>(
    `/api/v2/tables/${cfg.messagesTableId}/records?where=${where}&limit=${limit}&sort=-created_at`,
    { method: "GET" },
  );

  const rows = pickRecords(payload) as MessageRow[];
  const since = Date.now() - days * 24 * 60 * 60 * 1000;

  return rows.filter((row) => {
    const ts = row.created_at ? Date.parse(row.created_at) : 0;
    return ts >= since;
  });
}

export async function createCallbackRequest(
  input: CallbackRequestRow,
): Promise<CallbackRequestRow> {
  const cfg = assertCallbackPersistenceConfigPresent();

  const payload = await nocoRequest<CallbackRequestRow>(
    `/api/v2/tables/${cfg.callbackRequestsTableId}/records`,
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

export async function listAllTenants(): Promise<TenantRow[]> {
  const cfg = assertNocoConfigPresent();
  const data = await nocoRequest<{ list: TenantRow[] }>(
    `/api/v2/tables/${cfg.tenantsTableId}/records?limit=100&where=(status,eq,active)`,
    { method: "GET" },
  );
  return data?.list ?? [];
}

export async function createTenant(input: { uuid: string; code: string; name: string; status?: string; default_locale?: string; timezone?: string; website_url?: string | null; support_email?: string | null; vapi_assistant_id?: string | null; vapi_phone_number_id?: string | null }): Promise<TenantRow> {
  const cfg = assertNocoConfigPresent();
  const payload = await nocoRequest<TenantRow>(
    `/api/v2/tables/${cfg.tenantsTableId}/records`,
    { method: "POST", body: JSON.stringify(input) },
  );
  const row: TenantRow = { ...input, ...payload };
  tenantCache.set(input.code, row);
  return row;
}

export async function createBookingConfig(input: BookingConfigRow): Promise<void> {
  const cfg = getNocoConfig();
  if (!cfg.bookingConfigsTableId) return;
  await nocoRequest(
    `/api/v2/tables/${cfg.bookingConfigsTableId}/records`,
    { method: "POST", body: JSON.stringify(input) },
  );
}