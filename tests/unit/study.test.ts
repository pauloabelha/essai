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

  it("deduplicates graph links when several passages come from one source", async () => {
    const storage = new InMemoryStorageProvider({
      "projects/book/book.json": "{}",
      "projects/book/sources/Articles.md": `# Articles

## 2026-05-15 10:00

Type: article

Programmable automata encode instructions.

---

## 2026-05-15 11:00

Type: article

Programmable machinery stores repeatable instructions.

---
`,
    });

    const study = await buildStudyInvestigation(storage, "book", {
      query: "programmable machines",
      exhaustive: true,
    });
    const linkKeys = study.graph.links.map((link) => `${link.from}-${link.to}`);

    expect(new Set(linkKeys).size).toBe(linkKeys.length);
  });

  it("limits retrieval to selected source indexes", async () => {
    const storage = new InMemoryStorageProvider({
      "projects/book/book.json": "{}",
      "projects/book/sources/Books.md": `# Books

Programmable machines appear in the book index.
`,
      "projects/book/sources/Papers.md": `# Papers

Programmable machines appear in the paper index.
`,
    });

    const study = await buildStudyInvestigation(storage, "book", {
      query: "programmable machines",
      sourcePaths: ["sources/Papers.md"],
    });

    expect(study.sourceCoverage.sources).toBe(1);
    expect(
      study.directReferences.every(
        (passage) => passage.sourceFile === "sources/Papers.md",
      ),
    ).toBe(true);
  });

  it("refreshes the Study index when missing", async () => {
    const storage = new InMemoryStorageProvider({
      "projects/book/book.json": "{}",
      "projects/book/sources/Books.md": `# Books

Programmable machines appear in the book index.
`,
    });

    await buildStudyInvestigation(storage, "book", {
      query: "programmable machines",
    });

    expect(
      await storage.readFile("projects/book/sources/.study-index.json"),
    ).toContain("Programmable machines");
  });
});
