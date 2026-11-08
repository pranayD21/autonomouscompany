# Implementation status and next steps

Updated November 8, 2026 (UTC). See [stack operations](stack.md) for account configuration and test details.

## Current release status

The live frontend includes the combined dashboard and activation UI, deployed automatically from main after verified GitHub push d0cdf05. The updated hosted E2E passed authentication, persistence, Realtime, readiness, cross-user isolation, deletion, and password sign-in. AgentPhone is the only new-call provider; Twilio, ElevenLabs, and SIP setup are no longer activation work. Migrations through 0020, the owner-approval API, and the queued activation backend are deployed. Queued activation is enabled for approved operators after live owner-API review, authorization, scheduled provisioning, and bound-session verification. New users still cannot spend agent credits. The approval UI is published and its mocked hosted interaction passed; a real synthetic case-read confirmation through that API passed with the runtime key and one audit receipt. After provider recovery, post-confirmation revision-2 consumption and end-turn were verified; the fixture is fully cleaned up.

Case-specific Naïve identity/vault isolation and a same-session evidence wake passed live synthetic tests; those fixtures and temporary setup keys were removed. Operator activation is verified; broader public customer access and automatic credential renewal remain unfinished. The original own-inbox grant remains human-required and must not be reset. AI Gateway inference has no enabled model. Payments remain hypothetical. The sections below retain earlier milestone evidence; these current decisions supersede older provider and activation descriptions.


## Verified

- Neon CLI authentication and the requested production project setup completed. Postgres, Auth, Functions, Realtime, and AI Gateway credentials are provisioned.
- All twenty-one Drizzle migrations (0000–0020) applied. The case Function is deployed with server-only Naïve configuration.
- `npm run build` passes, including TypeScript checks for backend, frontend, scripts, and provider configuration. Latest build: 681 modules, 732.00 kB JavaScript. The chunk-size warning remains.
- `npm start` serves the preview; use http://localhost:4173.
- `npm run test:e2e` passes signup/session validation, authenticated Function access, database create/persistence/delete, Realtime delivery, reload, and sign-out. It also verifies 401 for missing/invalid tokens, 400 for negative amounts, and 403 for unlisted users trying to spend crew credits.
- Live authorized app crew test passed: signup, case creation, duplicate-start deduplication, Naïve completion, saved Postgres review, and UI reload. Four focused tests reject intermediate/error/approval-pending output. Saved review records remain readable without another provider call.
- Injury-first live test passed: null financial amounts, saved crew review, progressive employer update, stale-edit conflict, and stale-outreach rejection. Ten validation/completion tests and nine isolated database/outreach tests passed. A live content recheck produced three next questions; coverage candidates remain unverified and need source-backed research.
- Frontend bundle checked against configured secret values: no provider secrets found.
- Five Naïve agents provisioned, with capped budgets and explicit specialist versions. Live smoke test passed: all four version-3 specialists ended normally and the coordinator returned schema-valid output, identifying the synthetic $800 difference as unverified and requiring documents/human authorization.
- AgentPhone account, API key, hosted synthetic-demo agent and number configured. ElevenLabs account, restricted key, authenticated demo agent, recording-off setting and duration cap verified through its API. AgentMail free account, inbox, scoped API key and message-read access verified.

## Blocked or incomplete

- AgentPhone-only dispatch and authenticated readiness are verified. A newly authorized case-linked live call remains unverified. Historical ElevenLabs/Twilio receipts remain readable; no number purchase or SIP setup is required. See [voice setup](voice-agentphone.md).

- Neon AI Gateway has no enabled models because gateway credits are missing. E2E verifies the unavailable message, not successful inference.
- AgentPhone initially rejected the test with HTTP 402. The operator added $25, then the authorized retry completed (46 seconds; no recording URL), and the user confirmed receipt. SIP access request remains pending; ElevenLabs routing is not verified.
- ElevenLabs free-plan UI limits use to personal/non-commercial purposes. No paid commercial license selected.
- Crew runs are restricted by `CREW_ALLOWED_USER_IDS`, now containing the operator's exact account ID. The operator confirmed signup, and the signed-in Dia session matched the database account. The live API confirms crew access is enabled. The operator’s synthetic review completed and was saved by the scheduled worker. See [first operator access](hosting.md#first-operator-access).
- Case-linked outreach drafts, explicit authorization, dispatch records, and provider status reads are implemented. One explicitly authorized case-linked AgentMail email was sent and independently found in the operator’s Gmail inbox. Case-linked live calling remains unverified; approved-recipient lists are restored after testing. Scanned-PDF OCR, consent, evidence-backed outcomes, appeal submission and payments remain incomplete. Bounded autonomous email is deployed; the first send and reply-driven decision are verified, while live threaded follow-up remains unverified.
- Two-user isolation is verified for case listing, Realtime, crew routes, and deletion. Case analysis crash recovery and broader spend/rate controls need work.
- Four moderate development dependency findings remain in Drizzle Kit/esbuild; no forced breaking upgrade performed. Migration driver printed a future SSL-mode semantics warning; API uses verify-full.

