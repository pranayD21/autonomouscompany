# Case-scoped agent tools

This document describes the implemented case tools.

## Service

`backend/case-tools.ts` serves Streamable HTTP MCP using the official SDK. `backend/case-tools-worker.ts` hosts it as a separate Neon Function. The shared endpoint `/mcp` derives its case from the bearer credential. `/mcp/:caseId` remains available and additionally checks the URL case against that credential. Browser Origins are rejected. A missing/invalid credential returns 401; a valid credential for another case returns 403. Tool arguments are checked against the authenticated case as well. The transport is stateless and returns JSON; unsupported GET/DELETE requests return 405.

`backend/case-tool-auth.ts` creates a random 256-bit secret and stores only its SHA-256 hash in `advocacy_case_tool_credentials`. All credentials can be revoked. A version-2 authority-bound credential has no expiry and stays valid only while its authority and case ownership hold. A legacy authority-bound credential expires with its grant, a credential without an authority expires after 24 hours, and both also require the issuing owner to remain in `CREW_ALLOWED_USER_IDS`. Authenticated, listed owners can mint a credential with POST `/cases/:id/agent-credentials`; the raw token is returned once and must stay private. POST `/cases/:id/agent-credentials/:credentialId/revoke` revokes it. Provisioning seals case credentials into the Naïve vault; see [case sessions](case-sessions.md).

Core tools:

- `case_get`: returns the case, document IDs/hashes, accepted correspondence, outreach history, recorded statements, completed-call transcript snapshots, and valid source references.
- `cite_source`: retrieves a chosen public source, verifies a short exact quote, and saves a case-linked snapshot. See research.md for network restrictions and provenance limits.
- `case_record_fact`: records a statement and an existing case evidence reference. It does not independently verify the statement. A case-scoped operation UUID makes retries idempotent; a retry with changed data fails. A successful new record advances the case revision once.

`backend/case-tool-service.ts` implements database operations. Migration 0013 adds credential and sourced-statement tables. Sending, calling, follow-up scheduling, human-help, and stop tools use standing-authority checks. `backend/case-tools.ts` also registers `set_goal`, `request_company_help`, `message_customer`, `request_document`, `read_public_source`, and `record_outcome` when their services are supplied. There is no checkout tool; Finance's test-fee tool is described in [firm blueprint](firm-blueprint.md). The bounded own-inbox autonomy grant is unchanged.

## Verification

Four protocol tests pass: missing/wrong authentication, cross-case URL/argument denial, Origin rejection, initialization, discovery, and own-case reads. Two disposable-branch database tests pass: owner-only issuance, hash-only storage, expiry/revocation, concurrent duplicate statement writes, changed-operation rejection, and unknown-source rejection. `npm run build` passes. The SDK is declared directly in package.json rather than relying on a transitive dependency.

Protocol reference: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports

Migration 0013 is applied to production and the tools Function is deployed. A live temporary synthetic case passed initialization, tool discovery, own-case read, duplicate fact retry (one stored row and one revision increment), missing/revoked credential 401, and cross-case credential 403. The fixture and credential were deleted afterward. This verifies the MCP service, not a Naïve tool call or an external communication.

## Coordinator delegation

The Naïve blueprint lets the coordinator choose which specialists to consult, including none for a routine follow-up, wait, or stop. The bounded decision prompt follows the same policy. Requested specialist results must still arrive before submission.

The installed SDK attaches MCP servers to agent versions, not individual session-create requests. Session creation accepts an explicit agent version. Each case therefore gets its own pinned agent version and vault, which keeps simultaneous cases isolated.

## Naïve session connection

`backend/providers/case-agent.ts` defines the MCP tool configuration and session inputs. Each session selects an explicit Naïve identity and agent version with a task budget: at most $0.25 on legacy grants, and the configured or CEO-allocated amount under version-2 permission. A case identity owns a vault containing its case bearer token. The pinned agent version declares the case-specific `/mcp/<case UUID>` URL; Naïve injects the identity's credential at the network boundary. The token is never included in prompts or inline agent headers. The configuration enables case reads, sourced facts, citations, the action tools described below, read-only Gmail tools, and Naïve web search/fetch.

