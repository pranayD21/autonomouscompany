# Implementation status and next steps

Updated November 7, 2026. See [stack operations](stack.md) for account configuration and test details.

## Verified

- Neon CLI authentication and the requested production project setup completed. Postgres, Auth, Functions, Realtime, and AI Gateway credentials are provisioned.
- All five Drizzle migrations applied. The case Function is deployed with server-only Naïve configuration.
- `npm run build` passes, including TypeScript checks for backend, frontend, scripts, and provider configuration. Latest build: 264 modules, 536.18 kB JavaScript. The chunk-size warning remains.
- `npm start` serves the preview; use http://localhost:4173.
- `npm run test:e2e` passes signup/session validation, authenticated Function access, database create/persistence/delete, Realtime delivery, reload, and sign-out. It also verifies 401 for missing/invalid tokens, 400 for negative amounts, and 403 for unlisted users trying to spend crew credits.
- Live authorized app crew test passed: signup, case creation, duplicate-start deduplication, Naïve completion, saved Postgres review, and UI reload. Four focused tests reject intermediate/error/approval-pending output. Saved review records remain readable without another provider call.
- Injury-first live test passed: null financial amounts, saved crew review, progressive employer update, stale-edit conflict, and stale-outreach rejection. Ten validation/completion tests and nine isolated database/outreach tests passed. A live content recheck produced three next questions; coverage candidates remain unverified and need source-backed research.
- Frontend bundle checked against configured secret values: no provider secrets found.
- Five Naïve agents provisioned, with capped budgets and explicit specialist versions. Live smoke test passed: all four version-3 specialists ended normally and the coordinator returned schema-valid output, identifying the synthetic $800 difference as unverified and requiring documents/human authorization.
- AgentPhone account, API key, hosted synthetic-demo agent and number configured. ElevenLabs account, restricted key, authenticated demo agent, recording-off setting and duration cap verified through its API. AgentMail free account, inbox, scoped API key and message-read access verified.

## Blocked or incomplete

- Neon AI Gateway has no enabled models because gateway credits are missing. E2E verifies the unavailable message, not successful inference.
- AgentPhone initially rejected the test with HTTP 402. The operator added $25, then the authorized retry completed (46 seconds; no recording URL), and the user confirmed receipt. SIP access request remains pending; ElevenLabs routing is not verified.
- ElevenLabs free-plan UI limits use to personal/non-commercial purposes. No paid commercial license selected.
- Crew runs are restricted by `CREW_ALLOWED_USER_IDS`, currently empty. Configure actual test operators before trying the dashboard's run action.
- Case-linked outreach drafts, explicit authorization, dispatch records, and provider status reads are implemented. One explicitly authorized case-linked AgentMail email was sent and independently found in the operator’s Gmail inbox. Case-linked live calling remains unverified; approved-recipient lists are restored after testing. Document upload/OCR, consent, evidence-backed outcomes, appeal submission, follow-up scheduling, payments, and public frontend hosting remain incomplete.
- Two-user isolation is verified for case listing, Realtime, crew routes, and deletion. Case analysis crash recovery and broader spend/rate controls need work.
- Four moderate development dependency findings remain in Drizzle Kit/esbuild; no forced breaking upgrade performed. Migration driver printed a future SSL-mode semantics warning; API uses verify-full.

## Next work

Add inbound reply handling, agent-driven outreach proposals, and scheduled follow-ups; verify a newly authorized case-linked call when a recipient agrees. Resolve AgentPhone SIP and gateway credits with the operator before paid operations. Publish a frontend only after configuring its exact Auth/CORS/Realtime origin.

The team still needs a real interview participant. No customer savings or testimonial has been established. See [demo and research](demo-and-research.md).

## Selected product direction

The user selected an insurer-facing workplace chemical-burn workflow, from initial injury/insurance-card intake to supported claim resolution and final bill reconciliation. Product context and Naïve prompts now reflect that direction (specialist version 4). The app now supports progressive injury/insurance intake, nullable financial amounts, and revision-aware case editing/reviews. Insurance-card/document upload, claim forms, coverage research tools, and autonomous reply/follow-up handling remain incomplete. Prior infrastructure tests do not establish completion of this new end-to-end workflow. See insurance-workflows.md.
