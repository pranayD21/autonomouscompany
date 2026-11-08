# Requested phone onboarding

The latest MVP direction starts with phone verification and one requested outbound onboarding call. Twilio Verify handles the sign-in code; AgentPhone handles voice. The existing email account path remains available. `PHONE_FLOW_ENABLED` stays false: this change does not enable inbound call routing, case SMS, or the Mac Messages bridge.

## Identity and request

The existing phone auth service issues the `assurance-cases` JWT after successful OTP verification. The case API verifies that token and resolves its owner with `backend/request-identity.ts`. `backend/phone-routes.ts` mounts `backend/phone-onboarding.ts` under authenticated `/phone/onboarding`.

`POST /phone/onboarding` accepts exactly `{request_call:true,accept_standard_handling:true}`. The displayed standard handling scope is `DEFAULT_INTAKE_CONSENT`; its exact text is saved with the request. The destination comes only from the owner's verified phone record. Supplying a destination or another field is rejected. Public fictional test numbers cannot receive calls. Existing accounts may use their explicitly linked verified phone; an account with a reserved onboarding request cannot subsequently be linked to another owner.

A read-only AgentPhone lookup checks the configured hosted agent and active assigned number before reserving a call. The reservation commits before the outbound POST. The ledger permits one request per owner, including failed, cancelled, and uncertain attempts. Repeated buttons, page reloads, scheduler passes, and delayed responses cannot place another call. A timeout, missing receipt, or crash after reservation leaves the request uncertain for operator reconciliation; no automatic redial or provider switch occurs.

## Voice and transcript handoff

The per-call greeting identifies the AI assistant and explains transcript storage, disabled audio recording, and the separate case advocate. The hosted voice assistant collects the case category and caller's account one question at a time. It cannot research, contact an insurer, send a text, or submit a claim during this call. It must not claim those actions happened or that the case already exists.

`GET /phone/onboarding` returns the verified phone, request status, owner-bound transcript, case ID if created, explanatory reason, standard handling scope, and capability disclosure. It also checks a due provider receipt. Receipt checks bind the call ID, hosted agent ID, number ID, outbound direction, and destination to the original reservation. A completed call with no transcript stays pending for delayed provider capture. The existing `parseCallEvidence` validator bounds the transcript and hashes its canonical content.

