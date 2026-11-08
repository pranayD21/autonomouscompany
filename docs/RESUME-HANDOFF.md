# Assurance implementation handoff

Updated November 8, 2026 UTC. Read `agents.md`, the documentation index, and `implementation-status.md`. Do not reset the shared worktree or treat earlier direct-model proof as proof of the company runtime.

## Customer journey

Assurance is phone-first: Twilio Verify → one explicitly requested AgentPhone onboarding call → owner-bound transcript → automatic case and isolated Naïve advocate → website case chat and uploads. No customer email is required. Existing email accounts and AgentMail third-party messaging stay in place. The team's manual end-to-end UI testing validated this customer workflow.

Keep `PHONE_FLOW_ENABLED=false`; the outbound request uses `PHONE_ONBOARDING_ENABLED`. No additional real test SMS or call is authorized merely by deployment. Do not substitute remote end-turn for a saved budget, bound advocate, and first persisted case goal. Do not repeat fixture creation or reconciled mutations below.

## Release and configuration

The repository is `pranayD21/autonomouscompany`, branch `main`. GitHub pushes deploy only the frontend.

Production Neon has migrations 0000–0030 (31 journal entries) and eight explicitly deployed Functions, including `firm`. The private deployment wrapper is `test-results/deploy-naive-restoration.mjs`; it invokes deployment with `.env.local` and `--no-env-pull` and redacts output. Verify deployed behavior after each change, not just CLI success.

Private `.env.local` remains ignored and mode 0600. Do not print values. Six permanent Naïve roles and isolated identities/vaults exist; the company board exists. Recurring CEO/Growth/Knowledge schedules are declared enabled and take effect when `scripts/configure-assurance-firm.ts --apply` runs after the firm Function is deployed. `ASSURANCE_FIRM_ENABLED=true`; the selected model uses `ASSURANCE_FIRM_WINDOW=immediate` because `loose` was rejected. Existing organization credit funds allocations; no credit purchase is authorized.

The corrected scoped AgentMail key is deployed. It permits inbox read/create, message read/send/reply, spam/unauthenticated label reads, and webhook read/create/update. The incorrectly scoped unused key was revoked with explicit approval. The public inbox is `bill-advocate-pranay@agentmail.to`. Five signed webhook event types are configured, and hosted boundary/signature checks passed.

Gmail read-only authorization configuration exists. Stripe code creates only unconfirmed test PaymentIntents; mocked tests passed, with no real collection or paid revenue. `PHONE_FLOW_ENABLED=false`; general inbound routing, case SMS, and Mac Messages stay disabled. Twilio OTP and the separately gated requested outbound call are the main path. AgentPhone is the only new-call provider.

## Core verification records

The existing zero-contact Naïve fixture read its case, persisted its goal, asked a website question, received an owner answer, and recorded the supplied fictional incident date with a source reference in the same durable run. Production readback showed zero outreach. The owner revoke API subsequently passed; production and provider readback confirmed authority/credential revocation, local stop, remote cancellation, preserved fact, and zero outreach. Private state: `test-results/hosted-naive-recovery.json`. Do not prepare a duplicate fixture.

Company Front Desk sessions reached real hosted tools. A board write initially failed because Naïve expects an assignee agent name, not an ID. `boardAssignee` now resolves roles/IDs to current names. The original operation was reconciled with the provider card receipt, without duplicating the card. Native `board_write` is denied with instructions to use the durable company tool. Private receipt: `test-results/board-reconciliation-receipt.json`.

Three existing staffing requests were queued for CEO allocation. A real hosted CEO saved a budget decision and queued Front Desk hiring.

One idle direct run was migrated under unchanged authority, preserving its conversation and goal and revoking its old credential. Old direct runs must not run alongside Naïve. The migration audit is durable; private receipt is `test-results/direct-naive-migration-receipt.json`.

## Key files

- `firm-events/service/tools/runner/worker/blueprint.ts`: company events, role tools, budget decisions, staffing, board, schedules, and finance/knowledge hooks.
- `agentmail-webhook.ts`, `email-attachments.ts`, `email-verification.ts`, `verified-email.ts`: signed ingress, full owner email preservation, verified sender binding, durable attachment extraction, and lead claiming.
- Per-case email inbox is saved on each outreach action and used for send/reply/status. Dedicated case mailboxes use webhook ingress; historical inbox receipts retain compatibility.
- `case-messages.ts`, `CaseChat.tsx`: owner/agent website conversation, dedupe, safe wake/resume, and uploads.
- `gmail-connection.ts`, `gmail-policy.ts`, `GmailConnection.tsx`: case-isolated read-only OAuth, connection link/status/revocation, and native read-tool policy.
- `naive-case-goal.ts`: initial goal, finish condition, and reasoned refinement history. Missing facts are waiting, not completion.
- `migrate-direct-case.ts`: guarded idle direct-to-Naïve handover with preserved history and no uncertain dispatch transfer.
- Shared Naïve capacity distinguishes a short active request lease from a real provider cooldown. One request remains admitted at a time; cooldowns and no-replay protections remain intact.
- Company scheduler batching advances up to three due events sequentially within a 45-second slice. These are invocation controls, not case-work limits.

## Authentication session fix

The user reported correct SMS codes being rejected. Production inspection confirmed the account had already verified and had an active session; a separate hosted request reproduced `/auth/token` HTTP 429. The old frontend fetched JWTs for every API call and deleted login credentials on transient session errors. `session-cache.ts` coalesces reads for one minute, and `phone-session.ts` preserves credentials on transient failures. Two focused tests and build passed.

Do not send another real SMS without explicit scope.

