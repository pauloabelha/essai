export type AiSuggestionKind =
  | "reindex-inbox"
  | "extract-note"
  | "suggest-links"
  | "detect-contradiction"
  | "summarize-note"
  | "extract-claims"
  | "update-readme-index";

export interface AiSuggestion {
  id: string;
  kind: AiSuggestionKind;
  title: string;
  rationale: string;
  diff?: string;
  targetPath?: string;
}

export interface AiAssistant {
  suggest(input: {
    kind: AiSuggestionKind;
    path: string;
    content: string;
    corpus: Array<{ path: string; content: string }>;
  }): Promise<AiSuggestion[]>;
}

export class DisabledAiAssistant implements AiAssistant {
  async suggest(): Promise<AiSuggestion[]> {
    return [
      {
        id: "ai-disabled",
        kind: "summarize-note",
        title: "AI provider not configured",
        rationale:
          "Essai works without AI. Configure a provider to receive reviewable organization suggestions.",
      },
    ];
  }
}

export function createLocalHeuristicSuggestions(
  content: string,
): AiSuggestion[] {
  const claims = content
    .split("\n")
    .filter((line) => /\b(is|are|causes|proves|means|therefore)\b/i.test(line))
    .slice(0, 5);
  return claims.map((claim, index) => ({
    id: `claim-${index}`,
    kind: "extract-claims",
    title: "Claim may need evidence",
    rationale: claim.trim(),
    diff: `+ - [ ] ${claim.replace(/^[-*\s]+/, "").trim()}`,
    targetPath: "sources/Claims.md",
  }));
}
