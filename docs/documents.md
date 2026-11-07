# Private case documents

`src/Documents.tsx` uploads synthetic insurance cards, medical bills, explanations of benefits, and incident records. `backend/document-routes.ts` implements authenticated upload, listing, and download. `backend/document-storage.ts` uses Files SDK's Neon adapter with the branch-injected AWS environment variables. The `case-documents` bucket in `neon.ts` is private; credentials and object keys are not returned to the browser.

Uploads accept PNG, JPEG, WebP, and PDF, up to 5 MB each and 20 documents per case. The backend checks the declared type against file signatures. This is format screening, not malware scanning. Downloads are attachments with `nosniff`, behind the same case-owner authorization as the metadata. Use synthetic files only.

Migration 0005 adds `advocacy_documents`. A client-generated UUID reserves the case, immutable object key, original filename, type, byte count, SHA-256, and document kind before storage writes. A retry must match the reserved case, hash, type, and kind. Concurrent retries write identical bytes. Transitioning from uploading to ready advances the case revision exactly once and clears the previous analysis. A previous review or outreach draft remains historical and cannot authorize work on the new revision.

An interrupted upload remains reserved and can be retried with the same request ID. The current browser retains that ID while the form is open; after a reload, a new attempt reserves a new document. Document retention blocks case deletion. There is no document deletion or automated orphan cleanup yet.

Saving a file does not mean an agent has read it. The extraction flow below provides an explicit reading and confirmation step. The Naïve intake configuration now enables `view_image` access at intake version 6, with per-agent version pins so the other specialists stay at version 5. The standalone proof is `scripts/card-reader-smoke.ts`; case integration is described below. `NAIVE_FILES_API_KEY` is a separate, locally stored key with only file read/write scopes; it is supplied only to the case Function, never the browser.

Verification: `npm run build`; `npx tsx --test scripts/document-storage.test.ts`; `npx tsx scripts/document-app-smoke.ts` verifies actual storage through the deployed authenticated API, UI upload, persistence, immutable concurrent retries, exactly one revision increment, anonymous bucket rejection, and second-user isolation. It creates retained synthetic test records.

## Document extraction and confirmed evidence

Migration 0006 adds `advocacy_document_extractions`, one durable attempt per document. `backend/document-extraction-routes.ts` provides POST extraction start, refresh, and confirmation endpoints under the owner-checked document route. Starting a reader requires a configured test operator; refreshing and confirming requires case ownership. Naïve credentials remain server-only (`NAIVE_FILES_API_KEY`, `NAIVE_INTAKE_ID`, and the existing runtime key).

The server verifies the stored file hash before processing. Images are copied to Naïve Files and read through the intake agent's `view_image` tool. A result is accepted only after the session ends, the schema validates, no approvals are pending, and the event log proves a successful view of that exact file. PDF documents use the embedded text layer through `unpdf`, with a 20-page and 30,000-character limit. Image-only PDFs are rejected with instructions to upload page images; PDF text extraction is not OCR and can miss handwriting or image content.

The provider upload is reserved before it begins. An uncertain upload is never repeated automatically; an operator must reconcile it. If a process stops during preparation, its reserved state remains visible rather than silently starting another upload. Once the file ID or PDF text is saved, session creation uses the document UUID as its idempotency key. Reader calls retain the approved $0.25 per-task cap and the intake agent's existing monthly cap.

The UI presents the transcription, named fields, and uncertainty notes. Missing fields are null. Reading alone does not change claim facts. The owner compares the transcription with the original and confirms it; confirmation advances the case revision exactly once. Incorrect output remains unconfirmed; a clearer new image or an explicit case-details correction is needed. Confirmation proves the user's review, not insurance coverage.

Crew requests capture case details and document evidence under one case lock. Only confirmed extraction text is included; other files appear as unconfirmed manifests. Structured reviews must reference an exact supplied document UUID and SHA-256. Historical runs keep their immutable input. The model may still misinterpret evidence; neither extraction nor a valid reference establishes eligibility, savings, or an insurer decision.

`src/Documents.tsx` provides read, refresh, and confirm actions. `scripts/document-reader.test.ts` checks image-read provenance, nullable fields, source-reference rejection, and actual PDF text extraction. Live integration verification is recorded separately in the change log. Reading is not yet scheduled automatically and does not send messages or submit claims.

`npx tsx scripts/document-reader-app-smoke.ts` verifies actual image and PDF reads through the deployed API, concurrent/idempotent starts, user confirmation, source-linked crew completion, and null unknown financial values. It requires the existing synthetic test operator to be temporarily enabled. `npx tsx scripts/document-reader-readback.ts` then verifies saved source links and restored spending denials after the allowlist is reverted. Provider pauses remain visible as reader error codes on the retained session; they do not create another paid run.
