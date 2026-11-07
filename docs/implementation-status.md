# Implementation status and next steps

Updated November 7, 2026. See [stack operations](stack.md) for account configuration and test details.

## Verified

- Neon CLI authentication and the requested production project setup completed. Postgres, Auth, Functions, Realtime, and AI Gateway credentials are provisioned.
- Both Drizzle migrations applied. The case Function is deployed with server-only Naïve configuration.
- `npm run build` passes, including TypeScript checks for backend, frontend, scripts, and provider configuration. Latest build: 262 modules, 525.42 kB JavaScript. The chunk-size warning remains.
- `npm start` serves the preview; use http://localhost:4173.
- `npm run test:e2e` passes signup/session validation, authenticated Function access, database create/persistence/delete, Realtime delivery, reload, and sign-out. It also verifies 401 for missing/invalid tokens, 400 for negative amounts, and 403 for unlisted users trying to spend crew credits.
- Frontend bundle checked against configured secret values: no provider secrets found.
- Five Naïve agents provisioned, with capped budgets and explicit specialist versions. Coordinator delegates to specialists; complete structured-output verification is still in progress.
- AgentPhone account, API key, hosted synthetic-demo agent and number configured. ElevenLabs account, restricted key, authenticated demo agent, recording-off setting and duration cap verified through its API. AgentMail free account, inbox, scoped API key and message-read access verified.

## Blocked or incomplete

- Neon AI Gateway has no enabled models because gateway credits are missing. E2E verifies the unavailable message, not successful inference.
- AgentPhone rejected the one authorized outbound test with HTTP 402, requiring added funds. SIP access request accepted but pending provider enablement. No completed voice call or SIP connection verified.
- ElevenLabs free-plan UI limits use to personal/non-commercial purposes. No paid commercial license selected.
- Crew runs are restricted by `CREW_ALLOWED_USER_IDS`, currently empty. Configure actual test operators before trying the dashboard's run action.
- Voice/email are not attached to case actions. Document upload/OCR, consent, evidence-backed outcomes, appeal submission, follow-up scheduling, payments, and public frontend hosting remain incomplete.
- Two-user isolation is verified for case listing, Realtime, crew routes, and deletion. Case analysis crash recovery and broader spend/rate controls need work.
- Four moderate development dependency findings remain in Drizzle Kit/esbuild; no forced breaking upgrade performed. Migration driver printed a future SSL-mode semantics warning; API uses verify-full.

## Next work

Finish the corrected Naïve crew smoke test, test the enabled crew through the app, and connect authorized external actions with durable state and consent. Resolve AgentPhone funding/SIP and gateway credits with the operator before paid operations. Publish a frontend only after configuring its exact Auth/CORS/Realtime origin.

The team still needs a real interview participant. No customer savings or testimonial has been established. See [demo and research](demo-and-research.md).
