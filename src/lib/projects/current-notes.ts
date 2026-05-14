import { readBookFile, writeBookFile } from "./files";
import type { StorageProvider } from "@/lib/storage/types";

export const CURRENT_NOTES_PATH = "inbox/current-notes.md";

export function formatThoughtBlock(thought: string, date = new Date()) {
  const timestamp = date
    .toISOString()
    .slice(0, 16)
    .replace("T", " ");
  return `## ${timestamp}\n\n${thought.trim()}\n\n---\n`;
}

export function countThoughtBlocks(markdown: string) {
  return markdown.split("\n").filter((line) => /^## \d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(line)).length;
}

export async function appendQuickThought(
  storage: StorageProvider,
  bookId: string,
  thought: string,
  date = new Date(),
) {
  const trimmed = thought.trim();
  if (!trimmed) throw new Error("Thought is required");

  let current = "# Current Notes\n\nFast captures live here until they are processed.\n\n";
  try {
    current = await readBookFile(storage, bookId, CURRENT_NOTES_PATH);
  } catch {
    // Missing current-notes.md is normal for older projects.
  }

  const next = `${current.trimEnd()}\n\n${formatThoughtBlock(trimmed, date)}`;
  await writeBookFile(storage, bookId, CURRENT_NOTES_PATH, next);
  return {
    path: CURRENT_NOTES_PATH,
    count: countThoughtBlocks(next),
    content: next,
  };
}
