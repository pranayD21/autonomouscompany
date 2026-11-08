# Chat-first individual claim page

## Goal and hierarchy

The claim page makes the owner ↔ Assurance conversation the central working surface, while keeping supporting evidence and agent actions independently inspectable. It follows the landing page’s paper background, DM Sans typography, ink text and blue accent, adding restrained sky/lilac/peach surfaces rather than an unrelated dark theme.

`src/Workspace.tsx` owns the case title, one conversation, conditional recorded outcome, and a secondary **Behind your claim** area. The unverified top-of-page bill-minus-EOB discrepancy strip is removed; entered bill and EOB amounts remain in Case details. Delete and optional Gmail connection move into Case details. Agent controls sit directly above chat rather than requiring a separate navigation shortcut.

`src/Autonomy.tsx` has an optional compact mode. It renders status as one slim row: the label, the standard scope sentence and **Start handling my case** when no grant is active, or **Stop agent work** while one is. **What Assurance is handling** (goal and status explanation) appears only while work is active and the agent has recorded a goal. The row places the existing external-action/reply timeline behind **Activity log**. Version-2 questions remain in the persistent conversation rather than appearing twice. Legacy engine approval and update controls remain available under their existing authorization checks.

`src/CaseChat.tsx` retains server-backed messages, timestamps, read permissions, owner isolation, polling, immutable retry IDs, and the stopped-work notice. Its empty state offers a draft-only question starter and a real upload action; no starter sends a message automatically. Color and orb motion reflect actual server state, not fabricated progress. On small screens, the message log uses the document scroll rather than a fixed-height nested scrolling trap.

## Upload and evidence

`src/Documents.tsx` provides `CaseDocumentsProvider`, keyed to both claim and owner in CaseView. It owns the existing authenticated file upload, extraction, download, and confirmation operations. `CaseDocumentUpload` mounts the Aceternity-derived `src/ui/FileDrop.tsx` control directly inside `src/ui/ClaimComposer.tsx` through its attachment slot. There is only one file picker and no separate primary document-upload section. Upload state and errors remain outside collapsed disclosures in the chat. A success notice distinguishes an uploaded file and a reading request from confirmed extraction.

Uploads remain immediate (independent of the text-message send button), sequential, and limited to the existing PDF/PNG/JPEG/WebP types and 5 MB per file. The same document API and automatic extraction call are used. An in-flight ref prevents overlapping upload invocations. The document library becomes a collapsed **Case documents** disclosure, retaining original downloads, reading state, extracted text, uncertainties, retries, and optional owner confirmation. It does not mark model extraction as owner-confirmed.

The composer retains the 4,000-character limit, autosizing field, IME-safe Enter submission, Shift + Enter newline, accessible labels, and stable-message retry semantics. File uploads are separately disabled during document operations; uncertain message text stays read-only while the same message can be retried. `FileDrop` honors reduced-motion preferences without removing keyboard or file-picker access.

## Component sources

The rounded composer continues the user-provided 21st.dev anark17r prompt-box adaptation. The animated lift/tilt uploader is the existing Aceternity UI File Upload adaptation, now reused where the owner writes messages. No new UI dependency or unavailable component source is installed. The additional 21st.dev catalog retrieval was quota-locked; it is not claimed as installed component code. `src/claim-workspace.css` scopes the new hierarchy, gradients, message treatments and responsive disclosures to the claim page. Other routes retain their own styles.

## Design jury

The user requested independent GPT models with different personalities. All three read-only jurors completed their reviews: product minimalism (GPT-6 Astra), trust/accessibility (GPT-6.1 Terra), and expressive interaction design (GPT-6 Luna). They agreed to make chat primary, retain immediate stop and recovery controls, remove the discrepancy strip and repeated question/orb, and move inspectable records into disclosures.

The compact agent control line sits above chat, including on mobile, so Stop never requires opening a disclosure. Activity is below chat; documents and editable case facts occupy the desktop context column and follow chat on mobile. One conversation orb remains. The composer shows its character count near the limit and keyboard instructions on focus. Outcome amounts use “Reported reduction,” not “You save”; responsibility values, refund received, calculations and quotes are in a disclosure. Stale-evidence warnings, summary and attribution stay visible. No celebratory money animation is used.

## Verification

`scripts/claim-composer.test.tsx` checks markup, disabled/empty/saving behavior, escaping, retry controls, an in-composer file picker, and truthful upload-busy labels. `scripts/case-chat-ui-fixture.ts` is updated for the shared document provider and in-composer picker. Existing activation-state and progress tests remain relevant. The synthetic-only `scripts/claim-page-fixture.ts` starts a local Vite fixture on port 4193 with mocked messages, documents, agent state and failures; it must be launched with placeholder `VITE_NEON_AUTH_URL`, `VITE_NEON_REALTIME_URL`, and `VITE_CASES_API_URL` values. Its fetch shim rejects unexpected origins and does not contact an insurer, send communications or use real case data. Stop it with Ctrl+C.

Build and browser verification outcomes are recorded in `docs/change-log.md`. The latest build and 18 focused tests passed; the full-page fixture covered responsive layout, retry identity, upload success/failure/oversize validation, stop state and draft-only starters. A local synthetic fixture does not establish hosted deployment, real extraction, or insurer outcomes. This redesign does not change backend permissions or activate any external communication.
