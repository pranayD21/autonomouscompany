# Change log

## 2026-11-08 — Remove landing FAQ section

Removed the "Questions" (FAQ) section from `src/Landing.tsx` and its `.questions` styles from `src/landing.css`, as the user requested. The page now goes from the "How it works" steps to the footer. See frontend.md.

Verification: `tsc --noEmit` passed. The full `npm run build` needs the `VITE_*` service URLs and was not run. The page was not visually checked in a browser.

## 2026-11-08 — New logo and settling hero wordmark

Replaced the asterisk mark with the new two-stroke "A" logo (blue, rounded corners) across the app, README icon and a new favicon. The hero animation now finishes by dropping the handwritten "as" onto the same line as "surance" (dipping slightly below its bottom so the script reads as part of the word), while the struck "in" slides behind the heading below and fades out. The heading and call to action sit lower to give the dropped "in" more room. The handwritten "as" is larger and heavier. See frontend.md.

Verification: `tsc --noEmit` passed. Real-time Chrome frame captures of a local Vite server (placeholder service URLs) at 1440px and 390px wide, plus reduced motion, confirmed the start, mid and settled states. The full `npm run build` needs the three `VITE_*` service URLs and was not run. The settled layout during live window resizing was not checked.

## 2026-11-07 — Pin general sessions and verify persistent bindings

Ordinary reviews and bounded decisions now require an explicit immutable general agent version and keep the existing task-budget ceiling. A live provider read confirmed version 21 has no MCP connectors and only delegation/wait tools enabled. Set the private runtime version to 21 and declared it for cases/autopoll. The persistent worker now checks its pinned case URL, identity metadata, attachment, tool default, and approved budget before starting inference; mismatches require review, and provider failures retain backoff.

Verification: three unit tests, nine persistent-session database tests, and build passed. No model session or outbound action was started. Deployment is being handled by the concurrent user-requested AgentPhone pivot to avoid overlapping releases; production verification of this pin/preflight is pending. Fresh user-case provisioning and renewal remain unfinished. See case-sessions.md.

## 2026-11-07 — Explicit synthetic completion and integration review

Added synthetic_demo_completed as a distinct stop outcome. It requires current recorded-outcome evidence, synthetic authority, and no uncertain dispatch. Dispatch rechecks evidence and stores an explicit no-real-payout label. Real goal_met remains separately gated. Case reads and bounded decision inputs expose current outcome references; the bounded prompt now asks one question per message. Integrated the completed case-specific Managed Agents connector fix and made the connector helper reject bare shared URLs or mismatched case paths.

Verification: 20 database regressions, 13 policy/protocol tests, three connector configuration tests, and build passed. An initial test assertion referenced the wrong receipt field and was corrected before the final passing checks. All six backend Functions deployed. Live MCP outcome/stop checks passed with a temporary synthetic authority, current evidence, stopped state, zero outbound actions, and cleanup. No model polling, communication, charge, grant reset, or budget increase was initiated by this stop-path work. The separate live Naïve isolation test is documented below; fully unattended provisioning and case resolution remain unfinished.

## 2026-11-07 — Stripe sandbox; payment kept hypothetical

Created an isolated, claimable Stripe sandbox and restricted test key autonomously through the official CLI. Stored the key privately in ignored .env.local and recorded hypothetical payment mode; no key was deployed and no checkout/payment was created. Read-only products and Checkout Sessions queries returned HTTP 200 with empty lists. Balance read was denied by the restricted key. Sandbox expiry is November 15, 2026. Documented the user’s scope change in payments.md and agents.md: defer actual checkout and fee collection. No application code changed; no build/test rerun was needed for these documentation/private-configuration changes.

## 2026-11-07 — Publish outcomes and session status

Added owner-visible session state, next check time, recorded reason, and human-help questions to the autonomy API/UI. The response excludes remote identity/session IDs and credentials. Human-help counts cover the returned decision history only. Published the outcomes and session UI to assurance.claims as deployment dpl_B2grMLravUcMQWyucSQDavtzsg6M.

Verification: build and local/hosted E2E passed, including mocked populated outcome/session views and real owner/cross-user API checks. Initial live checks returned the old autonomy response after deployment; after targeted redeployment, the expected sessions field was observed. The cause of the stale responses is not established. Three failed-run synthetic case fixtures were removed. A diagnostic API version header was added; the passing check did not observe that header. AI Gateway still has no enabled model.

The first supplied Vercel token returned 403; its replacement passed project access, deployed successfully, and was revoked afterward (HTTP 200; subsequent project access 403). Both private local token files were removed. The separate Naïve setup task reports a cross-session tool-result isolation issue; shared MCP activation remains gated while that task investigates. No Naïve blueprint/setup edits were included in this change.

## 2026-11-07 — Owner-visible outcome view

Added an owner-protected outcomes API and a case workspace panel for reported amounts, separate unknown refunds, calculation explanations, supporting quotes, and stale-evidence warnings. The panel refreshes on case revisions and every 15 seconds, ignores stale component responses, and displays refresh errors. Backend Functions deployed successfully.

Verification: build passed (267 modules; existing bundle-size warning). Local frontend E2E against the deployed backend passed authentication, persistence, Realtime, owner outcome access, cross-user denial, and the existing workflow checks. An explicitly mocked response tested populated outcome rendering, unknown refund values, stale evidence, quote expansion, and empty-state recovery. AI Gateway inference remains unavailable. An existing preview server on port 4173 already served the new build; a duplicate start failed without disturbing it. Vercel CLI is logged out, so the frontend is not yet published; a private temporary-token request is pending. No Naïve blueprint or credential setup changes were made in this step.

## 2026-11-07 — Evidence-linked outcome recording

Added record_outcome to the deployed case MCP service and prepared Naïve tool permissions. Reports retain the agent’s calculations, separate balance reductions from refunds received, and require exact quotes from confirmed documents or accepted replies. Immutable operation IDs support safe retries; case_get flags stale supporting evidence and attributes results to the agent. Migration 0017 stores the reports. No completion verification or checkout is implied by recording an outcome.

Verification: 12 database, protocol, and configuration tests passed; build passed. Migration 0017 and six Functions deployed. The live MCP smoke test proved discovery, evidence validation, separate refund/reduction values, idempotent retry, cross-case rejection, and persisted readback; its synthetic fixture was removed. No inference, outbound message, call, or charge occurred. Naïve configuration remains unpublished pending compatible setup credentials. See outcomes.md.

