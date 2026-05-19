# Workflow Effects

## 2026-05-19: Long-Session Test Coverage

Workflow Improved:
Write -> source capture -> Study search -> Codex workspace -> Codex command history -> project reopening.

Before:
The workflow was covered as separate behaviors, but not as one accumulated scholarly session.

After:
The test suite has a single e2e path that acts like a writer moving through Essai's rooms while preserving the manuscript.

Cognitive Impact:
This does not change the UI yet, but it lowers implementation risk. Future refinements can be judged against a session that resembles real scholarly use.

Calmness Impact:
Protective rather than visible. It prevents later improvements from quietly turning workflow continuity into a casualty.

Observed Test Friction:
The accessible name collision around "Codex" showed that commands embedded inside Study results can overlap with global mode language. This is not necessarily a product bug, but it is a useful reminder for future UI refinement: mode switches should remain easy to target cognitively and technically.
