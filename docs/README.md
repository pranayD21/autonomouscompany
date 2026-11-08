# Project documentation

Read [../agents.md](../agents.md) first. These Markdown files are the durable product and engineering context; they replace the need to reconstruct earlier conversations.

| Document | Read when |
| --- | --- |
| [product.md](product.md) | Understanding customers, scope, business model, and hackathon fit |
| [architecture.md](architecture.md) | Locating code or designing agent and service boundaries |
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
