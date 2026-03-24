import type { PreparedChunk } from "./chunk.js";

export interface FileSearchUploadItem {
  filename: string;
  content: string;
  metadata: Record<string, string>;
}

export function prepareForOpenAIFileSearch(chunks: PreparedChunk[], sourceKey: string): FileSearchUploadItem[] {
  return chunks.map((chunk) => ({
    filename: `${sourceKey}-${chunk.chunkIndex}.txt`,
    content: chunk.content,
    metadata: { sourceKey }
  }));
}
