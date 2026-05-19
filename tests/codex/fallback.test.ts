// @vitest-environment node

import { describe, expect, it } from "vitest";
import { buildCodexFallbackResponse } from "@/lib/codex/fallback";
import type { StudyInvestigation } from "@/lib/study/archive";

describe("codex fallback responses", () => {
  it("builds a workspace memo for timed-out accuracy magic", () => {
    const result = buildCodexFallbackResponse({
      message: [
        "Codex magic action: Check accuracy.",
        "",
        "Selected manuscript sections:",
        "- flauta-programavel.md",
      ].join("\n"),
      study: fixtureStudy(),
      error: "Codex app-server turn timed out.",
    });

    expect(result?.output).toContain("local accuracy fallback memo");
    expect(result?.workspaceAppend).toContain("## Codex accuracy fallback");
    expect(result?.workspaceAppend).toContain("flauta-programavel.md");
    expect(result?.workspaceAppend).toContain("sources/raw.md p. 1");
  });

  it("does not replace normal Codex chat failures", () => {
    const result = buildCodexFallbackResponse({
      message: "Tell me something about the project.",
      study: fixtureStudy(),
      error: "Codex app-server turn timed out.",
    });

    expect(result).toBeNull();
  });

  it("builds prose fallback without source-study evidence", () => {
    const result = buildCodexFallbackResponse({
      message: [
        "Codex magic action: Check prose.",
        "",
        "Selected manuscript sections:",
        "- flauta-programavel.md",
      ].join("\n"),
      study: null,
      manuscriptContext: "## flauta-programavel.md\n\nA draft paragraph.",
      error: "Codex app-server turn timed out.",
    });

    expect(result?.output).toContain("local prose fallback memo");
    expect(result?.output).toContain("No source-evidence search was run");
    expect(result?.workspaceAppend).toContain("Grammar and syntax");
    expect(result?.workspaceAppend).toContain("A draft paragraph.");
  });
});

function fixtureStudy(): StudyInvestigation {
  return {
    query: "programmable flute",
    title: "programmable flute",
    summary: "",
    relatedConcepts: [],
    sourceCoverage: {
      sources: 1,
      chunks: 3,
      files: 1,
      matches: 2,
      exactMatches: 1,
      lexicalMatches: 1,
      semanticMatches: 0,
      scope: "all sources",
    },
    directReferences: [
      {
        id: "ref-1",
        quote: "A useful source passage.",
        matchTerms: [],
        resolvedTerms: [],
        expandedTerms: [],
        exactPhraseCandidate: null,
        query: "programmable flute",
        sourceFile: "sources/raw.md",
        sourceType: "raw",
        page: "1",
        confidence: "High",
        retrievalMethod: "Exact Match",
      },
    ],
    conceptualEchoes: [],
    claims: [],
    relatedObjects: [],
    selectedSource: null,
    graph: {
      nodes: [],
      links: [],
    },
    auditLog: [],
  };
}
