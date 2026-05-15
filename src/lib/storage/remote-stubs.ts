import type { FileNode, StorageProvider } from "./types";

abstract class UnconfiguredRemoteStorageProvider implements StorageProvider {
  async listFiles(): Promise<FileNode[]> {
    throw new Error(
      "Remote storage provider is documented but not configured.",
    );
  }
  async readFile(): Promise<string> {
    throw new Error(
      "Remote storage provider is documented but not configured.",
    );
  }
  async writeFile(): Promise<void> {
    throw new Error(
      "Remote storage provider is documented but not configured.",
    );
  }
  async readBinaryFile(): Promise<Uint8Array> {
    throw new Error(
      "Remote storage provider is documented but not configured.",
    );
  }
  async writeBinaryFile(): Promise<void> {
    throw new Error(
      "Remote storage provider is documented but not configured.",
    );
  }
  async createFile(): Promise<void> {
    throw new Error(
      "Remote storage provider is documented but not configured.",
    );
  }
  async deleteFile(): Promise<void> {
    throw new Error(
      "Remote storage provider is documented but not configured.",
    );
  }
  async renameFile(): Promise<void> {
    throw new Error(
      "Remote storage provider is documented but not configured.",
    );
  }
}

export class GitHubRepoStorageProvider extends UnconfiguredRemoteStorageProvider {}
export class BlobStorageProvider extends UnconfiguredRemoteStorageProvider {}
