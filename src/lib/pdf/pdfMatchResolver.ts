import {
  boxesForRawRange,
  normalizePdfText,
  rawRangeFromNormalizedRange,
  type PdfHighlightBox,
  type ReconstructedPdfPage,
} from "@/lib/pdf/pdfTextMap";

export type PdfMatchRange = {
  page: number;
  rawCharStart: number;
  rawCharEnd: number;
  normalizedCharStart: number;
  normalizedCharEnd: number;
  matchedText: string;
  source: "quote" | "query" | "term";
  score: number;
};

export type PdfResolvedMatch = {
  id: string;
  page: number;
  range: PdfMatchRange;
  boxes: PdfHighlightBox[];
  previewText: string;
};

export type PdfMatchTarget = {
  quote?: string;
  query?: string;
  terms?: string[];
  maxMatches?: number;
};

type Candidate = {
  value: string;
  source: PdfMatchRange["source"];
  normalized: boolean;
  score: number;
};

export function resolvePdfMatches(
  page: ReconstructedPdfPage,
  target: PdfMatchTarget,
): PdfResolvedMatch[] {
  // Phrase candidates intentionally run before loose terms; terms are only a
  // fallback when the clicked result cannot be resolved as a quote or query.
  const candidates = orderedCandidates(target);
  for (const candidate of candidates) {
    const ranges = candidate.normalized
      ? normalizedRanges(page, candidate)
      : rawRanges(page, candidate);
    if (!ranges.length) continue;

    return ranges
      .sort((a, b) => b.score - a.score || a.rawCharStart - b.rawCharStart)
      .slice(0, target.maxMatches ?? 20)
      .map((range, index) => {
        const id = `${page.fingerprint}:${page.page}:${range.source}:${range.rawCharStart}:${range.rawCharEnd}:${index}`;
        return {
          id,
          page: page.page,
          range,
          boxes: boxesForRawRange(page, range.rawCharStart, range.rawCharEnd, id),
          previewText: previewForRange(page.rawText, range.rawCharStart, range.rawCharEnd),
        };
      })
      .filter((match) => match.boxes.length);
  }
  return [];
}

function orderedCandidates(target: PdfMatchTarget): Candidate[] {
  const candidates: Candidate[] = [];
  const quote = cleanCandidate(target.quote);
  const query = cleanCandidate(target.query);
  if (quote) {
    candidates.push({ value: quote, source: "quote", normalized: false, score: 100 });
    candidates.push({ value: quote, source: "quote", normalized: true, score: 92 });
  }
  if (query) {
    candidates.push({ value: query, source: "query", normalized: false, score: 80 });
    candidates.push({ value: query, source: "query", normalized: true, score: 72 });
  }
  for (const term of uniqueCleanTerms(target.terms ?? [])) {
    candidates.push({ value: term, source: "term", normalized: false, score: 45 });
    candidates.push({ value: term, source: "term", normalized: true, score: 38 });
  }
  return candidates;
}

function rawRanges(page: ReconstructedPdfPage, candidate: Candidate): PdfMatchRange[] {
  const ranges: PdfMatchRange[] = [];
  const haystack = page.rawText.toLowerCase();
  const needle = candidate.value.toLowerCase();
  let index = haystack.indexOf(needle);
  while (index >= 0) {
    ranges.push({
      page: page.page,
      rawCharStart: index,
      rawCharEnd: index + needle.length,
      normalizedCharStart: normalizedIndexForRaw(page, index),
      normalizedCharEnd: normalizedIndexForRaw(page, index + needle.length),
      matchedText: page.rawText.slice(index, index + needle.length),
      source: candidate.source,
      score: candidate.score + candidate.value.length / 100,
    });
    index = haystack.indexOf(needle, index + Math.max(1, needle.length));
  }
  return ranges;
}

function normalizedRanges(
  page: ReconstructedPdfPage,
  candidate: Candidate,
): PdfMatchRange[] {
  const ranges: PdfMatchRange[] = [];
  const needle = normalizePdfText(candidate.value);
  if (!needle) return ranges;
  let index = page.normalizedText.indexOf(needle);
  while (index >= 0) {
    const { rawStart, rawEnd } = rawRangeFromNormalizedRange(
      page,
      index,
      index + needle.length,
    );
    ranges.push({
      page: page.page,
      rawCharStart: rawStart,
      rawCharEnd: rawEnd,
      normalizedCharStart: index,
      normalizedCharEnd: index + needle.length,
      matchedText: page.rawText.slice(rawStart, rawEnd),
      source: candidate.source,
      score: candidate.score + needle.length / 100,
    });
    index = page.normalizedText.indexOf(needle, index + Math.max(1, needle.length));
  }
  return ranges;
}

function normalizedIndexForRaw(page: ReconstructedPdfPage, rawIndex: number) {
  const index = page.normalizedToRawMap.findIndex((item) => item >= rawIndex);
  return index < 0 ? page.normalizedToRawMap.length : index;
}

function cleanCandidate(value?: string) {
  return value?.replace(/\.\.\./g, " ").replace(/\s+/g, " ").trim() ?? "";
}

function uniqueCleanTerms(terms: string[]) {
  return [
    ...new Set(
      terms
        .map(cleanCandidate)
        .filter((term) => term.length > 1)
        .sort((a, b) => b.length - a.length),
    ),
  ];
}

function previewForRange(text: string, start: number, end: number) {
  const previewStart = Math.max(0, start - 80);
  const previewEnd = Math.min(text.length, end + 120);
  return `${previewStart ? "..." : ""}${text
    .slice(previewStart, previewEnd)
    .replace(/\s+/g, " ")
    .trim()}${previewEnd < text.length ? "..." : ""}`;
}
