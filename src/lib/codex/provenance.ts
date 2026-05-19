export interface SourceProvenance {
  sourcePath: string;
  page?: string;
  quote?: string;
  quoteSpan?: {
    start: number;
    end: number;
  };
  retrievalMethod: string;
  timestamp: string;
  originatingQuery?: string;
}

export function normalizeProvenance(
  input: Partial<SourceProvenance>,
  now = new Date(),
): SourceProvenance {
  const sourcePath = (input.sourcePath ?? "").trim();
  if (!sourcePath) {
    throw new Error("Codex provenance requires a source path.");
  }
  const retrievalMethod = (input.retrievalMethod ?? "").trim();
  if (!retrievalMethod) {
    throw new Error("Codex provenance requires a retrieval method.");
  }

  return {
    sourcePath,
    page: cleanOptional(input.page),
    quote: cleanOptional(input.quote),
    quoteSpan: validQuoteSpan(input.quoteSpan),
    retrievalMethod,
    timestamp: input.timestamp || now.toISOString(),
    originatingQuery: cleanOptional(input.originatingQuery),
  };
}

export function provenanceLabel(provenance: SourceProvenance) {
  const page = provenance.page ? ` p. ${provenance.page}` : "";
  return `${provenance.sourcePath}${page}`;
}

export function formatProvenanceMarkdownBlock(
  input: Partial<SourceProvenance>,
  now = new Date(),
) {
  const provenance = normalizeProvenance(input, now);
  return [
    "```essai-provenance",
    `source: ${provenance.sourcePath}`,
    provenance.page ? `page: ${provenance.page}` : "",
    `retrieval: ${provenance.retrievalMethod}`,
    provenance.originatingQuery ? `query: ${provenance.originatingQuery}` : "",
    `captured: ${provenance.timestamp}`,
    "```",
  ]
    .filter(Boolean)
    .join("\n");
}

function cleanOptional(value?: string) {
  const cleaned = value?.trim();
  return cleaned || undefined;
}

function validQuoteSpan(span?: SourceProvenance["quoteSpan"]) {
  if (!span) return undefined;
  if (!Number.isFinite(span.start) || !Number.isFinite(span.end)) {
    return undefined;
  }
  if (span.start < 0 || span.end < span.start) return undefined;
  return { start: span.start, end: span.end };
}
