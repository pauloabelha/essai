import { describe, expect, it } from "vitest";
import { appendQuickThought, countThoughtBlocks } from "@/lib/projects/current-notes";
import { createBook, listBooks } from "@/lib/projects/service";
import { InMemoryStorageProvider } from "@/lib/storage/in-memory";

describe("project creation", () => {
  it("generates a portable Markdown book directory", async () => {
    const storage = new InMemoryStorageProvider();
    const book = await createBook(storage, "My Book");
    expect(book.id).toBe("my-book");
    expect(await storage.readFile("data/books/my-book/manuscript/main.md")).toContain(
      "Every word in this manuscript",
    );
    expect(await storage.readFile("data/books/my-book/inbox/current-notes.md")).toContain(
      "Current Notes",
    );
    expect(await listBooks(storage)).toHaveLength(1);
  });

  it("creates current-notes.md when appending a quick thought", async () => {
    const storage = new InMemoryStorageProvider();
    await createBook(storage, "My Book");
    await storage.deleteFile("data/books/my-book/inbox/current-notes.md");
    const result = await appendQuickThought(
      storage,
      "my-book",
      "A thought for later.",
      new Date("2026-05-14T21:30:00Z"),
    );
    expect(result.path).toBe("inbox/current-notes.md");
    expect(await storage.readFile("data/books/my-book/inbox/current-notes.md")).toContain(
      "A thought for later.",
    );
    expect(countThoughtBlocks(result.content)).toBe(1);
  });

  it("preserves older random-thoughts.md files", async () => {
    const storage = new InMemoryStorageProvider({
      "data/books/old-book/book.json": JSON.stringify({
        id: "old-book",
        title: "Old Book",
        subtitle: "",
        language: "pt-BR",
        createdAt: "",
        updatedAt: "",
      }),
      "data/books/old-book/inbox/random-thoughts.md": "# Random thoughts\n\nKeep me.\n",
    });
    await appendQuickThought(storage, "old-book", "New capture.");
    expect(await storage.readFile("data/books/old-book/inbox/random-thoughts.md")).toContain(
      "Keep me.",
    );
    expect(await storage.readFile("data/books/old-book/inbox/current-notes.md")).toContain(
      "New capture.",
    );
  });
});
