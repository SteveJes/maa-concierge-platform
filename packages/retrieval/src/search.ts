export interface SearchQuery {
  tenantId: string;
  query: string;
  maxResults?: number;
}

export interface SearchResult {
  sourceId: string;
  snippet: string;
  score: number;
}

export async function searchKnowledgeBase(_query: SearchQuery): Promise<SearchResult[]> {
  return [];
}
