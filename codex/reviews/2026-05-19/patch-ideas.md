# Patch Ideas

## Relationship Visibility

Add a restrained "relationships" strip or inspector that can appear in Write mode without becoming a dashboard. It should show only:
- direct backlinks
- source-linked notes
- Codex-proposed links clearly marked as proposed
- orphan warnings only when relevant

## Study To Codex Provenance Blocks

When Study sends an excerpt to Codex, write a Markdown block that remains human-readable but structurally recognizable.

Possible shape:

```md
> excerpt text

Source: sources/files/raw/example.pdf
Page: 12
Retrieval: Exact Match
Query: programmable machines
```

Later, Essai could parse these blocks for source-links and backlinks.

## App Shell Decomposition

Introduce small hooks:
- `usePanePersistence`
- `useStudyInvestigation`
- `useCaptureFlows`
- `useBookFileLoader`

Do this incrementally and only where tests already protect behavior.

## Long-Session Playwright Spec

Create `tests/e2e/long-session.spec.ts` with a realistic writer/scholar session. Keep assertions focused on:
- manuscript preservation
- visible provenance
- workspace persistence
- source result navigation
- no obvious UI overlap at desktop and mobile widths

## Markdown Review Export

Codex history is durable JSON. Add an optional "Save as Markdown session note" action so important conversations become readable archive material without manual copy work.

