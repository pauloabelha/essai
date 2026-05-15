import { flattenFiles } from "@/lib/markdown/wiki";
import { readBookFile, listBookFiles } from "@/lib/projects/files";
import { bookRoot } from "@/lib/projects/service";
import {
  readOrRefreshStudySourceIndex,
  type StudyIndexChunk,
} from "@/lib/study/source-index";
import type { StorageProvider } from "@/lib/storage/types";

export interface StudyPassage {
  id: string;
  quote: string;
  sourceFile: string;
  sourceType: string;
  page: string;
  confidence: "High" | "Medium" | "Low";
  retrievalMethod: string;
}

export interface StudyObject {
  path: string;
  title: string;
  excerpt: string;
}

export interface StudyGraphNode {
  id: string;
  label: string;
  kind: "concept" | "source" | "claim" | "object";
}

export interface StudyGraphLink {
  from: string;
  to: string;
  strength: "primary" | "secondary";
}

export interface StudyInvestigation {
  query: string;
  title: string;
  summary: string;
  relatedConcepts: string[];
  sourceCoverage: {
    sources: number;
    chunks: number;
    files: number;
    scope: string;
  };
  directReferences: StudyPassage[];
  conceptualEchoes: string[];
  claims: StudyPassage[];
  relatedObjects: StudyObject[];
  graph: {
    nodes: StudyGraphNode[];
    links: StudyGraphLink[];
  };
  auditLog: string[];
}

const SEMANTIC_NEIGHBORS: Record<string, string[]> = {
  programmable: [
    "automata",
    "instruction",
    "instructions",
    "encoded",
    "repeatable",
    "program",
    "stored",
    "patterned",
  ],
  machines: [
    "mechanism",
    "mechanical",
    "machinery",
    "loom",
    "looms",
    "calculator",
    "automaton",
    "automata",
  ],
  computation: [
    "calculation",
    "calculator",
    "symbolic",
    "cybernetics",
    "algorithm",
  ],
  source: ["evidence", "quote", "citation", "paper", "book"],
};

const DEFAULT_ECHOES = [
  "automata",
  "symbolic systems",
  "mechanical computation",
  "cybernetics",
  "Jacquard mechanisms",
  "stored instructions",
];

