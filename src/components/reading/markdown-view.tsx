"use client";

import { useMemo } from "react";
import { extractHeadings } from "@/lib/markdown/render";

function inlineMarkdown(text: string) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(
      /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g,
      (_match, target: string, alias?: string) =>
        `<button class="wiki-link" data-wiki="${target}">${alias || target}</button>`,
    );
}

export function MarkdownView({
  markdown,
  reading = false,
  onWikiClick,
}: {
  markdown: string;
  reading?: boolean;
  onWikiClick?: (target: string) => void;
}) {
  const html = useMemo(() => renderBasicMarkdown(markdown), [markdown]);
  const headings = useMemo(() => extractHeadings(markdown), [markdown]);

  return (
    <div className={reading ? "reading-shell" : "preview-shell"}>
      {reading && headings.length > 1 ? (
        <nav className="reading-toc" aria-label="Table of contents">
          {headings.map((heading) => (
            <a
              key={`${heading.id}-${heading.text}`}
              href={`#${heading.id}`}
              style={{ paddingLeft: `${(heading.depth - 1) * 10}px` }}
            >
              {heading.text}
            </a>
          ))}
        </nav>
      ) : null}
      <article
        className={reading ? "prose-reading" : "prose-preview"}
        onClick={(event) => {
          const target = event.target as HTMLElement;
          const link = target.closest<HTMLButtonElement>("[data-wiki]");
          if (link) onWikiClick?.(link.dataset.wiki ?? "");
        }}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}

function renderBasicMarkdown(markdown: string) {
  const lines = markdown.split("\n");
  const output: string[] = [];
  let inList = false;
  let inQuote = false;
  let inCode = false;
  let code: string[] = [];

  const closeList = () => {
    if (inList) {
      output.push("</ul>");
      inList = false;
    }
  };
  const closeQuote = () => {
    if (inQuote) {
      output.push("</blockquote>");
      inQuote = false;
    }
  };

  for (const line of lines) {
    if (line.startsWith("```")) {
      if (inCode) {
        output.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = [];
        inCode = false;
      } else {
        closeList();
        closeQuote();
        inCode = true;
      }
      continue;
    }
    if (inCode) {
      code.push(line);
      continue;
    }
    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      closeQuote();
      const level = heading[1].length;
      const id = heading[2].toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-");
      output.push(`<h${level} id="${id}">${inlineMarkdown(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      closeList();
      if (!inQuote) {
        output.push("<blockquote>");
        inQuote = true;
      }
      output.push(`<p>${inlineMarkdown(escapeHtml(line.replace(/^>\s?/, "")))}</p>`);
      continue;
    }
    if (/^[-*]\s+/.test(line)) {
      closeQuote();
      if (!inList) {
        output.push("<ul>");
        inList = true;
      }
      output.push(`<li>${inlineMarkdown(escapeHtml(line.replace(/^[-*]\s+/, "")))}</li>`);
      continue;
    }
    if (!line.trim()) {
      closeList();
      closeQuote();
      continue;
    }
    closeList();
    closeQuote();
    output.push(`<p>${inlineMarkdown(escapeHtml(line))}</p>`);
  }
  closeList();
  closeQuote();
  return output.join("\n");
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
