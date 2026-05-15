import { NextResponse } from "next/server";
import {
  archiveBook,
  bookFilePath,
  deleteBook,
  updateBook,
} from "@/lib/projects/service";
import { getServerStorage } from "@/lib/storage/server";
import type { BookMetadata, ManuscriptSection } from "@/lib/projects/templates";

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
    return NextResponse.json(await archiveBook(getServerStorage(), bookId));
  }
  if (body.sections) {
    const storage = getServerStorage();
    const book = JSON.parse(
      await storage.readFile(bookFilePath(bookId, "book.json")),
    ) as BookMetadata;
    return NextResponse.json(
      await updateBook(storage, { ...book, sections: body.sections }),
    );
  }
  return NextResponse.json({ error: "Unsupported update" }, { status: 400 });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  await deleteBook(getServerStorage(), bookId);
  return NextResponse.json({ ok: true });
}
