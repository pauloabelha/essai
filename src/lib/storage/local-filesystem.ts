import { promises as fs } from "node:fs";
import path from "node:path";
import type { FileNode, StorageProvider } from "./types";
import { normalizeStoragePath } from "./types";

export class LocalFilesystemStorageProvider implements StorageProvider {
  constructor(private readonly root: string) {}

  private resolve(relativePath = "") {
    const normalized = normalizeStoragePath(relativePath);
    const resolved = path.resolve(this.root, normalized);
    const root = path.resolve(this.root);
    if (resolved !== root && !resolved.startsWith(root + path.sep)) {
      throw new Error("Path escapes storage root");
    }
    return resolved;
  }

  async listFiles(root = ""): Promise<FileNode[]> {
    await fs.mkdir(this.resolve(root), { recursive: true });
    return this.readDirectory(root);
  }

  async readFile(filePath: string) {
    return fs.readFile(this.resolve(filePath), "utf8");
  }

  async readBinaryFile(filePath: string) {
    return fs.readFile(this.resolve(filePath));
  }

  async writeFile(filePath: string, content: string) {
    const resolved = this.resolve(filePath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, "utf8");
  }

  async writeBinaryFile(filePath: string, content: Uint8Array) {
    const resolved = this.resolve(filePath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content);
  }

  async createFile(filePath: string, content = "") {
    const resolved = this.resolve(filePath);
    await fs.mkdir(path.dirname(resolved), { recursive: true });
    await fs.writeFile(resolved, content, { encoding: "utf8", flag: "wx" });
  }

  async deleteFile(filePath: string) {
    await fs.rm(this.resolve(filePath), { recursive: true, force: true });
  }

  async renameFile(oldPath: string, newPath: string) {
    const next = this.resolve(newPath);
    await fs.mkdir(path.dirname(next), { recursive: true });
    await fs.rename(this.resolve(oldPath), next);
  }

  private async readDirectory(relativePath: string): Promise<FileNode[]> {
    const entries = await fs.readdir(this.resolve(relativePath), {
      withFileTypes: true,
    });
    const nodes = await Promise.all(
      entries
        .filter((entry) => !entry.name.startsWith("."))
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(async (entry) => {
          const childPath = normalizeStoragePath(
            path.posix.join(relativePath, entry.name),
          );
          if (entry.isDirectory()) {
            return {
              name: entry.name,
              path: childPath,
              kind: "directory" as const,
              children: await this.readDirectory(childPath),
            };
          }
          return { name: entry.name, path: childPath, kind: "file" as const };
        }),
    );
    return nodes;
  }
}
