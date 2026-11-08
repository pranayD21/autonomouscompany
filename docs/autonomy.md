# Naïve case autonomy

The operator requested that Naïve choose the next action throughout a case: contact an insurer, follow up, contact the original customer, continue, or stop. Routine communications should run under a standing case authorization rather than requiring approval of each message. The app must retain hard limits, receipt history, a stop control, and human handling of uncertain or consequential decisions.

## First live authorization

The operator selected a synthetic email test to their own setup inbox only. Prepare at most two emails and three agent decision rounds, with at least one hour between outbound messages and a 24-hour authorization. This scope does not authorize insurer contacts, phone calls, real medical information, payments, settlements, or claims submissions. Preserve the existing Naïve per-agent and per-task budget caps. The first email was delivered and the fictional customer reply was imported automatically. That reply triggered the second Naïve decision.

## Implemented foundation

`backend/autonomy-policy.ts` defines standing authority and typed agent decisions. A contact is identified by an approved ID, role, channel, and destination. The agent chooses `contact_customer`, `contact_insurer`, `wait_for_reply`, `request_human_help`, or `stop_case`. It cannot supply an arbitrary replacement destination. The policy checks expiry, revocation, counts, contact spacing, evidence references, unresolved dispatch outcomes, and call availability. Declaring a goal met or a customer stop request requires corresponding server-verified state.

Five tests in `scripts/autonomy-policy.test.ts` pass. They cover allowed customer contact, recipient/role/channel restrictions, evidence references, authorization expiry and revocation, action limits, uncertain dispatches, spacing, waiting, escalation, and unsupported success claims.

## Durable execution

`backend/autonomy-service.ts` binds standing authorizations to case owners and requires a completed review of the current case revision. `backend/schema.ts` and migration `0011_bored_sabretooth.sql` store authorizations and immutable decision rounds. The API exposes owner-scoped history, authorization, and revocation endpoints. `src/Autonomy.tsx` provides the bounded email-test form, decision history, and stop control.

`backend/providers/autonomy.ts` asks the existing Naïve coordinator for one typed decision. The coordinator chooses the action; `backend/autonomy-runner.ts` validates it and invokes the transport. This is an application tool bridge, not a native Naïve MCP integration. The local crew prompt distinguishes review-only tasks from tasks covered by standing authority. The revised prompts are published. Coordinator version 17 references intake version 7 and investigator, advocate, and verifier version 6. A provider read confirmed every roster reference matches the current specialist version and all five agents retain the approved $2 monthly and $0.25 per-task caps. The corresponding version variables were updated in the private environment.

`backend/autonomy-worker.ts` and the `case-autonomy` trigger in `neon.ts` check due cases every five minutes. Decision IDs provide idempotency for Naïve sessions. Database locks reserve rounds and outreach records before execution. Accepted emails enable the existing reply monitor. New evidence wakes a waiting case; outbound spacing still applies. Expiry, owner revocation, customer stop requests, uncertain dispatches, and exhausted limits stop or escalate work. An uncertain send is never retried automatically.

The runner currently rejects `goal_met` because no verified financial-resolution record exists. The local follow-up implementation now links a new authorized email to the latest successful email for the same case and approved recipient. It preserves the original subject and stores immutable reply message/thread IDs. The provider receives an explicit recipient, `reply_all: false`, and empty CC/BCC lists. Mismatched thread receipts remain uncertain and cannot resend automatically. Migration 0012 passed on an isolated branch and was applied to production. The backend deployment succeeded; live threaded delivery remains unverified. Verified outcome reconciliation and live voice testing remain unfinished.

## Verification and deployment

The migration and all eleven runner tests passed on a disposable Neon branch. The latest combined suite passed 27 tests with zero failures (11 autonomous runner, 10 outreach, and 6 ElevenLabs transport tests); the five policy tests passed in an earlier run. They covered ownership, duplicate grants, concurrent scheduler delivery, revocation during model execution, ambiguous transport results, changed case evidence, unsupported success, and expiration. The run also verified a model-selected wait, evidence waking a case without bypassing contact spacing, and an accepted customer stop reply ending work without another model round or contact. Run these with `OUTREACH_TEST_DATABASE_URL` pointing to a disposable migrated branch; never run database fixtures against production.

