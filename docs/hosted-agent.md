# Hosted direct-model case agent

The current proof-of-concept path uses direct OpenAI inference. Naïve retains legacy sessions and historical planning context; it does not execute direct-model decisions. See [activation-flow.md](activation-flow.md) for owner controls and [outreach.md](outreach.md) for communications.

## Runtime and storage

`backend/direct-case-runner.ts` registers one durable run per permission, stores the model conversation and tool intents in `advocacy_direct_case_runs`, and consumes incoming observations from `advocacy_direct_case_events`. Migration 0023 binds credentials to permissions; 0024 adds the run/event tables and permits non-expiring v2 credentials. Revocation still invalidates those credentials.

The runner reads the current case and sets a stable goal/finish condition. It uses the actual case MCP services in-process, with case/owner/permission binding checked before tools. It persists an intent before dispatch and records receipts. An ambiguous communication stops automatic work and is never silently replayed. Known read-only tools can retry after interruption. The model-supplied operation UUID is preserved across distinct tool calls so an identical retry cannot become a new send. A fenced lease prevents concurrent scheduler ticks from acting on the same run. A Function time slice yields unfinished work; it is not a total case-work allowance.

`backend/autonomy-worker.ts` polls direct runs before legacy jobs on a one-minute scheduler tick. It claims at most one direct run per tick; idle cases do no inference. Legacy decision, session, and setup paths exclude direct authorities. `backend/case-agent-events.ts` routes owner edits, ready uploads, confirmed transcriptions, replies, and completed calls to the direct event queue. Agent-written facts change the case revision but do not queue their own wake event. Idle runs do no inference until evidence, an event, or a due follow-up arrives. Owner-help states resume through an owner response, an owner-triggered completed document reading, or the explicit resume control; third-party text cannot resume permission. Completed outcomes retain their reported/simulated status.

`read_public_source` retrieves actual public HTTPS text/PDFs and navigable links with DNS/IP, redirect, size, and timeout protection. `cite_source` checks an exact quotation and retains its source. This is source retrieval/navigation, not a search-engine integration. Private case details must never be placed in a URL. See [research.md](research.md).

## Deployment configuration

The autopoll Function needs server-only `OPENAI_API_KEY` and `ASSURANCE_DIRECT_MODEL` (default `gpt-5.4-mini`). Cases uses `ASSURANCE_DIRECT_ACTIVATION_ENABLED=true` only once the worker is configured. Cases also receives `OPENAI_API_KEY` for direct document reading with `ASSURANCE_DOCUMENT_READER=direct_openai`; that key is never part of Vite configuration. The same key shortens long case titles (over 40 characters) at submission through `backend/case-title.ts`, using `ASSURANCE_TITLE_MODEL` (default `gpt-5.4-nano`) with a 6-second timeout; any failure or missing key keeps the original title. Completed readings are available as machine-extracted, unverified observations without mandatory confirmation. Owner confirmation remains separate provenance; final-outcome evidence requirements remain enforced.

Deploy migrations and Neon Functions before publishing the frontend. Preserve existing private provider settings with `neon deploy --env .env.local --branch production --no-env-pull`. Git pushes deploy only the Vercel frontend. `PHONE_FLOW_ENABLED` remains false while carrier registration is pending. New voice calls use AgentPhone only. Payments remain hypothetical.

## Verification

Run database suites serially against the disposable `OUTREACH_TEST_DATABASE_URL`. `scripts/direct-case-runner.test.ts`, `scripts/direct-activation.test.ts`, `scripts/open-case-actions.test.ts`, and `scripts/hosted-workflow.test.ts` cover activation, isolation, persisted goals/conversations, leases, resume/revoke, provider errors, send-once handling, threaded replies, and a documented simulated outcome. The workflow test uses a scripted model and fake communication transports through actual MCP/service/database paths; it is not evidence of delivered email or a real payout.

`scripts/hosted-direct-smoke.ts` separately observes the real deployed scheduler and model using fictional owner accounts. Its zero-contact fixture verifies resume/stop; its one-email fixture is restricted to the explicitly consented test recipient. Private fixtures remain under ignored `test-results/`. Check [implementation-status.md](implementation-status.md) for the latest deployed evidence, rather than treating a build or unit-test result as hosted verification.

## New-case Naïve selection

`ASSURANCE_CASE_ENGINE=naive` restores Naïve for newly authorized v2 cases once provisioning is enabled. Existing direct runs continue to use this runner and retain their conversations. The direct adapter excludes the hosted MCP `set_goal` tool because direct runs already persist their own fenced goal tool. See [Naïve restoration](naive-restoration.md) for lifecycle and verification details. Document extraction remains on its working direct reader; changing case coordination does not switch that provider.
