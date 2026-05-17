import { NextResponse } from "next/server";
import {
  createLocalHeuristicSuggestions,
  DisabledAiAssistant,
} from "@/lib/ai/types";
import { createLogger } from "@/lib/server/log";

const log = createLogger("api:ai");

export async function POST(request: Request) {
  const body = (await request.json()) as { content?: string };
  log.info("POST /ai", {
    provider: process.env.ESSAI_AI_PROVIDER ?? "disabled",
    characters: body.content?.length ?? 0,
  });
  const suggestions = process.env.ESSAI_AI_PROVIDER
    ? createLocalHeuristicSuggestions(body.content ?? "")
    : await new DisabledAiAssistant().suggest();
  log.info("POST /ai response", { suggestions: suggestions.length });
  return NextResponse.json({ suggestions });
}