## 2026-11-07 — Clarify Neon AI Gateway recovery

Rechecked the production catalog: HTTP 200, 63 models, zero enabled, all reporting paid_plan_required. Compared current official billing/troubleshooting guidance and corrected the diagnostic to explain that directly card-billed Free accounts can add prepaid gateway credits without a plan upgrade. The minimum is $5; the hackathon promotion is a separate flow. Updated neon.md with the exact recovery page and account-restriction caveats. No credentials, billing settings, or purchases changed.

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

## 2026-11-07 — Managed Agents setup access and connector isolation

Used Playwriter in Dia to sign into the correct existing Managed Agents company and create a compatible temporary admin setup key. Runtime credentials/caps remain unchanged. Provisioned two case identities/vaults; the shared-URL live test exposed cross-session synthetic data contamination. Revoked both credentials, removed their sealed copies, and cancelled both runs. Prepared case-specific MCP URLs and version pins, updated the smoke script and configuration tests, and gated global blueprint MCP activation on an explicit case ID. Three configuration tests and build passed. Fresh isolated-URL reads return the correct cases, but full live completion/write verification is still pending amid provider approval gates and HTTP 429 capacity. No outreach occurred. See agent-tools.md.

Live isolated-URL verification completed through the authenticated Dia session after external API capacity errors: both sessions ended normally, returned their own case IDs, rejected cross-case probes, and wrote one expected Neon fact each. Naïve read_people gates required explicit synthetic-test approvals, including one same-session continuation to finish the first write. Cancelled the failed shared-URL sessions; removed four test cases and their credentials/facts, deleted test vaults, detached identities, revoked temporary admin keys, and removed the local key file. Restored default coordinator version 21 with no case connector; per-case test versions remain historical. Runtime key, standing grants, and caps unchanged. General UI activation/provisioning remains future work.

## 2026-11-07 — AgentPhone-only voice pivot

Applied explicit user direction to use only direct AgentPhone for new calls. Removed ElevenLabs/Twilio new dispatch, changed provider defaults and the ignored local selector to agentphone, updated diagnostics and the authenticated readiness field, retained historical provider receipt reads, and updated transport/database fixtures and docs. Read-only provider check verified hosted mode and an active configured number. Eleven focused tests and build passed; full database suite not rerun. Deployment pending. No purchase, call, grant expansion, or automatic retry occurred.

AgentPhone-only code and selector deployed to all six Functions; general-version tests and build passed before deployment. Updated agents.md to make the current provider instruction explicit. Authenticated readiness readback pending. No call placed.

Neon readback confirms completed cases/tools/autopoll deployments (53/11/19) with the selector and AgentPhone variables declared. Authenticated readiness verification did not pass: the retained browser session timed out waiting for stack status, an initial fresh session returned the old readiness payload, and a later signup test returned to the login form rather than reaching the workspace. Recorded these limits; no new calling success is claimed.

### Persistent startup revocation and hosted auth verification

- Recheck authority, credential, ownership, and operator access after remote binding verification before creating a persistent session. Revocation during verification stops the run without a provider start.
- Validation: all 12 persistent-session database tests passed, including three new revocation-during-verification cases; `npm run build` passed with the existing bundle-size warning. This worker change remains local and has not been deployed.
- After the AgentPhone-only deployment, `E2E_BASE_URL=https://assurance.claims npm run test:e2e` passed fresh signup, authenticated Functions, Realtime, database persistence, cross-user isolation, deletion, sign-out and password sign-in. Autonomy API version 2 was observed. This check did not verify the authenticated voice-provider status field or place a call. Gateway inference remains unavailable because no model is enabled.

### Resumable operator provisioning for persistent sessions

- Added `backend/provision-case-session.ts` and its operator CLI for existing approved synthetic authorities. Setup recovers remote identities/vaults/versions, seals a transaction-scoped case credential, restores the previous general coordinator default, verifies the binding, and registers the worker session without resetting authority limits.
- Failed database transactions leave remote tokens unusable. Retry recovers remote resources and replaces stale sealed credentials. No live case was activated, no grant was created, and no outreach was sent.
- All four disposable-database tests passed: idempotent setup, authorization rejection before provider work, lost-publication recovery, and preserving a newer general default. Build passes with the existing bundle-size warning. The command still needs live provider verification; automatic renewal and customer-facing activation remain unfinished.

### Live persistent session start and evidence wake

- Verified operator provisioning against the correct Naïve company using a temporary admin key. Runtime key and approved agent caps were unchanged.
- A synthetic zero-contact/zero-outbound case started one persistent remote session. Its queued revision-2 event was accepted at sequence 49; the same session read revision 2 and completed with `end_turn`, consuming 19,098 micro-USD. Two exact synthetic operations required operator confirmation through Naïve's `read_people` gate. This is not unattended operation.
- Added `scripts/persistent-live-smoke.ts` with setup, status, explicit synthetic approval, event wake, verification, and cleanup modes. Added schema support for research-only authority and full authority validation before provisioning.
- Seven policy tests, four provisioning database tests, and build passed; the build retains its existing chunk-size warning. No external messages or calls were sent.
- Cleanup confirmed zero outbound rows, cancelled the test session, removed its identity/vault and database fixtures, revoked the temporary admin key, and deleted its local secret. General default version 23 has no MCP servers; configured general review pin remains 21.
- Integrated verification: 26 disposable-database tests passed across persistent sessions, provisioning, and outreach. The initial outreach test command omitted `OUTREACH_TEST_DATABASE_URL` and correctly refused to run; rerunning with the disposable branch passed. Added an authenticated hosted readiness assertion for AgentPhone/email configuration and the new-user spending restriction.
- Hosted E2E passed, including the new authenticated AgentPhone/email readiness assertion, sign-up/sign-in, Realtime, owner isolation, and case deletion. Neon Gateway still has no enabled model; its unavailable state remains explicit. No deployment was performed while the side chat owned the Naïve capacity transport work.

### Reduced Naïve load and capacity recovery

Added a database-backed request lease and shared cooldown to the Naïve SDK transport, plus event/timer-only remote polling for idle persistent cases. Naïve retains case decisions and coordination; backend scheduling and waiting do not consume model calls. Migration 0018 adds operational metadata only. No automatic POST replay, new spending authority, voice change, or external contact is introduced. Six transport/configuration tests and fifteen disposable-database regressions passed; build passed. Applied production migration 0018 and deployed six Functions. A read-only live coordinator GET through the shared transport returned 200; the lease released, failures reset to zero, and success spacing was recorded. No agent sessions or outreach were created. This does not guarantee provider capacity; see docs/naive-capacity.md for limits. The user cancelled external escalation; no report was sent.