Intake extraction is deliberately conservative. Only an explicit caller category such as “workplace injury” or “health insurance” selects the workflow. It may appear in natural wording within a sentence of at most twenty words (“Um, it's a workplace injury”, “I got hurt at work”, “my health plan denied it”); negated sentences and longer narrative sentences do not count, and naming both categories stays ambiguous. Agent speech never supplies facts. Caller narrative remains verbatim, labelled as reported speech, and must fit the existing intake limit. Ambiguous categories, insufficient detail, or a caller request to stop preserve the transcript without creating a case. This MVP does not offer a second call or an automatic repair of ambiguous intake; the website reports that information is missing.

The case title comes from the caller's account: `descriptiveCaseTitle` in `backend/case-title.ts` asks a small OpenAI model for a 2–6 word name before the transaction opens, and falls back to "Workplace injury" or "Health insurance claim" if the call fails. The phone Function needs `OPENAI_API_KEY` for this. When intake is sufficient, the backend automatically calls the existing `submitCase` service with a preallocated case UUID and the saved standard handling consent. There is no email requirement or manual claim step. Case creation, authority, and queued isolated Naïve setup use the existing transaction path. Retries reuse the same case ID and never restore a revoked authority. Onboarding accepts only the Naïve engine; it cannot fall back to direct OpenAI. `active` means the case exists and its advocate setup is queued, not that a live agent session or insurer action has been verified.

`POST /phone/onboarding/stop` stops pending setup and revokes an already-created case authority. It shares a database row lock with case creation. An in-flight call may still connect; the endpoint does not claim to remotely hang up a provider call. A late receipt is retained without restarting work.

## Calling back

The user asked that a person who misses the call can call back. The onboarding line is `ONBOARDING_CALLBACK_NUMBER` in `backend/phone-onboarding.ts`. `GET /phone/onboarding` returns it as `callback_number` while the attempt is `needs_information` or `failed`, and the dashboard notice shows it. This remains one outbound call per owner; a callback never dials.

Reconciliation lists completed inbound calls with AgentPhone's `search` filter, then requires the same hosted agent, number, inbound direction, and a `fromNumber` equal to the verified phone, started after the original request. The newest match replaces the transcript and uses the normal intake and case path. An insufficient callback stays `needs_information` and the person can call again. Cancelled attempts and existing cases are never reopened. The scheduler checks recoverable attempts for 24 hours; the dashboard also checks while it is open.

Inbound hosted calls cannot take a per-call prompt, so `scripts/configure-agentphone-callback.ts` sets `CALLBACK_GREETING` and `CALLBACK_PROMPT` as the agent defaults. Run `npx tsx scripts/configure-agentphone-callback.ts` after changing them. Outbound onboarding and case-outreach calls supply their own prompts. The per-call `disableRecording` option is not available for inbound calls, so the callback script makes no claim about audio recording.

Limitations: phone caller ID can be spoofed, so a spoofed callback could add a false account to an attempt awaiting information. The legacy `PHONE_FLOW_ENABLED` inbound path stays off and is unrelated.

## Sign-in and account separation

The phone token and sign-in mode live in `localStorage`, shared across tabs, so a new tab cannot fall back to an older saved email account. `src/phone-session.ts` moves any earlier per-tab login on load. Verifying a phone also signs out the managed email session in that browser, except when deliberately linking a phone to an existing account. Cases belong to one owner; an unlinked phone account never reads another account's cases. Storing the token in `localStorage` trades some exposure to page scripts for this behavior.

Shared fictional test accounts only appear in the Vite development server. The phone Function's `/status` still returns the test numbers and fixed code, and they still sign in, because `scripts/phone-flow.test.ts` covers them.

## Opening another case

Phone accounts open every later case by calling, with no form. The New case page shows `call_number` from `GET /phone/onboarding` and the result of the last call. After onboarding is `active`, `reconcileNewCaseCalls` treats each completed inbound call from the verified number, started after the first case, as a request for a new case. `advocacy_phone_call_cases` (migration `0031`) holds one row per call, so retries cannot open a second case and a deleted case does not return. The same intake rules apply. A call about an existing case, an unclear call, or a stop request opens nothing and is reported as `last_call`. Stopping onboarding stops new cases too. The scheduler and the open dashboard both check. Email accounts keep the form.

The transcript is only linked through caller ID, so a spoofed caller could open a false case and start its advocate on a verified account. Fix this before wider use.

## Calling about open cases

Inbound hosted calls cannot take a per-call prompt, and the fixed greeting plays first, so the agent looks up the caller when they first speak. `scripts/configure-agentphone-callback.ts` registers three AgentPhone custom tools, served by `backend/voice-tools.ts` at `/voice-tools/:tool` on the cases Function and protected by the `AGENTPHONE_TOOL_SECRET` header:

- `get_open_cases` returns the caller's cases with a live authority. With none, the agent goes straight to intake without asking whether the case is new.
- `get_case_details` returns the title, type, reported account, advocate state and goal, and the last five conversation messages. Member IDs, claim numbers, and documents are left out.
- `save_case_update` posts "By phone: ..." to the case conversation through `sendCaseMessage`, so the advocate receives it. Retries of the same text on a call save one message.

A call that reaches a specific case gets a provisional `about_existing` row in `advocacy_phone_call_cases`. If the finished call also asks for a new case, that case opens from the speech after the request, because callers change their minds mid-call. Otherwise the row becomes `existing` and nothing opens. AgentPhone does not document a caller number in tool requests, so the server reads its live inbound calls. If it cannot single out one caller, the caller is unknown and no case data is returned.

Limitations: caller ID is the only proof of identity, so a spoofed number could hear the returned case details and add updates. Two simultaneous callers on this line are treated as unknown unless a request names one. Run `OUTREACH_TEST_DATABASE_URL=... npx tsx --test --test-concurrency=1 scripts/voice-tools.test.ts` against a disposable database. After changing the prompt or tools, rerun the configure script.

## Outreach restriction

Set `OUTREACH_RESTRICT_TO_ALLOWLIST=true` on the `firm`, `tools`, `autopoll`, and `cases` Functions to limit outside contact to `OUTREACH_ALLOWED_EMAILS` and `OUTREACH_ALLOWED_PHONES`. `takeOpenCaseAction` refuses other recipients before recording an action, and `sendOutreach` refuses them again at the send. Portals and `open_email_lead` are refused while it is on. Email-address verification mail and requested onboarding calls use separate paths and are unaffected. New advocate sessions are told the allowed address and that it is the owner's inbox, not an insurer. Authenticated `GET /stack/status` reports `outreach.restricted`. To lift it, set the flag to `false` and redeploy.

Web search and page reads stay available for research. Read-only requests can still reach outside websites, so this limits contact, not all network access.

## Call wording

Greetings identify Assurance without an opening AI statement, at the user's direction. The prompts require a truthful answer if someone sincerely asks whether they are speaking with an AI, and forbid claiming to be human. Onboarding and callback greetings still announce that a transcript is saved. Some jurisdictions restrict undisclosed AI calls or require consent to recording; this has not been legally reviewed.

## Customer communication

Advocates reach the case owner only through the website conversation. `backend/open-case-actions.ts` refuses `send_email` with role `customer` on open (version 2) authorities, and the advocate instructions say the same. Calls and third-party email are unchanged. Earlier authorities keep their original paths.

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

UI placement (2026-11-08): the onboarding notice and its **Stop onboarding and case work** control render on the overview and other workspace views, but not on individual case pages (`src/Workspace.tsx`).
