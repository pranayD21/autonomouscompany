# Project documentation

Read [../agents.md](../agents.md) first. These Markdown files are the durable product and engineering context; they replace the need to reconstruct earlier conversations.

| Document | Read when |
| --- | --- |
| [product.md](product.md) | Understanding customers, scope, business model, and hackathon fit |
| [architecture.md](architecture.md) | Locating code or designing agent and service boundaries |
| [frontend.md](frontend.md) | Changing the workspace UI, next-step logic, routes, or copy rules |
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

- [Hypothetical payments](payments.md) — Stripe sandbox setup and the current no-collection product scope.

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
