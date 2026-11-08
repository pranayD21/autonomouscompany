# Case intake and agent activity

The current web flow is sign in → describe the issue or attach documents → **Start handling my case** → follow agent activity. New-case submission sends `POST /cases` with a stable client UUID and `start_agent:true`. The backend creates the case and agent authority atomically. A concise submission disclosure replaces the separate permission textarea and checkbox. `backend/intake-policy.ts` supplies the recorded standard scope; old grants are never silently expanded.

`src/CaseForm.tsx` makes the account of what happened the main input. Contact details, title, employer/insurer fields, and amounts are optional and collapsed. A title is derived from the narrative when omitted. Files can substitute for a narrative; the saved account then says which documents the owner asked Assurance to review. Files are uploaded to the returned case ID and reading starts automatically. Failed file processing leaves the existing case visible with an error; it does not create a replacement case. Files over 5 MB are rejected before submission.

`src/Workspace.tsx` shows a status card, outcome, activity feed, documents and details; see frontend.md for the simplified layout. The legacy review and manual outreach controls were removed from the UI on 2026-11-08. Repeated prototype/synthetic banners are removed; shared fixed-code login accounts retain a short fictional-record notice. Existing messages and evidence retain their original provenance.

`src/Autonomy.tsx` shows status, goal, questions, and decisions. Existing saved cases without a current grant offer **Start handling my case**, with the same concise scope disclosure, instead of starting old cases on page view. Scope, engine identity and finish condition are no longer displayed. **Stop agent work** stays in the status card while an authority is active.

A human-required direct run offers a response box. `POST /cases/:id/updates` carries `{id,text}` with a stable UUID on retries; the server saves the owner update and resumes only when safe. The UI says **Update saved**, since a busy or uncertain dispatch can prevent immediate resumption. The existing explicit resume control remains available for separately uploaded information.

`src/Documents.tsx` starts reading after upload. Machine-extracted text is shown as **Read from document**, with its provenance in a collapsed transcription. Owner confirmation is an optional attribution upgrade, not a mandatory intake step. Failed reading remains visible with a retry control.

## Submission and compatibility contract

New submission records `DEFAULT_INTAKE_CONSENT` as a version-2 policy. The scope permits organizing evidence, research, relevant organizational contact, and follow-up; it excludes payments, settlement acceptance, and misrepresentation. Existing v2/legacy activation APIs remain compatible. The status API's `activation_available` flag is authoritative. Creation or activation failures must never appear as successful agent work.

## Runtime feedback and control

The history response retains `authorities`, `decisions`, `sessions`, and `setups`. New session fields are `engine`, `goal`, `finish_condition`, `waiting_on`, and `last_activity_at`. Session states distinguish queued, working, waiting, human attention, interrupted, finished, and stopped. A finished agent status is not presented as independently verified payment. Unknown states are shown as unavailable rather than successful.

A pending setup without a session says that permission was saved but an agent session has not started. Read failures retain the last displayed data and warn that it may be stale. A manual refresh is available. Polling runs every 15 seconds and stops when the component unmounts or changes cases.

`direct_openai` sessions are labeled Direct model; Naïve sessions are labeled Naïve. Only Naïve sessions show provider-action confirmation controls. Legacy records with no engine field retain their earlier Naïve interpretation. Historical bounded authorities retain their original scope and expiry display; the UI does not expand them.

For a direct-model session in `human_required`, the owner can answer in place or select **Continue with updated information**. This posts `{confirm:true}` to `/cases/:id/autonomy/:authorityId/resume`; the UI explains that the original permission is unchanged. The server must verify ownership, the resumable state, and the existing authorization. This button does not create another grant or clear uncertain dispatches.

**Stop agent work** uses the existing revoke endpoint. The UI explains that an in-flight communication may finish, while new work must stop after revocation is recorded. Server-side revocation enforcement is required; hiding the form is not a security control.

## Verification

Earlier verification (before the simplified intake): three focused tests in `scripts/activation-state.test.ts` passed: exact version-2 permission serialization, direct/Naïve approval distinction, and truthful completion/error labels. `scripts/activation-ui-fixture.ts` passed a browser flow with mocked auth and API transport: no saved review, explicit permission, checkbox reset after editing, activation queue, direct-engine goal, human-help resume, stop, unavailable-account state, and a separate Naïve pending-action confirmation.

The reusable `scripts/autonomy-ui-check.ts` export remains compatible with the existing hosted E2E harness, but now tests the version-2 activation contract. These mocked checks do not prove live model execution, insurer contact, or a real claim outcome. Production activation must be verified against the deployed server separately.

## Hosted API implementation

`backend/autonomy-service.ts` creates a v2 authority, a non-expiring authority-bound tool credential, and a queued direct-model run in one database transaction. The owner’s case row is locked to serialize competing activation requests. Existing active, waiting, or human-required permission prevents a second grant. The new path needs `ASSURANCE_DIRECT_ACTIVATION_ENABLED=true` on the cases Function; this is an explicit deployment readiness setting, not an inference that a server has model credentials. The cases Function does not need the OpenAI key. Legacy activation retains its review, operator, recipient, and expiry checks.

