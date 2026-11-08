# Frontend workspace

The browser app is a React/Vite single page (`src/`). Signed-out visitors see the landing page (`src/Landing.tsx`); signed-in users get the case workspace (`src/Workspace.tsx`). Styling is plain CSS in `src/style.css` and `src/landing.css`; animation uses the `motion` package. Several components are adapted from Aceternity UI (MIT): the hover-expand sidebar (`src/ui/Sidebar.tsx`), file drop zone (`src/ui/FileDrop.tsx`), stateful button, step loader and timeline (`src/ui/motion.tsx`), and the sliding pill in the section nav (`src/ui/SectionNav.tsx`).

## Routes

Hash routes keep the open view across reloads: `#home` (landing), `#workspace` (overview), `#new` (intake form), `#case/<id>` (one case). Sections on the case page use `#section-overview`, `#section-documents`, `#section-authorization` (Agent work), `#section-review` (optional review), `#section-outreach` and `#section-outcomes`. The original overview, sidebar, case header, section navigation, uploader, and section order are retained. Legacy review and manual communications stay rendered inside a collapsed Additional review and communication tools panel.

## Section progress tags

`src/progress.ts` derives a progress object per case: who acts next (`you`, `waiting`, `done`), the next step, and step states for Details, Documents, Agent work and Outcome. `deriveProgress(case, snapshot, agentEnabled)` is pure and covered by `scripts/progress.test.ts`. The snapshot comes from existing endpoints: `/cases/:id/documents`, `/crew`, `/actions`, `/replies`, `/outcomes` and `/autonomy`.

The case page currently uses it only to tag sections. The section that holds the next step gets a blue **Next step** tag and a blue bar on its left edge. Finished sections get a green **Done** tag. `CaseSection` takes a `status` prop, and `useCaseProgress` in `Workspace.tsx` supplies it. The overview, sidebar and next-step card do not use the model; a fuller version that drove them was reverted at the founder's request.

The tags refresh when any non-GET request to `/cases/:id/...` succeeds. `src/services.ts` dispatches `assurance:case-changed`. They also refresh on window focus and every 30 seconds while the tab is visible.

## Copy and hierarchy rules

Two rounds of a persona-based design review set these rules (verdicts were kept outside the repository):

- The landing keeps two signature lines, "Insurance is complicated. Getting help shouldn't be." and "You've got enough on your plate.", and drops other slogans.
- Relevant qualifications appear under money and AI output, and a concise scope disclosure accompanies submission. Repeated prototype banners are removed.
- The optional review's "Run agent team" button is secondary (outlined).
- Unknown amounts show a small "Add bill and EOB amounts" prompt, never a large empty value.

## Verifying UI changes

`npm run build` type-checks and bundles. `npx tsx --test scripts/progress.test.ts scripts/activation-state.test.ts` runs the pure frontend logic tests. The Playwright suites in `scripts/*-smoke.ts` and `scripts/e2e.ts` need a running backend. Some open the overview and expect a case's `article` without navigating; with the overview as the signed-in default, they must open the case first.

## Concurrent intake integration

The founder-requested revert of the grouped dashboard and next-step redesign is preserved. Section progress tags and the blue current-section bar remain, alongside the streamlined intake. New intake still accepts narrative or files, sends an idempotent auto-start request, and starts document reading automatically. Inline owner answers, visible stop, and collapsed scope/engine metadata remain. Optional amounts and owner confirmation of machine transcription do not block starting. Direct activation readiness takes precedence over legacy crew access. Repeated prototype labels and the old permission-writing prompt are not restored.

Verification after integration: all 10 progress/activation-state tests, both mocked activation/intake browser fixtures, and the production build passed. The build retains the bundle-size warning and notes that the dynamically imported services module is also statically imported.

## Phone-first entry

The latest phone-first MVP direction supersedes the earlier email-first entry. `src/Landing.tsx` embeds `src/PhoneEntry.tsx` directly on the landing page; signed-out workspace visitors use the same entry. `src/PhoneSignIn.tsx` displays **Verify and call me**, explains the verification text, AI onboarding call, and standard case-handling scope, and uses the existing Twilio Verify phone authentication endpoints. Successful verification creates or reuses the phone account. No email is required. Phone OTP readiness and call readiness are separate: `GET /status` must return `onboardingEnabled:true` before the UI offers **Verify and call me** or requests an onboarding call. A missing or false field keeps OTP login available with **Text me a sign-in code** / **Verify and open dashboard** and an explicit call-unavailable message. Linking an existing account and fictional test accounts never request onboarding calls, including fictional numbers typed into the normal form. No case-handling scope is implied by a login-only verification. A separate button retains access to older email accounts without migrating their cases.

