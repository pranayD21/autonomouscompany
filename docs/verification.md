# Verification

Assurance has been run with a real user on production. This page separates that evidence from the automated tests, which check logic without contacting outside services.

## Real-user run

The team reports a real-user production run through phone intake, advocate staffing, and website conversation on November 8, 2026. The case came in through a real phone call. Read the [first exchange record](change-log.md#2026-11-08--first-advocate-exchange-on-a-real-case-faster-approvals) together with the later [chat-delivery correction](change-log.md#2026-11-08--website-chat-replies-to-the-owner):

| Time (UTC) | Event |
| --- | --- |
| About 11:27 | Front Desk created the case advocate agent; provisioning was subsequently repaired. |
| 12:18 | The advocate asked the owner a question. |
| 12:23 | The owner replied in website chat. |
| 12:36:24 | The same advocate session posted a chat message. The record does not establish it as a reply to the 12:23 answer. |
| 12:50 | The later investigation records delivery of the 12:23 owner answer to the advocate. The owner had reported no reply. |

Engineers fixed staffing and approval faults found during this case, as the same log describes. At the owner's request, the case was limited to the owner's designated inbox and contacted no insurer, so it does not record an insurer reply or claim outcome.

The [inbox investigation](change-log.md#2026-11-08--scheduler-finishes-started-hires-agentmail-inbox-limit-found) records manual reassignment of an unused fictional-case inbox after AgentMail rejected another inbox creation. The [shared-inbox change](change-log.md#2026-11-08--cases-share-one-agentmail-inbox) subsequently removed per-case inbox creation from hiring. Approval batching and owner-message delivery were repaired as described in the linked exchange records. Their listed regression checks used mocked providers; those checks do not prove a later unattended production segment. Human recovery time and a complete intervention count were not measured in these records.

Call transcripts and case contents stay out of this repository to protect the user's privacy.

## First user

The team reports that a Naïve GTM agent found Assurance's first user on Reddit. Its messages and conversion receipts are not stored in this repository, so this is team-reported acquisition evidence. [Permanent company agents](firm-blueprint.md) describes the go-to-market workflow. A saved growth-lead state is an agent-authored record; the current tool accepts `contacted` or `signed_up` without requiring a receipt, and the state alone does not establish a delivered reply or an authenticated signup.

## Other production evidence

- A test case with no outreach went through budget allocation, advocate hiring, session start, first saved goal, and finished onboarding.
- A test case completed a question, owner answer, and sourced fact in one continuing session. Owner revocation then invalidated its credential and cancelled the remote session.
- One real SMS sign-in worked through Twilio Verify.
- One email sent by the historical hosted direct-model run arrived in the authorized recipient's Gmail inbox; it is separate from current Naïve advocate evidence.
- A second account could not read, resume, or revoke another owner's case.

[Implementation status](implementation-status.md) has the details.

## What the automated tests prove

Database suites run real service and SQL code against real Postgres. Model, Naïve, email, and phone providers are replaced with test doubles, so no test spends money or contacts anyone. These suites cover concurrency, send-once handling, authorization, recovery, and state changes. They do not show how a live provider or model behaves; that evidence is above.

The full insurer exchange (first contact, incoming reply, threaded follow-up, recorded outcome, stop) has been exercised this way with a scripted model and fake communications through the historical direct runner (`scripts/hosted-workflow.test.ts`). This proves that tested service path, rather than live Naïve insurer interaction.

## Recorded full-suite result

The recorded November 8, 2026 result, with no private environment, a fresh local throwaway Postgres, and the Playwright browser installed, is: **all 65 files discovered by `npm test` passed**, and `tsc --noEmit` passed. A build with an empty environment succeeded earlier the same day. The repository also records GitHub CI passing build and tests on [commit `abc1a19`](https://github.com/pranayD21/autonomouscompany/commit/abc1a19); this document does not contain a workflow-run receipt.

## Independently reproduced checkout checks

During the November 8, 2026 repository evaluation at commit `754fba5`, `npm run build` passed, including TypeScript checking. `npm test` passed **29 test files**, failed **zero**, and skipped **36** because `OUTREACH_TEST_DATABASE_URL` was not configured. This evaluation did not reproduce the database suites or independently verify the earlier CI result. Production calls, emails, case actions, and agent sessions were not started during these checks.

The runner discovers top-level `scripts/*.test.ts` files only; `.test.tsx`, nested tests, UI fixtures, and live smoke scripts have separate entry points. See [Running Assurance](running.md#run-the-tests). Provider doubles and scripted models test service behavior; they do not establish the quality of live model decisions or actual insurer outcomes.
