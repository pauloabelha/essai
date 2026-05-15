import { flattenFiles } from "@/lib/markdown/wiki";
import {
  listBookFiles,
  readBookFile,
  writeBookFile,
} from "@/lib/projects/files";
import { bookRoot } from "@/lib/projects/service";
import type { StorageProvider } from "@/lib/storage/types";

export const STUDY_SOURCE_INDEX_PATH = "sources/.study-index.json";

export interface StudySourceIndex {
  version: 1;
  updatedAt: string;
  chunks: StudyIndexChunk[];
}

export interface StudyIndexChunk {
  id: string;
  path: string;
  sourceType: string;
  page: string;
  text: string;
}

export async function readOrRefreshStudySourceIndex(
  storage: StorageProvider,
  bookId: string,
) {
  try {
    return JSON.parse(
      await readBookFile(storage, bookId, STUDY_SOURCE_INDEX_PATH),
    ) as StudySourceIndex;
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
    .filter((path) => path.startsWith("sources/"));
  const sourceMarkdown = files.filter(
    (path) => path.endsWith(".md") && path !== STUDY_SOURCE_INDEX_PATH,
  );
  const uploadedFiles = files.filter((path) =>
    path.startsWith("sources/files/"),
  );
  const markdownChunks = (
    await Promise.all(
      sourceMarkdown.map(async (path) =>
        chunkSourceFile(path, await readBookFile(storage, bookId, path)),
      ),
    )
  ).flat();
  const fileChunks = uploadedFiles.map((path) => ({
    id: `${path}:file`,
    path,
    sourceType: sourceTypeFromFilePath(path),
    page: "file",
    text: fileText(path),
  }));
  const index: StudySourceIndex = {
    version: 1,
    updatedAt: date.toISOString(),
    chunks: [...markdownChunks, ...fileChunks],
  };
  await writeBookFile(
    storage,
    bookId,
    STUDY_SOURCE_INDEX_PATH,
    JSON.stringify(index, null, 2) + "\n",
  );
  return index;
}

function chunkSourceFile(path: string, content: string): StudyIndexChunk[] {
  if (path === "sources/Claims.md") return chunkClaims(content);
  const blocks = content
    .split(/\n---\n/g)
    .map((block) => block.trim())
    .filter((block) => block && !/^#\s/.test(block));
  const sourceType = sourceTypeFromPath(path);
  const sourceBlocks = blocks.length
    ? blocks
    : [content.trim()].filter(Boolean);
  return sourceBlocks.map((block, index) => ({
    id: `${path}:${index}`,
    path,
    sourceType: parseType(block) ?? sourceType,
    page: parsePage(block),
    text: normalizePassage(block),
  }));
}

function chunkClaims(content: string): StudyIndexChunk[] {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-*]\s/.test(line))
    .map((line, index) => ({
      id: `sources/Claims.md:${index}`,
      path: "sources/Claims.md",
      sourceType: "claim",
      page: "index",
      text: line.replace(/^[-*]\s+\[[ x]\]\s*/i, "").replace(/^[-*]\s+/, ""),
    }));
}

function sourceTypeFromPath(path: string) {
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