### Review-only permission selector

- Added a review-only default to the autonomy form, with no contacts and no outbound allowance. Synthetic email remains an explicit alternative with its existing limits. Switching modes clears consent.
- Added an optional E2E UI check that intercepts authorization requests and verifies both payloads and consent reset without creating live authority. Frontend changes are local and await deployment; no deployment overlaps the side chat's capacity work.
- Validation passed: local E2E exercised review-only and email payloads, consent reset, real Auth/Functions/Realtime, and cross-user isolation; no live authority was created by the UI test. `npm run build` passed with the existing bundle-size warning. Gateway inference remains unavailable.

### Shared integration review

- Found and fixed a conflict between the new single-request governor and parallel case-binding reads. Preflight now reads version, identity, and attachment sequentially; all eight binding/transport/config tests passed.
- The side chat applied migration 0018 and deployed the governor and idle-session optimization to all six Functions, then verified a real coordinator GET with lease release and zero failures. This controls HTTP traffic, not model concurrency. No external capacity report was sent, per the user's cancellation.
- Deployed the integration fix successfully to all six Neon Functions with `--no-env-pull`. The review-only frontend remains pending Vercel publication.

### Review-only UI deployed to assurance.claims

- Published deployment `dpl_CtEPHTMqgKq2SCy59QXppS1mHTNC` and passed hosted E2E, including mocked permission payload/consent checks plus real Auth, database, Functions, Realtime, and isolation checks.
- Revoked the temporary deployment token, verified access was rejected, and removed its local file. Token expiry does not affect site availability. No live grant, email, or call was created by the authorization UI check.

### Terminal persistent-session handling

- Checked current Naïve session and policy documentation while investigating `read_people` approvals. The API documents explicit per-tool session grants, but the reviewed docs did not explain a switch for the observed gate. No approval behavior or permissions were broadened.
- Fixed the worker treating a terminal `completed` session like resumable `idle`. Completed, failed, and cancelled sessions now require review; queued events stay undelivered and no replacement session is created.
- All 16 persistent-session database tests and the build passed. Deployed successfully to all six Neon Functions. No live session, spending cap, or approval grant was created or changed during this fix.

### Explicit case-owner approval workflow prepared

- Added owner/operator-scoped pending-action GET and explicit call-scoped confirmation POST, with exact action/turn hashes and active binding rechecks. Migration 0019 records confirmation decisions and uncertain outcomes. No automatic approval or future-tool grant was added.
- Added case UI controls to inspect and approve/deny a pending Assurance action. Unsupported tools/questions remain operator work. Updated browser-test navigation for the team's landing page and collapsed workflow sections.
- All 21 persistent-session/approval database tests passed, covering stale turns, ownership, revoked credentials, duplicate/contradictory confirmations, and uncertain transport results. Build passed. Production migration and deployment are deferred to avoid the side chat's pinned c3cf6fd deployment.

### Deploy latest committed Assurance frontend

Published clean commit `c3cf6fd` as Vercel production deployment `dpl_DFXTP6ik13ss4psM2qYv9Wjdu1tm` at assurance.claims, excluding ongoing shared-worktree edits. Build passed; live HTML/JS returned 200 and the JS filename matches the clean commit build. Existing backend deployment was preserved. The committed E2E contains stale landing, delete-label, and sign-out expectations. Hosted checks with corrected entry/selector expectations passed real Auth, persistence, provider readiness, cross-user isolation, and deletion; a separate direct smoke passed landing/workspace/signup/sign-out/password-sign-in. The optional mocked permission fixture timed out and is not counted as passing. Temporary deployment access was revoked and removed. See docs/hosting.md for final hosted verification.

Approval-workflow validation completed locally: the full E2E passed after correcting the landing-page entry, waiting for the case before expanding sections, avoiding a shrinking collapsed-section locator list, and waiting for sign-out's landing navigation. Mocked approval and authorization requests proved exact payloads without sending a real provider confirmation. The additional capacity-deferral database regression passed, bringing covered session/approval cases to 22. Production migration and backend deployment subsequently completed as recorded below.

### Approval backend deployed

Applied production migration 0019 and deployed all six Neon Functions after the pinned frontend deployment handed control back. The owner-approval UI remains unpublished. Extended the hosted isolation test to cover GET and POST of another user's session-approval endpoint. No live provider confirmation was submitted during this deployment.

The updated committed-source hosted E2E (`E2E_BASE_URL=https://assurance.claims npm run test:e2e`) exited 0 after backend deployment. It passed signup, authenticated Functions, Realtime, persistence, readiness, authorization denial, cross-user isolation including both approval routes, deletion, sign-out, and password sign-in. AI inference remained unavailable because the gateway has no enabled model. This run did not enable the optional mocked UI fixture or submit a provider confirmation.

### Stop paused sessions when authorization ends

Moved authorization validation ahead of the human-required early return and expanded scheduler selection to include invalid paused bindings. Added seven database scenarios for unchanged authorization, revocation/expiry of authority and credentials, ownership change, and operator removal. The unchanged case must make no provider calls; invalid cases must cancel the existing session without inference or a wake. Validation and deployment results follow.

All 29 session/approval database tests passed against the disposable branch; `npm run build` passed (273 modules, existing chunk-size warning). Updated the implementation-status summary to distinguish the current AgentPhone-only deployment and verified Naïve setup from superseded milestones.

Deployed all six production Neon Functions successfully with the existing environment preserved. Read-only post-deploy checks passed: public frontend HTTP 200, anonymous case API HTTP 401, forged scheduler delivery HTTP 401. Paused-session cancellation behavior is covered by the disposable-database tests with fake provider transports; no live cancellation fixture or new external communication was created for this change. Approval frontend publication remains pending.

### Published owner approval controls

Released commit 5b37141 to assurance.claims as Vercel deployment dpl_BLKVRRBirHEN3hY5Ee81Y7WZbaB8. Build and the full hosted E2E with optional mocked permission/approval checks passed. This resolves the earlier optional-fixture timeout; it does not establish live provider confirmation. HTML and JS returned 200 with the expected bundle. The temporary project-only token was revoked, denied access with 403, and removed locally; the setup tab was closed. Updated hosting, session, and implementation-status documentation.

