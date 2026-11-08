# Case outreach

The case workspace supports reviewed synthetic calls through ElevenLabs with native Twilio telephony (replacement code prepared; account setup and live verification pending) and emails through AgentMail. A saved Naïve review for the current case revision is required before drafting outreach. Drafting does not contact anyone.

## Workflow

1. Complete the crew review and refresh until it is saved.
2. Choose a channel, enter one recipient, and save the exact discussion plan or email text. Saved drafts are immutable. Create a new draft to change the recipient or content.
3. A configured test operator reviews the saved draft and confirms authorization. The destination must also appear in the corresponding server-side approved test list.
4. The server records the approver and timestamp before making one provider request. The action then shows the provider receipt or an uncertain/rejected outcome.
5. Check provider status to refresh call completion/duration or email labels. Accepted email is not proof of delivery; completed call is not proof of savings.

New calls disable Twilio audio recording and require an ElevenLabs agent with voice recording disabled; ElevenLabs still processes and retains a transcript. The confirmation tells the operator this. The app stores provider status and duration, not transcripts or email bodies returned by status checks. The operator-supplied draft remains in Postgres. This is a synthetic test workflow, not authorization to process real patient information.

## Configuration

`neon.ts` provides server-only ElevenLabs and AgentMail credentials, with the AgentPhone key retained only for historical receipt reads to the case Function. No secret enters the browser. `CREW_ALLOWED_USER_IDS` controls which signed-in operators can spend credits or authorize outreach. `OUTREACH_ALLOWED_PHONES` contains comma-separated E.164 numbers; `OUTREACH_ALLOWED_EMAILS` contains comma-separated single email addresses. Empty lists disable dispatch. Adding a destination is not consent to call or email it: each saved action still requires explicit authorization.

The previous one-off phone test does not authorize another call. Leave the lists empty until a new test has an agreed recipient and reviewed content. Never use a successful build or mocked provider response as proof of real delivery.

## State and duplicate protection

`advocacy_outreach_actions` holds the immutable request, state, approval record, provider identifiers, status, and check time. A caller-generated UUID makes draft creation idempotent; reusing it for different content returns 409. Only a `draft` whose source revision still matches its owned case can atomically become `dispatching`. Concurrent authorizations have one winner. The dispatch intent commits before the network call.

Successful acceptance becomes `submitted`. An explicit validation/auth/funding/rate-limit rejection becomes `rejected`. A timeout, malformed successful response, server error, or uncertain outcome becomes `unknown`. A crashed request may remain `dispatching`. Neither state can automatically retry. Reconcile with the provider before preparing another action. No exactly-once delivery guarantee is claimed across the network boundary.

AgentMail receives the action UUID as its `Idempotency-Key`. Its send keys expire after 24 hours; the local state prevents later automatic resends. The ElevenLabs/Twilio adapter performs no automatic call retries; a timed-out or incomplete response must never cause an automatic redial.

Cases with outreach history cannot be deleted through the app. The database foreign key also restricts deletion. A retention/redaction workflow remains to be implemented.

## Interfaces and files

- `backend/providers/outreach.ts`: validates drafts, checks configured recipients, sends once, and reads minimal provider status.
- `backend/providers/voice-config.ts`: synthetic voice instructions, including the per-case discussion-plan rules.
- `backend/outreach-service.ts`: atomic dispatch claim and durable result handling.
- `backend/schema.ts`, migration `0003_nifty_black_bolt.sql`: outreach table and case index.
- `backend/api.ts`: owner-scoped GET/POST `/cases/:id/actions`, POST `/:actionId/authorize`, and POST `/:actionId/refresh` under that path. Authorization additionally requires an operator, approved destination, and explicit confirmation.
- `src/Outreach.tsx`: draft form, saved content review, authorization confirmation, and receipt status.
- `scripts/outreach.test.ts`: real isolated Postgres concurrency/state tests with fake provider transports. Set `OUTREACH_TEST_DATABASE_URL` to a temporary branch, apply migrations, then run `npx tsx --test scripts/outreach.test.ts`. Tests never send a real call or email.