History projects direct runs without exposing their credential bindings, pending tool arguments, or full model conversation. Owner resume requires a v2 human-required run, a valid unchanged authority and credential, no live runner lease, and no unresolved dispatch. It queues an owner-resume event without resetting counters, changing the goal, or creating new permission. Unstarted pending calls are closed with explicit not-executed tool messages so fresh reasoning can read the owner’s updates; started calls are never cleared by resume. V2 bearer credentials retain owner and active-authority checks without the legacy operator allowlist. Revocation invalidates authority-bound credentials and fences the direct runner by clearing its lease; an already-dispatched communication may still complete.

`scripts/direct-activation.test.ts` covers atomic activation, ownership, readiness, duplicate grants, unchanged permission on resume, uncertain-dispatch refusal, and revocation. All three tests passed against the disposable database with serial execution, including a resumed model turn that receives the owner event and instruction to read current case evidence. TypeScript passed after integration. These checks do not prove deployed activation.

The case header now points to agent permission and status rather than the optional gateway-only quick review. The unavailable “Review with AI” control was removed from the hosted workspace; existing saved analysis remains visible. Case edits explain that active agents consume new evidence on a later turn, rather than imposing a saved-review prerequisite. Document reading is independent of legacy crew access and is authorized by the document API.

Action evidence includes document references only after the extraction is ready and the owner has confirmed it. Merely uploading a file does not establish the text used to support an action.

## Hosted smoke commands

`scripts/hosted-direct-smoke.ts` creates distinct fictional fixtures for zero-contact work and a separately authorized single-email check. It signs in through the hosted web application, then uses the observed authenticated cases API. It never runs a local scheduler or directly changes production database rows. The default host is `https://assurance.claims/#workspace`; `E2E_BASE_URL` can select another deployment. Private identity credentials and browser sessions are kept under ignored `test-results/` with mode 0600; console output contains neither tokens nor passwords.

Run only after backend deployment and readiness verification:

```sh
npx tsx scripts/hosted-direct-smoke.ts prepare zero
npx tsx scripts/hosted-direct-smoke.ts check zero
npx tsx scripts/hosted-direct-smoke.ts resume zero
npx tsx scripts/hosted-direct-smoke.ts check zero
npx tsx scripts/hosted-direct-smoke.ts stop zero
npx tsx scripts/hosted-direct-smoke.ts verify-stop zero
```

`prepare` verifies persisted activation and cross-account isolation. `check` observes one scheduler snapshot and returns exit code 2 while work is pending. It requires a stable goal, finish condition, a human-required state, and zero outreach. `resume` supplies a fictional incident date under the same permission; a later check requires activity after that update. `verify-stop` requires at least two minutes after revocation and compares outreach and last activity. This observation interval is evidence of a stopped run, not a claim of indefinite monitoring.

The separate `one-email` mode authorizes exactly one clearly fictional email to the user's consenting test inbox, followed by human-required waiting. It forbids calls, texts, other recipients, reminders, and follow-up messages; the script refuses its resume command. Use `prepare one-email`, `check one-email`, `stop one-email`, and `verify-stop one-email` only within that explicit grant. A provider dispatch receipt is not proof of inbox delivery or an insurer response. No actual insurer or patient is involved.

The script preserves uncertain creation or activation attempts for inspection instead of blindly creating replacement fixtures. It retains stopped fixtures because the hosted API preserves authorization records. TypeScript validation passed; this script has not yet been run against the hosted service.

`npx tsx scripts/hosted-direct-smoke.ts document zero` adds a document proof after the zero-contact agent has parked for owner input (or stopped). It generates and retains a fictional insurance-card PNG in ignored `test-results/`, uploads the same bytes with a persisted document UUID, starts direct extraction, checks the exact fictional member ID and insurer, and confirms the transcription twice. Case revision must advance once on initial confirmation and stay unchanged on the repeated confirmation. Another signed-in account must receive 404 for document listing, download, extraction, refresh, and confirmation. The command checks that no outreach was created. A pending direct extraction returns exit code 2 and can be checked again with the same command. This ordinary random signup is not a legacy Naïve reader operator; an unexpected legacy reader state fails the check. TypeScript passed; the document command has not been executed against production.

The case page opens with the agent status card; the legacy review and manual outreach panels were removed. New UI submission starts work atomically; the legacy save-only API remains available for integrations and test fixtures.

## Phone sign-in entry

When the phone Function `/status` reports `enabled=true`, the sign-in page presents phone sign-in first. Email/password appears through “Have an older email account? Sign in with email”; when phone login is disabled or status cannot be loaded, email remains the default. `usePhoneStatus` in `src/PhoneSignIn.tsx` reads `enabled`, `smsReady`, `testNumbers`, and `testCode`; `PhoneIntakes` uses the same hook for existing-account phone linking.

