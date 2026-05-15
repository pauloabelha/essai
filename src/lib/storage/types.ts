export type FileKind = "file" | "directory";

export interface FileNode {
  name: string;
  path: string;
  kind: FileKind;
  children?: FileNode[];
}

export interface StorageProvider {
  listFiles(root?: string): Promise<FileNode[]>;
  readFile(path: string): Promise<string>;
  readBinaryFile?(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: string): Promise<void>;
  writeBinaryFile?(path: string, content: Uint8Array): Promise<void>;
  createFile(path: string, content?: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  renameFile(oldPath: string, newPath: string): Promise<void>;
}

export function normalizeStoragePath(path: string) {
  return path
    .replaceAll("\\", "/")
    .replace(/^\/+/, "")
    .split("/")
    .filter((part) => part && part !== ".")
    .join("/");
}
