# Provenance Improvements

## 2026-05-19: Provenance Protected In Workflow Test

The first implementation pass adds e2e coverage that verifies source material can move through Study and Codex while remaining auxiliary. It checks that Codex workspace material persists under `codex/workspace.md` and that manuscript text does not receive generated or source-note material.

This is a test-level provenance improvement, not a UI-level provenance change.

Future implementation target:
Create a more parseable, readable provenance block for Study-to-Codex handoffs.
