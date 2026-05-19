# Session Log

## 2026-05-19 00:00

Workflow:
Created the quality-review branch and initialized the dated review archive.

Actions:
- inspected current git status before branching
- created `codex/quality-review-20260519`
- created `codex/reviews/2026-05-19/`
- added durable review documents, issue directory, patch directory, session directory, and screenshot directory

Observations:
- The working tree already contained local edits on `main`; the review branch was created from that state to avoid operating further on `main`.
- The README strongly articulates Essai's separation between human writing and computational research assistance.
- The requested review mode fits Essai's own philosophy: auxiliary Codex material can become a navigable archive without touching manuscript section files.

Questions:
- Should this review branch intentionally preserve all review material under project-level `codex/reviews/`, or should the review archive live inside a sample book's `projects/<book>/codex/` tree to exercise Essai's own file-native book model?

Potential Issues:
- [ISSUE-001](issues/ISSUE-001-review-archive-placement.md)

---

## 2026-05-19 00:12

Workflow:
Static code inspection of the app shell, Study route, Study archive logic, Codex workspace, and Codex Playwright test.

Actions:
- read `src/components/shell/essai-app.tsx`
- read `src/components/codex/CodexWorkspace.tsx`
- read `src/app/api/books/[bookId]/study/route.ts`
- read `src/lib/study/archive.ts`
- read `tests/e2e/codex.spec.ts`

Observations:
- The app shell carries a large amount of state in one component: writing mode, preview, Study, Codex, capture, pane sizing, source selection, and keyboard shortcuts all live together.
- Study retrieval is explicit and inspectable. It distinguishes exact and lexical matches and exposes source coverage, provenance, confidence, page, and retrieval method.
- Codex workspace has a strong behavioral boundary: Codex can read broadly and write the central workspace or auxiliary Codex files, while manuscript section mutation remains outside the Codex path.
- The e2e test directly verifies that `/source-note` and `/commit-workspace` do not modify `main.md`. This is philosophically important, not only technically useful.

Questions:
- Does the single app shell eventually make the writing room too coupled to the Study and Codex rooms?
- Should provenance and relationship views become persistent surfaces rather than information that appears only inside a mode or response?

Potential Issues:
- [ISSUE-002](issues/ISSUE-002-app-shell-state-density.md)
- [ISSUE-003](issues/ISSUE-003-relationship-visibility-is-too-local.md)

---

## 2026-05-19 00:28

Workflow:
First local verification pass.

Actions:
- ran focused unit tests for Codex relationship, provenance, manuscript-link, and fallback behavior
- planned a Playwright-driven screenshot pass after confirming the app can start

Observations:
- The codebase already has unusually good tests for the philosophical boundary: provenance, manuscript links, Codex commands, PDF matching, Study search, and source upload are all represented.
- The missing shape is less "unit coverage" and more "long-session evidence": repeated mode changes, accumulated history, Codex tab growth, source shelf fatigue, PDF page jumping over time, and relationship visibility after many notes.

Questions:
- Should long-session tests assert only stability and manuscript preservation, or should they also produce artifacts like screenshots and workflow traces?

Potential Issues:
- [ISSUE-004](issues/ISSUE-004-long-session-tests-missing.md)

---

