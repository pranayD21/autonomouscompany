# Persistent case sessions

`backend/case-agent-session.ts` implements one durable Naïve session per standing authority. A synthetic live start and same-session evidence wake have passed, with two explicit operator approvals required by Naïve. The existing bounded workflow remains the production path until a case has a verified identity/vault binding and an internal session record.

## Binding and budgets

`registerCaseAgentSession` is an internal setup function, not a public HTTP route. Its trusted caller must first verify the remote identity, sealed case credential, and approved agent version. Registration checks case ownership, the authority owner and state, credential ownership/expiry/revocation, and absence of an unfinished legacy decision or active authority lease. Repeated identical registration returns the existing record; a changed binding fails. Registration never resets a grant or creates another budget.

Migration 0016 adds `advocacy_case_agent_sessions` and `advocacy_case_agent_events`. Session records retain the case, authority, credential, identity, agent version, remote session ID, state, and lease. The first provider create uses a stable key derived from the local record ID. It pins the identity/version and sets the existing $0.25 budget. Subsequent wakes use `sessions.send` on that same remote session, with a stable key derived from the event ID. Budget pauses, approval requests, failed sessions, and other unresolved stop reasons require human review. The worker does not replace the session or increase its budget.

## Durable events

`backend/case-agent-events.ts` queues case-specific events with unique event keys. Incoming reply/evidence changes, completed-call transcripts, claimant edits, ready uploads, and confirmed transcriptions queue an event in the same database transaction as the evidence change. Retries cannot add a second event with the same key. Agent-authored facts and citations do not enqueue another model wake merely because they advance the case revision.

The worker reads the same session until it is ready for another message, then delivers the oldest pending event. It records the provider's accepted sequence only after acknowledgement. An uncertain delivery stays pending and retries with the same idempotency key; correctness across that network boundary also depends on Naïve honoring that key. The queue does not claim an independent exactly-once guarantee. Payloads contain IDs/revisions, not authorization instructions; the agent must read current case evidence and authority before acting.

A due `next_wake_at` becomes a unique follow-up event. The old timestamp is cleared only if it still matches, preserving a newer schedule written concurrently. A follow-up wakes reasoning; it does not preauthorize a future message. Idle/running sessions are checked every five minutes. Scheduler leases prevent concurrent processing; provider failures retain a fifteen-minute backoff lease. Events arriving during that backoff remain queued.

Revoked/expired authority, revoked/expired case credentials, lost ownership, or removed operator access stops the local run and cancels the existing remote session. Authority and credential state are checked again after a provider status read before delivering an event. Action tools independently enforce authority immediately at dispatch, even before the scheduler's next cancellation check.

## Scheduler integration

The existing `autopoll` Function processes call evidence, persistent sessions, and legacy authority work. The legacy scheduler skips authorities bound to persistent sessions, except unfinished native tool decisions that need crash recovery. It cannot start a parallel fresh decision session for those cases. The internal human-required state does not automatically restore itself.

`case_get` now includes confirmed document transcriptions, along with case documents, accepted replies, call transcripts, citations, facts, and standing authority. Text from external parties remains untrusted reported information; confirmed transcription verifies extracted text only.

## Verification and activation gap

`case-agent-session.test.ts` uses a disposable database and fake provider transports. It checks owner/binding isolation, concurrent starts, session/identity/budget preservation, event deduplication, same-key retry after uncertain delivery, cancellation on revocation, revocation during a provider read, budget-pause handling, and backoff without a replacement session. Existing reply, call-evidence, and autonomy suites cover the changed transaction/scheduler paths.

A temporary production synthetic session was registered for the lifecycle test. The compatible admin setup and two-case tool-isolation test have now passed using case-specific connector URLs; their fixtures and temporary setup keys were removed. The live provisioning and persistent start/wake cycle passed; normal customer activation and unattended approval handling remain unfinished. The original own-inbox grant remains human_required with its existing counts; this implementation does not reactivate it. A customer-facing activation/status interface and automatic credential renewal are not implemented.


## Owner-visible session status

The owner-only autonomy history API now returns session state, next check time, and any recorded reason. It excludes credentials, remote identity/session IDs, agent IDs, and worker leases. The prepared frontend shows this status next to the existing authority stop control. A scheduled status check is not a promise that contact will occur. Human-help decisions display the actual question and a count within the returned decision history (at most 100 decisions), not a count of all operator actions or all-time human interventions. The frontend is published at assurance.claims and hosted browser checks passed.


