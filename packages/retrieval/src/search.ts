export interface SearchQuery {
  tenantId: string;
  query: string;
  maxResults?: number;
  locale?: string;
}

export interface SearchableChunk {
  chunkId: string;
  tenantId: string;
  documentId: string;
  sourceId: string;
  locale: string;
  content: string;
  citationLabel: string;
  chunkIndex: number;
  sourceTitle?: string;
}

export interface SearchResult {
  chunkId: string;
  documentId: string;
  sourceId: string;
  locale: string;
  citationLabel: string;
  snippet: string;
  content: string;
  score: number;
  chunkIndex: number;
  sourceTitle?: string;
}

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function containsAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

function countMatches(text: string, needles: string[]): number {
  return needles.filter((needle) => text.includes(needle)).length;
}

function stripSearchBoilerplate(content: string): string {
  return content
    .replace(/skip to content/gi, " ")
    .replace(/class schedule\s*\(mw\)/gi, " ")
    .replace(/class schedule\s*\(pdf\)/gi, " ")
    .replace(/pool schedule\s*\(pdf\)/gi, " ")
    .replace(/aerial circus flyer/gi, " ")
    .replace(/programming schedule/gi, " ")
    .replace(/maa club sportif\s*\(gym montreal\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildSnippet(content: string, query: string): string {
  const maxSnippetLength = 240;
  const cleanedContent = stripSearchBoilerplate(content);
  const normalizedContent = normalizeText(cleanedContent);
  const normalizedQuery = normalizeText(query);
  const queryTokens = unique(tokenize(query));

  let startIndex = normalizedContent.indexOf(normalizedQuery);

  if (startIndex < 0) {
    for (const token of queryTokens) {
      const tokenIndex = normalizedContent.indexOf(token);
      if (tokenIndex >= 0) {
        startIndex = tokenIndex;
        break;
      }
    }
  }

  const sourceText = cleanedContent.length > 0 ? cleanedContent : content;

  if (startIndex < 0) {
    return sourceText.length <= maxSnippetLength
      ? sourceText
      : `${sourceText.slice(0, maxSnippetLength).trim()}…`;
  }

  const snippetStart = Math.max(0, startIndex - 80);
  const snippetEnd = Math.min(sourceText.length, snippetStart + maxSnippetLength);
  const snippet = sourceText.slice(snippetStart, snippetEnd).trim();

  const prefix = snippetStart > 0 ? "…" : "";
  const suffix = snippetEnd < sourceText.length ? "…" : "";

  return `${prefix}${snippet}${suffix}`;
}

function scoreChunk(query: SearchQuery, chunk: SearchableChunk): number {
  const normalizedQuery = normalizeText(query.query);
  const normalizedContent = normalizeText(chunk.content);
  const cleanedContent = normalizeText(stripSearchBoilerplate(chunk.content));
  const queryTokens = unique(tokenize(query.query));

  if (!normalizedQuery || queryTokens.length === 0) {
    return 0;
  }

  let score = 0;

  if (cleanedContent.includes(normalizedQuery)) {
    score += 140;
  } else if (normalizedContent.includes(normalizedQuery)) {
    score += 70;
  }

  let rawMatchedTokens = 0;
  let cleanedMatchedTokens = 0;

  for (const token of queryTokens) {
    if (normalizedContent.includes(token)) {
      rawMatchedTokens += 1;
    }
    if (cleanedContent.includes(token)) {
      cleanedMatchedTokens += 1;
    }
  }

  score += rawMatchedTokens * 8;
  score += cleanedMatchedTokens * 22;
  score += (cleanedMatchedTokens / queryTokens.length) * 120;

  const normalizedTitle = normalizeText(chunk.sourceTitle ?? "");
  let titleMatches = 0;

  for (const token of queryTokens) {
    if (normalizedTitle.includes(token)) {
      titleMatches += 1;
    }
  }

  if (normalizedTitle.includes(normalizedQuery)) {
    score += 60;
  } else {
    score += titleMatches * 18;
  }

  if (query.locale && chunk.locale === query.locale) {
    score += 10;
  }

  const boilerplateMarkers = [
    "skip to content",
    "class schedule (mw)",
    "class schedule (pdf)",
    "pool schedule (pdf)",
    "aerial circus flyer",
    "programming schedule",
  ];

  const boilerplateCount = countMatches(normalizedContent, boilerplateMarkers);
  const hasBoilerplate = boilerplateCount >= 2;

  if (chunk.chunkIndex === 0) {
    score -= 8;
  }

  if (chunk.chunkIndex === 0 && titleMatches === 0) {
    score -= 40;
  }

  if (hasBoilerplate) {
    score -= 18 * boilerplateCount;
  }

  if (chunk.chunkIndex === 0 && hasBoilerplate && titleMatches === 0) {
    score -= 45;
  }

  if (
    containsAny(normalizedContent, [
      "skip to content",
      "class schedule (mw)",
      "class schedule (pdf)",
      "pool schedule (pdf)",
    ]) &&
    cleanedMatchedTokens === 0
  ) {
    score -= 60;
  }

  return Number(score.toFixed(2));
}

export async function searchKnowledgeBase(
  query: SearchQuery,
  chunks: SearchableChunk[],
): Promise<SearchResult[]> {
  const maxResults = query.maxResults ?? 5;

  const ranked = chunks
    .filter(
      (chunk) =>
        chunk.tenantId === query.tenantId &&
        typeof chunk.content === "string" &&
        chunk.content.trim().length > 0,
    )
    .map((chunk) => {
      const score = scoreChunk(query, chunk);

      return {
        chunk,
        score,
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }

      if (a.chunk.sourceTitle && b.chunk.sourceTitle) {
        return a.chunk.sourceTitle.localeCompare(b.chunk.sourceTitle);
      }

      return a.chunk.chunkIndex - b.chunk.chunkIndex;
    })
    .slice(0, maxResults)
    .map(({ chunk, score }) => ({
      chunkId: chunk.chunkId,
      documentId: chunk.documentId,
      sourceId: chunk.sourceId,
      locale: chunk.locale,
      citationLabel: chunk.citationLabel,
      snippet: buildSnippet(chunk.content, query.query),
      content: chunk.content,
      score,
      chunkIndex: chunk.chunkIndex,
      sourceTitle: chunk.sourceTitle,
    }));

  return ranked;
}