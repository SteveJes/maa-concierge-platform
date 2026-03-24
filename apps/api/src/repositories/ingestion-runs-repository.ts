import type { IngestionRunRecordWrite } from "@platform/schemas";
import type { NocoDbClient, NocoRecord } from "../infrastructure/nocodb-client.js";

export class IngestionRunsRepository {
  constructor(
    private readonly client: NocoDbClient,
    private readonly tableName: string
  ) {}

  async create(payload: IngestionRunRecordWrite): Promise<NocoRecord> {
    return this.client.create(this.tableName, payload as unknown as Record<string, unknown>);
  }

  async updateByRunUuid(runUuid: string, patch: Partial<IngestionRunRecordWrite>): Promise<NocoRecord> {
    const existing = await this.findByRunUuid(runUuid);
    if (!existing) {
      throw new Error(`Ingestion run not found for run_uuid=${runUuid}`);
    }

    return this.client.update(this.tableName, existing.Id as string | number, patch as Record<string, unknown>);
  }

  async findByRunUuid(runUuid: string): Promise<NocoRecord | undefined> {
    const records = await this.client.list(this.tableName);
    return records.find((record) => record.run_uuid === runUuid);
  }
}
