# Performance Improvements

No performance code changes landed in this pass.

The review baseline remains:

- selected-source Study investigation over 1,740 chunks
- roughly 616ms server-measured investigation time on the review machine
- multiple Codex workspace/history reads when entering Codex mode

Future implementation should profile before changing behavior. In Essai, performance work must protect attention: fewer interruptions, less churn, and stable typing.
