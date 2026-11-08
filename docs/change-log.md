# Change log

## 2026-11-07 — Persistent case sessions and event queue

Added one durable Naïve session binding per standing authority, with pinned identity/version, the existing $0.25 budget, stable create/wake identifiers, scheduler leases, and provider backoff. Incoming evidence and claimant edits enqueue events within their database transactions. Follow-ups resume the same session; unresolved provider stops require review. Revocation cancels the session, and the legacy scheduler cannot start parallel inference for a bound authority. Case tools now expose confirmed document transcriptions. See case-sessions.md for the internal activation contract and remaining gaps.

Verification: all 29 sequential database/regression tests passed (eight session, eleven autonomy, three call-evidence, seven reply tests). Build passed with the existing bundle-size warning. Migration 0016 applied to production, and all six Neon Functions deployed. Hosted E2E passed authentication, persistence, Realtime, authorization, isolation, deletion, and sign-out checks; gateway inference remains unavailable because no model is enabled. A production read confirmed zero persistent-session registrations. No new model session, email, call, or budget increase was made. Live session activation still requires a compatible admin credential and verified remote identity/vault binding; mocked transport tests do not prove that integration.

## 2026-11-07 — Native case action tools

Added send_email, place_call, schedule_followup, request_human, and stop_case to the deployed MCP service. They reuse existing authority validation, typed decisions, send-once dispatch, email threading, and reply monitoring. Per-authority leases serialize tool retries with scheduled work. The scheduler recovers reserved native decisions without another inference request. Case reads expose authority/counters; bounded decision snapshots now include saved citations and statements. Existing grant limits and spending caps remain unchanged. The tools Function now receives server-only outreach credentials and allowlists.

Verification: nine protocol/configuration tests, five native-action database tests, and eleven existing autonomy tests pass; build passes. JSONB key ordering initially broke retry equality and was corrected through schema normalization. Six Functions deployed. A live temporary-case check proved tool discovery, human-help state change, idempotent retry, and inactive-authority send rejection with zero outbound records; its fixture was removed. The existing own-inbox test is human_required after three decisions and one email; a direct provider read returned capacity HTTP 429, and no new session or grant was created. Naïve MCP wiring remains blocked by setup-key scope.

## 2026-11-07 — Agent-directed public-source citations

Added `cite_source` to the deployed case MCP service, with per-case ownership, immutable source snapshots, exact short-quote checks, idempotent operations, and evidence references usable by recorded facts. Public HTTPS retrieval validates DNS and every redirect, pins the connection to a validated address, bounds downloads, and supports HTML/plain text/PDF text layers. Added ipaddr.js directly; its older transitive version remains nested for proxy-addr. Prepared Naïve web search/fetch and citation permissions without changing budgets or publishing the agent configuration.

Verification: 13 transport/configuration/source tests and two database tests pass; build passes. Live direct HTTPS retrieval and deployed MCP retrieval/storage/retry/reference verification passed against example.com, followed by fixture cleanup. Migration 0015 and all six Functions deployed. An initial `tsx -e` smoke command hit a CJS/ESM package-export error; rerunning through Node’s ESM loader passed. No model session, claim communication, or payment occurred. Naïve-driven research remains unverified until vault access is configured. See research.md and agent-tools.md.

## 2026-11-07 — Completed-call transcript ingestion

Added bounded AgentPhone/ElevenLabs transcript readers, immutable hash-addressed evidence snapshots, owner/case/receipt checks, and idempotent imports. New speech evidence advances the case revision once and wakes existing live authority without resetting limits or restoring stopped authority. Manual refresh and the existing five-minute scheduler collect completed transcripts; bounded decisions and MCP case reads receive them as untrusted reported speech. Migration 0014 adds the evidence table. The scheduler now receives its operator allowlist.

Verification: 15 parser/transport tests and 14 sequential database/autonomy tests pass; build passes with the existing bundle-size warning. An initial concurrent database-suite run failed because the scheduler consumed the other suite’s fixture; those fixtures were removed and sequential rerun passed. Production migration 0014 applied successfully and all six Neon Functions deployed. No live case calls exist to import, so provider transcript retrieval and user-visible transcript display remain unverified/unimplemented respectively. No call or message was sent by this work. Details and polling limits are in outreach.md.

## 2026-11-07 — Verify dashboard setup-key compatibility

Used the user-requested Dia dashboard to create a temporary setup key. The existing Managed Agents API rejected it with HTTP 401, so it was revoked and its private local file deleted. Confirmed REVOKED in the dashboard. No existing keys, app credentials, budgets, or agents changed. See agent-tools.md for the remaining organization/scope requirement.

## 2026-11-07 — Shared case MCP endpoint and Naïve connection preparation

Deployed a credential-scoped `/mcp` endpoint alongside the original case URL. Added identity/version-pinned session configuration, optional blueprint MCP tools, `NAIVE_CASE_TOOLS_URL`, and a resumable two-case live smoke script. The setup key is read from a private file and never replaces the runtime key on disk. Detailed operation and remaining work are in agent-tools.md.

Seven local tests and `npm run build` pass. Neon deployment completed for all six functions. Initial Hono route registration and SDK/blueprint typing errors were corrected before the successful build. Live Naïve verification stopped at vault creation: the existing key lacks admin scope. One temporary synthetic case and identity exist for resumption; no model session or outbound communication was started by this test. No spending caps changed.

## 2026-11-07 — Coordinator chooses specialist delegation

Removed the mandatory four-specialist fan-out from the local Naïve coordinator blueprint. The bounded case-decision prompt now permits direct decisions for routine follow-ups, waits, and stops, with targeted specialist review when useful. Requested results must still be reconciled before submission. User assigned sole ownership of the previously shared files to this agent; no teammate coordination is required.

Verification: `npm run build` passed (266 modules; existing bundle-size warning). Prompt changes are local, not published or deployed. No live inference, message, call, or budget change occurred. Naïve MCP session wiring remains unfinished; details are in agent-tools.md.

