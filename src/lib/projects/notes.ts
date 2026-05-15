import { readBookFile, writeBookFile } from "./files";
import type { StorageProvider } from "@/lib/storage/types";

export const CURRENT_NOTES_PATH = "notes.md";

export function formatNoteBlock(note: string, date = new Date()) {
  const timestamp = date.toISOString().slice(0, 16).replace("T", " ");
  return `## ${timestamp}\n\n${note.trim()}\n\n---\n`;
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
) {
  const trimmed = note.trim();
  if (!trimmed) throw new Error("Note is required");

  let current =
    "# Notes\n\nFast captures live here until they are processed.\n\n";
  try {
    current = await readBookFile(storage, bookId, CURRENT_NOTES_PATH);
  } catch {
    // Missing notes.md is normal for older projects.
  }

  const next = `${current.trimEnd()}\n\n${formatNoteBlock(trimmed, date)}`;
  await writeBookFile(storage, bookId, CURRENT_NOTES_PATH, next);
  return {
    path: CURRENT_NOTES_PATH,
    count: countNoteBlocks(next),
    content: next,
  };
}
