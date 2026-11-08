# Implementation status

Updated November 8, 2026 UTC. This document supersedes the older milestone descriptions. [Hosted agent](hosted-agent.md) explains the current runtime; [change log](change-log.md) retains historical verification.

## Current implementation

Assurance uses email/web sign-in, separate workplace-injury and health-insurance intake, private documents with owner-confirmed transcription, and owner-written permission for one persistent direct-model run. Saving a case does not start work. The agent sets a stable goal/finish condition, uses case-scoped tools, retrieves public sources, contacts authorized destinations, monitors replies, follows up, requests owner input, and records evidence-backed reported outcomes. Owner resume retains the same permission and conversation; stop revokes credentials and fences future work. An in-flight communication may finish.

Direct cases use OpenAI `gpt-5.4-mini`, not Naïve runtime execution. Legacy Naïve sessions/grants retain their existing restrictions and cannot also execute a direct authority. General Naïve configuration remains separate from case connectors. No AI Gateway inference is required for this path; its earlier lack of enabled models remains unresolved. Payments remain hypothetical.

## Deployment checkpoint

Production Neon project `calm-dawn-50594047`, branch `br-square-pine-bewan9j8`, now has all 25 migrations (0000–0024). All seven Functions were explicitly deployed with private environment preservation. Autopoll receives the direct-model key; cases receives it for document extraction. `ASSURANCE_DIRECT_ACTIVATION_ENABLED=true`; the hosted owner API has created direct runs for fresh non-operator accounts and rejected a second account's access/control. The direct scheduler ticks every minute and claims one due direct run; idle cases do not infer.

The new frontend has not yet been pushed at this checkpoint. A real hosted zero-outreach model turn and hosted document upload/extraction/confirmation passed. Resume exposed stale evidence handling, and the email fixture exposed a missing tool argument; both rejected before dispatch. Corrections are tested and being deployed before continuing those same fixtures. Do not infer completion from the deployment command.

## Verification already completed

- Expanded activation, runner, and full fictional exchange: 18 tests passed against the disposable database. This includes persisted conversation, stable goal, restart/429 recovery, explicit resume, concurrent leases, operation retries, uncertain dispatch, incoming replies, threaded follow-up, sourced simulated outcome, and stop.
- Legacy session/setup/provisioning, case-tool service, phone, and v2 action regressions: 71 passed serially.
- Local fallback/Naïve retry/activation-state tests: 10 passed. Public-source/direct-reader tests: 8 passed. Direct document route tests: 3 passed.
- Mocked activation UI and production build passed. Secret-value scan found no matches in tracked/unignored files.
- Live direct OpenAI image transcription matched a fictional card. Live public-source retrieval returned actual page text and metadata. Hosted extraction still needs its own verification.
- Existing revoked Naïve rotation session cleanup succeeded: remote session cancelled, vault credentials/vault/identity and local fixture rows removed, zero outbound rows.

## External limits and evidence boundaries

AgentPhone remains the only new-call provider. Registration readback is `pending`, with `outboundSms=registration_required`; `PHONE_FLOW_ENABLED=false`. No new real call, SMS, or inbound routing activation is part of this verification. Phone login is separately implemented with Twilio Verify and five public fictional test accounts; the Verify service was created and settings readback passed. Real SMS login is under verification. Existing email accounts retain a sign-in link.

The user authorized exactly one clearly fictional test email to their consenting inbox. This does not authorize sending fictional injury claims to actual insurers. A simulated insurer exchange is not a real payout, patient outcome, or verified healthcare-compliance claim. Source retrieval is public HTTPS navigation, not a general search-engine integration. Scanned PDFs without a text layer require page images. The build still reports a large JavaScript chunk warning.
