# Implementation status and next steps

Status captured November 7, 2026. This separates verified work from plans and incomplete work.

## Verified during this session

- Neon CLI installed successfully.
- Requested project and production branch linked; browser authentication completed.
- Postgres, Auth, Functions, AI Gateway credentials, and Realtime provisioned/configured.
- Drizzle generated and applied the `advocacy_cases` migration successfully.
- `npm run build` passed after correcting the installed Auth SDK integration to read `session.data.session.token`; `auth.token()` was not available on that client.
- The last successful build reported 261 transformed modules and `built in 324ms`.
- Functions `hello` and `cases` deployed successfully.
- `npm start` launched Vite preview and printed `Local: http://127.0.0.1:4173/`.
- Neon skills and the enabled Codex plugin's MCP configuration were inspected.

## Not verified or not implemented

No complete end-to-end test suite ran. Sign-up/sign-in/sign-out, persistence across reload, JWT acceptance by the deployed Function, owner isolation, database writes through the UI, live updates, and AI inference must still be exercised. The `test:e2e` script points to `scripts/e2e.ts`, which had not been created at handoff. Do not report it as a working test command.

AI inference is blocked by missing gateway credits. A build warning reported a frontend JavaScript chunk above 500 kB. npm audit reported four moderate vulnerabilities in the Drizzle Kit/esbuild dependency chain. No force upgrade was applied. Migrations printed an SSL-mode compatibility warning; the API pool explicitly requests verify-full, but migration configuration had not been adjusted.

The local application scaffold was untracked when this documentation commit was prepared. Only original README/icon and this context documentation are published by this commit. Infrastructure is already deployed independently of that Git status. Another clone will need a later implementation commit before it can run the prototype.

The user's statement that the team has a working product may refer to work outside this workspace. Ask for or inspect that implementation before duplicating it or making readiness claims.

## Next engineering work

1. Reconcile the local scaffold with the team's actual product and publish the intended implementation separately.
2. Add and run meaningful end-to-end tests for all requested Neon services, including unauthorized requests, a second user's access, mutation persistence, and live updates across two sessions.
3. Resolve origin configuration for local and hosted frontends; do not weaken authentication to make a test pass.
4. Enable gateway credits through the owner and verify a real inference request; preserve an honest unavailable state until then.
5. Add Naïve orchestration, document intake/evidence, and Agent Phone/ElevenLabs plus AgentMail only after confirming their contracts.
6. Add durable case events, external-action deduplication, follow-up scheduling, consent scope, and human escalation. Recover cases left in analyzing after process interruption.
7. Complete the original requested report with actual command output for build and end-to-end checks, including every failure and unverified path.

## Next product work

Find an interview participant through warm introductions. The team has no confirmed participant or real customer outcome in this conversation and can drive around SF. Interviewing can proceed without collecting medical documents; see demo-and-research.md.
