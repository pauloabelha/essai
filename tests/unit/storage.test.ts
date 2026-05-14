import { describe, expect, it } from "vitest";
import { InMemoryStorageProvider } from "@/lib/storage/in-memory";

describe("storage providers", () => {
  it("creates, reads, writes, renames, and deletes files", async () => {
    const storage = new InMemoryStorageProvider();
    await storage.createFile("books/a/README.md", "hello");
    expect(await storage.readFile("books/a/README.md")).toBe("hello");
    await storage.writeFile("books/a/README.md", "world");
    await storage.renameFile("books/a/README.md", "books/a/index.md");
    expect(await storage.readFile("books/a/index.md")).toBe("world");
    await storage.deleteFile("books/a/index.md");
    await expect(storage.readFile("books/a/index.md")).rejects.toThrow("File not found");
  });
});
