# Implementation status

Updated November 8, 2026 UTC. This document supersedes older milestone descriptions. [Hosted agent](hosted-agent.md) explains the runtime; [change log](change-log.md) retains the verification history.

## Current integration checkpoint

Latest hosted result, November 8, 2026: the zero-contact onboarding fixture now runs from CEO allocation through a started advocate session to a persisted first goal, with no outreach. Its onboarding events were not yet marked finished, so the formal proof has not passed. The first real phone case, opened from a callback, has its CEO and Front Desk events parked `human_required`, with no budget or advocate. Details are in the [change log](change-log.md).

The Naïve company expansion is in progress and has not yet been published as a frontend release. The production backend has eight Functions, including `firm`, and migrations 0000–0029 (30 journal entries). Six permanent Naïve roles, their separate identities/vaults, and the company board exist. Three recurring role schedules are configured but disabled pending live verification. The selected model rejected the `loose` completion window; hosted company sessions use `immediate`.

The new local frontend uses email sign-in, email intake, website conversation, uploads, and Gmail connection controls. The public site still serves the previous release until the reviewed changes are pushed. Phone/SMS/Mac Messages are historical experiments, outside the new customer path; `PHONE_FLOW_ENABLED=false` remains in force.

The scoped AgentMail runtime key and five-event signed webhook are configured and deployed. Hosted checks passed public contact discovery, authentication boundaries, invalid-signature rejection, and signed unmapped-event handling without outreach. Actual provider delivery to this webhook, customer Gmail consent, dedicated-inbox advocate hiring, and the full company hiring path remain separate live proof obligations. The zero-contact advocate fixture completed a real hosted question → owner answer → sourced fact continuation in its existing run; owner revoke, credential invalidation, local stop, and remote cancellation were then verified with zero outreach.

One idle direct run was migrated to Naïve staffing under its existing authority, preserving conversation and goal and revoking the old credential. No simultaneous engine execution is intended. The live firm fixture reached Front Desk, read its case, and attempted board work; board-operation reconciliation and staffing are still being completed. Do not present this as a fully operating company yet.

Autonomous insurer-portal submission is an explicit requirement and an actual missing capability at this checkpoint. Gmail/email tools do not provide it. Implementation is deferred until the hosted core workflow and email-first authentication audit pass. The implementation must isolate authenticated browser access per case and retain submission reservations, receipts, and uncertain-result reconciliation. Validation will use a fictional portal unless authorized real access is available. No fictional claim may be submitted to a real insurer.

## Earlier hosted baseline

The earlier direct-model release at https://assurance.claims verified activation, persistence, document extraction, owner isolation, stop, one delivered fictional email, and phone login. These results below remain historical evidence; they do not prove the new Naïve company workflow. GitHub main publishes the frontend automatically, while Neon backend deployment is separate.

## Verified hosted behavior

- Fresh non-operator owner activation created exactly one direct run. A second account could not read, resume, revoke, or view its actions.
- The real deployed scheduler/model set a stable goal, requested owner input, and made zero outbound actions. An owner update/resume continued the same conversation, persisted a sourced incident-date fact, retained the goal, and returned to waiting. The resumed model used a prose waiting status rather than a second formal human-help action.
- A fictional card was uploaded through the hosted API, read with the exact expected member/insurer fields, confirmed once despite repeated confirmation, and denied to another owner.
- Exactly one explicitly authorized fictional email was sent by the hosted direct run. Its provider receipt exists and Gmail independently showed the message in the recipient's inbox. No actual insurer was contacted. The run then requested human input and was revoked.
- Both live case fixtures were revoked and stayed unchanged, with no new outreach, across the two-minute scheduler observation window.
- Phone status reports login enabled, real SMS ready, and five fictional test numbers. Twilio Verify's Assurance service was created once and read back with six-digit codes. One authorized real SMS was accepted, the received code verified, the scoped API identity and live dashboard worked, and the session signed out. No resend occurred.
- Two different fictional phone accounts signed in through the live UI, retained identity across sign-out/sign-in, and could not access each other's case. Their test case was removed.
- Hosted email E2E passed signup, password sign-in after sign-out, persistence, Realtime, negative authentication checks, owner isolation, deletion, and the older-email link.

## Local/service verification

The expanded runner/workflow/action regression passed 23 tests after live tool-input corrections. Earlier activation tests passed 3/3; legacy session/setup/provisioning/tool/phone/action regressions passed 71/71 serially. The final phone backend passed 16/16 tests and six affected checks again after separating login and notification readiness. Verify setup passed four fake-transport tests. Document routes passed 3/3; source/direct-reader tests passed 8/8; fallback/retry/activation tests passed 10/10. Mocked activation and phone UI checks passed. Build and secret-value scan passed.

The complete fictional insurer exchange used real MCP/service/database code with a scripted model and fake communications: activation, restart/429 recovery, first contact, accepted incoming reply, threaded follow-up, sourced simulated outcome, and stop. It is distinct from the one real delivered email and is not a real claim outcome.

Live checks exposed two recoverable issues: a missing required email-tool argument and stale case references after a fact write. Neither produced a dispatch. The runner now distinguishes definite input rejection from uncertain communication, returns actionable stale-evidence errors, and retains final status text. The existing fixtures continued under unchanged permissions after explicit receipt/ledger reconciliation; no replacement grant or duplicate send was created.

## Earlier baseline boundaries

AgentPhone is still the only new-call provider. Its SMS registration remains pending with `outboundSms=registration_required`. `PHONE_FLOW_ENABLED=false`: inbound routing and case-notification texts remain off. Twilio Verify handles login codes only; no Twilio number was bought and no voice integration was changed.

Five public fixed-code accounts are shared fictional identities, not proof of real phone ownership. They must contain only made-up data. Existing email cases are not automatically merged into a phone account; linking requires both identities.

The earlier release kept payments hypothetical; the current company implementation permits unconfirmed Stripe test PaymentIntents only, with no real collection. No real payout, patient outcome, or healthcare-compliance certification is claimed. General public-source retrieval/navigation works; no general search-engine integration was added. Scanned PDFs without a text layer require page images. The optional legacy AI Gateway review remains unavailable and its broken entry button is removed. The JavaScript bundle still produces the size warning.

The old revoked Naïve rotation session, vault credentials/vault/identity, and local fixture rows were cleaned successfully with zero outbound rows.

## Mac messaging implementation

This historical experiment is outside the current customer path. The computer-based bridge is implemented with private send-once journaling, a hosted notification queue, receipts, scoped replies, and STOP handling. Migration0025 is applied (26 total migrations). The user selected the existing Mac SMS sender; local automation/account checks pass, but the running helper still lacks Messages database access after a reported Full Disk Access change. The bridge API is configured, while PHONE_FLOW_ENABLED stays false. No real Mac send or reply has been verified and inbound routing remains unchanged. See mac-messages-bridge.md and mac-messages-local.md.
