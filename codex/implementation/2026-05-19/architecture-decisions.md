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

## ADR-002: Use Fenced Markdown For Study-to-Codex Provenance

Decision:
Represent Study handoff metadata as a fenced `essai-provenance` Markdown block in the Codex workspace.

Why:
The review archive identified provenance decay during handoffs as a risk. A fenced block is readable, durable, and parseable without requiring a new storage schema or hidden metadata layer.

Alternatives Rejected:

- Hidden JSON sidecar metadata: too easy to separate from the visible note.
- Inline prose only: readable but harder to parse reliably later.
- Immediate rich UI provenance chips: potentially useful, but premature before the Markdown contract is stable.

Alignment With Essai:
The block keeps evidence inspectable in plain files and supports computational assistance without touching manuscript section files.
