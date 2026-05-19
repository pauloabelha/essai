// @vitest-environment node

import { describe, expect, it } from "vitest";
import { normalizeProvenance } from "@/lib/codex/provenance";

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
    expect(() =>
      normalizeProvenance({ retrievalMethod: "Manual" }),
    ).toThrow(/source path/);
    expect(() =>
      normalizeProvenance({ sourcePath: "sources/raw.md" }),
    ).toThrow(/retrieval method/);
  });
});
