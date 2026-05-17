import { NextResponse } from "next/server";
import {
  archiveBook,
  bookFilePath,
  deleteBook,
  updateBook,
} from "@/lib/projects/service";
import { createLogger } from "@/lib/server/log";
import { getServerStorage } from "@/lib/storage/server";
import type { BookMetadata, ManuscriptSection } from "@/lib/projects/templates";

const log = createLogger("api:book");

export async function PATCH(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  const body = (await request.json()) as {
    archived?: boolean;
    sections?: ManuscriptSection[];
  };
  if (body.archived) {
    log.warn("PATCH /book archive", { bookId });
    return NextResponse.json(await archiveBook(getServerStorage(), bookId));
  }
  if (body.sections) {
    const storage = getServerStorage();
    const book = JSON.parse(
      await storage.readFile(bookFilePath(bookId, "book.json")),
    ) as BookMetadata;
    log.info("PATCH /book sections", {
      bookId,
      sections: body.sections.length,
    });
    const updated = await updateBook(storage, {
      ...book,
      sections: body.sections,
    });
    log.info("book sections updated", { bookId, updatedAt: updated.updatedAt });
    return NextResponse.json(updated);
  }
  log.warn("PATCH /book rejected", { bookId, body });
  return NextResponse.json({ error: "Unsupported update" }, { status: 400 });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  log.warn("DELETE /book", { bookId });
  await deleteBook(getServerStorage(), bookId);
  return NextResponse.json({ ok: true });
}
