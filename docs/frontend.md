# Frontend workspace

The browser app is a React/Vite single page (`src/`). Signed-out visitors see the landing page (`src/Landing.tsx`); signed-in users get the case workspace (`src/Workspace.tsx`). Styling is plain CSS in `src/style.css` and `src/landing.css`; animation uses the `motion` package. Several components are adapted from Aceternity UI (MIT): the hover-expand sidebar (`src/ui/Sidebar.tsx`; its link grid uses a `minmax(0, 1fr)` column so the active tile stays inside the collapsed 76px rail), the upload pill (`src/ui/FileDrop.tsx`, a shrunk file-upload drop zone) and the number ticker (`src/ui/motion.tsx`).

## Routes

Hash routes keep the open view across reloads: `#home` (landing), `#workspace` (overview), `#new` (intake form), `#case/<id>` (one case). While the session check is pending, `#home` renders the landing page immediately and other non-workspace URLs render nothing (plain paper); only `#workspace` and `#case/...` show the "Loading your session…" shell. This stops the shell's header and footer divider lines flashing before the landing page.

## Workspace layout (simplified 2026-11-08)

The user asked for the app to be as simple as the landing page, keeping only what the case workflow needs. Each screen answers three questions in order: what is happening, does it need me, and what has been done.

**Overview** (`src/Overview.tsx`, styles in `src/overview.css`; re-exported from `src/Workspace.tsx` for fixtures). Redesigned 2026-11-08 to match the landing page, with layout ideas from 21st.dev ("Stats Bento" by ui layout, "Stats cards with links" by Ephraim Duncan, "KPI Tile" by OSAGI; no 21st.dev code was copied, only the layout ideas, rebuilt in plain CSS). Top to bottom:

- Header: time-of-day greeting, a large tight "Your cases." heading with the blue wordmark period, one factual sentence ("1 case needs you. Assurance is handling the other one." / "Nothing needs you right now."), and the landing-style **Open a case** pill (ink with a blue arrow circle that turns 45° on hover).
- Bento row: a dark ink **Reported savings** card (diagonal hatch and blue glow, animated count-up, "from recorded insurer decisions. Not a verified payout." caveat); a **Needs you** card that links straight to the first case needing the owner and shows its next step, or "You're all caught up"; and an **All cases** card with a segmented needs-you/waiting/resolved meter and legend. Reported savings is the sum of each case's latest outcome `reduction_cents`.
- Case list: numbered rows (`01`, `02`… in blue monospace, like the landing "How it works" steps), sorted needs-you, waiting, resolved. Each shows case type and insurer/employer, title, the `deriveProgress` next step (amber when it needs the owner), the status badge, any reported savings, and an arrow circle that fills blue on hover. A sliding white hover highlight and a filter pill (All / Needs you / Waiting / Resolved, with counts) use `motion` layout animations. Unloaded progress shows shimmer placeholders. **Open another case** closes the list.

Progress comes from `deriveProgress` in `src/progress.ts` via `useProgressMap`. `deriveProgress(case, snapshot, agentEnabled)` is pure and covered by `scripts/progress.test.ts`; its snapshot comes from `/documents`, `/crew`, `/actions`, `/replies`, `/outcomes` and `/autonomy`. It refreshes when a non-GET `/cases/:id/...` request succeeds (`src/services.ts` dispatches `assurance:case-changed`), on window focus, and every 30 seconds while the tab is visible. Pending phone intakes and the phone-link control (`src/PhoneIntakes.tsx`) appear only here, under the header. The generic `.surface a` link colour in `src/style.css` skips classes starting with `ov-`.

**Case page** (`CaseView` in `src/Workspace.tsx`), top to bottom:

1. Header: back link, case type and claim number, title, Delete.
2. Compact claim status (`src/Autonomy.tsx`, region "Case agent activation"): a small animated blue orb, 14px status heading, inline detail, and **Stop agent work** while an authority is active. The goal follows on a small line. The landing-themed composer and message treatments remain intact. Version-2 cases reply through the persistent Conversation section; older direct-model sessions retain the status-panel composer. Naïve approvals, start/resume controls, case isolation and reduced-motion behavior are preserved.
3. Outcome (`src/Outcomes.tsx`): rendered only after an outcome exists. A savings card shows the reported reduction ("You save", animated count-up), a claim-decision pill, animated before/now bars, and refund received, followed by the summary, a collapsed explanation with quotes, and the "not a verified payout" caveat.
4. Activity: one newest-first feed merging agent decisions (`/autonomy`), sent messages (`/actions`, matched by the decision's `action_id`) and received replies (`/replies`). Emails and calls show recipient, subject, delivery state and a collapsed message body. Replies show sender, subject, and whether they were held. Questions, waits and case closure appear as plain sentences.
5. Documents (`src/Documents.tsx`): an **Add documents** pill in the section header (a blue upload tile that springs up and tilts out of a dashed outline on hover or drag; the label swaps to "Drop to upload" and then upload progress) above a compact list with reading state, download, and a collapsed "What we read" transcription with optional confirmation. Dropping or choosing files uploads them immediately, one after another, with progress shown in the zone; uploads are saved as `kind: "other"` and reading starts automatically, the same as intake.
6. Details: description, a compact fact list (insurer, employer, claim number, member ID, date, state, stage, bill and EOB amounts when given), notes, and **Edit details**, which opens the existing `CaseForm`.

### Claim composer

Main-branch integration: the persistent conversation in `src/CaseChat.tsx` also uses this composer and blue orb. Its existing `/messages` API, server-backed history, polling, permission gate and stable retry payload remain intact. Pending uncertain messages keep the draft read-only while leaving the retry button available. Version-2 cases use that persistent conversation rather than a duplicate status-panel update box; older direct-model cases retain their existing `/updates` fallback. Each composer has unique label and hint IDs. The persistent chat uses paper surfaces and pale-blue owner bubbles instead of the older solid-blue bubbles.

`src/ui/ClaimComposer.tsx` adapts the rounded input and compact toolbar from the user-supplied 21st.dev prompt-box reference without its dark palette, global style injection, or simulated voice/search/think/canvas features. It uses React and the existing icons; no dependency or configuration changes are required. Styles live in `src/style.css` and use the shared landing tokens from `src/landing.css`.

The controlled textarea grows up to 200 px and retains the 4,000-character API limit. Enter submits nonblank text; Shift + Enter inserts a newline, and IME composition does not submit. A labeled circular send button and saving indicator reflect the real owner-update request. Saving disables editing and submission. The **Case documents** shortcut scrolls to the existing Documents section and focuses its uploader; it does not attach or upload a file with the message. Existing upload validation, storage and extraction remain unchanged.

`Autonomy` sends through the existing authenticated `POST /cases/:id/updates` endpoint, preserving its retry UUID and error handling. On successful saving, it displays the latest locally submitted update in a right-aligned bubble. This is a save receipt, not a generated agent answer or a complete conversation history. Saved updates remain in case notes after reload; the receipt bubble itself is not persisted. Processing follows the existing agent scheduler. Case-keyed mounting in `src/Workspace.tsx` resets drafts and receipts on navigation between claims. No new external communication, agent permissions, or provider behavior is introduced.

Verify with `npx tsx --test scripts/claim-composer.test.tsx scripts/activation-state.test.ts scripts/progress.test.ts` and `npm run build` with the three public service URLs configured. The composer tests cover rendered labels, empty-message disabling, saving state, answer-mode copy and safe escaping; they do not exercise browser keyboard, scrolling, focus, or layout behavior.

Removed from the signed-in app, with the reason:

- The hardcoded "See what Assurance is doing for you" card was identical on every case, so it gave no information.
- The bill/EOB "potential discrepancy" card and the overview's "$ to investigate" total subtracted two numbers the user typed in, which is not a verified discrepancy and means nothing for workplace injury. The amounts remain in Details. Money now comes only from agent-reported outcomes (savings card and overview total).
- The section tab bar and Done/Next-step tags. (The tabs were briefly restored, then removed again at the user's request.)
- "Case agent setup", "Scope and controls", engine name, finish condition, and "Round N" labels were internal. The engine label helper remains in `activation-state.ts` for tests.
- The legacy optional Naïve review and the manual draft-and-approve outreach form. Agent emails enable reply monitoring automatically (`backend/open-case-actions.ts`), and replies now appear in Activity. The backend endpoints are unchanged. `src/CrewReview.tsx`, `src/Outreach.tsx`, `src/ui/SectionNav.tsx` and `src/ui/CaseSection.tsx` were deleted; `src/ui/motion.tsx` keeps only `NumberTicker`.
- The document-type dropdown (uploads use `kind: "other"`).
- The visible green live dot (a hidden "Live updates connected" label remains, and a visible pill appears only while reconnecting), the workspace footer, and the per-case status text in the sidebar.

`deriveProgress` no longer tells the owner to "Approve your outreach draft". No approval control exists, and an agent email is briefly in `draft` while it sends.

## Brand mark and hero wordmark

The logo is a two-stroke "A" drawn as the `Logo` SVG component in `src/Icons.tsx`, filled with the brand blue (`--blue`, `#2465ef`). It appears in the landing header, the sign-in header and the workspace sidebar, nudged down `.09em` so it centres on the lowercase wordmark. `assets/icon.svg` (README) and `public/favicon.svg` use the same paths with no background.

The landing hero (`src/components/strikethrough-replace.tsx`, styles in `src/landing.css`) animates in two phases. First a line strikes through "in" and a handwritten blue "as" is written above it. Then the "as" drops into line, sitting `.1em` below the bottom of "surance" (canvas-measured ink bounds) so the script reads as part of the word, while the struck "in" slides down at full size behind the "Insurance is complicated." heading. A mask fades the "in" out before it reaches that heading (the `fadeBelow` prop names it). The mask's stops are offset by the registered `--in-y` property so the fade stays fixed on the page while the word moves. Offsets are measured in em and re-measured on font load and resize. Extra space under the wordmark (`.42em` bottom padding) sets the heading and call to action lower so more of the dropped "in" shows. With reduced motion the page shows the settled layout immediately.

## Hero photo backdrop

The backdrop component is `src/components/hero-backdrop.tsx`, rendered first inside `<main className="landing-page">` in `src/Landing.tsx`. It shows nine documentary photos of real people recovering from injuries: people on crutches, hand and leg therapy, a patient in a hospital lift, someone being helped into a wheelchair or down steps. One photo shows at a time; every 5 seconds a 0.45s crossfade switches to the next. It pauses while the tab is hidden, and with reduced motion only the first photo shows. Each photo has an `objectPosition` so the cover crop keeps the person in view. The layer is `aria-hidden`.

Its size depends on scroll position (`useBackdropLayout` in `Landing.tsx`, which measures the header and hero with a `ResizeObserver` into `--header-h` and `--hero-end`, and adds `is-at-top` to `<main>` while `scrollY < 8`):

- At the top of the page the photos cover at least the full viewport, behind the header, hero and anything else in view, with no top or bottom fade. The divider lines under the header and above "How it works" are hidden.
- Once the visitor scrolls, the layer shrinks to the header + hero area over 0.5s and `.hero-backdrop-fade` fades in: solid paper over the header, a fade in at the top of the hero, and a fade out over its bottom 30%. The divider lines come back.

Styles in `src/landing.css` (`.hero-backdrop*`) keep a little colour (`saturate(.35)`) at 42% opacity and wash the edges toward the paper colour so the wordmark and copy stay readable.

Files are `public/hero/01-*.webp` to `09-*.webp` (about 820 KB together, up to 1600px). Staged stock photos were replaced with real people on 2026-11-08 at the user's request. Sources:

- Public domain (US Navy / Navy Medicine on Flickr and Wikimedia Commons): hand therapy (Flickr 52033349927), wheelchair help (Commons "US Navy 070919-N-6278K-182"), patient lift (Flickr 51929649462), leg rehab (Flickr 52971670817), helped down steps (Commons "US Navy 050413-N-1485H-010"), band therapy (Flickr 52257078214).
- Public domain mark on Flickr: crutches outdoors ("Duel Crutches", Belur Math, Howrah, 51633131050) and crutches in the city ("IMG_0037", evanizzle79, 54314915502).
- CC BY 2.0: crutches on a street in Chiapas by Adam Jones (Commons "Man on Crutches - San Cristobal de las Casas - Chiapas - Mexico.jpg"). The licence requires credit, which `src/Landing.tsx` gives in the footer (`.photo-credit`). Keep that credit while the photo is used.

These people are not Assurance customers. Never caption the photos or present them as cases, outcomes or testimonials. Film stills, staged training drills, war scenes, children, and identifiable patients photographed without evident consent were deliberately excluded.

## Copy and hierarchy rules

Two rounds of a persona-based design review set these rules (verdicts were kept outside the repository):

- The landing page has no FAQ/questions section; it was removed on 2026-11-08 at the user's request. After the hero and "How it works" steps it goes straight to the footer.
- The landing keeps two signature lines, "Insurance is complicated. Getting help shouldn't be." and "You've got enough on your plate.", and drops other slogans.
- Relevant qualifications appear under money and AI output, and a concise scope disclosure accompanies submission. Repeated prototype banners are removed.
- Money appears only as agent-reported outcome figures with their caveat, or as amounts the user typed, labeled as such in Details.

## Verifying UI changes

`npm run build` type-checks and bundles; it needs the three `VITE_*` service URLs (placeholders such as `https://fixture-cases.compute.example.com` work for a local build). `npx tsx --test scripts/progress.test.ts scripts/activation-state.test.ts` runs the pure frontend logic tests. With the same placeholder variables, `npx tsx scripts/activation-ui-fixture.ts` and `npx tsx scripts/intake-ui-fixture.ts` run mocked browser checks. `CaseView` and `Overview` are exported so a fixture page can render them against mocked API routes. The Playwright suites in `scripts/*-smoke.ts` and `scripts/e2e.ts` need a running backend; the legacy crew, outreach and reply smokes target controls that were removed from the UI.

## Intake behavior

New intake accepts narrative or files, sends an idempotent auto-start request, and starts document reading automatically. Optional amounts and owner confirmation of machine transcription do not block starting. Direct activation readiness takes precedence over legacy crew access. Repeated prototype labels and the old permission-writing prompt are not restored. The production build keeps its bundle-size warning and the note that the dynamically imported services module is also statically imported.

The case page keeps the simplified workspace layout and adds the owner conversation: key amounts for phone accounts (one inline 13px row: Bill, EOB and Possible discrepancy, with "—" for unknown values and a "to investigate, not verified savings" note only once a discrepancy exists), then agent status, Conversation, Outcome, Activity, Documents, and Details. On version 2 authorities an agent question links to the conversation instead of showing a separate answer form; earlier authorities keep their original inline reply and provider approval paths.

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