export async function buildStudyInvestigation(
  storage: StorageProvider,
  bookId: string,
  input: {
    query?: string;
    exhaustive?: boolean;
    sourcePaths?: string[];
  } = {},
): Promise<StudyInvestigation> {
  const query = (input.query ?? "").trim() || "sources";
  const exhaustive = input.exhaustive ?? true;
  const selectedSources = new Set(input.sourcePaths ?? []);
  const files = flattenFiles(await listBookFiles(storage, bookId)).filter(
    (node) => node.kind === "file",
  );
  const projectPrefix = `${bookRoot(bookId)}/`;
  const cleanPath = (path: string) => path.replace(projectPrefix, "");
  const sourceFiles = files
    .map((file) => cleanPath(file.path))
    .filter((path) => path.startsWith("sources/"));
  const sourceMarkdown = sourceFiles.filter(
    (path) =>
      path.endsWith(".md") &&
      (!selectedSources.size || selectedSources.has(path)),
  );
  const uploadedFiles = sourceFiles.filter((path) =>
    path.startsWith("sources/files/"),
  );
  const index = await readOrRefreshStudySourceIndex(storage, bookId);
  const chunks = index.chunks.filter(
    (chunk) =>
      sourceMarkdown.includes(chunk.path) ||
      (!selectedSources.size && chunk.path.startsWith("sources/files/")),
  );
  const claims = chunks.filter((chunk) => chunk.path === "sources/Claims.md");
  const objectFiles = files
    .map((file) => cleanPath(file.path))
    .filter((path) => path.startsWith("objects/") && path.endsWith(".md"));
  const objects = await Promise.all(
    objectFiles.map(async (path) => ({
      path,
      content: await readBookFile(storage, bookId, path),
    })),
  );

  const ranked = rankChunks(chunks, query, exhaustive);
  const directReferences = ranked
    .filter((chunk) => chunk.score > 0)
    .slice(0, exhaustive ? 8 : 5)
    .map((chunk) => passageFromChunk(chunk.chunk, query, chunk.score));
  const claimReferences = rankChunks(claims, query, exhaustive)
    .filter((chunk) => chunk.score > 0 || exhaustive)
    .slice(0, 5)
    .map((chunk) => passageFromChunk(chunk.chunk, query, chunk.score || 1));
  const relatedObjects = rankObjects(objects, query).slice(0, 6);
  const relatedConcepts = deriveRelatedConcepts(
    query,
    ranked.map((item) => item.chunk.text),
  );
  const conceptualEchoes = deriveEchoes(
    query,
    ranked.map((item) => item.chunk.text),
  );

  return {
    query,
    title: titleCase(query),
    summary: summarizeInvestigation(query, directReferences, relatedObjects),
    relatedConcepts,
    sourceCoverage: {
      sources: sourceMarkdown.length,
      chunks: chunks.length,
      files: uploadedFiles.length,
      scope: exhaustive
        ? selectedSources.size
          ? `Exhaustive scholarly audit across ${selectedSources.size} selected source index${selectedSources.size === 1 ? "" : "es"}`
          : "Exhaustive scholarly audit across /sources"
        : selectedSources.size
          ? `Fast semantic search across ${selectedSources.size} selected source index${selectedSources.size === 1 ? "" : "es"}`
          : "Fast semantic search across indexed source passages",
    },
    directReferences,
    conceptualEchoes,
    claims: claimReferences,
    relatedObjects,
    graph: buildGraph(query, directReferences, claimReferences, relatedObjects),
    auditLog: [
      `Read ${sourceMarkdown.length} Markdown index${sourceMarkdown.length === 1 ? "" : "es"} from /sources.`,
      `Identified ${uploadedFiles.length} uploaded source files.`,
      `Examined ${chunks.length} indexed source chunks${exhaustive ? " sequentially for recall" : " with fast scoring"}.`,
      `Study index refreshed at ${index.updatedAt}.`,
      `Connected ${relatedObjects.length} related object records from /objects.`,
    ],
  };
}

function rankChunks(
  chunks: StudyIndexChunk[],
  query: string,
  exhaustive: boolean,
) {
  const terms = semanticTerms(query);
  return chunks
    .map((chunk, index) => ({
      chunk,
      score:
        scoreText(`${chunk.path}\n${chunk.text}`, terms) +
        (exhaustive ? 0.05 / (index + 1) : 0),
    }))
    .sort(
      (a, b) => b.score - a.score || a.chunk.path.localeCompare(b.chunk.path),
    );
}

function rankObjects(
  objects: Array<{ path: string; content: string }>,
  query: string,
): StudyObject[] {
  const terms = semanticTerms(query);
  return objects
    .map((object) => ({
      object,
      score: scoreText(`${object.path}\n${object.content}`, terms),
    }))
    .filter((item) => item.score > 0)
    .sort(
      (a, b) => b.score - a.score || a.object.path.localeCompare(b.object.path),
    )
    .map(({ object }) => ({
      path: object.path,
      title: titleCase(
        object.path.split("/").at(-1)?.replace(/\.md$/, "") ?? object.path,
      ),
      excerpt: firstParagraph(object.content),
    }));
}

function passageFromChunk(
  chunk: StudyIndexChunk,
  query: string,
  score: number,
): StudyPassage {
  return {
    id: chunk.id,
    quote: excerptFor(chunk.text, semanticTerms(query)),
    sourceFile: chunk.path,
    sourceType: chunk.sourceType,
    page: chunk.page,
    confidence: score > 4 ? "High" : score > 1.5 ? "Medium" : "Low",
    retrievalMethod: "Hybrid lexical and semantic-neighbor retrieval",
  };
}

