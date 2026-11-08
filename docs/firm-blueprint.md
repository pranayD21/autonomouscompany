# Permanent company agents

`backend/firm-blueprint.ts` defines six permanent Naïve roles. `naive.config.ts` declares their identities, one shared operating skill, role-specific vaults and MCP endpoints, and three schedules alongside the five original `bill-advocate-*` agents. Existing names remain declared; there are no removal tombstones or new Naïve mail inboxes. The website and backend remain hosted on Vercel and Neon.

| Role | Responsibility | Firm tools |
| --- | --- | --- |
| CEO | Company board, resource allocation, focused delegation | firm_status, list_cases, read_case_summary, set_case_budget, update_board_card, read_playbook, case_costs |
| Front Desk | AgentMail lead intake and case hiring | firm_status, list_cases, read_case_summary, list_email_leads, open_email_lead, hire_advocate, update_board_card, read_playbook |
| Reviewer | Evidence-based independent case review | firm_status, list_cases, read_case_summary, review_case, update_board_card, read_playbook |
| Knowledge | Reusable, de-identified playbook | firm_status, list_cases, read_case_summary, read_playbook, write_playbook, update_board_card |
| Growth | Agentic go-to-market, starting on Reddit (see below) | firm_status, read_playbook, list_growth_leads, record_growth_lead, update_board_card |
| Finance | Costs and hypothetical/test fees; no real charges | firm_status, list_cases, read_case_summary, record_test_fee, case_costs, update_board_card, read_playbook |

Each agent and identity is named `assurance-firm-<role>`. The MCP namespace is `firm`; each agent receives only its role's listed tools, with default deny. The endpoint is `/mcp/<role>` on the Neon firm Function. Each identity has its own static-bearer credential in its own vault. The setup script additionally restricts each sealed credential to its agent. Tokens are never placed in MCP headers or agent configuration.

The CEO is a coordinator with a company board and the other permanent roles as its team. `ASSURANCE_FIRM_WINDOW` selects the provider completion window. The default is `immediate`, because Naïve rejected `loose` for the selected model. CEO, Knowledge and Growth declare UTC schedules of every 15 minutes, every four hours at minute 17, and every six hours at minute 43, respectively. Each cycle inspects existing work and stops if nothing useful remains. Front Desk, Reviewer and Finance are delegated roles rather than periodic inference loops.

## Agentic go-to-market

A Naïve GTM agent found Assurance's first user on Reddit (see [verification](verification.md)). Growth carries that workflow on its six-hour schedule, or when the CEO delegates to it:

1. **Check:** `list_growth_leads` shows what is already saved, so no lead is repeated.
2. **Find:** `data_search`, `data_describe`, and `data_run` read public Reddit posts, and `web_search` and `web_fetch` cover the wider web.
3. **Qualify:** a lead is a real person with a current workplace-injury or health-insurance claim problem, in a community whose rules allow a reply.
4. **Record:** `record_growth_lead` saves the lead by post URL, with its community, reason, and draft reply. Saving it again updates the same record.
5. **Reply:** Growth posts if it has a tool that can, and records `contacted` with a receipt only after posting. Otherwise the lead stays `drafted` and the next step goes on the board.
6. **Learn:** sign-ups are recorded as `signed_up` with evidence, and the next cycle goes to the communities that bring them.

Lead states are `found`, `drafted`, `contacted`, and `signed_up`. Naïve's `social.post` cannot post to Reddit, because its API has no subreddit field, so this declaration does not include it. Growth does not email or call leads, and a lead is not revenue.

## Configuration

- `ASSURANCE_FIRM_TOOLS_URL`: HTTPS origin of the deployed firm Function, optionally ending in `/mcp`.
- `ASSURANCE_FIRM_BUDGET_MICRO_USD`: positive provider bootstrap allocation derived by the operator from available organization credit. Both the declared agent and schedule budget use this value; there is no fixed repository dollar amount. This is not a credit purchase or a case-specific budget. The CEO's server tool owns case allocations.
- `ASSURANCE_FIRM_TOKENS`: private JSON object with `ceo`, `frontdesk`, `reviewer`, `knowledge`, `growth`, and `finance` values of at least 32 characters. Use the same map on the firm Function. Never commit or print it.
- `ASSURANCE_FIRM_MODEL`: optional model, default `openai/gpt-5.4-mini`.
- `ASSURANCE_FIRM_WINDOW`: provider completion window (`immediate`, `priority`, or `loose`).
- `NAIVE_SETUP_API_KEY`: admin-capable setup key; the script falls back to `NAIVE_API_KEY` only when absent. Runtime case credentials never receive this key.

The blueprint vault schema supports `{from_env: name}` but no JSON selectors. `prepareFirmTokenEnvironment()` reads the private token map into six derived environment values in memory. The declaration references those names without including secret values. Keep the token map stable across applies: vault values are write-only, and a config read cannot verify that a sealed value equals a rotated token. Credential rotation needs explicit reconciliation, not blind creation of another credential.

## Setup and verification

Deploy the firm Function and configure its role tokens first. From the repository root:

```sh
npx tsx scripts/configure-assurance-firm.ts
npx tsx scripts/configure-assurance-firm.ts --apply
```

