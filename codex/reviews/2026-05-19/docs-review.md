# Documentation Review

## README

The README is unusually strong as a design contract. It explains not only what Essai does, but what it refuses to do. That refusal is the core product.

Strengths:
- Clear local-first storage model.
- Strong AI boundary language.
- Specific source intake contract.
- Explicit storage provider interface.
- Detailed Codex mode contract.
- Clear test coverage summary.

Risk:
- The README now carries a large amount of product, architecture, philosophy, and operation detail. It may eventually need companion documents so the README remains readable as an entrance while deeper contracts live under `docs/`.

## Codex Mode Docs

The README points to `docs/codex-mode.md`. The review should compare the implementation and e2e tests against that contract in a later pass.

## Missing Review Docs

Recommended future docs:
- `docs/manuscript-boundary.md`: the constitutional rule and all write paths.
- `docs/provenance-model.md`: source, page, retrieval, confidence, handoff, and audit terminology.
- `docs/relationship-model.md`: link types, inferred relationships, canonical versus proposed relations.