## Tests and operational helpers

Focused results at this checkpoint: session/activation regression 51/51, firm runner 9/9, firm service 6/6, capacity unit/database tests 6/6, and a 15-test non-database selection passed. Board assignee unit test passed. A scan of 358 tracked/unignored files found no private environment values. Docs remain Markdown-only.

Run database tests serially. Load the disposable URI inside the process from ignored `test-results/autonomy-branch.json`, never print it. Production read-only helpers include `firm-status.ts`, `firm-queue-audit.ts`, `naive-continuation-proof.ts`, and `continuation-queue-audit.ts`. Provider reads must use the shared capacity governor. Do not confuse local admission contention with a new provider HTTP 429.

The old Naïve rotation fixture was already cleaned. Local case/authority/credential/session/outreach rows are absent and private state says `cleaned:true`. Do not repeat deletions. Prior cleanup evidence remains documented.

Keep real provider delivery, Gmail consent, insurer submissions, and financial outcomes distinct from mocked or fictional proof.

## Company onboarding records

Durable business-result checks decide whether company work passed. `firmBusinessResult` checks saved CEO budget/rationale and Front Desk advocate binding/credential/provider session/first persisted goal. An ended hiring session without an advocate records `business_intervention` and `human_required`, retaining the original session. An advocate still starting stays pending. Eleven serial disposable-DB runner regressions passed; hosted readback of the prior failed hiring event correctly showed the unmet binding.

Secret-free Function logs established that an old continued Front Desk request arrived **without a bearer header** at 09:12:39 UTC. Both agent versions contained the expected URL and `allow` permissions; vault metadata bound correctly. Direct authenticated endpoint reads succeeded. Version 2 (harness `pi`) succeeded on its initial read-only diagnostic call, but continuation paused for approval despite `allow` and ended without executing the requested tool. No role token was rotated, no endpoint auth relaxed.

Private diagnostics: `firm-new-version-check.json`, `firm-new-version-events.json`, `firm-new-version-approved-read.ts`. An isolated `vetta` diagnostic agent/identity/vault/session was created to test a supported alternative without changing company agents. State `firm-vetta-diagnostic.json`; reader `firm-vetta-status.ts`; no external communications or business mutations are authorized for it. A local capacity admission rejection occurred before vault creation; it was cleared only after confirming no request was dispatched, then creation completed. Do not blindly rerun provider mutations.

`scripts/hosted-firm-smoke.ts` created a distinct zero-contact fixture explicitly permitting CEO allocation and Front Desk hiring. Its state is `test-results/hosted-firm-onboarding.json`; status helpers are `firm-onboarding-status.ts` and `firm-onboarding-provider.ts`. Earlier recovery fixtures retain their no-delegation scope. Do not duplicate the fixture.

The isolated `vetta` continuation passed: its event trace contains two successful authenticated `firm.list_cases` results in the same session, with scoped approval on the second turn. All six permanent roles were reconciled to `vetta` through the supported live agent API (Front Desk version 3, others version 2), preserving agent/identity/vault IDs. The private registry versions were updated and backend deployed. New advocates use the same explicit runtime via `ASSURANCE_FIRM_HARNESS`. Installed blueprint SDK declarations omit `harness`; use the reconciler rather than assuming bare `naive up` preserves it.

The onboarding sessions then reached their tools. CEO reused a completed board operation ID for a distinct budget allocation; the ledger correctly returned `OPERATION_CONFLICT` before budget execution. The tool error now explains exact-retry versus distinct-action IDs, and common role prompts say so. The existing CEO session received one idempotent clarification (`test-results/firm-budget-correction.json`); no budget was set by the script. Front Desk's existing event was requeued only for readback under the newer pending-dependency checks, preserving its session. Status is available through `firm-onboarding-status.ts`; do not duplicate sessions or the fixture.

The hosted CEO subsequently recorded a real 50,000 micro-USD allocation and rationale for the new onboarding fixture; its completion event reached `finished`. Front Desk created the one case-owned agent and a dedicated AgentMail mailbox, but inline provisioning failed before any case credential/run committed. Read-only reconciliation confirmed one uncertain hire operation, an idle/end-turn role session, a matching general agent, zero registered runs, and zero active credentials.

Two concrete integration defects were fixed: case-owned general versions with `assurance_authority` metadata must not be mistaken for a published MCP connector, and binding verification must use the supplied CEO allocation rather than always reading the global fallback. Provisioning/binding tests passed 9/9 after fixes. Long provisioning was moved into the existing leased setup worker: Front Desk saves `advocate-provision:<authority>` and returns `provisioning_queued`; the worker uses the saved case-owned agent/version/budget and marks staffing active only after successful registration. Setup tests passed 10/10, and runner tests passed 12/12.

The original uncertain hire was explicitly reconciled into that job without creating another agent or grant. Private receipt: `test-results/firm-hire-reconciliation.json`; audit: `firm-hire-reconcile-audit.json`. Do not rerun `queue-reconciled-firm-hire.ts`: it already committed. `firm-onboarding-status.ts` reads fixture status, and `firm-onboarding-proof.ts` requires a recorded allocation, one bound advocate, provider session, first goal, finished onboarding event, and zero outreach. `hosted-firm-smoke.ts` can check/resume/stop the same fixture; do not prepare another.

## Repository sync

The shared checkout fell behind `origin/main` while other sessions pushed from temporary worktrees and patched the same checkout. It was synced to `origin/main` after squash-merging the case budget fix. The pre-sync tree is kept on local branch `backup/main-checkout-20261108`. Commit from `main`, and deploy the backend only from a tree that contains the current `origin/main`.
