# Company runtime

The current implementation connects permanent Naïve company roles to one advocate per case. This document describes local code; deployment and live proof are recorded separately in implementation status.

`backend/firm-events.ts` records website and email intake events. Website activation creates a staffing request atomically with the authority. The ordinary setup scheduler excludes these requests so that Front Desk and the old provisioner cannot both hire an advocate. A different authority on an already staffed case requires explicit handover rather than silently reusing credentials.

`backend/firm-service.ts` exposes role-specific company operations. Front Desk requests a CEO allocation when a case has none. The CEO records the expected recovery, budget and reasoning. Hiring creates a dedicated Naïve advocate, a dedicated AgentMail inbox, and the existing isolated case identity/vault/session binding. Agent lists are paginated and duplicate names fail closed. Budget changes use Naïve's session budget API; a provider spending allocation does not buy credits.

`backend/firm-tools.ts` serves `/mcp/:role` using separate role bearer tokens. Company roles cannot invoke another role's tool or write arbitrary record kinds. Email verification challenges and proofs are excluded from company reads and writes. `backend/firm-runner.ts` stores each event session request before starting it, uses a stable provider idempotency key, verifies role/identity bindings, and reserves tool confirmations before dispatch. An uncertain confirmation is held for reconciliation. Scheduled role sessions use the same approval checks.

`backend/firm-worker.ts` mounts signed AgentMail webhooks, role MCP routes, and a verified Neon `firm-operations` schedule. Each tick also advances inbound attachment jobs. The request slice limits work per invocation, not per case. Customer email and uploads wake the existing advocate through the case event queue.

`backend/case-company.ts` lets an advocate request CEO, reviewer, or knowledge help without exposing company credentials. Requests recheck case ownership, credential revocation and current authority, and deduplicate operation IDs. Review records wake the advocate as attributed agent observations. Case closure queues CEO, reviewer, finance and knowledge work. Playbook writes retain a revision history; case reads expose reusable playbooks without authentication records or other cases' private records.

Case email sends preserve their inbox in the outreach ledger. Dedicated case mailboxes use webhook ingestion rather than scheduled reply polling; historical global-inbox threads retain their existing monitor. The advocate writes customer messages and document requests. Missing information means waiting or blocked, not resolution. Initial goals remain visible when the agent records a reasoned refinement.

## Configuration

The `firm` Neon Function uses `ASSURANCE_FIRM_ENABLED`, `ASSURANCE_FIRM_TOKENS` (JSON role tokens), `ASSURANCE_FIRM_REGISTRY` (role agent/identity/version bindings), `ASSURANCE_FIRM_BOARD_ID`, `ASSURANCE_FIRM_MODEL`, `ASSURANCE_FIRM_BUDGET_MICRO_USD`, `NAIVE_SETUP_API_KEY`, `NAIVE_API_KEY`, and `NAIVE_CASE_TOOLS_URL`. AgentMail webhook credentials and document extraction/storage settings support email intake. `STRIPE_TEST_SECRET_KEY` is server-only. The cases Function receives public contact/readiness settings and Gmail connection configuration; the frontend receives no provider secrets.

Configure roles with `scripts/configure-assurance-firm.ts`; its default is a read-only plan and `--apply` reconciles resources. Stage schedules disabled until the Function and registry are verified. See [firm blueprint](firm-blueprint.md), [AgentMail ingress](agentmail-ingress.md), and [payments](payments.md).

## Verification boundaries

Focused tests cover role denial, case request isolation, staffing retry behavior, and playbook history. Run database tests serially against a disposable database, never production. Live hiring, email webhook delivery, Gmail consent, Stripe test receipts, and same-session advocate continuation require separate evidence; code and mocked tests alone do not establish those outcomes.

The initial hosted setup request for `loose` was rejected by Naïve with `window_unavailable` for the selected model. `ASSURANCE_FIRM_WINDOW` makes this provider choice explicit; hosted preparation uses `immediate`. The cheaper window is not claimed to be active. Version-2 follow-up timing accepts an agent-selected positive duration without the former five-minute/seven-day range; legacy authorization still enforces its original range. Invalid timestamps are rejected as a storage constraint.

Board assignments resolve company role names or configured IDs to current Naïve agent names before dispatch. Provider failures retain only bounded status/error codes, not raw provider bodies or credentials, to support reconciliation. A read-only live board inspection found no card for the failed initial operation; this alone does not prove a successful retry.

Native `board_write` confirmations are denied with instructions to use the durable `firm.update_board_card` tool. This denial permits the existing role session to continue without executing an untracked board write. Front Desk asks `hire_advocate` to queue CEO allocation when no budget exists; board bookkeeping must not block staffing.

Case activation queues both Front Desk intake and a deduplicated CEO allocation request. The CEO supplies the amount and rationale; this scheduling change prevents board bookkeeping from stranding an unstaffed case. Budget allocation then wakes Front Desk to hire.

### Board assignment protocol and reconciliation

