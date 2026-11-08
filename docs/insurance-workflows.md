# Insurer-first product direction

The user changed the core relationship to injured person/policyholder ↔ insurer/claims administrator. Hospital billing negotiation is no longer the main use case. Existing provider accounts, authorization records, durable case reviews, and outreach infrastructure serve the insurance workflow.

## Workplace injury path

Intake identifies the injured worker, employer, insurer or claims administrator, jurisdiction, incident date, claim stage, claim reference if assigned, supplied reports/forms, missing documents, and requested help. Do not assume a claim exists already or that every workplace injury uses the same jurisdictional process.

The workflow prepares the relevant information, coordinates required employer involvement, confirms receipt, tracks requests, and explains documented decisions. In California, the official DWC filing guide describes employee and employer sections of the claim form and the employer forwarding it to the insurance company. This supports a multi-party workflow rather than pretending the injured person simply bypasses the employer. [California DWC filing guide](https://www.dir.ca.gov/DWC/FileAClaim.htm).

The injured person is the beneficiary. Do not grant employers access to an individual's case merely because they are named in it.

## Health-insurance dispute path

Intake collects insurer/plan, claim reference, service date, current status, the actual EOB or denial notice, the insurer's stated reason, relevant policy material, supporting records, and the person's desired outcome. A bill/EOB mismatch is a lead to investigate, not a proven denial or overcharge.

The workflow explains the insurer's stated decision, requests clarification or missing documents, prepares an evidence-backed dispute, confirms submission, and tracks the response. HealthCare.gov distinguishes internal appeals from external review; the actual notice, plan, and applicable process determine the right next step. Do not insert generic deadlines into a case. [HealthCare.gov appeal overview](https://www.healthcare.gov/using-marketplace-coverage/appealing-insurance-company-decisions/).

## Shared system

- Naïve case advocate: one isolated advocate per case chooses the claim-specific workflow, research, contacts, and next step.
- Permanent company roles: CEO, Front Desk, Reviewer, Knowledge, Growth, and Finance handle budgets, staffing, review, playbooks, go-to-market, and test-mode finance. See [company runtime](firm-runtime.md).
- Legacy review crew: intake, investigator, advocate, and verifier specialists produce plans for older review routes.
- AgentPhone: insurer calls. New calls use AgentPhone only.
- AgentMail: insurer correspondence. Signed webhooks route replies on dedicated case mailboxes back to the case. Advocates reach customers through the website conversation; `send_email` to a customer is refused.
- Neon: cases, evidence references, authorization, review snapshots, communications, and status history.

## Implementation boundaries

The app supports progressive workplace-injury and health-insurance intake, private document upload, image/PDF-text extraction, and source-linked facts and citations. Advocates contact insurers with the `send_email` and `place_call` case tools and choose their own follow-up times with `schedule_followup`. Replies and completed calls wake the case. The team's manual end-to-end UI testing validated the customer workflow.

Coverage and policy interpretation stay provisional: a matching quote does not establish authority, currency, jurisdiction, or coverage.

The workplace chemical-burn scenario is the reference for workflow validation. Health-insurance disputes share the same system.


## Reference scenario: chemical burn at work

A person working in a pharmaceutical office suffers a workplace chemical burn and wants the care covered. This is the user-selected scenario, not a real participant or verified incident.

The person starts with contact details, a short injury description, and an insurance card. That is the start of progressive intake, not proof that every necessary fact is present. Agents gather employer, incident date/location, treatment and bills, relevant coverage, claim status, supporting documents, and case authorization as needed. They must not invent missing facts or submit an attestation as if the claimant supplied it.

The end-to-end operation is:

1. Understand the incident and gather missing facts.
2. Research potentially applicable coverage and benefits: employer workers' compensation, relevant personal health coverage, and other supplied applicable benefits. Establish responsibility and coordination rather than assuming duplicate payment is available.
3. Identify the insurer/claims administrator, employer contact, necessary documents, and the actual submission process.
4. Prepare and submit supported claims within the person's authorization, obtaining required signatures or confirmations from the correct party.
5. Confirm receipt and reference numbers, handle requests for information, and keep following up.
6. Review insurer responses; seek correction, reconsideration, or an evidence-backed dispute where supported. Negotiation is not a substitute for coverage rules or the relevant claim procedure.
7. Reconcile the eventual medical bills, EOBs, adjustments, and payments. Investigate unsupported charges and collect corrected documents where appropriate.
8. Close only with a documented decision, benefits/payment outcome, and final patient responsibility, or a clearly explained unresolved issue requiring a person.

Assurance runs routine administration autonomously under the owner's standard handling scope, without asking for approval at every follow-up. Settlements, releases, attestations, financial commitments, contested legal positions, and unclear authority require human involvement. Per-action synthetic approval applies only to the legacy manual outreach routes.

Primary success measures: verified patient out-of-pocket responsibility, documented benefits paid/coverage obtained, claim progress, time to resolution, and human interventions. Do not promise a payout, a successful appeal, a globally lowest price, or a zero balance. Insurer payment to a provider, reimbursement to the claimant, income-replacement benefits, and bill reductions are different outcomes.

## Progressive intake implementation

The website form starts with a workplace injury by default, with a separate health-insurance option. A new case needs a description of what happened or an attached document; the form derives the title if none is given. Contact details, employer, jurisdiction, incident date, insurer, policy/member ID, claim reference/stage, desired outcome, and financial amounts can be added later. Insurance-card/document uploads, reading, and confirmation are implemented; see documents.md. Phone-first owners supply the same information through the [onboarding call](phone-onboarding.md).

Unknown bill/EOB amounts are stored as null and shown as unknown. An explicit zero remains zero. Crew output accepts a null potential discrepancy and candidate coverage avenues; it must not convert missing amounts into a zero financial outcome.

Updating details uses an expected revision to prevent lost edits. Each crew request belongs to one immutable case revision; earlier runs and saved reviews are preserved, and a saved review applies only to its revision. Outreach drafts also belong to a revision and cannot dispatch against changed facts, including a revision check in the atomic database claim. Old receipts remain retained. Gateway analysis similarly cannot overwrite a newer revision.

Files: `backend/claim-input.ts` defines and validates intake; `backend/schema.ts` and migration 0004 add case type/intake/revisions and nullable amounts; `src/CaseForm.tsx` provides creation and editing; `backend/api.ts` handles owner-scoped PATCH, revision-scoped reviews, and sealed Realtime fields. `scripts/claim-input.test.ts` covers null/zero, required data, invalid values, and old billing input compatibility.

The legacy review crew can return up to three `next_questions`, kept separate from the longer missing-evidence list. This cap applies only to that review schema; case advocates ask their own questions in the website conversation. `scripts/injury-app-smoke.ts` covers a synthetic injury case, review, progressive edit, stale-edit rejection, and stale-draft rejection. `scripts/injury-crew-smoke.ts` separately checks progressive-intake wording against a capped provider run. Both retain local run IDs rather than restarting on observation timeout.

## Source-backed guidance

Case advocates choose their own public sources with `read_public_source` and save exact quotes with `cite_source`. Legacy crew reviews retrieve a configured set of official sources before agent work: California workplace cases use DWC guidance, and health-plan disputes use a general HealthCare.gov appeal overview. In that legacy path, missing and unsupported jurisdictions are explicit research gaps. Reviews retain source text, hashes, and retrieval times, and output exact-quote citations with applicability limitations. None of this is a policy eligibility determination. See [research implementation](research.md).
