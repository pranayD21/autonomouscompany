# Agent context and repository rules

Last updated: 2026-11-07. This is the shared handoff for the medical billing advocacy product discussed by the founding team. Read this file, then [docs/README.md](docs/README.md), then only the documentation relevant to your task.

## Mandatory documentation rule

Whenever you change anything in this repository, update or add the corresponding Markdown documentation in `docs/` in the same change or commit. This applies to application code, database schemas and migrations, configuration, integrations, deployment, tests, and product behavior.

- Keep `docs/` Markdown-only: every file under it must end in `.md`. Put screenshots, binaries, source code, and generated artifacts elsewhere.
- Explain each part of the repository: its purpose, relevant file paths, behavior, interfaces, dependencies, configuration variable names, and how to run or verify it. Never include secret values or private medical information.
- Update an existing topic document when possible. Add a document for a new subsystem and link it from `docs/README.md`.
- Record what changed, why, how it was verified, and outstanding limitations in `docs/change-log.md`. Do not claim a test passed unless it ran successfully.
- Keep documentation current rather than accumulating contradictory historical descriptions. Agents should be able to recover the working context from these files without rereading a chat transcript or scanning the entire repository.
- If only documentation changes, update its index or change log as appropriate; do not create a separate document for every line edit.

## Product direction

The product name is **Assurance**, selected by the user on November 7, 2026. Use Assurance in customer-facing copy. Existing `bill-advocate` provider/resource identifiers remain stable for now; they are infrastructure names, not the product brand.

Build an agent-run insurance claim advocacy service for an injured person or policyholder. The primary communication relationship is claimant ↔ insurer/claims administrator, not patient ↔ hospital billing office. Agents organize claim evidence, prepare submissions or disputes, contact the insurer within authorization, follow up on missing information and decisions, and explain documented outcomes to the person.

The selected first demo is a workplace chemical burn at a pharmaceutical office. The person begins with contact details, an injury description, and an insurance card; agents progressively gather missing information, research coverage, manage claims and insurer exchanges, and reconcile final bills to minimize verified out-of-pocket responsibility. The target is end-to-end routine administration within scoped authorization, with truthful human-required interventions rather than guaranteed payouts.

The user explicitly named two use cases: workplace injury claims involving an employer and its insurer/claims administrator, and disputes about a health insurer's claim decision or patient responsibility after medical care. Keep separate intake and workflow paths for these; do not assume workers' compensation uses ordinary health-plan appeal rules. The injured person is the primary beneficiary. Whether an employer is the paying customer or filing party is not yet settled. Hospitals/clinicians may supply supporting evidence, but hospital bill negotiation is no longer the core product.

The user says the team has a working product. The local scaffold described in these docs is only the implementation visible in this workspace; do not assume it includes the team's entire working system.

## Hackathon context

Naïve Autonomous Company Hackathon, November 7–8, 2026, YC Office, 560 20th St., San Francisco. Hacking is scheduled from Saturday 1pm to Sunday 11am. Team: Pranay Dogra, Yuvraj Taneja, Shaunik Musukula, Ishaan Agrawal, and Prashanth Prabhala.

The event requires the Naïve SDK. Judges emphasize what the company actually accomplished, decisions agents made, and where humans intervened. Build and demonstrate an operating case workflow, including follow-up and evidence, rather than merely presenting future capabilities.

## Decisions and boundaries

- Naïve owns coordination, specialist delegation, budgets, and tool permissions. Public docs call the relevant primitive a coordinator/team; verify current SDK APIs before implementation.
- Voice provider preference: the user declined the Twilio number purchase. Do not purchase it without new authorization. Twilio is Active with $20 confirmed balance and approved identity. If Twilio encounters another issue, the user instructs switching to AgentPhone directly, without ElevenLabs, using its existing balance (reported as $20). This supersedes the earlier blanket request to avoid AgentPhone. The deployed ElevenLabs/Twilio adapter remains disabled without a number; An explicit AgentPhone fallback is deployed for new case calls via OUTREACH_VOICE_PROVIDER=agentphone; it is not selected yet. The frontend provider-neutral confirmation is committed but awaits frontend deployment before switching. Its hosted demo previously worked; SIP integration previously returned an account-not-enabled error. Preserve historical receipts, check current direct-call access before switching, and never redial an uncertain call through another provider.
- AgentMail is the proposed written follow-up channel. Neon was explicitly selected and provisioned for backend services.
- Separate potential discrepancies, verified reductions in patient responsibility, and refunds actually received. Never present estimates or simulations as money saved.
- Obtain appropriate authorization before external case actions. Do not impersonate the patient or commit them to settlements or payments without authorization.
- Use synthetic records for the public prototype unless a participant explicitly consents and the data handling is appropriate. Vendor selection alone does not establish healthcare privacy compliance.
- Do not manufacture testimonials, emotions, quotes, customer outcomes, or medical facts.

## Current handoff status

The repository now contains the React/Neon case workspace, migrations, provider setup scripts, and Naïve crew configuration. Auth, database, Function, Realtime, and two-user isolation checks pass. Provider accounts and synthetic voice agents are provisioned. Gateway inference remains unavailable with no enabled model. A user-authorized AgentPhone hosted-voice test completed successfully, but its SIP gate led the user to request an ElevenLabs/Twilio replacement; that adapter remains disabled pending provisioning. The app is hosted at https://assurance.claims. A bounded own-inbox autonomous test delivered its first Naïve-selected email; its fictional reply was imported automatically and triggered a second Naïve decision. A premature follow-up exposed a timing issue now covered by server deferral and clearer prompt inputs. Complete case advocacy is not yet verified. See [implementation status](docs/implementation-status.md) and [stack operations](docs/stack.md) before making readiness claims.

## Documentation map

- [Insurer-first workflow](docs/insurance-workflows.md)
- [Product and business direction](docs/product.md)
- [Architecture and repository map](docs/architecture.md)
- [Neon setup and operations](docs/neon.md)
- [Demo, interviews, and storytelling](docs/demo-and-research.md)
- [Implementation status and next steps](docs/implementation-status.md)
- [Account setup and agent stack](docs/stack.md)
- [Change log](docs/change-log.md)

## Working preferences

Preserve existing configuration and user changes. Never commit `.env` files, credentials, access tokens, participant records, or call recordings. Use installed Neon skills and current official documentation when working on Neon. For human-facing writing, use `human-writing-stack` when available; preserve facts and use natural, concrete wording. Never treat a proposal in these docs as proof of implementation.
