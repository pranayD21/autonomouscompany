# Official-source research

Starting a new case review now retrieves official guidance selected from a server-owned catalog in `backend/research.ts`. The initial adapters cover California workplace-injury filing/overview pages from DWC and a general US health-plan appeal overview from HealthCare.gov. Missing or unsupported workplace jurisdictions produce an explicit research gap. The app never assumes California from the hackathon location and never applies a health-plan appeal guide to a workers' compensation case.

This is a first research adapter, not nationwide coverage discovery or policy interpretation. Employer carrier identification, actual policy terms, plan classification, jurisdiction applicability, and personal health-plan coordination remain unresolved until supported by evidence. A source being official does not establish that its rules apply to the claimant.

## Retrieval and storage

Only exact catalog URLs may be fetched; neither case text nor model output can supply a URL. Requests do not include claimant details. Redirects are rejected, responses must be HTML, the download limit is 2 MB, and each request times out after 15 seconds. The parser removes scripts, navigation, forms, and other surrounding page elements, then requires a main content element. Unexpectedly short or large text fails retrieval rather than supplying an empty or truncated source.

Each successful source captures its ID, title, URL, scope, retrieval timestamp, normalized text, and SHA-256. Partial and failed retrievals are explicit. The research bundle is saved inside the immutable `advocacy_crew_runs.message` alongside the case and document evidence. No database migration is needed. Concurrent starts may duplicate read-only page retrieval, but the first stored case-revision request wins. Retrying an existing run reuses its exact source snapshot and session; it does not replace historical evidence with a newer page.

If the case changes during retrieval, the request returns 409 rather than attaching research selected for different facts. Fetching happens before taking the database case lock. Source refresh for an already reviewed case is not yet a separate action; a new case revision gets new research.

## Findings and limits

`research_findings` contains a statement, source ID, a short exact quote, and an applicability limitation. `completedCrewSnapshot` rejects unknown source IDs, quotes absent from the stored text, missing findings when sources were supplied, and more than 25 quoted words in total per source. The source metadata in the response comes from the server snapshot, never model-generated URLs. The UI displays official links, retrieval dates, scope, gaps, and the finding's applicability limitation.

These checks establish source and quote provenance. They do not mechanically prove that the model's interpretation follows from the quote. The request instructs the verifier to check that relationship, keeps procedure/coverage assertions in the research section, forbids invented deadlines and payer priority, and treats public guidance as general rather than an eligibility decision. Synthetic-only intake remains in effect.

## Verification

`npx tsx --test scripts/research.test.ts` checks jurisdiction selection, server-owned URLs, page cleanup, provenance, failed/oversized/redirected retrievals, exact quotes, quotation limits, and structured-review rejection. Live source retrieval and app review checks are recorded in the change log. No calls, emails, claims, or payments are triggered by research.

## Correcting a rejected review

The first live combined review failed exact-quote and quotation-limit checks. It was not saved as a valid result. The coordinator now uses `openai/gpt-5.4-mini` rather than Qwen Flash; the approved monthly and per-task caps are unchanged. Sources also include short, exact sentence candidates, and findings are limited to one per source. The investigator and other specialists retain their existing models and versions.

Migration 0007 adds correction-request and correction-sent timestamps to crew runs. An owner who is also a configured test operator can POST `/cases/:id/crew/repair` after a completed but rejected review. The UI offers “Correct rejected review.” The correction uses the original session, original source/document snapshot, and a stable provider idempotency key. It asks the model to select an exact candidate quote and remove unsupported assertions. Only one correction request is allowed per run; a repeated successful request does not send again. If sending is uncertain, a retry uses the same idempotency key. Ongoing reviews are not interrupted, valid reviews are not repaired, and the original task budget is not increased.

A corrected result still has to pass every original evidence check. If it fails again, the UI asks for operator review rather than hiding the failure or automatically creating more paid sessions.

The live `scripts/research-app-smoke.ts` check verifies deployed retrieval, exact immutable source input across repeated starts, confirmed documents, bounded UI correction, persisted citations, unknown financial values, and progressive synthetic follow-up requests. Its state file preserves the session for continuation; observation timeouts never start a replacement. `scripts/document-reader-readback.ts` checks that crew, correction, and document-reading starts return 403 once temporary test access is restored.
