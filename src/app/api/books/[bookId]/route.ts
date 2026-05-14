import { NextResponse } from "next/server";
import { archiveBook, deleteBook } from "@/lib/projects/service";
import { getServerStorage } from "@/lib/storage/server";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  const body = (await request.json()) as { archived?: boolean };
  if (body.archived) {
    return NextResponse.json(await archiveBook(getServerStorage(), bookId));
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
