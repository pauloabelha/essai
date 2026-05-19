# Essai

Essai is a quiet Markdown writing environment for long-form intellectual work.

It is built for books, essays, research notes, claims, objects, concepts, and formulations that should remain readable outside the application. The project is intentionally local-first and file-native: a book is a plain directory of Markdown files plus one `book.json` metadata file.

## Philosophy

Essai is not an AI writing app. It is a human writing environment.

The canonical manuscript is sacred. Every word in `main.md` is written by the human author. AI may organize, classify, summarize, suggest links, detect contradictions, extract claims, and propose diffs in auxiliary files. AI may not silently rewrite manuscript prose, generate chapters, overwrite author text, or “improve style” automatically.

The aim is restraint: readable typography, durable files, fast navigation, and an interface that feels closer to an editorial room than a productivity dashboard.

## Writing Workflow

Essai opens in **Write** mode: one central Markdown editor, no permanent preview, and as much calm space as possible for drafting.

The left pane in Write mode is a manuscript section tree, not a file browser. It shows section names only. Each section points to its own Markdown file through `book.json`, so section structure stays in project metadata while the manuscript remains plain files on disk.

The four modes are:

- **Write**: the default writing desk. Editor only.
- **Preview**: rendered Markdown for checking structure, links, and reading flow. A split preview can be toggled when needed.
- **Study**: a separate semantic archive room for investigating concepts, claims, sources, notes, and objects without editing the manuscript.
- **Codex**: a source-grounded scholarly relationship workbench for turning excerpts, notes, concepts, claims, objects, and manuscript sections into durable research cards.

Focus mode hides both sidebars when the page needs to become only the text.

On mobile, Essai keeps the same writing and study model but collapses the permanent rails into deliberate panels. **Sections** opens manuscript navigation, **Capture** opens the notes and sources pane, and the central surface remains the primary reading or writing area. The desktop layout stays intact on larger screens; the mobile layout is an adaptive shell around the same file-native workflows.

On desktop, panes can be resized by dragging the slim dividers between rails and the central surface. Essai remembers section, source, capture, split-preview, and Codex panel widths locally so each workspace can settle into the shape the writer prefers.

## Study Mode

Study mode treats the project’s `sources/` directory as the semantic archive layer of the book. It is not a chatbot, an AI sidebar, or a writing assistant. It is a calm research surface for reading sources, filtering the archive, and making new notes without leaving the study view.

The Study room is built around:

- **Source shelf**: source indexes and uploaded files stay visible in the left rail, where they can filter the central investigation.
- **Concept investigation**: a central, non-editor surface organized around a concept such as `programmable machines`.
- **Direct references**: source-grounded passages with visible file provenance, page marker, confidence, and retrieval method.
- **Conceptual echoes**: adjacent ideas that may deserve exploration.
- **Claims**: claim records drawn from `sources/Claims.md`.
- **Related objects**: artifact records drawn from `objects/`.
- **Source graph**: a restrained relationship map between concepts, source files, claims, and object notes.
- **Coverage log**: an audit trail of what was read from the archive.

The first implementation uses local source indexes and layered retrieval. Literal matches are ranked first, and lexical matches can catch nearby forms and small typos. Each passage keeps its source file, page or location, confidence, and retrieval method visible so search remains inspectable rather than conversational. Direct references are sorted by source and page number, so PDF results read in document order after retrieval and deduplication.

PDF sources render inside Study mode with a local PDF.js reader rather than the browser’s embedded PDF plugin. Selecting a search result sends the reader to the cited page without reloading the document and highlights the matching text run on the page when the PDF exposes extractable text. The reader keeps page and zoom controls close to the source, so result navigation feels like moving through an archive rather than opening separate files.

For long PDFs, Study renders a small page window around the active page instead of mounting the whole document at once. This keeps source reading responsive on phones while preserving page jumps, zoom controls, and match highlighting.

Study mode never writes to `main.md`. Its summaries and pathways are only interpretive views over auxiliary project files. The right capture panel stays available in Study mode, so notes and new sources can be added while the source shelf remains visible.

## Codex Mode

Codex is Essai's scholarly apparatus layer. It is a project-aware research panel beside editable Markdown notes. Codex may read manuscript sections, sources, concepts, objects, notes, and Codex files so it can answer questions and examine what has been written. It may not edit manuscript section files.

The first implementation adds:

- a Codex mode tab
- a left rail of fixed Codex magic calls for source search, accuracy review, and prose review
- a central editable `codex/notes.md` Markdown file
- a right Codex message panel proxied to the local `codex` CLI
- copy buttons for user and Codex messages
- saved conversation history under `codex/history/`
- indexed Study search through `/search`
- project-wide read commands such as `/search-project`, `/read`, and `/examine-section`
- note-writing commands such as `/append-note`, `/source-note`, and `/commit-notes`
- relationship commands such as `/related`, `/backlinks`, and `/source-links`
- Study passage handoff into Codex

Magic call prompts are hardcoded in `src/lib/codex/magic-prompts.ts`. Each magic call opens a small scope selector before sending the prompt: source search selects source files, while accuracy and prose checks select manuscript section files.

Codex notes live under:

```txt
codex/notes.md
```

Codex panel histories are saved as JSON under:

```txt
codex/history/
```

The Codex CLI proxy keeps a warm `codex app-server` bridge, runs each book in a read-only Codex thread, and uses the local CLI login, such as a ChatGPT-backed `codex login`. Codex writes only auxiliary Codex files unless the human author manually edits elsewhere. It never silently mutates `main.md` or section files, and it never inserts generated prose into the manuscript. See `docs/codex-mode.md` for the full design contract.

