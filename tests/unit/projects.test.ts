// @vitest-environment node

import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { appendNote, countNoteBlocks } from "@/lib/projects/notes";
import { createBook, listBooks } from "@/lib/projects/service";
import {
  appendSourceFile,
  appendSource,
  parseSourceKind,
} from "@/lib/projects/sources";
import { InMemoryStorageProvider } from "@/lib/storage/in-memory";

describe("project creation", () => {
  it("generates a portable Markdown book directory", async () => {
    const storage = new InMemoryStorageProvider();
    const book = await createBook(storage, "My Book");
    expect(book.id).toBe("my-book");
    expect(book.sections).toEqual([
      {
        id: "main",
        title: "Main",
        path: "main.md",
      },
    ]);
    expect(await storage.readFile("projects/my-book/main.md")).toBe("");
    expect(await storage.readFile("projects/my-book/notes.md")).toContain(
      "Notes",
    );
    const studyIndex = JSON.parse(
      await storage.readFile("projects/my-book/sources/.study-index.json"),
    ) as { version: number; documents: unknown[]; chunks: unknown[] };
    expect(studyIndex).toMatchObject({
      version: 3,
      documents: expect.any(Array),
      chunks: expect.any(Array),
    });
    expect(await listBooks(storage)).toHaveLength(1);
  });

  it("lists the most recently edited project first", async () => {
    const storage = new InMemoryStorageProvider();
    await createBook(storage, "First");
    await createBook(storage, "Second");
    const first = JSON.parse(
      await storage.readFile("projects/first/book.json"),
    );
    const second = JSON.parse(
      await storage.readFile("projects/second/book.json"),
    );
    await storage.writeFile(
      "projects/first/book.json",
      JSON.stringify({ ...first, updatedAt: "2026-05-14T22:00:00.000Z" }),
    );
    await storage.writeFile(
      "projects/second/book.json",
      JSON.stringify({ ...second, updatedAt: "2026-05-14T21:00:00.000Z" }),
    );
    expect((await listBooks(storage))[0].id).toBe("first");
  });

  it("creates notes.md when appending a note", async () => {
    const storage = new InMemoryStorageProvider();
    await createBook(storage, "My Book");
    await storage.deleteFile("projects/my-book/notes.md");
    const result = await appendNote(
      storage,
      "my-book",
      "A note for later.",
      new Date("2026-05-14T21:30:00Z"),
    );
    expect(result.path).toBe("notes.md");
    expect(await storage.readFile("projects/my-book/notes.md")).toContain(
      "A note for later.",
    );
    expect(countNoteBlocks(result.content)).toBe(1);
  });

  it("records source provenance when appending a source note", async () => {
    const storage = new InMemoryStorageProvider();
    await createBook(storage, "My Book");
    const result = await appendNote(
      storage,
      "my-book",
      "Selected passage.",
      new Date("2026-05-14T21:30:00Z"),
      {
        path: "sources/raw.md",
        title: "raw.md",
        quote: "Selected passage.",
      },
    );

    expect(result.content).toContain("Source: sources/raw.md");
    expect(result.content).toContain("Source title: raw.md");
    expect(result.content).toContain("Source quote: Selected passage.");
    expect(result.content).toContain("Selected passage.");
    expect(
      await storage.readFile("projects/my-book/sources/.study-index.json"),
    ).toContain("Selected passage.");
  });

  it("preserves older inbox files while writing notes.md", async () => {
    const storage = new InMemoryStorageProvider({
      "projects/old-book/book.json": JSON.stringify({
        id: "old-book",
        title: "Old Book",
        subtitle: "",
        language: "pt-BR",
        createdAt: "",
        updatedAt: "",
      }),
      "projects/old-book/inbox/random-thoughts.md":
        "# Random thoughts\n\nKeep me.\n",
    });
    await appendNote(storage, "old-book", "New capture.");
    expect(
      await storage.readFile("projects/old-book/inbox/random-thoughts.md"),
    ).toContain("Keep me.");
    expect(await storage.readFile("projects/old-book/notes.md")).toContain(
      "New capture.",
    );
  });

  it("appends sources to raw and mirrors typed sources", async () => {
    const storage = new InMemoryStorageProvider();
    await createBook(storage, "My Book");
    await appendSource(
      storage,
      "my-book",
      "https://example.com/paper",
      "paper",
      new Date("2026-05-14T21:30:00Z"),
    );
    expect(await storage.readFile("projects/my-book/sources/raw.md")).toContain(
      "https://example.com/paper",
    );
    expect(
      await storage.readFile("projects/my-book/sources/Papers.md"),
    ).toContain("Type: paper");
    expect(
      await storage.readFile("projects/my-book/sources/.study-index.json"),
    ).toContain("https://example.com/paper");
  });

  it("stores uploaded source files and indexes extracted text", async () => {
    const storage = new InMemoryStorageProvider();
    await createBook(storage, "My Book");
    const result = await appendSourceFile(
      storage,
      "my-book",
      {
        name: "Important Notes.txt",
        bytes: new TextEncoder().encode(
          "Source text about programmable machines.",
        ),
      },
      "paper",
      new Date("2026-05-14T21:30:00Z"),
    );

    const expectedPath =
      "sources/files/paper/20260514-213000-Important-Notes-0a6c1577744b.txt";
    expect(result.filePath).toBe(expectedPath);
    expect(
      await storage.readBinaryFile?.(`projects/my-book/${expectedPath}`),
    ).toEqual(
      new TextEncoder().encode("Source text about programmable machines."),
    );
    expect(await storage.readFile("projects/my-book/sources/raw.md")).toContain(
      "[Important Notes.txt](files/paper/20260514-213000-Important-Notes-0a6c1577744b.txt)",
    );
    expect(
      await storage.readFile("projects/my-book/sources/Papers.md"),
    ).toContain("Uploaded source file.");
    const index = JSON.parse(
      await storage.readFile("projects/my-book/sources/.study-index.json"),
    ) as {
      version: number;
      documents: Array<{
        path: string;
        kind: string;
        searchText: string;
        metadata: Record<string, unknown>;
      }>;
      chunks: Array<{ documentId: string; text: string }>;
    };
    const uploadDocument = index.documents.find(
      (document) => document.path === result.filePath,
    );
    expect(index.version).toBe(3);
    expect(uploadDocument).toMatchObject({
      kind: "upload",
      searchText: "Source text about programmable machines.",
      metadata: { extractedText: true, extraction: "utf8-text" },
    });
    expect(
      index.chunks.some((chunk) =>
        chunk.text.includes("programmable machines"),
      ),
    ).toBe(true);
  });

  it("extracts uploaded PDF text into page-aware Study chunks", async () => {
    const storage = new InMemoryStorageProvider();
    await createBook(storage, "My Book");
    const pdfBytes = await readFile(
      "node_modules/pdf-parse/test/data/04-valid.pdf",
    );
    const result = await appendSourceFile(
      storage,
      "my-book",
      {
        name: "exercise-study.pdf",
        bytes: pdfBytes,
      },
      "paper",
      new Date("2026-05-14T21:30:00Z"),
    );

    const index = JSON.parse(
      await storage.readFile("projects/my-book/sources/.study-index.json"),
    ) as {
      version: number;
      documents: Array<{
        path: string;
        searchText: string;
        metadata: Record<string, unknown>;
      }>;
      chunks: Array<{ path: string; page: string; text: string }>;
    };
    const uploadDocument = index.documents.find(
      (document) => document.path === result.filePath,
    );

    expect(index.version).toBe(3);
    expect(uploadDocument).toMatchObject({
      metadata: { extractedText: true, extraction: "pdf-text", pages: 5 },
    });
    expect(uploadDocument?.searchText).toContain("nitric oxide");
    expect(
      index.chunks.some(
        (chunk) =>
          chunk.path === result.filePath &&
          chunk.page === "1" &&
          chunk.text.includes("nitric oxide"),
      ),
    ).toBe(true);
  });

  it("does not overwrite existing uploads with the same name and timestamp", async () => {
    const storage = new InMemoryStorageProvider();
    await createBook(storage, "My Book");
    const date = new Date("2026-05-14T21:30:00Z");
    const first = await appendSourceFile(
      storage,
      "my-book",
      {
        name: "Important Notes.txt",
        bytes: new TextEncoder().encode(
          "Source text about programmable machines.",
        ),
      },
      "raw",
      date,
    );
    const duplicate = await appendSourceFile(
      storage,
      "my-book",
      {
        name: "Important Notes.txt",
        bytes: new TextEncoder().encode(
          "Source text about programmable machines.",
        ),
      },
      "raw",
      date,
    );
    const different = await appendSourceFile(
      storage,
      "my-book",
      {
        name: "Important Notes.txt",
        bytes: new TextEncoder().encode("Different source text."),
      },
      "raw",
      date,
    );

    expect(duplicate.filePath).toBe(first.filePath);
    expect(different.filePath).toBe(
      "sources/files/raw/20260514-213000-Important-Notes-7b7ad398afeb.txt",
    );
    expect(
      await storage.readBinaryFile?.(`projects/my-book/${first.filePath}`),
    ).toEqual(
      new TextEncoder().encode("Source text about programmable machines."),
    );
    expect(
      await storage.readBinaryFile?.(`projects/my-book/${different.filePath}`),
    ).toEqual(new TextEncoder().encode("Different source text."));
  });

  it("rejects empty source file uploads before indexing them", async () => {
    const storage = new InMemoryStorageProvider();
    await createBook(storage, "My Book");

    await expect(
      appendSourceFile(
        storage,
        "my-book",
        {
          name: "empty.txt",
          bytes: new Uint8Array(),
        },
        "paper",
      ),
    ).rejects.toThrow("Source file is empty");

    expect(
      await storage.readFile("projects/my-book/sources/raw.md"),
    ).not.toContain("empty.txt");
  });

  it("falls back to raw for unknown source kinds", () => {
    expect(parseSourceKind("book")).toBe("book");
    expect(parseSourceKind("archive")).toBe("raw");
    expect(parseSourceKind(null)).toBe("raw");
  });
});
