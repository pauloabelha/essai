export type CodexMagicAction =
  | "search-sources"
  | "check-accuracy"
  | "check-prose";

export interface CodexMagicPromptInput {
  query?: string;
  sources?: string[];
  sections?: string[];
}

export function buildCodexMagicPrompt(
  action: CodexMagicAction,
  input: CodexMagicPromptInput,
) {
  if (action === "search-sources") {
    return [
      "Codex magic action: Search in sources.",
      "",
      "Use Essai's Study retrieval context and, when needed, read the selected source files directly.",
      "Return source-grounded results only. Include source paths, pages or locations when available, and a short note on confidence.",
      "Do not edit manuscript files. Do not invent evidence. If the selected sources do not answer the query, say what is missing.",
      "If the findings should be preserved for continued inquiry, update the center Codex workspace with <codex-workspace-replace> or <codex-workspace-append> while preserving useful existing human text.",
      "",
      `Search query: ${input.query?.trim() || "(none provided)"}`,
      "",
      "Selected sources:",
      ...(input.sources?.length
        ? input.sources.map((path) => `- ${path}`)
        : ["- all indexed sources"]),
    ].join("\n");
  }

  if (action === "check-accuracy") {
    return [
      "Codex magic action: Check accuracy.",
      "",
      "Examine the selected manuscript sections against the project sources, notes, claims, and Codex workspace.",
      "Identify factual claims, source dependencies, weakly supported statements, contradictions, and places that need citation.",
      "Use source-grounded evidence where available. Cite project file paths and source paths. Do not rewrite manuscript prose.",
      "If a durable working memo would help, update the center Codex workspace with an accuracy section. Preserve useful existing human text.",
      "",
      "Return:",
      "1. Accuracy risks, ordered by severity.",
      "2. Claims that appear supported, with source pointers.",
      "3. Claims needing evidence.",
      "4. Suggested Codex workspace notes or follow-up searches, if useful.",
      "",
      "Selected manuscript sections:",
      ...(input.sections?.length
        ? input.sections.map((path) => `- ${path}`)
        : ["- all manuscript sections"]),
    ].join("\n");
  }

  return [
    "Codex magic action: Check prose.",
    "",
    "Read the selected manuscript sections as prose, but preserve Essai's authorship boundary.",
    "Do not rewrite the manuscript. Do not produce replacement paragraphs unless explicitly asked later.",
    "Comment on clarity, continuity, rhythm, overclaiming, missing transitions, terminology drift, and places where argument structure can be strengthened.",
    "When relevant, connect prose observations to notes, concepts, claims, or source context from the project.",
    "If useful, update the center Codex workspace with a prose-review section. Preserve useful existing human text.",
    "",
    "Return:",
    "1. High-level prose diagnosis.",
    "2. Local issues with section paths.",
    "3. Questions for the author.",
    "4. Optional Codex-note suggestions, not manuscript edits.",
    "",
    "Selected manuscript sections:",
    ...(input.sections?.length
      ? input.sections.map((path) => `- ${path}`)
      : ["- all manuscript sections"]),
  ].join("\n");
}
