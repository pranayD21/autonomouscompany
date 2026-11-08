# Neon setup and operations

## Linked infrastructure

Explicitly requested project: `calm-dawn-50594047` in organization `org-shy-darkness-62773978`. Branch: `production`, ID `br-square-pine-bewan9j8`. CLI inspection reported project name `naivehackathonproject`, region `aws-us-east-2`, Postgres 18, and Auth enabled.

The requested commands were run:

```sh
npm i -g neon@latest
neon init -y --org-id org-shy-darkness-62773978 --project-id calm-dawn-50594047 --branch production --services postgres,auth,ai-gateway,functions,realtime
neon deploy
```

Init linked the project offline; browser authentication then completed successfully during deploy. The CLI pulled 11 Neon variables into `.env.local`. Never print or commit their values.

A later deployment added the cases API and local Realtime origins:

```sh
neon deploy --env .env.local --update-existing
```

The first attempt required `--update-existing` because Realtime origins changed from an empty list to localhost ports 5173 and 4173. That specific change was inspected before applying it. Do not blindly use this flag for future configuration conflicts.

`neon.ts` declares eight Functions: `cases`, `tools`, `autopoll`, `crewpoll`, `replypoll`, `phone`, `firm`, and `hello`. Their URLs follow the pattern `https://br-square-pine-bewan9j8-<name>.compute.c-9.us-east-2.aws.neon.tech/`.

A deployment alone proves provisioning, not successful authenticated end-to-end operation.

## Configuration

`neon.ts` declares Auth, AI Gateway, Realtime, and the application/monitoring Functions. Existing branches retain their branch settings; newly created non-default branches get a seven-day TTL. No additional project was created.

Local variable names: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`, `NEON_BRANCH_ID`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NEON_FUNCTION_HOST_SUFFIX`, `NEON_AI_GATEWAY_TOKEN`, `NEON_AI_GATEWAY_BASE_URL`, `NEON_REALTIME_URL`, and `NEON_REALTIME_SECRET`.

The cases Function receives a required `REALTIME_SECRET` from the pulled Realtime secret and an `APP_ORIGINS` allowlist. Database, Auth, and gateway environment are supplied by Neon. Vite exposes only the Auth URL, Realtime URL, and derived cases API URL to the browser.

Use pooled Postgres for normal Function traffic and the direct URL for migrations. Keep private service tokens and Realtime sealing secrets server-side.

## Agent tooling

The exact user-requested skill was fetched from https://neon.com/.well-known/agent-skills/neon/SKILL.md and read. `neon skills status --global` reported all seven skills current: neon, neon-postgres, neon-auth, neon-functions, neon-realtime, neon-ai-gateway, and neon-object-storage.

On the setup machine, the CLI installed the Neon plugin for Claude Code/Desktop, Codex, Cursor, and VS Code; it also installed user-level skills and Copilot MCP configuration. Copilot CLI was absent, so its plugin installation used the skills/MCP fallback. The Codex plugin `neon-postgres@plugins-cli` was confirmed enabled, with all seven skills and an MCP server named `neon` at `https://mcp.neon.tech/mcp`.

These are user-level installations available to this project, not portable repository-local installations. No duplicate Codex MCP or skill installation was made. A fresh contributor should inspect their own tooling before installing anything. Installed MCP configuration does not prove its OAuth connection has been exercised; provisioning used the CLI.

## AI Gateway and operational checks

Only the legacy `POST /cases/:id/analyze` route in `backend/api.ts` uses the AI Gateway; case agents run on Naïve, and document reading uses direct OpenAI.

The hosted origins https://assurance.claims and https://assurance-claims.vercel.app are configured in Function CORS, Realtime allowed origins, and Auth trusted domains. For a new frontend domain, merge the exact origin into all three. Preserve existing entries. The local preview command uses `127.0.0.1`, while the allowlists contain `localhost`; test with `http://localhost:4173` or deliberately reconcile the origin mismatch.

`crewpoll` and the `crew-monitor` five-minute trigger save completed Naïve reviews independently of the browser. Its only custom credential is `NAIVE_API_KEY`; database credentials are injected by Neon. Migration 0010 adds durable check/lease fields. The existing `replypoll` Function and its schedule remain separate and receive only the AgentMail credentials. See [review monitoring](crew-monitoring.md) and [reply monitoring](reply-monitoring.md).

Official references: https://neon.com/docs/llms.txt and the installed Neon service-specific skills. Preserve existing provider choices, project linkage, env files, and service settings when continuing setup.

Deployment verification: the CLI can report a completed deployment before requests reach the new Function version. Verify an affected authenticated route after deployment, including permission changes. During the crew review test, the old response persisted briefly; waiting and rechecking the same case avoided duplicate work. Migration 0002 was tested on a temporary branch before production; that temporary branch was then deleted.


## AI Gateway credits

A production catalog check returned HTTP 200, 63 models, zero enabled, and `paid_plan_required`, with recovery URL https://console.neon.tech/app/org-shy-darkness-62773978/billing. Current official guidance says directly card-billed Free organizations can add a card and purchase AI Gateway credits without upgrading. The minimum purchase is $5; new requests stop when balance falls below $2. In Billing, use the AI gateway credits card, add a payment card if needed, then Add credits. The default purchase selection is $25, so explicitly choose $5 for the minimum. No purchase was made.

The earlier sponsor-credit promotion required a paid plan; that promotion flow is distinct from purchasing gateway credits on Free. Naïve credits do not fund Neon. If Billing still requires an upgrade or models remain locked after purchase, inspect the model restriction tooltip: marketplace billing, account verification, or another restriction can require a different remedy. See https://neon.com/docs/ai-gateway/prepaid-credits and https://neon.com/docs/ai-gateway/troubleshooting.

## Company Function configuration

`neon.ts` declares the `firm` Function and `firm-operations` minute trigger. It hosts role MCP tools and the AgentMail webhook, then advances durable company sessions and inbound attachment extraction. The private environment sets `ASSURANCE_FIRM_ENABLED=true`. `ASSURANCE_FIRM_SCHEDULES_ENABLED=false` keeps the recurring CEO, Growth, and Knowledge schedules disabled. Deploy migrations and backend before publishing a dependent frontend. The cases Function also receives public AgentMail contact settings and the read-only Gmail auth-config ID; tokens stay server-only. See [company runtime](firm-runtime.md) for the full configuration.

`PHONE_ONBOARDING_ENABLED` is passed to both cases and phone; phone also receives `ASSURANCE_CASE_ENGINE`, `NAIVE_CASE_PROVISIONING_ENABLED`, `ASSURANCE_FIRM_ENABLED`, and `OUTREACH_VOICE_PROVIDER`. Its minute trigger reconciles call receipts independently of `PHONE_FLOW_ENABLED=false`. Migration 0030 is applied to production (31 journal entries).
