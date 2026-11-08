# Naïve capacity and reduced-load operation

Naïve remains the case coordinator. The backend stores evidence, checks standing authority, watches replies/call receipts, and waits for timers without asking a model to perform those tasks. A persistent case reuses its existing Naïve session and budget. It wakes for new evidence or a due follow-up rather than creating a fresh agent for every scheduler tick.

## Shared admission control

`backend/providers/naive-capacity.ts` wraps the SDK transport in `backend/providers/naive.ts`. With `DATABASE_URL`, all API and scheduler instances use the singleton `advocacy_naive_capacity` row defined in `backend/schema.ts` and migration `0018_outgoing_ares.sql`.

Only one application HTTP request to Naïve can hold the lease at a time. Successful requests are spaced by one second. A lease expires after 35 seconds; the HTTP timeout is 25 seconds. PostgreSQL atomically acquires leases, so separate Functions share the same limit. Short spacing waits are bounded; longer waits throw `NAIVE_DEFERRED` before making a provider request. Existing durable workers defer and reuse their saved session/event identities on a later tick. Interactive requests can require the user to retry; this transport does not create a separate durable queue for browser requests.

HTTP 429, HTTP 503, and uncertain network failures open a shared cooldown: 30 seconds, 60 seconds, then exponential growth capped at 15 minutes. A longer valid `Retry-After` is respected. Success resets the consecutive-failure count. The row contains status and request ID only, never API keys, case records, or response bodies. Only the current lease owner can release it. A database failure fails closed.

No HTTP request is automatically replayed here. In particular, a POST timeout does not start another session or resend an external contact. Existing session/event idempotency keys and outreach reconciliation remain authoritative. A transport lease limits HTTP traffic; it does not cap already-running remote agents or model-level specialist concurrency. Standalone scripts without `DATABASE_URL` retain the SDK timeout but do not participate in the shared gate; use the configured runtime for operational checks.

`backend/case-agent-session.ts` checks authority and credential validity first, then skips remote status reads for an already-idle session with no pending evidence event or due timer. Running sessions still need periodic status checks. Revocation still takes precedence over the idle optimization.

## Verification and rollout

Run `npx tsx --test scripts/naive-capacity.test.ts scripts/general-agent-version.test.ts`. On a disposable database branch, set `OUTREACH_TEST_DATABASE_URL` and run `scripts/naive-capacity-db.test.ts` and `scripts/case-agent-session.test.ts` with `tsx --test --test-concurrency=1`. Database tests exercise concurrent independent workers, Retry-After, stale lease owners, exponential cooldown, recovery, and idle evidence/timer wakes. They use mocked HTTP and place no calls or emails.

Verification completed: six transport/configuration tests and fifteen disposable-database regressions passed; build passed. Migration 0018 was applied to production and all six Functions deployed. One read-only live coordinator GET through the shared transport returned HTTP 200, released the lease, reset failures to zero, and recorded success spacing. No new agent sessions, calls, or emails were created. This checks the transport against production Postgres; it is not a full case rehearsal or proof that Naïve can never return another 429.

Apply migrations before deploying the shared transport. `DATABASE_URL` is injected by Neon Functions; there are no new secret variables, spending caps, grants, or voice-provider changes.

## Capacity escalation

Previous synthetic tests observed HTTP 429 on session status reads and timeouts; a later persistent start/wake test succeeded. These observations do not establish an exhausted credit balance or identify whether the restriction is organization-specific or shared infrastructure. The user reports $250 in credits. Ask Naïve to confirm the applicable API rate and concurrent-session limits and whether there is a current service incident. Include organization ID and sanitized request IDs/timestamps when available. Never include keys, tokens, case content, or participant information.

The user cancelled the external report. No report was sent. Continue the local reduced-load implementation without contacting Naïve.

Case-binding preflight performs its version, identity, and attachment reads sequentially. Concurrent preflight reads would contend for the singleton lease and could repeatedly defer startup. A regression test rejects overlapping reads and confirms the complete binding still validates.

## Short request contention

The shared lease still permits only one provider request at a time. When another request holds that lease, a caller now rechecks after one second within the existing four-retry admission window. It does not assume the lease's 35-second crash timeout is a provider cooldown. Actual `next_allowed_at` cooldowns, Retry-After, request timeouts, and no-replay behavior remain unchanged. This prevents simultaneous scheduler ticks from repeatedly deferring otherwise healthy short requests.

Deferred-work status refers to the shared Naïve request queue. A local occupied lease is not evidence that Naïve returned HTTP 429; live rejection claims require a provider response.
