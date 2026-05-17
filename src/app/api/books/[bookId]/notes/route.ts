import { NextResponse } from "next/server";
import { appendNote, type NoteSourceReference } from "@/lib/projects/notes";
import { createLogger } from "@/lib/server/log";
import { getServerStorage } from "@/lib/storage/server";

const log = createLogger("api:notes");

export async function POST(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  const body = (await request.json()) as {
    note?: string;
    source?: NoteSourceReference;
  };
  if (!body.note?.trim()) {
    log.warn("POST /notes rejected", { bookId, reason: "missing note" });
    return NextResponse.json({ error: "Note is required" }, { status: 400 });
  }
  log.info("POST /notes", {
    bookId,
    characters: body.note.trim().length,
    sourcePath: body.source?.path ?? null,
    hasQuote: Boolean(body.source?.quote),
  });
  const result = await appendNote(
    getServerStorage(),
    bookId,
    body.note,
    new Date(),
    body.source,
  );
  log.info("POST /notes response", { bookId, count: result.count });
  return NextResponse.json(result);
}