`npm run build` passes with the existing bundle-size warning. Migration 0011, the API routes, and the worker are deployed to production. The enabled `case-autonomy` trigger runs every five minutes. An unsigned POST to the worker returned HTTP 401. The email allowlist contains only the operator’s approved setup inbox. The frontend controls are deployed and verified in the operator’s signed-in workspace. The approved own-inbox synthetic standing authorization was activated through that form; the stop control is visible. The first autonomous email was accepted by AgentMail and independently found in the operator’s Gmail inbox. The ElevenLabs/Twilio adapter was included in the backend deployment but remains disabled because the phone-number ID is absent; the dedicated outreach agent is now provisioned.

## Voice replacement

The user requested a workaround without AgentPhone after its SIP gate blocked setup. The ElevenLabs native Twilio adapter is deployed but disabled, and its setup script is present in the shared worktree. Account/number provisioning and live verification remain pending. No Twilio account existed when setup began. Do not claim the replacement is live until provisioning, callbacks, and a newly authorized call are verified.


## First live decision

The scheduled worker started the operator-authorized test in Naïve session `ses_e1eds4e6c988d40r248awzwx6p`. A transient status read returned HTTP 429 at provider capacity; the same session was retained. A later read returned `idle` / `end_turn` with a typed `contact_customer` decision. Naïve chose to request fictional employer name, incident date, and claim status/reference from the approved customer contact. Its message explicitly identifies the synthetic demo and asks for no real records or money details. Reported consumption was 9,957 micro-USD. The scheduled worker dispatched this decision at 2026-11-08 01:55 UTC. AgentMail accepted it, and Gmail independently returned the exact subject in the operator’s inbox. The authority is waiting with one outbound action used. The operator was asked to reply with fictional details to verify continuation.

The live reply transport returned the operator’s fictional employer/date/claim-status reply with accepted sender-domain authentication and a matching reference to the authorized email. The scheduled reply import succeeded at 2026-11-08 02:00:00.915 UTC, invocation `a5YGSHdoHB0Lj9eyPVfPBWzDQFHd5AqQH6md6yIllrQ`. The reply is accepted case evidence. The subsequent Naïve decision used this reply. Sender display names are normalized through the existing `mailbox` parser before matching a customer stop request; the regression fixture uses `Demo Customer <customer@example.com>` rather than a bare address.

At the next scheduled autonomy check, the imported reply advanced the case evidence and started decision round 2 in session `ses_11xtfg8xh36bey3krar9fdvxbf`. Database state confirms two decisions reserved and only one outbound message used. This verifies automatic continuation from received correspondence. The second decision completed but proposed redundant claim-stage clarification before the one-hour contact interval. No second message was sent. The runner now discards premature contact decisions and waits until the permitted time for a fresh decision, preserving consumed rounds and outbound limits. Decision inputs include the current time and earliest permitted contact time. The prompt treats an explicit no-claim-filed reply as known pre-claim status and forbids asking for the same confirmation again. This improves the next decision prompt; it does not guarantee model judgment.

The 02:10 UTC production scheduler verified the deployed timing correction: round two finished with `CONTACT_TOO_SOON`, the grant waits until 02:55:02.772 UTC (6:55pm Pacific), and outbound usage remains one. The next five-minute scheduler run after that time may use the remaining decision round. No second email or verified claim outcome exists yet.

Research-only authorities may have no contacts and `max_outbound: 0`. They can support case reading and follow-up reasoning without authorizing email or calls. A positive outbound allowance still requires a contact, and the server action guard rejects all contact attempts when the outbound cap is zero.

### Review-only authorization in the app

`src/Autonomy.tsx` defaults the permission selector to **Review only — no emails or calls**. This sends an empty contact list and a zero outbound cap. Selecting synthetic email permission shows the email fields and retains the existing two-email limit. Changing the permission selection clears the consent checkbox, so consent for review-only cannot carry over into email authorization. Both modes retain three decision rounds, 24-hour expiry, the operator restriction, and the completed-review prerequisite. The form does not itself provision a persistent session.

Run `E2E_AUTHORIZATION_UI=1 npm run test:e2e` against a local build to exercise both permission modes. Its authority POSTs are intercepted with explicit UI fixtures; the test verifies request bodies and consent reset without creating a live grant or sending messages.
