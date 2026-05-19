# Architecture Decisions

## ADR-001: Protect Long-Session Behavior Before Refining Surfaces

Decision:
Add a long-session Playwright workflow before making relationship, provenance, or layout changes.

Why:
The review archive found that Essai's ethical boundary is well stated and partly tested, but long-session calmness is not yet protected. A realistic workflow test creates a guardrail for later implementation work.

Alternatives Rejected:

- Immediate UI changes for relationship visibility.
- Immediate app-shell refactoring.
- Broad snapshot testing of screenshots.

Reasoning:
UI and architecture changes will be safer after there is a workflow-level test proving that manuscript files remain sovereign while Study and Codex accumulate auxiliary material.

Alignment With Essai:
Essai's philosophy is behavioral. The test enforces that computational assistance continues to live beside the manuscript after mode switching, source capture, Codex workspace work, history use, and project reopening.
