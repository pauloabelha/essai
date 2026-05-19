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

## 2026-05-19: Relationship Trail

Workflow Improved:
Opening Codex mode now gives the writer a quiet answer to "is there already committed relationship structure here?"

Before:
The user needed to run relationship commands or inspect files to know whether Codex cards and links existed.

After:
The left rail reports committed card and link counts. This keeps the information peripheral and durable rather than making it a central dashboard.

Cognitive Impact:
Low. The wording is count-based and does not ask the user to act.

Calmness Impact:
Positive if it stays small. It should not grow into alerts, scores, completion states, or graph pressure.
