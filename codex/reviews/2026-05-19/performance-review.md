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

## Codex Responsiveness

Codex has two performance dimensions:
- local workspace responsiveness
- CLI/proxy response latency

The workspace must remain immediate even if the Codex panel is waiting. The current architecture separates the center workspace from message state, which helps. The review should verify that typing in the workspace stays smooth during `/search-project`, `/read`, and local CLI calls.

## PDF Rendering

The README describes a local PDF.js reader with page-window rendering and match highlighting. This is the right direction for mobile and long PDFs.

Long-session questions:
- Does repeated result selection leak memory?
- Does zooming preserve highlights without layout jumps?
- Do highlights remain accurate on split text runs and multi-line phrases?
- Are page jumps immediate enough to feel like an archive, not a loading tunnel?

## Hydration And Layout Stability

Pane widths are restored from local storage after mount. This can cause small initial layout shifts. The review should capture screenshots immediately after load and after width restoration to see whether the page visibly jumps.

