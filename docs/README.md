# Project documentation

Read [../agents.md](../agents.md) first. These Markdown files are the durable product and engineering context; they replace the need to reconstruct earlier conversations.

## Judge and reviewer reading path

1. [Judging guide](judging-guide.md): company workflow, delivered work, decisions, human involvement, Naïve use, acquisition, and economics.
2. [Verification](verification.md): team-reported real-user activity, hosted checks, and scripted test evidence, kept distinct.
3. [Implementation status](implementation-status.md): recorded behavior and dated validation.
4. [Company agents](firm-blueprint.md) and [company runtime](firm-runtime.md): roles, SDK declarations, staffing, permissions, and durable operations.
5. [Test-only finance](payments.md) and [product direction](product.md): fee calculation, cost attribution, and customer scope.

For the customer experience, see [phone onboarding](phone-onboarding.md), [website conversation](web-chat.md), and [claim workspace design](claim-chat-design.md). For setup and verification commands, use [running Assurance](running.md).

Every repository change must update the relevant documentation in the same change. Keep `docs/` Markdown-only. Topic documents describe behavior; dated verification records establish what was observed. Existing file paths are preserved.

## Product and customer workflows

- [product.md](product.md): Customer problem, claim types, beneficiary, and business direction.
- [insurance-workflows.md](insurance-workflows.md): Separate workplace-injury and health-insurance dispute procedures.
- [phone-onboarding.md](phone-onboarding.md): Current verified-phone, requested-call, transcript, and case-creation journey.
- [activation-flow.md](activation-flow.md): Case submission, standard handling scope, activity, and stop controls.
- [web-chat.md](web-chat.md): Owner and advocate conversation, uploads, and safe continuation.
- [web-chat-ui.md](web-chat-ui.md): Conversation UI behavior, retries, and responsive layout.
- [claim-chat-design.md](claim-chat-design.md): Chat-first workspace, composer uploads, design decisions, and isolated fixture.
- [frontend.md](frontend.md): Landing page, workspace routes, mobile behavior, and UI verification.
- [documents.md](documents.md): Private uploads, storage, extraction, ownership, and retries.
- [research.md](research.md): Public-source selection, retrieval, snapshots, citations, and legacy review research.
- [outreach.md](outreach.md): Authorized email and voice actions, active recipient restrictions, and send-once records.
- [agentmail-ingress.md](agentmail-ingress.md): Signed email intake, shared-inbox case routing, leads, and attachments.
- [replies.md](replies.md): Thread-bound reply ingestion, sender checks, held messages, and evidence attribution.
- [outcomes.md](outcomes.md): Agent-reported decisions, amounts, exact supporting quotes, and readback.
- [case-portals.md](case-portals.md): Case-isolated browser service and mocked-provider verification; service code is distinct from a proven customer journey.

## Company and case-agent runtime

- [firm-blueprint.md](firm-blueprint.md): Six permanent Naïve roles, identities, vaults, tools, and declared schedules.
- [firm-runtime.md](firm-runtime.md): Company events, staffing, budgets, board, business-result checks, and recovery.
- [agent-tools.md](agent-tools.md): Case-scoped MCP tools, credentials, source attribution, and authorization.
- [case-sessions.md](case-sessions.md): Durable advocate sessions, event delivery, leases, and provisioning.
- [naive-case-goals.md](naive-case-goals.md): Persistent initial goals, finish conditions, and attributed refinements.
- [naive-capacity.md](naive-capacity.md): Shared request admission, cooldowns, and idle-case load reduction.
- [payments.md](payments.md): Stripe test-only fees, partial cost attribution, and zero real collection.
- [persistent-workflow-migration.md](persistent-workflow-migration.md): Persistent authority and engine boundaries, including preserved older runs.
- [naive-restoration.md](naive-restoration.md): Naïve engine selection, provisioning, and dated restoration checks.

## Setup and operations

- [architecture.md](architecture.md): Repository map, service boundaries, and agent architecture.
- [running.md](running.md): Build and test entry points, production-connected local client, and isolated fixture.
- [stack.md](stack.md): Account and provider setup, with historical review-crew configuration identified.
- [neon.md](neon.md): Backend services, database, deployment, and environment configuration.
- [hosting.md](hosting.md): Frontend hosting, production endpoints, and deployment verification.
- [auto-deploy.md](auto-deploy.md): GitHub-to-Vercel frontend deployment and separate backend deployment.
- [voice-agentphone.md](voice-agentphone.md): Current new-call provider and historical receipt handling.
- [twilio-verify-setup.md](twilio-verify-setup.md): Phone-login verification setup, separate from voice calling.
- [auth-session-recovery.md](auth-session-recovery.md): Recorded phone-session fault, credential preservation, and recovery behavior.
- [RESUME-HANDOFF.md](RESUME-HANDOFF.md): Operational handoff and private-journal references; do not repeat historical mutations.

## Evidence and walkthroughs

- [judging-guide.md](judging-guide.md): Hackathon evidence map, actual accomplishments, engine attribution, and human involvement.
- [verification.md](verification.md): Team reports, hosted records, independently reproduced checks, and test scope.
- [implementation-status.md](implementation-status.md): Current-system description and dated verification evidence.
- [demo-and-research.md](demo-and-research.md): Participant consent, research, and truthful product walkthroughs.
- [demo-upload-artifacts.md](demo-upload-artifacts.md): Fictional workplace-injury upload packet and its provenance.
- [change-log.md](change-log.md): Dated implementation, investigation, corrections, and validation records.

## Historical and compatibility paths

- [autonomy.md](autonomy.md): Version-1 bounded authority; earlier grants retain their original rules.
- [crew-monitoring.md](crew-monitoring.md): Review-crew session completion and saving for the existing review path.
- [reply-monitoring.md](reply-monitoring.md): Scheduled thread monitoring retained alongside current webhook ingestion.
- [hosted-agent.md](hosted-agent.md): Historical direct-model case runner, plus shared direct document/title services.
- [demo-fallback.md](demo-fallback.md): Separate local direct-model fallback and its test provenance.
- [phone-first.md](phone-first.md): Phone-login details and the older inbound/SMS flow, whose general flow gate stays off.
- [mac-messages-bridge.md](mac-messages-bridge.md): Optional notification bridge outside the current customer path, gated off.
- [mac-messages-local.md](mac-messages-local.md): Local Mac runner configuration for that optional bridge.
- [mac-messages-tests.md](mac-messages-tests.md): Synthetic database and bridge verification records.
- [sip-access.md](sip-access.md): Superseded SIP access record; current calls use hosted AgentPhone.
- [voice-twilio.md](voice-twilio.md): Superseded ElevenLabs/Twilio voice record.