## Save agent reviews without an open browser

Extracted completion validation and first-valid-result persistence into `backend/crew-completion.ts`. Both manual status reads and the new scheduler validate against immutable run inputs, including earlier case revisions. Added `backend/crew-monitor.ts`, `backend/crew-worker.ts`, and migration 0010 for durable check times, leases, coarse status, and invocation IDs. The worker reads at most five existing sessions per delivery; it never starts inference or sends correspondence. Corrections re-enable checking, and concurrent correction requests retain their schedule. Failed/cancelled sessions, rejected completed output, and pending approvals need human attention.

Six database tests passed on disposable branch `crew-monitor-check`, including concurrent delivery, input revisions, first-result retention, invalid evidence, approvals, provider failures, delegation, lease recovery, correction races, and batch limits. Fourteen validation regressions and `npm run build` passed. A real 01:16 UTC scheduler delivery on that branch read one previously completed synthetic Naïve session and saved one valid result, with zero failures. The row's invocation ID matched the Function log. No new model run was started. Anonymous and forged scheduler requests returned 401.

Applied migration 0010 to production and deployed `crewpoll`, the shared case API change, and the five-minute `crew-monitor` trigger. The existing reply trigger remains enabled. Production rejects forged scheduler requests, hosted E2E passed after deployment, and the actual operator session still reports crew access enabled. Gateway inference remains blocked by credits. Deleted the temporary test branch and closed the verification browser tab without signing the operator out. Added crew-monitoring.md and updated the docs index, architecture, Neon operations, and implementation status. Production had no unfinished sessions at deployment; the live read-and-save check used the isolated copy.

## Voice agents aligned with the workplace demo

Updated `backend/providers/voice-config.ts` so the default hosted demo follows the fictional pharmaceutical-office chemical burn. Unknown employer, location, policy, claim, treatment, and money details remain unknown. The agents ask one question at a time, separate workers' compensation from personal health coverage, and do not claim a submission or outcome. The old bill/EOB example is optional and separate. Updated the case-call prompt to use the same insurer-facing boundaries.

Both configuration scripts now validate independently fetched saved prompts and greetings. ElevenLabs also checks authentication, recording-off, and the duration limit. Applied the updates to the existing provider agents without replacing their IDs or phone number. Both scripts exited 0 with `prompt_matches: true` and `greeting_matches: true`; AgentPhone remained hosted with messaging off, and ElevenLabs retained authentication, recording-off, and 180 seconds. `npm run build` passed with the existing chunk warning. Deployed the updated case-call prompt in cases Function deployment 31. No call, inference, email, subscription, or top-up was initiated.

Checked the AgentPhone SIP dashboard in Dia and searched the connected mailbox for approval. The dashboard still offers request-only access; the search returned no matching approval. Left the working native call route intact. ElevenLabs SIP routing and spoken behavior with the revised prompts remain unverified. Updated outreach and implementation documentation, and corrected the stale empty-operator-allowlist statement in stack.md.

## Operator access and provider readiness recheck

The initial Auth lookup found no account matching the operator's supplied email. The operator then created an account and confirmed it in chat. Its signed-in Dia session returned the same user ID as the database record. Added only that ID to the private `CREW_ALLOWED_USER_IDS`, preserving other environment values, and deployed cases Function revision 30. The live `/stack/status` response returned HTTP 200 with `naive.configured: true` and `naive.enabledForUser: true`. It initially served the preceding access state after the CLI reported completion, so verification continued until the live response reflected the change. Budgets and recipient restrictions are unchanged. Email verification remains false; ownership was established through the operator's confirmation and authenticated browser session, not by changing Auth records. Added the first-operator procedure to hosting.md and updated the implementation handoff.

Verification: `npm run build` exited 0 with 265 modules and the existing chunk-size warning. `npm run stack:check` reached Postgres, Auth signing keys, all five Naïve agents, ElevenLabs, AgentPhone, and AgentMail. It exited 1 because Neon AI Gateway still has no enabled models. AgentPhone's SIP-trunk endpoint returned HTTP 200 with an empty list; this establishes that no trunk is configured, not whether its support team approved the request. No inference, external call, or email was initiated. A new-account case review and ElevenLabs routing remain unverified.

After the new access state was live, `E2E_BASE_URL=https://assurance-claims.vercel.app npm run test:e2e` exited 0. Signup, protected Function access, live database updates, reload persistence, unlisted-user spending denial, cross-user isolation, deletion, sign-out, and password sign-in passed. Gateway inference remains explicitly blocked. The assistant's verification tab was closed without signing the operator out.

## 2026-11-07 — Shared context and documentation policy

Added `agents.md` with the product direction, hackathon constraints, integration decisions, privacy/evidence boundaries, and a mandatory rule to document every repository change in a Markdown-only `docs/` directory.

Added the documentation index, product brief, architecture/file map, Neon setup record, implementation-status handoff, demo/research guide, and this log. Documented uncertainty and separated proposed integrations, local unfinished code, deployed infrastructure, and verified command results.

Validation: checked Markdown links, confirmed all files under `docs/` are Markdown, reviewed staged changes for secrets, and ran `git diff --cached --check`. This commit contains documentation only; no application build or service test was rerun for it. Earlier build/deploy evidence and unresolved verification are in implementation-status.md.

Earlier setup also created local application/configuration/migration files, installed dependencies and agent tooling, and deployed Neon services. Those implementation files are not included in this documentation commit; see neon.md and implementation-status.md for the complete handoff.

## 2026-11-07 — Stack setup in progress

Installed the Naïve SDK, CLI, and blueprint package. Added capped five-agent crew config, SDK adapter, durable crew-request schema, protected crew routes, account connectivity check, and executable browser E2E script. Added the stack operations document. Created a scoped Naïve API key in the ignored environment and provisioned all five agents using the existing hackathon credits. No subscriptions, numbers, or top-ups purchased.

