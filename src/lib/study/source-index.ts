import { flattenFiles } from "@/lib/markdown/wiki";
import {
  listBookFiles,
  readBinaryBookFile,
  readBookFile,
  writeBookFile,
} from "@/lib/projects/files";
import { bookRoot } from "@/lib/projects/service";
import type { StorageProvider } from "@/lib/storage/types";

export const STUDY_SOURCE_INDEX_PATH = "sources/.study-index.json";
const MAX_EXTRACTED_UPLOAD_BYTES = 512 * 1024;
const TEXT_UPLOAD_EXTENSIONS = new Set([
  "csv",
  "json",
  "log",
  "md",
  "rtf",
  "tex",
  "text",
  "tsv",
  "txt",
  "xml",
  "yaml",
  "yml",
]);

export interface StudySourceIndex {
  version: 2;
  updatedAt: string;
  documents: StudyIndexDocument[];
  chunks: StudyIndexChunk[];
}

export interface StudyIndexDocument {
  id: string;
  path: string;
  title: string;
  kind: "markdown" | "upload";
  sourceType: string;
  mimeType: string;
  sizeBytes: number;
  searchText: string;
  metadata: Record<string, string | number | boolean>;
}

export interface StudyIndexChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  path: string;
  sourceType: string;
  page: string;
  text: string;
  metadata: Record<string, string | number | boolean>;
}

export async function readOrRefreshStudySourceIndex(
  storage: StorageProvider,
  bookId: string,
) {
  try {
    const index = JSON.parse(
      await readBookFile(storage, bookId, STUDY_SOURCE_INDEX_PATH),
    ) as StudySourceIndex;
    if (index.version === 2 && Array.isArray(index.documents)) return index;
    return refreshStudySourceIndex(storage, bookId);
  } catch {
    return refreshStudySourceIndex(storage, bookId);
  }
}

export async function refreshStudySourceIndex(
  storage: StorageProvider,
  bookId: string,
  date = new Date(),
): Promise<StudySourceIndex> {
  const nodes = await listBookFiles(storage, bookId);
  const projectPrefix = `${bookRoot(bookId)}/`;
  const cleanPath = (path: string) => path.replace(projectPrefix, "");
  const files = flattenFiles(nodes)
    .filter((node) => node.kind === "file")
    .map((file) => cleanPath(file.path))
    .filter((path) => path.startsWith("sources/") || path === "notes.md");
  const sourceMarkdown = files.filter(
    (path) =>
      path.endsWith(".md") &&
      path !== STUDY_SOURCE_INDEX_PATH &&
      !path.startsWith("sources/files/"),
  );
  const uploadedFiles = files.filter(
    (path) =>
      path.startsWith("sources/files/") &&
      path !== "sources/files/README.md",
  );
  const markdownDocuments = await Promise.all(
    sourceMarkdown.map(async (path) =>
      markdownDocument(path, await readBookFile(storage, bookId, path)),
    ),
  );
  const uploadDocuments = await Promise.all(
    uploadedFiles.map((path) => uploadDocument(storage, bookId, path)),
  );
  const documents = [...markdownDocuments, ...uploadDocuments];
  const chunks = documents.flatMap((document) => chunkDocument(document));
  const index: StudySourceIndex = {
    version: 2,
    updatedAt: date.toISOString(),
    documents,
    chunks,
  };
  await writeBookFile(
    storage,
    bookId,
    STUDY_SOURCE_INDEX_PATH,
    JSON.stringify(index, null, 2) + "\n",
  );
  return index;
}

function markdownDocument(path: string, content: string): StudyIndexDocument {
  return {
    id: documentId(path),
    path,
    title: titleFromPath(path),
    kind: "markdown",
    sourceType: sourceTypeFromPath(path),
    mimeType: "text/markdown",
    sizeBytes: new TextEncoder().encode(content).byteLength,
    searchText: content.trim(),
    metadata: {
      extension: "md",
    },
  };
}

async function uploadDocument(
  storage: StorageProvider,
  bookId: string,
  path: string,
): Promise<StudyIndexDocument> {
  const bytes = await readUploadedBytes(storage, bookId, path);
  const extension = extensionFromPath(path);
  const extractedText = extractUploadText(bytes, extension);
  const fallbackText = fileText(path);
  return {
    id: documentId(path),
    path,
    title: titleFromPath(path),
    kind: "upload",
    sourceType: sourceTypeFromFilePath(path),
    mimeType: mimeTypeForExtension(extension),
    sizeBytes: bytes.byteLength,
    searchText: extractedText || fallbackText,
    metadata: {
      extension,
      extractedText: Boolean(extractedText),
      extraction: extractedText ? "utf8-text" : "metadata-only",
    },
  };
}

async function readUploadedBytes(
  storage: StorageProvider,
  bookId: string,
  path: string,
) {
  try {
    return await readBinaryBookFile(storage, bookId, path);
  } catch {
    return new Uint8Array();
  }
}

function chunkDocument(document: StudyIndexDocument): StudyIndexChunk[] {
  if (document.path === "sources/Claims.md") return chunkClaims(document);
  if (document.path === "notes.md") return chunkNotes(document);
  if (document.kind === "markdown") return chunkSourceMarkdown(document);
  return splitSearchText(document).map((text, index) => ({
    id: `${document.id}:chunk:${index}`,
    documentId: document.id,
    chunkIndex: index,
    path: document.path,
    sourceType: document.sourceType,
    page: "file",
    text,
    metadata: {
      ...document.metadata,
      kind: document.kind,
      title: document.title,
    },
  }));
}

