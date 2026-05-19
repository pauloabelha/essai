# Provenance Review

## First-Pass Assessment

Provenance is one of Essai's strongest design instincts. The README repeatedly insists that sources, pages, retrieval method, confidence, Markdown ledgers, and archived files remain visible and file-native.

In code, Study passages include:
- `sourceFile`
- `sourceType`
- `page`
- `confidence`
- `retrievalMethod`
- `matchTerms`
- `resolvedTerms`
- `expandedTerms`
- `exactPhraseCandidate`
- `query`

This is a good evidentiary shape.

## Risks

Provenance can decay in handoffs. The crucial transition is Study to Codex:
- A selected passage is staged in the Codex workspace with source, page, retrieval, query, and quote.
- That is strong, but the workspace is editable Markdown. The user can accidentally separate quote from provenance later.

Potential improvement:
- Provide a lightweight provenance block format that remains readable as Markdown but is structurally recognizable by Essai.
- Example: a fenced `essai-provenance` block or a compact YAML-style metadata stanza under a quote.

## Auditability

The Study `auditLog` is promising. Future review should inspect whether the audit log is visible enough to support trust without adding noise.

