# Restoring Naïve for new cases

The user requested Naïve again after reporting that capacity had recovered. A live coordinator read and a tool-free inference session succeeded without HTTP 429; the session returned idle/end_turn with no pending actions. This is an observation, not a guarantee against future rate limits.

## Engine selection

`ASSURANCE_CASE_ENGINE=naive` selects Naïve for new version-2 authorities when `NAIVE_CASE_PROVISIONING_ENABLED=true`. `direct_openai` keeps the previous default. Existing runs never change engines automatically. `backend/autonomy-service.ts` creates one setup record for Naïve, or one direct run for direct inference, atomically with owner permission. Neither path requires the legacy review or operator allowlist. Legacy grants retain their original behavior.

`backend/case-agent-setup.ts` and `backend/provision-case-session.ts` provision a case-specific identity, vault credential and pinned coordinator version. A dedicated v2 coordinator is selected by `NAIVE_OPEN_COORDINATOR_ID` and `NAIVE_OPEN_GENERAL_AGENT_VERSION`; its general version is restored without a case connector. The legacy coordinator is unchanged. Non-expiring credentials remain authority-bound and revocable. `backend/case-agent-session.ts` starts one durable remote session and sends new evidence/timers to that same session. Terminal or uncertain states do not silently create replacements.

`NAIVE_OPEN_SESSION_BUDGET_MICRO_USD` is a required positive provider budget, configured from the available organization credit balance. Naïve requires a numeric session cap; this does not purchase credit or impose the former fixed $0.25 repository allowance. Naïve checks the current coordinator cap even for a pinned case version. The dedicated v2 coordinator therefore has a provider cap derived from available credit, while the legacy coordinator keeps its original cap. Existing session caps are not silently changed. Capacity admission, cooldowns and request isolation remain enabled.

## Goals and owner responses

The `set_goal` MCP tool saves an immutable goal and finish condition in a delivered event. See [goal storage](naive-case-goals.md). Naïve v2 actions require that goal. Public source retrieval, evidence attribution, contact destinations, outcome recording and send-once controls use the same Assurance tools as direct inference.

The owner can answer a human-help request in the website. `backend/intake-service.ts` saves the answer once and resumes the existing authority/session when eligible. Unknown or dispatching outreach blocks resume; the answer remains saved. Third-party replies can queue evidence but cannot resume human-required permission. The UI displays the selected engine and stable goal; legacy Naïve approval controls are not used for v2 owner answers.

## Verification

Use disposable database tests serially: `scripts/naive-activation.test.ts`, `scripts/naive-case-goal.test.ts`, `scripts/case-agent-session.test.ts`, `scripts/case-agent-setup.test.ts`, and `scripts/provision-case-session.test.ts`. Unit suites cover binding, MCP tools, direct-engine compatibility and activation state.

`scripts/hosted-naive-smoke.ts prepare|check|resume|stop` uses fictional shared phone accounts and an explicit zero-contact authority. It observes the real hosted scheduler, checks owner isolation, requires a persisted goal and human-help pause, and verifies zero outreach. Its private IDs and receipts are in ignored `test-results/hosted-naive-recovery.json`. Reuse that fixture; do not create replacement sessions after an uncertain start. Production rollout and final evidence are recorded in the change log.

A first hosted setup succeeded but startup received a definite HTTP400 because the legacy coordinator's current $2 cap overrode its pinned case-version cap. No remote session was created and no outreach occurred. Its fixture credential was revoked and remote identity/vault removed; the same zero-contact authority/setup is being reprovisioned under the dedicated v2 coordinator. The failed attempt is not counted as successful hosted execution.

Active-session and confirmed-tool status checks now return to the minute scheduler instead of adding a five-minute monitoring delay. Idle sessions still wait for evidence, owner messages or the agent's follow-up time. This changes responsiveness, not the number of actions a case may take; the shared Naïve request governor remains active.

For current version-2 cases, the server confirms only allowlisted, case-bound MCP tools for the existing Naïve session. Provider confirmation uses session scope so repeated reads do not require another pause. Every actual tool request still authenticates its case credential and checks current authority before side effects; revocation and send-once ledgers remain in force. Legacy approvals remain call-scoped. Company role confirmations similarly remain confined to that role's allowed tools and identity. Confirmation intent is still durably reserved before the provider request, and uncertain confirmation is never automatically replayed.

## Hosted continuation checkpoint

The existing zero-contact Naïve fixture received an owner answer through the website message API. The hosted scheduler delivered an event to the existing session; that run recorded the supplied fictional incident date with an evidence source reference. Production readback confirmed the same durable run and zero outreach rows. This is real Naïve inference and persistence, not the earlier direct-model proof. The subsequent owner revoke passed: production readback confirmed a revoked authority, revoked credential, stopped local run, and the same remote session cancelled by Naïve. The separate company budget/hiring sequence remains unfinished.