`src/phone-onboarding.tsx` requests `POST /phone/onboarding` only after the explicit successful verification action, with `{request_call:true,accept_standard_handling:true}` and the verified session bearer token. It supplies no caller-selected destination. The server owns permanent call idempotency. Mounting, reload, and status polling never submit another call. A failed or uncertain call request retains the login and displays the recorded status; it is not automatically retried. `GET /phone/onboarding` refreshes the dashboard status every ten seconds and can return a case link and onboarding transcript. Unknown receipts remain unconfirmed. The onboarding notice exposes **Stop onboarding and case work** for an existing attempt, including a case already created from it. It calls authenticated `POST /phone/onboarding/stop`, disables the control while pending, and updates to `cancelled` only from the server response. It makes clear that an already requested call may still connect. Failed stops leave a retryable control and never claim success; stale status reads cannot overwrite the stop result. Run `npx tsx scripts/phone-onboarding-ui-fixture.ts` for the isolated stop-control browser check.

The phone session cache and transient-error recovery in `src/phone-session.ts` remain intact. Session storage keeps the account logged in across reloads within the browser tab. The dashboard retains owner-scoped case listing, conversation, upload, agent controls, and outcomes. Phone users do not get email-verification prompts or Gmail setup. Before the first case arrives, manual case entry is optional and collapsed. Case key amounts show bill, EOB responsibility, and an explicitly estimated discrepancy; unknown amounts remain **Not yet known**. An overview with no known amounts no longer displays a misleading $0 total, and partial totals identify missing cases.

Run `npx tsx scripts/phone-ui-check.ts` for the mocked phone-first browser acceptance check. It covers the landing, explicit scope, email fallback, US normalization, invalid OTP, one call request after a rapid double-click, session preservation on reload and provider failure, and disabled phone readiness. All external requests are mocked: no SMS, calls, or real accounts are created. `scripts/email-entry-ui-fixture.ts` remains the standalone email fallback and lead-verification check. Live provider readiness and real call completion require separate verification.

### Email lead entry

`src/EmailLeads.tsx` lists messages sent to the firm whose sender matches the signed-in account's verified email. The case API checks the managed `neon_auth.user.emailVerified` value by authenticated owner ID; it does not trust email text in a request or an unverified JWT claim. Unverified accounts see a verification action delivered by AgentMail. The server reserves a hashed, owner-bound challenge before sending, expires it after 30 minutes, and records a proof only after the signed-in owner opens the matching link. It never stores the raw token. Pending or uncertain sends are not automatically repeated. The browser removes the token from the URL before confirmation. Existing managed password sign-in remains; the app does not invoke Neon verification mail.

`GET /firm/contact` is public and exposes only a valid configured `AGENTMAIL_PUBLIC_EMAIL`. `GET /email/leads` and `POST /email/leads/:id/claim` require authentication. Claiming requires a workplace-injury or health-insurance selection so an emailed situation is not silently assigned the wrong claims process. Existing claimed messages reopen their case. The workspace presents matching messages without requiring a secret link; `?claim_lead=<id>#workspace` may direct a person to the same workspace. Emailed attachment metadata is retained by ingress; this UI does not claim attachment files have already been imported into Documents.

`backend/email-verification.ts` implements authenticated `POST /email/verify` and `POST /email/verify/confirm`. Request uses the account email read from managed auth, an allowed website origin, `AGENTMAIL_API_KEY`, and `AGENTMAIL_PUBLIC_INBOX_ID` (legacy `AGENTMAIL_INBOX_ID` fallback). A send reservation in `advocacy_firm_records` prevents repeat clicks or uncertain responses from sending another message during the challenge lifetime. Confirmation consumes a SHA-256 token lookup and writes an email proof tied to the same current account address; changing that address invalidates the proof. Company tools must exclude these private verification records and must not permit agent-written email proofs. Protocol expiration is an authentication control, not a case-work limit.

`backend/verified-email.ts` accepts either the managed account's verified-email state or this app's matching proof. `scripts/email-verification.test.ts` covers real database writes with a mocked AgentMail provider and successful emailed-case creation. `scripts/email-entry-ui-fixture.ts` also covers React StrictMode: a verification link triggers one confirmation, removes its token from browser history, and loads the resulting lead list.

Successful email confirmation also marks an existing case mailbox's client address verified, within the same database transaction, only when the case belongs to that authenticated owner and the mailbox client address matches the verified email case-insensitively. Another owner's mailbox or a different client address is not upgraded. This lets a later authenticated AgentMail reply wake the correct advocate without trusting an intake address alone. New advocate provisioning prefers the current server-verified account email over an unverified intake contact.