Naïve's board API accepts an agent **name** for `assignee`. The live OpenAPI describes a string without specifying this distinction; a provider validation response confirmed that an agent ID is not accepted. `boardAssignee` in `backend/firm-service.ts` resolves a company role alias or `agt_` ID through the agent read endpoint and submits its current name. Already supplied names remain names. Empty or malformed provider names fail validation. `scripts/firm-board-assignee.test.ts` covers these cases without provider mutations.

The previously stalled front-desk board operation was reconciled against its existing card key on November 8, 2026. After a definite validation rejection and a read confirming no card under that key, the original operation created the card using the verified agent name. Its real provider receipt was saved and the original operation marked completed; no replacement operation was invented. The existing front-desk session then received the previously prepared staffing continuation under its original idempotency key. This correction did not send customer email or place calls. It proves board creation and continuation acceptance, not completion of subsequent staffing work.

Provider errors retain only bounded status/code in the service. Full diagnostic provider bodies were kept only in ignored private investigation files and are not returned by company tools.

Each firm scheduler invocation advances up to three due events within a 45-second admission slice, then checks scheduled approvals. Requests remain sequential under the shared governor; provider cooldown stops the slice. These are per-invocation capacity controls, not case-work budgets or decision limits.

## Case budgets

The CEO allocates each case budget through `set_case_budget`, and its mandate in `backend/firm-blueprint.ts` instructs it to allocate $250 per case. The tool records the amount the CEO supplies and its reason. The amount is a ceiling and is not checked against the credit balance, so real spend stops when organization credit runs out. Nothing buys credits or charges anyone.

Naïve refuses to start or continue a session whose budget is below its pre-flight quote, with HTTP 402 `budget_exceeded`. The session scheduler records that reason, keeps the same session identity, and queues one `budget_needed` event per funded amount for the CEO on firm-staffed cases.

A hired advocate's default agent version stays general with no case connector, and its session pins a separate connector version. Funding an unstarted advocate therefore publishes a new connector version carrying the budget, restores the general default, raises the default's budget too because Naïve checks a session budget against the default version's cap, pins the run to the connector version, and makes it due immediately. It does not queue another hiring event. A retry reuses a connector version already published at that amount.

Naïve pauses write tools for confirmation even when they are configured `allow`, and the call runs only if the model repeats it next. A model that called a different tool first looped without running the hire. Every confirmation reason, for role sessions and case advocates, now tells the model to repeat the same call as its very next action.

An interrupted `hire_advocate` can leave staffing in `hiring` with its operation `uncertain`. A model reads that state as finished, so the firm scheduler finishes the hire itself: `resumeInterruptedHires` in `backend/firm-service.ts` picks one such case per tick, once it has sat for two minutes, using a new operation ID. It finds the saved agent, creates the mailbox with a stable client ID, and queues provisioning, and never creates a second agent. If a step fails, it logs `firm_hire_resume_failed`, saves the error in the `firm-hire-resume:<authority>` record, and retries two minutes later. Firm tool failures also log `firm_tool_failed` with the error code.

A role session can end its turn after a transient tool error or an approval wait, with its required result missing. When a CEO budget or Front Desk hire is missing and the session is idle, the runner sends that same session a message naming the missing tool, up to three times, with the idempotency key `firm-continue:<event>:<n>`. It counts these in the `firm-continue:<event>` record and keeps the event running. After the third message it escalates to `human_required` as before. It never creates a replacement session.

Budget allocation and hiring validate the staffing authority, case, owner, and active state before any provider request or further staffing event. Revoked cases cannot request a new allocation through company tools.

Native board-write advertising is disabled in role declarations. Front Desk intake/allocation events explicitly prioritize the authorized staffing tool; a denied board comment must not terminate hiring. Existing sessions retain their pinned versions and receive an idempotent operational continuation rather than being replaced.

MCP authentication failures emit only `firm_auth_rejected`, the recognized role (or `unknown`), and whether a Bearer header was present. Tokens, headers, request bodies, and case content are never logged. This distinguishes missing provider credential injection from a rejected credential without exposing either.

### Business completion checks

A remote `completed` or idle `end_turn` is only a finished model turn. For CEO allocation events, the runner requires a saved positive budget and rationale under the current owner authority. For Front Desk onboarding events, it requires an active staffing record, the same authority's bound advocate run and unrevoked credential, a provider session, and the advocate's persisted initial goal. An active advocate still taking its first turn keeps onboarding pending. Missing hiring, broken bindings, revoked authority, or an advocate stopped before onboarding or blocked before writing its goal records `business_intervention` and leaves the original event `human_required` with the unmet condition. The original provider session is retained; no automatic replacement session or agent is created. Company status exposes this reason for reconciliation. The regression in `scripts/firm-runner.test.ts` checks an ended hiring session without an advocate.