## Next work

Implement automatic credential renewal and verify a complete synthetic insurer exchange with documented outcomes. Operator activation and post-approval continuation are now verified. Compatible setup credentials and case-specific isolation were already proven; temporary setup keys were revoked. The existing own-inbox grant must not be reset. Case-linked calling still needs an authorized test. Resolve gateway access before claiming inference works. GitHub auto-deployment is connected and verified; Neon remains an explicit deployment.

The team still needs a real interview participant. No customer savings or testimonial has been established. See [demo and research](demo-and-research.md).

## Selected product direction

The user selected an insurer-facing workplace chemical-burn workflow, from initial injury/insurance-card intake to supported claim resolution and final bill reconciliation. Product context and Naïve prompts now reflect that direction (coordinator version 17, intake version 7, other specialists version 6). The app now supports progressive injury/insurance intake, nullable financial amounts, and revision-aware case editing/reviews. Insurance-card/document upload and transcription are implemented. Initial official-source research is implemented; claim forms and broader jurisdiction/policy research remain incomplete. Bounded autonomous follow-up is implemented with live verification in progress. Prior infrastructure tests do not establish completion of this new end-to-end workflow. See insurance-workflows.md.

## Document intake update

Private case uploads now work end to end on Neon Object Storage. PNG/JPEG/WebP/PDF originals are saved with hashes, downloadable only by their case owner, and advance case revisions once. See [document workflow](documents.md) for retry and retention details. Image reading and PDF text-layer extraction now work through the deployed API. Their results require owner confirmation before inclusion in a revision-specific crew review. Both live extraction checks passed, including concurrent request reuse and exact expected fields; the full evidence-to-crew check also passed, with both document hashes referenced and financial amounts remaining null. Upload alone must not be described as agent review.

## Assurance branding

The app, browser title, README, and configured AgentPhone/ElevenLabs demo agent names now use Assurance. Provider IDs and prior receipts remain stable. ElevenLabs API readback confirmed authentication required, voice recording disabled, and the 180-second maximum after the rename. No new external call or email was sent.

Both voice agents now use the selected workplace chemical-burn scenario instead of beginning with the old bill-only example. Independent provider readbacks confirmed the exact prompts and greetings. The case-call prompt also separates workplace claims from health-insurance disputes. Spoken behavior after this update remains untested. AgentPhone's SIP dashboard still shows request-only access, and no approval email was found.

The live document review included an unsupported payer-priority statement and requested real replacement records despite demo mode. The request prompt now explicitly forbids these behaviors. A later source-backed review failed quotation validation and was corrected in the same session using GPT-5.4 mini. The corrected review passed exact-quote checks and kept payer priority and financial outcomes unresolved. Broader jurisdiction/policy research remains required. Do not present the saved synthetic review as verified coverage guidance.

## Official-source research update

California workplace reviews now retrieve DWC filing/overview guidance automatically; health-insurance reviews have a general HealthCare.gov appeal adapter. Sources are immutable per run, with text hashes and timestamps, and displayed findings require exact quotations and applicability limits. The live combined document/research test passed after one bounded correction; the first invalid result was rejected. The coordinator now uses GPT-5.4 mini, with unchanged approved caps; other specialists retain Qwen Flash. See [research](research.md) for scope and remaining limitations.

## Reply ingestion update

The app now reads the authorized AgentMail thread and stores matching received replies as untrusted reported information. Held replies are visible but excluded from reviews. Concurrent imports, evidence revocation, owner isolation, and original-content retention passed seven isolated database/provider tests. The real test reply arrived and was imported once through the deployed UI; reload, repeat sync, and cross-user denial passed. A correspondence-aware agent review passed, with an exact reference to the received reply and a persistent UI link. Its first result failed arithmetic validation; one correction in the same session passed. No follow-up email has been sent. See [reply handling](replies.md).

