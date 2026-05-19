# Implementation Log

## 2026-05-19 01:08

Implemented:
Created the implementation archive and began converting review finding ISSUE-004 into executable coverage.

Triggered By:

- `codex/reviews/2026-05-19/testing-review.md`
- `codex/reviews/2026-05-19/issues/ISSUE-004-long-session-tests-missing.md`
- `codex/reviews/2026-05-19/patches/PATCH-001-long-session-playwright.md`

Observed Before:
The existing e2e tests covered important isolated flows, including Codex workspace manuscript protection, but the review archive identified a missing long-session shape: repeated movement through Write, Study, Codex, capture, persistence, and reopening.

Implementation:

- added `codex/implementation/2026-05-19/` as a durable implementation journal
- planned a first Playwright spec focused on workflow continuity rather than feature count
- chose test coverage before UI changes so future refinements have a safety net

Philosophical Address:
The change treats manuscript sovereignty as a behavior that must survive accumulated work, not only a single Codex command.

---

## 2026-05-19 01:24

Implemented:
Added `tests/e2e/long-session.spec.ts`.

Triggered By:
ISSUE-004 and the testing review's request for a realistic workflow that crosses Write, Study, Codex, workspace persistence, history, and project reopening.

Implementation:

- creates a book and seeds a human manuscript paragraph
- captures a note
- captures a raw text source
- uploads a text source file
- enters Study, selects the uploaded source, and searches it
- enters Codex, edits the main workspace, creates a side workspace tab, and runs source-note and project-search commands
- commits the Codex workspace
- opens Codex history
- reloads the project and verifies workspace and tab persistence
- asserts `main.md` remains byte-for-byte equal to the original human manuscript

Observed During Verification:
The first run exposed an accessibility-selector ambiguity: a Study result action included "Send to Codex", so `getByRole("button", { name: "Codex" })` matched both the mode button and a result card. The test now uses exact mode-button matching. This is a small but useful reminder that long-session tests inhabit the actual accessible surface, not an idealized DOM.

Verification:
`npx playwright test tests/e2e/long-session.spec.ts --project=chromium`

Result:
1 test passed.

---

## 2026-05-19 01:42

Implemented:
Study-to-Codex handoffs now use a consistent fenced `essai-provenance` Markdown block.

Triggered By:

- `codex/reviews/2026-05-19/provenance-review.md`
- `codex/reviews/2026-05-19/patch-ideas.md`

Observed Before:
When Study sent an excerpt into Codex, the workspace received readable but ad hoc lines:
`Source: ...`, `Retrieval: ...`, and optional `Query: ...`.

Implementation:

- added `formatProvenanceMarkdownBlock` to `src/lib/codex/provenance.ts`
- updated `CodexWorkspace` Study seed handling to use the shared formatter
- added a deterministic unit test for the Markdown block shape

Result:
The Codex workspace still remains plain Markdown, but Study handoffs now carry a recognizable provenance stanza that future relationship and source-link tooling can parse without making the note unreadable.

Philosophical Address:
The change strengthens inspectability without automating authorship. It preserves the source trail beside the manuscript and makes evidence easier to audit later.

Verification:
`npm test -- tests/codex/provenance.test.ts`

Result:
1 test file passed, 3 tests passed.

Regression Check:
`npx playwright test tests/e2e/long-session.spec.ts --project=chromium`

Result:
1 test passed.

---
