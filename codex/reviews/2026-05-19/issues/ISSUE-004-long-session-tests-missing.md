# ISSUE-004: Long-Session Workflow Tests Are Missing

## Workflow

Review of existing unit and Playwright coverage.

## Reproduction

1. Inspect `tests/e2e/app.spec.ts` and `tests/e2e/codex.spec.ts`.
2. Compare existing tests to the desired long-running scholar/writer workflow.

## Screenshots

None yet.

## Philosophical Impact

The manuscript boundary is tested, but long-session calmness is not. Essai's promise depends on extended use, not only successful isolated actions.

## Usability Impact

Potential fatigue, clutter, stale state, or provenance loss may go undiscovered.

## Technical Observations

Current tests are good at proving core behaviors. They do not yet simulate accumulated work over time.

## Suggested Direction

Add a Playwright long-session spec that performs realistic multi-mode work and verifies manuscript preservation, provenance visibility, workspace persistence, and reopening behavior.