Verification: production build passed. Browser E2E passed auth sign-up/session, Function access, Postgres persistence, Realtime create/delete delivery, reload, and sign-out. Gateway inference remains blocked (no enabled models). Initial browser test failed because matching Chromium was absent; installed it and reran successfully. Initial Naïve coordinator creation failed due to the CLI's two-phase roster application; explicit handoff names resolved it. New crew endpoints/migration are not yet deployed or end-to-end verified.

### Account and wiring follow-up

Created AgentPhone, ElevenLabs, and AgentMail accounts through the operator's Dia browser using Playwriter. Provisioned and configured the synthetic voice demo number and ElevenLabs agent, created the mail inbox, and stored scoped keys locally. See stack.md for spending, permissions, credential rotation, and license details. Requested AgentPhone SIP enablement. The one user-authorized outbound test was refused with HTTP 402 before dialing; no top-up performed. Added provider configuration scripts, guarded test-call script, environment template, crew smoke script, and dashboard crew controls. Applied crew-run migration and redeployed the protected Function. Expanded TypeScript checking to scripts and the Naïve config. Production build still passes; bundle-size warning remains.

Corrected the Naïve coordinator's stale specialist-version pins after inspecting live delegated sessions. Kept all budget caps unchanged. Added a deletion guard for cases with crew-run records and extended the E2E checks to authentication, input validation, and operator spend restrictions. Checked the compiled frontend against configured secret values; no provider secret was found.

Refreshed README and implementation-status.md to remove stale handoff claims and describe reproducible run/test commands. Added `NAIVE_SPECIALIST_VERSION` so fresh installations can start at version 1 while this account pins the verified version 2 specialists. E2E rerun passed, including the new authentication/input/spend-restriction checks; AI unavailable state was confirmed, not mistaken for inference success.

Final browser check also passed two-user isolation: the second user cannot see the first user's case in REST or Realtime and receives 404 when trying to run its crew or delete it. Updated agents.md, architecture.md, and implementation-status.md to reflect the implementation rather than the earlier docs-only handoff. Preparing the implementation commit; environment files and generated test records remain ignored.

The crew smoke test exposed a missing `submit_output` call after successful delegation. Added explicit tool-submission instructions to the coordinator and session request; preserved strict output validation. The smoke command now returns distinct nonzero exits for failed or pending runs. Build passes after this correction; corrected live run verification follows.

Added an explicit funded-test retry path after the user authorized a retry to the same number. It only accepts a known HTTP 402 rejection, preserves that record, and never retries a successful/ambiguous call automatically. Opened the requested AgentPhone billing page in Dia for the user to fund themselves; no payment made by the assistant.

Naïve completed a full structured case-review run. Content review found unsupported deadlines/exposure/escalation claims, so strengthened all agent instructions and tightened the output schema to supplied-field evidence IDs and bounded summaries/actions. Updated the roster pin for specialist version 3 and extended smoke assertions. User added $25 to AgentPhone; verified $27 balance, then placed the single authorized retry (HTTP 200, ringing). Completion verification pending.

User confirmed the authorized phone test reached them. Provider readback confirms call `cmw7006zuahsurqhj8kjihh2x` completed, duration 46 seconds, no recording URL. Native AgentPhone outbound voice is now verified. ElevenLabs SIP routing remains pending enablement. Updated synthetic crew prompts and deployed stricter output schema; final content-check run started.

Checked the Neon $250 sponsor offer in the operator's Dia session. Claiming it requires a paid plan and billing information; left the existing free plan unchanged. Closed the temporary credit-check tabs and preserved the AgentPhone billing tab the user requested.

Final crew verification passed after allowing `wait_for_agents`: session `ses_nsvsww22q9pbsc4gygychc1rff` ended `idle/end_turn`, `output_valid: true`, with all four version-3 members ending normally. `npm run test:crew` exited 0 with `PASS Naive structured case review`. Output reports an unverified $800 variance and requires source documents/human authorization; it is not a verified saving. `npm run build` passed (262 modules; existing chunk-size warning). `npm run stack:check` connects to Postgres, Auth, Naïve, ElevenLabs, AgentPhone, and scoped AgentMail messages, but exits 1 because Neon AI Gateway has no enabled model. App-level authorized crew execution remains unverified because the operator allowlist is empty.

## Durable crew results and application verification

Added immutable completed-review snapshots and completion timestamps to crew runs. Saved reviews remain readable without Naïve availability. Intermediate submissions, invalid output, errors, and pending approvals cannot appear as finished case plans. Added missing-document display and saved-state controls; corrected the stale voice status description. Migration succeeded on a temporary production branch and then production. Four completion-gate tests passed; live authorized application verification subsequently passed. The first test setup attempt found that Vite derives public URLs rather than storing them in the environment; corrected the script to capture the API origin from actual app requests.

Live application test passed duplicate-start idempotency, valid provider completion, saved database snapshot, UI reload, and stable rereads. The full Auth/Postgres/Function/Realtime and isolation regression test also passed; Gateway inference remains blocked. Neon reported deployment completion before the new Function served traffic; verification used the actual API response, then reused the same case. Removed the temporary migration-test branch after successful migration testing. Restored the temporary test operator allowlist to its previous value. Live verification confirms POST now returns 403 while the existing saved review remains readable.

## Case outreach implementation

Added immutable outreach drafts, explicit per-action authorization, atomic dispatch claims, and provider status reads. AgentPhone uses the saved discussion plan with synthetic-only instructions and recording disabled; AgentMail uses the draft UUID as its send idempotency key. Unknown outcomes cannot retry automatically. Added owner/operator/recipient checks, retained action history, case UI controls, server-only provider environment entries, migration 0003, and isolated database tests with fake provider transports. See outreach.md for the state machine, API, and limitations. Verification and deployment are in progress; no new real call or email has been sent.