function buildGraph(
  query: string,
  direct: StudyPassage[],
  claims: StudyPassage[],
  objects: StudyObject[],
) {
  const nodes: StudyGraphNode[] = [
    { id: "concept", label: titleCase(query), kind: "concept" },
  ];
  const links: StudyGraphLink[] = [];
  const addLink = (link: StudyGraphLink) => {
    const existing = links.find(
      (item) => item.from === link.from && item.to === link.to,
    );
    if (!existing) {
      links.push(link);
      return;
    }
    if (existing.strength === "secondary" && link.strength === "primary") {
      existing.strength = "primary";
    }
  };
  for (const passage of direct.slice(0, 5)) {
    const id = `source:${passage.sourceFile}`;
    if (!nodes.some((node) => node.id === id)) {
      nodes.push({
        id,
        label: passage.sourceFile.replace(/^sources\//, ""),
        kind: "source",
      });
    }
    addLink({
      from: "concept",
      to: id,
      strength: passage.confidence === "High" ? "primary" : "secondary",
    });
  }
  for (const claim of claims.slice(0, 3)) {
    const id = `claim:${claim.id}`;
    nodes.push({ id, label: claim.quote.slice(0, 54), kind: "claim" });
    addLink({ from: "concept", to: id, strength: "secondary" });
  }
  for (const object of objects.slice(0, 4)) {
    const id = `object:${object.path}`;
    nodes.push({ id, label: object.title, kind: "object" });
    addLink({ from: "concept", to: id, strength: "secondary" });
  }
  return { nodes, links };
}

function semanticTerms(query: string) {
  const base = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return [
    ...new Set(
      base.flatMap((term) => [term, ...(SEMANTIC_NEIGHBORS[term] ?? [])]),
    ),
  ];
}

function scoreText(text: string, terms: string[]) {
  const haystack = text.toLowerCase();
  return terms.reduce((score, term, index) => {
    const hits = haystack.split(term).length - 1;
    return score + hits * (index < 3 ? 2 : 0.85);
  }, 0);
}

function deriveRelatedConcepts(query: string, passages: string[]) {
  const terms = semanticTerms(query);
  const candidates = [...DEFAULT_ECHOES, ...terms]
    .filter((term) => !query.toLowerCase().includes(term.toLowerCase()))
    .filter(
      (term) =>
        passages.join("\n").toLowerCase().includes(term.split(" ")[0]) ||
        DEFAULT_ECHOES.includes(term),
    );
  return [...new Set(candidates)].slice(0, 8);
}

function deriveEchoes(query: string, passages: string[]) {
  const text = passages.join("\n").toLowerCase();
  const echoes = DEFAULT_ECHOES.filter(
    (echo) =>
      text.includes(echo.split(" ")[0]) ||
      query.toLowerCase().includes("programmable"),
  );
  return [
    ...new Set(echoes.length ? echoes : deriveRelatedConcepts(query, passages)),
  ].slice(0, 8);
}

function summarizeInvestigation(
  query: string,
  direct: StudyPassage[],
  objects: StudyObject[],
) {
  if (!direct.length && !objects.length) {
    return "The source archive has not yet produced strong evidence for this concept. Study mode keeps the inquiry grounded in /sources and records the current coverage plainly.";
  }
  const sourceCount = new Set(direct.map((item) => item.sourceFile)).size;
  const objectCount = objects.length;
  return `${titleCase(query)} is being read through ${sourceCount} source index${sourceCount === 1 ? "" : "es"} and ${objectCount} connected object record${objectCount === 1 ? "" : "s"}. The investigation favors cited passages and archival adjacency over generated prose.`;
}

function excerptFor(text: string, terms: string[]) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  const lower = oneLine.toLowerCase();
  const hit = terms.find((term) => lower.includes(term));
  if (!hit) return oneLine.slice(0, 260);
  const index = lower.indexOf(hit);
  const start = Math.max(0, index - 90);
  const end = Math.min(oneLine.length, index + 220);
  return `${start ? "..." : ""}${oneLine.slice(start, end)}${end < oneLine.length ? "..." : ""}`;
}

function firstParagraph(content: string) {
  return (
    content
      .replace(/^#\s+.+$/m, "")
      .split(/\n{2,}/)
      .map((part) => part.trim())
      .find(Boolean) ?? ""
  );
}

function titleCase(value: string) {
  return value
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}