### Live approval integration preparation

Added a separate-state option to the persistent smoke script and an owner-authenticated HTTP approval smoke command. The new check rejects non-synthetic or outbound-enabled authorities and confirms only known fixture reads/timers. Build passed. Live verification and cleanup are in progress; this entry does not claim a provider confirmation succeeded.

The live owner API returned a real pending `assurance.case_get`, confirmed it using the deployed runtime key, and returned the same confirmed receipt for a duplicate POST. Production contained exactly one approval audit row. The same session had accepted the revision-2 evidence event at sequence 29 before requesting approval. Subsequent session/event reads returned provider HTTP 429 capacity errors, so post-confirmation completion is not claimed. Local fixture authority and credentials were revoked; remote cleanup is waiting for the shared cooldown. No outbound contact occurred.

Remote cleanup cancellation also returned HTTP 429 after cooldown. Local authority/credentials remain revoked and remote cleanup IDs are recorded privately. The setup key disappeared from the dashboard after revocation; its private file and the owner authorization copy were deleted, and both tabs closed. Remote session/vault/identity cleanup remains outstanding. No new application deployment is needed for these test-script/documentation changes. Build passed.

### Queued persistent activation implementation

Added migration 0020 and a durable setup queue tied to a newly authorized case. Opt-in authorization queues setup atomically; legacy inference excludes queued setups. The worker uses a separate optional setup credential, leases one job, checks current authorization, and retries provider failures without replacing grants. Owner history/UI show setup progress and explain the persistent budget. Production remains disabled by default; database regression and deployment verification are in progress.

### Redeploy committed approval release

Redeployed clean commit `baf3548` to assurance.claims as `dpl_FESJmoN6a5T8G7F9c2FTwA7btaM2`, excluding unfinished activation work. Build and HTTP/asset match checks passed. No backend or schema changes. Temporary deployment token revoked and private token/OTP copies removed; browser tab closed. Hosted E2E exited 0, including optional mocked authorization/approval controls and real Auth, persistence, Realtime, isolation, deletion, and sign-in/out checks.

Activation validation: the initial parallel test invocation raced migration application; rerunning serially passed all 22 tests (7 setup queue, 4 provisioning, 11 legacy autonomy). Build passed after correcting the Neon optional/required credential config union. Local E2E passed mocked activation submission/status and approval controls. Applied production migration 0020 and deployed all six Functions with activation disabled. Hosted core E2E passed, including the new setup response and persistent_available=false. Production has zero setup jobs. The earlier revoked fixture remains in cancellation backoff; remote cleanup is still outstanding. The separate baf3548 frontend redeploy excludes this activation UI.

The first push encountered remote dashboard commit 972f0d1. Rebased onto it and preserved its sidebar, timeline, and authority-card styling while retaining activation loading and setup status. The combined build passed (681 modules). The first merged E2E reached deletion but timed out on the intentionally hidden sign-out control in the collapsed sidebar; updated the test to expand Workspace navigation by hover before signing out. Final combined verification follows.

The final combined local E2E passed activation/approval fixtures, real auth, persistence, readiness, isolation, deletion, sidebar sign-out, and password sign-in. The side task is connecting GitHub automatic frontend deployments; this change is ready for that path, but persistent activation remains disabled in production until dedicated setup access and a live activation test succeed.

### Connect Vercel to GitHub

Connected assurance-claims to pranayD21/autonomouscompany, confirmed main as production branch through Vercel readback, and documented frontend automatic deployments. No token, domain, or Neon backend configuration was changed. This documentation-only commit verifies the push-triggered build; its deployment outcome will be recorded after verification.

GitHub-trigger verification passed: documentation-only commit d0cdf05 automatically produced Ready deployment dpl_6TZDiVgGMCXTEsA9QZjusy281zAz in 12 seconds, Current Production at assurance.claims. HTTP 200 and the new bundle were confirmed. No manual deployment command, token, or backend change was required.

### Provider recovery and activation setup access

Verified the prior owner-approved read consumed revision 2 and ended the same session ($0.011012 total). Completed its remote/local cleanup with zero outbound rows. Created a dedicated setup-worker credential, retained it privately, and deployed it only to autopoll; environment-name readback confirmed absence from the cases Function. Existing runtime key/caps/grants remain unchanged. A fresh synthetic case and real crew review were requested through the owner API for queued activation verification; no communications are allowed.

The dedicated worker key deployed successfully; live review completed with valid saved output. Enabled persistent setup for the existing approved operator. The first authorization POST immediately after deployment returned the old disabled response despite availability readback; no grant was created. A fresh retry then queued exactly one zero-outbound authority. The verified case-autonomy trigger is enabled with the next run at 05:05 UTC. Live scheduler setup/start verification is pending.

The real 05:05 UTC trigger provisioned the queued authority and started one case-bound session. Owner API/provider readback and the live workspace showed ready/running. General default restored to version 27 with zero connectors; general review pin remains 21. Hosted E2E with persistent availability expected true passed, including rejection of unlisted-user spending. The dedicated setup credential is absent from the case API environment and frontend assets. Activation stays enabled for the existing operator. Both live fixtures are fully cleaned up with zero outbound records; temporary credential/auth copies and owned tabs were removed. The worker credential remains privately configured for ongoing activation. Sponsor-credit lookup returned a portal HTTP 500; no purchase was made. Automatic credential renewal and gateway credit access remain incomplete.


### Recheck ownership before persistent event delivery

Added a fresh case/owner/operator and credential-binding check after the provider status request, before sending a queued event to the existing session. Previously, that second check covered authority state and credential expiry/revocation but omitted owner and operator changes. Five database regression cases cover changes to the owner, operator allowlist, credential issuer, credential case, and authority approver during the remote read. The worker cancels the existing session and leaves its event undelivered when any check fails. No grants, caps, or session identities are reset. Human-required recovery remains a separate unfinished flow.

Validation: all 34 session/approval database tests passed on the disposable branch, and `npm run build` passed. Targeted production `autopoll` deployment 28 completed; no environment changes or outbound tests were made. Other Functions and the phone-flow work were untouched.


### Verify combined reply and follow-up lifecycle

Added one database integration test covering a reply and due timer together, followed by authority termination and a late reply. The focused test passed on the disposable branch (1 passed, 0 failed). It proves both events survive and use the same session without resetting policy or counters, and that a stopped case cannot restart through a late reply. Provider calls are simulated; no external communications occurred. This change affects tests/documentation only and requires no backend deployment. Concurrent phone-authentication files were excluded.


