# Scheduled reply monitoring

A successful agent-sent email enables monitoring on its thread automatically, and a case owner can pause or renew it through the API below. Monitoring lasts 30 days. It reads only the saved AgentMail thread. Enabling it does not authorize another email, a call, or model inference. A check already in progress may finish after monitoring is paused.

`backend/reply-monitor.ts` manages owner-checked settings and scheduled work. Migration 0009 adds `advocacy_reply_monitors`, keyed by the original action, with expiry, next check, last attempt/success, retry count, error code, invocation ID, and a ten-minute processing lease. A database claim uses `FOR UPDATE SKIP LOCKED` so overlapping workers do not ordinarily read the same thread. An interrupted worker can be retried after its lease expires; the existing reply importer deduplicates messages and revisions.

The `replypoll` Neon Function in `backend/reply-worker.ts` accepts only scheduler deliveries named `reply-monitor`. It uses Neon's trigger parser and trusted proxy header; public client-supplied `x-neon-*` headers are stripped by the deployed proxy. It has database access and the scoped AgentMail credentials, with no Naïve or telephony credentials. Its logs contain counts and invocation IDs, not message text, recipients, or provider error bodies.

The trigger runs every five minutes. Each delivery handles at most five due threads and stops taking work after four minutes. Successful checks schedule the next attempt 15 minutes later. Failures retry after 30 minutes, doubling up to six hours. Partial thread history remains visible. Disabled and expired monitors are skipped.

## API and interface

- GET `/cases/:id/reply-monitors` returns only the owner's monitoring records.
- POST `/cases/:id/actions/:actionId/reply-monitor` takes `{ "enabled": true }` or false. The case must belong to the caller and the action must have an authorized email receipt and thread ID.
- The workspace has no monitoring toggle. Received replies appear in the case Activity feed in `src/Autonomy.tsx`, which refreshes every 15 seconds.

An accepted new reply advances the case revision and invalidates the current review, just as a manual check does. On a persistent case it also queues an event that wakes the advocate; see [case sessions](case-sessions.md). Monitoring itself sends nothing.

## Verification and operations

Run `scripts/reply-monitor.test.ts` with `OUTREACH_TEST_DATABASE_URL` pointing to an isolated migrated Neon branch. It checks owner/receipt gates, concurrent claims, duplicate delivery, retry delay and recovery, paused/expired monitors, expired leases, batch bounds, and partial-history notices. `scripts/reply-monitor-app.ts` (`enable`, then `verify` after a real scheduled delivery) was used on the existing synthetic test thread for the November 7 check below. It drives the former monitoring control, which the workspace no longer mounts, so it does not run against the current UI. It sends no email.

`neon triggers list --output json` shows the deployed schedule. Deploy using `neon deploy --env .env.local --update-existing` after reviewing configuration. The function's only custom secrets are `AGENTMAIL_API_KEY` and `AGENTMAIL_INBOX_ID`; Neon injects the database connection. Never publish their values. A successful build does not show that the trigger executed.

Live verification on November 7: Neon delivered the 4:50 p.m. Pacific check, which read the authorized test thread with one existing reply and made no duplicate import. The saved success/invocation record, UI status, owner isolation, pause/resume, and rejection of forged public trigger calls all passed. The first scheduler heartbeat ran with no monitored thread and correctly checked zero. That check did not observe a new message arriving after monitoring was enabled; earlier live manual ingestion and the shared importer tests cover the import path.

## Persistent permission

For an email reserved by a version-2 decision, `pollReplyMonitors` also considers the linked authority. An active, waiting, or human-required authority keeps its enabled monitor eligible after the legacy thirty-day expiry. Stopped and revoked authorities do not receive this extension. Reply ingestion can update evidence while a case needs human help, but cannot restore permission or resume autonomous work. This changes monitoring eligibility only; it does not send a message.

The owner-scoped GET `/cases/:id/reply-monitors` includes `persistent` for this eligibility extension, so an enabled persistent monitor is not reported as expired after thirty days. Legacy monitors retain their end date.
