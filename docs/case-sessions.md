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

`src/SessionApprovals.tsx` shows these actions when the local session requires help. The owner clicks Review pending actions, inspects the exact arguments, then explicitly approves or denies one action. Unknown tools and questions remain unsupported rather than being approved generically. This does not grant future approvals, create a replacement session, or increase spending. Migration 0019 and the approval backend are deployed. The approval UI remains committed but unpublished; the live frontend is the separate c3cf6fd release. Live provider confirmation through this new API remains unverified.

### Cancellation while awaiting review

The scheduler now checks authorization validity for `human_required` sessions too, even though their next-check time is null. Revoked or expired authority, revoked or expired credentials, changed ownership, and removed operator access select the existing session for cancellation. A still-authorized review pause causes no provider status read, inference, or event delivery. Cancellation failures retain the existing backoff lease and retry the same remote session. This closes the previous early-return gap that left paused remote sessions uncancelled.
