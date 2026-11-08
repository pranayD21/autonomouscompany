# Case-scoped agent tools

The expanded autonomy proposal is in [autonomy-plan.md](autonomy-plan.md). This document describes implemented behavior, not the entire proposal.

## Current foundation

`backend/case-tools.ts` serves Streamable HTTP MCP using the official SDK. `backend/case-tools-worker.ts` hosts it as a separate Neon Function. Each endpoint is `/mcp/:caseId`, authenticated with a case bearer credential. Browser Origins are rejected. A missing/invalid credential returns 401; a valid credential for another case returns 403. Tool arguments are checked against the authenticated case as well. The transport is stateless and returns JSON; unsupported GET/DELETE requests return 405.

`backend/case-tool-auth.ts` creates a random 256-bit secret and stores only its SHA-256 hash in `advocacy_case_tool_credentials`. Credentials expire after 24 hours and can be revoked. They remain valid only while their issuing owner owns the case and remains in `CREW_ALLOWED_USER_IDS`. Authenticated, listed owners can mint a credential with POST `/cases/:id/agent-credentials`; the raw token is returned once and must stay private. POST `/cases/:id/agent-credentials/:credentialId/revoke` revokes it. This foundation does not yet provision Naïve vault credentials automatically.

Available tools:

- `case_get`: returns the case, document IDs/hashes, accepted correspondence, outreach history, recorded statements, and valid source references.
- `case_record_fact`: records a statement and an existing case evidence reference. It does not independently verify the statement. A case-scoped operation UUID makes retries idempotent; a retry with changed data fails. A successful new record advances the case revision once.

`backend/case-tool-service.ts` implements database operations. Migration 0013 adds credential and sourced-statement tables. No sending, calling, checkout, outcome, or scheduling tools are exposed yet. The existing bounded own-inbox autonomy grant is unchanged.

## Verification

Four protocol tests pass: missing/wrong authentication, cross-case URL/argument denial, Origin rejection, initialization, discovery, and own-case reads. Two disposable-branch database tests pass: owner-only issuance, hash-only storage, expiry/revocation, concurrent duplicate statement writes, changed-operation rejection, and unknown-source rejection. `npm run build` passes. The SDK is declared directly in package.json rather than relying on a transitive dependency.

Protocol reference: https://modelcontextprotocol.io/specification/2025-11-25/basic/transports

Migration 0013 is applied to production and the tools Function is deployed. A live temporary synthetic case passed initialization, tool discovery, own-case read, duplicate fact retry (one stored row and one revision increment), missing/revoked credential 401, and cross-case credential 403. The fixture and credential were deleted afterward. This verifies the MCP service, not a Naïve tool call or an external communication.
