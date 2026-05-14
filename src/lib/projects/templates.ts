export interface BookMetadata {
  id: string;
  title: string;
  subtitle: string;
  language: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
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

export function createBookMetadata(title: string, language = "pt-BR"): BookMetadata {
  const now = new Date().toISOString();
  return {
    id: slugifyBookId(title),
    title,
    subtitle: "",
    language,
    createdAt: now,
    updatedAt: now,
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
- manuscript/ contains canonical draft material.
- inbox/current-notes.md receives quick, unprocessed thoughts before classification.
- inbox/ may also contain older or specialized inbox files.
- concepts/ defines ideas that recur across the work.
- objects/ gathers historical, technical, or material examples.
- essays/ holds exploratory prose outside the sacred manuscript.
- formulations/ keeps compressed sentences and working definitions.
- sources/ grounds claims in books, papers, quotations, and evidence.

## Workflow
- Draft in manuscript/
- Capture fragments into inbox/current-notes.md
- Refine concepts/
- Ground claims in sources/
- Use AI only for organization
`,
    "manuscript/main.md": `# ${title}

_Every word in this manuscript is written by the human author._

`,
    "manuscript/main.suggestions.md": `# Suggested manuscript diffs

AI suggestions for manuscript files belong here as reviewable proposals only. Never paste text into manuscript/main.md unless the human author accepts it manually.
`,
    "inbox/current-notes.md": `# Current Notes

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
    "essays/music-cylinder-essay-v1.md": `# Music cylinder essay v1

An exploratory essay outside the canonical manuscript.
`,
    "formulations/compression-sentences.md": `# Compression sentences

- Store candidate formulations here.
`,
    "sources/Books.md": `# Books

`,
    "sources/Papers.md": `# Papers

`,
    "sources/Quotes.md": `# Quotes

`,
    "sources/Claims.md": `# Claims

- [ ] Claims that need evidence.
`,
  };
}
