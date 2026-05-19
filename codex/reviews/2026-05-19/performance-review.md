# Performance Review

## Initial Findings

The most important performance criterion for Essai is not raw speed. It is uninterrupted attention. A slow operation is worse when it steals the writer's sense of place.

## Study Search

Current Study search is debounced by 220ms in the app shell and sent to `/api/books/[bookId]/study`. The server builds an investigation over the Study index and ranks chunks.

Positive:
- Debouncing prevents a request per keystroke.
- Results remain inspectable through coverage and retrieval method.
- For long PDFs, the README says the reader mounts a small page window around the active page, which is the right performance shape.

Risks:
- The app appears to set Study loading at the start of every investigation. If typing and source selection happen frequently, loading feedback may create subtle churn.
- The route builds a full investigation object for each query. Long-session testing should measure whether source-heavy books remain quiet.
- `files` is in the Study effect dependency list, so broad file changes may refresh Study even when the visible query did not meaningfully change.

Observed baseline from the screenshot pass:
- Query: `programmable machines`
- Scope: one selected PDF source
- Candidate chunks: 1,740
- Positive matches: 3
- Retrieval: lexical matches
- Server-measured investigation time: 616ms

This is usable for an initial selected-source pass, but the result quality deserves review because the top lexical matches looked weakly related in the server preview. Ranking speed and ranking relevance need to be judged together.

## Codex Responsiveness

Codex has two performance dimensions:
- local workspace responsiveness
- CLI/proxy response latency

The workspace must remain immediate even if the Codex panel is waiting. The current architecture separates the center workspace from message state, which helps. The review should verify that typing in the workspace stays smooth during `/search-project`, `/read`, and local CLI calls.

During screenshot capture, entering Codex mode triggered several reads of `codex/workspace.md` and the active `codex/history/*.json`, followed by an autosave write to history. This should be profiled in a longer session with many history files and workspace tabs.

## PDF Rendering

The README describes a local PDF.js reader with page-window rendering and match highlighting. This is the right direction for mobile and long PDFs.

Long-session questions:
- Does repeated result selection leak memory?
- Does zooming preserve highlights without layout jumps?
- Do highlights remain accurate on split text runs and multi-line phrases?
- Are page jumps immediate enough to feel like an archive, not a loading tunnel?

## Hydration And Layout Stability

Pane widths are restored from local storage after mount. This can cause small initial layout shifts. The review should capture screenshots immediately after load and after width restoration to see whether the page visibly jumps.

The dev server also reported a slow filesystem warning for `.next/dev`. This may be an environment artifact, but it reinforces the need to separate local development filesystem latency from application-level interaction latency in future measurements.
