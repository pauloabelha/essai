export type PdfTextRun = {
  id: string;
  page: number;
  rawText: string;
  normalizedText: string;
  rawCharStart: number;
  rawCharEnd: number;
  normalizedCharStart: number;
  normalizedCharEnd: number;
  bboxPdf: PdfRect;
  bboxViewport: PdfRect;
  transform: number[];
};

export type ReconstructedPdfPage = {
  page: number;
  rawText: string;
  normalizedText: string;
  runs: PdfTextRun[];
  normalizedToRawMap: number[];
  viewport: {
    width: number;
    height: number;
    scale: number;
    rotation: number;
  };
  fingerprint: string;
};

export type PdfHighlightBox = {
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  matchId: string;
  runId: string;
};

export type PdfRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PdfTextContentItem = {
  str: string;
  transform: number[];
  width: number;
  height: number;
  fontName?: string;
};

export type PdfViewportInfo = {
  width: number;
  height: number;
  scale: number;
  rotation?: number;
  transform: number[];
};

export type ReconstructPdfPageInput = {
  page: number;
  items: PdfTextContentItem[];
  viewport: PdfViewportInfo;
  fingerprint: string;
};

export type NormalizePdfTextOptions = {
  punctuationInsensitive?: boolean;
};

const LINE_Y_TOLERANCE = 3.5;
const WORD_GAP_RATIO = 0.62;

export function reconstructPdfPage({
  page,
  items,
  viewport,
  fingerprint,
}: ReconstructPdfPageInput): ReconstructedPdfPage {
  // Core invariant: highlights are resolved from this canonical raw page text,
  // then mapped back to PDF.js geometry through stable run offsets.
  let rawText = "";
  const pendingRuns: Array<
    Omit<PdfTextRun, "normalizedText" | "normalizedCharStart" | "normalizedCharEnd">
  > = [];
  let previous: { bbox: PdfRect; fontSize: number } | null = null;

  for (const [index, item] of items.entries()) {
    if (!item.str) continue;

    const bboxViewport = viewportBoxForItem(item, viewport);
    const fontSize = Math.max(1, bboxViewport.height);
    const separator = separatorBetween(previous, bboxViewport, fontSize);
    if (separator) {
      rawText += separator;
    }

    const rawCharStart = rawText.length;
    rawText += item.str;
    const rawCharEnd = rawText.length;

    pendingRuns.push({
      id: `${page}:${index}`,
      page,
      rawText: item.str,
      rawCharStart,
      rawCharEnd,
      bboxPdf: pdfBoxForItem(item),
      bboxViewport,
      transform: item.transform,
    });
    previous = { bbox: bboxViewport, fontSize };
  }

  const normalized = normalizeRawText(rawText);
  const runs = pendingRuns.map((run) => {
    const normalizedCharStart = firstNormalizedIndexAtOrAfterRaw(
      normalized.map,
      run.rawCharStart,
    );
    const normalizedCharEnd = firstNormalizedIndexAtOrAfterRaw(
      normalized.map,
      run.rawCharEnd,
    );
    return {
      ...run,
      normalizedText: normalized.text.slice(
        normalizedCharStart,
        normalizedCharEnd,
      ),
      normalizedCharStart,
      normalizedCharEnd,
    };
  });

  return {
    page,
    rawText,
    normalizedText: normalized.text,
    runs,
    normalizedToRawMap: normalized.map,
    viewport: {
      width: viewport.width,
      height: viewport.height,
      scale: viewport.scale,
      rotation: viewport.rotation ?? 0,
    },
    fingerprint,
  };
}

export function normalizePdfText(
  value: string,
  options: NormalizePdfTextOptions = {},
) {
  return normalizeRawText(value, options).text;
}

export function rawRangeFromNormalizedRange(
  page: ReconstructedPdfPage,
  normalizedStart: number,
  normalizedEnd: number,
) {
  const rawStart = page.normalizedToRawMap[normalizedStart] ?? 0;
  const rawEnd =
    (page.normalizedToRawMap[Math.max(normalizedStart, normalizedEnd - 1)] ??
      rawStart) + 1;
  return { rawStart, rawEnd };
}

export function boxesForRawRange(
  page: ReconstructedPdfPage,
  rawStart: number,
  rawEnd: number,
  matchId: string,
): PdfHighlightBox[] {
  // PDF.js does not expose per-character boxes here, so partial run boxes use
  // proportional character width while preserving line-level geometry.
  const boxes = page.runs
    .filter((run) => run.rawCharStart < rawEnd && run.rawCharEnd > rawStart)
    .map((run) => boxForRunIntersection(run, rawStart, rawEnd, matchId))
    .filter((box) => box.width > 0.25 && box.height > 0.25);
  return mergeAdjacentBoxes(boxes);
}

