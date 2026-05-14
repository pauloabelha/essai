import { describe, expect, it } from "vitest";
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
    expect(await listBooks(storage)).toHaveLength(1);
  });
});
