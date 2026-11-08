# Case-linked email replies

`backend/providers/replies.ts` reads only the AgentMail thread recorded on an already authorized email action. It never sends a message. The server verifies the returned inbox/thread IDs and follows up to five pages of 100 messages. HTTP requests have a 15-second timeout and 2 MB response limit. A failed page aborts the import; a five-page limit is reported as partial history.

Received messages are matched to the expected sender mailbox, configured inbox recipient, and original message through `in_reply_to` or `references`. Automatic inclusion additionally requires provider-reported DMARC or DKIM success for the sender's exact domain and no provider authentication/spam/content-screening hold. Header text claiming authentication is ignored. Multiple addresses, unexpected senders, missing references, unavailable authentication, flagged screening, missing plain text, and oversized bodies are held. No HTML is rendered and attachments are not downloaded.

These checks establish a constrained correspondence link, not the sender's professional authority or the truth of the message. Included replies remain untrusted reported information. They do not establish coverage, payment, savings, or permission to contact a new destination. Agents are instructed not to execute requests embedded in correspondence.

## Durable ingestion

Migration 0008 adds `advocacy_case_replies`, with a globally unique inbox/message pair, case/action references, retained text, timestamp, SHA-256, attachment count, and accepted/held disposition. `backend/reply-service.ts` locks the case during import. Concurrent imports deduplicate and advance the case revision only once for new accepted evidence or a change in inclusion status. Historical reviews and outreach drafts become stale when the evidence changes.

If provider content changes after import, the original is retained, the reply is held, and prior acceptance is revoked. A later retry cannot silently release that content-conflict hold. Provider screening/authentication can otherwise move an unchanged message between held and accepted. Held messages remain visible to the case owner but are excluded from agent input. Manual release of held replies is not implemented yet.

## API and interface

- GET `/cases/:id/replies` returns the latest 100 owned replies and an explicit `has_more` flag.
- POST `/cases/:id/actions/:actionId/replies/sync` reads the authorized thread and imports replies. Case ownership and an authorized email receipt are required. It does not need a new send authorization because it performs no outbound communication or model inference.
- `src/Outreach.tsx` shows communication history even when the current revision has no saved review. “Check replies” syncs a sent thread. Accepted/held status, reasons, plain text, and unread attachment counts are visible.
- A new crew run captures up to the latest 20 accepted replies under the same case lock as other evidence. It records whether older replies were omitted. The model must cite exact reply UUIDs and hashes; invented or missing correspondence references fail completion validation. The UI links those references to saved replies.

Replies do not automatically send a response, submit a claim, or claim an insurer decision occurred. Polling is currently initiated from the case UI; provider webhooks, scheduled checks, reply-in-thread sending, and automatic follow-up orchestration remain to be implemented.

## Verification

`scripts/replies.test.ts` uses an isolated Neon branch and fake provider transport to exercise sender/authentication/reference checks, concurrent duplicate imports, held messages, evidence revocation, preservation of original content, provider failures, owner isolation, pagination, and result references. No test sends a message. Live AgentMail and app checks are recorded in the change log.

Provider contract: [AgentMail Get Thread](https://docs.agentmail.to/api-reference/inboxes/threads/get). The provider's structured `authentication_results` is used, never an unsigned Authentication-Results header.

`scripts/replies-app-smoke.ts` uses the existing authorized test email and signed-in test owner to check the live AgentMail thread through the UI. It never sends or authorizes an email. It verifies reload persistence, repeat sync, missing authentication, and cross-user read/sync denial. An empty live thread is reported as pending inbound verification, not a successful receipt test.

`scripts/reply-review-smoke.ts` starts or resumes one review of the actual accepted test reply, checks that the immutable input contains its UUID/hash, and verifies a persisted UI reference. It uses the approved synthetic test operator and never authorizes follow-up email.

The live test also exercises the distinction between correspondence and financial evidence: an acknowledgment does not change the bill/EOB arithmetic or prove payment. Review requests and corrections explicitly receive the server-computed potential difference; the existing validator still rejects any mismatched result.

The real synthetic-thread reply was imported and cited by a saved review. The first review failed arithmetic validation; one correction in the same session passed. Acknowledgment remains distinct from a claim approval or payment. Content-conflict holds also persist when the message was already held before its body changed.
