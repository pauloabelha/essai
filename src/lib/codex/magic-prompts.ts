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
      "Write substantive findings to the center Codex workspace with <codex-workspace-replace> or <codex-workspace-append> while preserving useful existing human text.",
      "Keep the chat response to a compact summary of what you found or wrote.",
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
      "Write the accuracy review to the center Codex workspace as an accuracy section. Preserve useful existing human text.",
      "Keep the chat response short: summarize the main risk level and say that the detailed memo is in the scratchpad.",
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
    "Act as an expert prose editor for this book project.",
    "Infer the language and register from the manuscript itself; respond in the manuscript's primary language unless the user asks otherwise.",
    "Apply a high-end essay/book standard appropriate to that language: piauí-level literary-journal Portuguese for Portuguese, New Yorker-level literary essay prose for English, or the nearest equivalent for other languages.",
    "Read the selected manuscript sections in the context of the book/project, including the current Codex workspace and attached manuscript context.",
    "Check grammar, syntax, clarity, continuity, rhythm, paragraph flow, missing transitions, terminology drift, overclaiming, and places where the argument structure can be strengthened.",
    "Be short and precise. Prefer high-confidence observations over broad coverage.",
    "Do not guess at the author's intent. If an issue is uncertain, phrase it as a question or omit it.",
    "Do not perform a source-evidence search unless it is directly needed to understand project context.",
    "Do not rewrite the manuscript. Do not produce replacement paragraphs unless explicitly asked later.",
    "Write the prose review to the center Codex workspace as a concise prose-review section. Preserve useful existing human text.",
    "Keep the chat response short: summarize the editorial pass and point to the scratchpad.",
    "",
    "Return:",
    "1. High-level prose diagnosis.",
    "2. Local grammar, flow, and structure issues with section paths.",
    "3. Questions for the author.",
    "4. Optional Codex-note suggestions, not manuscript edits.",
    "",
    "Selected manuscript sections:",
    ...(input.sections?.length
      ? input.sections.map((path) => `- ${path}`)
      : ["- all manuscript sections"]),
  ].join("\n");
}
