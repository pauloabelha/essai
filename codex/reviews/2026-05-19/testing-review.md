# Testing Review

## Existing Strengths

The test suite already covers:
- project creation and ordering
- note capture
- source indexing and upload
- PDF text extraction and highlighting
- Study search and page ordering
- storage behavior
- mode switching
- focus mode
- Codex relationship, provenance, cards, manuscript links, magic prompts, and fallback behavior
- Codex e2e protection of manuscript files

The Codex e2e test is particularly important because it tests philosophy as behavior.

## Missing Coverage

Long-session workflows are the largest gap:
- repeated mode switching across Write, Study, and Codex
- many Codex workspace tabs
- repeated Study-to-Codex handoffs
- PDF page jumps and zoom changes over time
- accumulated source shelf state
- project reopen after relationship work
- pane width persistence across modes
- manuscript protection across every Codex command and magic call

## Suggested Test Shape

Add a Playwright test that behaves less like a form test and more like a working session:
- create a book
- add manuscript text, notes, sources, and an uploaded fixture PDF
- search Study
- open a source result
- hand a passage into Codex
- create a workspace tab
- use relationship commands
- reopen the project
- assert manuscript files remain unchanged
- capture screenshots on failure

The test does not need to assert every pixel. It should protect workflow continuity and file integrity.