Verification: migration 0003 succeeded on a temporary production branch and then production; the temporary branch was removed. Eight isolated Postgres/provider-transport tests passed. The deployed app passed draft creation through its form, immutable replay/conflict handling, operator denial, saved draft reload, and cross-user denial on all outreach routes. Fixed an accessible-label issue exposed by the form test. Build passes (263 modules, 529.69 kB JS; existing size warning). The new read adapter retrieved the previously authorized call as completed/46 seconds without placing another call. AgentPhone SIP list returns zero trunks; ElevenLabs routing remains unverified. A concrete synthetic email draft was prepared for the operator to review; no new call or email has been sent.

## 2026-11-07 — Help-request board

Added `NEED_HELP.txt` at the repo root. It's a request board for Yuvraj's Claude Code session: it lists the open items from implementation-status.md that it can take, and explains how teammates and their agents post requests and get status back by pulling the file. It's kept outside `docs/` because that directory is Markdown-only. Documentation only, so no build or tests were run.

The operator explicitly approved the saved synthetic email. Temporarily allowed that test operator and exact recipient, then sent the immutable draft through the case authorization endpoint once. AgentMail returned acceptance and the receipt was saved in Postgres. A read-only Gmail search independently confirmed the exact message in the intended inbox. Restored the original operator/recipient configuration and redeployed; final revocation/status checks are recorded below. No second email or new call was authorized. Merged the teammate's request-board commit, preserving both change-log entries after an append-only conflict.

## Insurer-first direction

The user changed the product's primary counterpart from hospital billing to insurers/claims administrators, naming workplace injury claims and health-insurance disputes. Updated agents.md, product.md, and insurance-workflows.md to preserve that direction, distinguish the two intake paths, and keep the injured person as beneficiary. Retargeted the local Naïve prompts to claim triage, insurer reasoning, insurer correspondence, and separately verified claim outcomes. Existing bill/EOB UI and synthetic infrastructure tests are not presented as a completed injury-claim or appeal product.

The authorized email's saved receipt refreshed through the deployed API as `sent`, and Gmail independently confirmed inbox arrival. After deployment propagation, a fresh verification confirmed the temporary operator was disabled, repeat authorization returned 403, and sent status remained visible after reload. No second message was sent. Restored recipient configuration as well. The earlier revocation check briefly reached an older Function instance and returned the existing submitted action; the atomic dispatch guard prevented another send.

The user selected a chemical burn at a pharmaceutical workplace as the anchor scenario and clarified the desired end-to-end scope: coverage/benefit research, claims, insurer exchanges, supported disputes, and final bill reconciliation. Updated the shared product documents and applied all five insurer-facing Naïve prompts with specialist roster version 4, keeping existing budgets. Build passes. This configuration update is not proof that document intake, claim submissions, or the full injury-to-resolution workflow is implemented.

## Injury-first intake and case revisions

Added progressive workplace-injury intake and a health-insurance dispute path. Contact/injury information can start a case without a bill. Added optional employer, insurer, jurisdiction, claim-stage/reference, and desired-outcome fields, preserving unknown amounts as null. Added optimistic case revisions, immutable crew requests per revision, stale-draft dispatch prevention, and stale-analysis protection. Added coverage candidates to the crew result and rejected computed discrepancies inconsistent with supplied amounts. Updated the case UI and billing regression tests for the new intake selector. Local validation/completion tests passed; branch migration and deployed workflow verification are in progress.

Migration 0004 passed on a temporary branch and production, and the branch was removed. Ten pure validation/completion checks and nine isolated Postgres/outreach tests passed. The deployed chemical-burn test passed creation without amounts, a saved crew plan, progressive employer update, 409 on a stale edit, no reuse of the earlier review, and rejection of stale outreach. Database inspection confirmed the revision-1 review remains saved while the case is revision 2. Billing/Auth/Realtime and cross-user edit regression tests passed. Content review found a 25-field intake demand and incorrect claims that the platform lacked email; strengthened all five agent prompts (specialist version 5) and added up to three explicit next questions. A bounded live content recheck is in progress.

The version-5 content recheck passed: three next questions, no fabricated zero discrepancy, and no incorrect claim that the app lacks email. Its coverage descriptions remain unverified hypotheses, not researched eligibility or legal conclusions. Source-grounded coverage research is still needed. The latest build passes (264 modules, 536.18 kB JS; existing chunk warning). A fresh deployed check confirmed temporary operator access was revoked and an attempted start returned 403. Updated README and architecture/status documents to reflect injury-first intake and its remaining limits.

## Private document intake (November 7)

Provisioned a private Neon `case-documents` bucket and installed Files SDK with its AWS peer dependencies. Added a document table, authenticated upload/list/download routes, immutable hash-based retry checks, revision advancement, and a case document form. A separate Naïve file-scoped key was saved privately for the upcoming image-reading integration; the existing runtime key was preserved. Applied intake `view_image` access and per-agent version overrides without changing approved budgets. No new calls or emails were sent.

The first build caught a TypeScript union inference issue in the Naïve tool configuration; an explicit record type fixed it. `npm run build` now passes (265 modules, 539.00 kB main bundle). The existing bundle-size warning remains. Migration 0005 passed on temporary branch `document-storage-check`, then production; the temporary branch was deleted. Deployed the Function and passed the live document smoke: UI upload, exact byte round-trip, SHA-256, anonymous bucket rejection, invalid-format rejection, concurrent retries, revision increment once, persistence, retained-case deletion guard, and second-user list/upload/download isolation. The existing E2E suite also passed Auth, Postgres, Function, Realtime, ownership, and sign-out checks; AI Gateway inference remains blocked by credits. Automated reading is not yet integrated into case documents.

The live Naïve card-reader smoke passed: intake returned the synthetic insurer, member name, member ID, and group exactly from an uploaded PNG. Those values were not in the session prompt. This verifies standalone transcription only, not automatic extraction from the app or policy eligibility. The existing $0.25 task cap and $2 monthly intake cap were preserved.

