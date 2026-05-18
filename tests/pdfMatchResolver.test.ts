import { describe, expect, it } from "vitest";
import { resolvePdfMatches } from "@/lib/pdf/pdfMatchResolver";
import { reconstructPdfPage, type PdfTextContentItem } from "@/lib/pdf/pdfTextMap";

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

function page(items: PdfTextContentItem[]) {
  return reconstructPdfPage({
    page: 1,
    items,
    viewport,
    fingerprint: "fixture",
  });
}

describe("pdf match resolver", () => {
  it("resolves a target quote exact match", () => {
    const matches = resolvePdfMatches(page([item("tax machine", 10, 100)]), {
      quote: "tax machine",
      query: "machine",
    });

    expect(matches[0].range).toMatchObject({
      source: "quote",
      matchedText: "tax machine",
    });
  });

  it("resolves a normalized quote match", () => {
    const matches = resolvePdfMatches(page([item("Tax   Machine", 10, 100)]), {
      quote: "tax machine",
    });

    expect(matches[0].range.source).toBe("quote");
    expect(matches[0].range.matchedText).toBe("Tax   Machine");
  });

  it("falls back to query matching", () => {
    const matches = resolvePdfMatches(page([item("the tax machine", 10, 100)]), {
      quote: "absent phrase",
      query: "tax machine",
    });

    expect(matches[0].range.source).toBe("query");
    expect(matches[0].range.matchedText).toBe("tax machine");
  });

  it("falls back to resolved terms", () => {
    const matches = resolvePdfMatches(page([item("Byzantine machine", 10, 100)]), {
      quote: "absent phrase",
      query: "machien",
      terms: ["machine"],
    });

    expect(matches[0].range.source).toBe("term");
    expect(matches[0].range.matchedText).toBe("machine");
  });

  it("prefers a phrase over individual terms", () => {
    const matches = resolvePdfMatches(
      page([item("tax machine and another machine", 10, 100, 300)]),
      {
        query: "tax machine",
        terms: ["tax", "machine"],
      },
    );

    expect(matches).toHaveLength(1);
    expect(matches[0].range.source).toBe("query");
    expect(matches[0].range.matchedText).toBe("tax machine");
  });

  it("does not highlight false terms when phrase and terms are absent", () => {
    const matches = resolvePdfMatches(page([item("taxation mechanism", 10, 100)]), {
      query: "tax machine",
      terms: [],
    });

    expect(matches).toEqual([]);
  });

  it("returns multiple exact occurrences", () => {
    const matches = resolvePdfMatches(
      page([item("machine tax machine", 10, 100, 190)]),
      { terms: ["machine"] },
    );

    expect(matches).toHaveLength(2);
  });

  it("keeps match boxes partial for resolved real typo terms", () => {
    const matches = resolvePdfMatches(page([item("machine", 10, 100, 70)]), {
      query: "machien",
      terms: ["chine"],
    });

    expect(matches[0].range.matchedText).toBe("chine");
    expect(matches[0].boxes[0].x).toBeGreaterThan(10);
  });
});
