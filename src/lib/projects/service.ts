import path from "node:path";
import type { StorageProvider } from "@/lib/storage/types";
import { normalizeStoragePath } from "@/lib/storage/types";
import { createBookMetadata, initialBookFiles, type BookMetadata } from "./templates";

export const BOOKS_ROOT = "data/books";

export function bookRoot(bookId: string) {
  return normalizeStoragePath(path.posix.join(BOOKS_ROOT, bookId));
}

export function bookFilePath(bookId: string, filePath: string) {
  return normalizeStoragePath(path.posix.join(bookRoot(bookId), filePath));
}

export async function listBooks(storage: StorageProvider): Promise<BookMetadata[]> {
  const nodes = await storage.listFiles(BOOKS_ROOT);
  const candidates = nodes.filter((node) => node.kind === "directory");
  const books = await Promise.all(
    candidates.map(async (node) => {
      try {
        return JSON.parse(await storage.readFile(`${node.path}/book.json`)) as BookMetadata;
      } catch {
        return null;
      }
    }),
  );
  return books
    .filter((book): book is BookMetadata => Boolean(book))
    .sort((a, b) => a.title.localeCompare(b.title));
}

export async function createBook(storage: StorageProvider, title: string, language = "pt-BR") {
  const book = createBookMetadata(title, language);
  const files = initialBookFiles(book);
  for (const [filePath, content] of Object.entries(files)) {
    await storage.writeFile(bookFilePath(book.id, filePath), content);
  }
  return book;
}

export async function updateBook(storage: StorageProvider, book: BookMetadata) {
  const next = { ...book, updatedAt: new Date().toISOString() };
  await storage.writeFile(bookFilePath(book.id, "book.json"), JSON.stringify(next, null, 2) + "\n");
  return next;
}

export async function deleteBook(storage: StorageProvider, bookId: string) {
  await storage.deleteFile(bookRoot(bookId));
}

export async function archiveBook(storage: StorageProvider, bookId: string) {
  const book = JSON.parse(await storage.readFile(bookFilePath(bookId, "book.json"))) as BookMetadata;
  return updateBook(storage, { ...book, archived: true });
}