## Document reading integration (November 7)

Added durable extraction records and owner-scoped read/refresh/confirm endpoints. Image results require proof of a successful `view_image` call on the exact file; PDFs use bounded text-layer extraction. Added a transcription review UI, idempotent confirmation, and immutable source references in crew input/output. Case snapshots now use a shared case lock to avoid mixing evidence across revisions. Installed `unpdf` and supplied file-reader credentials to the server Function configuration. Migration 0006 passed on an isolated branch; eight targeted reader/result tests passed. Migration 0006 was applied to production and the isolated branch deleted. The live app test passed image and PDF extraction, exact expected fields, concurrent start reuse, stable session IDs, confirmation advancing the revision once, persisted UI confirmation, and a completed crew review referencing both original document hashes with null financial amounts. Second-user extraction/refresh/confirmation access was rejected. The existing E2E suite passed; Gateway inference remains blocked. Fifteen focused tests passed. The frontend bundle contains none of ten configured server secrets.

## Product name: Assurance

Renamed the app header, brand initial, footer, browser title, and README to Assurance. Recorded the naming decision in `agents.md` and product documentation. Existing provider/resource identifiers and historical test receipts retain their original names to preserve references. AgentPhone and ElevenLabs names/greetings were updated in place and verified as Assurance Demo, without placing a call or sending an email.

The live crew recovered a malformed delegation in the same session and completed normally. Its output contained an unsupported payer-priority assertion and asked for real replacement records. The request prompt now explicitly restricts questions to synthetic fields and forbids coverage-law assertions without verified sources; this prompt correction awaits a new live content check. The original output remains an immutable historical test result. The original operator allowlist was restored after testing.

Final readback verified the Assurance page title, persisted review links to the source documents, and HTTP 403 for both crew and document-reader starts after the operator allowlist was restored. Two earlier readbacks during deployment returned 200 for an existing crew request; fresh requests later returned 403. Treat environment-based revocation as deployment-dependent, not instantaneous. No new session was created by those existing-run requests. The final build passed at 541.24 kB (265 modules); the existing size warning remains.

## Official-source research (November 7)

Added automatic official-page retrieval before a new crew review, immutable source snapshots in the existing run record, structured findings with exact quote validation, and source/applicability links in the UI. Installed Cheerio for content extraction. California DWC and HealthCare.gov retrievals succeeded locally; unsupported jurisdictions remain explicit gaps. Build passes. Live app verification subsequently passed after the bounded correction described below.

The live deployed request retrieved both official sources and captured both confirmed documents; a repeated start returned the same session and byte-identical saved input. All four specialist delegations succeeded without the prior malformed-argument error. The initial result was later rejected, then corrected as described below. Read-only AgentMail thread inspection returned HTTP 200 with one sent message and zero received replies; no additional message was sent.

The first research session ended with invalid quotations and too much quoted text; deterministic validation rejected it, so the live review test failed rather than publishing it. Added exact sentence candidates, one finding per source, and a single durable correction request in the same session. Changed only the coordinator model to GPT-5.4 mini, retaining approved caps. Migration 0007 passed on an isolated branch and production. The UI-triggered correction passed in the original session. Repeated correction requests retained the same session and correction timestamp. Both source quotations matched the saved text; document hashes remained exact, financial discrepancy stayed null, and follow-up requests stayed synthetic. The UI persisted official links, applicability limits, and the saved review. The harness initially assumed the optional `next_questions` field was always present; it now checks the app’s existing `next_actions` fallback too.

Nineteen focused tests passed. The existing E2E suite also passed, including new 403/404 checks on review correction. Migration 0007’s temporary branch was deleted. The build passed at 542.84 kB (265 modules), with the existing chunk-size warning. Gateway inference remains blocked by credits. The original operator allowlist was restored after correction testing; final readback passed with HTTP 403 for crew starts, correction requests, and document reading, while the saved source-linked review remained visible.

## Case-linked replies (November 7)

Added an AgentMail thread reader and durable reply records, with sender/domain/reference checks, held messages, immutable original content, duplicate protection, and case revision advancement. Accepted correspondence is captured in new crew requests and requires exact reply references in the result. Communication history now remains visible after case revisions change. Added reply sync and listing endpoints and a plain-text history UI. No new email or call was sent. Migration 0008 passed on an isolated branch and production, and all six ingestion/database tests passed. The live app read the existing authorized AgentMail thread. After the user replied, one real inbound reply was imported, duplicate sync did not duplicate evidence, and missing-auth/cross-user read and sync were denied. The original E2E suite passed. The live correspondence-aware crew review subsequently passed after the correction below.

The live reply review cited the actual received message correctly but returned null for the known bill/EOB arithmetic difference. Existing completion validation rejected it. New requests now state the server-computed potential difference explicitly, and the bounded correction prompt receives the same expected value. This remains a potential discrepancy, not verified savings or liability. The single correction in the existing session passed: exact reply reference, correct potential difference, saved review, and persistent UI link. The summary treats the reply as an acknowledgment and makes no payment or coverage claim. Nineteen focused regression tests and the production build passed (265 modules, 544.97 kB JavaScript; existing size warning).

A final code check found that a content change on an already-held message needed a permanent content-conflict reason too. Fixed that path and added a regression test so restored original text cannot silently release it. Temporary operator access was restored to its original configuration after the review test.

The final deployment attempt encountered a Neon API connectivity error; the next retry encountered the same issue, then the third attempt applied both Functions successfully and pulled the expected 15 Neon variables. The first additional isolated test run stalled after a database connection failure and was stopped. The test pool now has explicit connection/query timeouts; its bounded rerun passed all seven tests. The additional test branch was deleted. Live inbound/review verification above completed before these connectivity issues.

