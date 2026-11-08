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

No production persistent session has been registered. Activation still requires an admin-scoped setup key for Assurance's Managed Agents organization, successful two-case vault-isolation verification, and a real start/wake test. The legacy dashboard key was incompatible and revoked. The original own-inbox grant remains human_required with its existing counts; this implementation does not reactivate it. A customer-facing activation/status interface and automatic credential renewal are not implemented.
