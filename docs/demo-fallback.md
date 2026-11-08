# Direct-model demo fallback

The user requested minimal Naïve usage for the demo after repeated provider capacity errors. `scripts/demo/` provides a separate local runner that executes real Assurance MCP tools through a direct OpenAI model. It does not change the persistent-workflow migration or switch production cases automatically. Its console identifies the engine as the direct-model fallback; do not present these decisions as live Naïve execution.

## Naïve's role

Before the demo, a prepared case can have a genuine Naïve planning turn. `scripts/demo/capture-naive.ts` reads the existing operator-owned session's events once through the shared capacity governor and caches completed assistant messages privately. It creates no session and has no polling or retry loop. If Naïve is overloaded, that command fails; a previously captured handoff can still be used. The fallback reads the current case again because the cached handoff is historical context, not fresh evidence or permission.

The direct runner makes zero Naïve runtime requests. It maintains conversation history in a private local state file and wakes when the operator supplies a new event. It does not continuously poll a model while idle. It uses OpenAI Chat Completions function calling, following the [official API guide](https://developers.openai.com/api/docs/guides/function-calling).

## Configuration and execution

Supply credentials privately, never in command arguments or Git:

- `DEMO_OPENAI_KEY_FILE`: file containing the direct OpenAI API key; alternatively server-side `OPENAI_API_KEY`.
- `DEMO_CASE_TOKEN_FILE`: private file containing the existing case-scoped MCP credential.
- `DEMO_CASE_ID`: the operator-owned case UUID.
- `DEMO_MODEL`: direct model, default `gpt-5.4-mini`.
- Existing `DATABASE_URL`, `CREW_ALLOWED_USER_IDS`, and `NAIVE_CASE_TOOLS_URL` come from the private project environment.

Optional planning handoff: `npx tsx scripts/demo/capture-naive.ts`.

For an isolated no-outreach demo fixture, run `npx tsx scripts/demo/prepare.ts`; it prints the case-specific command. It creates no Naïve session or communication permission. `npx tsx scripts/demo/prepare.ts cleanup` removes only its own fixture and refuses deletion if outreach receipts exist.

First turn: `npx tsx scripts/demo/run.ts`.

Subsequent turn: `npx tsx scripts/demo/run.ts 'New fictional evidence arrived; read the current case.'`.

The runner uses the existing deployed tools and their real authorization, evidence, and dispatch checks. This does not authorize SMS registration, SMS tests, extra recipients, financial transactions, or production data access. For a synthetic demonstration, prepare a synthetic case and its explicit communication permission separately.

## Exclusive handoff and recovery

Before model execution and each tool call, the runner rejects cases with a runnable Naïve session, queued setup, runnable legacy authority, or unfinished dispatch. Prepare an exclusive case handoff before demo time; do not run two engines against one case. These checks are not a production distributed engine-switch protocol, and the local runner is not deployed as an automatic failover service. Remote cancellation must be confirmed before marking a provider session stopped. The runner never performs that cancellation or changes standing permissions itself.

Conversation and tool intent are saved under ignored `test-results/demo-<caseId>.json`. A local exclusive lock prevents two copies on this machine. An interrupted tool dispatch remains marked started and refuses replay on restart. Reconcile the provider/server receipt before changing that state. A stale lock after process death also requires operator inspection; never remove it while its process is running. State files contain case information and must remain private.

## Verification and readiness

Four tests passed: persisted tool receipts, uncertain-dispatch replay prevention, cross-case rejection, and direct-model rate-limit propagation. TypeScript compilation passed. Live direct OpenAI inference passed. Two real model turns used the deployed MCP endpoint: read a synthetic case, persist exactly one sourced fact, then resume the conversation and read revision 2 with that fact still present. Database verification confirmed one fact and zero outbound actions. The fixture and its raw token were deleted. The model key is retained only in the private local environment. Live outreach, automatic hosted failover, and a fresh Naïve planning handoff were not tested.
