# Change log

## 2026-11-07 — Shared context and documentation policy

Added `agents.md` with the product direction, hackathon constraints, integration decisions, privacy/evidence boundaries, and a mandatory rule to document every repository change in a Markdown-only `docs/` directory.

Added the documentation index, product brief, architecture/file map, Neon setup record, implementation-status handoff, demo/research guide, and this log. Documented uncertainty and separated proposed integrations, local unfinished code, deployed infrastructure, and verified command results.

Validation: checked Markdown links, confirmed all files under `docs/` are Markdown, reviewed staged changes for secrets, and ran `git diff --cached --check`. This commit contains documentation only; no application build or service test was rerun for it. Earlier build/deploy evidence and unresolved verification are in implementation-status.md.

Earlier setup also created local application/configuration/migration files, installed dependencies and agent tooling, and deployed Neon services. Those implementation files are not included in this documentation commit; see neon.md and implementation-status.md for the complete handoff.

## 2026-11-07 — Stack setup in progress

Installed the Naïve SDK, CLI, and blueprint package. Added capped five-agent crew config, SDK adapter, durable crew-request schema, protected crew routes, account connectivity check, and executable browser E2E script. Added the stack operations document. Created a scoped Naïve API key in the ignored environment and provisioned all five agents using the existing hackathon credits. No subscriptions, numbers, or top-ups purchased.

Verification: production build passed. Browser E2E passed auth sign-up/session, Function access, Postgres persistence, Realtime create/delete delivery, reload, and sign-out. Gateway inference remains blocked (no enabled models). Initial browser test failed because matching Chromium was absent; installed it and reran successfully. Initial Naïve coordinator creation failed due to the CLI's two-phase roster application; explicit handoff names resolved it. New crew endpoints/migration are not yet deployed or end-to-end verified.

### Account and wiring follow-up

Created AgentPhone, ElevenLabs, and AgentMail accounts through the operator's Dia browser using Playwriter. Provisioned and configured the synthetic voice demo number and ElevenLabs agent, created the mail inbox, and stored scoped keys locally. See stack.md for spending, permissions, credential rotation, and license details. Requested AgentPhone SIP enablement. The one user-authorized outbound test was refused with HTTP 402 before dialing; no top-up performed. Added provider configuration scripts, guarded test-call script, environment template, crew smoke script, and dashboard crew controls. Applied crew-run migration and redeployed the protected Function. Expanded TypeScript checking to scripts and the Naïve config. Production build still passes; bundle-size warning remains.

Corrected the Naïve coordinator's stale specialist-version pins after inspecting live delegated sessions. Kept all budget caps unchanged. Added a deletion guard for cases with crew-run records and extended the E2E checks to authentication, input validation, and operator spend restrictions. Checked the compiled frontend against configured secret values; no provider secret was found.

Refreshed README and implementation-status.md to remove stale handoff claims and describe reproducible run/test commands. Added `NAIVE_SPECIALIST_VERSION` so fresh installations can start at version 1 while this account pins the verified version 2 specialists. E2E rerun passed, including the new authentication/input/spend-restriction checks; AI unavailable state was confirmed, not mistaken for inference success.

Final browser check also passed two-user isolation: the second user cannot see the first user's case in REST or Realtime and receives 404 when trying to run its crew or delete it. Updated agents.md, architecture.md, and implementation-status.md to reflect the implementation rather than the earlier docs-only handoff. Preparing the implementation commit; environment files and generated test records remain ignored.

The crew smoke test exposed a missing `submit_output` call after successful delegation. Added explicit tool-submission instructions to the coordinator and session request; preserved strict output validation. The smoke command now returns distinct nonzero exits for failed or pending runs. Build passes after this correction; corrected live run verification follows.

Added an explicit funded-test retry path after the user authorized a retry to the same number. It only accepts a known HTTP 402 rejection, preserves that record, and never retries a successful/ambiguous call automatically. Opened the requested AgentPhone billing page in Dia for the user to fund themselves; no payment made by the assistant.
