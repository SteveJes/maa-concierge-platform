import type { SourceRecordWrite } from "@platform/schemas";
import type { NocoDbClient, NocoRecord } from "../infrastructure/nocodb-client.js";

export class SourcesRepository {
  constructor(
    private readonly client: NocoDbClient,
    private readonly tableName: string
  ) {}

  async upsertBySourceUuid(payload: SourceRecordWrite): Promise<NocoRecord> {
    const existing = await this.findBySourceUuid(payload.source_uuid);

    if (!existing) {
      return this.client.create(this.tableName, payload as unknown as Record<string, unknown>);
    }

    return this.client.update(this.tableName, existing.Id as string | number, payload as unknown as Record<string, unknown>);
  }

  async findBySourceUuid(sourceUuid: string): Promise<NocoRecord | undefined> {
    const records = await this.client.list(this.tableName);
    return records.find((record) => record.source_uuid === sourceUuid);
  }
}
