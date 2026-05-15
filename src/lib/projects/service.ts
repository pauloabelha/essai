import path from "node:path";
import { renderMarkdown } from "@/lib/markdown/render";
import type { StorageProvider } from "@/lib/storage/types";
import { normalizeStoragePath } from "@/lib/storage/types";
import {
  createBookMetadata,
  initialBookFiles,
  type BookMetadata,
} from "./templates";

export const BOOKS_ROOT = "projects";

export function bookRoot(bookId: string) {
  return normalizeStoragePath(path.posix.join(BOOKS_ROOT, bookId));
}

export function bookFilePath(bookId: string, filePath: string) {
  return normalizeStoragePath(path.posix.join(bookRoot(bookId), filePath));
}

export async function listBooks(
  storage: StorageProvider,
): Promise<BookMetadata[]> {
  const nodes = await storage.listFiles(BOOKS_ROOT);
  const candidates = nodes.filter((node) => node.kind === "directory");
  const books = await Promise.all(
    candidates.map(async (node) => {
      try {
        return JSON.parse(
          await storage.readFile(`${node.path}/book.json`),
        ) as BookMetadata;
      } catch {
        return null;
      }
    }),
  );
  return books
    .filter((book): book is BookMetadata => Boolean(book))
    .sort((a, b) => timestamp(b) - timestamp(a));
}

export interface ProjectPreview {
  book: BookMetadata;
  excerptMarkdown: string;
  excerptHtml: string;
  fileCount: number;
}

export async function listProjectPreviews(
  storage: StorageProvider,
): Promise<ProjectPreview[]> {
  const books = await listBooks(storage);
  return Promise.all(
    books.map(async (book) => {
      const excerptMarkdown = await readProjectExcerpt(storage, book.id);
      const nodes = await storage.listFiles(bookRoot(book.id));
      return {
        book,
        excerptMarkdown,
        excerptHtml: await renderMarkdown(
          excerptMarkdown || "_No manuscript text yet._",
        ),
        fileCount: countFiles(nodes),
      };
    }),
  );
}

async function readProjectExcerpt(storage: StorageProvider, bookId: string) {
  try {
    const manuscript = await storage.readFile(bookFilePath(bookId, "main.md"));
    return truncateMarkdown(manuscript);
  } catch {
    return "";
  }
}

function truncateMarkdown(markdown: string, limit = 900) {
  const clean = markdown.trim();
  if (clean.length <= limit) return clean;
  return `${clean.slice(0, limit).trimEnd()}...`;
}

function countFiles(
  nodes: Awaited<ReturnType<StorageProvider["listFiles"]>>,
): number {
  return nodes.reduce((total, node) => {
    if (node.kind === "file") return total + 1;
    return total + countFiles(node.children ?? []);
  }, 0);
}

function timestamp(book: BookMetadata) {
  const value = Date.parse(book.updatedAt || book.createdAt);
  return Number.isFinite(value) ? value : 0;
}

export async function createBook(
  storage: StorageProvider,
  title: string,
  language = "pt-BR",
) {
  const book = createBookMetadata(title, language);
  const files = initialBookFiles(book);
  for (const [filePath, content] of Object.entries(files)) {
    await storage.writeFile(bookFilePath(book.id, filePath), content);
  }
  return book;
}

export async function updateBook(storage: StorageProvider, book: BookMetadata) {
  const next = { ...book, updatedAt: new Date().toISOString() };
  await storage.writeFile(
    bookFilePath(book.id, "book.json"),
    JSON.stringify(next, null, 2) + "\n",
  );
  return next;
}

export async function touchBook(storage: StorageProvider, bookId: string) {
  try {
    const book = JSON.parse(
      await storage.readFile(bookFilePath(bookId, "book.json")),
    ) as BookMetadata;
    await updateBook(storage, book);
  } catch {
    // Older or partial project folders may not have metadata yet.
  }
}

export async function deleteBook(storage: StorageProvider, bookId: string) {
  await storage.deleteFile(bookRoot(bookId));
}

export async function archiveBook(storage: StorageProvider, bookId: string) {
  const book = JSON.parse(
    await storage.readFile(bookFilePath(bookId, "book.json")),
  ) as BookMetadata;
  return updateBook(storage, { ...book, archived: true });
}
