# Case-scoped agent tools

The expanded autonomy proposal is in [autonomy-plan.md](autonomy-plan.md). This document describes implemented behavior, not the entire proposal.

## Current foundation

`backend/case-tools.ts` serves Streamable HTTP MCP using the official SDK. `backend/case-tools-worker.ts` hosts it as a separate Neon Function. The shared endpoint `/mcp` derives its case from the bearer credential. `/mcp/:caseId` remains available and additionally checks the URL case against that credential. Browser Origins are rejected. A missing/invalid credential returns 401; a valid credential for another case returns 403. Tool arguments are checked against the authenticated case as well. The transport is stateless and returns JSON; unsupported GET/DELETE requests return 405.

`backend/case-tool-auth.ts` creates a random 256-bit secret and stores only its SHA-256 hash in `advocacy_case_tool_credentials`. Credentials expire after 24 hours and can be revoked. They remain valid only while their issuing owner owns the case and remains in `CREW_ALLOWED_USER_IDS`. Authenticated, listed owners can mint a credential with POST `/cases/:id/agent-credentials`; the raw token is returned once and must stay private. POST `/cases/:id/agent-credentials/:credentialId/revoke` revokes it. This foundation does not yet provision Naïve vault credentials automatically.

Available tools:

- `case_get`: returns the case, document IDs/hashes, accepted correspondence, outreach history, recorded statements, and valid source references.
- `case_record_fact`: records a statement and an existing case evidence reference. It does not independently verify the statement. A case-scoped operation UUID makes retries idempotent; a retry with changed data fails. A successful new record advances the case revision once.

`backend/case-tool-service.ts` implements database operations. Migration 0013 adds credential and sourced-statement tables. No sending, calling, checkout, outcome, or scheduling tools are exposed yet. The existing bounded own-inbox autonomy grant is unchanged.

## Verification

Four protocol tests pass: missing/wrong authentication, cross-case URL/argument denial, Origin rejection, initialization, discovery, and own-case reads. Two disposable-branch database tests pass: owner-only issuance, hash-only storage, expiry/revocation, concurrent duplicate statement writes, changed-operation rejection, and unknown-source rejection. `npm run build` passes. The SDK is declared directly in package.json rather than relying on a transitive dependency.

Protocol reference: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports

Migration 0013 is applied to production and the tools Function is deployed. A live temporary synthetic case passed initialization, tool discovery, own-case read, duplicate fact retry (one stored row and one revision increment), missing/revoked credential 401, and cross-case credential 403. The fixture and credential were deleted afterward. This verifies the MCP service, not a Naïve tool call or an external communication.

## Coordinator delegation

The local Naïve blueprint now lets the coordinator choose which specialists to consult, including none for a routine follow-up, wait, or stop. The bounded decision prompt follows the same policy. Requested specialist results must still arrive before submission. These changes preserve all existing spending and communication limits. The bounded decision prompt is deployed to the worker; the blueprint is not yet published to Naïve.

The installed SDK attaches MCP servers to agent versions, not individual session-create requests. Session creation accepts an explicit agent version. The case-tool connection still needs a provisioning design that keeps simultaneous cases isolated and credentials in the Naïve vault; no live Naïve MCP call has been verified.

## Naïve session connection (prepared, not live-verified)

`backend/providers/case-agent.ts` defines the MCP tool configuration and session inputs. Each session selects an explicit Naïve identity and agent version, with a task budget no larger than the existing $0.25 cap. A case identity owns a vault containing its case bearer token. The coordinator declares the shared `/mcp` URL; Naïve injects the identity's credential at the network boundary. The token is never included in prompts or inline agent headers. Only `assurance.case_get` and `assurance.case_record_fact` are enabled from this server. The existing coordinator retains its $2 monthly cap; no new agent budget is created.

Set `NAIVE_CASE_TOOLS_URL` to the tools Function's `/mcp` URL. The blueprint adds these tools only when that variable is set. `scripts/case-agent-smoke.ts setup` provisions two synthetic case identities/vaults and starts two version-pinned sessions, each instructed to read its own case, verify the other case is denied, and record one sourced statement. `poll` observes the saved sessions without creating new ones. Local state and event logs live in ignored `test-results/` files. The setup script can read a temporary admin-scoped key from `NAIVE_SETUP_KEY_FILE`; it changes the key only inside its process, not in the app environment.

Current setup stopped at vault creation with HTTP 403, `missing admin scope`. One synthetic case and attached identity were created; the saved state permits resumption. No vault credential or model session was created. The private key request timed out, and the current browser login showed a different onboarding company rather than the configured Assurance organization. Do not claim identity-specific credential injection works until the two live sessions and their database writes have been inspected. The general case-session API and automatic lifecycle/rotation are not implemented yet.

Verification: seven local tests pass, covering transport authentication, shared-URL cross-case isolation, explicit session identity/version, budget bounds, and rejection of secret-bearing endpoint URLs. Build passes. The shared `/mcp` route is deployed. The first route-array implementation failed because Hono requires separate route registrations; it was corrected before deployment. Naïve documentation: [credential vault](https://usenaive.ai/docs/identity/vault), [personas](https://usenaive.ai/docs/identity/personas), and [MCP tools](https://usenaive.ai/docs/capabilities/tools).
