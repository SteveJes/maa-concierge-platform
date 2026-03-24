export interface NocoRecord {
  Id?: number | string;
  [key: string]: unknown;
}

export interface NocoDbClient {
  list(table: string): Promise<NocoRecord[]>;
  create(table: string, payload: Record<string, unknown>): Promise<NocoRecord>;
  update(table: string, id: string | number, payload: Record<string, unknown>): Promise<NocoRecord>;
}

interface NocoDbConfig {
  baseUrl: string;
  token: string;
}

export function getNocoDbConfigFromEnv(env = process.env): NocoDbConfig {
  const baseUrl = env.NOCO_API_URL;
  const token = env.NOCO_API_TOKEN;

  if (!baseUrl || !token) {
    throw new Error("Missing NOCO_API_URL or NOCO_API_TOKEN");
  }

  return { baseUrl, token };
}

export class HttpNocoDbClient implements NocoDbClient {
  constructor(private readonly config: NocoDbConfig) {}

  private async request(path: string, init?: RequestInit): Promise<unknown> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        "xc-token": this.config.token,
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`NocoDB request failed (${response.status}): ${text}`);
    }

    return response.json();
  }

  async list(table: string): Promise<NocoRecord[]> {
    const json = (await this.request(`/api/v2/tables/${table}/records`)) as { list?: NocoRecord[] };
    return json.list ?? [];
  }

  async create(table: string, payload: Record<string, unknown>): Promise<NocoRecord> {
    return (await this.request(`/api/v2/tables/${table}/records`, {
      method: "POST",
      body: JSON.stringify(payload)
    })) as NocoRecord;
  }

  async update(table: string, id: string | number, payload: Record<string, unknown>): Promise<NocoRecord> {
    return (await this.request(`/api/v2/tables/${table}/records/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload)
    })) as NocoRecord;
  }
}
