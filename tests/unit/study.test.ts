import { describe, expect, it } from "vitest";
import { createBook } from "@/lib/projects/service";
import { appendSourceFile } from "@/lib/projects/sources";
import { appendNote } from "@/lib/projects/notes";
import { InMemoryStorageProvider } from "@/lib/storage/in-memory";
import { buildStudyInvestigation } from "@/lib/study/archive";

describe("study archive", () => {
  it("builds a provenance-first concept investigation from sources", async () => {
    const storage = new InMemoryStorageProvider({
      "projects/book/book.json": "{}",
      "projects/book/sources/Books.md": `# Books

## 2026-05-15 10:00

Type: book

Programmable machines appear in the Jacquard loom's encoded repeatable symbolic instructions for patterned weaving. p. 211

---
`,
      "projects/book/sources/Claims.md": `# Claims

- [ ] Programmable machines precede electronic computation.
`,
      "projects/book/objects/jacquard-loom.md": `# Jacquard loom

An object note for patterned instruction.
Programmable machines belong in this object history.
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

  it("finds misspelled source queries with fuzzy ranked matches", async () => {
    const storage = new InMemoryStorageProvider({
      "projects/book/book.json": "{}",
      "projects/book/sources/Articles.md": `# Articles

Koetsier, T., 2001. On the prehistory of programmable machines: musical automata, looms, calculators. Mechanism and Machine theory, 36(5), pp.589-603.
`,
    });

    const study = await buildStudyInvestigation(storage, "book", {
      query: "machien",
      exhaustive: true,
    });

    expect(study.directReferences[0]).toMatchObject({
      sourceFile: "sources/Articles.md",
      retrievalMethod: "Lexical Match",
    });
    expect(study.directReferences[0].quote).toContain("Machine theory");
  });

  it("deduplicates adjacent PDF chunks from the same uploaded page", async () => {
    const storage = new InMemoryStorageProvider({
      "projects/book/book.json": "{}",
      "projects/book/sources/.study-index.json": JSON.stringify({
        version: 3,
        updatedAt: "2026-05-18T00:00:00.000Z",
        documents: [
          {
            id: "pdf",
            path: "sources/files/book/sample.pdf",
            title: "sample.pdf",
            kind: "upload",
            sourceType: "book",
            mimeType: "application/pdf",
            sizeBytes: 1,
            searchText: "automatic automatic",
            metadata: { kind: "upload", extraction: "pdf-text" },
          },
        ],
        chunks: [
          {
            id: "pdf:chunk:1",
            documentId: "pdf",
            chunkIndex: 1,
            path: "sources/files/book/sample.pdf",
            sourceType: "book",
            page: "295",
            text: "The movement was automatic near the boundary.",
            metadata: { kind: "upload", title: "sample.pdf" },
          },
          {
            id: "pdf:chunk:2",
            documentId: "pdf",
            chunkIndex: 2,
            path: "sources/files/book/sample.pdf",
            sourceType: "book",
            page: "295",
            text: "automatic exclusion appeared in the adjacent chunk.",
            metadata: { kind: "upload", title: "sample.pdf" },
          },
        ],
      }),
      "projects/book/sources/files/book/sample.pdf": "%PDF",
    });

    const study = await buildStudyInvestigation(storage, "book", {
      query: "automat",
    });

    expect(study.directReferences).toHaveLength(1);
    expect(study.directReferences[0]).toMatchObject({
      sourceFile: "sources/files/book/sample.pdf",
      page: "295",
    });
  });

  it("limits retrieval to a selected uploaded source file", async () => {
    const storage = new InMemoryStorageProvider();
    await createBook(storage, "Book");
    const upload = await appendSourceFile(
      storage,
      "book",
      {
        name: "machine-notes.txt",
        bytes: new TextEncoder().encode(
          "Programmable machines appear in the uploaded source.",
        ),
      },
      "raw",
      new Date("2026-05-15T10:00:00Z"),
    );

    const study = await buildStudyInvestigation(storage, "book", {
      query: "programmable machines",
      sourcePaths: [upload.filePath],
    });

    expect(study.directReferences[0].sourceFile).toBe(upload.filePath);
    expect(study.sourceCoverage.files).toBe(1);
  });

  it("does not return metadata-only upload passages for unrelated source searches", async () => {
    const storage = new InMemoryStorageProvider();
    await createBook(storage, "Book");
    const upload = await appendSourceFile(
      storage,
      "book",
      {
        name: "history.pdf",
        bytes: new TextEncoder().encode("%PDF fake bytes"),
      },
      "book",
      new Date("2026-05-15T10:00:00Z"),
    );

    const study = await buildStudyInvestigation(storage, "book", {
      query: "flute",
      sourcePaths: [upload.filePath],
    });

    expect(study.directReferences).toEqual([]);
  });

  it("indexes notes taken in the context of a selected source", async () => {
    const storage = new InMemoryStorageProvider();
    await createBook(storage, "Book");
    const upload = await appendSourceFile(
      storage,
      "book",
      {
        name: "machine-notes.txt",
        bytes: new TextEncoder().encode("Programmable machines."),
      },
      "raw",
      new Date("2026-05-15T10:00:00Z"),
    );
    await appendNote(
      storage,
      "book",
      "This source frames programmable machines as portable behavior.",
      new Date("2026-05-15T10:05:00Z"),
      {
        path: upload.filePath,
        title: "machine-notes.txt",
      },
    );

    const study = await buildStudyInvestigation(storage, "book", {
      query: "portable behavior",
      sourcePaths: [upload.filePath],
    });

    expect(study.directReferences).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceFile: upload.filePath,
          sourceType: "note",
        }),
      ]),
    );
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
