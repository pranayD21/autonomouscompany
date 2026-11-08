# Saving completed agent reviews

The `crewpoll` Neon Function checks existing Naïve sessions every five minutes and saves valid completed reviews without requiring an open browser. It reads sessions only. It does not start a review, request a correction, send correspondence, or change any budget. The browser's status button still reads the same session and can save a result sooner.

`backend/crew-completion.ts` is shared by the API and worker. It validates the provider result against the run's captured amounts, confirmed documents, research, and correspondence. Later case edits do not change those inputs. The first valid completion wins; intermediate output, failed evidence checks, and pending approvals never become saved reviews. Earlier revisions remain separate from the current case.

`backend/crew-monitor.ts` claims at most five due runs per delivery using `FOR UPDATE SKIP LOCKED` and a ten-minute lease. The network read occurs after the claim commits. A lease UUID prevents an expired worker from clearing another worker's lease. Active runs are checked again after five minutes; provider failures retry after fifteen minutes. Completed but invalid results and pending approvals stop automatic checks and need operator attention. Sending the existing one-time correction makes the run due again. A correction submitted during a status read keeps its new schedule.

Automatic checks cover runs created within the last 30 days. Older or never-started runs require manual reconciliation. A `start_pending` row without a provider session ID is not retried by this worker. Checks can be delayed by backlog or service downtime. The app currently shows a newly saved result on status refresh or page reload; this change does not add a live review subscription.

Migration `0010_next_nehzno.sql` adds the next-check time, lease, last-check time, coarse status, and scheduler invocation ID to `advocacy_crew_runs`. No provider errors, credentials, or case content are written to logs. `backend/crew-worker.ts` accepts only a verified Neon schedule delivery named `crew-monitor`; anonymous and forged public requests return 401. `neon.ts` declares the Function and trigger. Its only custom credential is the existing Naïve API key; it receives no telephony or email credentials.

## Verification

Apply migrations to a disposable Neon branch, then run `OUTREACH_TEST_DATABASE_URL=<private branch URL> npx tsx --test scripts/crew-monitor.test.ts`. The test deliberately disables checks for copied runs on that branch, creates synthetic fixtures, and uses fake session reads. Never point it at production. Six tests cover overlapping deliveries, immutable captured facts, first-completion retention, rejected evidence/approvals, retry delays, delegation, lease recovery, concurrent corrections, and the batch limit.

Live verification reuses a previously completed synthetic Naïve session on the disposable branch. Only that branch's saved snapshot is cleared, so a real scheduler delivery must fetch, validate, and save it again. This verifies the read-and-save path without another inference run or a fabricated production case. Production deployment and observed delivery results are recorded in the change log.
