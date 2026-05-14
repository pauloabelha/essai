export interface SearchDocument {
  path: string;
  content: string;
}

export interface SearchResult {
  path: string;
  score: number;
  snippet: string;
}

export function searchDocuments(
  documents: SearchDocument[],
  query: string,
  folder?: string,
): SearchResult[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (!terms.length) return [];

  return documents
    .filter((doc) => !folder || doc.path.startsWith(folder))
    .map((doc) => {
      const haystack = `${doc.path}\n${doc.content}`.toLowerCase();
      const score = terms.reduce((sum, term) => {
        const filenameHit = doc.path.toLowerCase().includes(term) ? 5 : 0;
        const contentHits = haystack.split(term).length - 1;
        return sum + filenameHit + contentHits;
      }, 0);
      return {
        path: doc.path,
        score,
        snippet: score ? createSnippet(doc.content, terms[0]) : "",
      };
    })
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
}

function createSnippet(content: string, term: string) {
  const normalized = content.toLowerCase();
  const index = normalized.indexOf(term);
  if (index === -1) return content.replace(/\s+/g, " ").slice(0, 160);
  const start = Math.max(0, index - 70);
  const end = Math.min(content.length, index + 110);
  return `${start > 0 ? "..." : ""}${content.slice(start, end).replace(/\s+/g, " ")}${
    end < content.length ? "..." : ""
  }`;
}