function boxForRunIntersection(
  run: PdfTextRun,
  rawStart: number,
  rawEnd: number,
  matchId: string,
): PdfHighlightBox {
  const startInRun = Math.max(0, rawStart - run.rawCharStart);
  const endInRun = Math.min(run.rawText.length, rawEnd - run.rawCharStart);
  const runLength = Math.max(1, run.rawText.length);
  const startRatio = startInRun / runLength;
  const endRatio = endInRun / runLength;
  const x = run.bboxViewport.x + run.bboxViewport.width * startRatio;
  const width = run.bboxViewport.width * Math.max(0, endRatio - startRatio);

  return {
    page: run.page,
    x,
    y: run.bboxViewport.y,
    width,
    height: run.bboxViewport.height,
    matchId,
    runId: run.id,
  };
}

function mergeAdjacentBoxes(boxes: PdfHighlightBox[]) {
  const sorted = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
  const merged: PdfHighlightBox[] = [];
  for (const box of sorted) {
    const previous = merged.at(-1);
    if (
      previous &&
      previous.page === box.page &&
      previous.matchId === box.matchId &&
      Math.abs(previous.y - box.y) < 2 &&
      Math.abs(previous.height - box.height) < 3 &&
      box.x - (previous.x + previous.width) <=
        Math.max(4, Math.max(previous.height, box.height) * 1.5)
    ) {
      const right = Math.max(previous.x + previous.width, box.x + box.width);
      previous.x = Math.min(previous.x, box.x);
      previous.width = right - previous.x;
      previous.height = Math.max(previous.height, box.height);
    } else {
      merged.push({ ...box });
    }
  }
  return merged;
}

function viewportBoxForItem(
  item: PdfTextContentItem,
  viewport: PdfViewportInfo,
): PdfRect {
  const transform = multiplyTransforms(viewport.transform, item.transform);
  const x = transform[4];
  const fontHeight = Math.max(1, Math.hypot(transform[2], transform[3]));
  return {
    x,
    y: transform[5] - fontHeight,
    width: Math.max(1, item.width * viewport.scale),
    height: Math.max(fontHeight, item.height * viewport.scale || fontHeight),
  };
}

function pdfBoxForItem(item: PdfTextContentItem): PdfRect {
  const fontHeight = Math.max(1, Math.hypot(item.transform[2], item.transform[3]));
  return {
    x: item.transform[4],
    y: item.transform[5],
    width: Math.max(1, item.width),
    height: Math.max(fontHeight, item.height || fontHeight),
  };
}

function separatorBetween(
  previous: { bbox: PdfRect; fontSize: number } | null,
  next: PdfRect,
  nextFontSize: number,
) {
  if (!previous) return "";
  const baselineGap = Math.abs(previous.bbox.y - next.y);
  if (baselineGap > Math.max(LINE_Y_TOLERANCE, nextFontSize * 0.65)) {
    return "\n";
  }
  const horizontalGap = next.x - (previous.bbox.x + previous.bbox.width);
  if (horizontalGap > Math.max(2, nextFontSize * WORD_GAP_RATIO)) return " ";
  return "";
}

function normalizeRawText(
  value: string,
  options: NormalizePdfTextOptions = {},
): { text: string; map: number[] } {
  let text = "";
  const map: number[] = [];
  let pendingWhitespaceRawIndex: number | null = null;

  const flushWhitespace = () => {
    if (pendingWhitespaceRawIndex === null || !text) {
      pendingWhitespaceRawIndex = null;
      return;
    }
    if (!text.endsWith(" ")) {
      text += " ";
      map.push(pendingWhitespaceRawIndex);
    }
    pendingWhitespaceRawIndex = null;
  };

  for (let rawIndex = 0; rawIndex < value.length; rawIndex += 1) {
    const char = value[rawIndex];
    if (char === "\u00ad") continue;
    if (/\s/.test(char)) {
      pendingWhitespaceRawIndex ??= rawIndex;
      continue;
    }
    flushWhitespace();
    for (const normalizedChar of char.normalize("NFKC").toLowerCase()) {
      if (options.punctuationInsensitive && /[^\p{L}\p{N}\s]/u.test(normalizedChar)) {
        continue;
      }
      text += normalizedChar;
      map.push(rawIndex);
    }
  }

  return { text: text.trimEnd(), map: map.slice(0, text.trimEnd().length) };
}

function firstNormalizedIndexAtOrAfterRaw(map: number[], rawIndex: number) {
  const index = map.findIndex((mappedRawIndex) => mappedRawIndex >= rawIndex);
  return index < 0 ? map.length : index;
}

function multiplyTransforms(a: number[], b: number[]) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
