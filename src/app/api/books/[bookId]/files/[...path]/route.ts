import { NextResponse } from "next/server";
import {
  deleteBookFile,
  readAllMarkdownFiles,
  readBookFile,
  renameBookFile,
  writeBookFile,
} from "@/lib/projects/files";
import { getServerStorage } from "@/lib/storage/server";
import { analyzeLinks } from "@/lib/markdown/wiki";

function joined(parts: string[]) {
  return parts.join("/");
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ bookId: string; path: string[] }> },
) {
  const { bookId, path } = await context.params;
  const storage = getServerStorage();
  const filePath = joined(path);
  try {
    const content = await readBookFile(storage, bookId, filePath);
    const corpus = await readAllMarkdownFiles(storage, bookId);
    return NextResponse.json({
      path: filePath,
      content,
      analysis: analyzeLinks(filePath, content, corpus),
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ bookId: string; path: string[] }> },
) {
  const { bookId, path } = await context.params;
  const body = (await request.json()) as { content?: string };
  await writeBookFile(
    getServerStorage(),
    bookId,
    joined(path),
    body.content ?? "",
  );
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ bookId: string; path: string[] }> },
) {
  const { bookId, path } = await context.params;
  const body = (await request.json()) as { newPath?: string };
  if (!body.newPath)
    return NextResponse.json({ error: "newPath is required" }, { status: 400 });
  await renameBookFile(getServerStorage(), bookId, joined(path), body.newPath);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ bookId: string; path: string[] }> },
) {
  const { bookId, path } = await context.params;
  await deleteBookFile(getServerStorage(), bookId, joined(path));
  return NextResponse.json({ ok: true });
}
