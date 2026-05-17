import { NextResponse } from "next/server";
import {
  createBookFile,
  listBookFiles,
  readAllMarkdownFiles,
} from "@/lib/projects/files";
import { createLogger } from "@/lib/server/log";
import { getServerStorage } from "@/lib/storage/server";
import { searchDocuments } from "@/lib/search";

const log = createLogger("api:files");

export async function GET(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const storage = getServerStorage();
  if (query) {
    const documents = await readAllMarkdownFiles(storage, bookId);
    const results = searchDocuments(documents, query);
    log.info("GET /files search", {
      bookId,
      query,
      documents: documents.length,
      results: results.length,
    });
    return NextResponse.json(results);
  }
  const files = await listBookFiles(storage, bookId);
  log.info("GET /files list", { bookId, roots: files.length });
  return NextResponse.json(files);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  const body = (await request.json()) as { path?: string; content?: string };
  if (!body.path) {
    log.warn("POST /files rejected", { bookId, reason: "missing path" });
    return NextResponse.json({ error: "Path is required" }, { status: 400 });
  }
  log.info("POST /files", {
    bookId,
    path: body.path,
    characters: body.content?.length ?? 0,
  });
  await createBookFile(
    getServerStorage(),
    bookId,
    body.path,
    body.content ?? `# ${body.path}\n`,
  );
  return NextResponse.json({ ok: true }, { status: 201 });
}
