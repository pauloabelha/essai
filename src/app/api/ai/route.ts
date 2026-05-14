import { NextResponse } from "next/server";
import { createLocalHeuristicSuggestions, DisabledAiAssistant } from "@/lib/ai/types";

export async function POST(request: Request) {
  const body = (await request.json()) as { content?: string };
  const suggestions = process.env.ESSAI_AI_PROVIDER
    ? createLocalHeuristicSuggestions(body.content ?? "")
    : await new DisabledAiAssistant().suggest();
  return NextResponse.json({ suggestions });
}
