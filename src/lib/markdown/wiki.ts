import type { FileNode } from "@/lib/storage/types";

export interface WikiLink {
  raw: string;
  target: string;
  alias?: string;
  index: number;
}

export interface LinkAnalysis {
  outgoing: WikiLink[];
  backlinks: Array<{ path: string; links: WikiLink[] }>;
  broken: WikiLink[];
}

const WIKI_LINK_PATTERN = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export function parseWikiLinks(markdown: string): WikiLink[] {
  return [...markdown.matchAll(WIKI_LINK_PATTERN)].map((match) => ({
    raw: match[0],
    target: match[1].trim(),
    alias: match[2]?.trim(),
    index: match.index ?? 0,
  }));
}

export function flattenFiles(nodes: FileNode[]): FileNode[] {
  return nodes.flatMap((node) => [
    node,
    ...(node.children ? flattenFiles(node.children) : []),
  ]);
}

export function slugFromPath(path: string) {
  return path
    .split("/")
    .at(-1)!
    .replace(/\.mdx?$/i, "")
    .toLowerCase();
}

export function resolveWikiTarget(target: string, files: string[]) {
  const normalized = target.toLowerCase().replace(/\.mdx?$/i, "");
  return (
    files.find((file) => file.toLowerCase().replace(/\.mdx?$/i, "") === normalized) ??
    files.find((file) => slugFromPath(file) === normalized) ??
    null
  );
}

export function analyzeLinks(
  currentPath: string,
  currentMarkdown: string,
  allFiles: Array<{ path: string; content: string }>,
): LinkAnalysis {
  const markdownFiles = allFiles.map((file) => file.path).filter((file) => file.endsWith(".md"));
  const outgoing = parseWikiLinks(currentMarkdown);
  const broken = outgoing.filter((link) => !resolveWikiTarget(link.target, markdownFiles));
  const backlinks = allFiles
    .filter((file) => file.path !== currentPath && file.path.endsWith(".md"))
    .map((file) => ({
      path: file.path,
      links: parseWikiLinks(file.content).filter(
        (link) => resolveWikiTarget(link.target, markdownFiles) === currentPath,
      ),
    }))
    .filter((entry) => entry.links.length > 0);
  return { outgoing, backlinks, broken };
}
