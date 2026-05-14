# Essai

Essai is a quiet Markdown writing environment for long-form intellectual work.

It is built for books, essays, research notes, claims, objects, concepts, and formulations that should remain readable outside the application. The project is intentionally local-first and file-native: a book is a plain directory of Markdown files plus one `book.json` metadata file.

## Philosophy

Essai is not an AI writing app. It is a human writing environment.

The canonical manuscript is sacred. Every word in `manuscript/` is written by the human author. AI may organize, classify, summarize, suggest links, detect contradictions, extract claims, and propose diffs in auxiliary files. AI may not silently rewrite manuscript prose, generate chapters, overwrite author text, or “improve style” automatically.

The aim is restraint: readable typography, durable files, fast navigation, and an interface that feels closer to an editorial room than a productivity dashboard.

## Writing Workflow

Essai opens in **Write** mode: one central Markdown editor, no permanent preview, and as much calm space as possible for drafting.

The three modes are:

- **Write**: the default writing desk. Editor only.
- **Preview**: rendered Markdown for checking structure and links. A split preview can be toggled when needed.
- **Read**: immersive, magazine-style reading with sidebars and editing chrome hidden.

Focus mode hides both sidebars when the page needs to become only the text.

## Quick Thought Capture

The right pane is reserved for capture. It contains a persistent **Thought** box, focused by default, so a fragment can be written immediately without opening a modal. Press **Submit** to append the thought, clear the box, and keep writing the next one. `Cmd/Ctrl+Shift+N` returns focus to the Thought box.

On narrow screens or when focus mode hides the sidebars, the floating Thought button opens the same capture flow.

Quick thoughts append to:

```txt
inbox/current-notes.md
```

If the file does not exist, Essai creates it. Each capture is appended as:

```md
## YYYY-MM-DD HH:mm

<thought>

---
```

Older projects may still contain `inbox/random-thoughts.md`. Essai keeps those files readable and does not delete them. New projects prefer `current-notes.md`.

## Architecture

- Next.js App Router with TypeScript.
- React Server Components for initial book loading.
- Route Handlers under `src/app/api` for book and file operations.
- CodeMirror 6 for Markdown editing.
- Markdown files as the primary data model.
- A storage abstraction in `src/lib/storage`.
- Wiki-link, backlink, broken-link, and search logic in `src/lib`.
- Vitest unit tests and Playwright end-to-end tests.

The storage contract is:

```ts
interface StorageProvider {
  listFiles(): Promise<FileNode[]>;
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
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
data/
  books/
    my-book/
      book.json
      README.md
      manuscript/
      inbox/
        current-notes.md
      concepts/
      objects/
      essays/
      formulations/
      sources/
```

Each book directory is independently portable. You can zip it, commit it to git, move it to another machine, or read it in any Markdown editor.

For local development, the default storage root is the repository root. You may override it:

```bash
ESSAI_DATA_ROOT=/path/to/storage npm run dev
```

Production deployments should not rely on Vercel filesystem persistence. Use the storage interface to add a durable provider such as GitHub, Blob, or S3-backed storage.

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

## Keyboard Shortcuts

- `Cmd/Ctrl+S`: save
- `Cmd/Ctrl+K`: command palette
- `Cmd/Ctrl+P`: quick open
- `Cmd/Ctrl+R`: reading mode
- `Cmd/Ctrl+Shift+N`: quick thought
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
