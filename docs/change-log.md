# Change log

## 2026-11-07 — Shared context and documentation policy

Added `agents.md` with the product direction, hackathon constraints, integration decisions, privacy/evidence boundaries, and a mandatory rule to document every repository change in a Markdown-only `docs/` directory.

Added the documentation index, product brief, architecture/file map, Neon setup record, implementation-status handoff, demo/research guide, and this log. Documented uncertainty and separated proposed integrations, local unfinished code, deployed infrastructure, and verified command results.

Validation: checked Markdown links, confirmed all files under `docs/` are Markdown, reviewed staged changes for secrets, and ran `git diff --cached --check`. This commit contains documentation only; no application build or service test was rerun for it. Earlier build/deploy evidence and unresolved verification are in implementation-status.md.

Earlier setup also created local application/configuration/migration files, installed dependencies and agent tooling, and deployed Neon services. Those implementation files are not included in this documentation commit; see neon.md and implementation-status.md for the complete handoff.