## Notes And Sources Capture

The right pane is reserved for input. It keeps **Notes** at the top and **Source** directly beneath it, so both capture flows are immediately available without extra panels. Press **Submit** to append a note, clear the box, and keep writing the next one. In Study mode, selecting text inside the central source reader can also create a note; Essai records the selected quote with `Source:` metadata so the note remains indexed back to the source it came from. `Cmd/Ctrl+Shift+N` returns focus to the Notes box.

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

The **Source** panel has one capture box for links, citations, quotes, raw references, and files. Paste text into it or drop a file directly into the same box. Press **Commit** to append a text source to:

```txt
sources/raw.md
```

Files can also be chosen from inside that same source box. Dropped files are archived immediately and refresh the Study index; chosen files are archived when **Upload File** is pressed. The interface archives new uploads as raw source files under:

```txt
sources/files/raw/
```

It then indexes the upload in `sources/raw.md`. The Markdown index stays readable, and the file remains in a portable subfolder beside the manuscript.

File uploads follow the same authorship rule as everything else in Essai: the file is archived and indexed, but its contents are not rewritten into the manuscript. A source file entry looks like:

```md
## 2026-05-15 14:30

Type: raw

File: [Important Notes.txt](files/raw/20260515-143000-Important-Notes.txt)

Uploaded source file.

---
```

The stored filename is timestamped, sanitized, and includes a short SHA-256 content hash so source folders stay git-friendly without silently overwriting existing uploads. If the same file is uploaded again at the same timestamp, Essai reuses the existing archived binary and adds another source entry pointing at it. If a same-name collision has different bytes, the hash produces a different filename; a numbered suffix is kept as a final collision fallback. Empty files are rejected before any Markdown index is changed.

Every text source capture and uploaded source file also refreshes a backend search index:

```txt
sources/.study-index.json
```

This generated Study index contains normalized `documents` and `chunks` used by Study search. Text-like uploads such as `.txt`, `.md`, `.csv`, `.json`, and `.xml` have their UTF-8 text extracted into searchable chunks. PDFs are parsed server-side into page-aware text chunks, preserving page provenance for Study results whenever the PDF contains extractable text. Scanned image PDFs may still fall back to metadata-only search until OCR is added. The shape is intentionally suitable for later Elasticsearch, SQLite FTS, embedding, or reranking ingestion, and it can be regenerated from the readable Markdown ledgers and archived files.

## Architecture

- Next.js App Router with TypeScript.
- React Server Components for initial book loading.
- Route Handlers under `src/app/api` for book and file operations.
- Study archive route under `src/app/api/books/[bookId]/study`.
- Codex relationship route under `src/app/api/books/[bookId]/codex`.
- CodeMirror 6 for Markdown editing.
- PDF.js for in-app Study PDF rendering, page navigation, and match highlighting.
- Markdown files as the primary data model.
- A storage abstraction in `src/lib/storage`.
- Binary storage methods for uploaded source files.
- Wiki-link, backlink, broken-link, and search logic in `src/lib`.
- Source-grounded Study retrieval logic in `src/lib/study`.
- File-native Codex relationship logic in `src/lib/codex`.
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
        raw/
    codex/
      notes.md
      cards/
      history/
      sessions/
      trails/
      links/
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

The app builds on Vercel with the standard Next.js production build. Production deployments should not rely on Vercel filesystem persistence for the default local storage provider; use the storage interface to add a durable provider such as GitHub, Blob, or S3-backed storage. PDF text extraction runs in server code and is intended for Node.js runtime route handlers, not edge runtime.

## Source Intake Contract

Text sources and uploaded source files are deliberately handled as archive operations:

- `sources/raw.md` is the chronological ledger of every source capture.
- Typed files such as `sources/Papers.md` and `sources/Books.md` may exist for legacy or API-driven classification, but the primary interface now commits uncategorized source captures to `sources/raw.md`.
- Uploaded files from the interface live under `sources/files/raw/`.
- Markdown indexes link to uploaded files with relative links, so the project folder remains portable.
- `sources/.study-index.json` is refreshed after every source capture or file upload so Study search and future search backends can use the latest archive state.
- AI may later classify or summarize sources, but it must not alter `main.md` without an explicit human action.

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Backend Logging

The server logs API calls, source intake, notes, Study index refreshes, and Study search/ranking with colored levels such as `INFO`, `DEBUG`, `WARN`, and `ERROR`.

Use this while debugging search:

```bash
npm run dev
```

To quiet the backend logs:

```bash
ESSAI_LOG=quiet npm run dev
```

Vitest keeps these logs quiet by default. To inspect backend logs during unit tests:

```bash
ESSAI_LOG=test npm test
```

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
- text source indexing
- source file storage, sanitization, and Markdown indexing
- PDF text extraction into page-aware Study chunks
- page-ordered Study search results
- Study source index refresh after source capture and upload
- binary storage list/read/rename/delete behavior
- write/preview/study mode switching
- study mode archive investigation from `sources/`
- focus mode
- end-to-end note, text source, and file source capture

## Keyboard Shortcuts

- `Cmd/Ctrl+S`: save
- `Cmd/Ctrl+K`: command palette
- `Cmd/Ctrl+P`: quick open
- `Cmd/Ctrl+R`: preview mode
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
