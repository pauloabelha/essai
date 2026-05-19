# Code Quality Review

## Readability

The codebase uses plain names and explicit TypeScript interfaces. The Study and Codex models are especially readable because they name domain ideas directly: `StudyPassage`, `StudyInvestigation`, `CodexSeed`, `WorkspaceTab`, `CodexHistoryFile`.

## Complexity

Main complexity concentrations:
- `src/components/shell/essai-app.tsx`
- `src/components/codex/CodexWorkspace.tsx`
- `src/lib/study/archive.ts`

These files are understandable, but they are accumulating orchestration responsibilities.

## Type Safety

Positive:
- API payload shapes are modeled with interfaces.
- Storage provider contract is explicit.
- Codex and Study path constants reduce string drift.

Risks:
- Some route responses are consumed through local interfaces rather than shared exported API contracts.
- If Study response shape changes, client and server can drift unless tests catch it.

## Maintainability

The code favors explicitness over cleverness. That fits Essai.

Suggested direction:
- Extract hooks and helpers when they clarify ownership, not simply to reduce line count.
- Keep file-native constants near their owning domain.
- Add regression tests for the philosophical boundary whenever Codex gains a new write path.

