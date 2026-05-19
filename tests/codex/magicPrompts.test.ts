// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildCodexMagicPrompt } from "@/lib/codex/magic-prompts";

describe("codex magic prompts", () => {
  it("builds source search prompts with selected source scope", () => {
    const prompt = buildCodexMagicPrompt("search-sources", {
      query: "programmable flute",
      sources: ["sources/raw.md", "sources/files/raw/al-jazari.pdf"],
    });

    expect(prompt).toContain("Codex magic action: Search in sources.");
    expect(prompt).toContain("Search query: programmable flute");
    expect(prompt).toContain("- sources/raw.md");
    expect(prompt).toContain("Do not edit manuscript files.");
  });

  it("builds accuracy prompts around manuscript sections without rewrite permission", () => {
    const prompt = buildCodexMagicPrompt("check-accuracy", {
      sections: ["main.md", "chapters/history.md"],
    });

    expect(prompt).toContain("Codex magic action: Check accuracy.");
    expect(prompt).toContain("Claims needing evidence");
    expect(prompt).toContain("- main.md");
    expect(prompt).toContain("Do not rewrite manuscript prose.");
  });

  it("builds prose prompts as diagnosis rather than manuscript edits", () => {
    const prompt = buildCodexMagicPrompt("check-prose", {
      sections: ["main.md"],
    });

    expect(prompt).toContain("Codex magic action: Check prose.");
    expect(prompt).toContain("Do not rewrite the manuscript.");
    expect(prompt).toContain("High-level prose diagnosis");
    expect(prompt).toContain("- main.md");
  });
});
