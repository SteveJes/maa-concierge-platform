import type { TenantRecordWrite } from "@platform/schemas";
import type { NocoDbClient, NocoRecord } from "../infrastructure/nocodb-client.js";

export class TenantsRepository {
  constructor(
    private readonly client: NocoDbClient,
    private readonly tableName: string
  ) {}

  async upsertByTenantUuid(payload: TenantRecordWrite): Promise<NocoRecord> {
    const existing = await this.findByTenantUuid(payload.tenant_uuid);
    if (!existing) {
      return this.client.create(this.tableName, payload as unknown as Record<string, unknown>);
    }

    return this.client.update(this.tableName, existing.Id as string | number, payload as unknown as Record<string, unknown>);
  }

  async findByTenantUuid(tenantUuid: string): Promise<NocoRecord | undefined> {
    const records = await this.client.list(this.tableName);
    return records.find((record) => record.tenant_uuid === tenantUuid);
  }
}
