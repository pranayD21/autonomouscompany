# Persistent case sessions

`backend/case-agent-session.ts` implements one durable Naïve session per standing authority. It is prepared for activation, not live-verified with Naïve. The existing bounded workflow remains the production path until a case has a verified identity/vault binding and an internal session record.

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

No production persistent session has been registered. The compatible admin setup and two-case tool-isolation test have now passed using case-specific connector URLs; their fixtures and temporary setup keys were removed. Activation still requires provisioning a fresh authorized case binding and verifying a real persistent start/wake cycle. The original own-inbox grant remains human_required with its existing counts; this implementation does not reactivate it. A customer-facing activation/status interface and automatic credential renewal are not implemented.


## Owner-visible session status

The owner-only autonomy history API now returns session state, next check time, and any recorded reason. It excludes credentials, remote identity/session IDs, agent IDs, and worker leases. The prepared frontend shows this status next to the existing authority stop control. A scheduled status check is not a promise that contact will occur. Human-help decisions display the actual question and a count within the returned decision history (at most 100 decisions), not a count of all operator actions or all-time human interventions. The frontend is published at assurance.claims and hosted browser checks passed.


## Version and binding preflight

Ordinary crew reviews and bounded decisions explicitly use `NAIVE_GENERAL_AGENT_VERSION`, rather than the coordinator’s changing default version. The configured version 21 was read from the live provider and has zero MCP servers, deny-by-default tools, and only delegation/wait tools enabled. This prevents a concurrent case-specific version publication from redirecting a general review to that case. Updating this environment value requires verifying the replacement version is connector-free. Missing/invalid versions or a task budget above the existing $0.25 cap disable general session creation.

Before the persistent worker starts a remote session, `backend/providers/case-binding.ts` reads the pinned version, identity metadata, and identity’s attached agents. It requires exactly the expected case-specific Assurance connector, no literal credential headers, deny-by-default permissions, the existing $2/month and $0.25/task budget, matching case identity metadata, and the correct agent attachment. A mismatch records human_required without starting inference. Provider read failures use the existing backoff instead. The worker receives the public `NAIVE_CASE_TOOLS_URL` base via its server environment.

These checks do not prove that the vault contains the correct sealed token; the provisioning operation must still create and verify that binding before registration. Public per-user provisioning and renewal remain unfinished. The runtime preflight needs no new admin key and does not mutate remote agents.