Post-deployment readback still reported the operator enabled. Applied a targeted Function deployment with an explicit deletion of `CREW_ALLOWED_USER_IDS`; deployment 27 completed. Unmentioned provider settings were preserved. Neon reports deployment 27 active, the operator variable absent, and provider variables preserved. The first browser readback after that deployment hit an authentication availability timeout; the final retry confirmed HTTP 403 for crew starts, review corrections, and document-reader starts.

## Scheduled reply monitoring (November 7)

Added owner-controlled 30-day monitoring, a dedicated Neon trigger worker, durable processing leases, bounded batches, retry delays, and visible timestamps/status. The worker only reads authorized threads; it has no model or telephony credentials and never sends email. Build passes at 546.51 kB (existing chunk warning). Migration 0009 passed on an isolated branch and production. Five isolated scheduler tests passed. The initial combined test command timed out during database operations; a sequential scheduler rerun passed, and the reply-ingestion rerun encountered EHOSTUNREACH/ENETUNREACH database failures. Nineteen pure regression tests passed. The first production deployment failed to reach the Neon API; a retry and live verification are in progress.

Deployment retry succeeded and created the five-minute trigger. The UI enabled monitoring on the existing authorized synthetic thread. Anonymous/cross-user access and a forged scheduler header were rejected. All seven reply-ingestion tests passed on retry; the app E2E suite passed (Gateway inference still unavailable). The isolated branch was deleted. Communication history now refreshes when Realtime delivers a changed case revision. The real 00:50 UTC scheduler delivery passed: one thread checked, zero duplicate imports, zero changes, and zero failures. The UI showed the stored success timestamp and invocation; pause/resume passed. Monitoring remains enabled for this synthetic test thread for 30 days. No new email was sent or received during this scheduled check; fresh-reply ingestion is covered by the earlier live import and database tests.

Final checks: build passed at 546.51 kB; 19 pure regression, seven reply-ingestion, and five scheduler tests passed. App E2E passed with Gateway inference still unavailable. Crew starts, corrections, and document-reader starts still return 403 for the restored operator configuration. No configured secret appeared in staged changes or the frontend bundle.

## Hosted frontend (November 7)

Signed into the existing Vercel Hobby account using the authorized Google identity. Optional model-training consent remained off. The CLI device page had disabled controls; its pending login was stopped, and setup continued through the dashboard. Added explicit public build variables, Vercel build settings, and ignored CLI metadata. Hosting deployment and origin verification are pending.

The dashboard import failed because Vercel could not access the GitHub repository through its existing connection. Created and linked `assurance-claims` with a one-hour team token after operator verification. The upload dry run exposed that Git exclusions were not sufficient; added `.vercelignore` before any upload. A second dry run found no excluded files or configured credentials among 102 source files. The frontend also passed an isolated build with only three public URLs and no server env file. Direct deployment is in progress.

Vercel deployment completed successfully and assigned `assurance-claims.vercel.app`. The exact domain was added to Neon Auth; the API/Realtime configuration preserves both existing localhost origins and adds that production origin. The E2E suite now accepts a hosted base URL and explicitly verifies password sign-in after sign-out. Backend deployment and hosted tests are running.

Hosted E2E passed against https://assurance-claims.vercel.app: signup, session reload, Postgres writes, Realtime updates, ownership isolation, denial of unapproved model spending, deletion, password sign-in, and sign-out. Gateway inference still correctly reports unavailable. The three public URLs are saved in Vercel Production configuration. The one-hour deployment token was revoked after verification. No provider secret or private test artifact was uploaded.

## SIP access diagnosis — November 7, 2026

Rechecked the configured AgentPhone account at the user’s request. Listing trunks returned HTTP 200 with none configured; creating the Assurance ElevenLabs trunk returned HTTP 403 explicitly requiring account SIP enablement (request ID recorded in sip-access.md). No trunk, route change, or call resulted. Added the provider unblock and post-approval integration steps to docs/sip-access.md and the documentation index. The dashboard browser was signed out; existing request status was not reverified there. SIP remains blocked by provider approval.

## AgentPhone replacement — November 7, 2026

At the user’s request, prepared ElevenLabs native Twilio calling. New dispatch checks the dedicated agent’s prompt/auth/privacy/duration settings, passes the reviewed plan, disables Twilio recording, and requires conversation/Call SID receipts. Historical AgentPhone reads remain available. Added an idempotent setup script, server-only configuration, provider-accurate UI confirmation, readiness check, updated provider fixture, and voice-twilio.md. Six transport tests and build passed; existing bundle warning remains. Twilio signup/number setup, deployment, live calls, and the isolated database suite remain unverified. No external call, purchase, or account signup performed.


## 2026-11-07: Durable autonomy implementation and mode separation

Added standing case authorizations, immutable Naïve decision rounds, a scheduled execution worker, owner-scoped API routes, and frontend authorization/history/stop controls. The first authorized live scope remains two synthetic emails to the operator inbox, three decision rounds, one hour between contacts, and a 24-hour expiry. No grant was activated and no autonomous email was sent. Existing five-agent spending caps remain unchanged.

Updated the local Naïve prompt to distinguish review-only work from actions under standing authority. Corrected `agents.md` to record the user's explicit authorization to replace AgentPhone with ElevenLabs/Twilio. Preserved the parallel voice adapter work. All nine database runner tests and five policy tests passed (14 total, zero failures), including durable waiting and evidence-triggered wakeup with contact spacing enforced. The build passes with the existing bundle-size warning. The Naïve dry run succeeded and proposed updates to the same five agents; the prompt changes have not been published. See `autonomy.md` for current deployment limits.


## 2026-11-07: Publish autonomy backend and crew instructions

Applied the tested 0011 migration to production and deployed the case API and new `autopoll` Function. The `case-autonomy` trigger is enabled on a five-minute schedule. An unsigned worker request returned 401. No standing grants were created, so deployment does not initiate outreach. Configured the email allowlist with only the operator's approved setup inbox.

