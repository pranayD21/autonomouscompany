# Case-isolated native browser portals

Portal submission is in the standard handling scope. `backend/case-portal.ts` implements service functions for Naïve's built-in browser, with owner credential/context handling and durable reservation/receipt logic. In this checkout, these functions are exercised by mocked-provider tests; they are not connected to owner API routes, case MCP tools, or the customer UI. Their service-level behavior is distinct from a reachable customer portal workflow.

The service targets the Naïve computer/browser API described in the dated API check below. When invoked, it creates a case-specific computer, named context, existing advocate identity and exact advocate context grant. A new authority must explicitly contain the standard portal handling scope; older read-only or zero-contact grants are not expanded. The browser is restricted to the selected HTTPS hostname. This does not establish an insurer's permission to access its site.

The module exports `portalOpen`, `portalAction`, `portalStatus`, `portalReconcile`, `portalOwnerConnect` and `portalOwnerReady`. Service functions check case ownership and bound authority. `portalOwnerConnect` accepts credentials as function arguments, forwards them to Naïve's identity credential store, and never saves them in case records or model messages; no owner-authenticated HTTP route exposes this function in the current application. Its returned live-view capability is intended for the owner, allowing security challenges and personal attestations. Owner-ready saves context and grants only the case advocate access.

The service action schema accepts `goto`, `type`, `click`, `observe`, and `extract`. Each action reserves a case-bound operation and fingerprint before dispatch. Unknown results remain uncertain and block subsequent operations, including a new operation ID. Reconciliation extracts the current page without submitting or clicking and never clears uncertainty automatically. A browser receipt is evidence of what the browser reported, not independently verified claim acceptance or money saved. Revocation is checked immediately before dispatch; an already dispatched action may finish.

The live OpenAPI at https://api.vetta.sh/v1/openapi.json (API version 2026-09-30, read November 8, 2026) exposes computers, browser actions, identity credentials, saved contexts and context grants. `POST /v1/computers/{id}/browser/actions` accepts `goto`, `click`, `type`, `extract`, `act`, `observe`, `links`, and `screenshot`.

`scripts/fixtures/fictional-claim-portal.ts` supplies a local Hono form and confirmation page for a controlled fictional journey. It is not an insurer, sends no external communications and reports no real outcome. A remote browser can reach it only at an explicit test HTTPS endpoint.

Run `npx tsx --test scripts/case-portal.test.ts` for schema/destination checks. Run `scripts/case-portal-db.test.ts` serially against a disposable `OUTREACH_TEST_DATABASE_URL` for identity, scope, credential handling, idempotency, uncertainty and revocation checks. These tests mock the provider.

The case approval whitelist stays limited to Assurance MCP tools.
