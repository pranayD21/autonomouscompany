# Website case conversation

The case conversation replaces phone notifications for the current workflow. An authenticated owner can send a message, read the agent's questions and updates, and use the existing private document uploader. No SMS provider, carrier registration, Mac, or phone-notification permission is needed. Phone verification remains a separate sign-in option.

## Storage and API

`backend/case-messages.ts` implements `GET /cases/:id/messages` and `POST /cases/:id/messages`, mounted by `backend/api.ts`. Both require the existing authenticated case owner. Reads return `{messages, state, waiting_on, can_send}`. Each message has `id`, `role` (`user` or `assistant`), `text`, `created_at`, and `kind`. POST accepts `{id: UUID, text}` with 1–4,000 trimmed characters and returns `{saved:true, resumed, message_id}`. Reusing an ID with identical text is idempotent; conflicting text is rejected. Responses do not expose credentials.

Migration `0026_unknown_la_nuit.sql` adds `advocacy_case_messages`, defined in `backend/schema.ts`. Conversations exist independently of either agent engine, so messages can be saved while setup is queued or before a session exists. Owner writes advance the case evidence revision once and queue an event for any current agent. They do not append endlessly to the bounded intake-notes field. `addOwnerUpdate` in `backend/intake-service.ts` delegates to this same store, so the older `/updates` API and chat share duplicate protection.

A message can resume the same paused v2 agent when its existing permission is valid and no uncertain communication or active lease blocks continuation. An answer is retained even when continuation is blocked. Stopped/revoked cases retain new messages without restarting work or creating new permission. Third-party sources cannot write owner messages through this authenticated API.

## Agent messages

`postAgentCaseMessage` saves a website message under an authority-bound case credential. It requires the correct owner/case/credential, an active or waiting v2 authority, and an operation UUID. Identical retries return the saved message; conflicting retries are rejected. It does not send an external communication or increment evidence revision, avoiding self-wake loops.

`requestCaseDocument` saves a document-request bubble, deduplicated per case/document kind (`insurance_card`, `bill`, `eob`, `incident`). The response explicitly says `channel:web`, `state:saved`. It creates no SMS notification. Existing phone requests remain separate for legacy grants. Agent-authored messages preserve their provenance through the credential reference.

The read projection also includes actual recorded `request_human_help` questions, follow-up reasons, and stop summaries from the case decision ledger. It does not manufacture greetings, claim that a saved message was read, or invent insurer outcomes. `readCaseConversation` supplies the same thread to the case tools so agents can use answers supplied during setup.

## Verification

Run `scripts/case-messages.test.ts`, `scripts/intake-service.test.ts`, and `scripts/naive-activation.test.ts` serially against a disposable database using `OUTREACH_TEST_DATABASE_URL`. Tests cover messages before any agent exists, concurrent retry deduplication, owner isolation, safe pause/resume, stop persistence, uncertain dispatch, authority-bound agent messages, document-request deduplication with zero SMS rows, and questions derived from actual decisions. Deployment requires applying migration 0026 before the backend and frontend that use it.

Frontend behavior is documented in [website chat UI](web-chat-ui.md). Uploaded documents continue using the existing [document intake](documents.md) storage and evidence flow.

Verification completed locally: 5 chat database tests, 2 intake-service regressions, and 7 Naïve activation regressions passed against the disposable branch. TypeScript and diff checks passed. These tests do not establish a hosted deployment or real agent chat response; production verification must be recorded separately.
