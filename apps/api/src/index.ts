import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { createServer } from "./server.js";
import { warmupSearchableChunks } from "./services/maa-chat.js";
import { findTenantByCode, listAllTenants } from "./ingestion/nocodb.js";
import { addTenant, getTenant } from "./admin/tenants.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const apiDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(apiDir, "..", "..");

const envFiles = [
  path.join(apiDir, ".env.local"),
  path.join(apiDir, ".env"),
  path.join(repoRoot, ".env.local"),
  path.join(repoRoot, ".env"),
];

for (const envFile of envFiles) {
  if (fs.existsSync(envFile)) {
    dotenv.config({ path: envFile, override: false });
  }
}

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "0.0.0.0";

const app = createServer();

app.listen({ port, host }).then(() => {
  // Load all active NocoDB tenants into the in-memory registry on startup
  void listAllTenants().then((rows) => {
    for (const row of rows) {
      if (!row.code || getTenant(row.code)) continue; // skip MAA (already in static registry) and unknowns
      addTenant({
        id: row.code,
        name: row.name ?? row.code,
        plan: "starter",
        status: "active",
        since: new Date().toISOString().slice(0, 10),
        notifyEmail: row.support_email ?? "",
        vapiAssistantId: row.vapi_assistant_id ?? null,
        vapiPhoneNumberId: row.vapi_phone_number_id ?? null,
        inboundPhoneNumber: row.vapi_inbound_phone ?? null,
        openAiModel: "gpt-4o",
        monthlyPriceCad: 0,
        addons: [],
        contactName: row.name ?? null,
        contactEmail: row.support_email ?? null,
        website: row.website_url ?? null,
        notes: null,
      });
      app.log.info({ tenantCode: row.code }, "Tenant loaded from NocoDB into registry");
    }
    // Patch known inbound phones that predate the vapi_inbound_phone NocoDB column
    const dubub = getTenant("dubub");
    if (dubub && !dubub.inboundPhoneNumber) {
      dubub.inboundPhoneNumber = process.env.DUBUB_INBOUND_PHONE ?? "+14386075588";
    }
  }).catch((err) => {
    app.log.warn({ err }, "Failed to load tenants from NocoDB on startup (non-fatal)");
  });

  // Warm up MAA knowledge base cache immediately so first request is fast
  void findTenantByCode("maa").then((tenant) => {
    if (!tenant?.uuid) return;
    void warmupSearchableChunks(tenant.uuid);
    // Re-warm every 50 minutes so the cache never expires between requests
    setInterval(() => {
      void warmupSearchableChunks(tenant.uuid).catch(() => {});
    }, 50 * 60 * 1000);
  }).catch(() => {});
}).catch((error) => {
  app.log.error(error);
  process.exit(1);
});