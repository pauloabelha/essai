# ISSUE-002: App Shell Carries Dense Cross-Mode State

## Workflow

Static inspection of `src/components/shell/essai-app.tsx`.

## Reproduction

1. Open `src/components/shell/essai-app.tsx`.
2. Inspect state and effects related to Write, Preview, Study, Codex, capture, pane persistence, keyboard shortcuts, and file loading.

## Screenshots

None yet.

## Philosophical Impact

Essai's rooms are conceptually distinct. If the shell becomes too coupled, the implementation may eventually make those rooms harder to keep calm and bounded.

## Usability Impact

Cross-mode state bugs can feel like loss of place: wrong pane widths, stale Study selection, unexpected loading, or a Codex seed appearing out of sequence.

## Technical Observations

The component is readable but broad. It coordinates many durable domains from one place.

## Suggested Direction

Extract behavior into small hooks only where there is a stable ownership boundary. Start with pane persistence and Study investigation loading.

