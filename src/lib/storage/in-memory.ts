import type { FileNode, StorageProvider } from "./types";
import { normalizeStoragePath } from "./types";

export class InMemoryStorageProvider implements StorageProvider {
  private files = new Map<string, string>();

  constructor(seed: Record<string, string> = {}) {
    Object.entries(seed).forEach(([path, content]) => {
      this.files.set(normalizeStoragePath(path), content);
    });
  }

  async listFiles(root = ""): Promise<FileNode[]> {
    const prefix = normalizeStoragePath(root);
    const directories = new Set<string>();
    const filePaths = [...this.files.keys()].filter(
      (filePath) => !prefix || filePath === prefix || filePath.startsWith(prefix + "/"),
    );

    for (const filePath of filePaths) {
      const parts = filePath.split("/");
      for (let index = 1; index < parts.length; index++) {
        const directory = parts.slice(0, index).join("/");
        if (!prefix || directory === prefix || directory.startsWith(prefix + "/")) {
          directories.add(directory);
        }
      }
    }

    const makeChildren = (parent: string): FileNode[] => {
      const childDirectories = [...directories]
        .filter((directory) => directory.split("/").slice(0, -1).join("/") === parent)
        .map((directory) => ({
          name: directory.split("/").at(-1) ?? directory,
          path: directory,
          kind: "directory" as const,
          children: makeChildren(directory),
        }));
      const childFiles = filePaths
        .filter((filePath) => filePath.split("/").slice(0, -1).join("/") === parent)
        .map((filePath) => ({
          name: filePath.split("/").at(-1) ?? filePath,
          path: filePath,
          kind: "file" as const,
        }));
      return [...childDirectories, ...childFiles].sort((a, b) => a.name.localeCompare(b.name));
    };

    return makeChildren(prefix);
  }

  async readFile(path: string) {
    const normalized = normalizeStoragePath(path);
    const content = this.files.get(normalized);
    if (content === undefined) throw new Error(`File not found: ${normalized}`);
    return content;
  }

  async writeFile(path: string, content: string) {
    this.files.set(normalizeStoragePath(path), content);
  }

  async createFile(path: string, content = "") {
    const normalized = normalizeStoragePath(path);
    if (this.files.has(normalized)) throw new Error(`File exists: ${normalized}`);
    this.files.set(normalized, content);
  }

  async deleteFile(path: string) {
    const normalized = normalizeStoragePath(path);
    for (const key of [...this.files.keys()]) {
      if (key === normalized || key.startsWith(normalized + "/")) this.files.delete(key);
    }
  }

  async renameFile(oldPath: string, newPath: string) {
    const oldNormalized = normalizeStoragePath(oldPath);
    const newNormalized = normalizeStoragePath(newPath);
    const moved = [...this.files.entries()].filter(
      ([key]) => key === oldNormalized || key.startsWith(oldNormalized + "/"),
    );
    if (!moved.length) throw new Error(`File not found: ${oldNormalized}`);
    moved.forEach(([key]) => this.files.delete(key));
    moved.forEach(([key, value]) => {
      this.files.set(key.replace(oldNormalized, newNormalized), value);
    });
  }
}
