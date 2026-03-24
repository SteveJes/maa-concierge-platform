export interface PreparedChunk {
  content: string;
  chunkIndex: number;
}

export function prepareChunks(normalizedDocuments: string[]): PreparedChunk[] {
  return normalizedDocuments.map((content, chunkIndex) => ({ content, chunkIndex }));
}
