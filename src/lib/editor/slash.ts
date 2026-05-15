export const slashSnippets: Record<string, string> = {
  claim: "> Claim:\n> Evidence needed:\n",
  source: "## Source\n\nCitation:\n\nNotes:\n",
  concept: "## Concept\n\nLinks:\n",
  object: "## Object\n\nWhy it matters:\n",
  question: "## Question\n\nWhat would answer it:\n",
};

export function expandSlashCommand(value: string) {
  return value.replace(
    /(^|\n)\/(claim|source|concept|object|question)(\s*)$/i,
    (_match, prefix: string, command: string) =>
      `${prefix}${slashSnippets[command.toLowerCase()] ?? ""}`,
  );
}
