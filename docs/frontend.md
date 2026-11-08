# Frontend workspace

The browser app is a React/Vite single page (`src/`). Signed-out visitors see the landing page (`src/Landing.tsx`); signed-in users get the case workspace (`src/Workspace.tsx`). Styling is plain CSS in `src/style.css` and `src/landing.css`; animation uses the `motion` package. Several components are adapted from Aceternity UI (MIT): the hover-expand sidebar (`src/ui/Sidebar.tsx`), file drop zone (`src/ui/FileDrop.tsx`), stateful button, step loader and timeline (`src/ui/motion.tsx`), and the sliding pill in the section nav (`src/ui/SectionNav.tsx`).

## Routes

Hash routes keep the open view across reloads: `#home` (landing), `#workspace` (overview), `#new` (intake form), `#case/<id>` (one case). Sections on the case page use `#section-overview`, `#section-documents`, `#section-authorization` (Agent work), `#section-review` (optional review), `#section-outreach` and `#section-outcomes`. The original overview, sidebar, case header, section navigation, uploader, and section order are retained. Legacy review and manual communications stay rendered inside a collapsed Additional review and communication tools panel.

## Section progress tags

`src/progress.ts` derives a progress object per case: who acts next (`you`, `waiting`, `done`), the next step, and step states for Details, Documents, Agent work and Outcome. `deriveProgress(case, snapshot, agentEnabled)` is pure and covered by `scripts/progress.test.ts`. The snapshot comes from existing endpoints: `/cases/:id/documents`, `/crew`, `/actions`, `/replies`, `/outcomes` and `/autonomy`.

The case page currently uses it only to tag sections. The section that holds the next step gets a blue **Next step** tag and a blue bar on its left edge. Finished sections get a green **Done** tag. `CaseSection` takes a `status` prop, and `useCaseProgress` in `Workspace.tsx` supplies it. The overview, sidebar and next-step card do not use the model; a fuller version that drove them was reverted at the founder's request.

The tags refresh when any non-GET request to `/cases/:id/...` succeeds. `src/services.ts` dispatches `assurance:case-changed`. They also refresh on window focus and every 30 seconds while the tab is visible.

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
- The optional review's "Run agent team" button is secondary (outlined).
- Unknown amounts show a small "Add bill and EOB amounts" prompt, never a large empty value.

## Verifying UI changes

`npm run build` type-checks and bundles. `npx tsx --test scripts/progress.test.ts scripts/activation-state.test.ts` runs the pure frontend logic tests. The Playwright suites in `scripts/*-smoke.ts` and `scripts/e2e.ts` need a running backend. Some open the overview and expect a case's `article` without navigating; with the overview as the signed-in default, they must open the case first.

## Concurrent intake integration

The founder-requested revert of the grouped dashboard and next-step redesign is preserved. Section progress tags and the blue current-section bar remain, alongside the streamlined intake. New intake still accepts narrative or files, sends an idempotent auto-start request, and starts document reading automatically. Inline owner answers, visible stop, and collapsed scope/engine metadata remain. Optional amounts and owner confirmation of machine transcription do not block starting. Direct activation readiness takes precedence over legacy crew access. Repeated prototype labels and the old permission-writing prompt are not restored.

Verification after integration: all 10 progress/activation-state tests, both mocked activation/intake browser fixtures, and the production build passed. The build retains the bundle-size warning and notes that the dynamically imported services module is also statically imported.
