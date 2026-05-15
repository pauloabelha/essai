# Essai

Essai is a quiet Markdown writing environment for long-form intellectual work.

It is built for books, essays, research notes, claims, objects, concepts, and formulations that should remain readable outside the application. The project is intentionally local-first and file-native: a book is a plain directory of Markdown files plus one `book.json` metadata file.

## Philosophy

Essai is not an AI writing app. It is a human writing environment.

The canonical manuscript is sacred. Every word in `main.md` is written by the human author. AI may organize, classify, summarize, suggest links, detect contradictions, extract claims, and propose diffs in auxiliary files. AI may not silently rewrite manuscript prose, generate chapters, overwrite author text, or “improve style” automatically.

The aim is restraint: readable typography, durable files, fast navigation, and an interface that feels closer to an editorial room than a productivity dashboard.

## Writing Workflow

Essai opens in **Write** mode: one central Markdown editor, no permanent preview, and as much calm space as possible for drafting.

The four modes are:

- **Write**: the default writing desk. Editor only.
- **Preview**: rendered Markdown for checking structure and links. A split preview can be toggled when needed.
- **Read**: immersive, magazine-style reading with sidebars and editing chrome hidden.
- **Study**: a separate semantic archive room for investigating concepts, claims, sources, notes, and objects without editing the manuscript.

Focus mode hides both sidebars when the page needs to become only the text.

## Study Mode

Study mode treats the project’s `sources/` directory as the semantic archive layer of the book. It is not a chatbot, an AI sidebar, or a writing assistant. It is a calm research surface for asking what the archive can support.

The Study room is built around:

- **Archive navigation**: sources, concepts, objects, claims, notes, semantic bookmarks, and recent investigations.
- **Concept investigation**: a central, non-editor surface organized around a concept such as `programmable machines`.
- **Direct references**: source-grounded passages with visible file provenance, source type, page marker, confidence, and retrieval method.
- **Conceptual echoes**: adjacent ideas that may deserve exploration.
- **Claims**: claim records drawn from `sources/Claims.md`.
- **Related objects**: artifact records drawn from `objects/`.
- **Source graph**: a restrained relationship map between concepts, source files, claims, and object notes.
- **Coverage log**: an audit trail of what was read from the archive.

The first implementation uses local source indexes and a hybrid lexical/semantic-neighbor retrieval scaffold. It is designed so future embeddings, BM25, reranking, and GPT adjudication can be added behind the same provenance-first interface.

Study mode never writes to `main.md`. Its summaries and pathways are only interpretive views over auxiliary project files.

## Notes And Sources Capture

The right pane is reserved for input. It contains a persistent **Notes** box, focused by default, so a fragment can be written immediately. Press **Submit Note** to append the note, clear the box, and keep writing the next one. `Cmd/Ctrl+Shift+N` returns focus to the Notes box.

On narrow screens or when focus mode hides the sidebars, the floating Notes button opens the same capture flow.

Notes append to:

```txt
notes.md
```

If the file does not exist, Essai creates it. Each capture is appended as:

```md
## YYYY-MM-DD HH:mm

<note>

---
```

Older projects may still contain legacy inbox files. Essai keeps those files readable and does not delete them. New projects prefer `notes.md`.

The right pane also contains a **Sources** box for links, citations, quotes, and raw references. Every source capture is appended to:

```txt
sources/raw.md
```

When a type is selected, Essai also mirrors the entry into the appropriate file:

- `book` -> `sources/Books.md`
- `paper` -> `sources/Papers.md`
- `article` -> `sources/Articles.md`
- `quote` -> `sources/Quotes.md`
- `claim` -> `sources/Claims.md`

Source files can be uploaded from the same right pane by choosing a file or dropping it onto the file target. Choose the source type before uploading. Essai stores the file inside the project under:

```txt
sources/files/<type>/
```

It then indexes the upload in `sources/raw.md` and mirrors the entry into the selected typed source file. The Markdown index stays readable, and the file remains in a portable subfolder beside the manuscript.

File uploads follow the same authorship rule as everything else in Essai: the file is archived and indexed, but its contents are not rewritten into the manuscript. A source file entry looks like:

```md
## 2026-05-15 14:30

Type: paper

File: [Important Notes.txt](files/paper/20260515-143000-Important-Notes.txt)

Uploaded source file.

---
```

The stored filename is timestamped and sanitized so source folders stay git-friendly. Unknown source types fall back to `raw`, and empty files are rejected before any Markdown index is changed.

## Architecture

