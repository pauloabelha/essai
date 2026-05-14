import path from "node:path";
import { LocalFilesystemStorageProvider } from "./local-filesystem";

export function getServerStorage() {
  const root = process.env.ESSAI_DATA_ROOT
    ? path.resolve(process.env.ESSAI_DATA_ROOT)
    : process.cwd();
  return new LocalFilesystemStorageProvider(root);
}