### Establish credential-renewal constraints

Inspected the installed Managed Agents vault API: rotation requires create-new/delete-old and cannot be implemented by extending the Neon expiry alone. Prepared an isolated live rotation experiment under the existing zero-outbound synthetic scope. Provisioning succeeded, but the pre-start identity check returned HTTP 429; no session or rotation started. Remote cleanup also returned 429 after the shared cooldown. Read-only database verification confirmed no remote session, revoked authority, revoked credential, and zero outbound rows. Remote vault/identity deletion remains pending; resume cleanup using the ignored rotation-runner and rotation-live-smoke state, without creating another fixture. No production source, schema, auth configuration, or budget changed.


### Complete renewal-experiment cleanup

Resumed the same fixture cleanup after the shared capacity cooldown. The command completed successfully, removed remote vault/identity resources and local fixture rows, confirmed zero outbound rows, and marked the saved fixture cleaned. No replacement fixture, session, budget, or outbound action was created. Credential rotation remains unverified. Concurrent phone authentication changes were preserved.

### Phone-first accounts and document notifications

Implemented an additive Better Auth phone identity service, verified-number account linking, signed/deduplicated AgentPhone call intake, owner-confirmed portal intake, scoped document-request tool, and consent-bound notification outbox. Existing managed email accounts are preserved. Added migrations 0021–0022, phone OTP/dashboard UI, issue-triggered document texts, opt-out, and a default-disabled deployment path. The existing number requires SMS registration; the user selected individual/no-EIN and provided registration details privately. No fee, call, SMS, or routing change has occurred. Nine phone integration tests, thirty-five session/approval regressions, ten MCP/configuration tests, the browser OTP fixture, and the build passed. Targeted OTP/linking checks also passed after log-suppression configuration. Production migrations 0021–0022 and the seven-Function deployment completed with the phone flag disabled; public deployment and readback checks are in progress. See docs/phone-first.md.

### Preserve managed email methods in phone adapter

Hosted verification found that object-spreading the managed auth client's Proxy omitted its dynamic signUp/signIn methods. Replaced the spread with explicit references. Full local E2E then passed real email signup, persistence, isolation, sign-out/password sign-in, plus mocked permission/approval controls. Added a dry-run-first individual SMS registration command with a private attempt journal and no automatic paid resubmission; its read-only plan validated the prepared draft and public opt-in screenshot without submitting. Phone feature and recipient allowlist remain disabled.

Phone rollout verification: post-fix commit 2c23098 auto-deployed and hosted E2E exited 0. Real email auth, persistence, Realtime, readiness/isolation, deletion, sign-out/password sign-in and mocked approval controls passed. Disabled phone status/OTP and forged scheduler denial were read back. One concurrent outbox regression passed after the global notification-budget lock. No registration, SMS, call, or inbound routing change occurred; the prepared $25 registration is awaiting explicit approval.


### Live vault replacement fails same-session authentication

A fresh bounded synthetic session read revision 1, then its idle-session vault credential was replaced and old database token revoked. The original session accepted revision-2 event sequence 30. After an explicit approval for that case read, the tool returned HTTP 401 and the session ended without revision 2. This is evidence against transparent in-place credential rotation, not proof of a particular provider caching implementation. Automatic rotation remains disabled. Cleanup revoked all local case credentials and the authority; remote cancellation repeatedly returned capacity 429. The ignored rotation-live-smoke-2 fixture retains the remote session and resource IDs for cleanup. Database readback confirmed zero outbound actions. No spending caps or phone settings changed.

### Approved individual SMS registration submitted

With explicit approval for the $25 registration only, submitted the prepared individual/no-EIN registration once to AgentPhone. HTTP 200 accepted it with campaign_status pending; status readback says under review, no issue. The existing number still requires SMS registration. Phone features, test sends, and inbound routing remain disabled; no real call/text was placed. Private contact data, provider response, and send-once journal remain ignored. Request ID: 8f72635d-8ca0-4ec9-940f-b98730e42205.

### Resume persistent workflow migration

Confirmed the main task's cleanup failure was a real Naïve 429 followed by a local cooldown, with the fixture locally revoked. Continued the local persistent-only migration independently. Recorded the latest user override in agents.md and verified mandatory provider budgets, nullable vault expiry, and send-once API behavior. No claim of recovery or deployed migration is made at this stage.

### Preserve queued work through Naïve capacity rejection

Added shared cooldown scheduling for persistent setup and session jobs and separate deferred-job reporting. A definite HTTP 429 approval rejection no longer creates an uncertain receipt; HTTP 503 and network-loss writes still require reconciliation. Approval endpoints expose capacity as HTTP 503 with a retry time. The existing transport governor and send-once behavior remain intact.

Verification: production build and type checking passed. All 55 focused checks passed: seven capacity/retry unit tests, two governor database tests, eight setup tests, and 38 session/approval/event tests. Database tests ran on an isolated temporary Neon branch, which was deleted afterward. The 429 event test preserved the session and event identity through recovery; the approval tests distinguished rejected 429 requests from uncertain 503 writes. No production deployment or external case communication was performed. A retry of the already revoked cleanup fixture returned another provider HTTP 429; remote cleanup remains pending. This patch does not complete the persistent-only workflow migration.

### Prepare minimal-Naïve demo fallback

Added an isolated local direct-model runner under scripts/demo, preserving the ongoing persistent-workflow migration. It can cache a genuine Naïve handoff with one events read, then run real case-scoped MCP tools without Naïve runtime requests. Private durable conversation state, case checks, exclusive-engine checks, and a persisted uncertain-dispatch stop prevent blind tool replay. Four focused tests and TypeScript compilation passed. A private direct OpenAI key request is pending; live inference and exclusive-case demo verification remain incomplete. No production deployment or communications occurred.

Live fallback verification subsequently passed: direct OpenAI tool-call generation, two model/MCP turns with persisted conversation, exactly one sourced fact and revision-2 readback, zero outbound actions. The synthetic fixture/raw token were cleaned. The direct-model key is stored only in the private local environment; no deployment or automatic engine switch occurred. Added a reproducible no-outreach fixture preparation/cleanup command.


### Commit the complete repository checkpoint