## Version and binding preflight

Ordinary crew reviews and bounded decisions explicitly use `NAIVE_GENERAL_AGENT_VERSION`, rather than the coordinator’s changing default version. The configured version 21 was read from the live provider and has zero MCP servers, deny-by-default tools, and only delegation/wait tools enabled. This prevents a concurrent case-specific version publication from redirecting a general review to that case. Updating this environment value requires verifying the replacement version is connector-free. Missing/invalid versions or a task budget above the existing $0.25 cap disable general session creation.

Before the persistent worker starts a remote session, `backend/providers/case-binding.ts` reads the pinned version, identity metadata, and identity’s attached agents. It requires exactly the expected case-specific Assurance connector, no literal credential headers, deny-by-default permissions, the existing $2/month and $0.25/task budget, matching case identity metadata, and the correct agent attachment. A mismatch records human_required without starting inference. Provider read failures use the existing backoff instead. The worker receives the public `NAIVE_CASE_TOOLS_URL` base via its server environment.

These checks do not prove that the vault contains the correct sealed token; the provisioning operation must still create and verify that binding before registration. Public per-user provisioning and renewal remain unfinished. The runtime preflight needs no new admin key and does not mutate remote agents.

### Stop during startup verification

The worker rereads the authority, case owner, tool credential, and operator allowlist after the remote binding check and before creating a session. Revocation during that check stops the local run without starting a remote session. This narrows the startup race; it does not make a database check and remote API call atomic. Case tools still enforce the current authority on each action.

## Operator provisioning command

`backend/provision-case-session.ts` and `scripts/provision-case-session.ts` provision an existing active, synthetic standing authority. Run with a compatible temporary admin key in a private file:

```sh
NAIVE_SETUP_KEY_FILE=/private/path/setup-key npx tsx scripts/provision-case-session.ts CASE_UUID AUTHORITY_UUID OWNER_UUID
```

The command reads the coordinator ID, general version, case-tool URL, database URL, and operator allowlist from the existing private environment. It does not create an authority, change contacts, reset counts, increase budgets, or directly send communications. Successful registration allows the scheduled worker to start the session under that authority, so this is an activation command, not a dry run. Revoke the temporary admin key after setup.

Setup creates or recovers a deterministic authority-specific identity and vault, attaches the coordinator, seals a fresh case credential, publishes or recovers a case-specific version, restores the coordinator's previous general default, verifies the binding, and registers the local run. A repeated successful command returns the existing registration without replacing its session or renewing its credential.

Provisioning uses a database transaction with authority/case row locks and a coordinator advisory lock. The token row becomes visible only when registration commits; any failed transaction leaves its remote sealed token unusable. Retry removes those stale sealed credentials and issues a fresh token. The command retains no plaintext token or admin key in a journal. Remote identities and versions can remain after failure and are recovered by deterministic metadata. Unexpected duplicate resources or foreign vault credentials fail closed. Version updates and restoration use the provider's expected-version check.

This operator path holds database locks during provider requests; it is not a public signup endpoint. Concurrent edits or stops can wait for setup to finish, and setup's authority expiry is checked again at registration. An uncertain restoration leaves registration uncommitted; the pinned general version protects ordinary reviews while the operator resolves the provider state. Automatic credential renewal and unattended approval handling remain unfinished.

Validation uses the disposable database and a fake Naïve transport: successful/idempotent activation, unchanged grant limits, wrong-owner/revoked-grant rejection before provider work, and recovery after a publication response is lost. Live provisioning and the persistent start/wake cycle have also passed with the approval limitations below.


## Live lifecycle verification

`scripts/persistent-live-smoke.ts` created a temporary synthetic case with zero contacts and `max_outbound: 0`, provisioned it, and exercised the production MCP endpoint. The scheduler started one remote session. Naïve chose a 60-minute follow-up timer and required a `read_people` approval; the operator confirmed that exact synthetic timer. A revision-2 evidence event was then queued and accepted by the same remote session at sequence 49. Naïve required another approval for `case_get`; after the exact case read was confirmed, its tool result contained revision 2 and the session finished with `end_turn`. Total reported consumption was 19,098 micro-USD ($0.019098), within the existing $0.25 cap.

