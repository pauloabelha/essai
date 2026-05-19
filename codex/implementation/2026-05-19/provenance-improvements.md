# Provenance Improvements

## 2026-05-19: Provenance Protected In Workflow Test

The first implementation pass adds e2e coverage that verifies source material can move through Study and Codex while remaining auxiliary. It checks that Codex workspace material persists under `codex/workspace.md` and that manuscript text does not receive generated or source-note material.

This is a test-level provenance improvement, not a UI-level provenance change.

## 2026-05-19: Study Handoff Provenance Block

Study-to-Codex handoffs now format source metadata as a fenced Markdown block:

````md
```essai-provenance
source: sources/files/raw/Hill1993.pdf
page: 42
retrieval: Exact Match
query: automatic sequence
captured: 2026-05-19T01:30:00.000Z
```
````

Why this matters:

- It remains readable in any Markdown editor.
- It is structurally recognizable for future source-link and relationship tooling.
- It keeps provenance attached to the excerpt without making Codex text canonical manuscript prose.

Verification:
`npm test -- tests/codex/provenance.test.ts`

Result:
1 test file passed, 3 tests passed.

Regression Check:
`npx playwright test tests/e2e/long-session.spec.ts --project=chromium`

Result:
1 test passed.
