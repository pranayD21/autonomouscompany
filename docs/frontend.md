# Frontend workspace

The browser app is a React/Vite single page (`src/`). Signed-out visitors see the landing page (`src/Landing.tsx`); signed-in users get the case workspace (`src/Workspace.tsx`). Styling is plain CSS in `src/style.css` and `src/landing.css`; animation uses the `motion` package. The hover-expand sidebar (`src/ui/Sidebar.tsx`) is adapted from Aceternity UI (MIT).

## Routes

Hash routes keep the open view across reloads: `#home` (landing), `#workspace` (overview), `#new` (intake form), `#case/<id>` (one case).

## Workspace layout (simplified 2026-11-08)

The user asked for the app to be as simple as the landing page, keeping only what the case workflow needs. Each screen answers three questions in order: what is happening, does it need me, and what has been done.

**Overview** (`Overview` in `src/Workspace.tsx`): "Your cases" and one tile per case plus "Open a new case". Each tile shows the case type, a status badge (Needs you / Waiting / Resolved) and one summary line, both from `deriveProgress` in `src/progress.ts` via `useProgressMap`. `deriveProgress(case, snapshot, agentEnabled)` is pure and covered by `scripts/progress.test.ts`; its snapshot comes from `/documents`, `/crew`, `/actions`, `/replies`, `/outcomes` and `/autonomy`. It refreshes when a non-GET `/cases/:id/...` request succeeds (`src/services.ts` dispatches `assurance:case-changed`), on window focus, and every 30 seconds while the tab is visible. Pending phone intakes and the phone-link control (`src/PhoneIntakes.tsx`) appear only here.

**Case page** (`CaseView` in `src/Workspace.tsx`), top to bottom:

