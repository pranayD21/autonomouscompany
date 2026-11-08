# Case-scoped agent tools

The expanded autonomy proposal is in [autonomy-plan.md](autonomy-plan.md). This document describes implemented behavior, not the entire proposal.

## Current foundation

`backend/case-tools.ts` serves Streamable HTTP MCP using the official SDK. `backend/case-tools-worker.ts` hosts it as a separate Neon Function. The shared endpoint `/mcp` derives its case from the bearer credential. `/mcp/:caseId` remains available and additionally checks the URL case against that credential. Browser Origins are rejected. A missing/invalid credential returns 401; a valid credential for another case returns 403. Tool arguments are checked against the authenticated case as well. The transport is stateless and returns JSON; unsupported GET/DELETE requests return 405.

`backend/case-tool-auth.ts` creates a random 256-bit secret and stores only its SHA-256 hash in `advocacy_case_tool_credentials`. Credentials expire after 24 hours and can be revoked. They remain valid only while their issuing owner owns the case and remains in `CREW_ALLOWED_USER_IDS`. Authenticated, listed owners can mint a credential with POST `/cases/:id/agent-credentials`; the raw token is returned once and must stay private. POST `/cases/:id/agent-credentials/:credentialId/revoke` revokes it. This foundation does not yet provision Naïve vault credentials automatically.

Available tools:

- `case_get`: returns the case, document IDs/hashes, accepted correspondence, outreach history, recorded statements, completed-call transcript snapshots, and valid source references.
- `cite_source`: retrieves a chosen public source, verifies a short exact quote, and saves a case-linked snapshot. See research.md for network restrictions and provenance limits.
- `case_record_fact`: records a statement and an existing case evidence reference. It does not independently verify the statement. A case-scoped operation UUID makes retries idempotent; a retry with changed data fails. A successful new record advances the case revision once.

`backend/case-tool-service.ts` implements database operations. Migration 0013 adds credential and sourced-statement tables. Sending, calling, follow-up scheduling, human-help, and stop tools now use existing standing-authority checks. Checkout and outcome tools are not implemented yet. The existing bounded own-inbox autonomy grant is unchanged.

## Verification

Four protocol tests pass: missing/wrong authentication, cross-case URL/argument denial, Origin rejection, initialization, discovery, and own-case reads. Two disposable-branch database tests pass: owner-only issuance, hash-only storage, expiry/revocation, concurrent duplicate statement writes, changed-operation rejection, and unknown-source rejection. `npm run build` passes. The SDK is declared directly in package.json rather than relying on a transitive dependency.

Protocol reference: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports

Migration 0013 is applied to production and the tools Function is deployed. A live temporary synthetic case passed initialization, tool discovery, own-case read, duplicate fact retry (one stored row and one revision increment), missing/revoked credential 401, and cross-case credential 403. The fixture and credential were deleted afterward. This verifies the MCP service, not a Naïve tool call or an external communication.

## Coordinator delegation

The local Naïve blueprint now lets the coordinator choose which specialists to consult, including none for a routine follow-up, wait, or stop. The bounded decision prompt follows the same policy. Requested specialist results must still arrive before submission. These changes preserve all existing spending and communication limits. The bounded decision prompt is deployed to the worker; the blueprint is not yet published to Naïve.

The installed SDK attaches MCP servers to agent versions, not individual session-create requests. Session creation accepts an explicit agent version. The case-tool connection still needs a provisioning design that keeps simultaneous cases isolated and credentials in the Naïve vault; no live Naïve MCP call has been verified.

## Naïve session connection (prepared, not live-verified)

`backend/providers/case-agent.ts` defines the MCP tool configuration and session inputs. Each session selects an explicit Naïve identity and agent version, with a task budget no larger than the existing $0.25 cap. A case identity owns a vault containing its case bearer token. The coordinator declares the shared `/mcp` URL; Naïve injects the identity's credential at the network boundary. The token is never included in prompts or inline agent headers. The prepared configuration enables case reads, sourced facts, citations, the five bounded action tools described below, and Naïve web search/fetch. The existing coordinator retains its $2 monthly cap; no new agent budget is created.

