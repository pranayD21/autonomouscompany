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

Naïve completed a full structured case-review run. Content review found unsupported deadlines/exposure/escalation claims, so strengthened all agent instructions and tightened the output schema to supplied-field evidence IDs and bounded summaries/actions. Updated the roster pin for specialist version 3 and extended smoke assertions. User added $25 to AgentPhone; verified $27 balance, then placed the single authorized retry (HTTP 200, ringing). Completion verification pending.

User confirmed the authorized phone test reached them. Provider readback confirms call `cmw7006zuahsurqhj8kjihh2x` completed, duration 46 seconds, no recording URL. Native AgentPhone outbound voice is now verified. ElevenLabs SIP routing remains pending enablement. Updated synthetic crew prompts and deployed stricter output schema; final content-check run started.

Checked the Neon $250 sponsor offer in the operator's Dia session. Claiming it requires a paid plan and billing information; left the existing free plan unchanged. Closed the temporary credit-check tabs and preserved the AgentPhone billing tab the user requested.

Final crew verification passed after allowing `wait_for_agents`: session `ses_nsvsww22q9pbsc4gygychc1rff` ended `idle/end_turn`, `output_valid: true`, with all four version-3 members ending normally. `npm run test:crew` exited 0 with `PASS Naive structured case review`. Output reports an unverified $800 variance and requires source documents/human authorization; it is not a verified saving. `npm run build` passed (262 modules; existing chunk-size warning). `npm run stack:check` connects to Postgres, Auth, Naïve, ElevenLabs, AgentPhone, and scoped AgentMail messages, but exits 1 because Neon AI Gateway has no enabled model. App-level authorized crew execution remains unverified because the operator allowlist is empty.

## Durable crew results and application verification

Added immutable completed-review snapshots and completion timestamps to crew runs. Saved reviews remain readable without Naïve availability. Intermediate submissions, invalid output, errors, and pending approvals cannot appear as finished case plans. Added missing-document display and saved-state controls; corrected the stale voice status description. Migration succeeded on a temporary production branch and then production. Four completion-gate tests passed; live authorized application verification subsequently passed. The first test setup attempt found that Vite derives public URLs rather than storing them in the environment; corrected the script to capture the API origin from actual app requests.

Live application test passed duplicate-start idempotency, valid provider completion, saved database snapshot, UI reload, and stable rereads. The full Auth/Postgres/Function/Realtime and isolation regression test also passed; Gateway inference remains blocked. Neon reported deployment completion before the new Function served traffic; verification used the actual API response, then reused the same case. Removed the temporary migration-test branch after successful migration testing. Restored the temporary test operator allowlist to its previous value. Live verification confirms POST now returns 403 while the existing saved review remains readable.

## 2026-11-07 — Help-request board

Added `NEED_HELP.txt` at the repo root. It's a request board for Yuvraj's Claude Code session: it lists the open items from implementation-status.md that it can take, and explains how teammates and their agents post requests and get status back by pulling the file. It's kept outside `docs/` because that directory is Markdown-only. Documentation only, so no build or tests were run.
