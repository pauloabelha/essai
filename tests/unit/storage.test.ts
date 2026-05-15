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
    await expect(storage.readFile("books/a/index.md")).rejects.toThrow(
      "File not found",
    );
  });

  it("lists, reads, renames, and deletes binary files", async () => {
    const storage = new InMemoryStorageProvider();
    await storage.writeBinaryFile(
      "projects/book/sources/files/paper/source.pdf",
      new Uint8Array([1, 2, 3]),
    );

    const files = await storage.listFiles("projects/book/sources/files");
    expect(JSON.stringify(files)).toContain("source.pdf");
    expect(
      await storage.readBinaryFile(
        "projects/book/sources/files/paper/source.pdf",
      ),
    ).toEqual(new Uint8Array([1, 2, 3]));

    await storage.renameFile(
      "projects/book/sources/files/paper/source.pdf",
      "projects/book/sources/files/book/source.pdf",
    );
    expect(
      await storage.readBinaryFile(
        "projects/book/sources/files/book/source.pdf",
      ),
    ).toEqual(new Uint8Array([1, 2, 3]));

    await storage.deleteFile("projects/book/sources/files/book/source.pdf");
    await expect(
      storage.readBinaryFile("projects/book/sources/files/book/source.pdf"),
    ).rejects.toThrow("File not found");
  });
});
