import { readBookFile, listBookFiles } from "@/lib/projects/files";
import type { FileNode, StorageProvider } from "@/lib/storage/types";
import { parseResearchCard, type ResearchCard } from "@/lib/codex/cards";

export interface Relationship {
  from: string;
  to: string;
  kind:
    | "card-source"
    | "card-concept"
    | "card-claim"
    | "card-chapter"
    | "card-note"
    | "card-object";
}

export interface RelatedCodexResult {
  cards: ResearchCard[];
  relationships: Relationship[];
}

export async function readCodexCards(
  storage: StorageProvider,
  bookId: string,
): Promise<ResearchCard[]> {
  const nodes = await listBookFiles(storage, bookId);
  const files = flatten(nodes)
    .filter(
      (node) =>
        node.kind === "file" &&
        node.path.includes("/codex/cards/") &&
        node.path.endsWith(".md"),
    )
    .map((node) => node.path.replace(/^projects\/[^/]+\//, ""));

  const cards = await Promise.all(
    files.map(async (path) => parseResearchCard(path, await readBookFile(storage, bookId, path))),
  );
  return cards.sort((a, b) => a.title.localeCompare(b.title));
}

export function cardRelationships(card: ResearchCard): Relationship[] {
  const relationships: Relationship[] = [];
  const add = (to: string | undefined, kind: Relationship["kind"]) => {
    if (!to) return;
    relationships.push({ from: card.path, to, kind });
  };

  card.sources.forEach((source) => add(source.sourcePath, "card-source"));
  card.relatedConcepts?.forEach((concept) => add(concept, "card-concept"));
  card.relatedClaims?.forEach((claim) => add(claim, "card-claim"));
  card.relatedChapters?.forEach((chapter) => add(chapter, "card-chapter"));
  card.relatedNotes?.forEach((note) => add(note, "card-note"));
  card.relatedObjects?.forEach((object) => add(object, "card-object"));

  return dedupeRelationships(relationships);
}

export function backlinks(cards: ResearchCard[], target: string) {
  const normalized = normalize(target);
  return cards.filter((card) =>
    cardRelationships(card).some(
      (relationship) => normalize(relationship.to) === normalized,
    ),
  );
}

export function related(cards: ResearchCard[], query: string): RelatedCodexResult {
  const normalized = normalize(query);
  const matchedCards = cards.filter((card) =>
    [
      card.title,
      card.type,
      card.excerpt,
      card.commentary,
      ...(card.relatedConcepts ?? []),
      ...(card.relatedClaims ?? []),
      ...(card.relatedChapters ?? []),
      ...(card.relatedNotes ?? []),
      ...(card.relatedObjects ?? []),
      ...card.sources.map((source) => source.sourcePath),
    ]
      .filter(Boolean)
      .some((value) => normalize(value).includes(normalized)),
  );

  return {
    cards: matchedCards,
    relationships: dedupeRelationships(matchedCards.flatMap(cardRelationships)),
  };
}

export function dedupeRelationships(relationships: Relationship[]) {
  const seen = new Set<string>();
  return relationships.filter((relationship) => {
    const key = `${relationship.from}\u0000${relationship.kind}\u0000${relationship.to}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalize(value?: string) {
  return (value ?? "").trim().toLowerCase().replace(/\.md$/, "");
}

function flatten(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) => [
    node,
    ...(node.children ? flatten(node.children) : []),
  ]);
}
