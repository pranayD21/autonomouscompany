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

Build an agent-run medical billing advocacy company. A user supplies a medical bill and ideally an explanation of benefits (EOB), or an insurance claim/denial. Agents investigate discrepancies, contact hospital billing and insurance representatives, collect missing documents, follow up, and report a documented outcome.

The proposed first focus is hospital bill/EOB reconciliation. Denied-claim appeals are a later expansion because they can require more formal documentation and clinical judgment. This is a recommendation from planning, not a completed product capability.

The user says the team has a working product. The local scaffold described in these docs is only the implementation visible in this workspace; do not assume it includes the team's entire working system.

## Hackathon context

Naïve Autonomous Company Hackathon, November 7–8, 2026, YC Office, 560 20th St., San Francisco. Hacking is scheduled from Saturday 1pm to Sunday 11am. Team: Pranay Dogra, Yuvraj Taneja, Shaunik Musukula, Ishaan Agrawal, and Prashanth Prabhala.

The event requires the Naïve SDK. Judges emphasize what the company actually accomplished, decisions agents made, and where humans intervened. Build and demonstrate an operating case workflow, including follow-up and evidence, rather than merely presenting future capabilities.

## Decisions and boundaries

- Naïve owns coordination, specialist delegation, budgets, and tool permissions. Public docs call the relevant primitive a coordinator/team; verify current SDK APIs before implementation.
- The user selected Agent Phone for telephony or ElevenLabs for voice handling. AgentPhone is agentphone.ai. Its hosted demo is configured; SIP access for ElevenLabs was requested and remains pending. Do not silently replace them with Twilio/OpenAI voice.
- AgentMail is the proposed written follow-up channel. Neon was explicitly selected and provisioned for backend services.
- Separate potential discrepancies, verified reductions in patient responsibility, and refunds actually received. Never present estimates or simulations as money saved.
- Obtain appropriate authorization before external case actions. Do not impersonate the patient or commit them to settlements or payments without authorization.
- Use synthetic records for the public prototype unless a participant explicitly consents and the data handling is appropriate. Vendor selection alone does not establish healthcare privacy compliance.
- Do not manufacture testimonials, emotions, quotes, customer outcomes, or medical facts.

## Current handoff status

The repository now contains the React/Neon case workspace, migrations, provider setup scripts, and Naïve crew configuration. Auth, database, Function, Realtime, and two-user isolation checks pass. Provider accounts and synthetic voice agents are provisioned. Gateway inference remains blocked by gateway credits; SIP approval is pending. A user-authorized AgentPhone hosted-voice test completed successfully. Complete case advocacy is not yet verified. See [implementation status](docs/implementation-status.md) and [stack operations](docs/stack.md) before making readiness claims.

## Documentation map

- [Product and business direction](docs/product.md)
- [Architecture and repository map](docs/architecture.md)
- [Neon setup and operations](docs/neon.md)
- [Demo, interviews, and storytelling](docs/demo-and-research.md)
- [Implementation status and next steps](docs/implementation-status.md)
- [Account setup and agent stack](docs/stack.md)
- [Change log](docs/change-log.md)

## Working preferences

Preserve existing configuration and user changes. Never commit `.env` files, credentials, access tokens, participant records, or call recordings. Use installed Neon skills and current official documentation when working on Neon. For human-facing writing, use `human-writing-stack` when available; preserve facts and use natural, concrete wording. Never treat a proposal in these docs as proof of implementation.
