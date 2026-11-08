# Architecture and repository map

## Agent architecture

Each case has one isolated Naïve advocate with one persistent session. Six permanent company roles (`ceo`, `frontdesk`, `reviewer`, `knowledge`, `growth`, `finance`, declared in `backend/firm-blueprint.ts`) handle budgets, staffing, review, playbooks, go-to-market, and test-mode finance. The CEO funds a case and Front Desk hires its advocate. See [company runtime](firm-runtime.md) and [permanent company agents](firm-blueprint.md). Direct-model runs created earlier keep their engine; see [hosted agent](hosted-agent.md).

The advocate works through the case tools in `backend/case-tools.ts`. It sets its own goal and chooses research, contacts, messages, and follow-up times. The server enforces case isolation, current authority, source checks, and send-once dispatch, and deduplicates external events to avoid repeated calls and emails. See [case tool server](agent-tools.md).

### Legacy review crew

`naive.config.ts` also declares the older review crew, a coordinator with four specialists:

- Intake: extracts fields, identifies missing information, and attaches evidence references.
- Investigator: reconciles the insurer decision with supplied evidence and prepares questions.
- Advocate: drafts insurer inquiries and follow-ups; it has no sending or calling tool.
- Verifier: checks findings against evidence and distinguishes confirmed results from estimates.

Completed crew reviews have a background persistence path. `backend/crew-completion.ts` shares immutable-input validation between the case API and `backend/crew-monitor.ts`; `backend/crew-worker.ts` exposes the authenticated Neon schedule endpoint. This worker only reads existing sessions. See [scheduled review saving](crew-monitoring.md) for leases and retries, and stack.md for the crew's capped configuration and test results.

## Application architecture

The application uses React + TypeScript + Vite, with a Hono API on Neon Functions. The browser uses Neon Managed Auth and sends its session JWT to the Function. The Function validates signature and issuer with `jose`, derives the user ID from the verified subject, and scopes case reads/writes to that user.

Postgres access uses Drizzle with a module-level `pg` pool, maximum five connections, and `attachDatabasePool`. Migrations use the direct connection URL. Realtime queries are sealed by the backend, filtered by the authenticated owner, then subscribed to in React with renewal callbacks. Only public service URLs are exposed by Vite.

The legacy gateway AI review (`POST /cases/:id/analyze`) discovers the available gateway model catalog and selects an enabled small text model. It does not call hospitals or submit claims. A per-case status update prevents simultaneous duplicate analyses.

## Files

Key paths are below. Provider configuration and scripts are documented in stack.md.

| Path | Purpose |
| --- | --- |
| `README.md`, `assets/icon.svg` | Original tracked project introduction and icon |
| `agents.md` | Durable agent instructions and product context |
| `docs/*.md` | Topic documentation and verification history |
| `package.json`, `package-lock.json` | Dependencies and scripts for the application |
| `index.html`, `src/main.tsx`, `src/Workspace.tsx`, `src/style.css` | Sign-in and case dashboard UI; see [frontend](frontend.md) |
| `src/services.ts` | Auth client, authenticated API requests, Realtime client and sealing requests |
| `backend/api.ts` | Protected Hono API for cases, messages, authority, and Realtime sealing |
| `backend/case-tools.ts`, `backend/case-tools-worker.ts` | Case MCP tools for advocates |
| `backend/firm-*.ts` | Permanent company roles, events, staffing, and test-mode finance |
| `backend/phone-*.ts` | Phone sign-in and requested onboarding call |
| `backend/autonomy-worker.ts`, `backend/case-agent-*.ts` | Scheduled case work and persistent sessions |
| `backend/schema.ts` | Drizzle definitions for the `advocacy_*` tables |
| `drizzle/*.sql`, `drizzle/meta/*` | Generated migration and migration metadata; outside docs intentionally |
| `drizzle.config.ts` | Schema/migration configuration using the unpooled URL |
| `neon.ts` | Backend service declarations, Function environment, local origin lists, branch policy |
| `hello.ts` | Generated hello-world Function retained from init |
| `vite.config.ts`, `tsconfig.json` | Frontend build and TypeScript configuration |
| `.gitignore` | Local exclusions for secrets, dependencies, and build output |

## Data and API

`advocacy_cases` stores `id`, `owner_id`, `title`, `case_type`, `intake`, `revision`, nullable `bill_cents`, `eob_cents`, `notes`, `status`, `analysis`, and `created_at`. It has a primary key and owner index. Review statuses are `new`, `analyzing`, and `reviewed`; none means verified savings.

Core case routes: `GET /session`, `GET /cases`, `POST /cases`, `PATCH /cases/:id`, `POST /cases/live`, `DELETE /cases/:id`, `GET /ai/status`, and `POST /cases/:id/analyze`. Routes require authentication; CORS preflight is handled separately. Writes return a transaction ID for Realtime confirmation. Other routes are documented with their subsystem. Validate ownership on every route and never accept a client-supplied owner ID.

The application supports progressive intake, private document uploads and extraction, website case conversation, and persistent case advocates. Owner-scoped voice/email records preserve authorization, dispatch, and provider status. See [company runtime](firm-runtime.md), [phone onboarding](phone-onboarding.md), [documents](documents.md), and [implementation status](implementation-status.md) for current subsystem behavior and verification. Payments remain test-mode only.

## Durable crew reviews

`advocacy_crew_runs.snapshot` stores the first valid completed result and `completed_at` records when the app saved it. `backend/providers/crew-result.ts` excludes intermediate submissions, errors, and pending approvals. The case-owner-only status route reads a saved result without another provider request; simultaneous refreshes cannot overwrite the first completion. Incomplete runs remain refreshable against the existing session ID.

Migration `0002_rapid_lizard.sql` adds nullable columns without changing existing runs. `scripts/crew-result.test.ts` covers the completion gates. `scripts/crew-app-smoke.ts --prepare` creates an isolated synthetic operator and writes private session state under ignored `test-results/`. Temporarily add that user's ID to `CREW_ALLOWED_USER_IDS`, deploy, then run the script without flags. It tests the deployed start route, duplicate requests, provider completion, persistence, and the crew controls that have since left the UI. Restore the original allowlist afterward. Reuse its existing record if a check times out; do not start another case just because observation timed out.

Case outreach is described in [outreach.md](outreach.md), including immutable drafts, approved recipients, and dispatch ambiguity handling.

## Injury intake and revision boundaries

`backend/claim-input.ts` validates the progressive intake JSON and distinguishes unknown amounts from zero. `src/CaseForm.tsx` supplies injury-first creation and revision-aware editing. Migration 0004 preserves legacy cases as health-insurance cases at revision 1. Crew requests are unique per case/revision; output is validated against the supplied financial amounts. Changes clear current analysis, and a saved review applies only to its revision. Earlier reviews are retained in the database. Outreach records carry their source revision and cannot dispatch after case facts change.

The phone subsystem adds a separate self-managed Better Auth phone Function alongside managed Neon email Auth. Both resolve to case-owner identities through the case API; no browser receives database or provider credentials. The customer path is a verified phone number, one requested AgentPhone onboarding call, and automatic case creation from a sufficient owner-bound transcript; see [phone onboarding](phone-onboarding.md).

`PHONE_FLOW_ENABLED=false` keeps the older inbound intake and SMS path off. In that path, signed AgentPhone events create untrusted pending intakes, OTP verification authenticates the website user, explicit intake review creates the case, and a consent-bound SMS outbox sends links and detected document-issue notices. See phone-first.md for its schema, trust boundaries, configuration, and gate.