At the user's request, committed all pending repository source, tests, migration files, and documentation alongside the previously committed direct-model demo fallback. The persistent-only migration remains unfinished; migration 0023 and the pending backend changes are not deployed by this Git push. Build and seven focused capacity/demo tests passed. A scan of changed files found no configured secret values or credential-shaped strings; private environment files and test artifacts remain ignored. GitHub pushes trigger frontend deployment only.

### Explicit persistent case activation UI

Replaced the bounded demo authorization form with owner-written version-2 permission, explicit start/resume/stop controls, and separate saved, queued, working, waiting, attention, interrupted, finished, and stopped states. Direct-model sessions are identified and do not show Naïve approval controls. Edited permission clears the confirmation checkbox. Three focused tests and the isolated mocked browser activation flow passed; no live grant or outreach was created by those checks. See activation-flow.md for the API contract and verification limits.

### Complete POC phone readiness behavior

Read-only AgentPhone checks still report the existing registration pending and the number registration_required; hosted phone onboarding remains disabled. No paid submission, message, call, routing, or environment change occurred. Removed the historical case-notification count caps and made PHONE_ALLOWED_NUMBERS an optional rollout restriction: an empty list permits recipients already authorized by the OTP/consent paths once the feature and carrier are ready. Retained OTP abuse controls, STOP, ownership, deduplication, and uncertain-send reconciliation. Document requests now accept version-2 owner permission without legacy expiry requirements. PhoneSignIn checks readiness and directs unavailable users to the existing email path. All 12 phone database tests, the browser OTP/disabled-email fallback fixture, and the build passed; browser/provider transport tests sent no real texts. Live carrier delivery remains the external gate.

### Save interrupted integration handoff

At the user's request, added docs/RESUME-HANDOFF.md with current repository/deployment state, user-approved POC scope, live evidence, uncommitted hosted-runner/UI/phone work, exact missing integration steps, and cleanup/test/deployment instructions. Secrets and private registration data are excluded. This documentation does not claim the unfinished hosted workflow is deployed or complete.

### Hosted activation API integration

- Added transactional v2 activation, direct-engine history, owner resume, and credential/run revocation in `backend/autonomy-service.ts` and `backend/api.ts`. The explicit readiness flag is `ASSURANCE_DIRECT_ACTIVATION_ENABLED`; legacy grants retain their existing restrictions.
- Added `scripts/direct-activation.test.ts` for readiness, isolation, atomic run creation, resume, and uncertain-dispatch/revocation behavior. TypeScript and all three serial disposable-database activation tests passed. The tests also cover non-operator v2 bearer resolution and fresh reasoning after resume. Action decisions now receive owner-confirmed document evidence references. Deployment is not implied by this entry.

### Hosted public reading and direct document extraction

Added `read_public_source` to the case MCP tools, backed by the existing SSRF-protected source transport. Added an explicit `direct_openai` document-reader mode with exact stored-file hash checks, schema validation, fenced retryable inference attempts, and unchanged owner confirmation. Document reading no longer depends on the legacy crew-review UI gate. The cases Function requires its own server-only OpenAI key for this mode. No migration is required for these reader states, and existing Naïve attempts are preserved.

Validation: 12 source/document tests passed with `npx tsx --test scripts/direct-document-reader.test.ts scripts/public-source.test.ts scripts/document-reader.test.ts`. Three disposable-database direct-reader route tests also passed, covering concurrent starts, owner confirmation, stale-attempt fencing and retries. Live fictional-card inference passed with `gpt-5.4-mini`; live example.com retrieval returned its actual text and metadata after correcting an assertion that conflated the title and body. Hosted extraction is still unverified. Public reading supports agent-chosen URLs, not indexed web search; scanned PDFs still require page images.

## Persistent communication review (November 8, 2026 UTC)

Reviewed `backend/open-case-actions.ts` and retained separate v2 action routing. Exact operation retries return the saved result; conflicting content fails. Unfinished communications now block a competing contact or completion, and the dispatch guard checks case as well as owner and authority. Case/authority locks follow the same order as owner revoke. Follow-up emails preserve the prior provider thread and enable inbound monitoring. Active v2 authority keeps its enabled reply monitors eligible beyond the legacy expiry.

Seven disposable-Postgres v2 action tests passed with fake providers, covering retry/conflict, concurrent contact, unknown and rejected dispatch, threading, revoked prepared dispatch, isolation, evidence, and unsupported completion. The first run's assertions passed but teardown hit a reply-monitor foreign key; cleanup was fixed and the complete rerun passed. No live email or call was sent. The hosted workflow suite is separate; these action tests do not establish deployed readiness.

### Hosted direct-agent verification harness

- Added `scripts/hosted-direct-smoke.ts` with persistent private fixture state, hosted signup/session capture, activation/isolation checks, scheduler observation, owner update/resume, revoke, and delayed stop verification. Zero-outreach and separately authorized single-email fixtures are isolated.
- TypeScript passed. No hosted fixture or message was created while implementing the harness; live execution awaits backend deployment.

The hosted-compatible integration suite `scripts/hosted-workflow.test.ts` then passed alongside all eleven direct-runner tests (12 total), with successful fixture cleanup. It created v2 permission without an operator allowlist, queued a direct run, resumed a persisted pending tool after a Function slice, recovered from a simulated model 429, set a stable goal, sent two fake threaded emails, imported two authenticated fictional replies through the real reply parser/service, recorded an exactly quoted simulated outcome, and reached `completed` without another inference or send. All communication transports and model responses were scripted; this is service integration evidence, not live insurer delivery or a real payout. `connectDirectCaseTools` accepts service overrides for this test while retaining its internal authentication guard. TypeScript and `git diff --check` passed after the communication and monitor-status changes.

### Hosted document proof command

- Extended the hosted smoke harness with `document zero`: a retained fictional card image and stable upload ID, multipart request helper, direct extraction, exact transcription checks, cross-owner denial, repeated confirmation/revision checks, and zero-outreach verification.
- TypeScript passed. No live upload, extraction, or contact was performed during implementation.

## November 8, 2026 — Hosted integration verification before deployment

Wired the durable direct runner into autopoll and inbound event hooks, excluded direct authorities from legacy engines, and added server-only direct-model/document configuration. Review fixes preserve requested operation IDs across model retries, keep output-review pauses parked until owner resume, retry known read-only tools after interruption, and consume only the events actually added to the conversation. The case page now puts Agent work ahead of the optional legacy review.