The phone form normalizes ten-digit US numbers, formatted input such as `(415) 555-1234`, and eleven-digit numbers beginning with 1 to E.164. International input needs an explicit country code. Public fictional numbers supplied by `/status` have one-tap buttons that request and verify the configured test code. They remain available when live SMS is unavailable. The UI identifies them as shared accounts for made-up data and says no text is sent. These controls do not establish carrier readiness or enable real calls/texts.

Verification: `npx tsx scripts/phone-ui-check.ts` passed with all external requests mocked, covering phone-only entry, the older-email-account link, formatted US input, wrong-code recovery, one-tap fictional sign-in while SMS is unavailable, disabled-phone fallback, and the dashboard's scoped bearer token. The script starts and stops its own local Vite fixture unless `PHONE_UI_BASE_URL` is provided. No real SMS or authentication requests were made.

## Hosted phone smoke commands

`scripts/hosted-phone-smoke.ts` is a live verification helper, separate from the mocked UI suite. It loads `.env.local` without printing configuration and uses `PHONE_AUTH_BASE_URL`, `VITE_CASES_API_URL`, and optional `HOSTED_PHONE_SITE_URL` (default `https://assurance.claims`). It does not run as part of build or tests.

- `npx tsx scripts/hosted-phone-smoke.ts demo` signs in through the fictional-number buttons for the two configured demo accounts, checks stable identity after sign-out/sign-in, verifies the live dashboard, creates one fictional case, checks the other account cannot list/read it, and deletes only the case it created. It does not activate an agent or request real SMS.
- `real-send` requires the privately seeded, mode-0600 `test-results/hosted-phone-real.json` containing the consenting recipient's `phone`. It checks live SMS readiness, takes an exclusive local lock, and durably records `send_attempted_at` before its single OTP request. Any previous attempt prevents another send, including after rejection or timeout. Provider acceptance is not delivery proof.
- `real-verify` reads a six-digit code from the private mode-0600 file named by `PHONE_TEST_CODE_FILE`. It verifies that code, fetches a scoped JWT, checks API identity, opens the hosted dashboard with the phone session, and signs out. It sends no SMS and creates no case. Codes, phone numbers, session tokens, and JWTs are never printed. The private journal records timestamps/status only alongside the seeded phone.

These live commands require the corresponding user-authorized scope. A surviving send lock or attempted marker requires reconciliation, never deletion to force a resend. The script was typechecked only when added; none of its live commands were executed at that point.

## Simplified intake verification

After the intake simplification, TypeScript and the production build passed. The mocked activation browser fixture passed single-click start without permission text or checkbox, standard v2 scope serialization, queued/working/attention/stopped states, collapsed engine details, an owner response with a UUID, saved-update feedback, unchanged-scope resume, stop, unavailable activation, and legacy Naïve-only provider approval. The build retains the existing bundle-size warning. These checks send no external messages and do not establish hosted deployment of this UI.

## Hosted simplified-intake check

`scripts/hosted-intake-smoke.ts` uses two fictional fixed-code identities (no SMS), submits a narrative under the standard scope with a durable UUID, immediately stops the run, and verifies a retried submission cannot restart it. It checks cross-owner denial, uploads the packet's health card, runs real direct extraction without confirmation, and confirms the run remains stopped with zero outreach. The private journal prevents accidental new fixtures; `--resume-existing` is only for reconciled incomplete attempts and reuses the same UUID. This check passed against the deployed backend. It does not test a real insurer conversation.

`scripts/intake-ui-fixture.ts` passed a browser check of the actual CaseForm with a mocked save callback: narrative-only and document-only submission, derived title, optional hidden contact fields, and no permission checkbox. This bounded test does not exercise Workspace's API/upload orchestration. `scripts/e2e.ts` now expands optional details, supplies explicit no-outreach fixture instructions, uses the new submit button, immediately revokes the created authority, and checks zero outreach before continuing isolation/deletion checks. TypeScript passed; this revised live E2E was not executed as part of the UI change.

## Naïve engine restoration

New v2 submissions can select Naïve through the server-only `ASSURANCE_CASE_ENGINE` configuration. The website shows queued setup until a session exists, then the Naïve engine, its persisted goal, waiting state and stop control. Human-help answers and continuation work for both v2 engines through the persistent Conversation section. The old standalone answer form now links to that conversation. Legacy Naïve provider-approval controls are rendered only for legacy grants; version-2 case handling does not add a separate approval form.

New case submissions explicitly include completing and submitting relevant forms and evidence through authorized portals. This scope text applies only to new grants; existing grants are not rewritten. The customer supplies access authorization, MFA/security challenges, missing facts, and required personal attestations when needed. This scope statement is not proof that portal execution is deployed; see implementation status.
