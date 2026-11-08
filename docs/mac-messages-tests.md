# Mac messaging bridge verification

`scripts/mac-messages-bridge.test.ts` exercises the real Postgres services and Hono routes in `backend/mac-messages-bridge.ts`. All records are fictional fixtures on a disposable database. It does not open Messages, use AppleScript, send SMS/iMessage, or change production configuration.

The suite covers strict Bearer authentication and feature gates, heartbeat age and sender matching, concurrent send reservation, receipt retry/conflict handling, consent and revocation, overdue/uncertain attempts, continued progress for unrelated recipients, untracked-message exclusion, duplicate replies, case isolation, ambiguous multi-case replies, human-help parking, and STOP cancellation. A claimed attempt is not retried; a later exact local receipt can reconcile its unknown result without creating another attempt.

Run serially with `OUTREACH_TEST_DATABASE_URL` set privately to a disposable database:

```sh
npx tsx --test --test-concurrency=1 scripts/mac-messages-bridge.test.ts
```

The suite applies repository migrations, requires no unrelated queued notifications, creates its own cases/permissions/preferences, and removes its fixture records afterward. It uses fake bridge configuration and fictional numbers that are not in `PHONE_TEST_NUMBERS`; configured public test numbers intentionally cannot receive messages. Never use the production database for this suite.

This suite does not cover local automation, macOS permissions, actual sender identity, delivery, incoming Messages parsing, or a complete call-to-message workflow. A submitted bridge receipt is not proof of recipient delivery.

Verification on November 8, 2026 UTC: all nine tests passed serially against the disposable branch, with fixture cleanup. The final rerun includes bare-token rejection and blocked-recipient starvation regressions after the service fixes. TypeScript and diff checks also passed. No real messages were sent.