- Next.js App Router with TypeScript.
- React Server Components for initial book loading.
- Route Handlers under `src/app/api` for book and file operations.
- Study archive route under `src/app/api/books/[bookId]/study`.
- CodeMirror 6 for Markdown editing.
- Markdown files as the primary data model.
- A storage abstraction in `src/lib/storage`.
- Binary storage methods for uploaded source files.
- Wiki-link, backlink, broken-link, and search logic in `src/lib`.
- Source-grounded Study retrieval logic in `src/lib/study`.
- Vitest unit tests and Playwright end-to-end tests.

The storage contract is:

```ts
interface StorageProvider {
  listFiles(): Promise<FileNode[]>;
  readFile(path: string): Promise<string>;
  readBinaryFile?(path: string): Promise<Uint8Array>;
  writeFile(path: string, content: string): Promise<void>;
  writeBinaryFile?(path: string, content: Uint8Array): Promise<void>;
  createFile(path: string, content?: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  renameFile(oldPath: string, newPath: string): Promise<void>;
}
```

Implemented providers:

- `LocalFilesystemStorageProvider`
- `InMemoryStorageProvider`

Documented stubs:

- `GitHubRepoStorageProvider`
- `BlobStorageProvider`

## Storage Model

Books live under:

```txt
projects/
  my-book/
    book.json
    README.md
    main.md
    notes.md
    main.suggestions.md
    concepts/
    objects/
    sources/
      raw.md
      Books.md
      Papers.md
      Articles.md
      Quotes.md
      Claims.md
      files/
        paper/
        book/
    drafts/
    fragments/
```

The app route mirrors the folder:

```txt
/projects/my-book
```

Opening `/` redirects to the most recently edited project.

Each book directory is independently portable. You can zip it, commit it to git, move it to another machine, or read it in any Markdown editor.

For local development, the default storage root is the repository root. You may override it:

```bash
ESSAI_DATA_ROOT=/path/to/storage npm run dev
```

Production deployments should not rely on Vercel filesystem persistence. Use the storage interface to add a durable provider such as GitHub, Blob, or S3-backed storage.

## Source Intake Contract

Text sources and uploaded source files are deliberately handled as archive operations:

- `sources/raw.md` is the chronological ledger of every source capture.
- Typed files such as `sources/Papers.md` and `sources/Books.md` are filtered indexes.
- Uploaded files live under `sources/files/<type>/`.
- Markdown indexes link to uploaded files with relative links, so the project folder remains portable.
- AI may later classify or summarize sources, but it must not alter `main.md` without an explicit human action.

The current source types are:

```txt
raw
book
paper
article
quote
claim
```

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev       # local development
npm run build     # production build
npm run start     # serve a production build
npm run lint      # ESLint
npm run test      # Vitest unit tests
npm run test:e2e  # Playwright tests
npm run format    # Prettier
```

The test suite covers:

- project creation and latest-project ordering
- note capture into `notes.md`
- preservation of legacy inbox files
- text source indexing and typed mirroring
- source file storage, sanitization, and Markdown indexing
- binary storage list/read/rename/delete behavior
- write/preview/read mode switching
- study mode archive investigation from `sources/`
- focus mode
- end-to-end note, text source, and file source capture

## Keyboard Shortcuts

- `Cmd/Ctrl+S`: save
- `Cmd/Ctrl+K`: command palette
- `Cmd/Ctrl+P`: quick open
- `Cmd/Ctrl+R`: reading mode
- `Cmd/Ctrl+Shift+N`: focus notes input
- `Cmd/Ctrl+.`: focus mode
- `Cmd/Ctrl+B`: bold selected text
- `Cmd/Ctrl+I`: italic selected text

Slash helpers are available in the command palette and through lightweight editor expansion:

- `/claim`
- `/source`
- `/concept`
- `/object`
- `/question`

## AI Boundaries

Essai works without an AI provider. The default AI route returns a clear disabled-provider message.

When an AI provider is added, it must preserve these rules:

- AI edits are suggestions or diffs, not automatic writes.
- Manuscript files are never rewritten by AI.
- The user manually accepts any proposed change.
- Auxiliary notes may be proposed, classified, linked, or summarized.

Relevant files:

- `src/lib/ai/types.ts`
- `src/app/api/ai/route.ts`

## Vercel Deployment

The app builds on Vercel as a standard Next.js application.

1. Push the repository to GitHub.
2. Import it in Vercel.
3. Set environment variables from `.env.example`.
4. Add or configure a durable storage provider for production use.
5. Deploy.

Important: Vercel serverless filesystem writes are not durable. Local filesystem storage is for local development and self-hosted deployments with persistent disk.

## Roadmap

- Durable GitHub repository storage provider.
- Blob/S3 storage provider.
- Review UI for accepting and rejecting AI diffs.
- Richer Markdown rendering with footnotes and citations.
- Export bundles for book archives.
- More precise contradiction and claim-evidence workflows.

Essai should remain calm. Features earn their place only when they protect attention, preserve authorship, or make the archive more durable.