The first runner test attempt exposed stale disposable fixtures and foreign-key cleanup order; the test cleanup was corrected. The initial runner/full-exchange suite passed 12/12; a subsequent expanded runner regression is in progress. Legacy session/setup/tool/phone/provisioning and v2 action regressions passed 71/71 serially. Build and mocked activation UI passed. The old Naïve rotation fixture cleanup succeeded with zero outbound rows. Carrier registration still reports pending/registration_required; phone remains disabled. Production deployment and live scheduler verification are still pending at this checkpoint.

## Twilio Verify setup script

Added `scripts/configure-twilio-verify.ts` and example phone-login configuration. Default execution reads the account and Assurance service; `--apply` creates only an absent service, verifies six-digit settings, and preserves private configuration while saving its SID. Ambiguity and uncertain creation block blind retries. The script has no send-code, voice, or number-purchase path. TypeScript passed; no live setup execution occurred during implementation. See [setup details](twilio-verify-setup.md).

### Separate phone login and Verify code delivery

- Added `PHONE_LOGIN_ENABLED` independent of inbound/notification activation, selected real-code delivery through `PHONE_SMS_PROVIDER`, Twilio Verify send/check hooks, and public fictional-number OTP fixtures. Test-number configuration rejects numbers outside the fictional NANP 555-0100–0199 range. No schema migration is needed.
- Retained real OTP request throttles, expiry, three-attempt checks, and one-time consumption. Verify's custom checker uses a locked local nonce so provider validation cannot bypass replay protection. Case notifications and voice remain AgentPhone; Verify is only for login codes.
- Updated phone `/status`, JWT acceptance, and authenticated phone routes. Readiness checks are read-only. Public test codes make those accounts shared fictional fixtures, never private accounts.
- All 16 phone database tests passed on the disposable branch. After separating notification and login readiness helpers, six affected tests passed again. TypeScript and whitespace checks passed. All provider traffic in these tests was mocked; no real SMS, call, deployment, or inbound routing change was performed.

### Hosted phone verification helper prepared

Added `scripts/hosted-phone-smoke.ts` with separate fictional-account, one-real-OTP-request, and real-verification commands. The real-send command persists its attempted marker before sending and refuses repeats; real verification uses a private OTP file and signs out after checking the hosted dashboard. The demo checks account persistence/isolation and deletes only its own fictional case. `npx tsc --noEmit` passed. No live command was executed during implementation.

## November 8, 2026 — Phone login and hosted correction checkpoint

Integrated the additional phone-login handoff: phone-only entry with older email fallback, five fictional shared demo numbers, separate login/notification flags, Twilio Verify codes, and existing OTP abuse controls. Phone DB tests passed 16/16 and six affected cases passed again after readiness separation; mocked UI and build passed. The Verify setup script passed four fake-transport tests. The real account was active; its list endpoint rejected PageSize=1000, so setup now uses 100. Created one Assurance service, verified six-digit settings, and saved its SID privately. No SMS sent at this checkpoint.

Hosted activation and zero-contact reasoning passed, as did actual uploaded-card extraction, cross-owner denial, and confirmation idempotency. Live model behavior exposed a missing required email-tool argument (no decision/dispatch row) and stale evidence after a fact write. The runner now distinguishes explicit pre-dispatch rejection from uncertainty, refreshes its system instructions, and surfaces unresolved tool failures as owner-help states. Action errors identify stale evidence without leaking internals. The final runner/workflow/action regression passed 23/23. The existing fixtures will continue under their original permissions; no email has been sent yet.

## November 8, 2026 — Hosted release verified

Published d4f535e after the backend/migrations. The public frontend serves index-iqqqwjLX.js. Hosted direct activation and cross-owner denial passed; the same zero-outreach run resumed after an owner update and saved a sourced incident-date fact with its original goal. It returned a prose waiting status rather than a second request_human action; the smoke check now verifies waiting state plus persisted evidence instead of demanding one model tool choice. Both test grants were revoked. The one-email fixture sent exactly one fictional message; AgentMail recorded acceptance and connected Gmail confirmed it in the inbox. No insurer or additional recipient was contacted.

Hosted phone status reported enabled=true/smsReady=true with five demo numbers. Two fictional phone accounts passed UI login, stable re-login identity, and isolation. One authorized real SMS code verified through Twilio, produced the expected scoped API identity, opened the dashboard, and signed out. The temporary OTP file was removed. Email E2E passed after adapting its sign-out path to the new email fallback link. The phone UI harness initially timed out because the collapsed sidebar intercepted Sign out; hovering the sidebar, as the existing email test does, fixed the harness and the rerun passed. No real OTP was resent.

Retained final model status text in the run so waiting information is visible. Private attempt journals, browser sessions, credentials, phone number, and OTP data are excluded from Git. Both revoked live runs passed the delayed stop-persistence check: unchanged activity and no new outreach across the observation interval.

## Reduced-input phone case start

Updated the call and upload-link wording to explain the service once and remove repeated fictional/demo instructions. Verified owners can submit a call intake with `start_agent:true` to create its case and direct-agent run in one transaction under the standard intake scope. Activation unavailability rolls back the whole claim. Omitting the optional SMS preference reuses call consent for a new preference but preserves any existing STOP. Existing claimed intake retries never add permission or restart stopped work. No case information is exposed through caller ID alone.

All 17 phone integration tests passed serially on the disposable database, including atomic activation/rollback, STOP preservation, and retry after revocation. TypeScript and diff whitespace checks passed. Read-only AgentPhone checks still returned registration pending and outboundSms registration_required. No call, SMS, registration payment, routing update, or feature-flag change occurred; live SMS remains Twilio Verify login only. See phone-first.md for the current gate and API contract.

### BlueBubbles fallback assessment

Investigated the user-requested alternative using official BlueBubbles documentation and read-only local app/configuration-presence checks. No server installation or configured connection was found. The official FAQ states SMS is unsupported, so no speculative carrier-SMS adapter was added. Documented the Mac/Messages sender, reachable server, and opt-out requirements in phone-first.md. No personal Messages data, sends, installations, credentials, or routing were accessed or changed.

## November 8 — submission starts agent work

Replaced separate permission writing/checkboxes with a concise scope disclosure at case submission. `backend/intake-policy.ts` records the standard scope; `intake-service.ts` atomically creates the owned case and direct authority/run, serializes UUID retries, rolls back unavailable activation, and never restarts an existing stopped grant. Legacy API saves remain saves unless `start_agent:true` is submitted. Workplace contact fields are optional because the agent can gather them later. Owner responses persist once and resume the same run only when dispatch state is safe.

