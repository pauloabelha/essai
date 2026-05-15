import { describe, expect, it } from "vitest";
import {
  analyzeLinks,
  parseWikiLinks,
  resolveWikiTarget,
} from "@/lib/markdown/wiki";

describe("wiki links", () => {
  it("parses wiki links with aliases", () => {
    expect(
      parseWikiLinks(
        "See [[music-cylinder|the cylinder]] and [[jacquard-loom]].",
      ),
    ).toEqual([
      {
        raw: "[[music-cylinder|the cylinder]]",
        target: "music-cylinder",
        alias: "the cylinder",
        index: 4,
      },
      {
        raw: "[[jacquard-loom]]",
        target: "jacquard-loom",
        alias: undefined,
        index: 40,
      },
    ]);
  });

  it("resolves links by file stem", () => {
    expect(
      resolveWikiTarget("music-cylinder", ["objects/music-cylinder.md"]),
    ).toBe("objects/music-cylinder.md");
  });

  it("detects backlinks and broken links", () => {
    const analysis = analyzeLinks("concepts/a.md", "[[missing]]", [
      { path: "concepts/a.md", content: "[[missing]]" },
      { path: "concepts/b.md", content: "See [[a]]." },
    ]);
    expect(analysis.backlinks).toHaveLength(1);
    expect(analysis.broken.map((link) => link.target)).toEqual(["missing"]);
  });
});
