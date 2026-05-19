# Testing Improvements

## 2026-05-19: Long-Session Playwright Coverage

Implemented:
`tests/e2e/long-session.spec.ts`

Triggered By:

- `codex/reviews/2026-05-19/testing-review.md`
- `codex/reviews/2026-05-19/issues/ISSUE-004-long-session-tests-missing.md`

Coverage Goal:
Represent Essai as a lived scholarly session, not only isolated UI actions.

Regression Prevented:

- Codex workspace writes leaking into manuscript files.
- Workspace tabs failing to persist.
- Study source capture and search losing continuity.
- Codex command history becoming disconnected from the working session.
- Project reopening losing the user's auxiliary research trail.

Philosophical Importance:
The test protects the separation of human authorship and computational research assistance after accumulated use.

Verification:
`npx playwright test tests/e2e/long-session.spec.ts --project=chromium`

Result:
1 passed.

Implementation Note:
The test deliberately asserts byte-for-byte manuscript preservation after auxiliary research accumulates. That is stronger than checking that a generated phrase is absent; it protects the manuscript as an authored artifact.
