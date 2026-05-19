# Relationship Improvements

## 2026-05-19: Passive Relationship Trail

Codex mode now shows a small Relationship Trail summary in the left rail:

- committed Codex card count
- visible relationship link count

Triggered By:

- `codex/reviews/2026-05-19/issues/ISSUE-003-relationship-visibility-is-too-local.md`
- `codex/reviews/2026-05-19/relationship-review.md`

Why this shape:
The review archive asked whether users can perceive the structure of their thinking. The first implementation should reveal durable structure without adding dashboard complexity or making AI-proposed relations look canonical.

The Relationship Trail is deliberately modest. It reports committed Codex artifacts only. It does not infer new links, create pressure to complete a graph, or decorate the writing surface.

Verification:
`npx playwright test tests/e2e/long-session.spec.ts --project=chromium`

Result:
1 test passed.

Core question carried forward:

Can users perceive the structure of their thinking without turning Essai into a dashboard?