This proves live binding, scheduler start, event delivery, and updated evidence consumption in one persistent session. It does not prove unattended operation: two operator confirmations were necessary. The smoke command verifies the actual tool result and end-turn state, not just a delivery acknowledgement. Private event evidence and the test state are kept under ignored `test-results/` without raw credentials.

The authority schema now permits research-only grants with zero contacts and zero outbound allowance. A positive outbound allowance still requires a contact. The action guard rejects contact attempts under a zero-outbound grant. Provisioning validates the complete authority schema before remote work.

Cleanup completed: the remote session was cancelled, its vault credentials/vault and identity were deleted, and fixture rows were removed after confirming zero outbound records. The temporary admin key was revoked and its local secret file removed. Coordinator default version 23 was read back with zero MCP servers; general reviews remain pinned to verified version 21.

## Terminal sessions and provider approvals

Naïve's [session API](https://usenaive.ai/docs/api/sessions) distinguishes resumable `idle` from terminal `completed`, `failed`, and `cancelled`. The worker now records human-required status for terminal sessions and leaves queued evidence undelivered. It never sends another wake to a terminal session or creates a replacement budget. Provider completion alone does not establish a verified insurance outcome.

The documented confirmation API supports `scope: "session"` to grant one tool name within one session. This is explicit per grant and does not change the agent or other sessions. It is a possible operator workflow for reducing repeated approvals, not proof that the observed `read_people` gate can be disabled. No automatic session-scoped grant has been added. The current live verification used two call-scoped confirmations; owner-facing approval and safe continuation remain open work.

## Owner-confirmed pending actions

`backend/case-agent-approval.ts` provides owner/operator-scoped review and confirmation for a persistent session. `GET /cases/:id/sessions/:runId/approvals` reads the current provider state on demand and returns pending action descriptions plus local confirmation history. It does not poll automatically. `POST` requires `confirm: true`, an exact pending-action hash, and `allow` or `deny`.

Only known Assurance tools bound to the same case (and the same authority when present) are supported. The pending action must include its provider turn sequence; a repeated call in a later turn therefore needs a fresh review. The API rechecks ownership, operator access, active authority, and credential validity before submitting a confirmation. Provider confirmations are always scoped to one call. Existing tool guards still enforce contact restrictions, limits, and evidence requirements.

Migration 0019 adds `advocacy_case_agent_approvals`, recording the owner, action identity, decision, and confirmed/uncertain result. An identical confirmed request returns its recorded result without repeating the provider call; a contradictory decision conflicts. Network uncertainty is recorded and requires reconciliation, with no automatic retry. A local capacity deferral occurs before sending and does not create an uncertain receipt. The database transaction serializes confirmations; a process crash across the remote call can still leave an unrecorded remote result, so callers must reread pending state rather than assume success.

`src/SessionApprovals.tsx` shows these actions when the local session requires help. The owner clicks Review pending actions, inspects the exact arguments, then explicitly approves or denies one action. Unknown tools and questions remain unsupported rather than being approved generically. This does not grant future approvals, create a replacement session, or increase spending. Migration 0019 and the approval backend are deployed. The approval UI is published at assurance.claims from commit 5b37141. Hosted mocked approval controls and real authentication/isolation passed; a real synthetic case read was subsequently confirmed through this API using its normal runtime key, with one audit receipt and an idempotent duplicate response. Post-confirmation event readback was interrupted by provider capacity errors, so continuation from this approval is not yet verified.

### Cancellation while awaiting review

The scheduler now checks authorization validity for `human_required` sessions too, even though their next-check time is null. Revoked or expired authority, revoked or expired credentials, changed ownership, and removed operator access select the existing session for cancellation. A still-authorized review pause causes no provider status read, inference, or event delivery. Cancellation failures retain the existing backoff lease and retry the same remote session. This closes the previous early-return gap that left paused remote sessions uncancelled.

### Repeatable approval integration check