Set `NAIVE_CASE_TOOLS_URL` to the tools Function's `/mcp` URL. The blueprint adds these tools only when that variable is set. `scripts/case-agent-smoke.ts setup` provisions two synthetic case identities/vaults and starts two version-pinned sessions, each instructed to read its own case, verify the other case is denied, and record one sourced statement. `poll` observes the saved sessions without creating new ones. Local state and event logs live in ignored `test-results/` files. The setup script can read a temporary admin-scoped key from `NAIVE_SETUP_KEY_FILE`; it changes the key only inside its process, not in the app environment.

Current setup stopped at vault creation with HTTP 403, `missing admin scope`. One synthetic case and attached identity were created; the saved state permits resumption. No vault credential or model session was created. The private key request timed out, and the current browser login showed a different onboarding company rather than the configured Assurance organization. Do not claim identity-specific credential injection works until the two live sessions and their database writes have been inspected. The general case-session API and automatic lifecycle/rotation are not implemented yet.

Verification: seven local tests pass, covering transport authentication, shared-URL cross-case isolation, explicit session identity/version, budget bounds, and rejection of secret-bearing endpoint URLs. Build passes. The shared `/mcp` route is deployed. The first route-array implementation failed because Hono requires separate route registrations; it was corrected before deployment. Naïve documentation: [credential vault](https://usenaive.ai/docs/identity/vault), [personas](https://usenaive.ai/docs/identity/personas), and [MCP tools](https://usenaive.ai/docs/capabilities/tools).

### Dashboard key compatibility check

At the user’s direction, Playwriter opened `dashboard.usenaive.ai` in Dia and created a temporary workspace key named `Assurance temporary vault setup`. Reading the existing coordinator through `api.vetta.sh` with that key returned HTTP 401. The key was revoked immediately; the dashboard displayed REVOKED, and its private local copy was deleted. Existing dashboard keys and the application runtime key were unchanged. The legacy dashboard’s company and key format do not establish access to the configured Managed Agents organization. Vault provisioning still needs an admin-scoped credential for that organization.

## Native case actions

`send_email`, `place_call`, `schedule_followup`, `request_human`, and `stop_case` use `backend/case-action-service.ts`. Each call requires its authenticated `case_id`, an existing `authority_id`, an idempotent `operation_id`, rationale, and evidence references. Contact tools require an exact authorized contact ID and role; they do not accept arbitrary destinations. Email and phone tool names enforce their respective channels. `case_get` returns standing authority, limits, counters, and state so the agent can choose a supported next action.

The service reserves a decision round under the authority row lock and takes a ten-minute lease. Concurrent retries cannot reserve another round or dispatch twice. Changed payloads under an existing operation ID fail. Another active model decision or lease returns a busy error. A retry may return a pending operation; the model must inspect its state rather than claim delivery or create a new operation. The existing policy engine checks revocation, expiry, remaining decisions/outbound actions, contact spacing, known evidence, customer stop messages, and uncertain dispatches. Destination allowlists and provider configuration still apply. These tools do not expand the current own-inbox test grant.

The shared decision engine records results and provider receipts, preserves email threads, and starts reply monitoring after a successful email. Unknown dispatches remain unknown; neither a retry nor a provider switch redials them. A reserved native decision includes `input.native_tool=true` and its immutable decision. The scheduler can finish it after a crash without starting another model. Unbound authorities continue to use per-decision model sessions. The prepared persistent-session worker reuses a bound session for later wakes; activation and live verification remain unfinished. See case-sessions.md.

A successful `schedule_followup` schedules reconsideration, not a preapproved future send. `request_human` stops autonomous progress with a specific question. `stop_case` cannot claim goal success without verified outcomes; that evidence path remains unimplemented. Transcript and saved-source references are now included in bounded decision snapshots as well as MCP reads. The tools Function receives server-only outreach credentials and allowlists, while the prepared agent permissions remain unpublished pending vault setup.

Verification: nine protocol/configuration tests, five native-action database tests, and eleven existing autonomy-runner tests pass. The initial native retry tests exposed JSONB key ordering in operation comparisons; parsing both decisions through the same schema fixed it. Build passes and all six Functions deployed. `scripts/case-actions-live-smoke.ts` verified deployed tool discovery, a human-help transition, identical-operation retry, and rejected sending after authority stopped; zero outbound records were created and the fixture was removed. No live email/call was initiated through these tools, and no Naïve MCP session has yet been verified.
