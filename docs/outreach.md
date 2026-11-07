# Case outreach

The case workspace supports reviewed synthetic calls through AgentPhone and emails through AgentMail. A saved Naïve review is required before drafting outreach. Drafting does not contact anyone.

## Workflow

1. Complete the crew review and refresh until it is saved.
2. Choose a channel, enter one recipient, and save the exact discussion plan or email text. Saved drafts are immutable. Create a new draft to change the recipient or content.
3. A configured test operator reviews the saved draft and confirms authorization. The destination must also appear in the corresponding server-side approved test list.
4. The server records the approver and timestamp before making one provider request. The action then shows the provider receipt or an uncertain/rejected outcome.
5. Check provider status to refresh call completion/duration or email labels. Accepted email is not proof of delivery; completed call is not proof of savings.

AgentPhone audio recording is disabled, but its API still captures a transcript. The confirmation tells the operator this. The app stores provider status and duration, not transcripts or email bodies returned by status checks. The operator-supplied draft remains in Postgres. This is a synthetic test workflow, not authorization to process real patient information.

## Configuration

`neon.ts` provides server-only AgentPhone and AgentMail credentials to the case Function. No secret enters the browser. `CREW_ALLOWED_USER_IDS` controls which signed-in operators can spend credits or authorize outreach. `OUTREACH_ALLOWED_PHONES` contains comma-separated E.164 numbers; `OUTREACH_ALLOWED_EMAILS` contains comma-separated single email addresses. Empty lists disable dispatch. Adding a destination is not consent to call or email it: each saved action still requires explicit authorization.

The previous one-off phone test does not authorize another call. Leave the lists empty until a new test has an agreed recipient and reviewed content. Never use a successful build or mocked provider response as proof of real delivery.

## State and duplicate protection

`advocacy_outreach_actions` holds the immutable request, state, approval record, provider identifiers, status, and check time. A caller-generated UUID makes draft creation idempotent; reusing it for different content returns 409. Only a `draft` can atomically become `dispatching`. Concurrent authorizations have one winner. The dispatch intent commits before the network call.

Successful acceptance becomes `submitted`. An explicit validation/auth/funding/rate-limit rejection becomes `rejected`. A timeout, malformed successful response, server error, or uncertain outcome becomes `unknown`. A crashed request may remain `dispatching`. Neither state can automatically retry. Reconcile with the provider before preparing another action. No exactly-once delivery guarantee is claimed across the network boundary.

AgentMail receives the action UUID as its `Idempotency-Key`. Its send keys expire after 24 hours; the local state prevents later automatic resends. AgentPhone documents no outbound-call idempotency key, so a timed-out call must never be redialed automatically.

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

Automatic reply handling, scheduled follow-ups, agent-accessible outreach tools, and ElevenLabs SIP routing remain separate work. This version requires the operator to authorize and check each action in the app.

## Verification record

Eight isolated database/provider-transport tests pass. The deployed workflow also passed the draft UI, replay deduplication, changed-content rejection, owner persistence, operator denial, and cross-user checks for list/create/authorize/refresh. `scripts/outreach-app-smoke.ts` reuses the private synthetic operator/session created by the crew test and never authorizes a send. The provider read adapter retrieved the previously authorized 46-second call successfully. A newly sent case-linked email or call still requires explicit test authorization and delivery verification.
