import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";

export async function renderMarkdown(markdown: string) {
  const file = await remark().use(remarkGfm).use(remarkHtml, { sanitize: false }).process(markdown);
  return String(file);
}

export function extractHeadings(markdown: string) {
  return markdown
    .split("\n")
    .map((line) => /^(#{1,4})\s+(.+)$/.exec(line))
    .filter((match): match is RegExpExecArray => Boolean(match))
    .map((match) => ({
      depth: match[1].length,
      text: match[2].replace(/[#*`_]/g, "").trim(),
      id: match[2]
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .trim()
        .replace(/\s+/g, "-"),
    }));
}
