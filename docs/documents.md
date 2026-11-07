# Private case documents

`src/Documents.tsx` uploads synthetic insurance cards, medical bills, explanations of benefits, and incident records. `backend/document-routes.ts` implements authenticated upload, listing, and download. `backend/document-storage.ts` uses Files SDK's Neon adapter with the branch-injected AWS environment variables. The `case-documents` bucket in `neon.ts` is private; credentials and object keys are not returned to the browser.

Uploads accept PNG, JPEG, WebP, and PDF, up to 5 MB each and 20 documents per case. The backend checks the declared type against file signatures. This is format screening, not malware scanning. Downloads are attachments with `nosniff`, behind the same case-owner authorization as the metadata. Use synthetic files only.

Migration 0005 adds `advocacy_documents`. A client-generated UUID reserves the case, immutable object key, original filename, type, byte count, SHA-256, and document kind before storage writes. A retry must match the reserved case, hash, type, and kind. Concurrent retries write identical bytes. Transitioning from uploading to ready advances the case revision exactly once and clears the previous analysis. A previous review or outreach draft remains historical and cannot authorize work on the new revision.

An interrupted upload remains reserved and can be retried with the same request ID. The current browser retains that ID while the form is open; after a reload, a new attempt reserves a new document. Document retention blocks case deletion. There is no document deletion or automated orphan cleanup yet.

Saving a file does not mean an agent has read it. OCR, evidence extraction, and source-linked agent review remain unfinished; the UI states this explicitly. The Naïve intake configuration now enables `view_image` access at intake version 6, with per-agent version pins so the other specialists stay at version 5. Live extraction is tested separately by `scripts/card-reader-smoke.ts`; it is not connected to case documents yet. `NAIVE_FILES_API_KEY` is a separate, locally stored key with only file read/write scopes; it is not exposed to the browser or deployed to the case Function yet.

Verification: `npm run build`; `npx tsx --test scripts/document-storage.test.ts`; `npx tsx scripts/document-app-smoke.ts` verifies actual storage through the deployed authenticated API, UI upload, persistence, immutable concurrent retries, exactly one revision increment, anonymous bucket rejection, and second-user isolation. It creates retained synthetic test records.
