# Usability Notes

## First Impressions

Essai's strongest usability idea is its refusal to center AI. The primary surface is still a manuscript editor, and the auxiliary surfaces are named as rooms rather than as a generic assistant panel. This matters: the interface vocabulary gives the writer permission to remain the author.

The README's description of Write mode as "one central Markdown editor, no permanent preview" is coherent with a calm writing environment. The architectural risk is that the same app shell now contains many rooms and workflows. If that density leaks into the visible interface, calmness could become a stated value rather than a felt one.

## Calmness

Positive findings:
- The mode model is legible: Write, Preview, Study, Codex.
- Focus mode supports the core emotional promise: the page can become only the text.
- Capture is present but not framed as a replacement for writing.
- Study search is inspectable instead of conversational, which lowers rhetorical pressure.

Friction risks:
- Source, note, Study, and Codex controls may compete for attention during long work sessions.
- Relationship visibility appears mode-local. If relationships are only visible after entering the right surface, the writer may not perceive the intellectual structure while writing.
- Pane resizing is useful, but persistent per-mode widths can also create hidden layout state that feels mysterious when moving between screens or machines.

## Readability

The code suggests Essai prioritizes readable provenance labels: source file, page, confidence, retrieval method, scope, and audit log. That is exactly the kind of calm detail that helps a scholar trust a system.

The next review pass should inspect actual rendered density:
- Are provenance labels visible without feeling like metadata clutter?
- Do PDF highlights feel like evidence, or like search-engine decoration?
- Does the Codex panel visually subordinate itself to the Markdown workspace?

## Navigation Continuity

Write to Study and Study to Codex are the decisive transitions. The Study passage handoff into Codex is promising because it stages the quote with provenance in the workspace. That makes the transition archival rather than chatty.

Potential weakness: after a handoff, it may not be obvious later where the staged excerpt came from, whether it has been committed, and which intellectual relationship it created.

## Cognitive Load

The current design exposes many durable concepts:
- section tree
- file-backed manuscript
- source shelf
- selected source
- direct references
- conceptual echoes
- claims
- related objects
- graph
- Codex workspace tabs
- Codex history
- magic calls

Each is legitimate. The risk is accumulation. The long-session review should track whether a writer can still answer "where am I, what am I editing, and what is evidence?" after an hour.

