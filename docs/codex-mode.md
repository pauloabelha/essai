# Codex Mode

Codex is Essai's source-grounded scholarly relationship engine. It is not a manuscript generator or writing copilot. It is a manuscript-adjacent apparatus for reading the project, answering research questions, editing Codex notes, and turning sources, excerpts, notes, concepts, claims, objects, and chapters into an inspectable scholarly structure.

The right Codex panel is proxied to the local `codex` CLI through a warm `codex app-server` bridge. It uses the machine's existing Codex login and configuration, keeps per-book read-only Codex threads, queues turns per book, and collects assistant deltas until each turn completes.

The panel is chat-shaped, but it is still governed by the Codex boundary: messages are operational records, not manuscript prose. User and Codex messages can be copied with the copy button on each message.

The Codex source rail and message panel are resizable on desktop. Their widths are remembered in local browser storage, matching Essai's other stretchable panes.

The top-left Codex rail is reserved for fixed "magic" calls rather than ordinary source browsing. V0 includes:

- **Search in sources**: opens a scoped source-selection box and sends a hardcoded source-search prompt.
- **Check accuracy**: opens a manuscript-section selection box and asks Codex to compare claims against the archive.
- **Check prose**: opens the same section-selection pattern and asks Codex for prose-level diagnosis without rewriting manuscript text.

These prompts live in `src/lib/codex/magic-prompts.ts` so the operations remain explicit, reviewable, and separate from ad hoc chat.

## Model

Essai keeps three boundaries clear:

- Write is the canonical manuscript. Human prose only.
- Study is the source investigation room. Search, read, and inspect archive material.
- Codex is the relationship and note workbench. It can read sources, manuscript sections, concepts, objects, notes, and Codex files. It can edit Codex notes, but it cannot edit manuscript section files.

Codex bridges the archive and manuscript structure without mutating manuscript prose.

## Research Cards

The first visible Codex object is the central Markdown notes file:

```txt
codex/notes.md
```

Codex can append source-aware notes into this file and commit it when the user asks. Research cards remain a durable future object. A card may represent a note, concept, claim, object, excerpt, source link, chapter reference, or relationship trail. Cards are stored as Markdown under:

```txt
codex/cards/
```

Each card has readable content plus frontmatter metadata for source provenance and relationships.

Codex panel conversations are saved as JSON under:

```txt
codex/history/
```

History files preserve the message sequence for later review without treating the conversation as manuscript text. The arrow control in the Codex panel opens the saved history list; choosing an entry loads that particular chat back into the panel.

## Provenance

Every grounded Codex artifact should preserve:

- source path
- page or location when available
- quote or excerpt
- retrieval method
- timestamp
- originating query when available

Ungrounded cards can be staged in scratch, but durable scholarly cards should be connected to visible source context.

## Relationship Engine

Codex relationships include:

- card to source
- card to concept
- card to claim
- card to chapter
- card to note
- card to object

The V0 engine reads committed cards, deduplicates relationships, resolves backlinks, and answers `/related` lookups from file-native card metadata.

## Scratch Workspace

The Codex workspace includes a scratch area for temporary relational assembly. Users can stage an excerpt, choose a card type, attach source and page metadata, add concepts or claims, link a chapter, preview the Markdown write, and then commit.

Previewing does not write files. Committing writes only Codex files.

## Manuscript Protection

Codex never rewrites `main.md`, inserts generated prose, creates chapters automatically, or changes manuscript section text. It may read those files and quote or examine them in its panel. The app-server thread is read-only; when Codex wants to change notes, it returns an explicit notes-append block and the web app applies that block only to `codex/notes.md`.

## Study Integration

Study passages expose a "Send to Codex" action. The selected passage is staged into the Codex Markdown notes with source path, page, retrieval method, and search query. From there, the user can ask Codex to search the project, examine sections, append notes, or commit the notes file.

Codex also uses the Study index as retrieval context. `/search <term>` queries the local Study archive directly, returning indexed passages with source file, page, confidence, and retrieval method. Normal Codex CLI turns also receive a compact Study retrieval context for the user's message and selected source scope, so PDF-derived evidence comes from the page-aware index rather than raw binary PDF reading.

## Write Integration

Write mode remains manuscript-first. `Cmd/Ctrl+S` saves the current CodeMirror document directly from the editor state, so the active manuscript section can be persisted without leaving the writing surface. Codex may read manuscript sections for analysis, but it cannot write them.

## AI Boundaries

Codex works fully without an AI provider. Future AI features may suggest links, summarize clusters, detect overlap, or identify contradictions, but their output must remain optional, inspectable, reversible, and noncanonical.
