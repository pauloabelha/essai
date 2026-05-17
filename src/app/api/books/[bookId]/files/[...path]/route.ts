import { NextResponse } from "next/server";
import {
  deleteBookFile,
  readAllMarkdownFiles,
  readBinaryBookFile,
  readBookFile,
  renameBookFile,
  writeBookFile,
} from "@/lib/projects/files";
import { createLogger } from "@/lib/server/log";
import { getServerStorage } from "@/lib/storage/server";
import { analyzeLinks } from "@/lib/markdown/wiki";

const log = createLogger("api:file");

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
  log.info("GET /file", { bookId, path: filePath, raw: wantsRawFile });
  try {
    if (wantsRawFile && filePath.startsWith("sources/files/")) {
      const content = await readBinaryBookFile(storage, bookId, filePath);
      log.info("serving raw file", {
        bookId,
        path: filePath,
        bytes: content.byteLength,
        mimeType: mimeTypeForPath(filePath),
      });
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
    const analysis = analyzeLinks(filePath, content, corpus);
    log.info("serving markdown file", {
      bookId,
      path: filePath,
      characters: content.length,
      outgoing: analysis.outgoing.length,
      backlinks: analysis.backlinks.length,
      broken: analysis.broken.length,
    });
    return NextResponse.json({
      path: filePath,
      content,
      analysis,
    });
  } catch (error) {
    log.warn("GET /file not found", { bookId, path: filePath, error });
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
  const filePath = joined(path);
  log.info("PUT /file", {
    bookId,
    path: filePath,
    characters: body.content?.length ?? 0,
  });
  await writeBookFile(getServerStorage(), bookId, filePath, body.content ?? "");
  return NextResponse.json({ ok: true });
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ bookId: string; path: string[] }> },
) {
  const { bookId, path } = await context.params;
  const body = (await request.json()) as { newPath?: string };
  const filePath = joined(path);
  if (!body.newPath) {
    log.warn("PATCH /file rejected", { bookId, path: filePath });
    return NextResponse.json({ error: "newPath is required" }, { status: 400 });
  }
  log.info("PATCH /file rename", {
    bookId,
    path: filePath,
    newPath: body.newPath,
  });
  await renameBookFile(getServerStorage(), bookId, filePath, body.newPath);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ bookId: string; path: string[] }> },
) {
  const { bookId, path } = await context.params;
  const filePath = joined(path);
  log.warn("DELETE /file", { bookId, path: filePath });
  await deleteBookFile(getServerStorage(), bookId, filePath);
  return NextResponse.json({ ok: true });
}
