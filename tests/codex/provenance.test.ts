// @vitest-environment node

import { describe, expect, it } from "vitest";
import {
  formatProvenanceMarkdownBlock,
  normalizeProvenance,
} from "@/lib/codex/provenance";

describe("codex provenance", () => {
  it("preserves required source metadata", () => {
    const provenance = normalizeProvenance(
      {
        sourcePath: "sources/files/raw/Hill1993.pdf",
        page: "42",
        quote: "automatic sequence",
        retrievalMethod: "Study Direct Reference",
        originatingQuery: "programmable behavior",
      },
      new Date("2026-05-18T12:00:00Z"),
    );

    expect(provenance).toEqual({
      sourcePath: "sources/files/raw/Hill1993.pdf",
      page: "42",
      quote: "automatic sequence",
      retrievalMethod: "Study Direct Reference",
      timestamp: "2026-05-18T12:00:00.000Z",
      originatingQuery: "programmable behavior",
    });
  });

  it("rejects ungrounded provenance", () => {
    expect(() => normalizeProvenance({ retrievalMethod: "Manual" })).toThrow(
      /source path/,
    );
    expect(() => normalizeProvenance({ sourcePath: "sources/raw.md" })).toThrow(
      /retrieval method/,
    );
  });

  it("formats Study handoff provenance as a readable Markdown block", () => {
    expect(
      formatProvenanceMarkdownBlock(
        {
          sourcePath: "sources/files/raw/Hill1993.pdf",
          page: "42",
          retrievalMethod: "Exact Match",
          originatingQuery: "automatic sequence",
          quote: "automatic sequence",
        },
        new Date("2026-05-19T01:30:00Z"),
      ),
    ).toBe(
      [
        "```essai-provenance",
        "source: sources/files/raw/Hill1993.pdf",
        "page: 42",
        "retrieval: Exact Match",
        "query: automatic sequence",
        "captured: 2026-05-19T01:30:00.000Z",
        "```",
      ].join("\n"),
    );
  });
});