Set `NAIVE_CASE_TOOLS_URL` to the tools Function's `/mcp` URL. `scripts/case-agent-smoke.ts setup` provisions two synthetic case identities/vaults and starts two version-pinned sessions, each instructed to read its own case, verify the other case is denied, and record one sourced statement. `poll` observes the saved sessions without creating new ones. Local state and event logs live in ignored `test-results/` files. The setup script can read a temporary admin-scoped key from `NAIVE_SETUP_KEY_FILE`; it changes the key only inside its process, not in the app environment.

An earlier setup attempt stopped at vault creation with HTTP 403, `missing admin scope`, because the browser login showed a different onboarding company rather than the configured Assurance organization. The November 7 verification below used a compatible admin-scoped key.

Verification: seven local tests pass, covering transport authentication, shared-URL cross-case isolation, explicit session identity/version, budget bounds, and rejection of secret-bearing endpoint URLs. Build passes. The shared `/mcp` route is deployed. The first route-array implementation failed because Hono requires separate route registrations; it was corrected before deployment. Naïve documentation: [credential vault](https://usenaive.ai/docs/identity/vault), [personas](https://usenaive.ai/docs/identity/personas), and [MCP tools](https://usenaive.ai/docs/capabilities/tools).

### Dashboard key compatibility check

At the user’s direction, Playwriter opened `dashboard.usenaive.ai` in Dia and created a temporary workspace key named `Assurance temporary vault setup`. Reading the existing coordinator through `api.vetta.sh` with that key returned HTTP 401. The key was revoked immediately; the dashboard displayed REVOKED, and its private local copy was deleted. Existing dashboard keys and the application runtime key were unchanged. The legacy dashboard’s company and key format do not establish access to the configured Managed Agents organization. Vault provisioning uses an admin-scoped credential for that organization.

## Native case actions

`send_email`, `place_call`, `schedule_followup`, `request_human`, and `stop_case` use `backend/case-action-service.ts`. Each call requires its authenticated `case_id`, an existing `authority_id`, an idempotent `operation_id`, rationale, and evidence references. Under legacy grants, contact tools require an exact authorized contact ID and role and accept no arbitrary destinations. Under version-2 permission they take an agent-chosen destination; see [outreach](outreach.md). Email and phone tool names enforce their respective channels. `case_get` returns standing authority and state so the agent can choose a supported next action.

On legacy grants, the service reserves a decision round under the authority row lock and takes a ten-minute lease. Concurrent retries cannot reserve another round or dispatch twice. Changed payloads under an existing operation ID fail. Another active model decision or lease returns a busy error. A retry may return a pending operation; the model must inspect its state rather than claim delivery or create a new operation. The existing policy engine checks revocation, expiry, remaining decisions/outbound actions, contact spacing, known evidence, customer stop messages, and uncertain dispatches. Destination allowlists and provider configuration still apply. These tools do not expand the current own-inbox test grant.

The shared decision engine records results and provider receipts, preserves email threads, and starts reply monitoring after a successful email. Unknown dispatches remain unknown; neither a retry nor a provider switch redials them. A reserved native decision includes `input.native_tool=true` and its immutable decision. The scheduler can finish it after a crash without starting another model. Unbound legacy authorities continue to use per-decision model sessions. The persistent-session worker reuses a bound session for later wakes. See case-sessions.md.

A successful `schedule_followup` schedules reconsideration, not a preapproved future send. `request_human` stops autonomous progress with a specific question. Under version-2 permission, `stop_case(goal_met)` requires a current recorded outcome reference and reports `evidence_reported_not_independently_verified`. Legacy grants return `OUTCOME_NOT_VERIFIED` for `goal_met`. Transcript and saved-source references are included in bounded decision snapshots as well as MCP reads. The tools Function receives server-only outreach credentials and allowlists.

Verification: nine protocol/configuration tests, five native-action database tests, and eleven existing autonomy-runner tests pass. The initial native retry tests exposed JSONB key ordering in operation comparisons; parsing both decisions through the same schema fixed it. Build passes and all six Functions deployed. `scripts/case-actions-live-smoke.ts` verified deployed tool discovery, a human-help transition, identical-operation retry, and rejected sending after authority stopped; zero outbound records were created and the fixture was removed. That smoke test initiated no live email or call. The Naïve MCP session verification is recorded below.


`record_outcome` saves agent-reported amounts and decisions with exact quotes from ready, owner-confirmed document transcriptions or accepted replies. It checks quote presence in those records, not amount arithmetic or whether the quote supports the interpretation. `case_get` includes those reports and current evidence status. This does not establish verified completion or authorize charges. See [outcomes](outcomes.md).

## Managed Agents credential and connector verification — November 7, 2026

Playwriter in Dia found the app signed into the Berkeley Google account’s onboarding company. Signing out of the app and choosing the existing Gmail Google identity reached the correct Managed Agents organization, whose ID matched the existing runtime key. A temporary admin-scoped key successfully read the existing coordinator and provisioned case identities/vaults. The incompatible legacy dashboard is not required. The runtime key and approved budgets were preserved.

The first shared `/mcp` live test failed isolation: one synthetic session requested its own case but received the other test case’s result. Both session credentials were revoked at the database and deleted from their vaults, and the sessions were cancelled. No real case data or external action was involved. The exact provider-internal cause is unconfirmed. Treat this as a failed connector-isolation test, not evidence that a shared endpoint is safe.

The mitigation uses a distinct `/mcp/<case UUID>` URL in both each vault credential and its explicitly pinned agent version. The existing MCP endpoint already checks the URL against the authenticated case. `caseAgentTools(url,caseId)` constructs this binding. The global blueprint now adds case tools only when both `NAIVE_CASE_TOOLS_URL` and explicit `NAIVE_CASE_TOOL_CASE_ID` are set. General review agents should leave the latter unset.

`scripts/case-agent-smoke.ts setup` stores a separate agent version for each fixture in ignored `test-results/case-agent-smoke-isolated-url.json`. Its `poll` mode reads existing sessions only. The previous failed state is retained privately as `case-agent-smoke-shared-url-failure.json`; do not resume those cancelled sessions. Both fresh isolated-URL sessions completed with end_turn, each returned only its own case ID, rejected the cross-case probe with CASE_MISMATCH, and wrote exactly one expected fact to its own Neon row. Naïve’s `read_people` approval gates required explicit approval for synthetic probes/writes despite configured tool permissions. External status requests returned HTTP 429 service capacity and timed out. The signed-in Dia session’s same-origin API completed the known synthetic approvals and verification; no replacement model runs were created.

After verification, all four temporary case credentials were revoked/removed, their vaults deleted, identities detached, and temporary database fixtures deleted. Both temporary admin keys were revoked and the local key file removed. The existing runtime key and standing authorities were unchanged. The general coordinator was restored to version 21 with no case connector; test sessions used pinned versions 19 and 20. Real activations provision and pin their own case URL/version through the setup worker; see [case sessions](case-sessions.md). General reviews remain available.

Three configuration tests and the build passed after the changes. Live verification needed operator approvals for Naïve’s read_people gate; do not describe this integration test as fully unattended operation. Session-reported coordinator costs for the successful isolated pair were 15,167 and 9,939 micro-USD before the final first-session fact-write continuation; no spending caps were increased.


Integration review tightened caseAgentTools further: a bare shared /mcp URL is rejected unless a valid explicit case ID is supplied; an already case-specific URL must match that ID. This prevents a caller from accidentally restoring the connector configuration that failed live isolation. The raw shared server endpoint remains available for direct protocol tests, but is not a valid Managed Agents connector configuration. Three configuration tests and build passed after this tightening.
