# Agent context and repository rules

Last updated: 2026-11-08 UTC. This is the shared handoff for the medical billing advocacy product discussed by the founding team. Read this file, then [docs/README.md](docs/README.md), then only the documentation relevant to your task.

## Mandatory documentation rule

Whenever you change anything in this repository, update or add the corresponding Markdown documentation in `docs/` in the same change or commit. This applies to application code, database schemas and migrations, configuration, integrations, deployment, tests, and product behavior.

- Keep `docs/` Markdown-only: every file under it must end in `.md`. Put screenshots, binaries, source code, and generated artifacts elsewhere.
- Explain each part of the repository: its purpose, relevant file paths, behavior, interfaces, dependencies, configuration variable names, and how to run or verify it. Never include secret values or private medical information.
- Update an existing topic document when possible. Add a document for a new subsystem and link it from `docs/README.md`.
- Record what changed, why, how it was verified, and outstanding limitations in `docs/change-log.md`. Do not claim a test passed unless it ran successfully.
- Keep documentation current rather than accumulating contradictory historical descriptions. Agents should be able to recover the working context from these files without rereading a chat transcript or scanning the entire repository.
- If only documentation changes, update its index or change log as appropriate; do not create a separate document for every line edit.

## Current autonomy instruction

The latest user instruction supersedes earlier synthetic-only, bounded-review, per-contact approval, recipient allowlist, decision/message-count, contact-spacing, case-expiry, and fixed repository-budget requirements. Implement one persistent agent run per case. The latest target runs every company agent, including each case advocate, on Naïve. Direct OpenAI was a temporary fallback; preserve old runs without allowing two engines to act on one authority. The firm includes permanent management roles and one isolated advocate per client. Verify current Naïve APIs against its live OpenAPI specification. The owner submits a case under the displayed standard handling scope; no separate permission essay or checkbox is required. Earlier grants keep their original scope. The agent writes a stable goal/finish condition and chooses sources, contacts, message content, timing, questions, and completion. Preserve identity boundaries, source integrity, revocation, truthful evidence, and duplicate-send protections. Request-level Naïve capacity controls remain in force and are not case-work caps. Authentication abuse controls and provider protocol constraints are separate. See [persistent workflow migration](docs/persistent-workflow-migration.md). Earlier demo limits below are historical and must not be reintroduced into the new path.

## Product direction

The product name is **Assurance**, selected by the user on November 7, 2026. Use Assurance in customer-facing copy. Existing `bill-advocate` provider/resource identifiers remain stable for now; they are infrastructure names, not the product brand.

Build an agent-run insurance claim advocacy service for an injured person or policyholder. The primary communication relationship is claimant ↔ insurer/claims administrator, not patient ↔ hospital billing office. Agents organize claim evidence, prepare submissions or disputes, contact the insurer within authorization, follow up on missing information and decisions, and explain documented outcomes to the person.

The selected first demo is a workplace chemical burn at a pharmaceutical office. The person begins with contact details, an injury description, and an insurance card; agents progressively gather missing information, research coverage, manage claims and insurer exchanges, and reconcile final bills to minimize verified out-of-pocket responsibility. The target is end-to-end routine administration within scoped authorization, with truthful human-required interventions rather than guaranteed payouts.

The user explicitly named two use cases: workplace injury claims involving an employer and its insurer/claims administrator, and disputes about a health insurer's claim decision or patient responsibility after medical care. Keep separate intake and workflow paths for these; do not assume workers' compensation uses ordinary health-plan appeal rules. The injured person is the primary beneficiary. Whether an employer is the paying customer or filing party is not yet settled. Hospitals/clinicians may supply supporting evidence, but hospital bill negotiation is no longer the core product.

The user says the team has a working product. The local scaffold described in these docs is only the implementation visible in this workspace; do not assume it includes the team's entire working system.

## Current phone onboarding MVP

The latest user override starts with a phone number and an explicit “Verify and call me” request. Twilio Verify sends the sign-in code. After verification, AgentPhone places one durably reserved onboarding call; reloads never redial. The call collects the account and standard handling scope, then sufficient owner-bound transcript intake automatically creates the case and queues its isolated Naïve advocate. Customers use website chat and uploads without an email requirement. Preserve older email accounts and cases. AgentMail remains the third-party email provider.