## Scheduled reply monitoring update

Owner controls, a separate scheduler Function, retry delays, and durable processing leases are implemented. Migration 0009 applied to production after five isolated scheduler tests passed. The worker and five-minute Neon trigger are deployed. The real 00:50 UTC delivery checked the authorized synthetic thread successfully, retained the existing reply without duplicating it, and persisted its invocation and success timestamp. UI status and pause/resume passed. Seven ingestion tests passed after network-unreachable failures on an earlier run. Nineteen pure regression tests, the app E2E suite, and the build pass. Anonymous/cross-user monitoring access and forged trigger calls are denied. The existing crew/document spending controls still return 403. See [monitoring](reply-monitoring.md).

## Hosted app

https://assurance.claims is deployed on the existing Vercel Hobby account; the previous Vercel hostname also serves the production app directly as a DNS fallback. Hosted signup, password sign-in, session reload, persistence, live updates, cross-user isolation, and sign-out passed. New users can create synthetic cases but cannot spend agent credits until explicitly configured. Only public service URLs are on Vercel; backend credentials remain on Neon. See [hosting](hosting.md).

## Scheduled review saving

The deployed `crewpoll` Function checks existing Naïve sessions every five minutes and saves valid completed reviews independently of browser refresh. A real scheduler delivery on an isolated branch retrieved an existing completed synthetic session and saved its validated result. Six isolated concurrency/recovery tests, fourteen validation regressions, the build, and hosted E2E passed. Production's trigger is enabled, forged scheduler requests return 401, and the operator still has crew access. The test branch was deleted. No additional inference, call, or email was initiated. The UI still requires refresh or reload to show a newly saved review. See [review monitoring](crew-monitoring.md).

## Autonomous workflow deployment

The standing-authority schema, case API, and scheduled worker are deployed. Eleven database runner tests, five policy tests, and the frontend build pass. Naïve prompts and current specialist references are published with unchanged caps. The deployed frontend created the approved own-inbox standing authorization. Naïve chose a customer information request, the scheduled worker sent it once, and Gmail confirmed delivery. The fictional reply was imported automatically by the scheduled worker at 02:00 UTC and accepted as case evidence. The reply triggered round two. It proposed redundant contact before the one-hour limit; the deployed server deferred it without sending. The third decision attempt ended without a valid complete result. The grant is now human_required with three decisions and one outbound email consumed; no follow-up email was sent. A later direct read of the same provider session returned HTTP 429 (service at capacity); it was not restarted. The native ElevenLabs/Twilio adapter is deployed but disabled pending account/number provisioning. See [autonomy.md](autonomy.md).

## Expanded autonomy foundation

The user supplied docs/autonomy-plan.md and assigned all files to this agent. Migrations 0013–0015 and the MCP tools Function are deployed. Case reads, sourced statements, public-source citations, email/call actions, follow-up scheduling, human-help, and stopping are implemented behind case credentials and existing standing authority. Completed-call transcript ingestion feeds case evidence. Live MCP checks prove citation retrieval/storage and the human-help transition, including retry handling and inactive-authority send rejection. No outbound message was sent by these new tool checks.

Naïve vault/session wiring still needs an admin-scoped key for the configured Managed Agents organization. A temporary key from dashboard.usenaive.ai was incompatible and was revoked. Native action permissions and open research are prepared locally, not published to the agent. Persistent per-case sessions, outcome accounting, test checkout, expanded intake, and a complete claim roleplay remain unfinished. Existing bounded grant limits remain unchanged. See agent-tools.md, research.md, and outreach.md for current behavior and tests.


## Persistent case sessions

Migration 0016 and the session/event worker are deployed. Eight session tests plus 21 existing regressions passed, as did the build and hosted E2E checks. Production has no registered persistent sessions. Events from replies, call evidence, claimant edits, uploads, and confirmed transcriptions can resume an existing identity-bound Naïve session after setup; native action tools retain authority checks. Live activation, the customer-facing session controls, and credential renewal remain unfinished. See [case sessions](case-sessions.md).


## Outcome recording

