import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PdfHighlightLayer } from "@/components/study/PdfHighlightLayer";
import type { PdfResolvedMatch } from "@/lib/pdf/pdfMatchResolver";

function match(id: string, x: number, width: number): PdfResolvedMatch {
  return {
    id,
    page: 1,
    previewText: "tax machine",
    range: {
      page: 1,
      rawCharStart: 0,
      rawCharEnd: 3,
      normalizedCharStart: 0,
      normalizedCharEnd: 3,
      matchedText: "tax",
      source: "query",
      score: 1,
    },
    boxes: [
      {
        page: 1,
        x,
        y: 10,
        width,
        height: 12,
        matchId: id,
        runId: `${id}-run`,
      },
    ],
  };
}

describe("PdfHighlightLayer", () => {
  it("renders the correct number of boxes", () => {
    render(
      <PdfHighlightLayer
        page={1}
        pageSize={{ width: 200, height: 300 }}
        matches={[match("a", 10, 20), match("b", 40, 20)]}
      />,
    );

    expect(document.querySelectorAll(".pdf-highlight-box")).toHaveLength(2);
  });

  it("marks active and inactive matches", () => {
    render(
      <PdfHighlightLayer
        page={1}
        pageSize={{ width: 200, height: 300 }}
        matches={[match("a", 10, 20), match("b", 40, 20)]}
        activeMatchId="b"
      />,
    );

    expect(document.querySelectorAll(".pdf-highlight-box.active")).toHaveLength(1);
    expect(document.querySelectorAll(".pdf-highlight-box.inactive")).toHaveLength(1);
  });

  it("updates boxes after scale-sized props change without duplication", () => {
    const { rerender } = render(
      <PdfHighlightLayer
        page={1}
        pageSize={{ width: 200, height: 300 }}
        matches={[match("a", 10, 20)]}
      />,
    );

    rerender(
      <PdfHighlightLayer
        page={1}
        pageSize={{ width: 400, height: 600 }}
        matches={[match("a", 20, 40)]}
      />,
    );

    const boxes = document.querySelectorAll(".pdf-highlight-box");
    expect(boxes).toHaveLength(1);
    expect((boxes[0] as HTMLElement).style.left).toBe("20px");
  });
});