The workspace accepts narrative or files, uploads and reads files automatically, puts agent activity first, and collapses optional details and legacy controls. Repeated prototype/synthetic banners were removed; public shared sign-in accounts and actual fictional evidence remain accurately identified. Direct agents can use machine-extracted observations without mandatory owner confirmation, preserving unverified attribution; confirmed transcription and final-outcome evidence checks remain distinct. Extraction completion advances evidence revision and safely wakes owner-paused work. Stopped and uncertain work cannot be silently reactivated.

Added a consistent five-PDF upload pack, pasteable account, generator, and ZIP under `artifacts/demo-case/`; each document has a small fictional provenance footer and no deliverable contacts. Text extraction, page counts, rendering, and visual inspection passed. See demo-upload-artifacts.md. Verification: 14 intake/activation/document/claim-input tests passed, 25 runner/document/action regressions passed, and the final intake service rerun passed 2/2. Phone integration passed 17/17. TypeScript, build, secret-value scan, and diff checks passed. All seven backend Functions deployed. Initial hosted requests briefly reached old validation during deployment propagation; database readback showed no case or authority was created. Retrying the same saved UUID after propagation passed atomic one-step activation, stop-preserving retry, cross-account isolation, and actual artifact extraction with no mandatory confirmation and zero outreach. No new SMS/call/email was sent.

The mocked activation UI passed single-click start, status, owner-answer UUID handling, and stop. `scripts/intake-ui-fixture.ts` passed narrative-only and document-only CaseForm submissions, derived titles, optional contact fields, and absence of a permission checkbox. This bounded form fixture does not exercise the full Workspace upload/retry sequence. The hosted E2E harness was updated for new selectors and immediate stop/zero-outreach checks but was not rerun for this release.
## November 8, 2026 — Workspace redesign and next-step model

Earlier commits on November 7 (`beb727b`, `972f0d1`, `2984a6e`) carried the landing page and the claims workspace into one design. They added the hover-expand sidebar and multi-case overview, and cut filler copy after a persona-based design review. They did not update these docs; this entry covers them.

This change adds `src/progress.ts`, one derived progress model per case. The sidebar, overview, case header, next-step card, the new step tracker (Details · Documents · Agent work · Outcome) and section tags all read it, so they stop contradicting each other. Before this, the next-step card read only `status` and amounts. A case with a reported outcome still said "Draft your outreach", and a running review showed an "Add documents" button. The overview now groups cases into Needs you / Waiting on others / Resolved. The agent's request reason appears in the next-step card. The dark card style is reserved for the user's move. Pending drafts appear above the new-draft form. The uploader collapses to "Add another document" once files exist. "Stop agent work" and the optional review button are secondary. The model follows the persistent agent-work flow; the header has no "Review with AI" button, matching `scripts/e2e.ts`. See [frontend.md](frontend.md).

Verification: `npm run build` passes, and `scripts/progress.test.ts` (6 cases) and `scripts/activation-state.test.ts` pass. Desktop and 390 px layouts were checked in a local harness with mocked API responses. The Playwright suites against the hosted backend were not run for this change. Limitations: the overview loads six endpoints per case per refresh. Smoke tests that look for a case `article` from the overview must navigate to `#case/<id>` first.

Merged the concurrent case-progress dashboard update with the simplified intake: preserve grouped next-action visibility while retaining one-step submission, optional document confirmation, and existing-grant boundaries. The combined frontend passed TypeScript/build, all 10 progress/activation-state tests, and both mocked activation and intake browser fixtures. Its build is `index-CKRvH7VE.js` with `index-xEQUA129.css`.
## November 8, 2026 — Partial revert of the next-step redesign

The founder kept only the section-level progress tags from `292648a`: a blue **Next step** tag and left bar on the section that needs action, and green **Done** tags. They also kept the shorter Agent work intro, the outlined "Run agent team" button, and the outreach lines "Write a draft, then approve it. Nothing is sent until you do." and "Messages the agent sends appear here." Everything else returned to the `c0e3200` version. That covers the overview grouping, owner chips, step tracker, next-step card logic, money-card outcome view, compact uploader, draft ordering and agent session card layout. `src/progress.ts` and its tests remain and now drive only the section tags.

Verification: `npm run build` and `scripts/progress.test.ts` pass, and the case page was checked in the mocked local harness. Hosted Playwright suites were not run.

The concurrent frontend author then reverted the grouped-dashboard redesign while retaining section progress tags. The final merge follows that newer layout choice and preserves the simplified intake/automatic reading changes.

Final layout reconciliation passed TypeScript/build, 10 progress/activation-state tests, and both mocked browser fixtures. The final build is `index-COYhhpN-.js` with `index-Cgf9WqH7.css`.

## Mac Messages bridge implementation

Added migration 0025, authenticated phone-Function bridge routes, fresh-heartbeat readiness, consent/authority-bound queue claims, send-once attempt receipts, uncertain-send handling, scoped reply ingestion, STOP, and owner-only message reads. The Mac selector prevents simultaneous AgentPhone notification dispatch; login codes stay on Twilio Verify. Added a foreground local runner with explicit Messages account selection, private crash journal, argument-safe AppleScript, and a read-only recipient-scoped SQLite reader. The user selected the existing Mac sender; its enabled SMS service and generated bridge credential were saved only in ignored mode-0600 configuration.

Nine local tests and nine disposable-database bridge tests passed; TypeScript passed. Read-only checks found one SMS and one iMessage service, with automation and selected SMS account ready. Database access is denied, so the bridge remains disabled. No real send, Apple-account change, privacy-setting change, or inbound-routing activation occurred. All 17 existing phone regression tests also passed, as did the final build and diff checks. Production migration journal hashes were verified, then migration 0025 brought the count to 26. All seven Functions deployed with the authenticated Mac bridge configured and PHONE_FLOW_ENABLED still false. Live endpoint propagation/readback is checked separately.

Hosted bridge readback passed after deployment propagation: public status reports mac_messages with notificationReady=false while Twilio login remains enabled/ready. The configured local runner completed a no-send heartbeat cycle; anonymous claim returned401, and authenticated claim returned no job with the flow disabled. All35 focused tests (9local,9bridge DB,17phone regression) passed. No real SMS/iMessage, reply delivery, or inbound call was tested. The user reported enabling Full Disk Access, but the existing T3/Codex helper still cannot open Messages; resolve responsible-app access/restart before enabling delivery.
