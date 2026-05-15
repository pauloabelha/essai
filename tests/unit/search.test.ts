import { describe, expect, it } from "vitest";
import { searchDocuments } from "@/lib/search";

describe("search index", () => {
  it("matches filenames and full text with snippets", () => {
    const results = searchDocuments(
      [
        {
          path: "objects/music-cylinder.md",
          content: "Mechanical memory repeats a performance.",
        },
        { path: "sources/Books.md", content: "Bibliography." },
      ],
      "memory",
    );
    expect(results[0].path).toBe("objects/music-cylinder.md");
    expect(results[0].snippet).toContain("memory");
  });

  it("filters by folder", () => {
    const results = searchDocuments(
      [
        { path: "objects/a.md", content: "loom" },
        { path: "concepts/b.md", content: "loom" },
      ],
      "loom",
      "concepts",
    );
    expect(results.map((result) => result.path)).toEqual(["concepts/b.md"]);
  });
});