function chunkSourceMarkdown(document: StudyIndexDocument): StudyIndexChunk[] {
  const content = document.searchText;
  const blocks = content
    .split(/\n---\n/g)
    .map((block) => block.trim())
    .filter((block) => block && !/^#\s/.test(block));
  const sourceBlocks = blocks.length
    ? blocks
    : [content.trim()].filter(Boolean);
  return sourceBlocks.map((block, index) => ({
    id: `${document.id}:chunk:${index}`,
    documentId: document.id,
    chunkIndex: index,
    path: document.path,
    sourceType: parseType(block) ?? document.sourceType,
    page: parsePage(block),
    text: normalizePassage(block),
    metadata: {
      ...document.metadata,
      kind: document.kind,
      title: document.title,
    },
  }));
}

function splitSearchText(document: StudyIndexDocument): string[] {
  const text = document.searchText.trim();
  if (!text) return [];
  if (text.length <= 1800) return [text];
  const chunks: string[] = [];
  for (let start = 0; start < text.length; start += 1600) {
    chunks.push(text.slice(start, start + 1800).trim());
  }
  return chunks.filter(Boolean);
}

function extractUploadText(bytes: Uint8Array, extension: string) {
  if (!bytes.byteLength || bytes.byteLength > MAX_EXTRACTED_UPLOAD_BYTES) {
    return "";
  }
  if (!isTextLikeExtension(extension) && !looksLikeText(bytes)) return "";
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).trim();
  } catch {
    return "";
  }
}

function isTextLikeExtension(extension: string) {
  return TEXT_UPLOAD_EXTENSIONS.has(extension);
}

function looksLikeText(bytes: Uint8Array) {
  const sample = bytes.slice(0, Math.min(bytes.byteLength, 512));
  if (!sample.length) return false;
  let suspicious = 0;
  for (const byte of sample) {
    if (byte === 0) return false;
    if (byte < 7 || (byte > 14 && byte < 32)) suspicious += 1;
  }
  return suspicious / sample.length < 0.05;
}

function chunkClaims(document: StudyIndexDocument): StudyIndexChunk[] {
  return document.searchText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s/.test(line))
    .map((line, index) => ({
      id: `${document.id}:chunk:${index}`,
      documentId: document.id,
      chunkIndex: index,
      path: "sources/Claims.md",
      sourceType: "claim",
      page: "index",
      text: line.replace(/^[-*]\s+\[[ x]\]\s*/i, "").replace(/^[-*]\s+/, ""),
      metadata: {
        ...document.metadata,
        kind: document.kind,
        title: document.title,
      },
    }));
}

function chunkNotes(document: StudyIndexDocument): StudyIndexChunk[] {
  const notesOnly = document.searchText.match(/^##\s[\s\S]*$/m)?.[0] ?? "";
  return notesOnly
    .split(/\n---\n/g)
    .map((block) => block.trim())
    .filter((block) => /^##\s/.test(block))
    .map((block, index) => {
      const sourcePath = block.match(/^Source:\s*(.+)$/im)?.[1]?.trim() ?? "";
      const timestamp =
        block.match(/^##\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/m)?.[1] ??
        "note";
      return {
        id: `${document.id}:chunk:${index}`,
        documentId: document.id,
        chunkIndex: index,
        path: document.path,
        sourceType: "note",
        page: timestamp,
        text: normalizeNote(block),
        metadata: {
          ...document.metadata,
          kind: document.kind,
          title: document.title,
          sourcePath,
        },
      };
    });
}

function sourceTypeFromPath(path: string) {
  if (path === "notes.md") return "note";
  if (path.includes("Books")) return "book";
  if (path.includes("Papers")) return "paper";
  if (path.includes("Articles")) return "article";
  if (path.includes("Quotes")) return "quote";
  if (path.includes("Claims")) return "claim";
  return "raw";
}

function sourceTypeFromFilePath(path: string) {
  return path.split("/")[2] ?? "raw";
}

function fileText(path: string) {
  const name = path.split("/").at(-1) ?? path;
  return `Uploaded source file ${name.replace(/[-_]+/g, " ")} stored at ${path}`;
}

function documentId(path: string) {
  return path.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function titleFromPath(path: string) {
  return path.split("/").at(-1)?.replace(/^\d{8}-\d{6}-/, "") ?? path;
}

function extensionFromPath(path: string) {
  const name = path.split("/").at(-1) ?? "";
  const extension = name.includes(".") ? name.split(".").at(-1) : "";
  return extension?.toLowerCase() ?? "";
}

function mimeTypeForExtension(extension: string) {
  return (
    {
      csv: "text/csv",
      json: "application/json",
      md: "text/markdown",
      pdf: "application/pdf",
      txt: "text/plain",
    }[extension] ?? "application/octet-stream"
  );
}

function parseType(block: string) {
  return block.match(/^Type:\s*(.+)$/im)?.[1]?.trim();
}

function parsePage(block: string) {
  return block.match(/\bp(?:age|\.)?\s*(\d+)/i)?.[1] ?? "index";
}

function normalizePassage(block: string) {
  return block
    .replace(/^##\s.+$/gm, "")
    .replace(/^Type:\s*.+$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeNote(block: string) {
  return block
    .replace(/^##\s.+$/gm, "")
    .replace(/^Source title:\s*.+$/gim, "")
    .replace(/^Source quote:\s*.+$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
