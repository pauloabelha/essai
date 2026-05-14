import { NextResponse } from "next/server";
import { createBook, listBooks } from "@/lib/projects/service";
import { getServerStorage } from "@/lib/storage/server";

export async function GET() {
  return NextResponse.json(await listBooks(getServerStorage()));
}

export async function POST(request: Request) {
  const body = (await request.json()) as { title?: string; language?: string };
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "Title is required" }, { status: 400 });
  }
  const book = await createBook(getServerStorage(), body.title.trim(), body.language);
  return NextResponse.json(book, { status: 201 });
}
