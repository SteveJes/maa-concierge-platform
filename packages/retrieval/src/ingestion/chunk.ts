export interface PreparedChunk {
  content: string;
  chunkIndex: number;
  charCount: number;
}

export interface ChunkingOptions {
  maxChars?: number;
  overlapChars?: number;
}

const DEFAULT_MAX_CHARS = 1200;
const DEFAULT_OVERLAP_CHARS = 150;

function normalizeForChunking(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function splitIntoParagraphs(text: string): string[] {
  return normalizeForChunking(text)
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
}

function splitLongBlock(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) {
    return [text];
  }

  const sentences =
    text.match(/[^.!?]+(?:[.!?]+|$)/g)?.map((part) => part.trim()).filter(Boolean) ??
    [text];

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (sentence.length > maxChars) {
      if (current.length > 0) {
        chunks.push(current);
        current = "";
      }

      let start = 0;
      while (start < sentence.length) {
        const slice = sentence.slice(start, start + maxChars).trim();
        if (slice.length > 0) {
          chunks.push(slice);
        }
        start += maxChars;
      }
      continue;
    }

    const next = current.length > 0 ? `${current} ${sentence}` : sentence;

    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current.length > 0) {
      chunks.push(current);
    }

    current = sentence;
  }

  if (current.length > 0) {
    chunks.push(current);
  }

  return chunks;
}

function takeOverlapTail(text: string, overlapChars: number): string {
  if (overlapChars <= 0 || text.length <= overlapChars) {
    return text;
  }

  return text.slice(text.length - overlapChars).trim();
}

export function prepareDocumentChunks(
  normalizedDocument: string,
  options: ChunkingOptions = {},
): PreparedChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const overlapChars = options.overlapChars ?? DEFAULT_OVERLAP_CHARS;

  const paragraphs = splitIntoParagraphs(normalizedDocument);
  const rawChunks: string[] = [];

  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      if (current.length > 0) {
        rawChunks.push(current);
        current = "";
      }

      const oversizedParts = splitLongBlock(paragraph, maxChars);
      rawChunks.push(...oversizedParts);
      continue;
    }

    const next = current.length > 0 ? `${current}\n\n${paragraph}` : paragraph;

    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current.length > 0) {
      rawChunks.push(current);
      const overlap = takeOverlapTail(current, overlapChars);
      current = overlap.length > 0 ? `${overlap}\n\n${paragraph}` : paragraph;
    } else {
      current = paragraph;
    }
  }

  if (current.length > 0) {
    rawChunks.push(current);
  }

  return rawChunks
    .map((content) => content.trim())
    .filter((content) => content.length > 0)
    .map((content, chunkIndex) => ({
      content,
      chunkIndex,
      charCount: content.length,
    }));
}

export function prepareChunks(
  normalizedDocuments: string[],
  options: ChunkingOptions = {},
): PreparedChunk[] {
  const chunks: PreparedChunk[] = [];
  let nextChunkIndex = 0;

  for (const document of normalizedDocuments) {
    const prepared = prepareDocumentChunks(document, options);

    for (const chunk of prepared) {
      chunks.push({
        content: chunk.content,
        chunkIndex: nextChunkIndex,
        charCount: chunk.charCount,
      });
      nextChunkIndex += 1;
    }
  }

  return chunks;
}