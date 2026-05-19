export interface CodexTrail {
  title: string;
  cards: string[];
  sources: string[];
  chapters: string[];
}

export function renderTrailMarkdown(trail: CodexTrail) {
  return [
    `# ${trail.title}`,
    "## Cards",
    ...trail.cards.map((card) => `- ${card}`),
    "## Sources",
    ...trail.sources.map((source) => `- ${source}`),
    "## Chapters",
    ...trail.chapters.map((chapter) => `- ${chapter}`),
  ].join("\n");
}
