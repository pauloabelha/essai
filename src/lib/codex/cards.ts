import type { StorageProvider } from "@/lib/storage/types";
import { bookFilePath } from "@/lib/projects/service";
import {
  normalizeProvenance,
  type SourceProvenance,
} from "@/lib/codex/provenance";

export type ResearchCardType =
  | "note"
  | "concept"
  | "claim"
  | "object"
  | "excerpt"
  | "source-link"
  | "chapter-reference"
  | "trail";

export interface ResearchCardInput {
  title: string;
  type: ResearchCardType;
  excerpt?: string;
  commentary?: string;
  sources?: Partial<SourceProvenance>[];
  relatedConcepts?: string[];
  relatedClaims?: string[];
  relatedChapters?: string[];
  relatedNotes?: string[];
  relatedObjects?: string[];
}

export interface ResearchCard extends Omit<ResearchCardInput, "sources"> {
  id: string;
  path: string;
  createdAt: string;
  updatedAt: string;
  sources: SourceProvenance[];
}

export interface CardWritePreview {
  path: string;
  content: string;
  card: ResearchCard;
}

export function buildResearchCard(
  input: ResearchCardInput,
  now = new Date(),
): ResearchCard {
  const title = input.title.trim();
  if (!title) throw new Error("Research cards require a title.");
  const id = slugifyCodexTitle(title);
  const timestamp = now.toISOString();

  return {
    id,
    path: `codex/cards/${id}.md`,
    title,
    type: input.type,
    excerpt: clean(input.excerpt),
    commentary: clean(input.commentary),
    sources: (input.sources ?? []).map((source) =>
      normalizeProvenance(source, now),
    ),
    relatedConcepts: uniqueClean(input.relatedConcepts),
    relatedClaims: uniqueClean(input.relatedClaims),
    relatedChapters: uniqueClean(input.relatedChapters),
    relatedNotes: uniqueClean(input.relatedNotes),
    relatedObjects: uniqueClean(input.relatedObjects),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function previewResearchCardWrite(
  input: ResearchCardInput,
  now = new Date(),
): CardWritePreview {
  const card = buildResearchCard(input, now);
  return {
    path: card.path,
    content: renderResearchCardMarkdown(card),
    card,
  };
}

export async function commitResearchCard(
  storage: StorageProvider,
  bookId: string,
  input: ResearchCardInput,
  now = new Date(),
): Promise<CardWritePreview> {
  const preview = previewResearchCardWrite(input, now);
  await storage.writeFile(bookFilePath(bookId, preview.path), preview.content);
  return preview;
}

export function renderResearchCardMarkdown(card: ResearchCard) {
  const frontmatter = {
    id: card.id,
    type: card.type,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    sources: card.sources,
    relatedConcepts: card.relatedConcepts ?? [],
    relatedClaims: card.relatedClaims ?? [],
    relatedChapters: card.relatedChapters ?? [],
    relatedNotes: card.relatedNotes ?? [],
    relatedObjects: card.relatedObjects ?? [],
  };

  const sections = [
    `---\n${JSON.stringify(frontmatter, null, 2)}\n---`,
    `# ${card.title}`,
    card.excerpt ? `## Excerpt\n\n${card.excerpt}` : "",
    card.commentary ? `## Commentary\n\n${card.commentary}` : "",
    card.sources.length
      ? `## Provenance\n\n${card.sources
          .map((source) => {
            const page = source.page ? ` p. ${source.page}` : "";
            const query = source.originatingQuery
              ? `; query: ${source.originatingQuery}`
              : "";
            return `- ${source.sourcePath}${page}; ${source.retrievalMethod}; ${source.timestamp}${query}`;
          })
          .join("\n")}`
      : "",
  ];

  return sections.filter(Boolean).join("\n\n") + "\n";
}

export function parseResearchCard(path: string, content: string): ResearchCard {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) throw new Error(`Codex card has no frontmatter: ${path}`);
  const data = JSON.parse(match[1]) as Partial<ResearchCard>;
  const title = match[2].match(/^#\s+(.+)$/m)?.[1]?.trim() ?? data.title;
  if (!title || !data.id || !data.type) {
    throw new Error(`Codex card is missing required metadata: ${path}`);
  }

  return {
    id: data.id,
    path,
    title,
    type: data.type,
    excerpt: section(match[2], "Excerpt"),
    commentary: section(match[2], "Commentary"),
    sources: (data.sources ?? []) as SourceProvenance[],
    relatedConcepts: data.relatedConcepts ?? [],
    relatedClaims: data.relatedClaims ?? [],
    relatedChapters: data.relatedChapters ?? [],
    relatedNotes: data.relatedNotes ?? [],
    relatedObjects: data.relatedObjects ?? [],
    createdAt: data.createdAt ?? "",
    updatedAt: data.updatedAt ?? "",
  };
}

export function slugifyCodexTitle(title: string) {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 80) || "untitled-card"
  );
}

export function uniqueClean(values?: string[]) {
  return [...new Set((values ?? []).map(clean).filter(Boolean) as string[])];
}

function clean(value?: string) {
  const next = value?.trim();
  return next || undefined;
}

function section(markdown: string, heading: string) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(
    new RegExp(`^## ${escaped}\\n\\n([\\s\\S]*?)(?=\\n## |$)`, "m"),
  );
  return clean(match?.[1]);
}