The deployed record_outcome tool stores agent-calculated amounts with exact case-evidence quotes and exposes them through case_get. Twelve tests, the build, and a live synthetic MCP write/retry/readback/isolation test passed. Outcomes remain agent-reported; verified goal completion, the customer outcome view, final communication, and checkout are unfinished. See [outcomes](outcomes.md).


The outcome API is owner-protected and deployed. The new outcome panel is implemented and locally browser-tested, but awaits Vercel authentication for production publication. It displays agent-reported amounts and evidence, not independently verified payouts.


The outcome and session-status frontend is now published at assurance.claims. Hosted checks passed; the temporary Vercel token was revoked. The separate Naïve activation task reports cross-session tool-result isolation failure, so shared MCP activation remains gated pending its investigation.

## Managed Agents setup unblocked and isolation verified

The side-chat setup task used Playwriter in Dia to sign into the correct existing Managed Agents company and provision temporary admin access. The prior incompatible-dashboard-key blocker is resolved. A shared-URL synthetic test exposed cross-session case contamination, so its credentials were revoked and sessions cancelled. Distinct case-specific MCP URLs with explicitly pinned versions passed live verification: correct own-case reads, cross-case denial, and one persisted fact per case. Three configuration tests and build passed. Temporary keys/vaults/credentials/fixtures were cleaned up; the default coordinator was restored to general-review version 21 without a case connector. Full per-user lifecycle activation and automatic provisioning remain unfinished. Naïve read_people approvals were needed during the test; existing runtime credentials, grants, and budgets remain unchanged. See agent-tools.md.


Synthetic scenario completion now has its own evidence-backed stop option, with a mandatory no-real-payout label. It passed live MCP verification without contacting anyone. This is demo completion, not the still-unimplemented verified real-outcome path. Payment remains hypothetical per the latest user instruction.

## AgentPhone-only pivot

The user explicitly selected direct AgentPhone only. Local dispatch now removes the ElevenLabs/Twilio new-call path; defaults and the private environment select AgentPhone, and other selectors disable calls. Historical receipts remain readable. Read-only provider check confirms a hosted agent and active number. Eleven focused voice/general-version tests and build pass. All six Functions deployed; Neon confirms completed deployment records. Authenticated app readiness readback remains unverified after test-session/signup failures; no new call authorized or placed. Twilio number purchase, ElevenLabs integration, and SIP access are no longer demo blockers for this voice path. See voice-agentphone.md.

### Persistent session live lifecycle

Operator provisioning and a same-session evidence wake now pass against live Naïve/Neon. A zero-contact, zero-outbound synthetic authority was provisioned; the same session consumed revision 2 after event delivery and ended its turn, spending $0.019098. Two explicit `read_people` confirmations were required. All test resources and the temporary setup key were cleaned up. Customer activation, automatic credential renewal, and unattended approval handling remain unfinished; this test does not establish autonomous real claim handling.

### Reduced Naïve load deployed

The SDK transport now uses production Postgres to admit one HTTP request at a time, space successes, and share capacity cooldowns across Functions. Idle persistent cases skip remote status reads until new evidence or a due timer. Naïve remains responsible for case coordination; no alternate model is introduced. Six transport/configuration tests, fifteen disposable-database regressions, and build passed. Migration 0018 and six Function deployments completed. A live read-only coordinator request returned 200 with the gate released and failures zero. No new sessions or external contacts were made. The user cancelled external escalation; no report was sent. Remote model concurrency and provider availability are not guaranteed by an HTTP gate. See [capacity operations](naive-capacity.md).

## Phone-first channel prepared, messaging activation pending

The phone account/inbound intake/portal-link/document-notification implementation is deployed behind PHONE_FLOW_ENABLED=false. It adds verified-number signup and existing-account linking while preserving managed email identity. Nine phone database integrations, thirty-five session/approval regressions, ten MCP/configuration tests, a mocked phone OTP browser flow, build, and post-fix hosted legacy E2E passed. An initial managed-auth adapter regression was caught by hosted verification and fixed before this pass. Migrations 0021–0022 and the phone Function are deployed; production rejects phone OTP while disabled. AgentPhone reports messaging registration required. The user selected individual/no-EIN, supplied contact details privately, and has a pending explicit $25 registration approval request. No registration fee, real SMS/call test, or inbound number-routing change has been performed. See phone-first.md for exact limits and remaining live verification.
