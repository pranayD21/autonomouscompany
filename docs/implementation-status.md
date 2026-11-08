# Implementation status

Updated November 8, 2026 UTC. This document supersedes older milestone descriptions. [Company runtime](firm-runtime.md) and [case sessions](case-sessions.md) explain the current Naïve runtime; [hosted agent](hosted-agent.md) documents the historical direct-model runner and shared direct services; [change log](change-log.md) retains the verification history.

Assurance is a functioning insurance claims advocacy service. The team reports manual UI testing and a real-user production run through phone intake, advocate staffing, and website conversation on November 8, 2026; see the [corrected timeline and engineering interventions](verification.md#real-user-run). That case was restricted to the owner’s designated inbox, with no insurer contact or claim outcome. The sections below record the specific evidence held in this repository. Historical fictional runs stay labeled as test evidence.

## Current system

The customer path is phone-first: Twilio Verify sign-in, one requested AgentPhone onboarding call, an owner-bound transcript, automatic case creation, and an isolated Naïve advocate, followed by website chat and uploads. See [phone onboarding](phone-onboarding.md). Older email accounts and cases remain supported.

The backend declares seven Functions, including `firm`, and migrations 0000–0031 (32 journal entries). Six permanent Naïve roles, their separate identities and vaults, and the company board are configured. The recorded zero-contact fixture exercised CEO allocation, Front Desk hiring, and advocate startup through its first saved goal; configuration of six roles does not establish completed work by all six. See [company runtime](firm-runtime.md) and [verification](verification.md). Hosted company sessions use the `immediate` completion window because the selected model rejected `loose`. GitHub main publishes the frontend automatically; Neon backend deployment is separate.

The scoped AgentMail runtime key and five-event signed webhook are configured and deployed. Hosted checks passed public contact discovery, authentication boundaries, invalid-signature rejection, and signed unmapped-event handling without outreach. A zero-contact advocate fixture completed a real hosted question → owner answer → sourced fact continuation in its existing run; owner revoke, credential invalidation, local stop, and remote cancellation were then verified with zero outreach.

One idle direct run was migrated to Naïve staffing under its existing authority, preserving conversation and goal and revoking the old credential. No simultaneous engine execution is intended. The live firm fixture reached Front Desk and read its case. [Resume handoff](RESUME-HANDOFF.md) holds the later staffing receipts.

## Earlier hosted baseline

These results come from the earlier direct-model release at https://assurance.claims and remain historical evidence.

- Fresh non-operator owner activation created exactly one direct run. A second account could not read, resume, revoke, or view its actions.
- The real deployed scheduler/model set a stable goal, requested owner input, and made zero outbound actions. An owner update/resume continued the same conversation, persisted a sourced incident-date fact, retained the goal, and returned to waiting. The resumed model used a prose waiting status rather than a second formal human-help action.
- A fictional card was uploaded through the hosted API, read with the exact expected member/insurer fields, confirmed once despite repeated confirmation, and denied to another owner.
- Exactly one explicitly authorized fictional email was sent by the hosted direct run. Its provider receipt exists and Gmail independently showed the message in the recipient's inbox. No actual insurer was contacted. The run then requested human input and was revoked.
- Both live case fixtures were revoked and stayed unchanged, with no new outreach, across the two-minute scheduler observation window.
- Phone status reported login enabled, real SMS ready, and five fictional test numbers. Twilio Verify's Assurance service was created once and read back with six-digit codes. One authorized real SMS was accepted, the received code verified, the scoped API identity and live dashboard worked, and the session signed out. No resend occurred.
- Two different fictional phone accounts signed in through the live UI, retained identity across sign-out/sign-in, and could not access each other's case. Their test case was removed.
- Hosted email E2E passed signup, password sign-in after sign-out, persistence, Realtime, negative authentication checks, owner isolation, deletion, and the older-email link.

## Local/service verification

The expanded runner/workflow/action regression passed 23 tests after live tool-input corrections. Earlier activation tests passed 3/3; legacy session/setup/provisioning/tool/phone/action regressions passed 71/71 serially. The final phone backend passed 16/16 tests and six affected checks again after separating login and notification readiness. Verify setup passed four fake-transport tests. Document routes passed 3/3; source/direct-reader tests passed 8/8; fallback/retry/activation tests passed 10/10. Mocked activation and phone UI checks passed. Build and secret-value scan passed.

The complete fictional insurer exchange used real MCP/service/database code with a scripted model and fake communications: activation, restart/429 recovery, first contact, accepted incoming reply, threaded follow-up, sourced simulated outcome, and stop. It is distinct from the one real delivered email and is not a real claim outcome.

Live checks exposed two recoverable issues: a missing required email-tool argument and stale case references after a fact write. Neither produced a dispatch. The runner now distinguishes definite input rejection from uncertain communication, returns actionable stale-evidence errors, and retains final status text. The existing fixtures continued under unchanged permissions after explicit receipt/ledger reconciliation; no replacement grant or duplicate send was created.

The old revoked Naïve rotation session, vault credentials/vault/identity, and local fixture rows were cleaned successfully with zero outbound rows.

## Provider notes

AgentPhone is the only new-call provider. Twilio Verify handles login codes only; no Twilio number was bought and no voice integration was changed.

The Mac Messages bridge is outside the customer path. It has private send-once journaling, a hosted notification queue, receipts, scoped replies, and STOP handling, and stays inert while `PHONE_FLOW_ENABLED=false`. See [Mac Messages bridge](mac-messages-bridge.md) and [local Mac runner](mac-messages-local.md).
