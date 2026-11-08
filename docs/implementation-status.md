# Implementation status

Updated November 8, 2026 UTC. This document supersedes older milestone descriptions. [Hosted agent](hosted-agent.md) explains the runtime; [change log](change-log.md) retains the verification history.

## Hosted release

Assurance is live at https://assurance.claims. Main commit `d4f535e` published the new frontend automatically; the public HTML serves the expected `index-iqqqwjLX.js` bundle. The production Neon branch has all 25 migrations (0000–0024), and all seven Functions were explicitly deployed. Autopoll runs every minute, claims one due direct run, and makes no inference requests for idle cases.

A person can sign in by phone, use a fictional shared demo number, or open the older-email-account sign-in link. Workplace-injury and health-insurance paths stay separate. Private documents are transcribed through direct OpenAI and become case evidence only after owner confirmation. Saving a case does not start work: the owner writes permission and starts a persistent run. The agent records a stable goal/finish condition, retrieves public sources, uses case-scoped tools, sends authorized communications, monitors replies, follows up, requests input, and records evidence-backed reported outcomes.

Direct runs use OpenAI `gpt-5.4-mini`; they are clearly labeled and do not claim Naïve runtime execution. Legacy Naïve grants/sessions remain separate and cannot act on the same direct authority. Owner resume retains permission and conversation. Stop revokes credentials and prevents new work; a communication already in flight may finish. Ambiguous sends are never automatically replayed.

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

## Remaining boundaries

AgentPhone is still the only new-call provider. Its SMS registration remains pending with `outboundSms=registration_required`. `PHONE_FLOW_ENABLED=false`: inbound routing and case-notification texts remain off. Twilio Verify handles login codes only; no Twilio number was bought and no voice integration was changed.

Five public fixed-code accounts are shared fictional identities, not proof of real phone ownership. They must contain only made-up data. Existing email cases are not automatically merged into a phone account; linking requires both identities.

Payments remain hypothetical. No real payout, patient outcome, or healthcare-compliance certification is claimed. General public-source retrieval/navigation works; no general search-engine integration was added. Scanned PDFs without a text layer require page images. The optional legacy AI Gateway review remains unavailable and its broken entry button is removed. The JavaScript bundle still produces the size warning.

The old revoked Naïve rotation session, vault credentials/vault/identity, and local fixture rows were cleaned successfully with zero outbound rows.
