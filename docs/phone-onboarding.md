# Requested phone onboarding

The latest MVP direction starts with phone verification and one requested outbound onboarding call. Twilio Verify handles the sign-in code; AgentPhone handles voice. The existing email account path remains available. `PHONE_FLOW_ENABLED` stays false: this change does not enable inbound call routing, case SMS, or the Mac Messages bridge.

## Identity and request

The existing phone auth service issues the `assurance-cases` JWT after successful OTP verification. The case API verifies that token and resolves its owner with `backend/request-identity.ts`. `backend/phone-routes.ts` mounts `backend/phone-onboarding.ts` under authenticated `/phone/onboarding`.

`POST /phone/onboarding` accepts exactly `{request_call:true,accept_standard_handling:true}`. The displayed standard handling scope is `DEFAULT_INTAKE_CONSENT`; its exact text is saved with the request. The destination comes only from the owner's verified phone record. Supplying a destination or another field is rejected. Public fictional test numbers cannot receive calls. Existing accounts may use their explicitly linked verified phone; an account with a reserved onboarding request cannot subsequently be linked to another owner.

A read-only AgentPhone lookup checks the configured hosted agent and active assigned number before reserving a call. The reservation commits before the outbound POST. The ledger permits one request per owner, including failed, cancelled, and uncertain attempts. Repeated buttons, page reloads, scheduler passes, and delayed responses cannot place another call. A timeout, missing receipt, or crash after reservation leaves the request uncertain for operator reconciliation; no automatic redial or provider switch occurs.

## Voice and transcript handoff

The per-call greeting identifies the AI assistant and explains transcript storage, disabled audio recording, and the separate case advocate. The hosted voice assistant collects the case category and caller's account one question at a time. It cannot research, contact an insurer, send a text, or submit a claim during this call. It must not claim those actions happened or that the case already exists.

`GET /phone/onboarding` returns the verified phone, request status, owner-bound transcript, case ID if created, explanatory reason, standard handling scope, and capability disclosure. It also checks a due provider receipt. Receipt checks bind the call ID, hosted agent ID, number ID, outbound direction, and destination to the original reservation. A completed call with no transcript stays pending for delayed provider capture. The existing `parseCallEvidence` validator bounds the transcript and hashes its canonical content.

Intake extraction is deliberately conservative. Only an explicit caller category such as “workplace injury” or “health insurance” selects the workflow. Agent speech never supplies facts. Caller narrative remains verbatim, labelled as reported speech, and must fit the existing intake limit. Ambiguous categories, insufficient detail, or a caller request to stop preserve the transcript without creating a case. This MVP does not offer a second call or an automatic repair of ambiguous intake; the website reports that information is missing.

When intake is sufficient, the backend automatically calls the existing `submitCase` service with a preallocated case UUID and the saved standard handling consent. There is no email requirement or manual claim step. Case creation, authority, and queued isolated Naïve setup use the existing transaction path. Retries reuse the same case ID and never restore a revoked authority. Onboarding accepts only the Naïve engine; it cannot fall back to direct OpenAI. `active` means the case exists and its advocate setup is queued, not that a live agent session or insurer action has been verified.

`POST /phone/onboarding/stop` stops pending setup and revokes an already-created case authority. It shares a database row lock with case creation. An in-flight call may still connect; the endpoint does not claim to remotely hang up a provider call. A late receipt is retained without restarting work.

## Persistence and configuration

`backend/phone-schema.ts` defines `advocacy_phone_onboarding`; migration `0030_phone_onboarding.sql` adds it. The row binds owner, verified phone, exact consent, routing IDs, provider receipt, transcript/hash, intended case ID, created case ID, status, reason, and polling lease. No credentials or recordings are stored in the row. Statuses are `not_started` (response only), `dispatching`, `submitted`, `unknown`, `failed`, `needs_information`, `ready`, `activating`, `active`, and `cancelled`.

Required configuration names:

- `PHONE_LOGIN_ENABLED=true`, `PHONE_ONBOARDING_ENABLED=true`, and existing `PHONE_AUTH_BASE_URL`/`PHONE_AUTH_SECRET` for phone identity and the explicit call path.
- `PHONE_SMS_PROVIDER=twilio_verify`, with existing server-only `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, and `TWILIO_VERIFY_SERVICE_SID` for sign-in codes.
- `OUTREACH_VOICE_PROVIDER=agentphone`, `AGENTPHONE_API_KEY`, `AGENTPHONE_AGENT_ID`, and `AGENTPHONE_NUMBER_ID` for voice.
- `ASSURANCE_CASE_ENGINE=naive` and `NAIVE_CASE_PROVISIONING_ENABLED=true` for case activation, plus the existing Naïve worker configuration.
- `PHONE_FLOW_ENABLED=false` remains the inbound/SMS gate.

The cases Function needs the onboarding and activation configuration. `backend/phone-worker.ts` exposes `onboardingEnabled` in `/status` and reconciles pending onboardings in its verified `phone-notifications` schedule before checking the separate phone-flow gate. Its deployment must include the same onboarding/activation variables and an enabled schedule. Browser polling is an additional recovery path, not the only intended continuation mechanism. Receipt checks use a lease and next-check timestamp; overlapping browser and scheduler requests cannot activate the same request concurrently.

## Verification

`scripts/phone-onboarding.test.ts` uses mocked Twilio Verify and AgentPhone transport. Run `OUTREACH_TEST_DATABASE_URL=... npx tsx --test --test-concurrency=1 scripts/phone-onboarding.test.ts` only against a disposable database. It covers JWT issuance, one-call concurrency, owner isolation, receipt binding, scope checks, delayed transcripts, cancellation, linking restrictions, automatic Naïve setup, ambiguous sends, activation retry, and revoked-authority preservation. Without a test database, only the deterministic extraction test runs and the database suite is explicitly skipped.

Migration and test results are recorded in `docs/change-log.md`. The implementation has not placed a real onboarding call, delivered a real OTP, changed inbound routing, or established live transcript-to-Naïve continuation. Those claims require separate authorized live verification.

Provider contracts checked against current official documentation: [outbound call request](https://docs.agentphone.ai/api-reference/calls/create-outbound-call-v-1-calls-post) and [call details/transcripts](https://docs.agentphone.ai/documentation/guides/calls). The provider supports a per-call hosted prompt and retains transcripts when audio recording is disabled.

The deployment configuration now explicitly passes `PHONE_ONBOARDING_ENABLED` to cases and phone, and the Naïve activation/firm and AgentPhone selector flags to phone. No provider secret is exposed to the browser. Advocate prompts use website questions for phone owners and do not require email.