On November 8, the continued Front Desk session produced HTTP 401 on a case-summary read. Deployed rejection telemetry confirmed `bearer_present:false` at 09:12:39 UTC. Direct calls with the configured role bearer succeeded, and both pinned version 1 and current version 2 declared the correct endpoint and role tool permissions. The session also reported an incomplete available tool set. This establishes missing authentication on that provider request; it does not establish why Naïve omitted injection. No token was rotated or endpoint authentication relaxed. A separate read-only version-2 connection diagnostic is being used to distinguish new-session behavior from continuation behavior; it is not an advocate or business-work replacement.

`scripts/hosted-firm-smoke.ts prepare` creates a distinct fictional onboarding fixture with explicit CEO allocation and Front Desk hiring scope, website-only advocate interaction, and no external communications or payments. Its private state is `test-results/hosted-firm-onboarding.json`. It uses the existing fictional test identity solely for stage-one workflow verification; this is not proof of the email-first authentication journey. `check`, `resume`, `chat-check`, and `stop` exercise the existing fixture rather than creating another. Management events must independently satisfy the runner's business-result checks.

The completion regression suite now passes 11/11 tests, including valid binding/first-goal checks and missing CEO rationale. Hosted scheduler readback of the older ended Front Desk session now records the unmet advocate binding as `human_required`. This proves the failure path, not normal-path onboarding. A first goal followed by a legitimate owner question counts as an onboarding turn, not a resolved claim.

### Explicit Naïve runtime

The isolated `vetta` diagnostic completed an initial MCP read and a second authenticated read in the same session after scoped approval. Company role declarations and newly hired advocates now use `ASSURANCE_FIRM_HARNESS` (`vetta` by default; `pi` remains an explicit option). The setup reconciler sends this field through the live OpenAPI agent contract, including on updates. Existing agent IDs, identities, vaults, and case permissions are preserved. This is evidence for the connection path, not yet successful business onboarding. Scheduled tool confirmations remain durably scoped and checked.

`firm_status` reads durable local staffing/event state and board references. Only CEO status fetches the current provider credit balance; allocation still rechecks the balance before writing. Other roles do not make redundant credit/board API reads just to inspect intake. This reduces shared-queue contention during Front Desk status reads; it does not relax admission or spending controls.

An ended Front Desk intake turn may legitimately be waiting for its already queued CEO allocation or budget-triggered hiring event. It remains pending while that dependency is queued/running; it does not spawn another session. Once the dependent work ends, the same durable-result checks decide whether onboarding succeeded or needs intervention.

An advocate that ends its first turn without persisting a goal is intervention work, not an indefinitely pending onboarding task.

The hosted CEO attempted to reuse a completed board-write operation ID for a distinct budget allocation. The ledger correctly rejected it before budget execution. `OPERATION_CONFLICT` now explicitly explains that the requested operation did not execute and that distinct logical work needs its own UUID; exact retries still reuse their original ID, and uncertain work must never be repeated under a new ID. Role instructions make this distinction explicit.

A one-time runtime handover for the zero-contact onboarding fixture confirmed the old CEO session was idle, no unresolved confirmation receipt existed, and no budget/advocate had been created. It then cancelled that provider session, verified `cancelled`, and queued one linked CEO event under the same authority. The predecessor event is `superseded`, not `finished`; its history and completed board receipts remain. A durable `session_handover` record links the events. This was an explicit repair of an old pinned runtime, not automatic replacement of uncertain case work.

A scheduler invocation can confirm up to three already-pending role calls sequentially, with fresh identity/action checks and a separate durable receipt for each. This request slice avoids a full cron interval between members of one provider approval batch. Remaining calls continue on later invocations; there is no lifetime action limit, and uncertain confirmations are never replayed.

A valid first-turn owner question can park both the advocate and authority as `human_required`. If staffing, credential binding, session, and the initial goal are already proven, onboarding may finish while the case waits for the owner. This does not reactivate permission or permit new allocation/hiring; CEO allocation still requires active/waiting authority. Revoked/stopped authority never passes the onboarding check.

Running-event readbacks become due after 30 seconds so the minute cron can pick them up on its next tick. The prior 60-second delay started after processing and could miss the next minute boundary, doubling the polling interval. The three-minute claim fence and shared request governor remain unchanged; this affects polling, not case action timing or authorization.

### Durable advocate provisioning

Front Desk's hiring tool creates or verifies the one case-owned agent and mailbox, then queues `advocate-provision:<authority_id>` in `firmRecords`. Its receipt says `provisioning_queued`, not `hired` or `working`. The existing leased setup worker consumes that record using the saved agent/version and CEO allocation, rather than the shared coordinator. Only successful isolated provisioning makes staffing active. Provider deferrals retry the same job and resource bindings. Onboarding completion still requires the real case session and first goal. This keeps multi-request provisioning outside a single MCP tool call and lets the durable worker survive interruptions.

A queued/leased durable provisioning job keeps its hiring event pending. It does not count as a bound advocate or a first turn. An ended role with neither the required result nor a live provisioning/dependency job still records intervention work.
