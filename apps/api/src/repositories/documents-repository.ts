import type { DocumentRecordWrite } from "@platform/schemas";
import type { NocoDbClient, NocoRecord } from "../infrastructure/nocodb-client.js";

export class DocumentsRepository {
  constructor(
    private readonly client: NocoDbClient,
    private readonly tableName: string
  ) {}

  async create(payload: DocumentRecordWrite & { [key: string]: unknown }): Promise<NocoRecord> {
    return this.client.create(this.tableName, payload as unknown as Record<string, unknown>);
  }

  async createMany(payloads: (DocumentRecordWrite & { [key: string]: unknown })[]): Promise<NocoRecord[]> {
    const created: NocoRecord[] = [];
    for (const payload of payloads) {
      const row = await this.create(payload);
      created.push(row);
    }
    return created;
  }

  async listBySourceUuid(sourceUuid: string): Promise<NocoRecord[]> {
    const records = await this.client.list(this.tableName);
    return records.filter((record) => record.source_uuid === sourceUuid);
  }
}