Published the five revised Naïve prompts, then corrected the coordinator's specialist references. Provider inspection confirmed coordinator version 17, intake version 7, and the other three specialists at version 6. Every agent retains its $2 monthly and $0.25 task caps. Updated only the corresponding private version variables and email allowlist in `.env.local`, preserving other values and file permissions. The frontend stop control and authorized live email test remain pending. The deployed native ElevenLabs/Twilio transport remains disabled until its agent and number are provisioned.


## 2026-11-07: Deploy frontend controls and begin the authorized test

Deployed the autonomy frontend to Vercel production after the user completed email verification. Inspected the upload manifest to exclude secrets and private artifacts. Extended `scripts/e2e.ts` to verify autonomy-history ownership and deny unauthorized grants and cross-user revocation; hosted E2E passed. Gateway inference remains unavailable because there is no enabled model.

Verified the operator's signed-in form and activated the previously approved own-inbox synthetic authorization, bounded to two emails, three decisions, one hour between contacts, and 24 hours. The stop control is visible; provider execution remains to be verified. Prepared the requested `assurance.claims` one-year Porkbun cart at $10.81 with no paid add-ons. Registration and DNS are pending Porkbun sign-in and human verification.


## 2026-11-07: Register and connect assurance.claims

Porkbun confirmed the user's one-year domain purchase at the displayed $10.81 price. Auto-renew is disabled; expiry is 2027-11-08. No hosting or email add-on was selected. Replaced the new domain's parking records with Vercel's displayed apex A and www CNAME records. Connected the apex to Production and configured a permanent www-to-apex redirect. Added the exact apex HTTPS origin to Neon Auth, Function CORS, and Realtime; preserved existing origins and deployed the configuration. The build passes. Public DNS propagation and HTTPS/E2E verification are still pending. See `hosting.md` for exact records and limitations.


## 2026-11-07: Verify live Naïve action selection and domain DNS

Observed the scheduled worker start the first authorized decision session without errors. Naïve completed with a customer-contact decision requesting three missing fictional facts, at reported consumption of 9,957 micro-USD. Kept the same session after a transient HTTP 429. Dispatch remains pending the next worker check. Verified both configured records directly at Porkbun's authoritative server; the registry delegation still returns NXDOMAIN. No DNS records were changed during this diagnosis.


## 2026-11-07: Verify customer-requested stop

Added an isolated database test that sends one mocked email, imports an accepted customer stop reply, and verifies the scheduler stops without another model round or contact. All ten runner tests passed. Updated test cleanup to remove the fixture correspondence and reconciled stale activation wording in `autonomy.md`. No production case or communication was changed by this test.


## 2026-11-07: Verify custom-domain app and autonomous delivery

The registry delegation appeared, Google and Cloudflare DNS resolved the apex, and Vercel issued TLS. HTTPS returned 200. Full browser E2E passed on the custom hostname using the public IP to bypass stale local negative DNS caching, with TLS verification intact. Verified www-to-apex HTTP 308 and configured the old Vercel hostname redirect.

The autonomous worker sent Naïve's selected customer email once at 01:55 UTC. Confirmed the provider receipt and independently found “Synthetic Assurance Demo: Missing Claim Intake Details” in the operator's Gmail inbox. The authority now waits with one of two outbound messages used. Requested a fictional reply to verify the next decision. No insurer was contacted and no payout or savings were claimed.


## 2026-11-07: Normalize customer addresses for stop requests

The live reply path stores RFC-style display-name senders. Corrected `backend/autonomy-runner.ts` to compare parsed mailbox addresses when detecting a customer stop request. Updated the regression fixture to include a display name. Confirmed the live fictional reply is available from AgentMail and passes existing sender-domain and reply-reference checks; no manual reply import or second message was performed.

The display-name stop fix passed all ten runner tests and the build, then deployed successfully. Reconciled current status in `agents.md`, `implementation-status.md`, `stack.md`, and `hosting.md` so they reflect the custom-domain deployment and delivered autonomous test rather than the earlier pending setup.

The production reply monitor automatically imported the fictional response at 2026-11-08 02:00:00.915 UTC, invocation `a5YGSHdoHB0Lj9eyPVfPBWzDQFHd5AqQH6md6yIllrQ`. Database inspection confirms accepted correspondence and one outbound message used. Naïve continuation awaits its next scheduled check; the existing minimum contact interval remains enforced.


## 2026-11-07: Provision the dedicated ElevenLabs outreach agent

Added `--agent-only` to the native Twilio setup script so the voice agent can be prepared before Twilio funding/number setup. The flag validates only the ElevenLabs credential, creates or reuses the dedicated agent, verifies saved settings, and exits before phone-number operations. Ran it successfully and saved the agent ID privately in the existing env file. No subscription, number purchase, number routing, or call occurred. The build passes. Twilio's number remains required before new calls can be enabled.


## 2026-11-07: Preserve email threads for autonomous follow-ups

Added immutable reply context to outreach records and migration 0012. The runner chooses an existing successful message only within the same case and approved recipient. The AgentMail adapter now supports its reply endpoint with explicit recipient controls and expected-thread validation. New tests exercise recipient preservation, malformed context, wrong-thread receipts, and a second authorized contact reusing the first thread. Verification is underway on the disposable database branch; production is unchanged by this work so far.

The isolated migration and all 27 combined autonomy/outreach/ElevenLabs tests passed with zero failures. The build passes with the existing bundle-size warning. Applied migration 0012 to production after these checks; backend deployment succeeded. Live threaded delivery remains unverified, and no extra email was sent as part of testing.

The 02:05 UTC scheduler check started decision round 2 automatically from the imported reply. The case still has one outbound message used. The second decision result remains pending.

## Reply-driven contact timing correction

