import { readBookFile, writeBookFile } from "./files";
import { createLogger } from "@/lib/server/log";
import { refreshStudySourceIndex } from "@/lib/study/source-index";
import type { StorageProvider } from "@/lib/storage/types";

export const CURRENT_NOTES_PATH = "notes.md";
const log = createLogger("projects:notes");

export interface NoteSourceReference {
  path: string;
  title?: string;
  quote?: string;
}

export function formatNoteBlock(
  note: string,
  date = new Date(),
  source?: NoteSourceReference,
) {
  const timestamp = date.toISOString().slice(0, 16).replace("T", " ");
  const sourceLines = source
    ? [
        `Source: ${source.path}`,
        source.title ? `Source title: ${source.title}` : "",
        source.quote ? `Source quote: ${source.quote.trim()}` : "",
      ]
        .filter(Boolean)
        .join("\n") + "\n\n"
    : "";
  return `## ${timestamp}\n\n${sourceLines}${note.trim()}\n\n---\n`;
}

export function countNoteBlocks(markdown: string) {
  return markdown
    .split("\n")
    .filter((line) => /^## \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(line)).length;
}

export async function appendNote(
  storage: StorageProvider,
  bookId: string,
  note: string,
  date = new Date(),
  source?: NoteSourceReference,
) {
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Note is required");
  log.info("append note", {
    bookId,
    characters: trimmed.length,
    sourcePath: source?.path ?? null,
    hasQuote: Boolean(source?.quote),
  });

  let current =
    "# Notes\n\nFast captures live here until they are processed.\n\n";
  try {
    current = await readBookFile(storage, bookId, CURRENT_NOTES_PATH);
  } catch {
    // Missing notes.md is normal for older projects.
  }

  const next = `${current.trimEnd()}\n\n${formatNoteBlock(
    trimmed,
    date,
    source,
  )}`;
  await writeBookFile(storage, bookId, CURRENT_NOTES_PATH, next);
  await refreshStudySourceIndex(storage, bookId);
  log.info("note appended", {
    bookId,
    path: CURRENT_NOTES_PATH,
    count: countNoteBlocks(next),
  });
  return {
    path: CURRENT_NOTES_PATH,
    count: countNoteBlocks(next),
    content: next,
  };
}
