# Verification

Assurance has been run with a real user on production. This page separates that evidence from the automated tests, which check logic without contacting outside services.

## Claire’s run: team confirmation and confidential records

The team confirms that Claire, the Reddit user acquired through the Naïve GTM agent, actually used Assurance and that her run and call occurred. Call logs, recordings, transcripts, and private case details were intentionally excluded from the public repository because of privacy concerns. Missing public call artifacts must be read as a confidentiality decision, not as a statement that no call or run took place.

This is the team’s direct confirmation of the real-user run. The confidential underlying records are not available here for independent inspection. No insurer decision, claim resolution, or financial savings are asserted by this confirmation. The timestamped production exchange below is a separately documented record; its events and outreach restriction should not be attributed to Claire without supporting records.

## Separately documented restricted production run

The team reports a successful end-to-end run with a real user through the live product on November 8, 2026. The [change log](change-log.md) records that the case came in through a real phone call, and records this production exchange:

| Time (UTC) | Event |
| --- | --- |
| About 11:27 | Front Desk hired an advocate for the case. |
| 12:18 | The advocate asked the owner a question. |
| 12:23 | The owner replied in website chat. |
| 12:36 | The same advocate session resumed and posted a chat message. |

Engineers fixed staffing and approval faults found during this case, as the same log describes. At the owner's request, the case was limited to the owner's designated inbox and contacted no insurer, so it does not record an insurer reply or claim outcome.

Call transcripts and case contents stay out of this repository to protect the user's privacy.

## First user

The GTM agent works: a Naïve GTM agent found Assurance's first user, Claire, on Reddit. The team confirms that her subsequent run and call occurred, as described above. Its acquisition messages and her confidential call records are not stored in this repository. [Permanent company agents](firm-blueprint.md) describes the go-to-market workflow.

## GTM discovery

On November 8, 2026, the owner reported that the GTM scrapers found **300 high-signal prospect posts across GoFundMe, X, and Reddit in under two hours**, looking at complaints from the preceding three days. This is a team-reported count of posts expressing need. It does not establish a deduplicated count of people, contacted leads, conversions, or revenue. The [product showcase](product-showcase.md) uses the figure with that attribution and scope.

## Other production evidence

- A test case with no outreach went through budget allocation, advocate hiring, session start, first saved goal, and finished onboarding.
- A test case completed a question, owner answer, and sourced fact in one continuing session. Owner revocation then invalidated its credential and cancelled the remote session.
- One real SMS sign-in worked through Twilio Verify.
- One email sent by a hosted agent run arrived in the authorized recipient's Gmail inbox.
- A second account could not read, resume, or revoke another owner's case.

[Implementation status](implementation-status.md) has the details.

## What the automated tests prove

Database suites run real service and SQL code against real Postgres. Model, Naïve, email, and phone providers are replaced with test doubles, so no test spends money or contacts anyone. These suites cover concurrency, send-once handling, authorization, recovery, and state changes. They do not show how a live provider or model behaves; that evidence is above.

The full insurer exchange (first contact, incoming reply, threaded follow-up, recorded outcome, stop) has been exercised this way with a scripted model and fake communications.

## Latest test result

On November 8, 2026, with no private environment, a fresh local throwaway Postgres, and the Playwright browser installed: **all 65 test files passed** through `npm test`, and `tsc --noEmit` passed. A build with an empty environment succeeded earlier the same day. The GitHub CI workflow also passed build and tests on that commit (`abc1a19`).
