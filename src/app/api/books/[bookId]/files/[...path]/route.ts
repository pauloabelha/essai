import { NextResponse } from "next/server";
import {
  deleteBookFile,
  readAllMarkdownFiles,
  readBinaryBookFile,
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
  request: Request,
  context: { params: Promise<{ bookId: string; path: string[] }> },
) {
  const { bookId, path } = await context.params;
  const storage = getServerStorage();
  const filePath = joined(path);
  const wantsRawFile = new URL(request.url).searchParams.get("raw") === "1";
  try {
    if (wantsRawFile && filePath.startsWith("sources/files/")) {
      const content = await readBinaryBookFile(storage, bookId, filePath);
      const body = new ArrayBuffer(content.byteLength);
      new Uint8Array(body).set(content);
      return new Response(body, {
        headers: {
          "Content-Type": mimeTypeForPath(filePath),
          "Content-Disposition": `inline; filename="${safeFileName(filePath)}"`,
          "Content-Length": String(content.byteLength),
        },
      });
    }
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

function safeFileName(filePath: string) {
  return (filePath.split("/").at(-1) ?? "source").replace(/["\\]/g, "");
}

function mimeTypeForPath(filePath: string) {
  const extension = filePath.split(".").at(-1)?.toLowerCase();
  switch (extension) {
    case "pdf":
      return "application/pdf";
    case "md":
      return "text/markdown; charset=utf-8";
    case "txt":
    case "text":
    case "log":
      return "text/plain; charset=utf-8";
    case "csv":
      return "text/csv; charset=utf-8";
    case "json":
      return "application/json; charset=utf-8";
    case "xml":
      return "application/xml; charset=utf-8";
    default:
      return "application/octet-stream";
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
