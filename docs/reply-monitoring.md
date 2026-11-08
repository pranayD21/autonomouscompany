# Scheduled reply monitoring

A case owner can enable monitoring on an already authorized email thread using **Monitor replies**. Monitoring lasts 30 days and can be paused or renewed. It reads only the saved AgentMail thread. Enabling it does not authorize another email, a call, or model inference. A check already in progress may finish after monitoring is paused.

`backend/reply-monitor.ts` manages owner-checked settings and scheduled work. Migration 0009 adds `advocacy_reply_monitors`, keyed by the original action, with expiry, next check, last attempt/success, retry count, error code, invocation ID, and a ten-minute processing lease. A database claim uses `FOR UPDATE SKIP LOCKED` so overlapping workers do not ordinarily read the same thread. An interrupted worker can be retried after its lease expires; the existing reply importer deduplicates messages and revisions.

The `replypoll` Neon Function in `backend/reply-worker.ts` accepts only scheduler deliveries named `reply-monitor`. It uses Neon's trigger parser and trusted proxy header; public client-supplied `x-neon-*` headers are stripped by the deployed proxy. It has database access and the scoped AgentMail credentials, with no Naïve or telephony credentials. Its logs contain counts and invocation IDs, not message text, recipients, or provider error bodies.

The trigger runs every five minutes. Each delivery handles at most five due threads and stops taking work after four minutes. Successful checks schedule the next attempt 15 minutes later. Failures retry after 30 minutes, doubling up to six hours. Partial thread history remains visible. Disabled and expired monitors are skipped. This bounded worker can fall behind under a large queue; its current limits suit the prototype, not unrestricted production volume.

## API and interface

- GET `/cases/:id/reply-monitors` returns only the owner's monitoring records.
- POST `/cases/:id/actions/:actionId/reply-monitor` takes `{ "enabled": true }` or false. The case must belong to the caller and the action must have an authorized email receipt and thread ID.
- `src/Outreach.tsx` shows the pause/enable control, last successful check, next due time, expiry, and retry/partial-history notices. Reload to refresh monitoring timestamps. When an imported reply advances the case revision through Realtime, the communication history refreshes automatically.

An accepted new reply advances the case revision and invalidates the current review, just as a manual check does. The owner can request a new review if enabled for model spending. Scheduled model reviews, automatic response drafting, and sending follow-ups are separate unfinished steps.

## Verification and operations

Run `scripts/reply-monitor.test.ts` with `OUTREACH_TEST_DATABASE_URL` pointing to an isolated migrated Neon branch. It checks owner/receipt gates, concurrent claims, duplicate delivery, retry delay and recovery, paused/expired monitors, expired leases, batch bounds, and partial-history notices. `npx tsx scripts/reply-monitor-app.ts enable` enables the existing synthetic test thread and checks owner isolation and forged trigger rejection. After a real scheduled delivery, run it with `verify` to check durable success, duplicate protection, UI status, and pause/resume. It sends no email and leaves that test thread monitored.

`neon triggers list --output json` shows the deployed schedule. Deploy using `neon deploy --env .env.local --update-existing` after reviewing configuration. The function's only custom secrets are `AGENTMAIL_API_KEY` and `AGENTMAIL_INBOX_ID`; Neon injects the database connection. Never publish their values. Trigger availability and actual execution must be verified separately from a successful build.

Live verification on November 7: Neon delivered the 4:50 p.m. Pacific check, which read the authorized test thread with one existing reply and made no duplicate import. The saved success/invocation record, UI status, owner isolation, pause/resume, and rejection of forged public trigger calls all passed. The first scheduler heartbeat ran with no monitored thread and correctly checked zero. A new message arriving after monitoring was enabled has not yet been observed; earlier live manual ingestion and the shared importer tests cover the import path.

## Persistent permission

For an email reserved by a version-2 decision, `pollReplyMonitors` also considers the linked authority. An active, waiting, or human-required authority keeps its enabled monitor eligible after the legacy thirty-day expiry. Stopped and revoked authorities do not receive this extension. Reply ingestion can update evidence while a case needs human help, but cannot restore permission or resume autonomous work. This changes monitoring eligibility only; it does not send a message.

The owner-scoped GET `/cases/:id/reply-monitors` includes `persistent` for this eligibility extension. `src/Outreach.tsx` uses that flag when displaying monitoring status and the pause control, so an enabled persistent monitor is not mislabeled expired after thirty days. Legacy monitors retain their displayed end date.