The first command prints a configuration plan and performs no provider writes. The second validates the live OpenAPI route shape, then lists resources before creating or updating them. It provisions identities, skill, agents, exact identity attachments and vault credentials; configures the CEO after the other role IDs exist; and applies schedules last. The three schedules are always declared enabled, so an apply turns on any that are disabled. Deploy the firm Function before applying, so that the approval handling below is live when the first scheduled run fires. If `ASSURANCE_FIRM_REGISTRY` pins role versions, update it to the versions the apply reports and redeploy, so event sessions use the same configuration. Existing resources are matched by name, skill slug, or agent/cron. Ambiguous matches, unexpected vault bindings, and identities shared with another agent stop setup. Remote failures are not automatically replayed. The ignored mode-0600 receipt `test-results/assurance-firm-setup.json` records IDs and versions, never tokens. Subsequent runs reuse matching resources and do not delete omitted resources.

`node --env-file=.env.local node_modules/.bin/naive up --dry-run` can inspect the full declaration; `naive up` applies the declared resources. Read the plan before an apply that includes legacy agents, since retaining a name prevents deletion but does not prevent a declared configuration update. The separate firm setup script touches only permanent firm roles.

The implementation was checked against `GET https://api.vetta.sh/v1/openapi.json` (HTTP 200, API version 2026-09-30), the supplied agency blueprint, and installed `@usenaive-sdk/blueprints` 0.18 types. TypeScript passed. Local declaration evaluation reported eleven agents, six identities, six vaults, one skill, and three schedules; plan mode passed. That check is static. Live company records are in [firm runtime](firm-runtime.md) and the change log.

## Hosted company Function and durable event runner

`backend/firm-worker.ts` exports the Neon Hono Function. It mounts the verified AgentMail ingress at `/agentmail/webhook`, role-scoped MCP at `/mcp/:role`, and `POST /poll`. The poll accepts only a verified Neon schedule named `firm-operations`; it processes queued email attachments through `pollEmailAttachments(pool)` and advances company work through `pollFirmEvents(db)`.

`backend/firm-tools.ts` exposes each role's actual tool schemas. A bearer must match that exact role in private `ASSURANCE_FIRM_TOKENS`; another role's token and browser-origin requests are rejected. The server, not tool arguments, selects the role. `executeFirmTool` still validates role permissions and durable operation IDs. Finance's `record_test_fee` takes an outcome ID, fee rate and reason; the service derives the amount from evidence and may create only an unconfirmed Stripe TEST PaymentIntent, never a paid charge.

`backend/firm-runner.ts` consumes `advocacy_firm_events`. It persists the complete provider session-create request before dispatch and reuses `firm-event:<event UUID>` as the idempotency key after a lost response. The request does not change when current configuration changes. A timestamp-fenced lease prevents competing scheduler workers from claiming the same event. Running events defer their next check, and claims sort by the next eligible time rather than original creation time, so an older long-running event cannot starve queued work. Raw SQL lease timestamps are normalized before applying the timestamp fence. Provider budget pauses and other non-running stops park the existing session for intervention; they never create a replacement session. Each provider session must match the role's configured agent and identity in `ASSURANCE_FIRM_REGISTRY`.

The runner also discovers idle sessions awaiting approval for every permanent role on each invocation, including sessions started by provider schedules, and paginates each role with a durable cursor. Naïve skips a schedule's next fire while its last run waits for approval, so one parked run would stop that schedule. Structurally valid `firm.*` tools in the role's allowlist and the built-ins named in that role's `firmNativeTools` are eligible for automatic confirmation; other built-ins and other roles' tools remain unsupported. Confirmation reserves a durable uncertain operation before dispatch, rechecks the pending turn, and records successful acceptance. Unknown responses never automatically replay; explicit admission rejection makes the exact pending action retryable. Any unresolved confirmation blocks later automatic approvals in that session and is recorded as a company intervention. A provider approval is not proof that a downstream tool or message completed.

Additional worker environment: `DATABASE_URL`, `ASSURANCE_FIRM_ENABLED=true`, `ASSURANCE_FIRM_REGISTRY` (role to `agent_id`, `identity_id`, optional pinned `version`), `NAIVE_SETUP_API_KEY`, and the existing AgentMail/webhook/storage/extraction settings used by the imported services. The worker uses the shared Naïve request-capacity governor. It does not create mailboxes or perform a provider deployment at startup.

Verification commands: `npx tsx --test scripts/firm-tools.test.ts`; run `scripts/firm-runner.test.ts` serially with `OUTREACH_TEST_DATABASE_URL` against a disposable database. These tests use fake provider responses and send no real communications.

The installed blueprint SDK's `AgentDecl` schema does not expose `harness`, although the live agent HTTP schema does. `scripts/configure-assurance-firm.ts --apply` explicitly reconciles `ASSURANCE_FIRM_HARNESS` through that HTTP contract. Do not assume a bare `naive up` preserves this runtime selection with the installed SDK; use the reconciler for the currently verified company configuration.

The setup reconciler waits through definite shared-request admission rejections for a bounded per-request slice. It does not retry network timeouts or uncertain provider mutations. This reduces setup interruptions from the same governor used by live schedulers while preserving the no-blind-replay rule.
