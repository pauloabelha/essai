import { createHash } from "node:crypto";
import {
  readBinaryBookFile,
  readBookFile,
  writeBinaryBookFile,
  writeBookFile,
} from "./files";
import { refreshStudySourceIndex } from "@/lib/study/source-index";
import type { StorageProvider } from "@/lib/storage/types";

export type SourceKind =
  | "raw"
  | "book"
  | "paper"
  | "article"
  | "quote"
  | "claim";

export const SOURCE_TARGETS: Record<SourceKind, string> = {
  raw: "sources/raw.md",
  book: "sources/Books.md",
  paper: "sources/Papers.md",
  article: "sources/Articles.md",
  quote: "sources/Quotes.md",
  claim: "sources/Claims.md",
};

export interface SourceFile {
  name: string;
  bytes: Uint8Array;
}

export function parseSourceKind(value: unknown): SourceKind {
  return typeof value === "string" && value in SOURCE_TARGETS
    ? (value as SourceKind)
    : "raw";
}

export function formatSourceEntry(input: {
  value: string;
  kind: SourceKind;
  date?: Date;
}) {
  const timestamp = (input.date ?? new Date())
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");
  return `## ${timestamp}\n\nType: ${input.kind}\n\n${input.value.trim()}\n\n---\n`;
}

export async function appendSource(
  storage: StorageProvider,
  bookId: string,
  value: string,
  kind: SourceKind = "raw",
  date = new Date(),
) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Source is required");

  const rawEntry = formatSourceEntry({ value: trimmed, kind, date });
  await appendToFile(
    storage,
    bookId,
    SOURCE_TARGETS.raw,
    "# Raw Sources\n\n",
    rawEntry,
  );

  const target = SOURCE_TARGETS[kind];
  if (kind !== "raw" && target) {
    await appendToFile(
      storage,
      bookId,
      target,
      `# ${titleForKind(kind)}\n\n`,
      rawEntry,
    );
  }
  await refreshStudySourceIndex(storage, bookId, date);

  return {
    path: SOURCE_TARGETS.raw,
    mirroredPath: kind === "raw" ? null : target,
  };
}

export async function appendSourceFile(
  storage: StorageProvider,
  bookId: string,
  file: SourceFile,
  kind: SourceKind = "raw",
  date = new Date(),
) {
  if (!file.bytes.byteLength) throw new Error("Source file is empty");

  const originalName = file.name.trim() || "source-file";
  const storedName = await uniqueSourceFilename(
    storage,
    bookId,
    kind,
    originalName,
    file.bytes,
    date,
  );
  const filePath = `sources/files/${kind}/${storedName}`;
  const sourceLink = `[${originalName}](files/${kind}/${storedName})`;
  const value = `File: ${sourceLink}\n\nUploaded source file.`;

  if (!(await hasIdenticalBinaryFile(storage, bookId, filePath, file.bytes))) {
    await writeBinaryBookFile(storage, bookId, filePath, file.bytes);
  }
  const result = await appendSource(storage, bookId, value, kind, date);

  return {
    ...result,
    filePath,
    fileName: storedName,
    originalName,
  };
}

export const appendPdfSource = appendSourceFile;

async function appendToFile(
  storage: StorageProvider,
  bookId: string,
  path: string,
  fallback: string,
  entry: string,
) {
  let current = fallback;
  try {
    current = await readBookFile(storage, bookId, path);
  } catch {
    // Missing source files are created on first capture.
  }
  await writeBookFile(
    storage,
    bookId,
    path,
    `${current.trimEnd()}\n\n${entry}`,
  );
}

function titleForKind(kind: SourceKind) {
  return {
    raw: "Raw Sources",
    book: "Books",
    paper: "Papers",
    article: "Articles",
    quote: "Quotes",
    claim: "Claims",
  }[kind];
}

function sanitizeSourceFilename(name: string) {
  const normalized =
    name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "source-file";
  return normalized;
}

async function uniqueSourceFilename(
  storage: StorageProvider,
  bookId: string,
  kind: SourceKind,
  originalName: string,
  bytes: Uint8Array,
  date: Date,
) {
  const safeName = sanitizeSourceFilename(originalName);
  const { stem, extension } = splitFilename(safeName);
  const baseName = `${fileTimestamp(date)}-${stem}-${contentHash(bytes)}`;
  let candidate = `${baseName}${extension}`;
  let suffix = 2;

  let candidatePath = `sources/files/${kind}/${candidate}`;
  while (await binaryFileExists(storage, bookId, candidatePath)) {
    if (
      await hasIdenticalBinaryFile(storage, bookId, candidatePath, bytes)
    ) {
      return candidate;
    }
    candidate = `${baseName}-${suffix}${extension}`;
    candidatePath = `sources/files/${kind}/${candidate}`;
    suffix += 1;
  }

  return candidate;
}

async function binaryFileExists(
  storage: StorageProvider,
  bookId: string,
  path: string,
) {
  try {
    await readBinaryBookFile(storage, bookId, path);
    return true;
  } catch {
    return false;
  }
}

async function hasIdenticalBinaryFile(
  storage: StorageProvider,
  bookId: string,
  path: string,
  bytes: Uint8Array,
) {
  try {
    const existing = await readBinaryBookFile(storage, bookId, path);
    return bytesEqual(existing, bytes);
  } catch {
    return false;
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array) {
  if (a.byteLength !== b.byteLength) return false;
  return a.every((byte, index) => byte === b[index]);
}

function contentHash(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex").slice(0, 12);
}

function splitFilename(name: string) {
  const dotIndex = name.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === name.length - 1) {
    return { stem: name, extension: "" };
  }
  return {
    stem: name.slice(0, dotIndex),
    extension: name.slice(dotIndex),
  };
}

function fileTimestamp(date: Date) {
  return date
    .toISOString()
    .replace(/\.\d{3}Z$/, "Z")
    .replace(/[-:]/g, "")
    .replace("T", "-")
    .replace("Z", "");
}
