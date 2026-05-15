import { describe, expect, it } from "vitest";
import { InMemoryStorageProvider } from "@/lib/storage/in-memory";
import { buildStudyInvestigation } from "@/lib/study/archive";

describe("study archive", () => {
  it("builds a provenance-first concept investigation from sources", async () => {
    const storage = new InMemoryStorageProvider({
      "projects/book/book.json": "{}",
      "projects/book/sources/Books.md": `# Books

## 2026-05-15 10:00

Type: book

The Jacquard loom encoded repeatable symbolic instructions for patterned weaving. p. 211

---
`,
      "projects/book/sources/Claims.md": `# Claims

- [ ] Programmable machines precede electronic computation.
`,
      "projects/book/objects/jacquard-loom.md": `# Jacquard loom

An object note for patterned instruction.
`,
    });

    const study = await buildStudyInvestigation(storage, "book", {
      query: "programmable machines",
      exhaustive: true,
    });

    expect(study.sourceCoverage.sources).toBe(2);
    expect(study.directReferences[0]).toMatchObject({
      sourceFile: "sources/Books.md",
      sourceType: "book",
      page: "211",
    });
    expect(study.claims[0].sourceFile).toBe("sources/Claims.md");
    expect(study.relatedObjects[0].path).toBe("objects/jacquard-loom.md");
    expect(study.graph.nodes.some((node) => node.kind === "source")).toBe(true);
  });
});