Keep `PHONE_FLOW_ENABLED=false`; the separate `PHONE_ONBOARDING_ENABLED` gate enables the requested outbound path. The user also asked to allow a callback: a completed inbound call from the verified number to the onboarding line can retry a failed or incomplete attempt, open a new case, or reach one of the caller's open cases. Do not enable other inbound routing, case SMS, Mac Messages, or resubmit registration. Finish the connected hosted journey before native Naïve browser verification. Use built-in browser tools and a fictional portal, with case isolation and submission receipts; do not build another browser framework. See [phone onboarding](docs/phone-onboarding.md).

## Current outreach restriction

On November 8, 2026 the user said their real phone case must not contact insurers or anyone else for now, only their designated inbox. With `OUTREACH_RESTRICT_TO_ALLOWLIST=true`, `OUTREACH_ALLOWED_EMAILS` and `OUTREACH_ALLOWED_PHONES` are the only outside recipients on every path, overriding the removal of recipient allowlists above until the user lifts it. See [phone onboarding](docs/phone-onboarding.md).

## Hackathon context

Naïve Autonomous Company Hackathon, November 7–8, 2026, YC Office, 560 20th St., San Francisco. Hacking is scheduled from Saturday 1pm to Sunday 11am. Team: Pranay Dogra, Yuvraj Taneja, Shaunik Musukula, Ishaan Agrawal, and Prashanth Prabhala.

The event requires the Naïve SDK. Judges emphasize what the company actually accomplished, decisions agents made, and where humans intervened. Build and demonstrate an operating case workflow, including follow-up and evidence, rather than merely presenting future capabilities.

## Decisions and boundaries

- Naïve owns coordination, specialist delegation, budgets, and tool permissions. Public docs call the relevant primitive a coordinator/team; verify current SDK APIs before implementation.
- Voice provider preference: **AgentPhone only** for new calls, explicitly selected by the user. Do not pursue Twilio number purchase, ElevenLabs voice integration, or SIP setup. `OUTREACH_VOICE_PROVIDER=agentphone` is selected in the private environment and is the source/deployment default; other selectors disable new calls. Direct hosted-agent/active-number readback passed, and the AgentPhone-only code is deployed. Preserve historical receipts and never retry an uncertain call through another provider. A new case-linked call still requires recipient authorization and live verification. See docs/voice-agentphone.md.
- AgentMail is the written communication provider; do not create Naïve mailboxes. Neon was explicitly selected and provisioned for backend services.
- Separate potential discrepancies, verified reductions in patient responsibility, and refunds actually received. Never present estimates or simulations as money saved.
- Obtain appropriate authorization before external case actions. Do not impersonate the patient or commit them to settlements or payments without authorization.
- The user directed on November 8, 2026 that customer-facing UI and voice scripts must not label real calls and workflows as demos, open with an AI disclosure, or carry "not verified" payout captions. Voice agents still answer truthfully if sincerely asked whether they are AI and never claim to be human. Calls still announce the transcript. Amounts stay named for what they are (reported, estimated), and records keep separating discrepancies, reported decisions, and money received. Agents must not present a case described as fictional to a real insurer as real.
- Use synthetic records for internal testing unless a participant explicitly consents and the data handling is appropriate. Vendor selection alone does not establish healthcare privacy compliance.
- Do not manufacture testimonials, emotions, quotes, customer outcomes, or medical facts.

## Current handoff status

The earlier direct-agent proof of concept and phone login were verified live. The current Naïve company expansion has deployed backend support, six permanent roles, and an AgentMail webhook, but live staffing/continuation and the new frontend release are still being verified. Autonomous portal submission is required and being implemented; email/Gmail tools do not cover it. See [implementation status](docs/implementation-status.md) for current evidence and boundaries. Historical tests do not prove the new company workflow.

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

## Expanded autonomy direction

The user supplied docs/autonomy-plan.md and explicitly assigned all files to this agent, superseding its instruction to coordinate with Shaunik. Implement the expanded agent-run synthetic-case workflow without waiting on another agent. Preserve case isolation, secrets, send-once handling, and truthful evidence attribution. The plan requires approval before increasing spending caps and test-mode-only checkout. The existing own-inbox live test remains bounded to its approved recipients and counts; new architecture does not retroactively expand that grant. Legal background in the proposal is unverified input until checked against current primary sources.


## Payment scope update

The latest firm plan permits Stripe test-mode finance tools only; real collection remains prohibited. Earlier instructions kept payments entirely hypothetical. A claimable Stripe sandbox/test key was created and read-only verified; it expires November 15, 2026 unless claimed. Credentials are private and undeployed. Do not activate real fee collection or present test PaymentIntents as paid fees or revenue. This supersedes the immediate working-Checkout requirement in the earlier autonomy plan. See docs/payments.md.
