import { NextResponse } from "next/server";
import {
  commitResearchCard,
  previewResearchCardWrite,
  type ResearchCardInput,
} from "@/lib/codex/cards";
import { backlinks, readCodexCards, related } from "@/lib/codex/relationships";
import { getServerStorage } from "@/lib/storage/server";

export async function GET(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  const url = new URL(request.url);
  const cards = await readCodexCards(getServerStorage(), bookId);
  const query = url.searchParams.get("q") ?? "";
  const target = url.searchParams.get("target") ?? "";

  return NextResponse.json({
    cards,
    related: query ? related(cards, query) : related(cards, ""),
    backlinks: target ? backlinks(cards, target) : [],
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ bookId: string }> },
) {
  const { bookId } = await context.params;
  const body = (await request.json()) as {
    action?: "preview" | "commit";
    card?: ResearchCardInput;
  };
  if (!body.card) {
    return NextResponse.json({ error: "card is required" }, { status: 400 });
  }

  try {
    const result =
      body.action === "commit"
        ? await commitResearchCard(getServerStorage(), bookId, body.card)
        : previewResearchCardWrite(body.card);
    return NextResponse.json(result, { status: body.action === "commit" ? 201 : 200 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Codex write failed" },
      { status: 400 },
    );
  }
}
