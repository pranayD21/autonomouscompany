# Naïve case autonomy

This document covers the legacy bounded authorization (policy version 1). New cases use the [persistent workflow](persistent-workflow-migration.md), which has no repository decision or message counts, contact spacing, recipient list, or case expiry. These limits govern only existing legacy grants and must not be applied to the persistent path.

In the legacy path, Naïve chooses the next action within a standing authorization: contact an insurer, follow up, contact the original customer, continue, or stop. The app retains hard limits, receipt history, a stop control, and human handling of uncertain or consequential decisions. Only operators listed in `CREW_ALLOWED_USER_IDS` can create these grants, through `POST /cases/:id/autonomy`.

## First live authorization

The operator selected a synthetic email test to their own setup inbox only: at most two emails and three agent decision rounds, with at least one hour between outbound messages and a 24-hour authorization. This scope did not authorize insurer contacts, phone calls, real medical information, payments, settlements, or claims submissions. The existing Naïve per-agent and per-task budget caps stayed in place. The first email was delivered and the fictional customer reply was imported automatically. That reply triggered the second Naïve decision.

## Policy

`backend/autonomy-policy.ts` defines standing authority and typed agent decisions. A contact is identified by an approved ID, role, channel, and destination. The agent chooses `contact_customer`, `contact_insurer`, `wait_for_reply`, `request_human_help`, or `stop_case`. It cannot supply an arbitrary replacement destination. The policy checks expiry, revocation, counts, contact spacing, evidence references, unresolved dispatch outcomes, and call availability. Declaring a goal met or a customer stop request requires corresponding server-verified state.

Five tests in `scripts/autonomy-policy.test.ts` pass. They cover allowed customer contact, recipient/role/channel restrictions, evidence references, authorization expiry and revocation, action limits, uncertain dispatches, spacing, waiting, escalation, and unsupported success claims.

## Durable execution

`backend/autonomy-service.ts` binds standing authorizations to case owners and requires a completed review of the current case revision. `backend/schema.ts` and migration `0011_bored_sabretooth.sql` store authorizations and immutable decision rounds. The API exposes owner-scoped history, authorization, and revocation endpoints. `src/Autonomy.tsx` shows decision history and the stop control.

`backend/providers/autonomy.ts` asks the existing Naïve coordinator for one typed decision. The coordinator chooses the action; `backend/autonomy-runner.ts` validates it and invokes the transport. This is an application tool bridge, not a native Naïve MCP integration. The local crew prompt distinguishes review-only tasks from tasks covered by standing authority. The revised prompts are published. Coordinator version 17 references intake version 7 and investigator, advocate, and verifier version 6. A provider read confirmed every roster reference matches the current specialist version and all five agents retain the approved $2 monthly and $0.25 per-task caps. The corresponding version variables were updated in the private environment.

`backend/autonomy-worker.ts` and the `case-autonomy` trigger in `neon.ts` check due cases every minute. Decision IDs provide idempotency for Naïve sessions. Database locks reserve rounds and outreach records before execution. Accepted emails enable the existing reply monitor. New evidence wakes a waiting case; outbound spacing still applies. Expiry, owner revocation, customer stop requests, uncertain dispatches, and exhausted limits stop or escalate work. An uncertain send is never retried automatically.

The legacy runner rejects `goal_met` because it passes `verified_goal_met:false` to the policy check (`backend/autonomy-runner.ts`). The follow-up path links a new authorized email to the latest successful email for the same case and approved recipient. It preserves the original subject and stores immutable reply message/thread IDs. The provider receives an explicit recipient, `reply_all: false`, and empty CC/BCC lists. Mismatched thread receipts remain uncertain and cannot resend automatically. Migration 0012 passed on an isolated branch and was applied to production, and the backend deployment succeeded.

## Verification and deployment

The migration and all eleven runner tests passed on a disposable Neon branch. The latest combined suite passed 27 tests with zero failures (11 autonomous runner, 10 outreach, and 6 ElevenLabs transport tests); the five policy tests passed in an earlier run. They covered ownership, duplicate grants, concurrent scheduler delivery, revocation during model execution, ambiguous transport results, changed case evidence, unsupported success, and expiration. The run also verified a model-selected wait, evidence waking a case without bypassing contact spacing, and an accepted customer stop reply ending work without another model round or contact. Run these with `OUTREACH_TEST_DATABASE_URL` pointing to a disposable migrated branch; never run database fixtures against production.

`npm run build` passes with the existing bundle-size warning. Migration 0011, the API routes, and the worker are deployed to production. An unsigned POST to the worker returned HTTP 401. For that test, the email allowlist contained only the operator’s approved setup inbox, and the approved own-inbox synthetic standing authorization was activated through the form then in the workspace. The first autonomous email was accepted by AgentMail and independently found in the operator’s Gmail inbox. New calls use [AgentPhone only](voice-agentphone.md).

## First live decision

The scheduled worker started the operator-authorized test in Naïve session `ses_e1eds4e6c988d40r248awzwx6p`. A transient status read returned HTTP 429 at provider capacity; the same session was retained. A later read returned `idle` / `end_turn` with a typed `contact_customer` decision. Naïve chose to request fictional employer name, incident date, and claim status/reference from the approved customer contact. Its message explicitly identifies the synthetic demo and asks for no real records or money details. Reported consumption was 9,957 micro-USD. The scheduled worker dispatched this decision at 2026-11-08 01:55 UTC. AgentMail accepted it, and Gmail independently returned the exact subject in the operator’s inbox. The authority then waited with one outbound action used, and the operator replied with fictional details to verify continuation.

The live reply transport returned the operator’s fictional employer/date/claim-status reply with accepted sender-domain authentication and a matching reference to the authorized email. The scheduled reply import succeeded at 2026-11-08 02:00:00.915 UTC, invocation `a5YGSHdoHB0Lj9eyPVfPBWzDQFHd5AqQH6md6yIllrQ`. The reply is accepted case evidence. The subsequent Naïve decision used this reply. Sender display names are normalized through the existing `mailbox` parser before matching a customer stop request; the regression fixture uses `Demo Customer <customer@example.com>` rather than a bare address.

At the next scheduled autonomy check, the imported reply advanced the case evidence and started decision round 2 in session `ses_11xtfg8xh36bey3krar9fdvxbf`. Database state confirms two decisions reserved and only one outbound message used. This verifies automatic continuation from received correspondence. The second decision completed but proposed redundant claim-stage clarification before the one-hour contact interval. No second message was sent. The runner now discards premature contact decisions and waits until the permitted time for a fresh decision, preserving consumed rounds and outbound limits. Decision inputs include the current time and earliest permitted contact time. The prompt treats an explicit no-claim-filed reply as known pre-claim status and forbids asking for the same confirmation again. This improves the next decision prompt; it does not guarantee model judgment.

The 02:10 UTC production scheduler verified the deployed timing correction: round two finished with `CONTACT_TOO_SOON`, the grant waited until 02:55:02.772 UTC (6:55pm Pacific), and outbound usage stayed at one.

Research-only authorities may have no contacts and `max_outbound: 0`. They can support case reading and follow-up reasoning without authorizing email or calls. A positive outbound allowance still requires a contact, and the server action guard rejects all contact attempts when the outbound cap is zero.

### Activation UI check

Run `E2E_AUTHORIZATION_UI=1 npm run test:e2e` against a local build to exercise the case activation controls. Its authority POSTs are intercepted with explicit UI fixtures; the test creates no live grant and sends no messages.
