import { NextResponse } from "next/server";
import { appendSource, parseSourceKind } from "@/lib/projects/sources";
import { getServerStorage } from "@/lib/storage/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  const body = (await request.json()) as { source?: string; kind?: string };
  if (!body.source?.trim()) {
    return NextResponse.json({ error: "Source is required" }, { status: 400 });
  }
  return NextResponse.json(
    await appendSource(
      getServerStorage(),
      bookId,
      body.source,
      parseSourceKind(body.kind),
    ),
  );
}
