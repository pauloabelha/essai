import { NextResponse } from "next/server";
import { createBook, listBooks } from "@/lib/projects/service";
import { createLogger } from "@/lib/server/log";
import { getServerStorage } from "@/lib/storage/server";

const log = createLogger("api:books");

export async function GET() {
  const books = await listBooks(getServerStorage());
  log.info("GET /books", { count: books.length });
  return NextResponse.json(books);
}

export async function POST(request: Request) {
  const body = (await request.json()) as { title?: string; language?: string };
  if (!body.title?.trim()) {
    log.warn("POST /books rejected", { reason: "missing title" });
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  log.info("POST /books", {
    title: body.title.trim(),
    language: body.language,
  });
  const book = await createBook(
    getServerStorage(),
    body.title.trim(),
    body.language,
  );
  log.info("book created", { id: book.id, title: book.title });
  return NextResponse.json(book, { status: 201 });
}
