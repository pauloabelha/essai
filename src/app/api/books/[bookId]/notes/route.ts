import { NextResponse } from "next/server";
import { appendNote } from "@/lib/projects/notes";
import { getServerStorage } from "@/lib/storage/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  const body = (await request.json()) as { note?: string };
  if (!body.note?.trim()) {
    return NextResponse.json({ error: "Note is required" }, { status: 400 });
  }
  return NextResponse.json(
    await appendNote(getServerStorage(), bookId, body.note),
  );
}
