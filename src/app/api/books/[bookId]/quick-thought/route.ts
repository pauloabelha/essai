import { NextResponse } from "next/server";
import { appendQuickThought } from "@/lib/projects/current-notes";
import { getServerStorage } from "@/lib/storage/server";

export async function POST(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  const body = (await request.json()) as { thought?: string };
  if (!body.thought?.trim()) {
    return NextResponse.json({ error: "Thought is required" }, { status: 400 });
  }
  return NextResponse.json(await appendQuickThought(getServerStorage(), bookId, body.thought));
}