1. Header: back link, case type and claim number, title, Delete.
2. Status card (`src/Autonomy.tsx`, region "Case agent activation"): a single heading from `sessionStatus` (Getting started, Working, Waiting, Needs your attention, Agent finished, Stopped, Not started), one line of detail, the agent's goal, and **Stop agent work** while an authority is active. When the agent needs the owner, the latest `request_human_help` question appears in the card with the response box, **Send response**, and **Continue with updated information**. A Naïve session still shows **Review pending actions**. A case that has never started, or was stopped, shows **Start handling my case**; a completed case does not.
3. Outcome (`src/Outcomes.tsx`): rendered only after an outcome exists. Shows the latest report: summary, claim decision, owed before/now, reduction, refund received, a collapsed explanation with quotes, and the "not a verified payout" caveat.
4. Activity: one newest-first feed merging agent decisions (`/autonomy`), sent messages (`/actions`, matched by the decision's `action_id`) and received replies (`/replies`). Emails and calls show recipient, subject, delivery state and a collapsed message body. Replies show sender, subject, and whether they were held. Questions, waits and case closure appear as plain sentences.
5. Documents (`src/Documents.tsx`): a compact list with reading state, download, and a collapsed "What we read" transcription with optional confirmation. One **Add a document** button accepts several files; uploads are saved as `kind: "other"` and reading starts automatically, the same as intake.
6. Details: description, a compact fact list (insurer, employer, claim number, member ID, date, state, stage, bill and EOB amounts when given), notes, and **Edit details**, which opens the existing `CaseForm`.

Removed from the signed-in app, with the reason:

- The hardcoded "See what Assurance is doing for you" card was identical on every case, so it gave no information.
- The bill/EOB "potential discrepancy" card and the overview's "$ to investigate" total subtracted two numbers the user typed in, which is not a verified discrepancy and means nothing for workplace injury. The amounts remain in Details.
- The section tab bar and Done/Next-step tags were navigation for a page that is now short enough to scan.
- "Case agent setup", "Scope and controls", engine name, finish condition, and "Round N" labels were internal. The engine label helper remains in `activation-state.ts` for tests.
- The legacy optional Naïve review and the manual draft-and-approve outreach form. Agent emails enable reply monitoring automatically (`backend/open-case-actions.ts`), and replies now appear in Activity. The backend endpoints are unchanged. `src/CrewReview.tsx`, `src/Outreach.tsx`, `src/ui/SectionNav.tsx`, `src/ui/CaseSection.tsx`, `src/ui/FileDrop.tsx` and `src/ui/motion.tsx` were deleted.
- The document-type dropdown and large drop zone.
- The greeting, the visible green live dot (a hidden "Live updates connected" label remains, and a visible pill appears only while reconnecting), the workspace footer, and the per-case status text in the sidebar.

`deriveProgress` no longer tells the owner to "Approve your outreach draft". No approval control exists, and an agent email is briefly in `draft` while it sends.

## Brand mark and hero wordmark

The logo is a two-stroke "A" drawn as the `Logo` SVG component in `src/Icons.tsx`, filled with the brand blue (`--blue`, `#2465ef`). It appears in the landing header, the sign-in header and the workspace sidebar, nudged down `.09em` so it centres on the lowercase wordmark. `assets/icon.svg` (README) and `public/favicon.svg` use the same paths with no background.

The landing hero (`src/components/strikethrough-replace.tsx`, styles in `src/landing.css`) animates in two phases. First a line strikes through "in" and a handwritten blue "as" is written above it. Then the "as" drops into line, sitting `.1em` below the bottom of "surance" (canvas-measured ink bounds) so the script reads as part of the word, while the struck "in" slides down at full size behind the "Insurance is complicated." heading. A mask fades the "in" out before it reaches that heading (the `fadeBelow` prop names it). The mask's stops are offset by the registered `--in-y` property so the fade stays fixed on the page while the word moves. Offsets are measured in em and re-measured on font load and resize. Extra space under the wordmark (`.42em` bottom padding) sets the heading and call to action lower so more of the dropped "in" shows. With reduced motion the page shows the settled layout immediately.

## Hero photo backdrop

Behind the landing hero, `src/components/hero-backdrop.tsx` (rendered by `MinimalHero`, below the particle canvas) shows twelve photos of people dealing with injury, recovery and the stress around it: a worried call, an ankle cast, a wheelchair consult, paperwork, a cane, rehab, waiting rooms. They sit in one row at full hero height and drift left in a seamless loop (the list renders twice and the track moves `-50%` over 300s). Styles in `src/landing.css` (`.hero-backdrop*`) make them grayscale with a slight warm tint at 20% opacity, fade them out at the top and bottom with a mask, and wash the left and right edges into the paper colour (lighter on phones so the photo stays visible). The strip is `aria-hidden`, and reduced motion stops the drift.

Files are `public/hero/01-*.webp` to `12-*.webp`, 640px tall, about 280 KB together. All are CC0 photos found through Openverse, so no credit is required. Ten are from StockSnap (IDs `6WFSVFZQ9F`, `HMY3E2UQPN`, `KJIS7ELUI3`, `A5DG6YREVH`, `EDI8LWKSBB`, `JS1XAXLBPF`, `8YM7T7AERK`, `OHIFBU89LZ`, `TBEMNLXLVQ`, `NX9U9L1XRB`) and two from rawpixel ("Woman getting cast on her", "Physiotherapy hospital"). They are stock models, not customers, so they must not be captioned or presented as Assurance cases.

## Copy and hierarchy rules

Two rounds of a persona-based design review set these rules (verdicts were kept outside the repository):

- The landing page has no FAQ/questions section; it was removed on 2026-11-08 at the user's request. After the hero and "How it works" steps it goes straight to the footer.
- The landing keeps two signature lines, "Insurance is complicated. Getting help shouldn't be." and "You've got enough on your plate.", and drops other slogans.
- Relevant qualifications appear under money and AI output, and a concise scope disclosure accompanies submission. Repeated prototype banners are removed.
- Money appears only as agent-reported outcome figures with their caveat, or as amounts the user typed, labeled as such in Details.

## Verifying UI changes

`npm run build` type-checks and bundles; it needs the three `VITE_*` service URLs (placeholders such as `https://fixture-cases.compute.example.com` work for a local build). `npx tsx --test scripts/progress.test.ts scripts/activation-state.test.ts` runs the pure frontend logic tests. With the same placeholder variables, `npx tsx scripts/activation-ui-fixture.ts` and `npx tsx scripts/intake-ui-fixture.ts` run mocked browser checks. `CaseView` and `Overview` are exported so a fixture page can render them against mocked API routes. The Playwright suites in `scripts/*-smoke.ts` and `scripts/e2e.ts` need a running backend; the legacy crew, outreach and reply smokes target controls that were removed from the UI.

## Intake behavior

New intake accepts narrative or files, sends an idempotent auto-start request, and starts document reading automatically. Optional amounts and owner confirmation of machine transcription do not block starting. Direct activation readiness takes precedence over legacy crew access. Repeated prototype labels and the old permission-writing prompt are not restored. The production build keeps its bundle-size warning and the note that the dynamically imported services module is also statically imported.
