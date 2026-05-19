# Architecture Review

## App Shell

`src/components/shell/essai-app.tsx` is currently the gravitational center of the client application. It coordinates book loading, file loading, editor state, save state, modes, preview, Study, Codex seeding, capture, PDF uploads, pane sizes, mobile panels, keyboard shortcuts, and Study query execution.

This is understandable for an early integrated app, but it is the clearest architectural pressure point. The component is not merely rendering the shell; it is also an orchestration layer for several different rooms.

Architectural risk:
- Write, Study, Capture, and Codex concerns may become harder to reason about as each mode gains deeper behavior.
- Long-session bugs may emerge from shared state transitions rather than isolated feature code.
- Testing isolated workflows becomes harder when the integration surface is one very large client component.

Suggested direction:
- Extract mode controllers or hooks only where there is real behavioral density: `useStudyInvestigation`, `useCapture`, `usePanePersistence`, and possibly `useBookFiles`.
- Preserve the current user-facing simplicity; do not create a framework-shaped abstraction just for neatness.

## Study Architecture

`src/app/api/books/[bookId]/study/route.ts` is thin and readable. Most behavior lives in `src/lib/study/archive.ts`, which is appropriate.

Strong points:
- Search index refresh is behind `readOrRefreshStudySourceIndex`.
- Study results expose coverage, direct references, claims, related objects, graph, and audit log.
- Retrieval methods are explicit.
- Semantic matches are currently reported as `0`, which is honest and inspectable.

Risks:
- The `StudyInvestigation` object is doing a lot: search results, selected source reader payload, graph, summary, audit, and relationship hints. As Study grows, this may need a clearer division between "retrieval payload" and "view model."
- `MiniSearch` is imported in the archive module. Later semantic retrieval could make ranking logic harder to keep transparent unless ranking stages remain named and inspectable.

## Codex Architecture

`CodexWorkspace` embodies the manuscript boundary well. It has explicit workspace paths, tab paths, history paths, and default instructions that tell Codex to read broadly but not edit manuscript sections.

Strong points:
- Workspace and history are durable files.
- Magic calls use scoped selectors.
- Study handoff appends source excerpt material with provenance.
- Conversation history is saved under `codex/history/`.

Risks:
- The component owns UI state, persistence, history loading, workspace tab logic, source sorting, command sending, and seed handling.
- Appending a Study seed directly to workspace state is useful, but needs robust save-state clarity. A staged excerpt should never feel silently committed.
- Codex history is JSON and durable, but may be less pleasant to inspect than Markdown when the goal is a scholarly archive.

## Storage Model

The storage interface is appropriately small and file-native. It supports the philosophy well because manuscript, source, note, and Codex artifacts remain inspectable outside the app.

Open question:
- Should binary and text operations eventually expose provenance or content hashes at the storage layer, or should that remain source-intake-specific?

