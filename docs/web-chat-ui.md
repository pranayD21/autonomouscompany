# Website conversation UI

The case workspace includes a Conversation section directly after agent status. `src/CaseChat.tsx` shows actual saved owner messages and Assurance questions/updates. `src/Workspace.tsx` mounts it with a case-and-owner key so drafts do not move between cases. `src/style.css` defines the responsive message bubbles, bounded scrolling area and composer.

The interface uses the existing authenticated `api` helper and `VITE_CASES_API_URL`. It reads `GET /cases/:id/messages` as `{messages:[{id,role,text,created_at,kind}],state,waiting_on,can_send}` and posts `{id,text}` to the same route. Roles are `user` and `assistant`. The client does not manufacture greetings or model responses. Server state drives the header status; a successful save is reported as “Message saved,” not as completed agent work.

The client refreshes every five seconds, on case-change events and when the case revision changes. It follows new messages only while the reader is near the bottom, so polling does not pull someone away from older messages. The log is announced through an accessible live region. Mobile layouts keep messages within the viewport.

Failed writes retain the same operation ID and text for retry. The composer is locked while the result is uncertain; a later successful read can reconcile the saved ID. No message appears in the conversation until the server returns it. Messages remain available after reload. When work is stopped, the composer can still save notes if the server allows it and explains that sending will not restart agent work.

“Attach document” scrolls to and focuses the existing document upload control in `src/Documents.tsx`; it creates no parallel upload/storage path. A `document_request` message also offers that shortcut. The normal uploader handles file type, case ownership, extraction and evidence provenance.

## Verification

Run `npx tsx scripts/case-chat-ui-fixture.ts`. It starts an isolated local Vite fixture, supplies mocked auth/API responses, and closes the browser/server afterward. It checks saved-message persistence across reload, no optimistic success after a failed send, stable-ID retry, the existing document attachment shortcut, stopped-work messaging and a 390-pixel mobile viewport. No real SMS, email, agent session or case is created by this fixture.

The fixture passed after implementation, including the mobile overflow check. TypeScript passed. The backend interface and persistence are documented in [website conversation](web-chat.md).
