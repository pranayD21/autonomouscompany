# Project documentation

See [claim-chat-design.md](claim-chat-design.md) for the chat-first claim workspace, design-jury decisions, composer uploads, and transparency disclosures.

Read [../agents.md](../agents.md) first. These Markdown files are the durable product and engineering context; they replace the need to reconstruct earlier conversations.

| Document | Read when |
| --- | --- |
| [product.md](product.md) | Understanding customers, scope, business model, and hackathon fit |
| [architecture.md](architecture.md) | Locating code or designing agent and service boundaries |
| [frontend.md](frontend.md) | Changing the workspace UI, mobile layouts, next-step logic, routes, or copy rules |
| [neon.md](neon.md) | Configuring backend services, credentials, deployment, and tooling |
| [demo-and-research.md](demo-and-research.md) | Finding participants, recording interviews, or editing the demo |
| [implementation-status.md](implementation-status.md) | Checking what actually exists, verification evidence, and unfinished work |
| [change-log.md](change-log.md) | Reviewing changes and their validation |

Every repository change must update the relevant documentation in the same change. Keep this directory exclusively `.md` files. The repository map describes the tracked implementation; implementation status distinguishes deployed and verified behavior from unfinished work.

- [Account setup and agent stack](stack.md)
- [Case outreach](outreach.md)
- [Insurer-first workflows](insurance-workflows.md)

- [Private case documents](documents.md): upload, storage, ownership, retry behavior, and extraction limitations.
- [Official-source research](research.md): source selection, retrieval, immutable snapshots, citations, and coverage limits.
- [Case email replies](replies.md): thread ingestion, sender checks, held messages, evidence revisions, and correspondence references.

- [Scheduled reply monitoring](reply-monitoring.md): owner controls, Neon trigger, retries, leases, and verification.

- [Scheduled review saving](crew-monitoring.md): Naïve session checks, immutable validation, leases, and recovery.

- [Hosted frontend](hosting.md): Vercel build, public configuration, exact origins, and verification.

- [SIP account access](sip-access.md): live provider rejection, required enablement, and post-approval routing steps.

- [ElevenLabs/Twilio voice](voice-twilio.md): AgentPhone replacement, account setup, call controls, and verification limits.

- [Naïve case autonomy](autonomy.md): standing authorization, durable decisions, stop controls, and synthetic test limits.

- [Expanded autonomy proposal](autonomy-plan.md): user-supplied target architecture; proposal statements are not proof of implementation. The user superseded its coordination instruction and assigned all files to this agent.

- [Case tool server](agent-tools.md): MCP transport, case credentials, sourced statements, and verification.

- [Persistent case sessions](case-sessions.md): durable session bindings, inbound event delivery, scheduler leases, and activation requirements.

- [Recorded case outcomes](outcomes.md) — agent calculations, exact evidence quotes, retry handling, and verification limits.

- [Test-mode finance](payments.md) — unconfirmed Stripe test PaymentIntents, cost reporting, and no real collection.

- [AgentPhone-only voice](voice-agentphone.md): current new-call provider, configuration, historical receipts, and verification.

- [Naïve capacity](naive-capacity.md): shared request admission, cooldowns, idle-case load reduction, and escalation status.

- [Automatic frontend deployments](auto-deploy.md): GitHub connection, production branch, and separate Neon backend deployment.

- [Phone-first accounts and document texts](phone-first.md): inbound intake, verified phone sign-in, existing-account linking, portal requests, notifications, and SMS activation gate.

- [Persistent workflow migration](persistent-workflow-migration.md): current user override, provider requirements, migration plan, and recovery status.

- [Direct-model demo fallback](demo-fallback.md): minimal Naïve handoff, local direct inference, exclusive-case requirements, and verification limits.

- [Case activation and status](activation-flow.md): submission scope, owner updates, start/stop controls, engine attribution, and UI verification.

- [Resume handoff](RESUME-HANDOFF.md): deployed release, private test journals, and remaining external gates for a new chat.

- [Hosted direct-model agent](hosted-agent.md): scheduler, durable conversation, research/document tools, engine separation, and hosted verification.

- [Twilio Verify setup](twilio-verify-setup.md): read-only planning and explicit service creation for phone login, separate from AgentPhone voice.

- [Upload artifacts](demo-upload-artifacts.md): coherent fictional incident, insurance card, visit, employer acknowledgment, and pending claim-review files.

- [Mac Messages bridge](mac-messages-bridge.md): hosted notification queue, authenticated local bridge, receipt and reply handling.
- [Local Mac runner](mac-messages-local.md): sender setup, macOS permissions, private journal, and read-only checks.
- [Mac bridge verification](mac-messages-tests.md): isolated database tests and covered failure paths.
- [Naïve stable goals](naive-case-goals.md): case-bound goal persistence, MCP tool, and action prerequisites.
- [Naïve restoration](naive-restoration.md): engine selection, v2 lifecycle compatibility, provider budget configuration, and hosted verification.
- [Website chat UI](web-chat-ui.md): persistent owner/agent conversation, message retries, attachments, and responsive UI verification.
- [Website case conversation](web-chat.md): durable owner/agent messages, case-scoped API, safe resume, and document requests without SMS.
- [Permanent company agents](firm-blueprint.md): Naïve role declarations, identities, vaults, schedules, setup script, and verification boundaries.

- [AgentMail intake and replies](agentmail-ingress.md): signed webhooks, email lead claiming, case inbox routing, and invitation delivery ledger.
- [Company runtime](firm-runtime.md): durable company events, role tools, case staffing, budgets, board, learning, and verification boundaries.

- [Authentication session recovery](auth-session-recovery.md): historical phone-session token contention, preserved login credentials, and verification boundaries.
- [Case-isolated native browser portals](case-portals.md): portal service, private owner connection, durable action receipts and current upload gap.

- [Requested phone onboarding](phone-onboarding.md): verified phone → one requested AgentPhone call → owner transcript → automatic isolated Naïve case setup, with no-redial recovery.
