import { NextResponse } from "next/server";
import { appendSource, parseSourceKind } from "@/lib/projects/sources";
import { createLogger } from "@/lib/server/log";
import { getServerStorage } from "@/lib/storage/server";

const log = createLogger("api:sources");

export async function POST(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  const body = (await request.json()) as { source?: string; kind?: string };
  if (!body.source?.trim()) {
    log.warn("POST /sources rejected", { bookId, reason: "missing source" });
    return NextResponse.json({ error: "Source is required" }, { status: 400 });
  }
  const kind = parseSourceKind(body.kind);
  log.info("POST /sources", {
    bookId,
    kind,
    characters: body.source.trim().length,
  });
  const result = await appendSource(
    getServerStorage(),
    bookId,
    body.source,
    kind,
  );
  log.info("POST /sources response", result);
  return NextResponse.json(result);
}