## Provider references

- [AgentPhone outbound calls](https://docs.agentphone.to/api-reference/calls/create-outbound-call-v-1-calls-post)
- [AgentPhone call lookup](https://docs.agentphone.to/api-reference/calls/get-call-v-1-calls-call-id-get)
- [AgentMail send API](https://docs.agentmail.to/api-reference/inboxes/messages/send)
- [AgentMail idempotency](https://docs.agentmail.to/idempotency)

Case-linked reply ingestion and correspondence-aware reviews are now implemented; see [reply handling](replies.md). Owner-enabled scheduled polling is described in [reply monitoring](reply-monitoring.md). Automatic reply dispatch, agent-accessible outreach tools, and ElevenLabs SIP routing remain separate work. Outbound actions still require explicit authorization.

## Verification record

The hosted AgentPhone and ElevenLabs demo agents now start with the fictional pharmaceutical-office chemical burn. They gather missing employer/claim information one question at a time, keep workers' compensation and personal health coverage separate, and leave unknown amounts unset. The older $1,200 bill/$400 EOB example is a separate optional health-insurance scenario. The per-case AgentPhone discussion prompt follows the same insurer-facing boundaries. Both setup scripts read the agent back after updates and reject mismatched prompts or greetings. ElevenLabs readback also checks authentication, recording-off, and the 180-second limit.

Both provider readbacks passed after this update. These checks establish saved configuration, not tested spoken behavior. No new call was placed. The AgentPhone SIP dashboard still offers request-only access, and the approval-email search returned no result. The existing AgentPhone number remains on its working hosted-voice route. Connecting ElevenLabs requires provider SIP enablement and a compatible trunk, followed by a separately authorized call test. See [ElevenLabs SIP setup](https://elevenlabs.io/docs/eleven-agents/phone-numbers/sip-trunking).

Eight isolated database/provider-transport tests pass. The deployed workflow also passed the draft UI, replay deduplication, changed-content rejection, owner persistence, operator denial, and cross-user checks for list/create/authorize/refresh. `scripts/outreach-app-smoke.ts` reuses the private synthetic operator/session created by the crew test and never authorizes a send. The provider read adapter retrieved the previously authorized 46-second call successfully. The operator subsequently authorized one concrete synthetic email. It was dispatched through the case API, saved with its AgentMail receipt, and independently found in the intended Gmail inbox. Case-linked calling remains unverified. The authorized test email later received a real reply, which the app imported once and retained across reloads; cross-user reply read/sync checks passed.

## Telephony replacement

New case calls use the [ElevenLabs/Twilio path](voice-twilio.md). AgentPhone SIP approval is no longer a prerequisite for that path. Calling is disabled until the dedicated outreach agent and imported Twilio number are configured. Historical unprefixed receipts still read AgentPhone; new receipts use `elevenlabs:<conversation_id>` and retain the Twilio Call SID in `provider_thread_id`. No schema migration is needed. These local changes have passed transport tests and build, but have not been deployed or tested with a live Twilio number.


## Threaded autonomous follow-ups

Migration 0012 adds nullable `reply_to_message_id` and `reply_thread_id` to outreach records. The autonomous runner selects the latest submitted email for the same case and authorized destination before reserving the follow-up. It records that message/thread and keeps its subject. The model cannot choose arbitrary reply IDs or recipients. Manual new drafts continue using the existing send endpoint.

The provider uses AgentMail's [Reply To Message endpoint](https://docs.agentmail.to/api-reference/inboxes/messages/reply) for records with a reply context. It explicitly sets the authorized `to` address, disables reply-all and tracking, and clears CC/BCC. Missing half of the reply context is rejected before HTTP dispatch. A response on a different thread is an uncertain outcome, never an automatic retry. All 27 combined autonomy, outreach, and ElevenLabs transport tests passed on the isolated branch, and the build passes. Migration 0012 is applied to production. Live same-thread delivery is not yet verified.
