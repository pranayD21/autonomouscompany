# Insurer-first product direction

The user changed the core relationship to injured person/policyholder ↔ insurer/claims administrator. Hospital billing negotiation is no longer the main use case. Keep existing provider accounts, authorization records, durable case reviews, and outreach infrastructure; use them for the insurance workflow.

## Workplace injury path

Intake should identify the injured worker, employer, insurer or claims administrator, jurisdiction, incident date, claim stage, claim reference if assigned, supplied reports/forms, missing documents, and requested help. Do not assume a claim exists already or that every workplace injury uses the same jurisdictional process.

The workflow should help prepare the relevant information, coordinate required employer involvement, confirm receipt, track requests, and explain documented decisions. In California, the official DWC filing guide describes employee and employer sections of the claim form and the employer forwarding it to the insurance company. This supports a multi-party workflow rather than pretending the injured person simply bypasses the employer. [California DWC filing guide](https://www.dir.ca.gov/DWC/FileAClaim.htm).

The injured person is the beneficiary. Whether the employer pays for the product, assists filing, or is merely a case participant has not been decided. Do not grant employers access to an individual's case merely because they are named in it.

## Health-insurance dispute path

Intake should collect insurer/plan, claim reference, service date, current status, the actual EOB or denial notice, the insurer's stated reason, relevant policy material, supporting records, and the person's desired outcome. A bill/EOB mismatch is a lead to investigate, not a proven denial or overcharge.

The workflow should explain the insurer's stated decision, request clarification or missing documents, prepare an evidence-backed dispute, confirm submission, and track the response. HealthCare.gov distinguishes internal appeals from external review; the actual notice, plan, and applicable process determine the right next step. Do not insert generic deadlines into a case. [HealthCare.gov appeal overview](https://www.healthcare.gov/using-marketplace-coverage/appealing-insurance-company-decisions/).

## Shared system

- Naïve coordinator: chooses the claim-specific workflow and next step.
- Intake agent: builds a document-backed claim record and requests missing information.
- Investigator: checks insurer reasoning against supplied evidence.
- Advocate: prepares insurer communications and submissions for authorization.
- Verifier: checks receipts and documented outcomes before reporting progress.
- AgentPhone/ElevenLabs: insurer calls; existing native AgentPhone demo is verified, ElevenLabs SIP is not.
- AgentMail: insurer correspondence and future reply-triggered follow-up. One authorized outbound email is verified.
- Neon: cases, evidence references, authorization, review snapshots, communications, and status history.

## Implementation boundaries

The database/UI now supports progressive workplace-injury and health-insurance intake. It does not yet have actual document upload, policy parsing, forms, a claim submission integration, or automatic reply/schedule processing. Existing synthetic tests prove infrastructure, not a workers' compensation claim or successful insurance appeal. Agent instructions are configured for insurer-facing triage while those intake paths are implemented. The user selected the workplace chemical-burn scenario as the first demo; health-insurance disputes remain a related path.


## Selected demo: chemical burn at work

A person working in a pharmaceutical office suffers a workplace chemical burn and wants the care covered. This is the user-selected scenario, not a real participant or verified incident.

The desired entry point is contact details, a short injury description, and an insurance card. That is the start of progressive intake, not proof that every necessary fact is present. Agents gather employer, incident date/location, treatment and bills, relevant coverage, claim status, supporting documents, and case authorization as needed. They must not invent missing facts or submit an attestation as if the claimant supplied it.

The desired end-to-end operation is:

1. Understand the incident and gather missing facts.
2. Research potentially applicable coverage and benefits: employer workers' compensation, relevant personal health coverage, and other supplied applicable benefits. Establish responsibility and coordination rather than assuming duplicate payment is available.
3. Identify the insurer/claims administrator, employer contact, necessary documents, and the actual submission process.
4. Prepare and submit supported claims within the person's authorization, obtaining required signatures or confirmations from the correct party.
5. Confirm receipt and reference numbers, handle requests for information, and keep following up.
6. Review insurer responses; seek correction, reconsideration, or an evidence-backed dispute where supported. Negotiation is not a substitute for coverage rules or the relevant claim procedure.
7. Reconcile the eventual medical bills, EOBs, adjustments, and payments. Investigate unsupported charges and collect corrected documents where appropriate.
8. Close only with a documented decision, benefits/payment outcome, and final patient responsibility, or a clearly explained unresolved issue requiring a person.

The product target is autonomous routine administration after a scoped case authorization, not asking for approval at every trivial follow-up. Settlements, releases, attestations, financial commitments, contested legal positions, and unclear authority require human involvement. Current per-action synthetic test approval is an implementation stage, not the final product experience.

Primary success measures: verified patient out-of-pocket responsibility, documented benefits paid/coverage obtained, claim progress, time to resolution, and human interventions. Do not promise a payout, a successful appeal, a globally lowest price, or a zero balance. Insurer payment to a provider, reimbursement to the claimant, income-replacement benefits, and bill reductions are different outcomes.

## Progressive intake implementation

The app now starts with a workplace injury by default, with a separate health-insurance option. A workplace case needs a title, contact name, email or E.164 phone number, and incident description. Employer, jurisdiction, incident date, insurer, policy/member ID, claim reference/stage, desired outcome, and financial amounts can be added later. This remains synthetic-only; insurance-card/document uploads are not yet implemented.

Unknown bill/EOB amounts are stored as null and shown as unknown. An explicit zero remains zero. Crew output accepts a null potential discrepancy and candidate coverage avenues; it must not convert missing amounts into a zero financial outcome.

Updating details uses an expected revision to prevent lost edits. Each crew request belongs to one immutable case revision; earlier runs and saved reviews are preserved. The current case requires a fresh review after changes. Outreach drafts also belong to a revision and cannot dispatch against changed facts, including a revision check in the atomic database claim. Old receipts remain retained. Gateway analysis similarly cannot overwrite a newer revision.

Files: `backend/claim-input.ts` defines and validates intake; `backend/schema.ts` and migration 0004 add case type/intake/revisions and nullable amounts; `src/CaseForm.tsx` provides creation and editing; `backend/api.ts` handles owner-scoped PATCH, revision-scoped reviews, and sealed Realtime fields. `scripts/claim-input.test.ts` covers null/zero, required data, invalid values, and old billing input compatibility.

The crew can return up to three `next_questions`, shown separately from the longer missing-evidence list. The prepared outreach text uses those next questions when present. This keeps a request for the next necessary facts separate from a comprehensive intake questionnaire. `scripts/injury-app-smoke.ts` tests a live synthetic injury case, review, progressive edit, stale-edit rejection, and stale-draft rejection. `scripts/injury-crew-smoke.ts` separately checks progressive-intake wording against a live capped provider run. Both retain local run IDs rather than restarting on observation timeout.
