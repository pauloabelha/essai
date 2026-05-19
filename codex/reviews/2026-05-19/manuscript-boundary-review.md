# Manuscript Boundary Review

## Principle

The manuscript is sacred. Codex may organize, inspect, summarize, suggest, and connect, but it must not silently rewrite human-authored section files.

## Evidence In Current Code

The Codex e2e test verifies this boundary directly. It:
- creates a book
- writes human text into `main.md`
- enters Codex mode
- adds a source-aware note to the Codex workspace
- commits the workspace
- confirms `codex/workspace.md` contains the Codex material
- confirms `main.md` still contains the human text and does not contain the Codex note

That is not a peripheral test. It is a constitutional test.

## Emotional Clarity

A boundary is not only technical. The user must feel it.

Positive signs:
- The README uses strong language: "The canonical manuscript is sacred."
- Codex's default instructions say it may read manuscript sections and sources but never edit human-written section files.
- Codex workspace is visually and path-wise separate from manuscript files.

Risks:
- Magic calls such as prose review and accuracy review must not feel like hidden rewriting tools.
- If Codex suggestions appear too close to the manuscript editor, the user may feel authored-over even when no file mutation occurs.
- "Check prose" should remain a review surface, not a style-improvement engine.

## Review Questions

- Does every Codex action clearly disclose what file it can write?
- Are generated notes visually and structurally separate from manuscript prose?
- Can a user recover confidence after using Codex for twenty minutes, or does the manuscript start to feel co-authored?