`PERSISTENT_SMOKE_STATE_FILE` selects a separate private state file for `scripts/persistent-live-smoke.ts`, preserving prior cleaned test evidence. `scripts/approval-live-smoke.ts status|confirm` uses that file plus `ASSURANCE_TEST_AUTH_FILE` (a private file containing the signed-in owner's Authorization header) to exercise the deployed approval API with its normal runtime key. It verifies the authority has zero contacts and zero outbound allowance. Confirmation accepts only the fixture's case read or exact 60-minute follow-up timer; unknown actions fail closed. A confirmed response is retried once to verify the stored duplicate receipt; an uncertain response is never retried. The script records only hashes, action names, and timestamps in the fixture state. Event evidence uses a separate filename derived from the state file. Lifecycle verification requires exactly one delivered evidence-update event; unrelated scheduled follow-up events do not invalidate that check.

### Live owner confirmation result

A fresh zero-outbound synthetic case accepted an evidence-update event in its existing session at sequence 29, then paused on `assurance.case_get`. The deployed GET endpoint showed that supported action; POST confirmed it with the runtime key. A duplicate POST returned the recorded result, and production contained exactly one confirmed audit row. Later status/event reads returned HTTP 429, so consumption of revision 2 after this confirmation was not verified.

Cleanup is partial: local authority and credentials are revoked; no outbound rows were created. Remote cancellation and vault/identity deletion were rejected by provider capacity. The temporary admin key was removed from Naïve's key list after revocation, its local file was deleted, the private owner authorization copy was deleted, and both test tabs were closed. `test-results/approval-live-smoke.json` retains resource IDs and the pending cleanup status, with no raw credentials. The scheduler can retry cancellation with the unchanged runtime key; vault/identity deletion needs fresh temporary setup access once capacity recovers. Do not reuse or reactivate this fixture.

## Queued owner activation

New persistent authorizations can atomically enqueue a case-specific setup job in `advocacy_case_agent_setups` (migration 0020). The authorization POST accepts `persistent: true`; it requires the existing owner/operator access, completed review, bounded synthetic policy, and `NAIVE_CASE_PROVISIONING_ENABLED=true`. Unconfigured requests fail before creating a grant. Existing authorizations and legacy behavior are unchanged.

The owner history response exposes setup state and a sanitized reason. The UI opts new grants into the persistent path only when the server advertises availability, explains the single-session budget, and displays queued/ready/stopped setup status. A queued or failed setup never falls back to a separate legacy model run. Unfinished native tool decisions retain their existing crash-recovery path.

`backend/case-agent-setup.ts` runs from the authenticated autonomy scheduler. One leased job per tick calls the existing recoverable provisioning operation with the original case, authority, and owner. Concurrent workers cannot claim the same unexpired lease. Provider failures back off the same job; ownership, operator access, revocation, and expiry are checked before remote work and again by provisioning. The operation preserves grant counts, version pinning, case-specific URLs, and budgets.

The dedicated `NAIVE_SETUP_API_KEY` is configured only on `autopoll`; it is never added to the case API or browser. The runtime key is passed separately and is not overwritten. The availability flag defaults false. Production activation was gated on compatible setup access and a live queued activation test; both passed as recorded below. Automatic credential renewal is still unfinished.

Initially, migration 0020 and the activation backend were deployed with the availability flag false and no setup jobs present. Enabling the flag makes the setup credential mandatory at deploy time. At that stage, the activation UI was locally tested but unpublished; the frontend release was baf3548. Seven queue tests, four provisioning tests, and eleven legacy autonomy regressions passed serially on the disposable branch. Local UI E2E and hosted core E2E passed; the hosted check asserted persistent_available=false.

### Approval recovery and setup-worker credential

After provider recovery, the earlier approval fixture passed strict event verification: the same session consumed revision 2 after owner confirmation and ended its turn, using 11,012 micro-USD ($0.011012). Remote cancellation, vault/credential removal, identity removal, and local fixture deletion then completed with zero outbound rows. This resolves the partial-cleanup and continuation limits recorded above.

A dedicated `assurance-case-setup-worker` Managed Agents key is stored in the private environment and deployed only to `autopoll`. Neon environment-name readback confirmed `NAIVE_SETUP_API_KEY` on autopoll and absent from cases. The runtime key remains unchanged. The setup key requires admin scope for identity/vault management; it is kept server-side and used only by the verified scheduler path. Activation remained disabled until the owner-API test below passed.

### Owner-API activation smoke command

`scripts/activation-live-smoke.ts` creates a fresh synthetic case through the authenticated API, requests a real crew review, verifies that review was saved and valid, and submits one persistent authorization with zero contacts and zero outbound allowance. Its private state file preserves case/authority/session identifiers across commands; repeated creation refuses to replace an existing fixture. `status` reads setup/session progress without directly invoking the worker. The test uses the normal five-minute authenticated Neon trigger, not a forged scheduler request. The private Authorization header is supplied by `ASSURANCE_TEST_AUTH_FILE` and is never logged.

### Live queued activation passed

The fresh case was created through the owner API and received a real valid saved Naïve crew review. An owner POST then created one zero-contact, zero-outbound authority and setup job. The real 05:05 UTC Neon trigger claimed it once, provisioned a case-specific identity/vault/version, and started one bound session. API readback showed setup ready and session running; the live workspace displayed both. An authenticated provider read confirmed the session existed. The case version was 26; the restored general default was 27 with zero connectors, while ordinary reviews remain pinned to version 21.

`NAIVE_CASE_PROVISIONING_ENABLED=true` is now deployed for the existing approved operator. The dedicated setup key is retained in private server configuration; temporary file copies and owner authorization copies were deleted and setup tabs closed. A bundle scan confirmed the setup key is absent from frontend assets. Hosted E2E with `E2E_EXPECT_PERSISTENT_SETUP=true` passed and still proved an unlisted signup cannot authorize spending.

The activation fixture was cancelled and its vault credentials, vault, identity, local session/job/authority/case rows removed, with zero outbound rows. This proves operator activation through the deployed API and real scheduler, not complete insurance claim resolution. Automatic credential renewal remains unfinished; the UI's 24-hour authority is still bounded by its expiry.


### Authorization changes during a reply wake

Before sending a queued event, the worker rereads the case, authority, and tool credential after the remote status request. A changed owner, removed operator, mismatched credential case/issuer, or changed authority approver stops the existing session and leaves the event undelivered. This extends the existing expiry and revocation check to ownership and operator access. It does not reset a session, grant, or budget.

A `request_human` tool action still changes the authority to `human_required`. The scheduler cancels that session under the existing authorization rules; a later case edit or email cannot reactivate it. A separate owner-reviewed recovery flow remains unfinished. Ordinary evidence updates continue the same session only while its authorization remains active or waiting.

### Combined reply and follow-up lifecycle regression

The disposable-database test `reply and due followup survive together through one session until final stop` exercises a reply arriving when a scheduled follow-up is due. It verifies that both events receive distinct delivery receipts in the same provider session, the timer clears, and authorization policy/counters remain unchanged. A late reply after the authority stops stays undelivered; the worker cancels once and creates no replacement session. The provider is simulated, so this test does not establish live delivery or claim resolution.

### Credential-renewal investigation

The installed Managed Agents 0.12.3 SDK defines vault rotation as create-new plus delete-old; it exposes no credential-update or secret-read method. Provisioning seals an explicit expiry equal to the Neon token expiry. Extending only the database expiry cannot renew the vault credential. A production renewal flow must replace the sealed credential, update the session's credential binding without changing its provider session or budget, and recover from partial failure between the remote and database writes. Same-session credential refresh must be verified before enabling renewal.

A fresh zero-outbound synthetic fixture was provisioned for that experiment, but Naïve returned HTTP 429 during the pre-start identity check. No provider session started, and no rotation occurred. Cleanup revoked the local tool credential and authority before attempting remote removal. The existing shared cooldown correctly deferred remote cleanup; the experiment does not establish that a running session refreshes its credential.

After the cooldown, remote cleanup returned another 429. Database readback confirmed `no_remote_session=true`, `authority_state=revoked`, `credential_revoked=true`, and `outbound=0`. Remote vault/identity removal remains pending in the ignored `test-results/rotation-live-smoke.json` fixture; do not create a replacement fixture until cleanup finishes.

Cleanup subsequently completed after the shared cooldown: the remote vault credential, vault, and identity were removed, followed by the local fixture rows. The cleanup command confirmed zero outbound rows and marked the saved fixture cleaned. There are no remaining resources from this experiment. Same-session rotation is still unverified because the session never started.
