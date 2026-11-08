# Architecture and repository map

## Intended agent architecture

Completed Naïve reviews now have a background persistence path. `backend/crew-completion.ts` shares immutable-input validation between the case API and `backend/crew-monitor.ts`; `backend/crew-worker.ts` exposes the authenticated Neon schedule endpoint. This worker only reads existing sessions. See [scheduled review saving](crew-monitoring.md) for leases, retries, and the remaining manual steps.

A Naïve coordinator owns a case and delegates to four proposed specialists:

- Intake: extracts fields, identifies missing information, and attaches evidence references.
- Investigator: reconciles bill/EOB data and prepares questions.
- Advocate: conducts authorized calls and email follow-up.
- Verifier: checks revised documents and distinguishes confirmed results from estimates.

The coordinator manages next actions, deadlines, budget, and human escalation. Call tools should return structured status, reference number, documents requested, next action, follow-up date, and whether human help is required. Deduplicate external events to avoid repeated calls/emails. The Naïve crew is now provisioned; see stack.md for its capped configuration, test results, and remaining live delivery and autonomous follow-up verification.

## Local prototype architecture

The prototype created during setup is React + TypeScript + Vite, with a Hono API on Neon Functions. The browser uses Neon Managed Auth and sends its session JWT to the Function. The Function validates signature and issuer with `jose`, derives the user ID from the verified subject, and scopes case reads/writes to that user.

Postgres access uses Drizzle with a module-level `pg` pool, maximum five connections, and `attachDatabasePool`. Migrations use the direct connection URL. Realtime queries are sealed by the backend, filtered by the authenticated owner, then subscribed to in React with renewal callbacks. Only public service URLs are exposed by Vite.

AI review discovers the available gateway model catalog and selects an enabled small text model. It returns an explicit unavailable response when no suitable model exists. It does not call hospitals or submit claims. A per-case status update prevents simultaneous duplicate analyses; crash recovery and broader spend limits are unfinished.

## Files

The implementation files below are included with the stack setup. Provider configuration and scripts are documented in stack.md.

| Path | Purpose |
| --- | --- |
| `README.md`, `assets/icon.svg` | Original tracked project introduction and icon |
| `agents.md` | Durable agent instructions and product context |
| `docs/*.md` | Topic documentation and verification history |
| `package.json`, `package-lock.json` | Dependencies and scripts for the local prototype |
| `index.html`, `src/main.tsx`, `src/style.css` | Sign-in and case dashboard UI |
| `src/services.ts` | Auth client, authenticated API requests, Realtime client and sealing requests |
| `backend/api.ts` | Protected Hono API, case CRUD, Realtime sealing, gateway status and AI review |
| `backend/schema.ts` | Drizzle `advocacy_cases` table definition |
| `drizzle/*.sql`, `drizzle/meta/*` | Generated migration and migration metadata; outside docs intentionally |
| `drizzle.config.ts` | Schema/migration configuration using the unpooled URL |
| `neon.ts` | Backend service declarations, Function environment, local origin lists, branch policy |
| `hello.ts` | Generated hello-world Function retained from init |
| `vite.config.ts`, `tsconfig.json` | Frontend build and TypeScript configuration |
| `.gitignore` | Local exclusions for secrets, dependencies, and build output |

## Data and API

`advocacy_cases` stores `id`, `owner_id`, `title`, `case_type`, `intake`, `revision`, nullable `bill_cents`, `eob_cents`, `notes`, `status`, `analysis`, and `created_at`. It has a primary key and owner index. Local prototype statuses are `new`, `analyzing`, and `reviewed`; none means verified savings.

Function routes: `GET /session`, `GET /cases`, `POST /cases`, `PATCH /cases/:id`, `POST /cases/live`, `DELETE /cases/:id`, `GET /ai/status`, and `POST /cases/:id/analyze`. Routes require authentication; CORS preflight is handled separately. Writes return a transaction ID for Realtime confirmation. Validate ownership on every route and never accept a client-supplied owner ID.

The prototype accepts manually entered synthetic case details. It does not yet implement document upload, OCR, payments or a complete appeals workflow. Naïve review routes and UI controls now exist, and owner-scoped voice/email draft, authorization, dispatch, and status routes are implemented; see stack.md.

## Durable crew reviews

`advocacy_crew_runs.snapshot` stores the first valid completed result and `completed_at` records when the app saved it. `backend/providers/crew-result.ts` excludes intermediate submissions, errors, and pending approvals. The case-owner-only status route reads a saved result without another provider request; simultaneous refreshes cannot overwrite the first completion. Incomplete runs remain refreshable against the existing session ID. The UI displays missing documents and saved status, and disables starting a saved review again.

Migration `0002_rapid_lizard.sql` adds nullable columns without changing existing runs. `scripts/crew-result.test.ts` covers the completion gates. `scripts/crew-app-smoke.ts --prepare` creates an isolated synthetic operator and writes private session state under ignored `test-results/`. Temporarily add that user's ID to `CREW_ALLOWED_USER_IDS`, deploy, then run the script without flags. It tests the deployed start route, duplicate requests, provider completion, persistence, and UI reload. Restore the original allowlist afterward. Reuse its existing record if a check times out; do not start another case just because observation timed out.

Case outreach is described in [outreach.md](outreach.md), including immutable drafts, approved recipients, and dispatch ambiguity handling.

## Injury intake and revision boundaries

`backend/claim-input.ts` validates the progressive intake JSON and distinguishes unknown amounts from zero. `src/CaseForm.tsx` supplies injury-first creation and revision-aware editing. Migration 0004 preserves legacy cases as health-insurance cases at revision 1. Crew requests are unique per case/revision; output is validated against the supplied financial amounts. Changes clear current analysis and require a new review. Earlier reviews are retained in the database; a user-facing review-history view remains future work. Outreach records carry their source revision and cannot dispatch after case facts change.
