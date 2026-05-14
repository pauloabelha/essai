import { NextResponse } from "next/server";
import {
  createBookFile,
  listBookFiles,
  readAllMarkdownFiles,
} from "@/lib/projects/files";
import { getServerStorage } from "@/lib/storage/server";
import { searchDocuments } from "@/lib/search";

export async function GET(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const storage = getServerStorage();
  if (query) {
    return NextResponse.json(searchDocuments(await readAllMarkdownFiles(storage, bookId), query));
  }
  return NextResponse.json(await listBookFiles(storage, bookId));
}

export async function POST(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  const body = (await request.json()) as { path?: string; content?: string };
  if (!body.path) return NextResponse.json({ error: "Path is required" }, { status: 400 });
  await createBookFile(getServerStorage(), bookId, body.path, body.content ?? `# ${body.path}\n`);
  return NextResponse.json({ ok: true }, { status: 201 });
}
