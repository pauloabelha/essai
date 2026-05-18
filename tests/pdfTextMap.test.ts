import { describe, expect, it } from "vitest";
import {
  boxesForRawRange,
  normalizePdfText,
  rawRangeFromNormalizedRange,
  reconstructPdfPage,
  type PdfTextContentItem,
} from "@/lib/pdf/pdfTextMap";

const viewport = {
  width: 600,
  height: 800,
  scale: 1,
  rotation: 0,
  transform: [1, 0, 0, 1, 0, 0],
};

function item(str: string, x: number, y: number, width = str.length * 10) {
  return {
    str,
    width,
    height: 10,
    transform: [10, 0, 0, 10, x, y],
  } satisfies PdfTextContentItem;
}

describe("pdf text map", () => {
  it("reconstructs simple one-run text", () => {
    const page = reconstructPdfPage({
      page: 1,
      items: [item("machine", 10, 100)],
      viewport,
      fingerprint: "fixture",
    });

    expect(page.rawText).toBe("machine");
    expect(page.normalizedText).toBe("machine");
    expect(page.runs[0]).toMatchObject({
      rawCharStart: 0,
      rawCharEnd: 7,
      normalizedCharStart: 0,
      normalizedCharEnd: 7,
    });
  });

  it("joins multiple runs on one line with spaces when geometry has a word gap", () => {
    const page = reconstructPdfPage({
      page: 1,
      items: [item("tax", 10, 100, 30), item("machine", 55, 100, 70)],
      viewport,
      fingerprint: "fixture",
    });

    expect(page.rawText).toBe("tax machine");
    expect(page.normalizedText).toBe("tax machine");
  });

  it("supports a phrase spanning multiple runs", () => {
    const page = reconstructPdfPage({
      page: 1,
      items: [item("tax", 10, 100, 30), item("machine", 55, 100, 70)],
      viewport,
      fingerprint: "fixture",
    });
    const boxes = boxesForRawRange(page, 0, "tax machine".length, "match");

    expect(boxes).toHaveLength(1);
    expect(boxes[0].width).toBeGreaterThan(100);
  });

  it("collapses whitespace while preserving normalized-to-raw offsets", () => {
    const page = reconstructPdfPage({
      page: 1,
      items: [item("tax   machine", 10, 100, 130)],
      viewport,
      fingerprint: "fixture",
    });

    expect(page.normalizedText).toBe("tax machine");
    const range = rawRangeFromNormalizedRange(page, 4, 11);
    expect(page.rawText.slice(range.rawStart, range.rawEnd)).toBe("machine");
  });

  it("removes soft hyphens during normalization", () => {
    expect(normalizePdfText("ma\u00adchine")).toBe("machine");
  });

  it("normalizes unicode with NFKC", () => {
    expect(normalizePdfText("ﬁ Machine")).toBe("fi machine");
  });

  it("maps partial-run match geometry by character proportion", () => {
    const page = reconstructPdfPage({
      page: 1,
      items: [item("machine", 10, 100, 70)],
      viewport,
      fingerprint: "fixture",
    });
    const boxes = boxesForRawRange(page, 2, 7, "match");

    expect(boxes).toHaveLength(1);
    expect(boxes[0].x).toBeCloseTo(30);
    expect(boxes[0].width).toBeCloseTo(50);
  });

  it("keeps multi-line match geometry as separate boxes", () => {
    const page = reconstructPdfPage({
      page: 1,
      items: [item("tax", 10, 100, 30), item("machine", 10, 120, 70)],
      viewport,
      fingerprint: "fixture",
    });
    const boxes = boxesForRawRange(page, 0, page.rawText.length, "match");

    expect(page.rawText).toBe("tax\nmachine");
    expect(boxes).toHaveLength(2);
  });
});
