# Final Review

This first pass established the long-running quality-review branch and created the durable archive requested for Essai. It is an initial editorial and engineering review, not the end of the long-session mission.

## Synthesis

Essai's core philosophy is strong in both documentation and tests: the manuscript is human-authored, while Codex and Study operate beside it as archival and interpretive tools. The Codex e2e test that proves workspace writes do not alter `main.md` is especially important; it turns philosophy into regression-protected behavior.

The strongest product idea is the separation of rooms: Write for manuscript, Study for source-grounded investigation, Codex for scholarly apparatus work. The strongest architectural idea is file-native durability: notes, sources, workspaces, histories, and indexes live as inspectable project files.

The main risk is density. The app shell and Codex workspace are both accumulating many responsibilities. This is not yet a failure, but it is the place where future calmness could be lost. Relationship visibility is the main experiential unknown: Essai has relationship data and commands, but the next review pass must determine whether the writer can actually perceive intellectual structure during real work.

The test suite is already serious and unusually aligned with the product's ethics. The missing layer is long-session workflow testing: repeated mode transitions, PDF-heavy use, Study-to-Codex handoffs, workspace tab growth, project reopening, and accumulated provenance.

## Next Review Commit Should Do

- Start the app and capture desktop and mobile screenshots of Write, Study, Codex, and PDF source reading.
- Add or draft a real `tests/e2e/long-session.spec.ts`.
- Use the sample project for a longer Study-to-Codex workflow and append observations to this archive.
- Inspect `docs/codex-mode.md` against implementation line by line.
- Evaluate whether relationship visibility should become a persistent restrained surface.

The review archive is now present and navigable, with an initial screenshot baseline for Write, Study, Codex, and mobile Write mode. Its next value will come from inhabiting Essai for longer sessions and letting the notes thicken around real use.
