export interface BookMetadata {
  id: string;
  title: string;
  subtitle: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  sections?: ManuscriptSection[];
}

export interface ManuscriptSection {
  id: string;
  title: string;
  path: string;
  children?: ManuscriptSection[];
}

export function slugifyBookId(title: string) {
  return (
    title
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "untitled-book"
  );
}

export function createBookMetadata(
  title: string,
  language = "pt-BR",
): BookMetadata {
  const now = new Date().toISOString();
  return {
    id: slugifyBookId(title),
    title,
    subtitle: "",
    language,
    createdAt: now,
    updatedAt: now,
    sections: [
      {
        id: "main",
        title: "Main",
        path: "main.md",
      },
    ],
  };
}

export function initialBookFiles(book: BookMetadata): Record<string, string> {
  const title = book.title;
  return {
    "book.json": JSON.stringify(book, null, 2) + "\n",
    "README.md": `# ${title}

## What this project is
A self-contained Markdown vault for developing this book.

## Human-only manuscript rule
The manuscript is written only by the human author. AI may organize notes and suggest structure, but cannot silently rewrite manuscript prose.

## Folder structure
- main.md contains the book manuscript.
- notes.md receives quick, unprocessed notes before classification.
- concepts/ defines ideas that recur across the work.
- objects/ gathers historical, technical, or material examples.
- sources/ grounds claims in books, papers, quotations, and evidence.
- sources/files/raw/ stores uploaded source files captured through the interface.
- codex/cards/ stores source-grounded relationship cards.
- codex/history/ stores saved Codex panel conversations.
- drafts/ holds exploratory prose outside the canonical manuscript.
- fragments/ keeps compressed sentences and loose formulations.

## Workflow
- Draft in main.md
- Capture fragments into notes.md
- Refine concepts/
- Ground claims in sources/
- Use AI only for organization
`,
    "main.md": "",
    "main.suggestions.md": `# Suggested manuscript diffs

AI suggestions for manuscript files belong here as reviewable proposals only. Never paste text into main.md unless the human author accepts it manually.
`,
    "notes.md": `# Notes

Fast captures live here until the author decides where they belong.
`,
    "concepts/procedural-externalization.md": `# Procedural externalization

A working concept note.

## Links
[[behavior-portability]]
`,
    "concepts/behavior-portability.md": `# Behavior portability

A working concept note.
`,
    "concepts/represented-causality.md": `# Represented causality

A working concept note.
`,
    "objects/music-cylinder.md": `# Music cylinder

An object note for mechanical memory and repeatable performance.

Related: [[jacquard-loom]]
`,
    "objects/jacquard-loom.md": `# Jacquard loom

An object note for patterned instruction.
`,
    "objects/antikythera.md": `# Antikythera

An object note for ancient calculation and mechanism.
`,
    "drafts/music-cylinder-essay-v1.md": `# Music cylinder essay v1

An exploratory essay outside the canonical manuscript.
`,
    "fragments/compression-sentences.md": `# Compression sentences

- Store candidate formulations here.
`,
    "sources/Books.md": `# Books

`,
    "sources/Papers.md": `# Papers

`,
    "sources/Articles.md": `# Articles

`,
    "sources/Quotes.md": `# Quotes

`,
    "sources/Claims.md": `# Claims

- [ ] Claims that need evidence.
`,
    "sources/raw.md": `# Raw Sources

`,
    "sources/files/README.md": `# Source Files

Uploaded source files captured through the interface are stored in:

- raw/

The Markdown files in sources/ remain the readable index.
`,
    "codex/README.md": `# Codex

Codex cards, trails, sessions, and links live here as file-native scholarly apparatus.

- cards/ stores committed research cards.
- history/ stores saved Codex panel conversations.
- trails/ can hold intellectual lineages.
- sessions/ can hold saved scratch states.
- links/ can hold future relationship sidecars.
`,
  };
}
