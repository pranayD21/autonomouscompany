# Case outreach

New persistent cases use the owner's version-2 permission. The agent chooses insurer or customer destinations, message content, and follow-up timing within that permission. `backend/open-case-actions.ts` implements this path; `backend/case-action-service.ts` selects it only for a version-2 authority. Earlier grants keep their original review, recipient, count, and expiry restrictions.

New voice calls use AgentPhone only. Historical ElevenLabs receipts remain readable. See [AgentPhone voice](voice-agentphone.md) for configuration and live-test limits. Email uses AgentMail. A provider receipt establishes acceptance, not delivery, insurer approval, or money received.

## Persistent action processing

The service locks the owned authority and case, checks permission state and evidence references, and reserves an immutable decision and outreach record. Destinations must be one email address or an E.164 phone number. The new path has no repository recipient list or case message-count cap. The model must follow the owner's permission; choosing a provider does not create consent.

Each operation has a caller-generated UUID and a fingerprint of its decision, channel, and destination. An exact retry reads the saved operation. Changed content under the same UUID fails. A pending communication blocks another contact or completion until its result is known. Human-help requests remain available.

`backend/outreach-service.ts` changes a draft to `dispatching` only when the owned case revision still matches and the authority remains active or waiting. It commits that intent before calling the provider. Revocation before that claim prevents the send. A send already in progress may complete after revocation.

Provider acceptance becomes `submitted`. A definite rejection becomes `rejected`; a lost response or other ambiguous result becomes `unknown`. An interrupted request may remain `dispatching` or leave its decision unfinished. Automatic retries do not resend these operations. Reconciliation is required before another communication. The service does not promise exactly-once network delivery.

Accepted emails enable reply monitoring. Follow-ups to the same destination use the prior message and thread, preserve its subject, and explicitly exclude reply-all, CC, BCC, and open tracking. A mismatched provider thread is an uncertain outcome. Active version-2 authorities keep their reply monitors eligible beyond the legacy thirty-day expiry; this does not restore stopped or revoked permission. See [reply ingestion](replies.md) and [scheduled monitoring](reply-monitoring.md).

The agent can wait for a chosen time, request human help, or stop. Successful completion requires a current recorded outcome reference. The result remains evidence-reported and not independently verified; simulated results do not establish a real payout. See [outcomes](outcomes.md).

## Configuration and interfaces

Server-only `AGENTMAIL_API_KEY` and `AGENTMAIL_INBOX_ID` enable email. `OUTREACH_VOICE_PROVIDER=agentphone`, `AGENTPHONE_API_KEY`, `AGENTPHONE_AGENT_ID`, and `AGENTPHONE_NUMBER_ID` enable calls. No provider secret enters the browser.

The legacy manual API remains under `/cases/:id/actions`: list/create drafts, authorize a concrete action, and refresh its receipt. Its operator and approved-destination checks still apply. `OUTREACH_ALLOWED_EMAILS`, `OUTREACH_ALLOWED_PHONES`, and `CREW_ALLOWED_USER_IDS` remain legacy controls and do not extend an old grant to the persistent path.

`advocacy_outreach_actions` stores request content, dispatch state, approver, provider receipt, and thread context. Cases with outreach history cannot be deleted through the app. Retention/redaction remains unfinished. `backend/call-evidence-service.ts` imports completed-call transcripts as unverified reported speech; it never treats a completed call as proof of coverage or savings.

## Verification

`scripts/open-case-actions.test.ts` exercises the actual v2 service against disposable Postgres with fake senders: exact retry, conflicting retry, concurrent contacts, unknown and rejected results, thread follow-ups, revoked prepared dispatch, owner isolation, evidence validation, and completion rejection without a current outcome. `scripts/outreach.test.ts` covers shared dispatch behavior. Run database suites serially with `OUTREACH_TEST_DATABASE_URL`; they do not contact a live recipient.

Live-test evidence and deployment status belong in [implementation status](implementation-status.md) and [the current handoff](RESUME-HANDOFF.md). Prior authorized test emails and calls do not authorize a new recipient or prove the hosted persistent workflow.

The full hosted-compatible fictional exchange in `scripts/hosted-workflow.test.ts` passed with the eleven direct-runner tests (12 total). It covers activation, persisted pending-tool restart, simulated model 429 recovery, two threaded fake sends, real reply normalization/ingestion, an evidence-backed simulated outcome, and completion without further execution. The optional service override in `connectDirectCaseTools` injects the fake sender while preserving MCP authentication. This test proves integrated service behavior; hosted deployment and live transport checks remain separate.
