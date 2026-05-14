import { bookFilePath, bookRoot } from "@/lib/projects/service";
import type { StorageProvider } from "@/lib/storage/types";
import { flattenFiles } from "@/lib/markdown/wiki";

export async function listBookFiles(storage: StorageProvider, bookId: string) {
  const nodes = await storage.listFiles(bookRoot(bookId));
  return nodes;
}

export async function readBookFile(storage: StorageProvider, bookId: string, path: string) {
  return storage.readFile(bookFilePath(bookId, path));
}

export async function writeBookFile(
  storage: StorageProvider,
  bookId: string,
  path: string,
  content: string,
) {
  return storage.writeFile(bookFilePath(bookId, path), content);
}

export async function createBookFile(
  storage: StorageProvider,
  bookId: string,
  path: string,
  content = "",
) {
  return storage.createFile(bookFilePath(bookId, path), content);
}

export async function deleteBookFile(storage: StorageProvider, bookId: string, path: string) {
  return storage.deleteFile(bookFilePath(bookId, path));
}

export async function renameBookFile(
  storage: StorageProvider,
  bookId: string,
  oldPath: string,
  newPath: string,
) {
  return storage.renameFile(bookFilePath(bookId, oldPath), bookFilePath(bookId, newPath));
}

export async function readAllMarkdownFiles(storage: StorageProvider, bookId: string) {
  const nodes = await listBookFiles(storage, bookId);
  const files = flattenFiles(nodes)
    .filter((node) => node.kind === "file" && node.path.endsWith(".md"))
    .map((node) => node.path.replace(`${bookRoot(bookId)}/`, ""));
  return Promise.all(
    files.map(async (path) => ({
      path,
      content: await readBookFile(storage, bookId, path),
    })),
  );
}
