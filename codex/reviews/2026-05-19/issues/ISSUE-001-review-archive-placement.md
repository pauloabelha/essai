# ISSUE-001: Review Archive Placement Is Philosophically Ambiguous

## Workflow

Creating a quality-review archive about Essai itself.

## Reproduction

1. Create a branch for long-running review work.
2. Create `codex/reviews/YYYY-MM-DD/` at the repository root.
3. Compare that location with Essai's normal book-local `projects/<book>/codex/` structure.

## Screenshots

None yet.

## Philosophical Impact

The repo-level archive is durable and easy for developers to find, but it does not fully inhabit Essai's own book model. A book-local archive would test Essai as intended, but could blur the distinction between reviewing the app and reviewing a manuscript project.

## Usability Impact

Future reviewers may not know where to continue the archive.

## Technical Observations

The requested path is repo-level `codex/reviews/YYYY-MM-DD/`, so this pass follows it.

## Suggested Direction

Keep the requested repo-level archive, but add a later session that creates an Essai project specifically for review work and compares the two archival experiences.

