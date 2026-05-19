// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  chapterExists,
  flattenManuscriptSections,
  normalizeChapterLinks,
} from "@/lib/codex/manuscriptLinks";

describe("codex manuscript links", () => {
  const sections = [
    {
      id: "history",
      title: "History",
      path: "chapters/history.md",
      children: [
        {
          id: "automation",
          title: "Automation",
          path: "chapters/automation.md",
        },
      ],
    },
  ];

  it("flattens and resolves chapter links", () => {
    expect(flattenManuscriptSections(sections)).toHaveLength(2);
    expect(chapterExists(sections, "chapters/automation.md")).toBe(true);
    expect(chapterExists(sections, "chapters/missing.md")).toBe(false);
  });

  it("prevents duplicate chapter links", () => {
    expect(
      normalizeChapterLinks(["chapters/automation.md", "chapters/automation.md"]),
    ).toEqual(["chapters/automation.md"]);
  });
});
