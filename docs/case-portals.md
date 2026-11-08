# Case-isolated native browser portals

Portal submission is in the standard handling scope. The selected runtime tool is Naïve's built-in browser. The `portalAction` proxy holds the owner credential/context handling and durable reservation/receipt logic.

`backend/case-portal.ts` proxies the verified Naïve computer/browser API. Each case gets its own computer, named context, existing advocate identity and exact advocate context grant. A new authority must explicitly contain the standard portal handling scope; older read-only or zero-contact grants are not expanded. The browser is restricted to the selected HTTPS hostname. This does not establish an insurer's permission to access its site.

The module exports `portalOpen`, `portalAction`, `portalStatus`, `portalReconcile`, `portalOwnerConnect` and `portalOwnerReady`. Agent calls carry the existing case-tool identity. Owner connect accepts credentials only on a private owner-authenticated route, forwards them to Naïve's identity credential store, and never saves them in case records or model messages. The returned live-view capability is for the owner only, allowing security challenges and personal attestations. Owner-ready saves context and grants only the case advocate access.

Actions are native navigation, typing, clicking, observation and extraction. Each action reserves a case-bound operation and fingerprint before dispatch. Unknown results remain uncertain and block subsequent operations, including a new operation ID. Reconciliation extracts the current page without submitting or clicking and never clears uncertainty automatically. A browser receipt is evidence of what the browser reported, not independently verified claim acceptance or money saved. Revocation is checked immediately before dispatch; an already dispatched action may finish.

The live OpenAPI at https://api.vetta.sh/v1/openapi.json (API version 2026-09-30, read November 8, 2026) exposes computers, browser actions, identity credentials, saved contexts and context grants. `POST /v1/computers/{id}/browser/actions` accepts `goto`, `click`, `type`, `extract`, `act`, `observe`, `links`, and `screenshot`.

`scripts/fixtures/fictional-claim-portal.ts` supplies a local Hono form and confirmation page for a controlled fictional journey. It is not an insurer, sends no external communications and reports no real outcome. A remote browser can reach it only at an explicit test HTTPS endpoint.

Run `npx tsx --test scripts/case-portal.test.ts` for schema/destination checks. Run `scripts/case-portal-db.test.ts` serially against a disposable `OUTREACH_TEST_DATABASE_URL` for identity, scope, credential handling, idempotency, uncertainty and revocation checks. These tests mock the provider.

The case approval whitelist stays limited to Assurance MCP tools.
