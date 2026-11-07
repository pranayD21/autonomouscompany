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

Deployed Functions:

- `hello`: https://br-square-pine-bewan9j8-hello.compute.c-9.us-east-2.aws.neon.tech/
- `cases`: https://br-square-pine-bewan9j8-cases.compute.c-9.us-east-2.aws.neon.tech/

Deployment proves provisioning, not successful authenticated end-to-end operation.

## Configuration

`neon.ts` declares Auth, AI Gateway, Realtime, and the two Functions. Existing branches retain their branch settings; newly created non-default branches get a seven-day TTL. No additional project was created.

Local variable names: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `NEON_BRANCH`, `NEON_BRANCH_ID`, `NEON_AUTH_BASE_URL`, `NEON_AUTH_JWKS_URL`, `NEON_FUNCTION_HOST_SUFFIX`, `NEON_AI_GATEWAY_TOKEN`, `NEON_AI_GATEWAY_BASE_URL`, `NEON_REALTIME_URL`, and `NEON_REALTIME_SECRET`.

The cases Function receives a required `REALTIME_SECRET` from the pulled Realtime secret and an `APP_ORIGINS` allowlist. Database, Auth, and gateway environment are supplied by Neon. Vite exposes only the Auth URL, Realtime URL, and derived cases API URL to the browser.

Use pooled Postgres for normal Function traffic and the direct URL for migrations. Keep private service tokens and Realtime sealing secrets server-side.

## Agent tooling

The exact user-requested skill was fetched from https://neon.com/.well-known/agent-skills/neon/SKILL.md and read. `neon skills status --global` reported all seven skills current: neon, neon-postgres, neon-auth, neon-functions, neon-realtime, neon-ai-gateway, and neon-object-storage.

On the setup machine, the CLI installed the Neon plugin for Claude Code/Desktop, Codex, Cursor, and VS Code; it also installed user-level skills and Copilot MCP configuration. Copilot CLI was absent, so its plugin installation used the skills/MCP fallback. The Codex plugin `neon-postgres@plugins-cli` was confirmed enabled, with all seven skills and an MCP server named `neon` at `https://mcp.neon.tech/mcp`.

These are user-level installations available to this project, not portable repository-local installations. No duplicate Codex MCP or skill installation was made. A fresh contributor should inspect their own tooling before installing anything. Installed MCP configuration does not prove its OAuth connection has been exercised; provisioning used the CLI.

## Blocker and operational checks

AI Gateway reported that no models were available until the organization adds a card and buys gateway credits. Billing: https://console.neon.tech/app/org-shy-darkness-62773978/billing. No credits were purchased by the agent. Successful inference remains unverified.

Before frontend deployment, merge the actual frontend origin into Function CORS, Realtime allowed origins, and Auth trusted domains. Preserve existing entries. The local preview command uses `127.0.0.1`, while the allowlists contain `localhost`; test with `http://localhost:4173` or deliberately reconcile the origin mismatch.

Official references: https://neon.com/docs/llms.txt and the installed Neon service-specific skills. Preserve existing provider choices, project linkage, env files, and service settings when continuing setup.