The live fictional reply reached the case through the scheduled importer and triggered Naïve round two. Its proposed redundant, premature follow-up exposed a timing-context gap. Decision inputs now include current and earliest-contact timestamps, and instructions preserve an explicit pre-claim answer. The runner defers a premature contact for a fresh decision without sending, replaying the old message, or resetting limits. The spacing regression checks waiting state and next wake time. All 11 runner regression tests passed (zero failures), `npm run build` passed with the existing bundle-size warning, and `neon deploy --env .env.local --branch production --no-env-pull` successfully updated the five functions. The 02:10 UTC scheduled production check verified the fix: round two finished with `CONTACT_TOO_SOON`, the grant is waiting until 02:55:02.772 UTC, two decisions remain consumed, and outbound usage stays at one. No second email was sent.

## Current readiness handoff reconciliation

Rechecked providers after the live reply test. Postgres, Auth signing keys, five Naïve agents, ElevenLabs agent access, and AgentMail message access passed. The diagnostic exited 1 because the gateway has no enabled models and the ElevenLabs phone-number ID is absent. The live Twilio upgrade page remains on account/tax details; the operator has been asked to complete those fields directly. Corrected stale implementation-status and agent handoff text for migrations 0000–0012, deployed voice code, current agent versions, the custom domain, and reply-driven autonomy. No funding, call, email, or account-detail changes were made in this check.

## Twilio upgrade blocker diagnosed

The operator reported filled details failing to submit. Inspected one UI retry: Trust Hub returned an unapproved primary compliance profile error. Opened the Individual Profile identity-verification flow and handed the Persona biometric-consent step to the operator. No address or identity-document contents are retained in the repository, and no payment or call was made.

## Twilio identity approved and payment prepared

Verified the operator-completed Individual compliance profile is Approved. Submitted the supplied account/tax details and reached Payment with a displayed $20 total and auto-recharge disabled. Asked the operator to complete the new charge directly; no payment, number purchase, or call occurred. Separately verified Neon Free has zero gateway credits and its $250 offer requires a paid-plan change; left the plan unchanged. Updated voice setup, readiness, and stack documentation without retaining address or payment details.

## Existing Twilio funding reconciled

Confirmed the operator’s $20 funding receipt against the refreshed console: account Active, available balance $20.00. Left the stale upgrade flow without another payment. Prepared a local incoming/outgoing voice number costing $1.15 immediately and monthly thereafter, plus usage; requested approval for that recurring rental before purchase. Corrected the readiness documentation.

## Voice preference updated

The operator declined the Twilio number rental and directed that the next Twilio issue should trigger a switch to AgentPhone without ElevenLabs. Recorded this in agents.md and voice/readiness docs, superseding the earlier avoid-AgentPhone direction. No number purchase, provider switch, call, or deployment occurred. AgentPhone direct-call readiness must be checked before use; ambiguous calls must not be retried on another provider.

## AgentPhone fallback prepared

Added explicit OUTREACH_VOICE_PROVIDER selection, defaulting to existing ElevenLabs routing. AgentPhone mode restores direct calls without ElevenLabs or SIP; no automatic retry or cross-provider fallback occurs. Added provider-aware setup checks, neutral call-confirmation wording, scheduler/API env declarations, and five AgentPhone regressions. All 11 voice transport tests and the build passed. No deployment, live provider switch, purchase, or call occurred.

## AgentPhone fallback account verified

Verified the existing hosted agent and active number by authenticated readback, and $26.83 balance in refreshed billing. Upgraded the fallback diagnostic from credential-presence checking to hosted-agent/active-number verification. Build passed. Full diagnostics also exposed a Naïve rate limit and the existing disabled gateway models, so the overall check correctly exited 1. No call, purchase, deployment, or live routing switch occurred.

## Fallback backend deployment

Deployed the tested provider selector and AgentPhone transport to Neon production. Verified pre-deploy selection remains ElevenLabs and its number ID is absent, so new calling stays disabled. All five functions updated successfully; unsigned worker and unauthenticated case-status requests returned 401 after deployment. No routing switch, purchase, call, or env pull occurred. Provider-neutral frontend confirmation is committed but not yet deployed; update it before activating AgentPhone to avoid misleading consent wording.

## assurance.claims reachability fixed on operator Mac

Diagnosed cached NXDOMAIN in the local Tailscale resolver while multiple public resolvers and Vercel HTTPS were healthy. Applied the explicitly approved domain-only macOS resolver file using Cloudflare DNS and flushed local caches. Dia now loads Assurance. The complete hosted E2E passed through normal DNS; gateway inference remains blocked by model access. No hosting deployment or public DNS changes were needed.

## Direct public fallback restored

After another computer reported NXDOMAIN, removed the old Vercel hostname’s redirect and connected it directly to Production. Verified HTTPS 200 and Vercel valid configuration. No app code or credentials changed. assurance.claims remains configured and publicly resolvable on checked resolvers; the affected computer may need DNS cache expiry or a working resolver.

## Frontend deployed and expanded autonomy proposal received

Deployed the provider-neutral call confirmation to Vercel production and passed hosted E2E. Revoked both temporary deployment tokens. Saved the user’s full autonomy proposal and linked it from the documentation index. The user explicitly superseded its shared-file coordination requirement: this agent owns all implementation. Existing standing email-test limits remain intact while the expanded architecture is built. No budget increase, call, or Twilio purchase occurred.

## Case tool foundation

Added a separate Streamable HTTP MCP Function, case-scoped hash-only expiring credentials, owner/operator issuance and revocation routes, case_get, and idempotent sourced-statement recording. Migration 0013 passed on the disposable branch. Four protocol tests, two database tests, and build passed. Sending, calling, persistent sessions, research tools, outcomes, and checkout remain next work; this foundation does not expand the existing own-inbox test authorization.

The case-tool foundation was migrated and deployed to production. Live MCP initialization/discovery, own-case read, idempotent statement write, missing/revoked credential denial, and cross-case denial passed. Temporary synthetic fixtures were cleaned up. Naïve tool execution and external actions are not yet part of this verification.
