# Implementation status and next steps

Updated November 7, 2026. See [stack operations](stack.md) for account configuration and test details.

## Verified

- Neon CLI authentication and the requested production project setup completed. Postgres, Auth, Functions, Realtime, and AI Gateway credentials are provisioned.
- All thirteen Drizzle migrations (0000–0012) applied. The case Function is deployed with server-only Naïve configuration.
- `npm run build` passes, including TypeScript checks for backend, frontend, scripts, and provider configuration. Latest build: 266 modules, 550.58 kB JavaScript. The chunk-size warning remains.
- `npm start` serves the preview; use http://localhost:4173.
- `npm run test:e2e` passes signup/session validation, authenticated Function access, database create/persistence/delete, Realtime delivery, reload, and sign-out. It also verifies 401 for missing/invalid tokens, 400 for negative amounts, and 403 for unlisted users trying to spend crew credits.
- Live authorized app crew test passed: signup, case creation, duplicate-start deduplication, Naïve completion, saved Postgres review, and UI reload. Four focused tests reject intermediate/error/approval-pending output. Saved review records remain readable without another provider call.
- Injury-first live test passed: null financial amounts, saved crew review, progressive employer update, stale-edit conflict, and stale-outreach rejection. Ten validation/completion tests and nine isolated database/outreach tests passed. A live content recheck produced three next questions; coverage candidates remain unverified and need source-backed research.
- Frontend bundle checked against configured secret values: no provider secrets found.
- Five Naïve agents provisioned, with capped budgets and explicit specialist versions. Live smoke test passed: all four version-3 specialists ended normally and the coordinator returned schema-valid output, identifying the synthetic $800 difference as unverified and requiring documents/human authorization.
- AgentPhone account, API key, hosted synthetic-demo agent and number configured. ElevenLabs account, restricted key, authenticated demo agent, recording-off setting and duration cap verified through its API. AgentMail free account, inbox, scoped API key and message-read access verified.

## Blocked or incomplete

- User-selected AgentPhone replacement: deployed new-call code uses ElevenLabs native Twilio, with six transport tests and build passing. The dedicated outreach agent is provisioned. Twilio identity verification is approved and account/tax details were accepted. The refreshed console confirms Active status and $20.00 available; the previous payment wizard was stale. The operator declined the $1.15/month number purchase and instructed AgentPhone-only fallback if Twilio encounters another issue. Number purchase/import and a newly authorized live case-linked test remain pending. AgentPhone SIP is not required for this replacement. See [voice setup](voice-twilio.md).

- Neon AI Gateway has no enabled models because gateway credits are missing. E2E verifies the unavailable message, not successful inference.
- AgentPhone initially rejected the test with HTTP 402. The operator added $25, then the authorized retry completed (46 seconds; no recording URL), and the user confirmed receipt. SIP access request remains pending; ElevenLabs routing is not verified.
- ElevenLabs free-plan UI limits use to personal/non-commercial purposes. No paid commercial license selected.
- Crew runs are restricted by `CREW_ALLOWED_USER_IDS`, now containing the operator's exact account ID. The operator confirmed signup, and the signed-in Dia session matched the database account. The live API confirms crew access is enabled. The operator’s synthetic review completed and was saved by the scheduled worker. See [first operator access](hosting.md#first-operator-access).
- Case-linked outreach drafts, explicit authorization, dispatch records, and provider status reads are implemented. One explicitly authorized case-linked AgentMail email was sent and independently found in the operator’s Gmail inbox. Case-linked live calling remains unverified; approved-recipient lists are restored after testing. Scanned-PDF OCR, consent, evidence-backed outcomes, appeal submission and payments remain incomplete. Bounded autonomous email is deployed; the first send and reply-driven decision are verified, while live threaded follow-up remains unverified.
- Two-user isolation is verified for case listing, Realtime, crew routes, and deletion. Case analysis crash recovery and broader spend/rate controls need work.
- Four moderate development dependency findings remain in Drizzle Kit/esbuild; no forced breaking upgrade performed. Migration driver printed a future SSL-mode semantics warning; API uses verify-full.

## Next work

Obtain a compatible Naïve setup credential, verify two-case vault isolation, and activate the prepared persistent-session path with a newly scoped synthetic test. The existing own-inbox grant is human_required and must not be reset. Twilio is funded and identity-approved, but the user declined the number purchase. If another Twilio issue occurs, the requested fallback is direct AgentPhone without ElevenLabs. Case-linked calling still needs an authorized test. Resolve gateway access before claiming inference works. GitHub auto-deployment still needs a working Vercel account connection.

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
