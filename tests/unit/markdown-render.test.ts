import { describe, expect, it } from "vitest";
import { extractHeadings, renderMarkdown } from "@/lib/markdown/render";

describe("markdown rendering", () => {
  it("renders GFM markdown", async () => {
    const html = await renderMarkdown("# Title\n\n| A |\n| - |\n| B |");
    expect(html).toContain("<table>");
  });

  it("extracts headings for rendered Markdown", () => {
    expect(extractHeadings("# A\n\n## B")).toEqual([
      { depth: 1, text: "A", id: "a" },
      { depth: 2, text: "B", id: "b" },
    ]);
  });
});
