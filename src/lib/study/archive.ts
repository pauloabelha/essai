import { flattenFiles } from "@/lib/markdown/wiki";
import { readBookFile, listBookFiles } from "@/lib/projects/files";
import { bookRoot } from "@/lib/projects/service";
import { createLogger } from "@/lib/server/log";
import {
  readOrRefreshStudySourceIndex,
  type StudyIndexChunk,
  type StudySourceIndex,
} from "@/lib/study/source-index";
import type { StorageProvider } from "@/lib/storage/types";

const log = createLogger("study:archive");

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
    matches: number;
    exactMatches: number;
    lexicalMatches: number;
    semanticMatches: number;
    scope: string;
  };
  directReferences: StudyPassage[];
  conceptualEchoes: string[];
  claims: StudyPassage[];
  relatedObjects: StudyObject[];
  selectedSource: StudySelectedSource | null;
  graph: {
    nodes: StudyGraphNode[];
    links: StudyGraphLink[];
  };
  auditLog: string[];
}

export interface StudySelectedSource {
  path: string;
  title: string;
  kind: "markdown" | "upload";
  sourceType: string;
  mimeType: string;
  sizeBytes: number;
  text: string;
  extraction: string;
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

type RetrievalMethod = "Exact Match" | "Lexical Match" | "Semantic Neighbor";

interface RankedChunk {
  chunk: StudyIndexChunk;
  index: number;
  score: number;
  retrievalMethod: RetrievalMethod;
}

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
  log.info("investigation requested", {
    bookId,
    query,
    exhaustive,
    selectedSources: [...selectedSources],
  });
  const files = flattenFiles(await listBookFiles(storage, bookId)).filter(
    (node) => node.kind === "file",
  );
  const projectPrefix = `${bookRoot(bookId)}/`;
  const cleanPath = (path: string) => path.replace(projectPrefix, "");
  const sourceFiles = files
    .map((file) => cleanPath(file.path))
    .filter((path) => path.startsWith("sources/"));
  const uploadedFiles = sourceFiles.filter((path) =>
    path.startsWith("sources/files/"),
  );
  const sourceMarkdown = sourceFiles.filter(
    (path) =>
      path.endsWith(".md") &&
      (!selectedSources.size || selectedSources.has(path)),
  );
  const selectedUploadedFiles = uploadedFiles.filter((path) =>
    selectedSources.has(path),
  );
  const index = await readOrRefreshStudySourceIndex(storage, bookId);
  const selectedSource =
    selectedSources.size === 1
      ? selectedSourceFromIndex(index, [...selectedSources][0])
      : null;
  log.info("investigation scope resolved", {
    bookId,
    sourceMarkdown: sourceMarkdown.length,
    uploadedFiles: uploadedFiles.length,
    selectedUploadedFiles: selectedUploadedFiles.length,
    selectedSource: selectedSource?.path ?? null,
    indexDocuments: index.documents.length,
    indexChunks: index.chunks.length,
  });
  const chunks = index.chunks.filter(
    (chunk) =>
      sourceMarkdown.includes(chunk.path) ||
      (!selectedSources.size && chunk.path.startsWith("sources/files/")) ||
      selectedUploadedFiles.includes(chunk.path) ||
      (!selectedSources.size && chunk.path === "notes.md") ||
      (chunk.path === "notes.md" &&
        selectedSources.has(String(chunk.metadata.sourcePath ?? ""))),
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

  const ranked = rankChunks(chunks, query);
  const positiveRanked = ranked.filter((chunk) => chunk.score > 0);
  log.info("chunks ranked", {
    query,
    candidates: chunks.length,
    positive: positiveRanked.length,
    top: ranked.slice(0, 5).map((item) => ({
      path: item.chunk.path,
      sourceType: item.chunk.sourceType,
      score: Number(item.score.toFixed(2)),
      method: item.retrievalMethod,
      text: item.chunk.text.slice(0, 90),
    })),
  });
  const directReferences = ranked
    .filter(
      (chunk) => chunk.score > 0 && chunk.chunk.path !== "sources/Claims.md",
    )
    .slice(0, exhaustive ? 8 : 5)
    .map((chunk) =>
      passageFromChunk(chunk.chunk, query, chunk.score, chunk.retrievalMethod),
    );
  const claimReferences = rankChunks(claims, query)
    .filter((chunk) => chunk.score > 0)
    .slice(0, 5)
    .map((chunk) =>
      passageFromChunk(chunk.chunk, query, chunk.score, chunk.retrievalMethod),
    );
  const relatedObjects = rankObjects(objects, query).slice(0, 6);
  const evidenceTexts = positiveRanked.map((item) => item.chunk.text);
  const relatedConcepts = deriveRelatedConcepts(query, evidenceTexts);
  const conceptualEchoes = deriveEchoes(query, evidenceTexts);
  const exactMatches = positiveRanked.filter(
    (item) => item.retrievalMethod === "Exact Match",
  ).length;
  const lexicalMatches = positiveRanked.filter(
    (item) => item.retrievalMethod === "Lexical Match",
  ).length;
  const semanticMatches = positiveRanked.filter(
    (item) => item.retrievalMethod === "Semantic Neighbor",
  ).length;

  return {
    query,
    title: titleCase(query),
    summary: summarizeInvestigation(query, directReferences, relatedObjects),
    relatedConcepts,
    sourceCoverage: {
      sources: sourceMarkdown.length,
      chunks: chunks.length,
      files: selectedSources.size
        ? selectedUploadedFiles.length
        : uploadedFiles.length,
      matches: positiveRanked.length,
      exactMatches,
      lexicalMatches,
      semanticMatches,
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
    selectedSource,
    graph: buildGraph(query, directReferences, claimReferences, relatedObjects),
    auditLog: [
      `Read ${sourceMarkdown.length} Markdown index${sourceMarkdown.length === 1 ? "" : "es"} from /sources.`,
      `Identified ${uploadedFiles.length} uploaded source files.`,
      `Examined ${chunks.length} indexed source chunks${exhaustive ? " sequentially for recall" : " with fast scoring"}.`,
      `Found ${positiveRanked.length} relevant passage${positiveRanked.length === 1 ? "" : "s"}: ${exactMatches} exact, ${lexicalMatches} lexical, ${semanticMatches} semantic-neighbor.`,
      `Study index refreshed at ${index.updatedAt}.`,
      `Connected ${relatedObjects.length} related object records from /objects.`,
    ],
  };
}

function selectedSourceFromIndex(
  index: StudySourceIndex,
  path: string,
): StudySelectedSource | null {
  const document = index.documents.find((item) => item.path === path);
  if (!document) return null;
  return {
    path: document.path,
    title: document.title,
    kind: document.kind,
    sourceType: document.sourceType,
    mimeType: document.mimeType,
    sizeBytes: document.sizeBytes,
    text: document.searchText,
    extraction: String(document.metadata.extraction ?? "markdown"),
  };
}

function rankChunks(chunks: StudyIndexChunk[], query: string): RankedChunk[] {
  const terms = queryTerms(query);
  return chunks
    .map((chunk, index) => {
      const result = scoreText(chunk.text, terms);
      return {
        chunk,
        index,
        ...result,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.index - b.index ||
        a.chunk.path.localeCompare(b.chunk.path),
    );
}

function rankObjects(
  objects: Array<{ path: string; content: string }>,
  query: string,
): StudyObject[] {
  const terms = queryTerms(query);
  return objects
    .map((object) => ({
      object,
      score: scoreText(`${object.path}\n${object.content}`, terms).score,
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
  retrievalMethod: RetrievalMethod,
): StudyPassage {
  return {
    id: chunk.id,
    quote: excerptFor(chunk.text, excerptTerms(query)),
    sourceFile:
      chunk.sourceType === "note" && chunk.metadata.sourcePath
        ? String(chunk.metadata.sourcePath)
        : chunk.path,
    sourceType: chunk.sourceType,
    page: chunk.page,
    confidence: score > 4 ? "High" : score > 1.5 ? "Medium" : "Low",
    retrievalMethod,
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

function queryTerms(query: string) {
  const literal = normalizeText(query);
  const base = tokenize(query);
  const semantic = [
    ...new Set(base.flatMap((term) => SEMANTIC_NEIGHBORS[term] ?? [])),
  ];
  return { literal, base, semantic };
}

function scoreText(text: string, terms: ReturnType<typeof queryTerms>) {
  const haystack = normalizeText(text);
  const words = tokenize(text);
  const wordStems = words.map(stemTerm);
  let exact = 0;
  let lexical = 0;
  let semantic = 0;

  if (
    terms.literal &&
    terms.literal.length > 2 &&
    haystack.includes(terms.literal)
  ) {
    exact += terms.base.length > 1 ? 8 : 4;
  }

  for (const [index, term] of terms.base.entries()) {
    const occurrences = countOccurrences(haystack, term);
    exact += occurrences * (index < 3 ? 2 : 1);

    const stem = stemTerm(term);
    if (stem.length > 3) {
      lexical += wordStems.filter((wordStem) => wordStem === stem).length * 0.8;
    }

    if (term.length > 4) {
      lexical +=
        words.filter((word) => word !== term && editDistance(word, term) <= 1)
          .length * 0.7;
    }
  }

  for (const term of terms.semantic) {
    semantic += countOccurrences(haystack, term) * 0.85;
  }

  const score = exact + lexical + semantic;
  return {
    score,
    retrievalMethod: dominantMethod(exact, lexical, semantic),
  };
}

function dominantMethod(
  exact: number,
  lexical: number,
  semantic: number,
): RetrievalMethod {
  if (exact >= lexical && exact >= semantic && exact > 0) return "Exact Match";
  if (lexical >= semantic && lexical > 0) return "Lexical Match";
  return semantic > 0 ? "Semantic Neighbor" : "Lexical Match";
}

function deriveRelatedConcepts(query: string, passages: string[]) {
  const terms = excerptTerms(query);
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

function excerptTerms(query: string) {
  const terms = queryTerms(query);
  return [...new Set([...terms.base, ...terms.semantic])];
}

function normalizeText(text: string) {
  return tokenize(text).join(" ");
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function stemTerm(term: string) {
  if (term.length > 5 && term.endsWith("ies")) return `${term.slice(0, -3)}y`;
  if (term.length > 5 && term.endsWith("ing")) return term.slice(0, -3);
  if (term.length > 4 && term.endsWith("ed")) return term.slice(0, -2);
  if (term.length > 4 && term.endsWith("es")) return term.slice(0, -2);
  if (term.length > 3 && term.endsWith("s")) return term.slice(0, -1);
  return term;
}

function countOccurrences(text: string, term: string) {
  if (!term) return 0;
  return text.split(term).length - 1;
}

function editDistance(a: string, b: string) {
  if (Math.abs(a.length - b.length) > 1) return 2;
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let last = i - 1;
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const next = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        last + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      last = next;
    }
  }
  return previous[b.length];
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
